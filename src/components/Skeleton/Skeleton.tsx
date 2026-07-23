export function ProviderSkeleton({ name }: { name: string }) {
  return <section className="provider-tile provider-tile--skeleton" aria-label={`Carregando ${name}`}><div className="skeleton skeleton--title" /><div className="skeleton skeleton--line" /><div className="skeleton skeleton--bar" /></section>;
}
