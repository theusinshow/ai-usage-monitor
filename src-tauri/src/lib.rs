use chrono::{DateTime, Datelike, Local, TimeZone, Utc};
use keyring::Entry;
use reqwest::blocking::Client;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{mpsc, Mutex},
    thread,
    time::Duration,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WebviewWindowBuilder, WindowEvent,
};
use walkdir::WalkDir;

const CREDENTIAL_SERVICE: &str = "AI Usage Monitor";

struct AppState {
    database: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsageLimit {
    id: String,
    name: String,
    used: Option<f64>,
    remaining: Option<f64>,
    limit: Option<f64>,
    percentage_used: Option<f64>,
    reset_at: Option<String>,
    detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsageMetric {
    id: String,
    label: String,
    value: Option<f64>,
    formatted_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderUsage {
    provider_id: String,
    provider_name: String,
    r#type: String,
    status: String,
    connected: bool,
    plan: Option<String>,
    model: Option<String>,
    limits: Vec<UsageLimit>,
    metrics: Vec<UsageMetric>,
    last_updated: String,
    source: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    refresh_interval_seconds: u64,
    monthly_budgets: HashMap<String, Option<f64>>,
    history_retention_days: i64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            refresh_interval_seconds: 60,
            monthly_budgets: HashMap::from([("openai".into(), None), ("deepseek".into(), None)]),
            history_retention_days: 90,
        }
    }
}

fn empty_usage(id: &str, status: &str, error: impl Into<String>) -> ProviderUsage {
    let (name, kind) = provider_identity(id);
    ProviderUsage {
        provider_id: id.into(),
        provider_name: name.into(),
        r#type: kind.into(),
        status: status.into(),
        connected: false,
        plan: None,
        model: None,
        limits: vec![],
        metrics: vec![],
        last_updated: Utc::now().to_rfc3339(),
        source: None,
        error: Some(error.into()),
    }
}

fn provider_identity(id: &str) -> (&'static str, &'static str) {
    match id {
        "codex" => ("Codex", "subscription"),
        "claude" => ("Claude Code", "subscription"),
        "openai" => ("OpenAI API", "api"),
        "deepseek" => ("DeepSeek API", "api"),
        _ => ("Provider", "api"),
    }
}

fn credential(provider_id: &str) -> Result<Entry, String> {
    if !matches!(provider_id, "openai" | "deepseek") {
        return Err("Provider de credencial inválido.".into());
    }
    Entry::new(CREDENTIAL_SERVICE, provider_id).map_err(|error| safe_error(&error.to_string()))
}

fn safe_error(message: &str) -> String {
    let lower = message.to_lowercase();
    if lower.contains("bearer ") || lower.contains("api key") || lower.contains("authorization") {
        "A operação falhou sem expor detalhes sensíveis.".into()
    } else {
        message.chars().take(240).collect()
    }
}

#[tauri::command]
fn save_credential(provider_id: String, secret: String) -> Result<(), String> {
    if secret.trim().len() < 8 {
        return Err("A chave informada parece inválida.".into());
    }
    credential(&provider_id)?
        .set_password(secret.trim())
        .map_err(|error| safe_error(&error.to_string()))
}

#[tauri::command]
fn delete_credential(provider_id: String) -> Result<(), String> {
    match credential(&provider_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(safe_error(&error.to_string())),
    }
}

#[tauri::command]
fn get_credential_status() -> HashMap<String, bool> {
    HashMap::from([
        (
            "openai".into(),
            credential("openai")
                .and_then(|entry| entry.get_password().map_err(|e| e.to_string()))
                .is_ok(),
        ),
        (
            "deepseek".into(),
            credential("deepseek")
                .and_then(|entry| entry.get_password().map_err(|e| e.to_string()))
                .is_ok(),
        ),
    ])
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let db = state
        .database
        .lock()
        .map_err(|_| "Banco local indisponível.".to_string())?;
    let stored: Result<String, _> = db.query_row(
        "SELECT value FROM app_settings WHERE key = 'settings'",
        [],
        |row| row.get(0),
    );
    match stored {
        Ok(value) => serde_json::from_str(&value).map_err(|error| error.to_string()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(AppSettings::default()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_settings(settings: AppSettings, state: State<'_, AppState>) -> Result<(), String> {
    if !matches!(settings.refresh_interval_seconds, 30 | 60 | 300 | 900) {
        return Err("Intervalo de atualização inválido.".into());
    }
    let serialized = serde_json::to_string(&settings).map_err(|error| error.to_string())?;
    let db = state
        .database
        .lock()
        .map_err(|_| "Banco local indisponível.".to_string())?;
    db.execute("INSERT INTO app_settings (key, value) VALUES ('settings', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [serialized]).map_err(|error| error.to_string())?;
    prune_history(&db, settings.history_retention_days)?;
    Ok(())
}

#[tauri::command]
fn is_provider_available(provider_id: String) -> bool {
    match provider_id.as_str() {
        "codex" => which::which("codex").is_ok(),
        "claude" => {
            which::which("claude").is_ok()
                || dirs::home_dir().is_some_and(|home| home.join(".claude").exists())
        }
        "openai" | "deepseek" => credential(&provider_id)
            .and_then(|entry| entry.get_password().map_err(|e| e.to_string()))
            .is_ok(),
        _ => false,
    }
}

#[tauri::command]
fn get_provider_usage(provider_id: String, state: State<'_, AppState>) -> ProviderUsage {
    let settings = get_settings(state.clone()).unwrap_or_default();
    let usage = match provider_id.as_str() {
        "codex" => codex_usage(),
        "claude" => claude_usage(),
        "openai" => api_usage(
            "openai",
            settings.monthly_budgets.get("openai").copied().flatten(),
        ),
        "deepseek" => api_usage(
            "deepseek",
            settings.monthly_budgets.get("deepseek").copied().flatten(),
        ),
        _ => empty_usage(&provider_id, "error", "Provider desconhecido."),
    };
    if let Ok(db) = state.database.lock() {
        let _ = save_snapshot(&db, &usage);
    }
    usage
}

#[tauri::command]
fn test_provider_connection(provider_id: String) -> Result<(), String> {
    let usage = api_usage(&provider_id, None);
    if usage.connected {
        Ok(())
    } else {
        Err(usage
            .error
            .unwrap_or_else(|| "Não foi possível conectar.".into()))
    }
}

#[tauri::command]
fn is_openusage_available() -> bool {
    which::which("openusage").is_ok()
}

#[derive(Serialize)]
struct OpenUsageReport {
    report: String,
    payload: Value,
}

#[tauri::command]
fn run_openusage_report(report: String) -> Result<OpenUsageReport, String> {
    if !matches!(report.as_str(), "daily" | "weekly" | "monthly" | "blocks") {
        return Err("Relatório OpenUsage inválido.".into());
    }
    let output = Command::new("openusage")
        .args([&report, "--json"])
        .creation_flags_no_window()
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err("O OpenUsage não conseguiu gerar o relatório.".into());
    }
    let payload = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("JSON inválido do OpenUsage: {error}"))?;
    Ok(OpenUsageReport { report, payload })
}

fn codex_usage() -> ProviderUsage {
    if which::which("codex").is_err() {
        return empty_usage(
            "codex",
            "notInstalled",
            "Codex CLI não encontrado neste computador.",
        );
    }
    match query_codex_app_server() {
        Ok((account, rate_result)) => {
            let plan = account
                .pointer("/account/planType")
                .and_then(Value::as_str)
                .map(title_case);
            let rates = rate_result
                .pointer("/rateLimits")
                .cloned()
                .unwrap_or(Value::Null);
            let mut limits = Vec::new();
            for (id, label, key) in [
                ("primary", "5 horas", "primary"),
                ("secondary", "Semanal", "secondary"),
            ] {
                if let Some(value) = rates.get(key).filter(|value| !value.is_null()) {
                    let minutes = value.get("windowDurationMins").and_then(Value::as_u64);
                    let resolved_label = match minutes {
                        Some(0..=360) => "5 horas",
                        Some(361..) => "Semanal",
                        None => label,
                    };
                    limits.push(UsageLimit {
                        id: id.into(),
                        name: resolved_label.into(),
                        used: None,
                        remaining: None,
                        limit: None,
                        percentage_used: value.get("usedPercent").and_then(Value::as_f64),
                        reset_at: value
                            .get("resetsAt")
                            .and_then(Value::as_i64)
                            .and_then(unix_to_iso),
                        detail: None,
                    });
                }
            }
            ProviderUsage {
                provider_id: "codex".into(),
                provider_name: "Codex".into(),
                r#type: "subscription".into(),
                status: "connected".into(),
                connected: true,
                plan,
                model: None,
                limits,
                metrics: vec![],
                last_updated: Utc::now().to_rfc3339(),
                source: Some("codex-app-server".into()),
                error: None,
            }
        }
        Err(error) => empty_usage(
            "codex",
            "error",
            format!(
                "Codex detectado, mas os limites não puderam ser lidos: {}",
                safe_error(&error)
            ),
        ),
    }
}

fn query_codex_app_server() -> Result<(Value, Value), String> {
    let mut child = Command::new("codex")
        .arg("app-server")
        .creation_flags_no_window()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| error.to_string())?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or("Não foi possível abrir o Codex app-server.")?;
    for line in [
        json!({"method":"initialize","id":1,"params":{"clientInfo":{"name":"ai_usage_monitor","title":"AI Usage Monitor","version":"0.1.0"}}}),
        json!({"method":"initialized","params":{}}),
        json!({"method":"account/read","id":2,"params":{"refreshToken":false}}),
        json!({"method":"account/rateLimits/read","id":3}),
    ] {
        writeln!(stdin, "{line}").map_err(|error| error.to_string())?;
    }
    drop(stdin);
    let stdout = child.stdout.take().ok_or("Codex não retornou dados.")?;
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Ok(value) = serde_json::from_str::<Value>(&line) {
                let _ = sender.send(value);
            }
        }
    });
    let deadline = std::time::Instant::now() + Duration::from_secs(12);
    let mut account = None;
    let mut rates = None;
    while std::time::Instant::now() < deadline && (account.is_none() || rates.is_none()) {
        match receiver.recv_timeout(Duration::from_millis(400)) {
            Ok(value) => match value.get("id").and_then(Value::as_i64) {
                Some(2) => account = value.get("result").cloned(),
                Some(3) => rates = value.get("result").cloned(),
                _ => {}
            },
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }
    }
    let _ = child.kill();
    Ok((
        account.ok_or("Conta Codex não autenticada.")?,
        rates.ok_or("Limites Codex indisponíveis.")?,
    ))
}

