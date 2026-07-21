import { RefreshCw, Settings } from "lucide-react";
import type { ProviderId, ProviderUsage } from "../types/provider";
import { formatUpdatedAt } from "../utils/format";
import { ProviderCard } from "../components/ProviderCard/ProviderCard";
import { ProviderSkeleton } from "../components/Skeleton/Skeleton";

const order: Array<{ id: ProviderId; name: string }> = [
  { id: "codex", name: "Codex" }, { id: "claude", name: "Claude Code" },
  { id: "deepseek", name: "DeepSeek API" }, { id: "openai", name: "OpenAI API" },
];

export function Dashboard({ usage, refreshing, lastUpdated, onRefresh, onSettings }: {
  usage: Partial<Record<ProviderId, ProviderUsage>>;
  refreshing: boolean;
  lastUpdated?: string;
  onRefresh: () => void;
  onSettings: () => void;
}) {
  return <main className="app-shell">
    <header className="topbar">
      <div><span className="wordmark-mark">A</span><h1>AI Usage</h1></div>
      <nav aria-label="Ações">
        <button className="icon-button" type="button" onClick={onRefresh} disabled={refreshing} aria-label="Atualizar agora" title="Atualizar agora"><RefreshCw className={refreshing ? "spin" : ""} size={16} /></button>
        <button className="icon-button" type="button" onClick={onSettings} aria-label="Configurações" title="Configurações"><Settings size={16} /></button>
      </nav>
    </header>
    <div className="refresh-state" aria-live="polite"><span>{refreshing ? "Atualizando providers…" : formatUpdatedAt(lastUpdated)}</span><i className={refreshing ? "active" : ""} /></div>
    <div className="provider-list">
      {order.map(({ id, name }) => usage[id] ? <ProviderCard key={id} usage={usage[id]} onRetry={onRefresh} /> : <ProviderSkeleton key={id} name={name} />)}
    </div>
  </main>;
}
