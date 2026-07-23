export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function formatRelativeReset(resetAt?: string, now = Date.now()): string | null {
  if (!resetAt) return null;
  const target = new Date(resetAt).getTime();
  if (!Number.isFinite(target)) return null;
  const remaining = Math.max(0, target - now);
  if (remaining === 0) return "Reiniciando";
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `Reinicia em ${days}d ${hours}h`;
  if (hours > 0) return `Reinicia em ${hours}h ${minutes}min`;
  if (minutes > 0) return `Reinicia em ${minutes}min`;
  return "Reinicia em menos de 1min";
}

export function formatUpdatedAt(iso?: string): string {
  if (!iso) return "Nunca atualizado";
  return `Atualizado às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso))}`;
}
