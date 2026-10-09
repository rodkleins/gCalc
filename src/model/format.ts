export function formatBRL(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCompactBRL(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatIrr(value: number | null, digits?: number): string {
  if (value === null || !Number.isFinite(value)) return 'Indefinida';
  return formatPercent(value, digits);
}

export function formatPercent(value: number | null, digits?: number): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const percent = value * 100;
  const fractionDigits = digits ?? (Math.abs(percent - Math.round(percent)) < 0.05 ? 0 : 1);
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPayback(months: number | null): string {
  if (months === null) return 'Não recupera em 60 meses';
  if (months <= 0) return 'Imediato';
  return `${formatNumber(months, 1)} meses`;
}

export function parseLocaleNumber(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, '').replace(/R\$/gi, '');
  if (!text || text === '-' || text === ',' || text === '.') return null;
  const hasComma = text.includes(',');
  const dots = text.match(/\./g)?.length ?? 0;
  let normalized = text;
  if (hasComma) {
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (dots > 1) {
    normalized = text.replace(/\./g, '');
  } else if (dots === 1) {
    const [head, tail] = text.split('.');
    if (/^\d+$/.test(head) && tail.length === 3) normalized = head + tail;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function scenarioLabel(id: string): string {
  if (id === 'conservador') return 'Conservador';
  if (id === 'otimista') return 'Otimista';
  return 'Base';
}

export function storeLabel(storeType: string): string {
  return storeType === 'nova' ? 'Loja nova' : 'Loja existente';
}
