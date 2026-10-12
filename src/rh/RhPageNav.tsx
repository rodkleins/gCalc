import { siteHref, type SitePage } from '../model/sitePaths';

type RhPage = 'rh' | 'calculos';

const PAGES: Array<{ id: RhPage; label: string; testId: string }> = [
  { id: 'rh', label: 'Quadro de RH', testId: 'rh-nav-app' },
  { id: 'calculos', label: 'Cálculos', testId: 'rh-nav-calculos' },
];

function fromPage(current: RhPage): SitePage {
  return current === 'rh' ? 'rh' : 'rh-calculos';
}

export function RhPageNav({ current }: { current: RhPage }) {
  const from = fromPage(current);
  return (
    <nav className="page-nav" aria-label="Páginas desta versão" data-testid="rh-page-nav">
      <a href={siteHref(from, 'calculadora')} data-testid="rh-current-version">
        Versão atual
      </a>
      {PAGES.map((page) => (
        <a
          key={page.id}
          href={siteHref(from, page.id === 'rh' ? 'rh' : 'rh-calculos')}
          aria-current={page.id === current ? 'page' : undefined}
          data-testid={page.id === current ? undefined : page.testId}
        >
          {page.label}
        </a>
      ))}
    </nav>
  );
}

export function RhValidationNotice({ from = 'rh' }: { from?: SitePage }) {
  return (
    <p className="preview-notice" data-testid="rh-validation-notice">
      Versão em validação. O quadro de RH por turno ainda não substitui a{' '}
      <a href={siteHref(from, 'calculadora')} data-testid="rh-back-to-current">
        versão atual
      </a>
      .
    </p>
  );
}
