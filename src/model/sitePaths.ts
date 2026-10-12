export type SitePage = 'calculadora' | 'headtohead' | 'calculos' | 'rh' | 'rh-calculos';

const DEPTH: Record<SitePage, number> = {
  calculadora: 0,
  headtohead: 1,
  calculos: 1,
  rh: 1,
  'rh-calculos': 2,
};

const PATH: Record<SitePage, string> = {
  calculadora: '',
  headtohead: 'headtohead/',
  calculos: 'calculos/',
  rh: 'rh/',
  'rh-calculos': 'rh/calculos/',
};

/** Link relativo à página atual. Funciona na raiz do domínio e em qualquer subpasta. */
export function siteHref(from: SitePage, to: SitePage): string {
  const target = `${'../'.repeat(DEPTH[from])}${PATH[to]}`;
  return target || './';
}
