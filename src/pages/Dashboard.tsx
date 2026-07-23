import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, FlaskConical, RefreshCw, Settings } from "lucide-react";
import type { ProviderId, ProviderUsage } from "../types/provider";
import { formatRelativeReset, formatUpdatedAt } from "../utils/format";
import { ProviderCard } from "../components/ProviderCard/ProviderCard";
import { ProviderSkeleton } from "../components/Skeleton/Skeleton";

const order: Array<{ id: ProviderId; name: string }> = [
  { id: "codex", name: "Codex" }, { id: "claude", name: "Claude Code" },
  { id: "deepseek", name: "DeepSeek API" }, { id: "openai", name: "OpenAI API" },
];

export function Dashboard({ usage, refreshing, lastUpdated, demoMode, onRefresh, onSettings, onLab }: {
  usage: Partial<Record<ProviderId, ProviderUsage>>;
  refreshing: boolean;
  lastUpdated?: string;
  demoMode: boolean;
  onRefresh: () => void;
  onSettings: () => void;
  onLab?: () => void;
}) {
  const [expandedProvider, setExpandedProvider] = useState<ProviderId | null>(null);
  const connected = Object.values(usage).filter((item) => item?.connected).length;
  const attention = useMemo(() => findAttention(usage), [usage]);

  function openAttentionProvider() {
    if (!attention) return;
    setExpandedProvider(attention.providerId);
    requestAnimationFrame(() => {
      const list = document.querySelector<HTMLElement>(".provider-list");
      const provider = document.getElementById(`provider-row-${attention.providerId}`);
      if (!list || !provider) return;
      const listBox = list.getBoundingClientRect();
      const providerBox = provider.getBoundingClientRect();
      list.scrollTo({ top: list.scrollTop + providerBox.top - listBox.top - 8, behavior: "smooth" });
    });
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="wordmark">
        <span className="wordmark-mark" aria-hidden="true"><i /><i /><i /></span>
        <div><h1>AI Usage</h1><span>Monitor</span></div>
      </div>
      <nav aria-label="Ações">
        {onLab && <button className="icon-button icon-button--lab" type="button" onClick={onLab} aria-label="Abrir Design Lab" title="Abrir Design Lab"><FlaskConical size={16} /></button>}
        <button className="icon-button" type="button" onClick={onRefresh} disabled={refreshing} aria-label="Atualizar agora" title="Atualizar agora"><RefreshCw className={refreshing ? "spin" : ""} size={16} /></button>
        <button className="icon-button" type="button" onClick={onSettings} aria-label="Configurações" title="Configurações"><Settings size={16} /></button>
      </nav>
    </header>
    <div className="refresh-state" aria-live="polite">
      <span className="availability"><i className={connected > 0 ? "online" : ""} />{connected} de 4 ativos</span>
      <span>{refreshing ? "Atualizando…" : formatUpdatedAt(lastUpdated).replace("Atualizado às ", "")}</span>
      {demoMode && <span className="demo-badge">Demo</span>}
    </div>
    {attention && <button className={`attention-strip attention-strip--${attention.level}`} type="button" onClick={openAttentionProvider}>
      <span className="attention-strip__icon"><AlertTriangle size={14} aria-hidden="true" /></span>
      <span><strong>{attention.headline}</strong><small>{attention.detail}</small></span>
      <ChevronRight size={14} aria-hidden="true" />
    </button>}
    <div className="provider-list">
      {order.map(({ id, name }) => usage[id] ? <ProviderCard key={id} usage={usage[id]} expanded={expandedProvider === id} onToggle={() => setExpandedProvider((current) => current === id ? null : id)} onRetry={onRefresh} onConfigure={onSettings} /> : <ProviderSkeleton key={id} name={name} />)}
    </div>
  </main>;
}

type Attention = { providerId: ProviderId; level: "warning" | "critical"; headline: string; detail: string; priority: number };

function findAttention(usage: Partial<Record<ProviderId, ProviderUsage>>): Attention | null {
  const candidates: Attention[] = [];

  Object.values(usage).forEach((provider) => {
    if (!provider) return;

    if (provider.status === "error") {
      candidates.push({ providerId: provider.providerId, level: "critical", headline: `${provider.providerName} precisa de atenção`, detail: "Falha ao atualizar a integração", priority: 100 });
    } else if (provider.status === "notConfigured" || provider.status === "notInstalled") {
      candidates.push({ providerId: provider.providerId, level: "warning", headline: `${provider.providerName} não está disponível`, detail: "Abra para revisar a integração", priority: 70 });
    }

    provider.limits.forEach((limit) => {
      const percentage = limit.percentageUsed;
      if (percentage == null || percentage < 75) return;
      const rounded = Math.round(percentage);
      const reset = formatRelativeReset(limit.resetAt)?.replace("Reinicia", "reinicia");
      candidates.push({
        providerId: provider.providerId,
        level: percentage >= 90 ? "critical" : "warning",
        headline: `${provider.providerName} chegou a ${rounded}%`,
        detail: `${limit.name}${reset ? ` · ${reset}` : ""}`,
        priority: rounded,
      });
    });
  });

  return candidates.sort((a, b) => b.priority - a.priority)[0] ?? null;
}
