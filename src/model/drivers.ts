import { occupancyRate } from './normalize';
import { clamp, round2 } from './round';
import type { Inputs, SensitivityDriver } from './types';

export const DRIVER_IDS: SensitivityDriver[] = [
  'investimento',
  'opex',
  'maoDeObra',
  'turnover',
  'volume',
  'vendas',
  'desconto',
  'disponibilidade',
  'cobertura',
];

const QUICK_TO_DRIVER = {
  investimento: 'investimento',
  opex: 'opex',
  salarios: 'maoDeObra',
  turnover: 'turnover',
  volume: 'volume',
  vendas: 'vendas',
  desconto: 'desconto',
  disponibilidade: 'disponibilidade',
  cobertura: 'cobertura',
} as const;

export type QuickDriverId = keyof typeof QUICK_TO_DRIVER;

export function driverForQuick(id: QuickDriverId): SensitivityDriver {
  return QUICK_TO_DRIVER[id];
}

/** Mesma transformação usada pela sensibilidade e pelo ajuste rápido. */
export function applyDriver(inputs: Inputs, driver: SensitivityDriver, factor: number): Inputs {
  return projectDriver(inputs, inputs, driver, factor);
}

export function projectDriver(
  current: Inputs,
  anchor: Inputs,
  driver: SensitivityDriver,
  factor: number,
): Inputs {
  const next = structuredClone(current);
  if (driver === 'investimento') {
    const base = sumRecord(anchor.robot.capex);
    const target = round2(base * factor);
    next.robot.capex =
      base > 0
        ? scaleRecord(anchor.robot.capex, factor, target)
        : { ...anchor.robot.capex, equipment: target };
    next.logistics = {
      ...next.logistics,
      shelving: {
        ...next.logistics.shelving,
        avoidedAcquisition:
          factor > 0 ? round2(anchor.logistics.shelving.avoidedAcquisition * factor) : anchor.logistics.shelving.avoidedAcquisition,
      },
    };
    return next;
  }
  if (driver === 'opex') {
    const base = sumRecord(anchor.robot.opexMonthly);
    const target = round2(base * factor);
    next.robot.opexMonthly =
      base > 0
        ? scaleRecord(anchor.robot.opexMonthly, factor, target)
        : { ...anchor.robot.opexMonthly, maintenance: target };
    return next;
  }
  if (driver === 'maoDeObra') {
    next.people = {
      ...next.people,
      payroll: {
        ...next.people.payroll,
        monthlyCostPerPosition: round2(anchor.people.payroll.monthlyCostPerPosition * factor),
        benefitsPerPosition: round2(anchor.people.payroll.benefitsPerPosition * factor),
      },
      futureHires: {
        ...next.people.futureHires,
        hires: next.people.futureHires.hires.map((hire, index) => {
          const source = anchor.people.futureHires.hires[index] ?? hire;
          return { ...hire, monthlyCost: round2(source.monthlyCost * factor) };
        }),
      },
      recruitment: {
        ...next.people.recruitment,
        costPerHire: round2(anchor.people.recruitment.costPerHire * factor),
      },
      training: {
        ...next.people.training,
        costPerPerson: round2(anchor.people.training.costPerPerson * factor),
      },
      turnover: {
        ...next.people.turnover,
        costPerReplacement: round2(anchor.people.turnover.costPerReplacement * factor),
        components: {
          recruitment: round2(anchor.people.turnover.components.recruitment * factor),
          replacementTraining: round2(anchor.people.turnover.components.replacementTraining * factor),
          adaptationLoss: round2(anchor.people.turnover.components.adaptationLoss * factor),
          termination: round2(anchor.people.turnover.components.termination * factor),
          supervision: round2(anchor.people.turnover.components.supervision * factor),
        },
      },
      supervision: {
        ...next.people.supervision,
        costPerHour: round2(anchor.people.supervision.costPerHour * factor),
      },
      reallocatedHours: {
        ...next.people.reallocatedHours,
        costReductionMonthly: round2(anchor.people.reallocatedHours.costReductionMonthly * factor),
        incrementalMarginMonthly: round2(anchor.people.reallocatedHours.incrementalMarginMonthly * factor),
      },
    };
    next.logistics = {
      ...next.logistics,
      movement: {
        ...next.logistics.movement,
        costPerHour: round2(anchor.logistics.movement.costPerHour * factor),
      },
      inventoryCount: {
        ...next.logistics.inventoryCount,
        costPerHour: round2(anchor.logistics.inventoryCount.costPerHour * factor),
      },
    };
    return next;
  }
  if (driver === 'turnover') {
    next.people = {
      ...next.people,
      turnover: {
        ...next.people.turnover,
        annualRate: anchor.people.turnover.annualRate * factor,
      },
    };
    return next;
  }
  if (driver === 'volume') {
    const base = anchor.profile.dispensationsPerDay;
    if (!(base > 0)) {
      next.profile = { ...next.profile, dispensationsPerDay: round2(base * factor) };
      return next;
    }
    const applied = base * factor;
    const ratio = applied / base;
    next.profile = {
      ...next.profile,
      dispensationsPerDay: round2(anchor.profile.dispensationsPerDay * ratio),
      historicalLossesMonthly: round2(anchor.profile.historicalLossesMonthly * ratio),
    };
    next.stock = {
      ...next.stock,
      losses: {
        ...next.stock.losses,
        projectedLossesMonthly: round2(anchor.stock.losses.projectedLossesMonthly * ratio),
        expiryMonthly: round2(anchor.stock.losses.expiryMonthly * ratio),
        damageMonthly: round2(anchor.stock.losses.damageMonthly * ratio),
        missingMonthly: round2(anchor.stock.losses.missingMonthly * ratio),
        errorsMonthly: round2(anchor.stock.losses.errorsMonthly * ratio),
      },
      shrinkage: {
        ...next.stock.shrinkage,
        avoidedMonthly: round2(anchor.stock.shrinkage.avoidedMonthly * ratio),
      },
    };
    next.logistics = {
      ...next.logistics,
      boxes: {
        ...next.logistics.boxes,
        cyclesAvoidedPerMonth: round2(anchor.logistics.boxes.cyclesAvoidedPerMonth * ratio),
      },
      movement: {
        ...next.logistics.movement,
        hoursSavedPerMonth: round2(anchor.logistics.movement.hoursSavedPerMonth * ratio),
      },
    };
    return next;
  }
  if (driver === 'vendas') {
    const ruptures = anchor.stock.ruptures.additionalMonthlySales;
    const service = anchor.stock.serviceSpeed.additionalMonthlySales;
    const abandonment = anchor.stock.abandonment.additionalMonthlySales;
    const consultative =
      anchor.people.consultativeSales.hoursFreedPerMonth * anchor.people.consultativeSales.marginPerHour;
    const space =
      anchor.logistics.space.mode === 'margem'
        ? anchor.logistics.space.m2Freed * anchor.logistics.space.contributionPerM2Month
        : 0;
    const base = ruptures + service + abandonment + consultative + space;
    if (!(base > 0)) {
      next.stock = {
        ...next.stock,
        ruptures: { ...next.stock.ruptures, additionalMonthlySales: round2(ruptures * factor) },
      };
      return next;
    }
    next.stock = {
      ...next.stock,
      ruptures: { ...next.stock.ruptures, additionalMonthlySales: round2(ruptures * factor) },
      serviceSpeed: { ...next.stock.serviceSpeed, additionalMonthlySales: round2(service * factor) },
      abandonment: { ...next.stock.abandonment, additionalMonthlySales: round2(abandonment * factor) },
    };
    next.people = {
      ...next.people,
      consultativeSales: {
        ...next.people.consultativeSales,
        marginPerHour: round2(anchor.people.consultativeSales.marginPerHour * factor),
      },
    };
    if (anchor.logistics.space.mode === 'margem') {
      next.logistics = {
        ...next.logistics,
        space: {
          ...next.logistics.space,
          contributionPerM2Month: round2(anchor.logistics.space.contributionPerM2Month * factor),
        },
      };
    }
    return next;
  }
  if (driver === 'desconto') {
    next.robot = { ...next.robot, discountRateAnnual: anchor.robot.discountRateAnnual * factor };
    return next;
  }
  if (driver === 'disponibilidade') {
    next.robot = {
      ...next.robot,
      availabilityPct: clamp(anchor.robot.availabilityPct * factor, 0, 1),
    };
    return next;
  }
  next.robot = {
    ...next.robot,
    automatedStockShare: clamp((anchor.robot.automatedStockShare ?? 1) * factor, 0, 1),
  };
  return next;
}

export function syncOccupancy(inputs: Inputs, value: number): Inputs {
  return {
    ...inputs,
    profile: { ...inputs.profile, occupancyCostPerM2: value },
    logistics: {
      ...inputs.logistics,
      space: { ...inputs.logistics.space, occupancyCostPerM2: value },
    },
  };
}

export function readOccupancy(inputs: Inputs): number {
  return occupancyRate(inputs);
}

function sumRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0);
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
