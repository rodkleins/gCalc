import { round2 } from './round';
import type { SectionId } from './storage';
import type { Inputs } from './types';

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
    label: 'Salários',
    fieldId: 'people.payroll.monthlyCostPerPosition',
    kind: 'money' as const,
    hint: 'Custo completo de cada vaga evitada.',
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
    hint: 'Taxa efetiva anual do VPL. Não entra no ROI.',
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
  return inputs.robot.discountRateAnnual;
}

export function leverDelta(current: Inputs, anchor: Inputs, id: LeverId): number | null {
  const base = leverValue(anchor, id);
  const now = leverValue(current, id);
  if (base === 0) return now === 0 ? 0 : null;
  return now / base - 1;
}

export function withLeverValue(current: Inputs, anchor: Inputs, id: LeverId, absolute: number): Inputs {
  const target = Math.max(0, absolute);
  if (id === 'investimento') return applyScale(current, anchor.robot.capex, target, 'capex');
  if (id === 'opex') return applyScale(current, anchor.robot.opexMonthly, target, 'opex');
  if (id === 'salarios') {
    return {
      ...current,
      people: { ...current.people, payroll: { ...current.people.payroll, monthlyCostPerPosition: target } },
    };
  }
  if (id === 'turnover') {
    return {
      ...current,
      people: { ...current.people, turnover: { ...current.people.turnover, annualRate: target } },
    };
  }
  if (id === 'volume') return applyVolume(current, anchor, target);
  if (id === 'vendas') return applySales(current, anchor, target);
  return { ...current, robot: { ...current.robot, discountRateAnnual: target } };
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

function sumRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0);
}

function salesTotal(inputs: Inputs): number {
  return (
    inputs.stock.ruptures.additionalMonthlySales +
    inputs.stock.serviceSpeed.additionalMonthlySales +
    inputs.people.consultativeSales.hoursFreedPerMonth * inputs.people.consultativeSales.marginPerHour
  );
}

function scaleRecord<T extends Record<string, number>>(record: T, factor: number, target: number): T {
  const next: Record<string, number> = {};
  const keys = Object.keys(record);
  for (const key of keys) next[key] = round2(record[key] * factor);
  if (keys.length === 0) return next as T;
  const key = keys.reduce((best, current) => (record[current] > record[best] ? current : best), keys[0]);
  const others = keys.reduce((total, current) => (current === key ? total : total + next[current]), 0);
  next[key] = Math.max(0, round2(target - others));
  return next as T;
}

function applyScale(
  current: Inputs,
  anchorRecord: Inputs['robot']['capex'] | Inputs['robot']['opexMonthly'],
  target: number,
  kind: 'capex' | 'opex',
): Inputs {
  const base = sumRecord(anchorRecord);
  const scaled =
    base > 0
      ? scaleRecord(anchorRecord, target / base, target)
      : { ...anchorRecord, [kind === 'capex' ? 'equipment' : 'maintenance']: target };
  if (kind === 'capex') {
    return { ...current, robot: { ...current.robot, capex: scaled as Inputs['robot']['capex'] } };
  }
  return { ...current, robot: { ...current.robot, opexMonthly: scaled as Inputs['robot']['opexMonthly'] } };
}

function applyVolume(current: Inputs, anchor: Inputs, dispensations: number): Inputs {
  const base = anchor.profile.dispensationsPerDay;
  const factor = base > 0 ? dispensations / base : 0;
  if (!(base > 0)) {
    return { ...current, profile: { ...current.profile, dispensationsPerDay: dispensations } };
  }
  return {
    ...current,
    profile: {
      ...current.profile,
      dispensationsPerDay: round2(anchor.profile.dispensationsPerDay * factor),
      historicalLossesMonthly: round2(anchor.profile.historicalLossesMonthly * factor),
    },
    stock: {
      ...current.stock,
      losses: {
        ...current.stock.losses,
        projectedLossesMonthly: round2(anchor.stock.losses.projectedLossesMonthly * factor),
      },
      shrinkage: {
        ...current.stock.shrinkage,
        avoidedMonthly: round2(anchor.stock.shrinkage.avoidedMonthly * factor),
      },
    },
    logistics: {
      ...current.logistics,
      boxes: {
        ...current.logistics.boxes,
        cyclesAvoidedPerMonth: round2(anchor.logistics.boxes.cyclesAvoidedPerMonth * factor),
      },
      movement: {
        ...current.logistics.movement,
        hoursSavedPerMonth: round2(anchor.logistics.movement.hoursSavedPerMonth * factor),
      },
    },
  };
}

function applySales(current: Inputs, anchor: Inputs, target: number): Inputs {
  const base = salesTotal(anchor);
  if (!(base > 0)) {
    return {
      ...current,
      stock: { ...current.stock, ruptures: { ...current.stock.ruptures, additionalMonthlySales: target } },
    };
  }
  const factor = target / base;
  return {
    ...current,
    stock: {
      ...current.stock,
      ruptures: {
        ...current.stock.ruptures,
        additionalMonthlySales: round2(anchor.stock.ruptures.additionalMonthlySales * factor),
      },
      serviceSpeed: {
        ...current.stock.serviceSpeed,
        additionalMonthlySales: round2(anchor.stock.serviceSpeed.additionalMonthlySales * factor),
      },
    },
    people: {
      ...current.people,
      consultativeSales: {
        ...current.people.consultativeSales,
        marginPerHour: round2(anchor.people.consultativeSales.marginPerHour * factor),
      },
    },
  };
}

function sameLever(left: Inputs, right: Inputs, id: LeverId): boolean {
  const a = leverSlice(left, id);
  const b = leverSlice(right, id);
  return a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) < 0.001);
}

function leverSlice(inputs: Inputs, id: LeverId): number[] {
  if (id === 'investimento') return Object.values(inputs.robot.capex);
  if (id === 'opex') return Object.values(inputs.robot.opexMonthly);
  if (id === 'salarios') return [inputs.people.payroll.monthlyCostPerPosition];
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
  if (id === 'vendas') {
    return [
      inputs.stock.ruptures.additionalMonthlySales,
      inputs.stock.serviceSpeed.additionalMonthlySales,
      inputs.people.consultativeSales.marginPerHour,
    ];
  }
  return [inputs.robot.discountRateAnnual];
}

function copyLever(target: Inputs, source: Inputs, id: LeverId): Inputs {
  if (id === 'investimento') return { ...target, robot: { ...target.robot, capex: { ...source.robot.capex } } };
  if (id === 'opex') return { ...target, robot: { ...target.robot, opexMonthly: { ...source.robot.opexMonthly } } };
  if (id === 'salarios') {
    return {
      ...target,
      people: {
        ...target.people,
        payroll: { ...target.people.payroll, monthlyCostPerPosition: source.people.payroll.monthlyCostPerPosition },
      },
    };
  }
  if (id === 'turnover') {
    return {
      ...target,
      people: {
        ...target.people,
        turnover: { ...target.people.turnover, annualRate: source.people.turnover.annualRate },
      },
    };
  }
  if (id === 'volume') return applyVolume(target, source, source.profile.dispensationsPerDay);
  if (id === 'vendas') return applySales(target, source, salesTotal(source));
  return { ...target, robot: { ...target.robot, discountRateAnnual: source.robot.discountRateAnnual } };
}
