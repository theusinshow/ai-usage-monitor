import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  RefreshCw,
  Settings,
} from "lucide-react";
import type { ProviderId, ProviderUsage, UsageLimit, UsageMetric } from "../types/provider";
import { formatRelativeReset, formatUpdatedAt } from "../utils/format";
import { ProviderCard } from "../components/ProviderCard/ProviderCard";
import { ProviderMark } from "../components/ProviderMark/ProviderMark";
import { ProviderSkeleton } from "../components/Skeleton/Skeleton";

const order: Array<{ id: ProviderId; name: string }> = [
  { id: "codex", name: "Codex" },
  { id: "claude", name: "Claude Code" },
  { id: "deepseek", name: "DeepSeek API" },
  { id: "openai", name: "OpenAI API" },
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
  const providers = order.map(({ id }) => usage[id]).filter((item): item is ProviderUsage => Boolean(item));
  const connected = providers.filter((item) => item.connected).length;
  const reporting = providers.filter((item) => item.limits.length > 0 || item.metrics.length > 0).length;
  const attention = useMemo(() => findAttention(usage), [usage]);
  const highestLimit = findHighestLimit(providers);
  const tokensToday = findMetric(providers, "tokensToday");
  const apiMetric = findMetric(providers, "spentMonth") ?? findMetric(providers, "balance");

  return <main className="app-shell desktop-dashboard">
    <header className="workspace-header">
      <div className="workspace-heading">
        <span className="product-label">AI Usage Monitor</span>
        <div className="workspace-title-line">
          <h1>Home</h1>
          {demoMode && <span className="demo-badge">Demo</span>}
        </div>
      </div>
      <div className="workspace-actions">
        <div className="sync-copy" aria-live="polite">
          <span>{refreshing ? "Sincronizando dados" : "Última sincronização"}</span>
          <strong>{refreshing ? "Agora" : formatUpdatedAt(lastUpdated).replace("Atualizado às ", "")}</strong>
        </div>
        {onLab && <button className="icon-button icon-button--lab" type="button" onClick={onLab} aria-label="Abrir Design Lab" title="Abrir Design Lab"><FlaskConical size={17} /></button>}
        <button className="icon-button" type="button" onClick={onRefresh} disabled={refreshing} aria-label="Atualizar agora" title="Atualizar agora"><RefreshCw className={refreshing ? "spin" : ""} size={17} /></button>
        <button className="icon-button" type="button" onClick={onSettings} aria-label="Configurações" title="Configurações"><Settings size={17} /></button>
      </div>
    </header>

    <section className="summary-ribbon" aria-label="Resumo de uso">
      <article className="summary-cell summary-cell--connections">
        <div className="summary-label"><span>Conexões</span><small>Fontes disponíveis</small></div>
        <div className="summary-value-row">
          <strong>{connected}<small>/4</small></strong>
          <div className="provider-signal" aria-label={`${connected} providers conectados`}>
            {order.map(({ id }) => <i key={id} data-provider={id} className={usage[id]?.connected ? "is-on" : ""} />)}
          </div>
        </div>
        <p>{reporting} {reporting === 1 ? "provider entrega" : "providers entregam"} dados de uso</p>
      </article>

      <article className="summary-cell">
        <div className="summary-label"><span>Maior utilização</span><small>Janela conhecida</small></div>
        <strong>{highestLimit ? `${Math.round(highestLimit.limit.percentageUsed ?? 0)}%` : "—"}</strong>
        <p>{highestLimit ? `${highestLimit.provider.providerName} · ${highestLimit.limit.name}` : "Nenhum limite disponível"}</p>
      </article>

      <article className="summary-cell">
        <div className="summary-label"><span>Tokens hoje</span><small>Leitura local</small></div>
        <strong>{tokensToday?.metric.formattedValue ?? "—"}</strong>
        <p>{tokensToday ? tokensToday.provider.providerName : "Sem leitura compatível"}</p>
      </article>

      <article className="summary-cell">
        <div className="summary-label"><span>APIs</span><small>{apiMetric?.metric.id === "balance" ? "Saldo disponível" : "Gasto no mês"}</small></div>
        <strong>{apiMetric?.metric.formattedValue ?? "—"}</strong>
        <p>{apiMetric ? apiMetric.provider.providerName : "Configure uma chave para consultar"}</p>
      </article>
    </section>

    <div className="dashboard-workspace">
      <section className="providers-workspace" aria-labelledby="providers-heading">
        <header className="section-heading-row">
          <div>
            <span>Uso por integração</span>
            <h2 id="providers-heading">Providers</h2>
          </div>
          <p>Dados reais, sem estimativas entre serviços incompatíveis.</p>
        </header>
        <div className="provider-grid">
          {order.map(({ id, name }) => usage[id]
            ? <ProviderCard key={id} usage={usage[id]} onRetry={onRefresh} onConfigure={onSettings} />
            : <ProviderSkeleton key={id} name={name} />)}
        </div>
      </section>

      <aside className="dashboard-aside" aria-label="Status das integrações">
        <section className="aside-section">
          <header className="aside-heading">
            <div>
              <span>Prioridade</span>
              <h2>Agora</h2>
            </div>
            {attention ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
          </header>
          {attention
            ? <button className={`focus-callout focus-callout--${attention.level}`} type="button" onClick={attention.action === "refresh" ? onRefresh : onSettings}>
                <strong>{attention.headline}</strong>
                <span>{attention.detail}</span>
                <small>{attention.action === "refresh" ? "Tentar novamente" : "Revisar integração"}</small>
              </button>
            : <div className="focus-callout focus-callout--clear">
                <strong>Nenhuma ação urgente</strong>
                <span>Os providers conectados estão dentro dos limites conhecidos.</span>
              </div>}
        </section>

        <section className="aside-section aside-section--integrations">
          <header className="aside-heading">
            <div>
              <span>Disponibilidade</span>
              <h2>Integrações</h2>
            </div>
          </header>
          <div className="integration-list">
            {order.map(({ id, name }) => {
              const provider = usage[id];
              return <div className="integration-row" key={id}>
                <ProviderMark providerId={id} />
                <div><strong>{provider?.providerName ?? name}</strong><span>{provider ? providerStatusLabel(provider) : "Carregando dados"}</span></div>
                <i data-status={provider?.status ?? "loading"} aria-hidden="true" />
              </div>;
            })}
          </div>
        </section>
      </aside>
    </div>
  </main>;
}

type Attention = {
  providerId: ProviderId;
  level: "warning" | "critical";
  headline: string;
  detail: string;
  priority: number;
  action: "refresh" | "settings";
};

function findAttention(usage: Partial<Record<ProviderId, ProviderUsage>>): Attention | null {
  const candidates: Attention[] = [];

  Object.values(usage).forEach((provider) => {
    if (!provider) return;

    if (provider.status === "error") {
      candidates.push({ providerId: provider.providerId, level: "critical", headline: `${provider.providerName} não atualizou`, detail: provider.error || "Falha ao ler a integração.", priority: 100, action: "refresh" });
    } else if (provider.status === "notConfigured" || provider.status === "notInstalled") {
      candidates.push({ providerId: provider.providerId, level: "warning", headline: `${provider.providerName} está desconectado`, detail: "A integração ainda não fornece dados.", priority: 70, action: "settings" });
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
        action: "settings",
      });
    });
  });

  return candidates.sort((a, b) => b.priority - a.priority)[0] ?? null;
}

function findHighestLimit(providers: ProviderUsage[]): { provider: ProviderUsage; limit: UsageLimit } | null {
  return providers
    .flatMap((provider) => provider.limits
      .filter((limit) => limit.percentageUsed != null)
      .map((limit) => ({ provider, limit })))
    .sort((a, b) => (b.limit.percentageUsed ?? 0) - (a.limit.percentageUsed ?? 0))[0] ?? null;
}

function findMetric(providers: ProviderUsage[], id: string): { provider: ProviderUsage; metric: UsageMetric } | null {
  for (const provider of providers) {
    const metric = provider.metrics.find((item) => item.id === id);
    if (metric) return { provider, metric };
  }
  return null;
}

function providerStatusLabel(provider: ProviderUsage) {
  if (provider.status === "connected") {
    return provider.limits.length > 0 || provider.metrics.length > 0 ? "Dados disponíveis" : "Conectado, sem leitura";
  }
  return ({
    error: "Erro na atualização",
    loading: "Atualizando",
    notConfigured: "Configuração pendente",
    notInstalled: "Aplicativo não encontrado",
  })[provider.status];
}