fn claude_usage() -> ProviderUsage {
    let home = match dirs::home_dir() {
        Some(path) => path,
        None => return empty_usage("claude", "notInstalled", "Pasta de usuário não encontrada."),
    };
    let root = home.join(".claude").join("projects");
    if which::which("claude").is_err() && !root.exists() {
        return empty_usage(
            "claude",
            "notInstalled",
            "Claude Code não encontrado neste computador.",
        );
    }
    let now = Utc::now();
    let today = Local::now().date_naive();
    let month = (today.year(), today.month());
    let mut tokens_today = 0_f64;
    let mut tokens_month = 0_f64;
    let mut latest_model: Option<String> = None;
    if root.exists() {
        for entry in WalkDir::new(&root)
            .max_depth(4)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "jsonl"))
        {
            if let Ok(file) = File::open(entry.path()) {
                for line in BufReader::new(file).lines().map_while(Result::ok) {
                    let Ok(value) = serde_json::from_str::<Value>(&line) else {
                        continue;
                    };
                    let timestamp = value
                        .get("timestamp")
                        .and_then(Value::as_str)
                        .and_then(|text| DateTime::parse_from_rfc3339(text).ok())
                        .map(|date| date.with_timezone(&Utc));
                    let Some(timestamp) = timestamp else { continue };
                    let usage = value
                        .pointer("/message/usage")
                        .or_else(|| value.get("usage"));
                    let tokens = usage.map(sum_token_fields).unwrap_or(0.0);
                    let local_date = timestamp.with_timezone(&Local).date_naive();
                    if local_date == today {
                        tokens_today += tokens;
                    }
                    if (local_date.year(), local_date.month()) == month {
                        tokens_month += tokens;
                    }
                    if timestamp > now - chrono::Duration::days(30) {
                        if let Some(model) = value
                            .pointer("/message/model")
                            .or_else(|| value.get("model"))
                            .and_then(Value::as_str)
                        {
                            latest_model = Some(model.into());
                        }
                    }
                }
            }
        }
    }
    let mut metrics = vec![];
    if tokens_today > 0.0 {
        metrics.push(metric(
            "tokensToday",
            "Tokens hoje",
            tokens_today,
            format_compact(tokens_today),
        ));
    }
    if tokens_month > 0.0 {
        metrics.push(metric(
            "tokensMonth",
            "Tokens no mês",
            tokens_month,
            format_compact(tokens_month),
        ));
    }
    let error = if metrics.is_empty() {
        Some("Claude Code detectado. Ainda não há uso local legível; limites de assinatura não são expostos oficialmente pelo CLI.".into())
    } else {
        None
    };
    ProviderUsage {
        provider_id: "claude".into(),
        provider_name: "Claude Code".into(),
        r#type: "subscription".into(),
        status: "connected".into(),
        connected: true,
        plan: None,
        model: latest_model,
        limits: vec![],
        metrics,
        last_updated: Utc::now().to_rfc3339(),
        source: Some("local".into()),
        error,
    }
}

