import { projectDriver } from './drivers';
import { round2 } from './round';
import type { SectionId } from './storage';
import type { Inputs, SensitivityDriver } from './types';

export const ADJUST_MIN = -1;
export const ADJUST_MAX = 0.3;
export const ADJUST_STEP = 0.05;

export const QUICK_LEVERS = [
  {
    id: 'investimento',
    label: 'Investimento do robô',
    fieldId: 'robot.capex.equipment',
    kind: 'money' as const,
    hint: 'Soma do CAPEX. O percentual reparte frete, obra e o restante.',
  },
  {
    id: 'opex',
    label: 'OPEX',
    fieldId: 'robot.opexMonthly.maintenance',
    kind: 'money' as const,
    hint: 'Custo mensal do robô. O percentual reparte manutenção, software e o restante.',
  },
  {
    id: 'salarios',
    label: 'Mão de obra',
    fieldId: 'people.payroll.monthlyCostPerPosition',
    kind: 'money' as const,
    hint: 'Mesmo driver de mão de obra da sensibilidade: folha, horas, turnover e contratações.',
  },
  {
    id: 'turnover',
    label: 'Turnover',
    fieldId: 'people.turnover.annualRate',
    kind: 'percent' as const,
    hint: 'Taxa anual sobre as vagas evitadas.',
  },
  {
    id: 'volume',
    label: 'Volume',
    fieldId: 'profile.dispensationsPerDay',
    kind: 'number' as const,
    hint: 'Dispensações por dia. O mesmo percentual vale para perdas, avarias, caixas e movimentação.',
  },
  {
    id: 'vendas',
    label: 'Vendas',
    fieldId: 'stock.ruptures.additionalMonthlySales',
    kind: 'money' as const,
    hint: 'Soma das vendas adicionais e da margem consultiva.',
  },
  {
    id: 'desconto',
    label: 'Taxa de desconto',
    fieldId: 'robot.discountRateAnnual',
    kind: 'percent' as const,
    hint: 'Taxa efetiva anual do VPL. Não entra no retorno anual simples.',
  },
  {
    id: 'disponibilidade',
    label: 'Disponibilidade',
    fieldId: 'robot.availabilityPct',
    kind: 'percent' as const,
    hint: 'Reduz dispensação, vendas e logística. A folha só zera se a disponibilidade chega a zero.',
  },
  {
    id: 'cobertura',
    label: 'Cobertura do estoque',
    fieldId: 'robot.automatedStockShare',
    kind: 'percent' as const,
    hint: 'Fração do estoque automatizado. É o mesmo driver da sensibilidade.',
  },
] as const;

export type LeverId = (typeof QUICK_LEVERS)[number]['id'];

const AUDIT_FIELDS: Record<string, string> = {
  payroll: 'people.payroll.monthlyCostPerPosition',
  futureHires: 'people.futureHires.monthlyCost',
  recruitment: 'people.recruitment.costPerHire',
  training: 'people.training.costPerPerson',
  turnover: 'people.turnover.annualRate',
  supervision: 'people.supervision.hoursSavedPerMonth',
  consultative: 'people.consultativeSales.marginPerHour',
  boxes: 'logistics.boxes.cyclesAvoidedPerMonth',
  shelvingCapex: 'logistics.shelving.avoidedAcquisition',
  shelvingResale: 'logistics.shelving.resaleValue',
  shelvingMaintenance: 'logistics.shelving.avoidedMaintenanceMonthly',
  spaceOccupancy: 'logistics.space.occupancyCostPerM2',
  spaceMargin: 'logistics.space.contributionPerM2Month',
  movement: 'logistics.movement.hoursSavedPerMonth',
  inventoryCount: 'logistics.inventoryCount.hoursSavedPerMonth',
  losses: 'profile.historicalLossesMonthly',
  shrinkage: 'stock.shrinkage.avoidedMonthly',
  ruptures: 'stock.ruptures.additionalMonthlySales',
  service: 'stock.serviceSpeed.additionalMonthlySales',
  workingCapital: 'stock.workingCapital.inventoryAfter',
  financialCost: 'stock.workingCapital.costOfCapitalAnnual',
  capex: 'robot.capex.equipment',
  opex: 'robot.opexMonthly.maintenance',
};

const FIELD_SECTION: Record<string, SectionId> = {
  'profile.historicalLossesMonthly': 'estoque',
};

export function fieldForAudit(id: string): string | null {
  return AUDIT_FIELDS[id] ?? null;
}

export function sectionForField(fieldId: string): SectionId {
  const mapped = FIELD_SECTION[fieldId];
  if (mapped) return mapped;
  if (fieldId.startsWith('profile.')) return 'perfil';
  if (fieldId.startsWith('people.')) return 'pessoas';
  if (fieldId.startsWith('logistics.')) return 'logistica';
  if (fieldId.startsWith('stock.')) return 'estoque';
  return 'investimento';
}

export function leverValue(inputs: Inputs, id: LeverId): number {
  if (id === 'investimento') return round2(sumRecord(inputs.robot.capex));
  if (id === 'opex') return round2(sumRecord(inputs.robot.opexMonthly));
  if (id === 'salarios') return inputs.people.payroll.monthlyCostPerPosition;
  if (id === 'turnover') return inputs.people.turnover.annualRate;
  if (id === 'volume') return inputs.profile.dispensationsPerDay;
  if (id === 'vendas') return salesTotal(inputs);
  if (id === 'disponibilidade') return inputs.robot.availabilityPct;
  if (id === 'cobertura') return inputs.robot.automatedStockShare;
  return inputs.robot.discountRateAnnual;
}

export function leverDelta(current: Inputs, anchor: Inputs, id: LeverId): number | null {
  const base = leverValue(anchor, id);
  const now = leverValue(current, id);
  if (base === 0) return now === 0 ? 0 : null;
  return now / base - 1;
}

