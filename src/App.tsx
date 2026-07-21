import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProviderUsage } from "./hooks/useProviderUsage";
import { Dashboard } from "./pages/Dashboard";
import { SettingsPage } from "./pages/Settings";
import { isTauri } from "./services/native";

export default function App() {
  const [page, setPage] = useState<"dashboard" | "settings">("dashboard");
  const monitor = useProviderUsage();
  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | undefined;
    void listen("open-settings", () => setPage("settings")).then((unlisten) => { dispose = unlisten; });
    return () => dispose?.();
  }, []);
  return page === "dashboard"
    ? <Dashboard usage={monitor.usage} refreshing={monitor.refreshing} lastUpdated={monitor.lastUpdated} onRefresh={() => void monitor.refresh()} onSettings={() => setPage("settings")} />
    : <SettingsPage settings={monitor.settings} onBack={() => setPage("dashboard")} onSaved={async () => { await monitor.reloadSettings(); await monitor.refresh(); }} />;
}