fn sum_token_fields(value: &Value) -> f64 {
    [
        "input_tokens",
        "output_tokens",
        "cache_creation_input_tokens",
        "cache_read_input_tokens",
    ]
    .iter()
    .filter_map(|key| value.get(*key).and_then(Value::as_f64))
    .sum()
}

fn api_usage(provider: &str, budget: Option<f64>) -> ProviderUsage {
    let key = match credential(provider)
        .and_then(|entry| entry.get_password().map_err(|e| e.to_string()))
    {
        Ok(key) => key,
        Err(_) => return empty_usage(provider, "notConfigured", "API key não configurada."),
    };
    match provider {
        "deepseek" => deepseek_usage(&key, budget),
        "openai" => openai_usage(&key, budget),
        _ => empty_usage(provider, "error", "Provider de API inválido."),
    }
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("AI-Usage-Monitor/0.1")
        .build()
        .map_err(|error| error.to_string())
}

fn deepseek_usage(key: &str, budget: Option<f64>) -> ProviderUsage {
    let response = match http_client().and_then(|client| {
        client
            .get("https://api.deepseek.com/user/balance")
            .bearer_auth(key)
            .send()
            .map_err(|e| e.to_string())
    }) {
        Ok(response) => response,
        Err(error) => {
            return empty_usage(
                "deepseek",
                "error",
                format!(
                    "Falha de rede ao consultar a DeepSeek: {}",
                    safe_error(&error)
                ),
            )
        }
    };
    if !response.status().is_success() {
        return empty_usage(
            "deepseek",
            "error",
            format!(
                "DeepSeek respondeu com status {}.",
                response.status().as_u16()
            ),
        );
    }
    let payload: Value = match response.json() {
        Ok(value) => value,
        Err(error) => return empty_usage("deepseek", "error", safe_error(&error.to_string())),
    };
    let info = payload
        .get("balance_infos")
        .and_then(Value::as_array)
        .and_then(|items| {
            items
                .iter()
                .find(|item| item.get("currency").and_then(Value::as_str) == Some("USD"))
                .or_else(|| items.first())
        });
    let balance = info
        .and_then(|item| item.get("total_balance"))
        .and_then(Value::as_str)
        .and_then(|value| value.parse::<f64>().ok());
    let currency = info
        .and_then(|item| item.get("currency"))
        .and_then(Value::as_str)
        .unwrap_or("USD");
    let mut metrics = vec![metric(
        "balance",
        "Saldo",
        balance.unwrap_or_default(),
        balance
            .map(|value| format_currency(value, currency))
            .unwrap_or_else(|| "Indisponível".into()),
    )];
    if let Some(budget) = budget {
        metrics.push(metric(
            "budget",
            "Orçamento mensal",
            budget,
            format_currency(budget, "USD"),
        ));
    }
    ProviderUsage {
        provider_id: "deepseek".into(),
        provider_name: "DeepSeek API".into(),
        r#type: "api".into(),
        status: "connected".into(),
        connected: true,
        plan: None,
        model: None,
        limits: vec![],
        metrics,
        last_updated: Utc::now().to_rfc3339(),
        source: Some("official-api".into()),
        error: None,
    }
}

