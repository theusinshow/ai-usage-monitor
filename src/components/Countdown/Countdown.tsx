import { Clock3 } from "lucide-react";
import { useCountdown } from "../../hooks/useCountdown";

export function Countdown({ resetAt }: { resetAt?: string }) {
  const label = useCountdown(resetAt);
  if (!label) return null;
  return <span className="countdown"><Clock3 size={11} aria-hidden="true" />{label}</span>;
}
