import { ArrowLeft, Check, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { nativeInvoke } from "../services/native";
import type { AppSettings } from "../types/provider";
import { ProviderMark } from "../components/ProviderMark/ProviderMark";

type ApiProvider = "openai" | "deepseek";

export function SettingsPage({ settings, onBack, onSaved }: { settings: AppSettings; onBack: () => void; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  const [keys, setKeys] = useState<Record<ApiProvider, string>>({ openai: "", deepseek: "" });
  const [configured, setConfigured] = useState<Record<ApiProvider, boolean>>({ openai: false, deepseek: false });
  const [visible, setVisible] = useState<Record<ApiProvider, boolean>>({ openai: false, deepseek: false });
  const [busy, setBusy] = useState<ApiProvider | "settings" | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void nativeInvoke<Record<ApiProvider, boolean>>("get_credential_status").then(setConfigured).catch(() => undefined);
  }, []);

  async function saveKey(provider: ApiProvider) {
    if (!keys[provider].trim()) return;
    setBusy(provider); setMessage("");
    try {
      await nativeInvoke("save_credential", { providerId: provider, secret: keys[provider].trim() });
      await nativeInvoke("test_provider_connection", { providerId: provider });
      setConfigured((current) => ({ ...current, [provider]: true }));
      setKeys((current) => ({ ...current, [provider]: "" }));
      setMessage(`${provider === "openai" ? "OpenAI" : "DeepSeek"} conectado com segurança.`);
    } catch (error) { setMessage(`Não foi possível conectar: ${String(error)}`); }
    finally { setBusy(null); }
  }

  async function removeKey(provider: ApiProvider) {
    setBusy(provider);
    try {
      await nativeInvoke("delete_credential", { providerId: provider });
      setConfigured((current) => ({ ...current, [provider]: false }));
      setMessage("Credencial removida do cofre do Windows.");
    } catch (error) { setMessage(String(error)); }
    finally { setBusy(null); }
  }

  async function saveSettings() {
    setBusy("settings");
    try { await nativeInvoke("save_settings", { settings: draft }); await onSaved(); setMessage("Preferências salvas."); }
    catch (error) { setMessage(String(error)); }
    finally { setBusy(null); }
  }

  return <main className="app-shell settings-page">
    <header className="topbar settings-topbar"><button className="icon-button" type="button" onClick={onBack} aria-label="Voltar"><ArrowLeft size={17} /></button><h1>Configurações</h1><span /></header>
    <div className="settings-content">
      <section className="settings-section"><div className="section-heading"><h2>Atualização</h2><p>Consultas são pausadas enquanto outra atualização está em andamento.</p></div>
        <label className="field"><span>Intervalo automático</span><select value={draft.refreshIntervalSeconds} onChange={(event) => setDraft({ ...draft, refreshIntervalSeconds: Number(event.target.value) as AppSettings["refreshIntervalSeconds"] })}><option value={30}>30 segundos</option><option value={60}>1 minuto</option><option value={300}>5 minutos</option><option value={900}>15 minutos</option></select></label>
      </section>
      <section className="settings-section"><div className="section-heading"><h2>Providers de API</h2><p>Conecte somente os serviços que você usa.</p></div>
        <div className="security-note"><ShieldCheck size={15} /><span><strong>Protegido pelo Windows</strong>As chaves nunca são salvas em arquivos ou logs.</span></div>
        {(["openai", "deepseek"] as const).map((provider) => <div className="credential" key={provider}>
          <div className="credential__heading"><div className="credential__identity"><ProviderMark providerId={provider} /><div><strong>{provider === "openai" ? "OpenAI API" : "DeepSeek API"}</strong><span>{configured[provider] ? <><Check size={12} />Chave salva</> : "Não configurado"}</span></div></div>{configured[provider] && <button className="icon-button danger" type="button" onClick={() => void removeKey(provider)} aria-label="Remover chave"><Trash2 size={14} /></button>}</div>
          <label className="field"><span>API key</span><div className="secret-input"><KeyRound size={14} /><input type={visible[provider] ? "text" : "password"} value={keys[provider]} placeholder={configured[provider] ? "Digite para substituir" : "Cole sua chave"} autoComplete="off" spellCheck={false} onChange={(event) => setKeys({ ...keys, [provider]: event.target.value })}/><button type="button" onClick={() => setVisible({ ...visible, [provider]: !visible[provider] })} aria-label={visible[provider] ? "Ocultar chave" : "Mostrar chave"}>{visible[provider] ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></label>
          <label className="field budget"><span>Orçamento mensal (USD)</span><input type="number" min="0" step="1" value={draft.monthlyBudgets[provider] ?? ""} placeholder="Não definido" onChange={(event) => setDraft({ ...draft, monthlyBudgets: { ...draft.monthlyBudgets, [provider]: event.target.value ? Number(event.target.value) : null } })}/></label>
          <button className="secondary-button" type="button" disabled={!keys[provider].trim() || busy === provider} onClick={() => void saveKey(provider)}>{busy === provider && <LoaderCircle className="spin" size={14} />}{configured[provider] ? "Testar e substituir" : "Salvar e testar"}</button>
        </div>)}
      </section>
      <p className="privacy-note">Sem telemetria. Somente chamadas aos providers configurados saem deste computador.</p>
    </div>
    <footer className="settings-actions">
      <p className="settings-message" aria-live="polite">{message}</p>
      <button className="primary-button" type="button" disabled={busy !== null} onClick={() => void saveSettings()}>{busy === "settings" && <LoaderCircle className="spin" size={14} />}Salvar preferências</button>
    </footer>
  </main>;
}
