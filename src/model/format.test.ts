import { describe, expect, it } from 'vitest';
import { caretAfterFormat, formatBRL, formatIrr, formatMoneyDraft, formatPayback, formatPercent, parseLocaleNumber } from './format';

describe('números em português', () => {
  it('entende milhar brasileiro e decimal com vírgula', () => {
    expect(parseLocaleNumber('9.200')).toBe(9200);
    expect(parseLocaleNumber('2.000.000')).toBe(2_000_000);
    expect(parseLocaleNumber('1.234,56')).toBeCloseTo(1234.56, 2);
    expect(parseLocaleNumber('65.000')).toBe(65000);
    expect(parseLocaleNumber('12,5')).toBeCloseTo(12.5, 2);
    expect(parseLocaleNumber('9200.5')).toBeCloseTo(9200.5, 2);
  });

  it('agrupa milhar enquanto se digita e devolve o cursor', () => {
    expect(formatMoneyDraft('1000000')).toBe('1.000.000');
    expect(formatMoneyDraft('1.000.000')).toBe('1.000.000');
    expect(formatMoneyDraft('1000,5')).toBe('1.000,5');
    expect(formatMoneyDraft('1000,505')).toBe('1.000,50');
    expect(formatMoneyDraft('R$ 1.000,50')).toBe('1.000,50');
    expect(parseLocaleNumber(formatMoneyDraft('1000000'))).toBe(1_000_000);
    expect(parseLocaleNumber(formatMoneyDraft('1000,5'))).toBeCloseTo(1000.5, 2);
    expect(caretAfterFormat('1000000', 7, '1.000.000')).toBe('1.000.000'.length);
    expect(caretAfterFormat('1.000.000', 5, '1.000.000')).toBe(5);
    expect(caretAfterFormat('1000,5', 4, '1.000,5')).toBe('1.000'.length);
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