import type { ProviderStatus } from "../../types/provider";

const labels: Record<ProviderStatus, string> = {
  connected: "Conectado",
  loading: "Carregando",
  error: "Erro",
  notConfigured: "Configurar",
  notInstalled: "Não detectado",
};

export function StatusBadge({ status }: { status: ProviderStatus }) {
  return <span className={`status status--${status}`}><i aria-hidden="true" />{labels[status]}</span>;
}
