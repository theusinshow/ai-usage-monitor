import type { ProviderHistory, ProviderHistoryPoint, ProviderId, ProviderUsage } from "../types/provider";

const fromNow = (milliseconds: number) => new Date(Date.now() + milliseconds).toISOString();

export function createDemoUsage(): Record<ProviderId, ProviderUsage> {
  const updated = new Date().toISOString();

  return {
    codex: {
      providerId: "codex",
      providerName: "Codex",
      type: "subscription",
      status: "connected",
      connected: true,
      plan: "Plus",
      model: "GPT-5.4",
      limits: [
        { id: "primary", name: "5 horas", percentageUsed: 63, resetAt: fromNow(2.25 * 60 * 60 * 1000) },
        { id: "secondary", name: "Semanal", percentageUsed: 42, resetAt: fromNow(3.3 * 24 * 60 * 60 * 1000) },
      ],
      metrics: [],
      lastUpdated: updated,
      source: "codex-app-server",
      trendLabel: "Uso da janela principal · 7 dias",
      trend: [34, 48, 44, 55, 71, 58, 63].map((value, index) => ({ label: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][index], value, formattedValue: `${value}%` })),
    },
    claude: {
      providerId: "claude",
      providerName: "Claude Code",
      type: "subscription",
      status: "connected",
      connected: true,
      plan: "Pro",
      model: "Sonnet 4.5",
      limits: [
        { id: "primary", name: "5 horas", percentageUsed: 84, resetAt: fromNow(48 * 60 * 1000) },
        { id: "secondary", name: "Semanal", percentageUsed: 31, resetAt: fromNow(4.1 * 24 * 60 * 60 * 1000) },
      ],
      metrics: [
        { id: "tokensToday", label: "Tokens hoje", value: 12_840_000, formattedValue: "12,84M" },
        { id: "tokensMonth", label: "Tokens no mês", value: 148_600_000, formattedValue: "148,60M" },
      ],
      lastUpdated: updated,
      source: "openusage",
      trendLabel: "Uso da janela principal · 7 dias",
      trend: [45, 52, 68, 61, 78, 73, 84].map((value, index) => ({ label: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][index], value, formattedValue: `${value}%` })),
    },
    deepseek: {
      providerId: "deepseek",
      providerName: "DeepSeek API",
      type: "api",
      status: "connected",
      connected: true,
      limits: [],
      metrics: [
        { id: "balance", label: "Saldo", value: 8.42, formattedValue: "US$ 8,42" },
        { id: "budget", label: "Orçamento", value: 10, formattedValue: "US$ 10,00" },
      ],
      lastUpdated: updated,
      source: "official-api",
      trendLabel: "Saldo disponível · 7 dias",
      trend: [10, 9.76, 9.41, 9.18, 8.93, 8.71, 8.42].map((value, index) => ({ label: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][index], value, formattedValue: `US$ ${value.toFixed(2).replace(".", ",")}` })),
    },
    openai: {
      providerId: "openai",
      providerName: "OpenAI API",
      type: "api",
      status: "connected",
      connected: true,
      limits: [
        {
          id: "monthlyBudget",
          name: "Orçamento mensal",
          used: 6.2,
          remaining: 13.8,
          limit: 20,
          percentageUsed: 31,
          resetAt: fromNow(11 * 24 * 60 * 60 * 1000),
          detail: "US$ 6,20 / US$ 20,00",
        },
      ],
      metrics: [
        { id: "spentToday", label: "Hoje", value: 0.82, formattedValue: "US$ 0,82" },
        { id: "spentMonth", label: "Este mês", value: 6.2, formattedValue: "US$ 6,20" },
      ],
      lastUpdated: updated,
      source: "official-api",
      trendLabel: "Gasto acumulado · 7 dias",
      trend: [1.2, 2.05, 2.73, 3.9, 4.82, 5.37, 6.2].map((value, index) => ({ label: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][index], value, formattedValue: `US$ ${value.toFixed(2).replace(".", ",")}` })),
    },
  };
}

const seeds: Record<ProviderId, number> = {
  codex: 2.1,
  claude: 4.7,
  deepseek: 6.2,
  openai: 8.9,
};

export function createDemoHistory(providerId: ProviderId, rangeDays: 7 | 30 | 90): ProviderHistory {
  const points: ProviderHistoryPoint[] = [];
  const seed = seeds[providerId];
  const today = new Date();
  let accumulatedCost = 0;

  for (let offset = rangeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const index = rangeDays - offset;
    const rhythm = Math.sin(index * 1.41 + seed) * 0.22 + Math.cos(index * 0.53 + seed) * 0.12 + 0.66;
    const weekday = date.getDay();
    const workdayFactor = weekday === 0 || weekday === 6 ? 0.42 : 1;
    const normalized = Math.max(0.08, rhythm * workdayFactor);
    accumulatedCost += normalized * 0.52;

    points.push({
      timestamp: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      tokens: providerId === "claude" ? Math.round(normalized * 15_400_000) : undefined,
      cost: providerId === "openai" ? Number(accumulatedCost.toFixed(2)) : undefined,
      balance: providerId === "deepseek" ? Number(Math.max(0, 10 - accumulatedCost).toFixed(2)) : undefined,
      percentage: providerId === "codex" || providerId === "claude"
        ? Math.round(Math.min(96, normalized * 92))
        : undefined,
    });
  }

  return {
    providerId,
    rangeDays,
    points,
    collectedSince: points[0]?.timestamp,
    source: providerId === "claude" ? "provider-local" : "snapshots",
  };
}