fn openai_usage(key: &str, budget: Option<f64>) -> ProviderUsage {
    let client = match http_client() {
        Ok(client) => client,
        Err(error) => return empty_usage("openai", "error", error),
    };
    let now = Utc::now();
    let month_start = Utc
        .with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0)
        .single()
        .unwrap_or(now);
    let url = format!("https://api.openai.com/v1/organization/costs?start_time={}&end_time={}&bucket_width=1d&limit=31", month_start.timestamp(), now.timestamp());
    let response = match client.get(url).bearer_auth(key).send() {
        Ok(response) => response,
        Err(error) => {
            return empty_usage(
                "openai",
                "error",
                format!(
                    "Falha de rede ao consultar a OpenAI: {}",
                    safe_error(&error.to_string())
                ),
            )
        }
    };
    if response.status().as_u16() == 401 {
        return empty_usage("openai", "error", "A chave OpenAI foi recusada.");
    }
    let mut metrics = Vec::new();
    let mut limits = Vec::new();
    let mut note = None;
    if response.status().is_success() {
        let payload: Value = response.json().unwrap_or(Value::Null);
        let buckets = payload
            .get("data")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let costs: Vec<(i64, f64)> = buckets
            .iter()
            .map(|bucket| {
                let timestamp = bucket
                    .get("start_time")
                    .and_then(Value::as_i64)
                    .unwrap_or_default();
                let value = bucket
                    .get("results")
                    .and_then(Value::as_array)
                    .map(|results| {
                        results
                            .iter()
                            .filter_map(|result| {
                                result.pointer("/amount/value").and_then(Value::as_f64)
                            })
                            .sum()
                    })
                    .unwrap_or(0.0);
                (timestamp, value)
            })
            .collect();
        let month_cost: f64 = costs.iter().map(|(_, value)| value).sum();
        let today_start = Local::now()
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .and_then(|date| Local.from_local_datetime(&date).single())
            .map(|date| date.timestamp())
            .unwrap_or_default();
        let today_cost: f64 = costs
            .iter()
            .filter(|(time, _)| *time >= today_start)
            .map(|(_, value)| value)
            .sum();
        metrics.push(metric(
            "spentToday",
            "Hoje",
            today_cost,
            format_currency(today_cost, "USD"),
        ));
        metrics.push(metric(
            "spentMonth",
            "Este mês",
            month_cost,
            format_currency(month_cost, "USD"),
        ));
        if let Some(budget) = budget.filter(|value| *value > 0.0) {
            limits.push(UsageLimit {
                id: "monthlyBudget".into(),
                name: "Orçamento mensal".into(),
                used: Some(month_cost),
                remaining: Some((budget - month_cost).max(0.0)),
                limit: Some(budget),
                percentage_used: Some((month_cost / budget * 100.0).min(100.0)),
                reset_at: next_month_iso(),
                detail: Some(format!(
                    "{} / {}",
                    format_currency(month_cost, "USD"),
                    format_currency(budget, "USD")
                )),
            });
        }
    } else if matches!(response.status().as_u16(), 403 | 404) {
        note = Some("A conexão funciona, mas custos exigem uma OpenAI Admin API Key. Uma chave comum não expõe gastos da organização.".into());
        if let Some(budget) = budget {
            metrics.push(metric(
                "budget",
                "Orçamento mensal",
                budget,
                format_currency(budget, "USD"),
            ));
        }
    } else {
        return empty_usage(
            "openai",
            "error",
            format!(
                "OpenAI respondeu com status {}.",
                response.status().as_u16()
            ),
        );
    }
    ProviderUsage {
        provider_id: "openai".into(),
        provider_name: "OpenAI API".into(),
        r#type: "api".into(),
        status: "connected".into(),
        connected: true,
        plan: None,
        model: None,
        limits,
        metrics,
        last_updated: Utc::now().to_rfc3339(),
        source: Some("official-api".into()),
        error: note,
    }
}

