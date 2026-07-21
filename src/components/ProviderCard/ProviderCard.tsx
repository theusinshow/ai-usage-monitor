import { RotateCcw } from "lucide-react";
import type { ProviderUsage } from "../../types/provider";
import { StatusBadge } from "../StatusBadge/StatusBadge";
import { UsageProgress } from "../UsageProgress/UsageProgress";

export function ProviderCard({ usage, onRetry }: { usage: ProviderUsage; onRetry: () => void }) {
  const empty = usage.limits.length === 0 && usage.metrics.length === 0;
  return (
    <section className="provider" aria-labelledby={`provider-${usage.providerId}`}>
      <header className="provider__header">
        <div>
          <h2 id={`provider-${usage.providerId}`}>{usage.providerName}</h2>
          {(usage.plan || usage.model) && <p>{[usage.plan, usage.model].filter(Boolean).join(" · ")}</p>}
        </div>
        <StatusBadge status={usage.status} />
      </header>

      {usage.limits.map((limit) => <UsageProgress key={limit.id} limit={limit} />)}

      {usage.metrics.length > 0 && (
        <dl className="metrics">
          {usage.metrics.map((metric) => (
            <div key={metric.id}><dt>{metric.label}</dt><dd>{metric.formattedValue}</dd></div>
          ))}
        </dl>
      )}

      {!empty && usage.error && <p className="provider__notice">{usage.error}</p>}

      {empty && (
        <div className="provider__empty">
          <p>{usage.error || "Os dados deste provider não estão disponíveis."}</p>
          {usage.status === "error" && <button className="text-button" type="button" onClick={onRetry}><RotateCcw size={13} />Tentar novamente</button>}
        </div>
      )}

      {usage.source && <footer>Fonte: {sourceLabel(usage.source)}</footer>}
    </section>
  );
}

function sourceLabel(source: NonNullable<ProviderUsage["source"]>) {
  return ({
    "codex-app-server": "Codex local",
    openusage: "OpenUsage",
    local: "Histórico local",
    "official-api": "API oficial",
  })[source];
}
