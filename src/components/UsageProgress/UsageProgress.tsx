import type { UsageLimit } from "../../types/provider";
import { Countdown } from "../Countdown/Countdown";

export function UsageProgress({ limit }: { limit: UsageLimit }) {
  const percentage = limit.percentageUsed == null ? null : Math.min(100, Math.max(0, limit.percentageUsed));
  const level = percentage == null ? "unknown" : percentage >= 90 ? "critical" : percentage >= 70 ? "warning" : "normal";

  return (
    <div className="usage-progress">
      <div className="usage-progress__heading">
        <span>{limit.name}</span>
        <strong>{percentage == null ? "Indisponível" : `${Math.round(percentage)}%`}</strong>
      </div>
      <div className={`usage-progress__track usage-progress__track--${level}`} role="progressbar" aria-label={limit.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage ?? undefined}>
        {percentage != null && <span style={{ transform: `scaleX(${percentage / 100})` }} />}
      </div>
      <div className="usage-progress__meta">
        <Countdown resetAt={limit.resetAt} />
        {limit.detail && <span>{limit.detail}</span>}
      </div>
    </div>
  );
}
