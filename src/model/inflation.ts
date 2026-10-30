import type { Inputs, MoneyBasis } from './types';

/**
 * Boletim Focus (Banco Central do Brasil), mediana das expectativas de mercado.
 * Pesquisa de 23/10/2026, relatório publicado em 26/10/2026.
 */
export const FOCUS_IPCA = {
  ipca2026: 0.0519,
  ipca2027: 0.0434,
  surveyDate: '2026-10-23',
  publishedDate: '2026-10-26',
  reportUrl: 'https://www.bcb.gov.br/content/focus/focus/R20261023.pdf',
  pageUrl: 'https://www.bcb.gov.br/publicacoes/focus',
} as const;

/** Premissa da calculadora: o reajuste salarial fica 1 p.p. acima do IPCA. Não é dado do Focus. */
export const WAGE_SPREAD_OVER_IPCA = 0.01;

/** Choque usado na linha de sensibilidade “Inflação alta”. */
export const HIGH_INFLATION_SHOCK = 0.03;

export const DEFAULT_INFLATION = {
  priceInflationPctPerYear: FOCUS_IPCA.ipca2027,
  opexInflationPctPerYear: FOCUS_IPCA.ipca2027,
  wageGrowthPctPerYear: round6(FOCUS_IPCA.ipca2027 + WAGE_SPREAD_OVER_IPCA),
} as const;

export const FOCUS_SOURCE_TEXT =
  'Boletim Focus do Banco Central, mediana do IPCA de 2027 (4,34%), pesquisa de 23/10/2026, publicada em 26/10/2026. Para 2026 a mediana é 5,19%.';

export const WAGE_SOURCE_TEXT =
  'Premissa: IPCA do Focus (4,34%) + 1 p.p. = 5,34% ao ano. É uma suposição da calculadora, não um dado do Focus nem de convenção coletiva.';

export const OPEX_SOURCE_TEXT =
  'Mesmo IPCA do Focus de 23/10/2026 (4,34%). Suporte e energia reajustam pelo IPCA até haver o índice do contrato.';

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Taxa real pela equação de Fisher: (1 + nominal) / (1 + inflação) − 1. */
export function realFromNominal(nominal: number, inflation: number): number {
  return round6((1 + nominal) / (1 + inflation) - 1);
}

/** Taxa nominal pela equação de Fisher: (1 + real) × (1 + inflação) − 1. */
export function nominalFromReal(real: number, inflation: number): number {
  return round6((1 + real) * (1 + inflation) - 1);
}

export function hasInflation(inputs: Inputs): boolean {
  const profile = inputs.profile;
  return profile.wageGrowthPctPerYear !== 0 || profile.opexInflationPctPerYear !== 0 || profile.priceInflationPctPerYear !== 0;
}

/** Aplica a inflação padrão do Focus em base nominal. */
export function withDefaultInflation(inputs: Inputs): Inputs {
  return {
    ...inputs,
    profile: { ...inputs.profile, ...DEFAULT_INFLATION, moneyBasis: 'nominal' },
    robot: { ...inputs.robot, discountBasis: 'nominal' },
  };
}

/**
 * Troca a base monetária mantendo a conta coerente.
 * Real: zera os reajustes e converte a taxa de desconto para real (Fisher, pelo IPCA em uso).
 * Nominal: volta aos reajustes do Focus e converte a taxa de desconto para nominal.
 */
export function switchMoneyBasis(inputs: Inputs, basis: MoneyBasis): Inputs {
  if (inputs.profile.moneyBasis === basis && inputs.robot.discountBasis === basis) return inputs;
  if (basis === 'real') {
    const ipca = inputs.profile.priceInflationPctPerYear || DEFAULT_INFLATION.priceInflationPctPerYear;
    const discount =
      inputs.robot.discountBasis === 'real'
        ? inputs.robot.discountRateAnnual
        : realFromNominal(inputs.robot.discountRateAnnual, ipca);
    return {
      ...inputs,
      profile: {
        ...inputs.profile,
        wageGrowthPctPerYear: 0,
        opexInflationPctPerYear: 0,
        priceInflationPctPerYear: 0,
        moneyBasis: 'real',
      },
      robot: { ...inputs.robot, discountRateAnnual: discount, discountBasis: 'real' },
    };
  }
  const ipca = DEFAULT_INFLATION.priceInflationPctPerYear;
  const discount =
    inputs.robot.discountBasis === 'nominal'
      ? inputs.robot.discountRateAnnual
      : nominalFromReal(inputs.robot.discountRateAnnual, ipca);
  return {
    ...inputs,
    profile: { ...inputs.profile, ...DEFAULT_INFLATION, moneyBasis: 'nominal' },
    robot: { ...inputs.robot, discountRateAnnual: discount, discountBasis: 'nominal' },
  };
}

/** Aviso de incoerência entre a base monetária e os reajustes. Null quando está coerente. */
export function inflationWarning(inputs: Inputs): string | null {
  const basis = inputs.profile.moneyBasis;
  if (basis === 'nominal' && !hasInflation(inputs)) {
    return 'Base nominal com inflação zero: a taxa de desconto nominal já embute inflação, mas salários, OPEX e preços ficam congelados. Informe a inflação ou troque para base real.';
  }
  if (basis === 'real' && hasInflation(inputs)) {
    return 'Base real com reajuste maior que zero: em moeda constante os reajustes devem ser zero (ou só o ganho acima da inflação). Zere a inflação ou volte para base nominal.';
  }
  if (inputs.robot.discountBasis !== basis) {
    return 'A taxa de desconto está em outra base. Use a troca de base deste bloco para converter pela equação de Fisher.';
  }
  return null;
}

/** Choque de inflação: IPCA, OPEX e salário sobem o mesmo número de pontos. */
export function withInflationShock(inputs: Inputs, shock = HIGH_INFLATION_SHOCK): Inputs {
  const profile = inputs.profile;
  return {
    ...inputs,
    profile: {
      ...profile,
      priceInflationPctPerYear: round6(profile.priceInflationPctPerYear + shock),
      opexInflationPctPerYear: round6(profile.opexInflationPctPerYear + shock),
      wageGrowthPctPerYear: round6(profile.wageGrowthPctPerYear + shock),
    },
  };
}

/** Mesmas premissas sem reajuste nenhum, para medir o efeito da inflação. */
export function withoutInflation(inputs: Inputs): Inputs {
  return {
    ...inputs,
    profile: { ...inputs.profile, wageGrowthPctPerYear: 0, opexInflationPctPerYear: 0, priceInflationPctPerYear: 0 },
  };
}