const LEVER_DRIVER: Record<LeverId, SensitivityDriver> = {
  investimento: 'investimento',
  opex: 'opex',
  salarios: 'maoDeObra',
  turnover: 'turnover',
  volume: 'volume',
  vendas: 'vendas',
  desconto: 'desconto',
  disponibilidade: 'disponibilidade',
  cobertura: 'cobertura',
};

export function withLeverValue(current: Inputs, anchor: Inputs, id: LeverId, absolute: number): Inputs {
  const target = Math.max(0, absolute);
  const base = leverValue(anchor, id);
  if (!(base > 0)) return seedEmptyLever(current, id, target);
  return projectDriver(current, anchor, LEVER_DRIVER[id], target / base);
}

export function reanchor(anchor: Inputs, previous: Inputs, next: Inputs): Inputs {
  let result = structuredClone(next);
  for (const lever of QUICK_LEVERS) {
    if (sameLever(previous, next, lever.id)) result = copyLever(result, anchor, lever.id);
  }
  return result;
}

export function leversDiffer(left: Inputs, right: Inputs): boolean {
  return QUICK_LEVERS.some((lever) => !sameLever(left, right, lever.id));
}

export function nudgeLever(current: Inputs, anchor: Inputs, id: LeverId, direction: -1 | 1): Inputs {
  const base = leverValue(anchor, id);
  if (!(base > 0)) return current;
  const delta = leverDelta(current, anchor, id) ?? 0;
  if (direction === 1 && delta >= ADJUST_MAX - 1e-9) return current;
  if (direction === -1 && delta <= ADJUST_MIN + 1e-9) return current;
  let next = round2(delta + direction * ADJUST_STEP);
  if (direction === 1 && delta < ADJUST_MAX && next > ADJUST_MAX) next = ADJUST_MAX;
  if (direction === -1 && delta > ADJUST_MIN && next < ADJUST_MIN) next = ADJUST_MIN;
  return withLeverValue(current, anchor, id, base * (1 + next));
}

function seedEmptyLever(current: Inputs, id: LeverId, target: number): Inputs {
  if (id === 'investimento') {
    return { ...current, robot: { ...current.robot, capex: { ...current.robot.capex, equipment: target } } };
  }
  if (id === 'opex') {
    return {
      ...current,
      robot: { ...current.robot, opexMonthly: { ...current.robot.opexMonthly, maintenance: target } },
    };
  }
  if (id === 'salarios') {
    return {
      ...current,
      people: { ...current.people, payroll: { ...current.people.payroll, monthlyCostPerPosition: target } },
    };
  }
  if (id === 'turnover') {
    return { ...current, people: { ...current.people, turnover: { ...current.people.turnover, annualRate: target } } };
  }
  if (id === 'volume') return { ...current, profile: { ...current.profile, dispensationsPerDay: target } };
  if (id === 'vendas') {
    return {
      ...current,
      stock: { ...current.stock, ruptures: { ...current.stock.ruptures, additionalMonthlySales: target } },
    };
  }
  if (id === 'disponibilidade') {
    return { ...current, robot: { ...current.robot, availabilityPct: Math.min(1, target) } };
  }
  if (id === 'cobertura') {
    return { ...current, robot: { ...current.robot, automatedStockShare: Math.min(1, target) } };
  }
  return { ...current, robot: { ...current.robot, discountRateAnnual: target } };
}

function sumRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0);
}

function salesTotal(inputs: Inputs): number {
  const space =
    inputs.logistics.space.mode === 'margem'
      ? inputs.logistics.space.m2Freed * inputs.logistics.space.contributionPerM2Month
      : 0;
  return (
    inputs.stock.ruptures.additionalMonthlySales +
    inputs.stock.serviceSpeed.additionalMonthlySales +
    inputs.stock.abandonment.additionalMonthlySales +
    inputs.people.consultativeSales.hoursFreedPerMonth * inputs.people.consultativeSales.marginPerHour +
    space
  );
}

function sameLever(left: Inputs, right: Inputs, id: LeverId): boolean {
  const a = leverSlice(left, id);
  const b = leverSlice(right, id);
  return a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) < 0.001);
}

function leverSlice(inputs: Inputs, id: LeverId): number[] {
  if (id === 'investimento') {
    return [...Object.values(inputs.robot.capex), inputs.logistics.shelving.avoidedAcquisition];
  }
  if (id === 'opex') return Object.values(inputs.robot.opexMonthly);
  if (id === 'salarios') {
    return [
      inputs.people.payroll.monthlyCostPerPosition,
      inputs.people.supervision.costPerHour,
      inputs.logistics.movement.costPerHour,
      inputs.logistics.inventoryCount.costPerHour,
      inputs.people.turnover.costPerReplacement,
    ];
  }
  if (id === 'turnover') return [inputs.people.turnover.annualRate];
  if (id === 'volume') {
    return [
      inputs.profile.dispensationsPerDay,
      inputs.profile.historicalLossesMonthly,
      inputs.stock.losses.projectedLossesMonthly,
      inputs.stock.shrinkage.avoidedMonthly,
      inputs.logistics.boxes.cyclesAvoidedPerMonth,
      inputs.logistics.movement.hoursSavedPerMonth,
    ];
  }
  if (id === 'vendas') return [salesTotal(inputs)];
  if (id === 'disponibilidade') return [inputs.robot.availabilityPct];
  if (id === 'cobertura') return [inputs.robot.automatedStockShare];
  return [inputs.robot.discountRateAnnual];
}

function copyLever(target: Inputs, source: Inputs, id: LeverId): Inputs {
  return projectDriver(target, source, LEVER_DRIVER[id], 1);
}
