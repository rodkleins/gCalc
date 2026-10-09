import type { Inputs, SpaceTreatment, TaxPolicy } from './types';

/** Completa simulações antigas com premissas neutras, sem alterar números já gravados. */
export function normalizeInputs(inputs: Inputs): Inputs {
  const next = structuredClone(inputs);

  next.assumptions = next.assumptions ?? { includePotential: false, viewMode: 'avancado' };
  next.assumptions.viewMode = next.assumptions.viewMode ?? 'avancado';

  next.profile.wageGrowthPctPerYear = next.profile.wageGrowthPctPerYear ?? 0;
  next.profile.opexInflationPctPerYear = next.profile.opexInflationPctPerYear ?? 0;
  next.profile.priceInflationPctPerYear = next.profile.priceInflationPctPerYear ?? 0;
  next.profile.moneyBasis = next.profile.moneyBasis ?? 'nominal';

  const payroll = next.people.payroll;
  payroll.chargesPct = payroll.chargesPct ?? 0;
  payroll.benefitsPerPosition = payroll.benefitsPerPosition ?? 0;
  payroll.costConfirmedFullyLoaded = payroll.costConfirmedFullyLoaded ?? true;
  next.people.journeyHoursPerMonth = next.people.journeyHoursPerMonth ?? 176;
  next.people.reallocatedHours = next.people.reallocatedHours ?? {
    enabled: false,
    confidence: 'potencial',
    hoursPerMonth: 0,
    monetization: 'nenhuma',
    costReductionMonthly: 0,
    incrementalMarginMonthly: 0,
    evidence: false,
  };

  const turnover = next.people.turnover;
  turnover.costMode = turnover.costMode ?? 'consolidado';
  turnover.components = turnover.components ?? {
    recruitment: 0,
    replacementTraining: 0,
    adaptationLoss: 0,
    termination: 0,
    supervision: 0,
  };

  const boxes = next.logistics.boxes;
  boxes.useDetailed = boxes.useDetailed ?? false;
  boxes.cyclesEnabled = boxes.cyclesEnabled ?? true;
  boxes.reverseTransportMonthly = boxes.reverseTransportMonthly ?? 0;
  boxes.reverseTransportEnabled = boxes.reverseTransportEnabled ?? false;
  boxes.sanitationMonthly = boxes.sanitationMonthly ?? 0;
  boxes.sanitationEnabled = boxes.sanitationEnabled ?? false;
  boxes.handlingMonthly = boxes.handlingMonthly ?? 0;
  boxes.handlingEnabled = boxes.handlingEnabled ?? false;
  boxes.lossReplacementMonthly = boxes.lossReplacementMonthly ?? 0;
  boxes.lossReplacementEnabled = boxes.lossReplacementEnabled ?? false;
  boxes.spaceMonthly = boxes.spaceMonthly ?? 0;
  boxes.spaceEnabled = boxes.spaceEnabled ?? false;

  next.logistics.shelving.stillRequired = next.logistics.shelving.stillRequired ?? false;
  next.logistics.shelving.removalCost = next.logistics.shelving.removalCost ?? 0;

  const space = next.logistics.space;
  space.treatment = space.treatment ?? treatmentFromMode(space.mode);
  space.contractUnchanged = space.contractUnchanged ?? false;
  space.avoidedRealEstate = space.avoidedRealEstate ?? 0;
  space.commercialEvidence = space.commercialEvidence ?? false;
  if (!(space.occupancyCostPerM2 > 0) && next.profile.occupancyCostPerM2 > 0) {
    space.occupancyCostPerM2 = next.profile.occupancyCostPerM2;
  }

  const losses = next.stock.losses;
  losses.useDetailed = losses.useDetailed ?? false;
  losses.expiryMonthly = losses.expiryMonthly ?? 0;
  losses.damageMonthly = losses.damageMonthly ?? 0;
  losses.missingMonthly = losses.missingMonthly ?? 0;
  losses.errorsMonthly = losses.errorsMonthly ?? 0;

  next.stock.abandonment = next.stock.abandonment ?? {
    enabled: false,
    confidence: 'potencial',
    independentEvidence: false,
    additionalMonthlySales: 0,
  };

  if (typeof next.stock.workingCapital.reductionProven !== 'boolean') {
    next.stock.workingCapital.reductionProven = false;
  }

  next.network = next.network ?? { enabled: false, sharedMonthlyCost: 0, stores: [] };
  next.network.stores = next.network.stores ?? [];
  next.network.sharedMonthlyCost = next.network.sharedMonthlyCost ?? 0;

  const robot = next.robot;
  robot.reorganizationEffectiveness = robot.reorganizationEffectiveness ?? 1;
  robot.automatedStockShare = robot.automatedStockShare ?? 1;
  robot.serviceLevel = robot.serviceLevel ?? 1;
  robot.conversionFactor = robot.conversionFactor ?? 1;
  robot.taxPolicy = robot.taxPolicy ?? policyFromFlag(robot.includeTax);
  robot.lossUtilizationLimit = robot.lossUtilizationLimit ?? 0;
  robot.taxCapacityMonthly = robot.taxCapacityMonthly ?? 0;
  robot.taxBenefitValidated = robot.taxBenefitValidated ?? false;
  robot.taxValidated = robot.taxValidated ?? false;
  robot.extraordinaryEventsTaxable = robot.extraordinaryEventsTaxable ?? true;
  robot.discountBasis = robot.discountBasis ?? next.profile.moneyBasis;
  robot.ramp = robot.ramp ?? { people: [1], logistics: [1], stock: [1], sales: [1] };
  robot.ramp.people = robot.ramp.people?.length ? robot.ramp.people : [1];
  robot.ramp.logistics = robot.ramp.logistics?.length ? robot.ramp.logistics : [1];
  robot.ramp.stock = robot.ramp.stock?.length ? robot.ramp.stock : [1];
  robot.ramp.sales = robot.ramp.sales?.length ? robot.ramp.sales : [1];
  robot.capexSchedule = robot.capexSchedule?.length ? robot.capexSchedule : [{ month: 0, share: 1 }];

  return next;
}

function treatmentFromMode(mode: Inputs['logistics']['space']['mode']): SpaceTreatment {
  return mode === 'margem' ? 'expansao_comercial' : 'ocupacao_evitavel';
}

function policyFromFlag(includeTax: boolean): TaxPolicy {
  return includeTax ? 'incremental_simplificado' : 'sem_impostos';
}

export function occupancyRate(inputs: Inputs): number {
  if (inputs.logistics.space.occupancyCostPerM2 > 0) return inputs.logistics.space.occupancyCostPerM2;
  return inputs.profile.occupancyCostPerM2;
}
