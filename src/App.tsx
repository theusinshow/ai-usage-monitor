import { lazy, Suspense, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProviderUsage } from "./hooks/useProviderUsage";
import { Dashboard } from "./pages/Dashboard";
import { SettingsPage } from "./pages/Settings";
import { isTauri } from "./services/native";

const DesignLab = import.meta.env.DEV ? lazy(() => import("./pages/DesignLab")) : undefined;

type Page = "dashboard" | "settings" | "lab";

export default function App() {
  const labAvailable = import.meta.env.DEV;
  const [page, setPage] = useState<Page>(() => {
    if (!labAvailable) return "dashboard";
    return new URLSearchParams(window.location.search).get("lab") === "1" ? "lab" : "dashboard";
  });
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

  return page === "dashboard"
    ? <Dashboard usage={monitor.usage} refreshing={monitor.refreshing} lastUpdated={monitor.lastUpdated} demoMode={monitor.demoMode} onRefresh={() => void monitor.refresh()} onSettings={() => setPage("settings")} onLab={labAvailable && monitor.demoMode ? () => setPage("lab") : undefined} />
    : <SettingsPage settings={monitor.settings} onBack={() => setPage("dashboard")} onSaved={async () => { await monitor.reloadSettings(); await monitor.refresh(); }} />;
}
