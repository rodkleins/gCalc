type PageId = 'calculadora' | 'headtohead' | 'calculos';

const PAGES: Array<{ id: PageId; label: string; path: string }> = [
  { id: 'calculadora', label: 'Calculadora', path: '' },
  { id: 'headtohead', label: 'Head-to-head', path: 'headtohead/' },
  { id: 'calculos', label: 'Cálculos', path: 'calculos/' },
];

function linkTestId(current: PageId, id: PageId): string | undefined {
  if (id === current) return undefined;
  if (id === 'calculadora') return current === 'calculos' ? 'doc-back' : 'back-to-current';
  if (id === 'headtohead') return current === 'calculos' ? 'doc-headtohead' : 'open-headtohead';
  return 'open-calculos';
}

export function PageNav({ current }: { current: PageId }) {
  const base = import.meta.env.BASE_URL;
  return (
    <nav className="page-nav" aria-label="Páginas" data-testid="page-nav">
      {PAGES.map((page) => {
        const active = page.id === current;
        const testId = linkTestId(current, page.id);
        return (
          <a
            key={page.id}
            href={`${base}${page.path}`}
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
