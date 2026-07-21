import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { providers } from "../providers";
import { isTauri, nativeInvoke } from "../services/native";
import type { AppSettings, ProviderId, ProviderUsage } from "../types/provider";

const defaults: AppSettings = {
  refreshIntervalSeconds: 60,
  monthlyBudgets: { openai: null, deepseek: null },
  historyRetentionDays: 90,
};

export function useProviderUsage() {
  const [usage, setUsage] = useState<Partial<Record<ProviderId, ProviderUsage>>>({});
  const [settings, setSettings] = useState<AppSettings>(defaults);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>();
  const running = useRef(false);

  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setRefreshing(true);
    const results = await Promise.all(providers.map((provider) => provider.getUsage()));
    setUsage(Object.fromEntries(results.map((item) => [item.providerId, item])));
    setLastUpdated(new Date().toISOString());
    setRefreshing(false);
    running.current = false;
  }, []);

  const reloadSettings = useCallback(async () => {
    if (!isTauri()) return;
    const value = await nativeInvoke<AppSettings>("get_settings").catch(() => defaults);
    setSettings(value);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void reloadSettings().then(refresh), 0);
    return () => window.clearTimeout(timer);
  }, [refresh, reloadSettings]);

  useEffect(() => {
    const timer = window.setInterval(refresh, settings.refreshIntervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [refresh, settings.refreshIntervalSeconds]);

  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | undefined;
    void listen("refresh-requested", refresh).then((unlisten) => { dispose = unlisten; });
    return () => dispose?.();
  }, [refresh]);

  return { usage, settings, refreshing, lastUpdated, refresh, reloadSettings };
}
