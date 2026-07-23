import { useEffect, useState } from "react";
import { formatRelativeReset } from "../utils/format";

export function useCountdown(resetAt?: string): string | null {
  const [label, setLabel] = useState(() => formatRelativeReset(resetAt));

  useEffect(() => {
    const update = () => setLabel(formatRelativeReset(resetAt));
    update();
    if (!resetAt) return;
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [resetAt]);

  return label;
}