fn metric(id: &str, label: &str, value: f64, formatted_value: String) -> UsageMetric {
    UsageMetric {
        id: id.into(),
        label: label.into(),
        value: Some(value),
        formatted_value,
    }
}
fn format_currency(value: f64, currency: &str) -> String {
    if currency == "USD" {
        format!("US$ {:.2}", value).replace('.', ",")
    } else {
        format!("{} {:.2}", currency, value).replace('.', ",")
    }
}
fn format_compact(value: f64) -> String {
    if value >= 1_000_000.0 {
        format!("{:.2}M", value / 1_000_000.0)
    } else if value >= 1_000.0 {
        format!("{:.1}k", value / 1_000.0)
    } else {
        format!("{value:.0}")
    }
}
fn unix_to_iso(value: i64) -> Option<String> {
    Utc.timestamp_opt(value, 0)
        .single()
        .map(|date| date.to_rfc3339())
}
fn next_month_iso() -> Option<String> {
    let now = Utc::now();
    let (year, month) = if now.month() == 12 {
        (now.year() + 1, 1)
    } else {
        (now.year(), now.month() + 1)
    };
    Utc.with_ymd_and_hms(year, month, 1, 0, 0, 0)
        .single()
        .map(|date| date.to_rfc3339())
}
fn title_case(value: &str) -> String {
    let mut chars = value.chars();
    chars
        .next()
        .map(|first| first.to_uppercase().collect::<String>() + chars.as_str())
        .unwrap_or_default()
}

