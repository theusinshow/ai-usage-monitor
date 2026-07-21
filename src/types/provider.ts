export type ProviderId = "codex" | "claude" | "openai" | "deepseek";
export type ProviderType = "subscription" | "api";
export type ProviderStatus = "connected" | "loading" | "error" | "notConfigured" | "notInstalled";

export interface UsageLimit {
  id: string;
  name: string;
  used?: number;
  remaining?: number;
  limit?: number;
  percentageUsed?: number;
  resetAt?: string;
  detail?: string;
}

export interface UsageMetric {
  id: string;
  label: string;
  value?: number;
  formattedValue: string;
}

export interface ProviderUsage {
  providerId: ProviderId;
  providerName: string;
  type: ProviderType;
  status: ProviderStatus;
  connected: boolean;
  plan?: string;
  model?: string;
  limits: UsageLimit[];
  metrics: UsageMetric[];
  lastUpdated: string;
  source?: "codex-app-server" | "openusage" | "local" | "official-api";
  error?: string;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly type: ProviderType;
  isAvailable(): Promise<boolean>;
  getUsage(): Promise<ProviderUsage>;
}

export interface AppSettings {
  refreshIntervalSeconds: 30 | 60 | 300 | 900;
  monthlyBudgets: Record<"openai" | "deepseek", number | null>;
  historyRetentionDays: number;
}
