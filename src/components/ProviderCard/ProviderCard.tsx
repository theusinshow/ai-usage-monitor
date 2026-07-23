import { RotateCcw, Settings2 } from "lucide-react";
import type { ProviderUsage } from "../../types/provider";
import { formatUpdatedAt } from "../../utils/format";
import { StatusBadge } from "../StatusBadge/StatusBadge";
import { UsageProgress } from "../UsageProgress/UsageProgress";
import { ProviderMark } from "../ProviderMark/ProviderMark";
import { ProviderTrend } from "../ProviderTrend/ProviderTrend";

export function ProviderCard({ usage, onRetry, onConfigure }: {
  usage: ProviderUsage;
  onRetry: () => void;
  onConfigure: () => void;
}) {
  const empty = usage.limits.length === 0 && usage.metrics.length === 0;
  const hasMultipleLimits = usage.limits.length > 1;

  return (
    <article id={`provider-row-${usage.providerId}`} className={`provider-tile provider-tile--${usage.status}`} data-provider={usage.providerId} aria-labelledby={`provider-${usage.providerId}`}>
      <header className="provider-tile__header">
        <div className="provider__identity">
          <ProviderMark providerId={usage.providerId} />
          <div>
            <h3 id={`provider-${usage.providerId}`}>{usage.providerName}</h3>
            <p>{[usage.plan, usage.model].filter(Boolean).join(" · ") || providerTypeLabel(usage)}</p>
          </div>
        </div>
        {usage.status === "connected"
          ? <span className="provider-tile__connected"><i aria-hidden="true" />Conectado</span>
          : <StatusBadge status={usage.status} />}
      </header>

      <div className="provider-tile__body">
        {usage.limits.length > 0 && (
          <div className={`usage-grid ${hasMultipleLimits ? "usage-grid--split" : ""}`}>
            {usage.limits.map((limit, index) => <UsageProgress key={limit.id} limit={limit} variant={index === 0 ? "ring" : "segments"} />)}
          </div>
        )}

        {usage.metrics.length > 0 && (
          <dl className="metrics">
            {usage.metrics.map((metric) => (
              <div key={metric.id}><dt>{metric.label}</dt><dd>{metric.formattedValue}</dd></div>
            ))}
          </dl>
        )}

        {!empty && usage.error && <p className="provider-tile__notice">{usage.error}</p>}

        {empty && (
          <div className="provider-tile__empty">
            <span>Sem leitura disponível</span>
            <p>{usage.error || "Este provider ainda não retornou dados de uso."}</p>
            {usage.status === "error" && <button className="text-button" type="button" onClick={onRetry}><RotateCcw size={13} />Tentar novamente</button>}
            {(usage.status === "notConfigured" || usage.status === "notInstalled") && <button className="text-button" type="button" onClick={onConfigure}><Settings2 size={13} />Configurar provider</button>}
          </div>
        )}

        {usage.trend && usage.trendLabel && <ProviderTrend label={usage.trendLabel} points={usage.trend} />}
      </div>

      <footer className="provider-tile__footer">
        <span>{formatUpdatedAt(usage.lastUpdated).replace("Atualizado às ", "")}</span>
        <span>{usage.source ? sourceLabel(usage.source) : "Fonte não informada"}</span>
        <button type="button" onClick={onConfigure}>Configurar</button>
      </footer>
    </article>
  );
}

function providerTypeLabel(usage: ProviderUsage) {
  return usage.type === "subscription" ? "Assinatura local" : "API por consumo";
}

function sourceLabel(source: NonNullable<ProviderUsage["source"]>) {
  return ({
    "codex-app-server": "Codex local",
    openusage: "OpenUsage",
    local: "Histórico local",
    "official-api": "API oficial",
  })[source];
}
