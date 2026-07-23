import type { UsageLimit } from "../../types/provider";
import { Countdown } from "../Countdown/Countdown";

export function UsageProgress({ limit, variant = "segments" }: { limit: UsageLimit; variant?: "ring" | "segments" }) {
  const percentage = limit.percentageUsed == null ? null : Math.min(100, Math.max(0, limit.percentageUsed));
  const level = percentage == null ? "unknown" : percentage >= 90 ? "critical" : percentage >= 70 ? "warning" : "normal";
  const roundedPercentage = percentage == null ? null : Math.round(percentage);

  if (variant === "ring") {
    const dashOffset = percentage == null ? 100 : 100 - percentage;

    return (
      <div className={`usage-progress usage-progress--ring usage-progress--${level}`}>
        <div className="usage-progress__copy">
          <div className="usage-progress__heading">
            <span>{limit.name}</span>
          </div>
          <div className="usage-progress__meta">
            <Countdown resetAt={limit.resetAt} />
            {limit.detail && <span>{limit.detail}</span>}
          </div>
        </div>
        <div className="usage-ring" role="progressbar" aria-label={limit.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage ?? undefined} aria-valuetext={percentage == null ? "Indisponível" : `${roundedPercentage}% utilizado`}>
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <circle className="usage-ring__track" cx="22" cy="22" r="18" pathLength="100" />
            {percentage != null && <circle className="usage-ring__value" cx="22" cy="22" r="18" pathLength="100" strokeDashoffset={dashOffset} />}
          </svg>
          <strong>{percentage == null ? "—" : `${roundedPercentage}%`}</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="usage-progress">
      <div className="usage-progress__heading">
        <span>{limit.name}</span>
        <strong>{percentage == null ? "Indisponível" : `${roundedPercentage}%`}</strong>
      </div>
      <div className={`usage-progress__segments usage-progress__segments--${level}`} role="progressbar" aria-label={limit.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage ?? undefined} aria-valuetext={percentage == null ? "Indisponível" : `${roundedPercentage}% utilizado`}>
        {Array.from({ length: 10 }, (_, index) => {
          const fill = percentage == null ? 0 : Math.min(1, Math.max(0, (percentage - index * 10) / 10));
          return <i key={index} aria-hidden="true"><span style={{ transform: `scaleX(${fill})` }} /></i>;
        })}
      </div>
      <div className="usage-progress__meta">
        <Countdown resetAt={limit.resetAt} />
        {limit.detail && <span>{limit.detail}</span>}
      </div>
    </div>
  );
}
