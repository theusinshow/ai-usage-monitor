import type { UsageTrendPoint } from "../../types/provider";

export function ProviderTrend({ label, points }: { label: string; points: UsageTrendPoint[] }) {
  if (points.length < 2) return null;

  const width = 300;
  const height = 54;
  const padding = 3;
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const coordinates = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (point.value - minimum) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  const latest = points[points.length - 1];

  return <figure className="provider-trend">
    <figcaption><span>{label}</span><strong>{latest.formattedValue}</strong></figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${points.map((point) => `${point.label} ${point.formattedValue}`).join(", ")}`}>
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
      <polyline points={coordinates} />
    </svg>
    <div className="provider-trend__axis"><span>{points[0].label}</span><span>{latest.label}</span></div>
  </figure>;
}
