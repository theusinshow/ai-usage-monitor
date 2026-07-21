import type { AIProvider, ProviderId, ProviderType, ProviderUsage } from "../types/provider";
import { nativeInvoke } from "../services/native";

export abstract class NativeProvider implements AIProvider {
  abstract readonly id: ProviderId;
  abstract readonly name: string;
  abstract readonly type: ProviderType;

  async isAvailable(): Promise<boolean> {
    return nativeInvoke<boolean>("is_provider_available", { providerId: this.id }).catch(() => false);
  }

  async getUsage(): Promise<ProviderUsage> {
    try {
      return await nativeInvoke<ProviderUsage>("get_provider_usage", { providerId: this.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        providerId: this.id,
        providerName: this.name,
        type: this.type,
        status: "error",
        connected: false,
        limits: [],
        metrics: [],
        lastUpdated: new Date().toISOString(),
        error: message,
      };
    }
  }
}
