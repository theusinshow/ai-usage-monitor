import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProviderUsage } from "./hooks/useProviderUsage";
import { Dashboard } from "./pages/Dashboard";
import { ProviderDetails } from "./pages/ProviderDetails";
import { SettingsPage } from "./pages/Settings";
import { isTauri } from "./services/native";
import type { ProviderId, ProviderUsage } from "./types/provider";

const DesignLab = import.meta.env.DEV ? lazy(() => import("./pages/DesignLab")) : undefined;

type Page = "dashboard" | "provider" | "settings" | "lab";
type NavigationState = {
  page: Page;
  history: Page[];
};

export default function App() {
  const labAvailable = import.meta.env.DEV;
  const [navigation, setNavigation] = useState<NavigationState>(() => {
    const page = labAvailable && new URLSearchParams(window.location.search).get("lab") === "1"
      ? "lab"
      : "dashboard";
    return { page, history: [] };
  });
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>("claude");
  const monitor = useProviderUsage();
  const page = navigation.page;

  const navigateTo = useCallback((nextPage: Page) => {
    setNavigation((current) => current.page === nextPage
      ? current
      : { page: nextPage, history: [...current.history, current.page] });
  }, []);

  const goBack = useCallback(() => {
    setNavigation((current) => {
      const previousPage = current.history.at(-1) ?? "dashboard";
      return { page: previousPage, history: current.history.slice(0, -1) };
    });
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | undefined;
    void listen("open-settings", () => navigateTo("settings")).then((unlisten) => { dispose = unlisten; });
    return () => dispose?.();
  }, [navigateTo]);

  useEffect(() => {
    if (page === "dashboard" || page === "settings") return;
    const handleKeyboardBack = (event: KeyboardEvent) => {
      if ((event.altKey && event.key === "ArrowLeft") || event.key === "BrowserBack") {
        event.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", handleKeyboardBack);
    return () => window.removeEventListener("keydown", handleKeyboardBack);
  }, [goBack, page]);

  if (page === "lab" && labAvailable && DesignLab) {
    return <Suspense fallback={<main className="app-shell lab-loading">Carregando Design Lab…</main>}>
      <DesignLab onBack={goBack} />
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
        onBack={goBack}
        onRefresh={() => void monitor.refresh()}
        onSettings={() => navigateTo("settings")}
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
        onSettings={() => navigateTo("settings")}
        onOpenProvider={(providerId) => {
          setSelectedProviderId(providerId);
          navigateTo("provider");
        }}
        onLab={labAvailable && monitor.demoMode ? () => navigateTo("lab") : undefined}
      />
    : <SettingsPage
        settings={monitor.settings}
        backLabel={navigation.history.at(-1) === "provider" ? "Voltar para a análise" : "Voltar para a Home"}
        onBack={goBack}
        onSaved={async () => { await monitor.reloadSettings(); await monitor.refresh(); }}
      />;
}