fn initialize_database(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS usage_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, timestamp TEXT NOT NULL, tokens REAL, cost REAL, percentage REAL); CREATE INDEX IF NOT EXISTS idx_usage_snapshots_provider_time ON usage_snapshots(provider, timestamp);").map_err(|error| error.to_string())?;
    Ok(connection)
}

fn save_snapshot(db: &Connection, usage: &ProviderUsage) -> Result<(), String> {
    let tokens = usage
        .metrics
        .iter()
        .find(|metric| metric.id == "tokensToday")
        .and_then(|metric| metric.value);
    let cost = usage
        .metrics
        .iter()
        .find(|metric| metric.id == "spentMonth")
        .and_then(|metric| metric.value);
    let percentage = usage.limits.first().and_then(|limit| limit.percentage_used);
    if tokens.is_none() && cost.is_none() && percentage.is_none() {
        return Ok(());
    }
    db.execute("INSERT INTO usage_snapshots (provider, timestamp, tokens, cost, percentage) VALUES (?1, ?2, ?3, ?4, ?5)", params![usage.provider_id, usage.last_updated, tokens, cost, percentage]).map_err(|error| error.to_string())?;
    Ok(())
}

fn prune_history(db: &Connection, days: i64) -> Result<(), String> {
    db.execute(
        "DELETE FROM usage_snapshots WHERE timestamp < datetime('now', ?1)",
        [format!("-{days} days")],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn configure_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Abrir AI Usage", true, None::<&str>)?;
    let refresh = MenuItem::with_id(app, "refresh", "Atualizar agora", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Configurações", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &refresh, &settings, &quit])?;
    TrayIconBuilder::with_id("main-tray")
        .icon(tauri::include_image!("icons/32x32.png"))
        .tooltip("AI Usage Monitor")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "refresh" => {
                let _ = app.emit("refresh-requested", ());
            }
            "settings" => {
                show_main(app);
                let _ = app.emit("open-settings", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            let window_config = app
                .config()
                .app
                .windows
                .first()
                .ok_or_else(|| std::io::Error::other("main window configuration is missing"))?;
            let window = WebviewWindowBuilder::from_config(app.handle(), window_config)?.build()?;
            let data_dir: PathBuf = app.path().app_data_dir()?;
            let db = initialize_database(&data_dir.join("usage.sqlite3"))
                .map_err(|error| std::io::Error::other(safe_error(&error)))?;
            app.manage(AppState {
                database: Mutex::new(db),
            });
            configure_tray(app.handle())?;
            window.show()?;
            window.set_focus()?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            save_credential,
            delete_credential,
            get_credential_status,
            get_settings,
            save_settings,
            is_provider_available,
            get_provider_usage,
            test_provider_connection,
            is_openusage_available,
            run_openusage_report
        ])
        .run(tauri::generate_context!())
        .expect("AI Usage Monitor could not start");
}

trait WindowsNoWindow {
    fn creation_flags_no_window(&mut self) -> &mut Self;
}

impl WindowsNoWindow for Command {
    fn creation_flags_no_window(&mut self) -> &mut Self {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            self.creation_flags(0x08000000);
        }
        self
    }
}
