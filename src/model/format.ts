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

function moneySignificant(char: string): boolean {
  return (char >= '0' && char <= '9') || char === ',' || char === '-';
}

/**
 * Agrupa o milhar com ponto enquanto a pessoa digita. A vírgula é o centavo, com no máximo duas casas.
 * 1000000 vira 1.000.000. 1000,5 vira 1.000,5.
 */
export function formatMoneyDraft(raw: string): string {
  const text = raw.replace(/\s/g, '').replace(/R\$/gi, '');
  if (!text) return '';
  const negative = text.startsWith('-');
  const body = (negative ? text.slice(1) : text).replace(/\./g, '');
  let integer = '';
  let fraction: string | null = null;
  for (const char of body) {
    if (char >= '0' && char <= '9') {
      if (fraction === null) integer += char;
      else if (fraction.length < 2) fraction += char;
    } else if (char === ',' && fraction === null) {
      fraction = '';
    }
  }
  integer = integer.replace(/^0+(?=\d)/, '');
  const sign = negative ? '-' : '';
  if (!integer && fraction === null) return sign;
  if (!integer) integer = '0';
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction === null ? sign + grouped : `${sign}${grouped},${fraction}`;
}

/** Coloca o cursor depois dos mesmos dígitos, vírgula e sinal que havia antes da formatação. */
export function caretAfterFormat(before: string, caret: number, after: string): number {
  const end = Math.max(0, Math.min(caret, before.length));
  let target = 0;
  for (let index = 0; index < end; index += 1) {
    if (moneySignificant(before[index] ?? '')) target += 1;
  }
  let seen = 0;
  for (let index = 0; index < after.length; index += 1) {
    if (seen === target) return index;
    if (moneySignificant(after[index] ?? '')) seen += 1;
  }
  return after.length;
}

export function scenarioLabel(id: string): string {
  if (id === 'conservador') return 'Conservador';
  if (id === 'otimista') return 'Otimista';
  return 'Base';
}

export function storeLabel(storeType: string): string {
  return storeType === 'nova' ? 'Loja nova' : 'Loja existente';
}
