import { lazy, Suspense, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProviderUsage } from "./hooks/useProviderUsage";
import { Dashboard } from "./pages/Dashboard";
import { ProviderDetails } from "./pages/ProviderDetails";
import { SettingsPage } from "./pages/Settings";
import { isTauri } from "./services/native";
import type { ProviderId, ProviderUsage } from "./types/provider";

const DesignLab = import.meta.env.DEV ? lazy(() => import("./pages/DesignLab")) : undefined;

type Page = "dashboard" | "provider" | "settings" | "lab";

export default function App() {
  const labAvailable = import.meta.env.DEV;
  const [page, setPage] = useState<Page>(() => {
    if (!labAvailable) return "dashboard";
    return new URLSearchParams(window.location.search).get("lab") === "1" ? "lab" : "dashboard";
  });
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>("claude");
  const monitor = useProviderUsage();
  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | undefined;
    void listen("open-settings", () => setPage("settings")).then((unlisten) => { dispose = unlisten; });
    return () => dispose?.();
  }, []);
  if (page === "lab" && labAvailable && DesignLab) {
    return <Suspense fallback={<main className="app-shell lab-loading">Carregando Design Lab…</main>}>
      <DesignLab onBack={() => setPage("dashboard")} />
    </Suspense>;
  }

  if (page === "provider") {
    const availableProviders = Object.values(monitor.usage).filter((item): item is ProviderUsage => Boolean(item));
    const selected = monitor.usage[selectedProviderId];
    if (selected) {
      return <ProviderDetails
        usage={selected}
        providers={availableProviders}
        refreshing={monitor.refreshing}
        demoMode={monitor.demoMode}
        onBack={() => setPage("dashboard")}
        onRefresh={() => void monitor.refresh()}
        onSettings={() => setPage("settings")}
        onSelectProvider={setSelectedProviderId}
      />;
    }
  }

  return page === "dashboard"
    ? <Dashboard
        usage={monitor.usage}
        refreshing={monitor.refreshing}
        lastUpdated={monitor.lastUpdated}
        demoMode={monitor.demoMode}
        onRefresh={() => void monitor.refresh()}
        onSettings={() => setPage("settings")}
        onOpenProvider={(providerId) => {
          setSelectedProviderId(providerId);
          setPage("provider");
        }}
        onLab={labAvailable && monitor.demoMode ? () => setPage("lab") : undefined}
      />
    : <SettingsPage settings={monitor.settings} onBack={() => setPage("dashboard")} onSaved={async () => { await monitor.reloadSettings(); await monitor.refresh(); }} />;
}
