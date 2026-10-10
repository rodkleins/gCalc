type RhPage = 'rh' | 'calculos';

const PAGES: Array<{ id: RhPage; label: string; path: string; testId: string }> = [
  { id: 'rh', label: 'Quadro de RH', path: 'rh/', testId: 'rh-nav-app' },
  { id: 'calculos', label: 'Cálculos', path: 'rh/calculos/', testId: 'rh-nav-calculos' },
];

export function RhPageNav({ current }: { current: RhPage }) {
  const base = import.meta.env.BASE_URL;
  return (
    <nav className="page-nav" aria-label="Páginas desta versão" data-testid="rh-page-nav">
      <a href={base} data-testid="rh-current-version">
        Versão atual
      </a>
      {PAGES.map((page) => (
        <a
          key={page.id}
          href={`${base}${page.path}`}
          aria-current={page.id === current ? 'page' : undefined}
          data-testid={page.id === current ? undefined : page.testId}
        >
          {page.label}
        </a>
      ))}
    </nav>
  );
}

export function RhValidationNotice() {
  const base = import.meta.env.BASE_URL;
  return (
    <p className="preview-notice" data-testid="rh-validation-notice">
      Versão em validação. O quadro de RH por turno ainda não substitui a{' '}
      <a href={base} data-testid="rh-back-to-current">
        versão atual
      </a>
      .
    </p>
  );
}
