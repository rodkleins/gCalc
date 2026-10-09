import { HORIZON_MONTHS } from './types';

/** VPL. O índice 0 é o fluxo na data zero e não é descontado. */
export function npv(ratePerPeriod: number, cashFlows: number[]): number {
  if (ratePerPeriod <= -1) return Number.NaN;
  return cashFlows.reduce((total, cashFlow, period) => {
    return total + cashFlow / Math.pow(1 + ratePerPeriod, period);
  }, 0);
}

/**
 * TIR por período dos fluxos (índice 0 = data zero).
 * Devolve null quando não há troca de sinal ou a raiz não converge.
 */
export function irr(cashFlows: number[]): number | null {
  const hasPositive = cashFlows.some((value) => value > 0);
  const hasNegative = cashFlows.some((value) => value < 0);
  if (!hasPositive || !hasNegative) return null;

  let rate = 0.01;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    let value = 0;
    let derivative = 0;
    for (let period = 0; period < cashFlows.length; period += 1) {
      const denominator = Math.pow(1 + rate, period);
      value += cashFlows[period] / denominator;
      if (period > 0) {
        derivative -= (period * cashFlows[period]) / Math.pow(1 + rate, period + 1);
      }
    }
    if (!Number.isFinite(value) || !Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) {
      break;
    }
    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - rate) < 1e-12) return next;
    rate = next;
  }

  let low = -0.9;
  let high = 1;
  let npvLow = npv(low, cashFlows);
  let npvHigh = npv(high, cashFlows);
  let expansions = 0;
  while (npvLow * npvHigh > 0 && high < 1_000 && expansions < 30) {
    high *= 2;
    npvHigh = npv(high, cashFlows);
    expansions += 1;
  }
  if (!Number.isFinite(npvLow) || !Number.isFinite(npvHigh) || npvLow * npvHigh > 0) return null;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const mid = (low + high) / 2;
    const value = npv(mid, cashFlows);
    if (Math.abs(value) < 1e-8) return mid;
    if (npvLow * value <= 0) {
      high = mid;
      npvHigh = value;
    } else {
      low = mid;
      npvLow = value;
    }
  }
  return (low + high) / 2;
}

export function monthlyRateFromAnnual(annualRate: number): number {
  if (annualRate <= -1) return Number.NaN;
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

export function annualizeMonthlyRate(monthlyRate: number): number {
  if (monthlyRate <= -1) return Number.NaN;
  return Math.pow(1 + monthlyRate, 12) - 1;
}

/**
 * Payback simples interpolado, em meses de operação.
 * O índice 0 é o investimento (ou outro fluxo) na data zero.
 * Ex.: [-1_980_000, 65_000, ...] devolve aproximadamente 30,462 meses.
 */
export function simplePayback(cashFlows: number[]): number | null {
  if (cashFlows.length === 0) return null;
  let cumulative = cashFlows[0];
  if (cumulative >= -1e-9) return 0;
  for (let month = 1; month < cashFlows.length; month += 1) {
    const previous = cumulative;
    const flow = cashFlows[month];
    cumulative += flow;
    if (cumulative >= -1e-9 && previous < 0) {
      if (Math.abs(flow) < 1e-9) return month;
      return month - 1 + -previous / flow;
    }
  }
  return null;
}

/** Primeiro mês de operação em que o caixa acumulado fica não negativo. */
export function firstNonNegativeMonth(cashFlows: number[]): number | null {
  let cumulative = 0;
  for (let period = 0; period < cashFlows.length; period += 1) {
    cumulative += cashFlows[period];
    if (period === 0) continue;
    if (cumulative >= -1e-9) return period;
  }
  return null;
}

/** Payback descontado interpolado, na mesma convenção de simplePayback. */
export function discountedPayback(cashFlows: number[], ratePerPeriod: number): number | null {
  if (cashFlows.length === 0 || ratePerPeriod <= -1) return null;
  const discounted = cashFlows.map((flow, period) => flow / Math.pow(1 + ratePerPeriod, period));
  return simplePayback(discounted);
}

export function firstNonNegativeDiscountedMonth(
  cashFlows: number[],
  ratePerPeriod: number,
): number | null {
  if (ratePerPeriod <= -1) return null;
  const discounted = cashFlows.map((flow, period) => flow / Math.pow(1 + ratePerPeriod, period));
  return firstNonNegativeMonth(discounted);
}

/**
 * ROI anual simples = benefício líquido anual estabilizado / investimento líquido.
 * Não é a TIR.
 */
export function simpleAnnualRoi(annualNetBenefit: number, netInvestment: number): number | null {
  if (!(netInvestment > 0) || !Number.isFinite(annualNetBenefit)) return null;
  return annualNetBenefit / netInvestment;
}

export function emptyHorizon(value = 0): number[] {
  return Array.from({ length: HORIZON_MONTHS }, () => value);
}

/** Trocas de sinal ignorando zeros. Mais de uma troca torna a TIR ambígua. */
export function signChanges(cashFlows: number[]): number {
  let changes = 0;
  let previous = 0;
  for (const value of cashFlows) {
    if (!Number.isFinite(value) || Math.abs(value) < 1e-6) continue;
    const sign = value > 0 ? 1 : -1;
    if (previous !== 0 && sign !== previous) changes += 1;
    previous = sign;
  }
  return changes;
}
