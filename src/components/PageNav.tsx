import { siteHref, type SitePage } from '../model/sitePaths';

type PageId = 'calculadora' | 'headtohead' | 'calculos';

const PAGES: Array<{ id: PageId; label: string }> = [
  { id: 'calculadora', label: 'Calculadora' },
  { id: 'headtohead', label: 'Head-to-head' },
  { id: 'calculos', label: 'Cálculos' },
];

function linkTestId(current: PageId, id: PageId): string | undefined {
  if (id === current) return undefined;
  if (id === 'calculadora') return current === 'calculos' ? 'doc-back' : 'back-to-current';
  if (id === 'headtohead') return current === 'calculos' ? 'doc-headtohead' : 'open-headtohead';
  return 'open-calculos';
}

export function PageNav({ current }: { current: PageId }) {
  return (
    <nav className="page-nav" aria-label="Páginas" data-testid="page-nav">
      {PAGES.map((page) => {
        const active = page.id === current;
        const testId = linkTestId(current, page.id);
        return (
          <a
            key={page.id}
            href={siteHref(current, page.id satisfies SitePage)}
            aria-current={active ? 'page' : undefined}
            data-testid={testId}
          >
            {page.label}
          </a>
        );
      })}
    </nav>
  );
}
