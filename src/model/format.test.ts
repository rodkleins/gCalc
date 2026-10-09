import { describe, expect, it } from 'vitest';
import { formatBRL, formatIrr, formatPayback, formatPercent, parseLocaleNumber } from './format';

describe('números em português', () => {
  it('entende milhar brasileiro e decimal com vírgula', () => {
    expect(parseLocaleNumber('9.200')).toBe(9200);
    expect(parseLocaleNumber('2.000.000')).toBe(2_000_000);
    expect(parseLocaleNumber('1.234,56')).toBeCloseTo(1234.56, 2);
    expect(parseLocaleNumber('65.000')).toBe(65000);
    expect(parseLocaleNumber('12,5')).toBeCloseTo(12.5, 2);
    expect(parseLocaleNumber('9200.5')).toBeCloseTo(9200.5, 2);
  });

  it('formata o exemplo ilustrativo', () => {
    expect(formatBRL(2_000_000).replace(/\u00a0/g, ' ')).toBe('R$ 2.000.000');
    expect(formatBRL(65_000).replace(/\u00a0/g, ' ')).toBe('R$ 65.000');
    expect(formatPayback(2_000_000 / 65_000)).toBe('30,8 meses');
    expect(formatPayback(0)).toBe('Imediato');
    expect(formatPercent(0.39)).toBe('39%');
    expect(formatIrr(null)).toBe('Indefinida');
    expect(formatIrr(0.39)).toBe('39%');
  });
});