import { describe, expect, it } from 'vitest';
import {
  annualizeMonthlyRate,
  discountedPayback,
  firstNonNegativeDiscountedMonth,
  firstNonNegativeMonth,
  irr,
  monthlyRateFromAnnual,
  npv,
  simpleAnnualRoi,
  simplePayback,
} from './finance';

describe('VPL', () => {
  it('desconta os fluxos e não desconta a data zero', () => {
    const value = npv(0.1, [-100, 60, 60]);
    expect(value).toBeCloseTo(-100 + 60 / 1.1 + 60 / 1.21, 8);
  });

  it('é zero quando a taxa é a TIR', () => {
    const flows = [-100, 60, 60];
    const rate = irr(flows);
    expect(rate).not.toBeNull();
    expect(npv(rate as number, flows)).toBeCloseTo(0, 6);
  });
});

describe('TIR', () => {
  it('resolve o projeto de dois períodos', () => {
    const rate = irr([-100, 60, 60]);
    expect(rate).toBeCloseTo(-0.7 + Math.sqrt(0.69), 6);
  });

  it('devolve null sem troca de sinal', () => {
    expect(irr([10, 20, 30])).toBeNull();
    expect(irr([-10, -5])).toBeNull();
  });
});

describe('payback', () => {
  it('reproduz o exemplo ilustrativo de 30,5 meses', () => {
    const flows = [-1_980_000, ...Array.from({ length: 60 }, () => 65_000)];
    expect(simplePayback(flows)).toBeCloseTo(1_980_000 / 65_000, 8);
    expect(simplePayback(flows)).toBeCloseTo(30.4615384615, 8);
    expect(firstNonNegativeMonth(flows)).toBe(31);
  });

  it('interpola dentro do mês em que o acumulado cruza zero', () => {
    expect(simplePayback([-100, 40, 40, 40])).toBeCloseTo(2.5, 8);
    expect(firstNonNegativeMonth([-100, 40, 40, 40])).toBe(3);
  });

  it('devolve null quando o caixa não recupera', () => {
    expect(simplePayback([-100, 10, 10])).toBeNull();
    expect(firstNonNegativeMonth([-100, 10, 10])).toBeNull();
  });

  it('trata investimento já coberto na data zero', () => {
    expect(simplePayback([0, 10])).toBe(0);
  });

  it('desconta o payback e coincide com o simples quando a taxa é zero', () => {
    const flows = [-100, 40, 40, 40];
    expect(discountedPayback(flows, 0)).toBeCloseTo(2.5, 8);
    expect(discountedPayback(flows, 0.02)).toBeGreaterThan(2.5);
    expect(firstNonNegativeDiscountedMonth(flows, 0)).toBe(3);
  });
});

describe('ROI anual simples', () => {
  it('é benefício anual dividido pelo investimento, e não a TIR', () => {
    expect(simpleAnnualRoi(780_000, 1_980_000)).toBeCloseTo(780_000 / 1_980_000, 10);
    expect(simpleAnnualRoi(65_000 * 12, 1_980_000)).toBeCloseTo(780_000 / 1_980_000, 10);
  });

  it('não divide por investimento nulo ou negativo', () => {
    expect(simpleAnnualRoi(100, 0)).toBeNull();
    expect(simpleAnnualRoi(100, -10)).toBeNull();
  });
});

describe('taxas equivalente', () => {
  it('converte taxa anual efetiva para mensal e de volta', () => {
    const monthly = monthlyRateFromAnnual(0.12);
    expect(monthly).toBeCloseTo(Math.pow(1.12, 1 / 12) - 1, 12);
    expect(annualizeMonthlyRate(monthly)).toBeCloseTo(0.12, 12);
  });
});
