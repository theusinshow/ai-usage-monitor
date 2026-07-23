import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Database,
  RefreshCw,
  Settings,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ProviderHistory,
  ProviderHistoryPoint,
  ProviderId,
  ProviderUsage,
} from "../types/provider";
import { createDemoHistory } from "../demo/demoUsage";
import { nativeInvoke } from "../services/native";
import { formatRelativeReset, formatUpdatedAt } from "../utils/format";
import { ProviderMark } from "../components/ProviderMark/ProviderMark";
import { UsageProgress } from "../components/UsageProgress/UsageProgress";

type RangeDays = 7 | 30 | 90;
type SeriesKind = "tokens" | "cost" | "balance" | "percentage" | "none";

export function ProviderDetails({
  usage,
  providers,
  refreshing,
  demoMode,
  onBack,
  onRefresh,
  onSettings,
  onSelectProvider,
}: {
  usage: ProviderUsage;
  providers: ProviderUsage[];
  refreshing: boolean;
  demoMode: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  onSelectProvider: (providerId: ProviderId) => void;
}) {
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const historyKey = `${usage.providerId}:${rangeDays}:${demoMode ? "demo" : "real"}`;
  const [historyState, setHistoryState] = useState<{
    key?: string;
    data?: ProviderHistory;
    error?: string;
  }>({});
  const history = historyState.key === historyKey ? historyState.data : undefined;
  const historyError = historyState.key === historyKey ? historyState.error : undefined;
  const historyLoading = historyState.key !== historyKey;

  useEffect(() => {
    let active = true;

    const request = demoMode
      ? Promise.resolve(createDemoHistory(usage.providerId, rangeDays))
      : nativeInvoke<ProviderHistory>("get_provider_history", {
          providerId: usage.providerId,
          rangeDays,
        });

    void request
      .then((result) => {
        if (active) setHistoryState({ key: historyKey, data: result });
      })
      .catch((error) => {
        if (!active) return;
        setHistoryState({
          key: historyKey,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      active = false;
    };
  }, [demoMode, historyKey, rangeDays, usage.providerId]);

  const seriesKind = useMemo(() => resolveSeriesKind(history?.points ?? []), [history]);
  const chartData = useMemo(
    () => prepareChartData(history?.points ?? [], seriesKind),
    [history, seriesKind],
  );
  const stats = useMemo(
    () => buildStats(usage, chartData, seriesKind),
    [chartData, seriesKind, usage],
  );
  const maximum = Math.max(...chartData.map((point) => point.dailyValue), 1);

  return (
    <main
      className="app-shell provider-detail"
      data-provider={usage.providerId}
      aria-labelledby="provider-detail-title"
    >
      <header className="detail-topbar">
        <button className="icon-button" type="button" onClick={onBack} aria-label="Voltar ao início">
          <ArrowLeft size={18} />
        </button>
        <div className="detail-breadcrumb">
          <span>Providers</span>
          <strong>{usage.providerName}</strong>
        </div>
        <div className="detail-actions">
          <button className="icon-button" type="button" onClick={onRefresh} disabled={refreshing} aria-label="Atualizar agora">
            <RefreshCw className={refreshing ? "spin" : ""} size={17} />
          </button>
          <button className="icon-button" type="button" onClick={onSettings} aria-label="Configurações">
            <Settings size={17} />
          </button>
        </div>
      </header>

      <nav className="detail-provider-nav" aria-label="Trocar provider">
        {providers.map((provider) => (
          <button
            key={provider.providerId}
            type="button"
            data-provider={provider.providerId}
            className={provider.providerId === usage.providerId ? "is-active" : ""}
            onClick={() => onSelectProvider(provider.providerId)}
          >
            <ProviderMark providerId={provider.providerId} />
            <span>{provider.providerName}</span>
            <i data-status={provider.status} aria-hidden="true" />
          </button>
        ))}
      </nav>

      <div className="detail-scroll">
        <section className="detail-hero">
          <div className="detail-identity">
            <ProviderMark providerId={usage.providerId} />
            <div>
              <span>{usage.type === "subscription" ? "Assinatura local" : "API por consumo"}</span>
              <h1 id="provider-detail-title">{usage.providerName}</h1>
              <p>{[usage.plan, usage.model, sourceLabel(usage.source)].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="detail-health">
            <i data-status={usage.status} aria-hidden="true" />
            <div>
              <span>{usage.connected ? "Dados disponíveis" : statusLabel(usage.status)}</span>
              <strong>{formatUpdatedAt(usage.lastUpdated)}</strong>
            </div>
          </div>
        </section>

        <section className="detail-stat-strip" aria-label="Resumo do provider">
          {stats.map((stat) => (
            <div key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </div>
          ))}
        </section>

        <div className="detail-layout">
          <section className="detail-primary">
            <header className="detail-section-heading detail-section-heading--chart">
              <div>
                <span>Histórico real</span>
                <h2>{seriesTitle(seriesKind)}</h2>
                <p>{historyCopy(seriesKind, history?.source)}</p>
              </div>
              <div className="range-picker" aria-label="Período do histórico">
                {([7, 30, 90] as RangeDays[]).map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={rangeDays === days ? "is-active" : ""}
                    onClick={() => setRangeDays(days)}
                    aria-pressed={rangeDays === days}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </header>

            <div className="history-visual">
              {historyLoading && <ChartSkeleton />}
              {!historyLoading && historyError && (
                <HistoryEmpty title="Histórico indisponível" detail={historyError} />
              )}
              {!historyLoading && !historyError && chartData.length === 0 && (
                <HistoryEmpty
                  title="A coleta começa agora"
                  detail="O provider ainda não tem pontos suficientes para este período. Mantenha o monitor ativo e os próximos snapshots aparecerão aqui."
                />
              )}
              {!historyLoading && chartData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`history-fill-${usage.providerId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--provider-color)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--provider-color)" stopOpacity={0.015} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border-soft)" strokeDasharray="2 5" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={28} tick={{ fill: "var(--dim)", fontSize: 9 }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => compactValue(Number(value), seriesKind)} tick={{ fill: "var(--dim)", fontSize: 9 }} />
                    <Tooltip
                      cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "var(--muted)", fontSize: 10 }}
                      itemStyle={{ color: "var(--text)", fontSize: 11 }}
                      formatter={(value) => [formatSeriesValue(Number(value), seriesKind), seriesNoun(seriesKind)]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--provider-color)"
                      strokeWidth={2}
                      fill={`url(#history-fill-${usage.providerId})`}
                      activeDot={{ r: 4, fill: "var(--provider-color)", stroke: "var(--canvas)", strokeWidth: 2 }}
                      isAnimationActive
                      animationDuration={320}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <section className="daily-section">
              <header className="detail-section-heading">
                <div>
                  <span>Comparação</span>
                  <h2>Volume por dia</h2>
                </div>
                {history?.collectedSince && <small>Coleta desde {formatShortDate(history.collectedSince)}</small>}
              </header>
              <div className="daily-chart">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border-soft)" strokeDasharray="2 5" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={24} tick={{ fill: "var(--dim)", fontSize: 9 }} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => compactValue(Number(value), seriesKind)} tick={{ fill: "var(--dim)", fontSize: 9 }} />
                      <Tooltip
                        cursor={{ fill: "var(--surface-hover)", opacity: 0.45 }}
                        contentStyle={tooltipStyle}
                        formatter={(value) => [formatSeriesValue(Number(value), seriesKind), dailySeriesNoun(seriesKind)]}
                      />
                      <Bar dataKey="dailyValue" fill="var(--provider-color)" fillOpacity={0.72} radius={[3, 3, 1, 1]} isAnimationActive animationDuration={280} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="daily-chart__empty">Sem volume diário disponível</div>}
              </div>
            </section>
          </section>

          <aside className="detail-sidebar">
            <section className="detail-limits">
              <header className="detail-section-heading">
                <div>
                  <span>Janelas conhecidas</span>
                  <h2>Limites atuais</h2>
                </div>
                <CalendarDays size={17} />
              </header>
              {usage.limits.length > 0 ? (
                <div className="detail-limit-list">
                  {usage.limits.map((limit, index) => (
                    <UsageProgress key={limit.id} limit={limit} variant={index === 0 ? "ring" : "segments"} />
                  ))}
                </div>
              ) : (
                <div className="limit-unavailable">
                  <strong>O provider não publica limites</strong>
                  <p>{limitUnavailableCopy(usage.providerId)}</p>
                </div>
              )}
            </section>

            <section className="activity-map">
              <header className="detail-section-heading">
                <div>
                  <span>Ritmo</span>
                  <h2>Intensidade diária</h2>
                </div>
                <Database size={16} />
              </header>
              {chartData.length > 0 ? (
                <>
                  <div className="activity-map__grid" aria-label={`Intensidade nos últimos ${rangeDays} dias`}>
                    {chartData.map((point) => (
                      <i
                        key={point.timestamp}
                        style={{ opacity: 0.18 + (point.dailyValue / maximum) * 0.82 }}
                        title={`${point.label}: ${formatSeriesValue(point.dailyValue, seriesKind)}`}
                      />
                    ))}
                  </div>
                  <div className="activity-map__legend">
                    <span>Menor</span><i /><i /><i /><i /><span>Maior</span>
                  </div>
                </>
              ) : <p className="activity-map__empty">A intensidade aparecerá quando houver histórico real.</p>}
            </section>

            <section className="data-note">
              <strong>Como estes dados são calculados</strong>
              <p>{dataExplanation(usage.providerId, history?.source)}</p>
              <button type="button" onClick={onSettings}>Configurar coleta</button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

type ChartPoint = ProviderHistoryPoint & {
  value: number;
  dailyValue: number;
};

function resolveSeriesKind(points: ProviderHistoryPoint[]): SeriesKind {
  if (points.some((point) => point.tokens != null)) return "tokens";
  if (points.some((point) => point.cost != null)) return "cost";
  if (points.some((point) => point.balance != null)) return "balance";
  if (points.some((point) => point.percentage != null)) return "percentage";
  return "none";
}

function prepareChartData(points: ProviderHistoryPoint[], kind: SeriesKind): ChartPoint[] {
  if (kind === "none") return [];
  let previousValue: number | undefined;
  return points.map((point) => {
    const value = kind === "tokens"
      ? point.tokens ?? 0
      : kind === "cost"
        ? point.cost ?? 0
        : kind === "balance"
          ? point.balance ?? 0
          : point.percentage ?? 0;
    const dailyValue = kind === "cost"
      ? previousValue == null ? 0 : Math.max(0, value - previousValue)
      : kind === "balance"
        ? previousValue == null ? 0 : Math.max(0, previousValue - value)
        : value;
    previousValue = value;
    return { ...point, value, dailyValue };
  });
}

function buildStats(usage: ProviderUsage, points: ChartPoint[], kind: SeriesKind) {
  const latest = points.at(-1);
  const lastSeven = points.slice(-7);
  const peak = points.reduce<ChartPoint | undefined>(
    (current, point) => !current || point.dailyValue > current.dailyValue ? point : current,
    undefined,
  );
  const average = points.length
    ? points.reduce((total, point) => total + point.dailyValue, 0) / points.length
    : 0;

  if (kind === "tokens") {
    const today = usage.metrics.find((metric) => metric.id === "tokensToday");
    const month = usage.metrics.find((metric) => metric.id === "tokensMonth");
    return [
      { label: "Hoje", value: today?.formattedValue ?? formatSeriesValue(latest?.dailyValue ?? 0, kind), detail: "tokens processados" },
      { label: "Últimos 7 dias", value: compactTokens(lastSeven.reduce((total, point) => total + point.dailyValue, 0)), detail: "soma do período" },
      { label: "Este mês", value: month?.formattedValue ?? "Em coleta", detail: month ? "leitura local" : "histórico incompleto" },
      { label: "Dia mais intenso", value: peak ? compactTokens(peak.dailyValue) : "—", detail: peak?.label ?? "sem histórico" },
    ];
  }

  if (kind === "cost") {
    const today = usage.metrics.find((metric) => metric.id === "spentToday");
    const month = usage.metrics.find((metric) => metric.id === "spentMonth");
    return [
      { label: "Hoje", value: today?.formattedValue ?? formatCurrency(latest?.dailyValue ?? 0), detail: "custo consultado" },
      { label: "Este mês", value: month?.formattedValue ?? formatCurrency(latest?.value ?? 0), detail: "acumulado" },
      { label: "Média diária", value: formatCurrency(average), detail: "no período exibido" },
      { label: "Maior dia", value: peak ? formatCurrency(peak.dailyValue) : "—", detail: peak?.label ?? "sem histórico" },
    ];
  }

  if (kind === "balance") {
    const balance = usage.metrics.find((metric) => metric.id === "balance");
    const first = points[0];
    const consumed = first && latest ? Math.max(0, first.value - latest.value) : 0;
    const lowest = points.reduce<ChartPoint | undefined>(
      (current, point) => !current || point.value < current.value ? point : current,
      undefined,
    );
    return [
      { label: "Saldo atual", value: balance?.formattedValue ?? formatCurrency(latest?.value ?? 0), detail: "consulta oficial" },
      { label: "Consumido no período", value: formatCurrency(consumed), detail: "variação observada" },
      { label: "Média por dia", value: formatCurrency(average), detail: "queda diária do saldo" },
      { label: "Menor saldo", value: lowest ? formatCurrency(lowest.value) : "—", detail: lowest?.label ?? "sem histórico" },
    ];
  }

  const primaryLimit = usage.limits[0];
  const weeklyLimit = usage.limits.find((limit) => /seman/i.test(limit.name));
  return [
    { label: "Janela atual", value: primaryLimit?.percentageUsed != null ? `${Math.round(primaryLimit.percentageUsed)}%` : "—", detail: primaryLimit?.name ?? "não publicada" },
    { label: "Limite semanal", value: weeklyLimit?.percentageUsed != null ? `${Math.round(weeklyLimit.percentageUsed)}%` : "—", detail: weeklyLimit?.resetAt ? formatRelativeReset(weeklyLimit.resetAt) ?? "sem reset informado" : "não publicado" },
    { label: "Pico no período", value: peak ? `${Math.round(peak.dailyValue)}%` : "—", detail: peak?.label ?? "sem histórico" },
    { label: "Média observada", value: points.length ? `${Math.round(average)}%` : "—", detail: "snapshots coletados" },
  ];
}

function seriesTitle(kind: SeriesKind) {
  return ({
    tokens: "Consumo de tokens",
    cost: "Custo acumulado",
    balance: "Saldo disponível",
    percentage: "Utilização da janela",
    none: "Consumo no período",
  })[kind];
}

function historyCopy(kind: SeriesKind, source?: ProviderHistory["source"]) {
  if (source === "provider-local" && kind === "tokens") return "Totais diários extraídos dos registros locais do provider.";
  if (kind === "balance") return "Evolução do saldo registrada a cada atualização do monitor.";
  if (source === "snapshots") return "Leituras registradas pelo monitor enquanto o aplicativo esteve ativo.";
  return "A visualização se adapta aos dados que o provider realmente oferece.";
}

function seriesNoun(kind: SeriesKind) {
  return ({ tokens: "Tokens", cost: "Acumulado", balance: "Saldo", percentage: "Utilização", none: "Valor" })[kind];
}

function dailySeriesNoun(kind: SeriesKind) {
  if (kind === "balance") return "Saldo consumido";
  return kind === "cost" ? "Custo do dia" : seriesNoun(kind);
}

function compactTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(".", ",")}k`;
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function compactValue(value: number, kind: SeriesKind) {
  if (kind === "tokens") return compactTokens(value);
  if (kind === "cost" || kind === "balance") return value >= 1_000 ? `${Math.round(value / 1_000)}k` : value.toFixed(value < 10 ? 1 : 0);
  return `${Math.round(value)}%`;
}

function formatSeriesValue(value: number, kind: SeriesKind) {
  if (kind === "tokens") return `${new Intl.NumberFormat("pt-BR").format(Math.round(value))} tokens`;
  if (kind === "cost" || kind === "balance") return formatCurrency(value);
  if (kind === "percentage") return `${Math.round(value)}%`;
  return "Indisponível";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" })
    .format(value)
    .replace("US$", "US$ ");
}

function formatShortDate(value: string) {
  const normalized = value.length === 10 ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function sourceLabel(source?: ProviderUsage["source"]) {
  if (!source) return undefined;
  return ({
    "codex-app-server": "Codex local",
    openusage: "OpenUsage",
    local: "Histórico local",
    "official-api": "API oficial",
  })[source];
}

function statusLabel(status: ProviderUsage["status"]) {
  return ({
    connected: "Conectado",
    error: "Erro na atualização",
    loading: "Atualizando",
    notConfigured: "Configuração pendente",
    notInstalled: "Aplicativo não encontrado",
  })[status];
}

function limitUnavailableCopy(providerId: ProviderId) {
  if (providerId === "claude") return "O Claude Code permite medir tokens locais, mas não expõe oficialmente as cotas da assinatura.";
  if (providerId === "deepseek") return "A API informa o saldo. Um limite aparece aqui quando você define um orçamento mensal.";
  if (providerId === "openai") return "Defina um orçamento mensal para comparar o gasto real com o seu limite.";
  return "Nenhuma janela de limite foi retornada nesta atualização.";
}

function dataExplanation(providerId: ProviderId, source?: ProviderHistory["source"]) {
  if (providerId === "claude" && source === "provider-local") {
    return "Os totais são somados a partir dos arquivos JSONL locais do Claude Code. Nenhum conteúdo das conversas é armazenado pelo monitor.";
  }
  return "O monitor salva apenas tokens, custo e percentual em snapshots locais. Períodos sem o aplicativo ativo podem ficar sem pontos.";
}

function ChartSkeleton() {
  return <div className="chart-skeleton" aria-label="Carregando histórico">
    <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
  </div>;
}

function HistoryEmpty({ title, detail }: { title: string; detail: string }) {
  return <div className="history-empty">
    <Database size={19} />
    <strong>{title}</strong>
    <p>{detail}</p>
  </div>;
}

const tooltipStyle = {
  background: "oklch(0.19 0.009 235)",
  border: "1px solid oklch(0.29 0.012 235)",
  borderRadius: 7,
  boxShadow: "0 12px 28px oklch(0.08 0.01 235 / .36)",
};
