import { ChevronDown, RotateCcw, Settings2 } from "lucide-react";
import type { ProviderUsage } from "../../types/provider";
import { formatUpdatedAt } from "../../utils/format";
import { StatusBadge } from "../StatusBadge/StatusBadge";
import { UsageProgress } from "../UsageProgress/UsageProgress";
import { ProviderMark } from "../ProviderMark/ProviderMark";
import { ProviderTrend } from "../ProviderTrend/ProviderTrend";

export function ProviderCard({ usage, expanded, onToggle, onRetry, onConfigure }: { usage: ProviderUsage; expanded: boolean; onToggle: () => void; onRetry: () => void; onConfigure: () => void }) {
  const empty = usage.limits.length === 0 && usage.metrics.length === 0;
  const detailsId = `provider-details-${usage.providerId}`;
  const hasMultipleLimits = usage.limits.length > 1;
  const hasMixedOverview = usage.limits.length > 0 && usage.metrics.length > 0;
  return (
    <section id={`provider-row-${usage.providerId}`} className={`provider ${expanded ? "provider--expanded" : ""}`} data-provider={usage.providerId} aria-labelledby={`provider-${usage.providerId}`}>
      <header className="provider__header">
        <button className="provider__toggle" type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={detailsId}>
          <div className="provider__identity">
            <ProviderMark providerId={usage.providerId} />
            <div>
              <h2 id={`provider-${usage.providerId}`}>{usage.providerName}</h2>
              {(usage.plan || usage.model) && <p>{[usage.plan, usage.model].filter(Boolean).join(" · ")}</p>}
            </div>
          </div>
          <ChevronDown className="provider__chevron" size={14} aria-hidden="true" />
        </button>
        {usage.status === "connected"
          ? <span className="provider__healthy" title="Conectado"><i aria-hidden="true" /><span className="sr-only">Conectado</span></span>
          : <StatusBadge status={usage.status} />}
      </header>

      <div className={`provider__overview ${hasMultipleLimits ? "provider__overview--multi" : ""} ${hasMixedOverview ? "provider__overview--mixed" : ""}`}>
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

        {!empty && usage.error && <p className="provider__notice">{usage.error}</p>}

        {empty && (
          <div className="provider__empty">
            <p>{usage.error || "Os dados deste provider não estão disponíveis."}</p>
            {usage.status === "error" && <button className="text-button" type="button" onClick={onRetry}><RotateCcw size={13} />Tentar novamente</button>}
            {usage.status === "notConfigured" && <button className="text-button" type="button" onClick={onConfigure}><Settings2 size={13} />Configurar provider</button>}
          </div>
        )}
      </div>

      <div id={detailsId} className="provider__details" hidden={!expanded}>
        {usage.trend && usage.trendLabel && <ProviderTrend label={usage.trendLabel} points={usage.trend} />}
        <dl className="provider__facts">
          <div><dt>Atualização</dt><dd>{formatUpdatedAt(usage.lastUpdated).replace("Atualizado às ", "")}</dd></div>
          <div><dt>Fonte</dt><dd>{usage.source ? sourceLabel(usage.source) : "Não informada"}</dd></div>
        </dl>
        <button className="text-button provider__configure" type="button" onClick={onConfigure}><Settings2 size={13} />Configurar integração</button>
      </div>
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
