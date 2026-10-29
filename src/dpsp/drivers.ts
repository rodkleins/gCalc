import { formatBRL, formatNumber } from '../model/format';
import { defaultStorePreset } from '../model/presets';
import { round2 } from '../model/round';
import type { Inputs } from '../model/types';

/** Metade dos balconistas da loja. Premissa editável. */
export const DEFAULT_BALCONISTA_REDUCTION = 0.5;
/**
 * Perdas que permanecem com o robô.
 * No modelo de R$ 2 milhões, R$ 12.000 de R$ 28.000 ficam (cerca de 43%).
 */
export const DEFAULT_RETAINED_LOSS = 0.43;

export interface DpspDrivers {
  /** Fração dos balconistas que o robô deixa de exigir. */
  balconistaReductionPct: number;
  /** Fração das perdas mensais da loja que continua depois do robô. */
  retainedLossPct: number;
  /** Custo mensal de uma vaga de balconista. Premissa a validar. */
  positionCost: number;
}

export function defaultDpspDrivers(): DpspDrivers {
  return {
    balconistaReductionPct: DEFAULT_BALCONISTA_REDUCTION,
    retainedLossPct: DEFAULT_RETAINED_LOSS,
    positionCost: defaultStorePreset().inputs.people.payroll.monthlyCostPerPosition,
  };
}

export function sanitizeDpspDrivers(value: Partial<DpspDrivers> | null | undefined): DpspDrivers {
  const fallback = defaultDpspDrivers();
  return {
    balconistaReductionPct: clampPct(value?.balconistaReductionPct, fallback.balconistaReductionPct),
    retainedLossPct: clampPct(value?.retainedLossPct, fallback.retainedLossPct),
    positionCost: clampMoney(value?.positionCost, fallback.positionCost),
  };
}

export function balconistaCount(inputs: Inputs): number {
  return inputs.profile.roles
    .filter((role) => role.role === 'Balconista')
    .reduce((total, role) => total + Math.max(0, role.headcount), 0);
}

export function reducedPositions(balconistas: number, reductionPct: number): number {
  return round2(Math.max(0, balconistas) * clampPct(reductionPct, 0));
}

export function projectedFromStore(historicalMonthly: number, retainedPct: number): number {
  return round2(Math.max(0, historicalMonthly) * clampPct(retainedPct, 0));
}

export function lossSavings(historicalMonthly: number, retainedPct: number): number {
  return round2(Math.max(0, historicalMonthly) * (1 - clampPct(retainedPct, 0)));
}

/** Aplica os percentuais da loja sem mexer em CAPEX, horas, área nem contratação futura. */
export function applyDpspDrivers(inputs: Inputs, drivers: DpspDrivers): Inputs {
  const next = structuredClone(inputs);
  const clean = sanitizeDpspDrivers(drivers);
  const positions = reducedPositions(balconistaCount(next), clean.balconistaReductionPct);
  next.people.payroll.positionsReduced = positions;
  next.people.payroll.monthlyCostPerPosition = clean.positionCost;
  next.people.payroll.severanceCost = round2(positions * clean.positionCost);
  next.stock.losses.projectedLossesMonthly = projectedFromStore(
    next.profile.historicalLossesMonthly,
    clean.retainedLossPct,
  );
  next.people.futureHires.hires = next.people.futureHires.hires.map((hire) => ({
    ...hire,
    role: 'Balconista',
    monthlyCost: clean.positionCost,
  }));
  return next;
}

export function dpspFormulaLines(inputs: Inputs, drivers: DpspDrivers): string[] {
  const clean = sanitizeDpspDrivers(drivers);
  const base = defaultStorePreset().inputs;
  const balconistas = balconistaCount(inputs);
  const positions = reducedPositions(balconistas, clean.balconistaReductionPct);
  const historical = Math.max(0, inputs.profile.historicalLossesMonthly);
  const projected = projectedFromStore(historical, clean.retainedLossPct);
  const savings = lossSavings(historical, clean.retainedLossPct);
  const reduction = formatPercentPoints(clean.balconistaReductionPct);
  const retained = formatPercentPoints(clean.retainedLossPct);
  const kept = formatPercentPoints(1 - clean.retainedLossPct);
  const future = base.people.futureHires.hires[0];
  return [
    `Vagas reduzidas = balconistas × percentual = ${countLabel(balconistas)} × ${reduction} = ${countLabel(positions)}.`,
    `Folha mensal = ${countLabel(positions)} × ${formatBRL(clean.positionCost, 2)} = ${formatBRL(round2(positions * clean.positionCost), 2)}. O custo por vaga é premissa a validar.`,
    `Rescisão = ${countLabel(positions)} × ${formatBRL(clean.positionCost, 2)} = ${formatBRL(round2(positions * clean.positionCost), 2)}. Um mês das vagas reduzidas, como nos portes do modelo.`,
    `Perdas com o robô = perdas da loja × percentual que permanece = ${formatBRL(historical, 2)} × ${retained} = ${formatBRL(projected, 2)}.`,
    `Economia de perdas = perdas da loja × (1 − ${retained}) = ${formatBRL(historical, 2)} × ${kept} = ${formatBRL(savings, 2)}.`,
    `O turnover usa essas vagas reduzidas e a taxa de ${formatPercentPoints(base.people.turnover.annualRate)} ao ano do modelo.`,
    `Horas de supervisão (${countLabel(base.people.supervision.hoursSavedPerMonth)} h), movimentação (${countLabel(base.logistics.movement.hoursSavedPerMonth)} h) e inventário (${countLabel(base.logistics.inventoryCount.hoursSavedPerMonth)} h) ficam as da loja de R$ 2 milhões. Nos portes do modelo essas horas não seguem uma proporção única de SKU, volume ou HC, então não foram escaladas.`,
    `CAPEX, OPEX, dispensações por dia (${formatNumber(base.profile.dispensationsPerDay)}), área, metros liberados, estoque e a contratação futura (${countLabel(future?.headcount ?? 0)} pessoas no mês ${future?.month ?? 13}) permanecem na loja de R$ 2 milhões.`,
  ];
}

function clampPct(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function clampMoney(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, round2(value));
}

function formatPercentPoints(fraction: number): string {
  const points = fraction * 100;
  const digits = Math.abs(points - Math.round(points)) < 0.05 ? 0 : 1;
  return `${formatNumber(points, digits)}%`;
}

function countLabel(value: number): string {
  const digits = Math.abs(value - Math.round(value)) < 0.001 ? 0 : 1;
  return formatNumber(value, digits);
}
