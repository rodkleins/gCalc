import { applyDriver, DRIVER_IDS } from './drivers';
import {
  annualizeMonthlyRate,
  discountedPayback,
  firstNonNegativeDiscountedMonth,
  firstNonNegativeMonth,
  irr,
  monthlyRateFromAnnual,
  npv,
  signChanges,
  simpleAnnualRoi,
  simplePayback,
} from './finance';
import { normalizeInputs, occupancyRate } from './normalize';
import { clamp, round2, sum } from './round';
import type {
  AuditLine,
  Confidence,
  EvalOptions,
  FinancingResult,
  Inputs,
  ModelResult,
  MonthDetail,
  NetworkStoreResult,
  ScenarioId,
  SensitivityDriver,
  SensitivityPoint,
  StoreType,
  TaxPolicy,
} from './types';
import { HORIZON_MONTHS } from './types';

interface Gate {
  included: boolean;
  reason: string;
  confidence: Confidence | 'nao_se_aplica';
}

interface SalesCandidate {
  id: string;
  label: string;
  module: string;
  formula: string;
  confidence: Confidence;
  gate: Gate;
  monthlyAt: (month: number) => number;
}

const SENSITIVITY_DELTAS = [-0.3, -0.15, 0, 0.15, 0.3];

function rampAt(curve: number[], month: number, goLive: number): number {
  if (month < goLive) return 0;
  if (!curve.length) return 1;
  const index = month - goLive;
  return clamp(index < curve.length ? curve[index] : curve[curve.length - 1], 0, 1);
}

function yearIndex(annualRate: number, month: number): number {
  if (!annualRate) return 1;
  return Math.pow(1 + annualRate, (month - 1) / 12);
}

function activeTaxPolicy(inputs: Inputs): TaxPolicy {
  if (!inputs.robot.includeTax) return 'sem_impostos';
  if (inputs.robot.taxPolicy === 'sem_impostos') return 'incremental_simplificado';
  return inputs.robot.taxPolicy;
}

export function evaluate(rawInputs: Inputs, options: EvalOptions = {}): ModelResult {
  const inputs = normalizeInputs(rawInputs);
  const scenario = options.scenario ?? 'base';
  const factors = inputs.scenarios[scenario];
  const storeType: StoreType = options.storeTypeOverride ?? inputs.profile.storeType;
  const laborFactor = options.laborFactor ?? 1;
  const turnoverFactor = options.turnoverFactor ?? 1;
  const salesMultiplier = (options.salesFactor ?? 1) * factors.salesFactor;
  const volumeFactor = options.volumeFactor ?? 1;
  const capexMultiplier = (options.capexFactor ?? 1) * factors.capexFactor;
  const benefitFactor = factors.benefitFactor;
  const goLive = clamp(Math.round(inputs.robot.goLiveMonth) || 1, 1, HORIZON_MONTHS);
  const includePotential = inputs.assumptions.includePotential;

  const dispensations = Math.max(0, inputs.profile.dispensationsPerDay * volumeFactor);
  const capacity = inputs.robot.capacityDispensationsPerDay;
  const coverage = dispensations <= 0 || capacity <= 0 ? (capacity <= 0 ? 0 : 1) : Math.min(1, capacity / dispensations);
  const availability = clamp(inputs.robot.availabilityPct, 0, 1);
  const capture = coverage * availability;
  const payrollCapture = availability <= 0 ? 0 : clamp(inputs.robot.reorganizationEffectiveness, 0, 1);
  const inventoryCapture = availability <= 0 ? 0 : clamp(inputs.robot.automatedStockShare, 0, 1);
  const salesCapture =
    coverage * availability * clamp(inputs.robot.serviceLevel, 0, 1) * clamp(inputs.robot.conversionFactor, 0, 1);
  const peopleRamp = (month: number) => rampAt(inputs.robot.ramp.people, month, goLive);
  const logisticsRamp = (month: number) => rampAt(inputs.robot.ramp.logistics, month, goLive);
  const stockRamp = (month: number) => rampAt(inputs.robot.ramp.stock, month, goLive);
  const salesRamp = (month: number) => rampAt(inputs.robot.ramp.sales, month, goLive);
  const wageIndex = (month: number) => yearIndex(inputs.profile.wageGrowthPctPerYear, month);
  const priceIndex = (month: number) => yearIndex(inputs.profile.priceInflationPctPerYear, month);
  const roleHeadcount = inputs.profile.roles.reduce((total, role) => total + Math.max(0, role.headcount), 0);
  const rolePayroll = inputs.profile.roles.reduce(
    (total, role) => total + Math.max(0, role.headcount) * Math.max(0, role.monthlyCost),
    0,
  );
  const requestedPositions = Math.max(0, inputs.people.payroll.positionsReduced);
  const positions = roleHeadcount > 0 ? Math.min(requestedPositions, roleHeadcount) : requestedPositions;
  const fullPositionCost =
    inputs.people.payroll.monthlyCostPerPosition * (1 + inputs.people.payroll.chargesPct) +
    inputs.people.payroll.benefitsPerPosition;
  const journey = Math.max(1, inputs.people.journeyHoursPerMonth || 176);
  const remainingHeadcount = roleHeadcount > 0 ? Math.max(0, roleHeadcount - positions) : Number.POSITIVE_INFINITY;
  const hourBudget = remainingHeadcount * journey;
  const claimedHours =
    (inputs.people.supervision.alreadyCountedInPayroll ? 0 : Math.max(0, inputs.people.supervision.hoursSavedPerMonth)) +
    (inputs.logistics.movement.alreadyCountedInPayroll ? 0 : Math.max(0, inputs.logistics.movement.hoursSavedPerMonth)) +
    Math.max(0, inputs.logistics.inventoryCount.hoursSavedPerMonth) +
    Math.max(0, inputs.people.consultativeSales.hoursFreedPerMonth) +
    Math.max(0, inputs.people.reallocatedHours.hoursPerMonth);
  const hourScale = !Number.isFinite(hourBudget) || claimedHours <= hourBudget || claimedHours <= 0 ? 1 : hourBudget / claimedHours;
  const schedule = normalizeSchedule(inputs.robot.capexSchedule);
  const shareAt = (month: number) =>
    schedule.filter((tranche) => tranche.month === month).reduce((total, tranche) => total + tranche.share, 0);

  const grossCapex = round2(sum(Object.values(inputs.robot.capex)) * capexMultiplier);
  const monthlyOpex = round2(sum(Object.values(inputs.robot.opexMonthly)) * factors.opexFactor);
  const monthlyRate = monthlyRateFromAnnual(inputs.robot.discountRateAnnual);

  const shelvingGate = gateBenefit(
    inputs.logistics.shelving.enabled,
    inputs.logistics.shelving.confidence,
    includePotential,
    null,
  );

  const shelvingStillNeeded = inputs.logistics.shelving.stillRequired;
  const avoidedShelving =
    storeType === 'nova' && shelvingGate.included && !shelvingStillNeeded
      ? round2(inputs.logistics.shelving.avoidedAcquisition * capexMultiplier)
      : 0;
  const realEstateGate = gateBenefit(
    inputs.logistics.space.enabled && inputs.logistics.space.treatment === 'investimento_imobiliario',
    inputs.logistics.space.confidence,
    includePotential,
    null,
  );
  const avoidedRealEstate =
    storeType === 'nova' && realEstateGate.included
      ? round2(inputs.logistics.space.avoidedRealEstate * capexMultiplier)
      : 0;
  const avoidedCapex = round2(avoidedShelving + avoidedRealEstate);
  const netInvestment = round2(grossCapex - avoidedCapex);
  const openingShare = shareAt(0);
  const openingCash = netInvestment === 0 ? 0 : round2(-netInvestment * openingShare);

  const depreciationMonths = Math.max(1, Math.round(inputs.robot.depreciationYears * 12));

  const growthAt = (month: number) =>
    Math.pow(1 + inputs.profile.demandGrowthPctPerYear, (month - 1) / 12);

  const volumeGrowth = (month: number) => volumeFactor * growthAt(month);

  const payrollGate = gateBenefit(
    inputs.people.payroll.enabled,
    inputs.people.payroll.confidence,
    includePotential,
    null,
  );
  const hiresGate = gateBenefit(
    inputs.people.futureHires.enabled,
    inputs.people.futureHires.confidence,
    includePotential,
    null,
  );
  const recruitmentInsideTurnover =
    inputs.people.recruitment.includedInTurnoverCost ||
    (inputs.people.turnover.costMode === 'detalhado' && inputs.people.turnover.components.recruitment > 0);
  const trainingInsideTurnover =
    inputs.people.training.includedInReplacementCost ||
    (inputs.people.turnover.costMode === 'detalhado' && inputs.people.turnover.components.replacementTraining > 0);
  const recruitmentGate = gateBenefit(
    inputs.people.recruitment.enabled,
    inputs.people.recruitment.confidence,
    includePotential,
    recruitmentInsideTurnover
      ? 'Recrutamento e seleção já estão no custo por substituição do turnover. Não entram de novo.'
      : null,
  );
  const trainingGate = gateBenefit(
    inputs.people.training.enabled,
    inputs.people.training.confidence,
    includePotential,
    trainingInsideTurnover
      ? 'Treinamento inicial já está no custo por substituição. Não entra de novo.'
      : null,
  );
  const turnoverGate = gateBenefit(
    inputs.people.turnover.enabled,
    inputs.people.turnover.confidence,
    includePotential,
    null,
  );
  const supervisionGate = gateBenefit(
    inputs.people.supervision.enabled,
    inputs.people.supervision.confidence,
    includePotential,
    inputs.people.supervision.alreadyCountedInPayroll
      ? 'Horas de supervisão já foram retiradas na redução de folha. Não são monetizadas de novo.'
      : null,
  );
  const boxesGate = gateBenefit(
    inputs.logistics.boxes.enabled,
    inputs.logistics.boxes.confidence,
    includePotential,
    inputs.logistics.boxes.processValidated
      ? null
      : 'Processo logístico não validado. O robô não elimina automaticamente a caixa do fornecedor.',
  );
  const space = inputs.logistics.space;
  const spaceBlocked =
    space.treatment === 'sem_monetizacao'
      ? 'Área liberada sem monetização. Fica registrada e não entra no caixa.'
      : space.treatment === 'investimento_imobiliario'
        ? 'O efeito desta área é investimento imobiliário evitado, não um aluguel mensal.'
        : space.contractUnchanged && space.mode !== 'margem' && space.treatment !== 'expansao_comercial'
          ? 'O contrato de ocupação não muda. Aluguel e custo de ocupação não entram.'
          : space.treatment === 'expansao_comercial' && space.mode !== 'margem' && !space.commercialEvidence
            ? 'Expansão comercial sem evidência de margem incremental. Não entra no caixa.'
            : null;
  const spaceGate = gateBenefit(
    inputs.logistics.space.enabled,
    inputs.logistics.space.confidence,
    includePotential,
    spaceBlocked,
  );
  const movementGate = gateBenefit(
    inputs.logistics.movement.enabled,
    inputs.logistics.movement.confidence,
    includePotential,
    inputs.logistics.movement.alreadyCountedInPayroll
      ? 'Horas de movimentação já foram retiradas na redução de folha. Não são monetizadas de novo.'
      : null,
  );
  const countGate = gateBenefit(
    inputs.logistics.inventoryCount.enabled,
    inputs.logistics.inventoryCount.confidence,
    includePotential,
    null,
  );
  const lossesGate = gateBenefit(
    inputs.stock.losses.enabled,
    inputs.stock.losses.confidence,
    includePotential,
    null,
  );
  const shrinkageGate = gateBenefit(
    inputs.stock.shrinkage.enabled,
    inputs.stock.shrinkage.confidence,
    includePotential,
    inputs.stock.losses.useDetailed && inputs.stock.losses.enabled
      ? 'Avarias, extravios e erros já estão no detalhamento de perdas. Não entram de novo.'
      : null,
  );
  const capitalGate = gateBenefit(
    inputs.stock.workingCapital.enabled,
    inputs.stock.workingCapital.confidence,
    includePotential,
    null,
  );

  const payrollAmount = (month: number) => {
    if (!payrollGate.included || month < Math.max(goLive, inputs.people.payroll.startMonth)) return 0;
    const raw =
      positions * fullPositionCost * laborFactor * payrollCapture * peopleRamp(month) * wageIndex(month) * benefitFactor;
    const cap = roleHeadcount > 0 ? rolePayroll * laborFactor * wageIndex(month) * benefitFactor : raw;
    return round2(Math.min(raw, cap));
  };

  const reallocatedAmount = (month: number) => {
    const item = inputs.people.reallocatedHours;
    if (!item.enabled || month < goLive) return 0;
    if (item.confidence === 'potencial' && !includePotential) return 0;
    if (item.monetization === 'nenhuma') return 0;
    if (item.monetization === 'ganho_incremental' && !item.evidence) return 0;
    const base = item.monetization === 'reducao_custo' ? item.costReductionMonthly : item.incrementalMarginMonthly;
    return round2(base * hourScale * laborFactor * payrollCapture * peopleRamp(month) * wageIndex(month) * benefitFactor);
  };

  const activeFutureHeadcount = (month: number) => {
    if (!hiresGate.included || month < goLive) return 0;
    return inputs.people.futureHires.hires.reduce((total, hire) => {
      return month >= hire.month ? total + hire.headcount : total;
    }, 0);
  };

  const futureHireCost = (month: number) => {
    if (!hiresGate.included || month < goLive) return 0;
    const raw = inputs.people.futureHires.hires.reduce((total, hire) => {
      if (month < hire.month) return total;
      return total + hire.headcount * hire.monthlyCost * laborFactor;
    }, 0);
    return round2(raw * payrollCapture * peopleRamp(month) * wageIndex(month) * benefitFactor);
  };

  const replacementUnit = () => {
    const turnover = inputs.people.turnover;
    if (turnover.costMode === 'detalhado') {
      const parts = turnover.components;
      return parts.recruitment + parts.replacementTraining + parts.adaptationLoss + parts.termination + parts.supervision;
    }
    return turnover.costPerReplacement;
  };

  const turnoverAmount = (month: number) => {
    if (!turnoverGate.included || month < goLive) return 0;
    const opened =
      (payrollGate.included && month >= inputs.people.payroll.startMonth ? positions : 0) + activeFutureHeadcount(month);
    return round2(
      ((opened * inputs.people.turnover.annualRate * turnoverFactor * replacementUnit() * laborFactor) / 12) *
        payrollCapture *
        peopleRamp(month) *
        benefitFactor,
    );
  };

  const supervisionAmount = (month: number) => {
    if (!supervisionGate.included || month < goLive) return 0;
    return round2(
      inputs.people.supervision.hoursSavedPerMonth *
        hourScale *
        inputs.people.supervision.costPerHour *
        laborFactor *
        payrollCapture *
        peopleRamp(month) *
        wageIndex(month) *
        benefitFactor,
    );
  };

  const boxesMonthlyBase = () => {
    const boxes = inputs.logistics.boxes;
    if (!boxes.useDetailed) return boxes.cyclesAvoidedPerMonth * boxes.costPerCycle;
    let total = 0;
    if (boxes.cyclesEnabled) total += boxes.cyclesAvoidedPerMonth * boxes.costPerCycle;
    if (boxes.reverseTransportEnabled) total += boxes.reverseTransportMonthly;
    if (boxes.sanitationEnabled) total += boxes.sanitationMonthly;
    if (boxes.handlingEnabled) total += boxes.handlingMonthly;
    if (boxes.lossReplacementEnabled) total += boxes.lossReplacementMonthly;
    if (boxes.spaceEnabled) total += boxes.spaceMonthly;
    return total;
  };

  const boxesAmount = (month: number) => {
    if (!boxesGate.included || month < goLive) return 0;
    const cyclesPortion = inputs.logistics.boxes.useDetailed && !inputs.logistics.boxes.cyclesEnabled ? 0 : 1;
    const base = boxesMonthlyBase();
    const grown = inputs.logistics.boxes.useDetailed
      ? (cyclesPortion === 0 ? 0 : inputs.logistics.boxes.cyclesEnabled ? inputs.logistics.boxes.cyclesAvoidedPerMonth * inputs.logistics.boxes.costPerCycle * volumeGrowth(month) : 0) +
        (inputs.logistics.boxes.reverseTransportEnabled ? inputs.logistics.boxes.reverseTransportMonthly : 0) +
        (inputs.logistics.boxes.sanitationEnabled ? inputs.logistics.boxes.sanitationMonthly : 0) +
        (inputs.logistics.boxes.handlingEnabled ? inputs.logistics.boxes.handlingMonthly : 0) +
        (inputs.logistics.boxes.lossReplacementEnabled ? inputs.logistics.boxes.lossReplacementMonthly : 0) +
        (inputs.logistics.boxes.spaceEnabled ? inputs.logistics.boxes.spaceMonthly : 0)
      : base * volumeGrowth(month);
    return round2(grown * capture * logisticsRamp(month) * benefitFactor);
  };

  const maintenanceAmount = (month: number) => {
    if (!shelvingGate.included || shelvingStillNeeded || storeType !== 'existente' || month < goLive) return 0;
    return round2(
      inputs.logistics.shelving.avoidedMaintenanceMonthly *
        logisticsRamp(month) *
        yearIndex(inputs.profile.opexInflationPctPerYear, month) *
        benefitFactor,
    );
  };

  const spaceIsMargin =
    inputs.logistics.space.mode === 'margem' || inputs.logistics.space.treatment === 'expansao_comercial';
  const spaceAmount = (month: number) => {
    if (!spaceGate.included || month < goLive || spaceIsMargin) return 0;
    return round2(
      inputs.logistics.space.m2Freed * occupancyRate(inputs) * logisticsRamp(month) * benefitFactor,
    );
  };
  const spaceMarginAmount = (month: number) => {
    if (!spaceGate.included || month < goLive || !spaceIsMargin) return 0;
    return round2(
      inputs.logistics.space.m2Freed *
        inputs.logistics.space.contributionPerM2Month *
        logisticsRamp(month) *
        priceIndex(month) *
        benefitFactor *
        salesMultiplier,
    );
  };

  const movementAmount = (month: number) => {
    if (!movementGate.included || month < goLive) return 0;
    return round2(
      inputs.logistics.movement.hoursSavedPerMonth *
        hourScale *
        inputs.logistics.movement.costPerHour *
        laborFactor *
        volumeGrowth(month) *
        capture *
        logisticsRamp(month) *
        wageIndex(month) *
        benefitFactor,
    );
  };

  const countAmount = (month: number) => {
    if (!countGate.included || month < goLive) return 0;
    return round2(
      inputs.logistics.inventoryCount.hoursSavedPerMonth *
        hourScale *
        inputs.logistics.inventoryCount.costPerHour *
        laborFactor *
        inventoryCapture *
        logisticsRamp(month) *
        wageIndex(month) *
        benefitFactor,
    );
  };

  const historicalLosses = (month: number) =>
    round2(inputs.profile.historicalLossesMonthly * volumeGrowth(month) * inventoryCapture * stockRamp(month));
  const projectedLosses = (month: number) =>
    round2(inputs.stock.losses.projectedLossesMonthly * volumeGrowth(month) * inventoryCapture * stockRamp(month));

  const lossesAmount = (month: number) => {
    if (!lossesGate.included || month < goLive) return 0;
    if (inputs.stock.losses.useDetailed) {
      const parts = inputs.stock.losses;
      return round2(
        (parts.expiryMonthly + parts.damageMonthly + parts.missingMonthly + parts.errorsMonthly) *
          volumeGrowth(month) *
          inventoryCapture *
          stockRamp(month) *
          priceIndex(month) *
          benefitFactor,
      );
    }
    return round2(Math.max(0, historicalLosses(month) - projectedLosses(month)) * benefitFactor);
  };

  const shrinkageAmount = (month: number) => {
    if (!shrinkageGate.included || month < goLive) return 0;
    return round2(
      inputs.stock.shrinkage.avoidedMonthly *
        volumeGrowth(month) *
        inventoryCapture *
        stockRamp(month) *
        priceIndex(month) *
        benefitFactor,
    );
  };

  const marginOf = (sales: number, month: number) =>
    round2(
      sales *
        inputs.profile.contributionMarginPct *
        volumeGrowth(month) *
        salesCapture *
        salesRamp(month) *
        priceIndex(month) *
        benefitFactor *
        salesMultiplier,
    );

  const consultativeMonthly = (month: number) => {
    if (month < goLive) return 0;
    return round2(
      inputs.people.consultativeSales.hoursFreedPerMonth *
        hourScale *
        inputs.people.consultativeSales.marginPerHour *
        growthAt(month) *
        salesCapture *
        salesRamp(month) *
        priceIndex(month) *
        benefitFactor *
        salesMultiplier,
    );
  };

  const salesCandidates: SalesCandidate[] = [
    {
      id: 'consultative',
      label: 'Venda consultiva',
      module: 'Pessoas',
      formula: 'Horas liberadas × margem por hora, só com evidência independente da economia de folha.',
      confidence: inputs.people.consultativeSales.confidence,
      gate: gateBenefit(
        inputs.people.consultativeSales.enabled,
        inputs.people.consultativeSales.confidence,
        includePotential,
        inputs.people.consultativeSales.independentEvidence
          ? null
          : 'Sem evidência independente. As mesmas horas não podem virar folha economizada e venda ao mesmo tempo.',
      ),
      monthlyAt: consultativeMonthly,
    },
    {
      id: 'ruptures',
      label: 'Margem por menos rupturas',
      module: 'Estoque',
      formula: 'Vendas adicionais × margem de contribuição, só com evidência independente.',
      confidence: inputs.stock.ruptures.confidence,
      gate: gateBenefit(
        inputs.stock.ruptures.enabled,
        inputs.stock.ruptures.confidence,
        includePotential,
        inputs.stock.ruptures.independentEvidence
          ? null
          : 'Sem evidência independente de venda recuperada por menor ruptura.',
      ),
      monthlyAt: (month) => marginOf(inputs.stock.ruptures.additionalMonthlySales, month),
    },
    {
      id: 'service',
      label: 'Margem por atendimento mais rápido',
      module: 'Estoque',
      formula: 'Vendas adicionais × margem de contribuição, só com evidência independente.',
      confidence: inputs.stock.serviceSpeed.confidence,
      gate: gateBenefit(
        inputs.stock.serviceSpeed.enabled,
        inputs.stock.serviceSpeed.confidence,
        includePotential,
        inputs.stock.serviceSpeed.independentEvidence
          ? null
          : 'Sem evidência independente de venda adicional por velocidade de atendimento.',
      ),
      monthlyAt: (month) => marginOf(inputs.stock.serviceSpeed.additionalMonthlySales, month),
    },
    {
      id: 'abandonment',
      label: 'Margem por menos abandono',
      module: 'Estoque',
      formula: 'Vendas que deixam de ser abandonadas × margem de contribuição, com evidência própria.',
      confidence: inputs.stock.abandonment.confidence,
      gate: gateBenefit(
        inputs.stock.abandonment.enabled,
        inputs.stock.abandonment.confidence,
        includePotential,
        inputs.stock.abandonment.independentEvidence
          ? null
          : 'Sem evidência independente de venda recuperada por menor abandono.',
      ),
      monthlyAt: (month) => marginOf(inputs.stock.abandonment.additionalMonthlySales, month),
    },
    {
      id: 'spaceMargin',
      label: 'Margem da área liberada',
      module: 'Logística',
      formula: 'm² liberados × margem de contribuição mensal por m². Não soma com outras vendas sem independência.',
      confidence: inputs.logistics.space.confidence,
      gate: spaceIsMargin
        ? spaceGate
        : {
            included: false,
            confidence: inputs.logistics.space.confidence,
            reason: 'A área não está em expansão comercial.',
          },
      monthlyAt: spaceMarginAmount,
    },
  ];

  const includedSales = salesCandidates.filter((candidate) => candidate.gate.included);
  let droppedSales = new Set<string>();
  if (includedSales.length > 1 && !inputs.stock.salesIndependenceConfirmed) {
    const ranked = [...includedSales].sort((a, b) => b.monthlyAt(HORIZON_MONTHS) - a.monthlyAt(HORIZON_MONTHS));
    droppedSales = new Set(ranked.slice(1).map((candidate) => candidate.id));
  }

  const salesIncluded = (id: string) =>
    salesCandidates.some((candidate) => candidate.id === id && candidate.gate.included && !droppedSales.has(id));

  const salesAmount = (month: number) =>
    round2(
      salesCandidates.reduce((total, candidate) => {
        if (!salesIncluded(candidate.id)) return total;
        return total + candidate.monthlyAt(month);
      }, 0),
    );

  const releaseBase = inputs.stock.workingCapital.reductionProven
    ? Math.max(0, inputs.profile.averageInventory - inputs.stock.workingCapital.inventoryAfter)
    : 0;
  const capitalRelease = capitalGate.included ? round2(releaseBase) : 0;
  const financialMonthly =
    capitalGate.included && inputs.stock.workingCapital.treatment === 'custo_financeiro'
      ? round2((releaseBase * inputs.stock.workingCapital.costOfCapitalAnnual * benefitFactor) / 12)
      : 0;
  const usePrincipal = capitalGate.included && inputs.stock.workingCapital.treatment === 'liberacao_caixa';
  const releaseMonth = clamp(Math.round(inputs.stock.workingCapital.releaseMonth) || goLive, 1, HORIZON_MONTHS);

  const operatingBenefit = (month: number) =>
    round2(
      payrollAmount(month) +
        futureHireCost(month) +
        turnoverAmount(month) +
        supervisionAmount(month) +
        boxesAmount(month) +
        maintenanceAmount(month) +
        spaceAmount(month) +
        movementAmount(month) +
        countAmount(month) +
        lossesAmount(month) +
        shrinkageAmount(month) +
        salesAmount(month) +
        reallocatedAmount(month) +
        (month >= goLive ? financialMonthly * stockRamp(month) * priceIndex(month) : 0),
    );

  const recruitmentEvents = (): Array<{ month: number; amount: number }> => {
    if (!recruitmentGate.included) return [];
    const events: Array<{ month: number; amount: number }> = [];
    const unit = round2(inputs.people.recruitment.costPerHire * laborFactor);
    if (storeType === 'nova' && payrollGate.included) {
      events.push({
        month: Math.max(goLive, inputs.people.payroll.startMonth),
        amount: round2(inputs.people.payroll.positionsReduced * unit),
      });
    }
    if (hiresGate.included) {
      for (const hire of inputs.people.futureHires.hires) {
        events.push({
          month: Math.max(goLive, hire.month),
          amount: round2(hire.headcount * unit),
        });
      }
    }
    return events.filter((event) => event.amount !== 0 && event.month <= HORIZON_MONTHS);
  };

  const trainingEvents = (): Array<{ month: number; amount: number }> => {
    if (!trainingGate.included) return [];
    const events: Array<{ month: number; amount: number }> = [];
    const unit = round2(inputs.people.training.costPerPerson * laborFactor);
    if (storeType === 'nova' && payrollGate.included) {
      events.push({
        month: Math.max(goLive, inputs.people.payroll.startMonth),
        amount: round2(inputs.people.payroll.positionsReduced * unit),
      });
    }
    if (hiresGate.included) {
      for (const hire of inputs.people.futureHires.hires) {
        events.push({
          month: Math.max(goLive, hire.month),
          amount: round2(hire.headcount * unit),
        });
      }
    }
    return events.filter((event) => event.amount !== 0 && event.month <= HORIZON_MONTHS);
  };

  const eventTotal = (events: Array<{ month: number; amount: number }>, month: number) =>
    round2(events.filter((event) => event.month === month).reduce((total, event) => total + event.amount, 0));

  const recruitment = recruitmentEvents();
  const training = trainingEvents();

  const severanceAt = (month: number) => {
    if (storeType !== 'existente' || !payrollGate.included) return 0;
    if (month !== Math.max(goLive, inputs.people.payroll.startMonth)) return 0;
    return round2(inputs.people.payroll.severanceCost);
  };

  const resaleAt = (month: number) => {
    if (storeType !== 'existente' || !shelvingGate.included || shelvingStillNeeded) return 0;
    if (month !== goLive) return 0;
    return round2(inputs.logistics.shelving.resaleValue);
  };

  const removalAt = (month: number) => {
    if (storeType !== 'existente' || !shelvingGate.included || shelvingStillNeeded) return 0;
    if (month !== goLive) return 0;
    return round2(inputs.logistics.shelving.removalCost);
  };

  const capexTrancheAt = (month: number) => {
    const share = shareAt(month);
    if (share === 0 || netInvestment === 0) return 0;
    return round2(-netInvestment * share);
  };

  const workingCapitalAt = (month: number) => {
    if (!usePrincipal || capitalRelease === 0) return 0;
    const when = Math.max(goLive, releaseMonth);
    if (month === when) return capitalRelease;
    if (inputs.stock.workingCapital.reverseAtHorizon && month === HORIZON_MONTHS && when !== HORIZON_MONTHS) {
      return round2(-capitalRelease);
    }
    return 0;
  };

  const residualAt = (month: number) => {
    if (month !== HORIZON_MONTHS) return 0;
    const residual = round2(inputs.robot.residualValue * capexMultiplier);
    if (activeTaxPolicy(inputs) === 'sem_impostos' || !inputs.robot.extraordinaryEventsTaxable || residual === 0) {
      return residual;
    }
    const operated = HORIZON_MONTHS - goLive + 1;
    const depreciated = Math.min(operated, depreciationMonths) * (netInvestment / depreciationMonths);
    const book = Math.max(0, netInvestment - depreciated);
    const tax = (residual - book) * inputs.robot.taxRate;
    return round2(residual - tax);
  };

  const depreciationAt = (month: number) => {
    if (!inputs.robot.includeTax || month < goLive) return 0;
    const operatedIndex = month - goLive + 1;
    if (operatedIndex > depreciationMonths) return 0;
    return netInvestment / depreciationMonths;
  };

  const months: MonthDetail[] = [];
  let cumulative = openingCash;
  let cumulativeDiscounted = openingCash;
  let lossCarry = 0;
  const taxPolicy = activeTaxPolicy(inputs);
  const accrued: Record<string, number> = {};
  const bump = (id: string, value: number) => {
    accrued[id] = round2((accrued[id] ?? 0) + value);
  };

  for (let month = 1; month <= HORIZON_MONTHS; month += 1) {
    const salesMargin = salesAmount(month);
    const benefit = operatingBenefit(month);
    const opex =
      month >= goLive ? round2(monthlyOpex * yearIndex(inputs.profile.opexInflationPctPerYear, month)) : 0;
    const preTax = round2(benefit - opex);
    const depreciation = depreciationAt(month);
    const taxableRaw = preTax - depreciation;
    let taxableBase = taxableRaw;
    let tax = 0;
    if (taxPolicy === 'incremental_simplificado') {
      tax = round2(Math.max(0, taxableRaw) * inputs.robot.taxRate);
    } else if (taxPolicy === 'prejuizo_com_limite') {
      if (taxableRaw < 0) {
        lossCarry = round2(lossCarry - taxableRaw);
        taxableBase = 0;
      } else {
        const limit = clamp(inputs.robot.lossUtilizationLimit, 0, 1);
        const used = Math.min(lossCarry, taxableRaw * limit);
        lossCarry = round2(lossCarry - used);
        taxableBase = taxableRaw - used;
        tax = round2(Math.max(0, taxableBase) * inputs.robot.taxRate);
      }
    } else if (taxPolicy === 'beneficio_condicionado') {
      const rawTax = taxableRaw * inputs.robot.taxRate;
      if (rawTax >= 0) tax = round2(rawTax);
      else if (inputs.robot.taxBenefitValidated) {
        tax = round2(Math.max(rawTax, -Math.max(0, inputs.robot.taxCapacityMonthly)));
      }
    }
    const netOperating = round2(preTax - tax);
    bump('payroll', payrollAmount(month));
    bump('futureHires', futureHireCost(month));
    bump('turnover', turnoverAmount(month));
    bump('supervision', supervisionAmount(month));
    bump('reallocated', reallocatedAmount(month));
    bump('boxes', boxesAmount(month));
    bump('shelvingMaintenance', maintenanceAmount(month));
    bump('spaceOccupancy', spaceAmount(month));
    bump('movement', movementAmount(month));
    bump('inventoryCount', countAmount(month));
    bump('losses', lossesAmount(month));
    bump('shrinkage', shrinkageAmount(month));
    bump('opex', opex);
    const workingCapital = workingCapitalAt(month);
    const severance = severanceAt(month);
    const resale = resaleAt(month);
    const residual = residualAt(month);
    const oneTimeExtras = round2(eventTotal(recruitment, month) + eventTotal(training, month));
    const removal = removalAt(month);
    const capexTranche = capexTrancheAt(month);
    const oneTime = round2(workingCapital + -severance + resale - removal + residual + oneTimeExtras + capexTranche);
    const incremental = round2(netOperating + oneTime);
    cumulative = round2(cumulative + incremental);
    const discountedIncremental = round2(incremental / Math.pow(1 + monthlyRate, month));
    cumulativeDiscounted = round2(cumulativeDiscounted + discountedIncremental);

    const historical = lossesGate.included && month >= goLive ? round2(historicalLosses(month) * benefitFactor) : 0;
    const projected =
      lossesGate.included && month >= goLive
        ? round2(Math.min(projectedLosses(month), historicalLosses(month)) * benefitFactor)
        : 0;
    const nonSales = round2(benefit - salesMargin);
    const lossAvoided = lossesAmount(month);
    const costWithout = round2(nonSales - lossAvoided + historical);
    const costWith = round2(projected + opex);

    months.push({
      month,
      costWithout,
      costWith,
      salesMargin,
      benefit,
      opex,
      accountingResult: preTax,
      taxableBase: round2(taxableBase),
      tax,
      netOperating,
      workingCapital,
      severance: round2(-severance),
      resale,
      residual,
      oneTime,
      incremental,
      cumulative,
      discountedIncremental,
      cumulativeDiscounted,
    });
  }

  const steady = months[HORIZON_MONTHS - 1];
  const cashFlows = [openingCash, ...months.map((month) => month.incremental)];
  const steadyBenefit = steady.benefit;
  const steadyNet = steady.netOperating;
  const annualSteadyNet = round2(steadyNet * 12);
  const roi = simpleAnnualRoi(annualSteadyNet, netInvestment);
  const accumulatedSavings = round2(months.reduce((total, month) => total + month.benefit, 0));
  const accumulatedNet = months.reduce((total, month) => total + month.netOperating, 0);
  const cumulativeRoi = netInvestment > 0 && Number.isFinite(accumulatedNet) ? accumulatedNet / netInvestment : null;
  const irrAmbiguous = signChanges(cashFlows) > 1;
  const payback = simplePayback(cashFlows);
  const firstPositiveMonth = firstNonNegativeMonth(cashFlows);
  const discountedPb = Number.isFinite(monthlyRate) ? discountedPayback(cashFlows, monthlyRate) : null;
  const firstDiscounted = Number.isFinite(monthlyRate)
    ? firstNonNegativeDiscountedMonth(cashFlows, monthlyRate)
    : null;
  const presentValue = Number.isFinite(monthlyRate) ? round2(npv(monthlyRate, cashFlows)) : Number.NaN;
  const irrMonthly = irr(cashFlows);
  const irrAnnual = irrMonthly === null ? null : annualizeMonthlyRate(irrMonthly);

  const audit = buildAudit({
    inputs,
    storeType,
    payrollGate,
    hiresGate,
    recruitmentGate,
    trainingGate,
    turnoverGate,
    supervisionGate,
    boxesGate,
    shelvingGate,
    spaceGate,
    movementGate,
    countGate,
    lossesGate,
    shrinkageGate,
    capitalGate,
    salesCandidates,
    droppedSales,
    payrollAmount,
    futureHireCost,
    turnoverAmount,
    supervisionAmount,
    reallocatedAmount,
    boxesAmount,
    maintenanceAmount,
    spaceAmount,
    movementAmount,
    countAmount,
    lossesAmount,
    shrinkageAmount,
    financialMonthly,
    capitalRelease,
    usePrincipal,
    releaseMonth,
    avoidedCapex,
    grossCapex,
    monthlyOpex,
    recruitment,
    training,
    goLive,
  });

  const warnings: string[] = [];
  if (coverage < 1 && dispensations > 0) {
    warnings.push(
      `A capacidade do robô cobre ${Math.round(coverage * 100)}% das dispensações. Os benefícios foram reduzidos nessa proporção.`,
    );
  }
  if (availability < 1) {
    warnings.push('A disponibilidade operacional reduz os benefícios na mesma proporção.');
  }
  if (inputs.profile.historicalLossesMonthly < inputs.stock.losses.projectedLossesMonthly && lossesGate.included) {
    warnings.push('As perdas projetadas superam as históricas. A economia de perdas ficou zerada.');
  }
  if (steadyBenefit > inputs.profile.monthlyRevenue && inputs.profile.monthlyRevenue > 0) {
    warnings.push('O benefício bruto supera o faturamento mensal informado. Vale revisar as premissas.');
  }
  if (netInvestment < 0) {
    warnings.push('O CAPEX evitado supera o investimento bruto. O investimento líquido ficou negativo.');
  }
  if (inputs.robot.financing.enabled) {
    warnings.push('O financiamento aparece à parte. VPL, TIR, ROI e payback usam o investimento total, sem a dívida.');
  }
  if (inputs.robot.includeTax) {
    warnings.push(
      'Imposto simplificado sobre o resultado incremental. A alíquota não vale para qualquer regime e precisa de validação tributária. Prejuízo não gera crédito automático.',
    );
  }
  if (inputs.robot.includeTax && !inputs.robot.taxValidated) {
    warnings.push('A premissa tributária ainda não foi validada com a área fiscal.');
  }
  if (requestedPositions > roleHeadcount && roleHeadcount > 0) {
    warnings.push(
      `As vagas informadas (${requestedPositions}) passam do quadro (${roleHeadcount}). A folha foi limitada ao quadro.`,
    );
  }
  if (hourScale < 1) {
    warnings.push('As horas liberadas passam da jornada do quadro que permanece. O excedente não foi monetizado.');
  }
  if (!inputs.people.payroll.costConfirmedFullyLoaded && payrollGate.included) {
    warnings.push('Confirme se o custo da vaga já inclui encargos e benefícios. Sem isso a folha pode estar incompleta.');
  }
  if (lossesGate.included && shrinkageGate.included && !inputs.stock.losses.useDetailed) {
    warnings.push('Perdas e avarias podem se sobrepor. Use o detalhamento para separar vencimento, avaria, extravio e erro.');
  }
  if (inputs.stock.workingCapital.enabled && !inputs.stock.workingCapital.reductionProven) {
    warnings.push('A redução de estoque não está comprovada. O capital de giro não entrou no caixa.');
  }
  if (
    inputs.profile.demandGrowthPctPerYear !== 0 &&
    inputs.profile.wageGrowthPctPerYear === 0 &&
    inputs.profile.opexInflationPctPerYear === 0 &&
    inputs.profile.moneyBasis === 'nominal'
  ) {
    warnings.push('A demanda cresce e salários e OPEX ficam constantes. Justifique ou informe a inflação correspondente.');
  }
  if (inputs.profile.moneyBasis !== inputs.robot.discountBasis) {
    warnings.push('A base dos fluxos e a base da taxa de desconto estão diferentes (nominal e real).');
  }
  if (irrAmbiguous) {
    warnings.push('O fluxo troca de sinal mais de uma vez. A TIR é ambígua; a decisão deve usar o VPL.');
  }
  if (inputs.people.reallocatedHours.enabled && inputs.people.reallocatedHours.monetization === 'nenhuma') {
    warnings.push('Horas realocadas estão registradas e não entram como economia de folha.');
  }
  if (includePotential) {
    warnings.push('Ganhos marcados como potenciais estão entrando no fluxo.');
  }
  if (storeType === 'existente') {
    warnings.push('Loja existente: rescisão entra no caixa, e prateleiras viram revenda e manutenção, sem reduzir o CAPEX.');
  }
  if (inputs.profile.demandGrowthPctPerYear !== 0) {
    warnings.push('Há crescimento de demanda. O ROI usa o benefício do mês 60, não a média do período.');
  }

  const financing = buildFinancing(inputs, netInvestment, cashFlows, monthlyRate, presentValue, irrAnnual);

  const storeCount = Math.max(1, Math.round(inputs.profile.storeCount) || 1);
  const network = buildNetwork(inputs, options, {
    netInvestment,
    steadyNet,
    npv: presentValue,
    monthlyRate,
    storeCount,
  });
  const indicators = {
    stabilizedAnnualReturn: roi,
    cumulativeRoi,
    simplePayback: payback,
    discountedPayback: discountedPb,
    npv: presentValue,
    irrAnnualEffective: irrAnnual,
    irrAmbiguous,
    cumulativeCash: steady.cumulative,
    cumulativeDiscountedCash: steady.cumulativeDiscounted,
    annualOperatingBenefit: round2(steadyBenefit * 12),
    accumulatedSavings,
    totalNetInvestment: netInvestment,
  };

  return {
    scenario,
    storeType,
    storeCount,
    netInvestment,
    grossCapex,
    avoidedCapex,
    monthlyOpex,
    steadyBenefit,
    steadySales: steady.salesMargin,
    steadyNet,
    annualSteadyNet,
    roi,
    payback,
    firstPositiveMonth,
    discountedPayback: discountedPb,
    firstPositiveDiscountedMonth: firstDiscounted,
    npv: presentValue,
    irrMonthly,
    irrAnnual,
    discountRateAnnual: inputs.robot.discountRateAnnual,
    discountRateMonthly: monthlyRate,
    cashFlows,
    months,
    audit,
    warnings,
    financing,
    informational: {
      workingCapitalRelease: round2(releaseBase),
      financialCostAvoidedAnnual: round2(releaseBase * inputs.stock.workingCapital.costOfCapitalAnnual),
      workingCapitalIncluded: usePrincipal,
      financialCostIncluded: financialMonthly > 0 && capitalGate.included,
    },
    indicators,
    network,
  };
}

export function sensitivity(
  inputs: Inputs,
  scenario: ScenarioId,
): Record<SensitivityDriver, SensitivityPoint[]> {
  const table = {} as Record<SensitivityDriver, SensitivityPoint[]>;
  for (const driver of DRIVER_IDS) {
    table[driver] = SENSITIVITY_DELTAS.map((delta) => {
      const varied = applyDriver(normalizeInputs(inputs), driver, 1 + delta);
      const result = evaluate(varied, { scenario, skipNetwork: true });
      return {
        delta,
        payback: result.payback,
        roi: result.roi,
        npv: result.npv,
        steadyNet: result.steadyNet,
      };
    });
  }
  return table;
}

function gateBenefit(
  enabled: boolean,
  confidence: Confidence,
  includePotential: boolean,
  blockedReason: string | null,
): Gate {
  if (!enabled) {
    return { included: false, reason: 'Benefício desativado.', confidence };
  }
  if (blockedReason) {
    return { included: false, reason: blockedReason, confidence };
  }
  if (confidence === 'potencial' && !includePotential) {
    return {
      included: false,
      reason: 'Ganho potencial. Fica de fora até você incluir ganhos potenciais.',
      confidence,
    };
  }
  return {
    included: true,
    reason:
      confidence === 'potencial'
        ? 'Ganho potencial incluído por opção explícita.'
        : 'Premissa comprovável incluída no fluxo.',
    confidence,
  };
}

function buildFinancing(
  inputs: Inputs,
  netInvestment: number,
  projectFlows: number[],
  _discountMonthly: number,
  projectNpv: number,
  projectIrrAnnual: number | null,
): FinancingResult | null {
  if (!inputs.robot.financing.enabled) return null;
  const down = clamp(inputs.robot.financing.downPaymentPct, 0, 1);
  const term = Math.max(1, Math.round(inputs.robot.financing.termMonths));
  const balloon = Math.max(0, inputs.robot.financing.balloon);
  const principal = Math.max(0, round2(Math.max(0, netInvestment) * (1 - down)));
  const monthlyRate = monthlyRateFromAnnual(inputs.robot.financing.annualInterest);
  let payment = 0;
  if (principal > 0) {
    if (!Number.isFinite(monthlyRate) || Math.abs(monthlyRate) < 1e-12) {
      payment = (principal - balloon) / term;
    } else {
      const annuity = (1 - Math.pow(1 + monthlyRate, -term)) / monthlyRate;
      const balloonPresent = balloon / Math.pow(1 + monthlyRate, term);
      payment = (principal - balloonPresent) / annuity;
    }
  }
  payment = round2(Math.max(0, payment));
  const equity = round2(Math.max(0, netInvestment) * down);
  const totalPaid = round2(equity + payment * term + balloon);
  const equityFlows = projectFlows.slice();
  equityFlows[0] = round2(projectFlows[0] + principal);
  const balances: number[] = [];
  let balance = principal;
  for (let month = 1; month <= HORIZON_MONTHS; month += 1) {
    if (month <= term && month < equityFlows.length) {
      equityFlows[month] = round2(equityFlows[month] - payment);
      const interest = Number.isFinite(monthlyRate) ? balance * monthlyRate : 0;
      const amort = payment - interest;
      balance = round2(Math.max(0, balance - amort));
    }
    if (month === term && month < equityFlows.length) {
      equityFlows[month] = round2(equityFlows[month] - balloon);
      balance = round2(Math.max(0, balance - balloon));
    }
    balances.push(balance);
  }
  const equityIrrMonthly = irr(equityFlows);
  return {
    enabled: true,
    financedAmount: principal,
    monthlyPayment: payment,
    termMonths: term,
    balloon,
    totalPaid,
    interestTotal: round2(totalPaid - Math.max(0, netInvestment)),
    note: 'Fluxo do investidor, separado do fluxo do projeto. O financiamento recebido não é benefício operacional.',
    projectNpv,
    projectIrrAnnual,
    equityCashFlows: equityFlows,
    equityIrrAnnual: equityIrrMonthly === null ? null : annualizeMonthlyRate(equityIrrMonthly),
    debtServiceMonthly: payment,
    debtBalanceByMonth: balances,
    totalFinancialCost: round2(totalPaid - Math.max(0, netInvestment)),
  };
}

function buildNetwork(
  inputs: Inputs,
  options: EvalOptions,
  single: { netInvestment: number; steadyNet: number; npv: number; monthlyRate: number; storeCount: number },
): ModelResult['network'] {
  if (!inputs.network.enabled || inputs.network.stores.length === 0 || options.skipNetwork) {
    return {
      mode: 'replicacao',
      investment: round2(single.netInvestment * single.storeCount),
      steadyNet: round2(single.steadyNet * single.storeCount),
      npv: round2(single.npv * single.storeCount),
      sharedMonthlyCost: 0,
      stores: [],
    };
  }

  const combined = Array.from({ length: HORIZON_MONTHS + 1 }, () => 0);
  const stores: NetworkStoreResult[] = [];
  for (const store of inputs.network.stores) {
    const clone = structuredClone(inputs);
    clone.network = { enabled: false, sharedMonthlyCost: 0, stores: [] };
    clone.profile = { ...clone.profile, storeType: store.storeType, storeCount: 1, dispensationsPerDay: clone.profile.dispensationsPerDay * store.volumeFactor };
    clone.robot = {
      ...clone.robot,
      goLiveMonth: 1,
      capex: scaleMoney(clone.robot.capex, store.investmentFactor),
    };
    clone.logistics = {
      ...clone.logistics,
      shelving: {
        ...clone.logistics.shelving,
        avoidedAcquisition: round2(clone.logistics.shelving.avoidedAcquisition * store.investmentFactor),
      },
    };
    clone.people = {
      ...clone.people,
      payroll: {
        ...clone.people.payroll,
        monthlyCostPerPosition: round2(clone.people.payroll.monthlyCostPerPosition * store.laborFactor),
      },
    };
    const local = evaluate(clone, {
      scenario: options.scenario,
      storeTypeOverride: store.storeType,
      skipNetwork: true,
    });
    const placed = placeFlows(local.cashFlows, store.goLiveMonth);
    const count = Math.max(1, Math.round(store.count) || 1);
    for (let index = 0; index < combined.length; index += 1) combined[index] += placed[index] * count;
    stores.push({
      id: store.id,
      name: store.name,
      count,
      goLiveMonth: store.goLiveMonth,
      payback: local.payback,
      npv: round2(local.npv * count),
      netInvestment: round2(local.netInvestment * count),
      steadyNet: round2(local.steadyNet * count),
    });
  }
  const shared = inputs.network.sharedMonthlyCost;
  for (let month = 1; month <= HORIZON_MONTHS; month += 1) combined[month] = round2(combined[month] - shared);
  return {
    mode: 'escalonada',
    investment: round2(stores.reduce((total, store) => total + store.netInvestment, 0)),
    steadyNet: round2(stores.reduce((total, store) => total + store.steadyNet, 0) - shared),
    npv: Number.isFinite(single.monthlyRate) ? round2(npv(single.monthlyRate, combined)) : Number.NaN,
    sharedMonthlyCost: shared,
    stores,
  };
}

function placeFlows(local: number[], goLiveMonth: number): number[] {
  const global = Array.from({ length: HORIZON_MONTHS + 1 }, () => 0);
  const start = clamp(Math.round(goLiveMonth) || 1, 1, HORIZON_MONTHS);
  const investAt = Math.max(0, start - 1);
  global[investAt] += local[0] ?? 0;
  for (let month = 1; month < local.length; month += 1) {
    const globalMonth = start + month - 1;
    if (globalMonth >= 1 && globalMonth <= HORIZON_MONTHS) global[globalMonth] += local[month];
  }
  return global;
}

function scaleMoney<T extends Record<string, number>>(record: T, factor: number): T {
  const next = { ...record };
  for (const key of Object.keys(next)) next[key as keyof T] = round2(next[key as keyof T] * factor) as T[keyof T];
  return next;
}

function normalizeSchedule(schedule: Array<{ month: number; share: number }>): Array<{ month: number; share: number }> {
  const clean = (schedule.length ? schedule : [{ month: 0, share: 1 }])
    .map((tranche) => ({
      month: clamp(Math.round(tranche.month) || 0, 0, HORIZON_MONTHS),
      share: Math.max(0, tranche.share),
    }))
    .filter((tranche) => tranche.share > 0);
  const total = clean.reduce((sumShares, tranche) => sumShares + tranche.share, 0);
  if (!(total > 0)) return [{ month: 0, share: 1 }];
  return clean.map((tranche) => ({ ...tranche, share: tranche.share / total }));
}

function buildAudit(ctx: {
  inputs: Inputs;
  storeType: StoreType;
  payrollGate: Gate;
  hiresGate: Gate;
  recruitmentGate: Gate;
  trainingGate: Gate;
  turnoverGate: Gate;
  supervisionGate: Gate;
  boxesGate: Gate;
  shelvingGate: Gate;
  spaceGate: Gate;
  movementGate: Gate;
  countGate: Gate;
  lossesGate: Gate;
  shrinkageGate: Gate;
  capitalGate: Gate;
  salesCandidates: SalesCandidate[];
  droppedSales: Set<string>;
  payrollAmount: (month: number) => number;
  futureHireCost: (month: number) => number;
  turnoverAmount: (month: number) => number;
  supervisionAmount: (month: number) => number;
  reallocatedAmount: (month: number) => number;
  boxesAmount: (month: number) => number;
  maintenanceAmount: (month: number) => number;
  spaceAmount: (month: number) => number;
  movementAmount: (month: number) => number;
  countAmount: (month: number) => number;
  lossesAmount: (month: number) => number;
  shrinkageAmount: (month: number) => number;
  financialMonthly: number;
  capitalRelease: number;
  usePrincipal: boolean;
  releaseMonth: number;
  avoidedCapex: number;
  grossCapex: number;
  monthlyOpex: number;
  recruitment: Array<{ month: number; amount: number }>;
  training: Array<{ month: number; amount: number }>;
  goLive: number;
}): AuditLine[] {
  const steady = HORIZON_MONTHS;
  const spaceMode = ctx.inputs.logistics.space.mode;
  const lines: AuditLine[] = [
    line({
      id: 'payroll',
      module: 'Pessoas',
      label: 'Folha e encargos evitados',
      kind: 'recorrente',
      gate: ctx.payrollGate,
      monthlyValue: ctx.payrollAmount(steady),
      formula: 'Vagas evitadas × custo completo mensal, a partir do mês em que a contratação deixaria de existir.',
    }),
    line({
      id: 'futureHires',
      module: 'Pessoas',
      label: 'Contratações futuras evitadas',
      kind: 'recorrente',
      gate: ctx.hiresGate,
      monthlyValue: ctx.futureHireCost(steady),
      formula: 'Cada vaga entra só a partir do mês em que seria aberta no cenário sem robô.',
    }),
    line({
      id: 'recruitment',
      module: 'Pessoas',
      label: 'Recrutamento e seleção evitados',
      kind: 'pontual',
      gate: ctx.recruitmentGate,
      monthlyValue: 0,
      oneTimeValue: sum(ctx.recruitment.map((event) => event.amount)),
      oneTimeMonth: ctx.recruitment[0]?.month ?? null,
      formula: 'Custo por contratação × vagas que deixam de ser abertas. Não se soma se já estiver no turnover.',
    }),
    line({
      id: 'training',
      module: 'Pessoas',
      label: 'Treinamento inicial evitado',
      kind: 'pontual',
      gate: ctx.trainingGate,
      monthlyValue: 0,
      oneTimeValue: sum(ctx.training.map((event) => event.amount)),
      oneTimeMonth: ctx.training[0]?.month ?? null,
      formula: 'Custo por pessoa × vagas novas evitadas. Não se soma se já estiver no custo de substituição.',
    }),
    line({
      id: 'turnover',
      module: 'Pessoas',
      label: 'Turnover evitado',
      kind: 'recorrente',
      gate: ctx.turnoverGate,
      monthlyValue: ctx.turnoverAmount(steady),
      formula: 'Vagas equivalentes evitadas × taxa anual de turnover × custo médio por substituição / 12.',
    }),
    line({
      id: 'supervision',
      module: 'Pessoas',
      label: 'Supervisão e cobertura',
      kind: 'recorrente',
      gate: ctx.supervisionGate,
      monthlyValue: ctx.supervisionAmount(steady),
      formula: 'Horas economizadas × custo da hora, apenas de quem continua no quadro.',
    }),
    salesLine(ctx, 'consultative'),
    line({
      id: 'reallocated',
      module: 'Pessoas',
      label: 'Horas realocadas',
      kind: 'recorrente',
      gate: {
        included:
          ctx.inputs.people.reallocatedHours.enabled &&
          ctx.inputs.people.reallocatedHours.monetization !== 'nenhuma' &&
          (ctx.inputs.people.reallocatedHours.confidence !== 'potencial' || ctx.inputs.assumptions.includePotential) &&
          (ctx.inputs.people.reallocatedHours.monetization !== 'ganho_incremental' ||
            ctx.inputs.people.reallocatedHours.evidence),
        confidence: ctx.inputs.people.reallocatedHours.confidence,
        reason:
          ctx.inputs.people.reallocatedHours.monetization === 'nenhuma'
            ? 'Horas realocadas não são economia de folha. Só entram com redução de custo ou ganho incremental demonstrável.'
            : 'Horas realocadas monetizadas por premissa explícita, sem duplicar a folha.',
      },
      monthlyValue: ctx.reallocatedAmount(steady),
      formula: 'Não usa vagas × custo. Exige monetização própria e evidência quando o ganho é incremental.',
    }),
    line({
      id: 'boxes',
      module: 'Logística',
      label: 'Caixas retornáveis',
      kind: 'recorrente',
      gate: ctx.boxesGate,
      monthlyValue: ctx.boxesAmount(steady),
      formula: 'Ciclos evitados × custo por ciclo. Só entra com o processo logístico validado.',
    }),
    line({
      id: 'shelvingCapex',
      module: 'Logística',
      label: 'Prateleiras evitadas (CAPEX)',
      kind: 'pontual',
      gate:
        ctx.storeType === 'nova'
          ? ctx.shelvingGate
          : {
              included: false,
              confidence: ctx.inputs.logistics.shelving.confidence,
              reason: 'Em loja existente a prateleira não reduz o CAPEX. Use revenda ou manutenção evitada.',
            },
      monthlyValue: 0,
      oneTimeValue: ctx.storeType === 'nova' && ctx.shelvingGate.included ? ctx.avoidedCapex : 0,
      oneTimeMonth: 0,
      formula: 'Aquisição e instalação evitadas em loja nova, abatidas do investimento.',
    }),
    line({
      id: 'shelvingResale',
      module: 'Logística',
      label: 'Revenda de prateleiras',
      kind: 'pontual',
      gate:
        ctx.storeType === 'existente'
          ? ctx.shelvingGate
          : {
              included: false,
              confidence: ctx.inputs.logistics.shelving.confidence,
              reason: 'Revenda só se aplica a loja existente. Em loja nova o efeito é CAPEX evitado.',
            },
      monthlyValue: 0,
      oneTimeValue:
        ctx.storeType === 'existente' && ctx.shelvingGate.included ? ctx.inputs.logistics.shelving.resaleValue : 0,
      oneTimeMonth: ctx.goLive,
      formula: 'Caixa único da venda ou do reaproveitamento do mobiliário atual.',
    }),
    line({
      id: 'shelvingMaintenance',
      module: 'Logística',
      label: 'Manutenção de prateleiras evitada',
      kind: 'recorrente',
      gate:
        ctx.storeType === 'existente'
          ? ctx.shelvingGate
          : {
              included: false,
              confidence: ctx.inputs.logistics.shelving.confidence,
              reason: 'Manutenção evitada só entra em loja existente.',
            },
      monthlyValue: ctx.maintenanceAmount(steady),
      formula: 'OPEX recorrente de prateleiras que deixa de existir.',
    }),
    line({
      id: 'spaceOccupancy',
      module: 'Logística',
      label: 'Custo de ocupação evitado',
      kind: 'recorrente',
      gate:
        spaceMode === 'ocupacao'
          ? ctx.spaceGate
          : {
              included: false,
              confidence: ctx.inputs.logistics.space.confidence,
              reason: 'A área está valorizada pela margem comercial. O aluguel da mesma área não entra junto.',
            },
      monthlyValue: spaceMode === 'ocupacao' ? ctx.spaceAmount(steady) : 0,
      formula: 'm² liberados × custo de ocupação por m².',
    }),
    salesLine(ctx, 'spaceMargin'),
    line({
      id: 'movement',
      module: 'Logística',
      label: 'Movimentação interna',
      kind: 'recorrente',
      gate: ctx.movementGate,
      monthlyValue: ctx.movementAmount(steady),
      formula: 'Horas de deslocamento e reposição × custo da hora.',
    }),
    line({
      id: 'inventoryCount',
      module: 'Logística',
      label: 'Inventário e conciliação',
      kind: 'recorrente',
      gate: ctx.countGate,
      monthlyValue: ctx.countAmount(steady),
      formula: 'Horas de contagem e conciliação × custo da hora.',
    }),
    line({
      id: 'losses',
      module: 'Estoque',
      label: 'Perdas evitadas',
      kind: 'recorrente',
      gate: ctx.lossesGate,
      monthlyValue: ctx.lossesAmount(steady),
      formula: 'Perdas históricas − perdas projetadas com automação.',
    }),
    line({
      id: 'shrinkage',
      module: 'Estoque',
      label: 'Avarias, extravios e erros',
      kind: 'recorrente',
      gate: ctx.shrinkageGate,
      monthlyValue: ctx.shrinkageAmount(steady),
      formula: 'Valor mensal evitado de avarias, extravios e erros de separação.',
    }),
    salesLine(ctx, 'ruptures'),
    salesLine(ctx, 'service'),
    salesLine(ctx, 'abandonment'),
    line({
      id: 'workingCapital',
      module: 'Estoque',
      label: 'Capital de giro liberado',
      kind: 'capital',
      gate: ctx.usePrincipal
        ? ctx.capitalGate
        : {
            included: false,
            confidence: ctx.inputs.stock.workingCapital.confidence,
            reason: ctx.capitalGate.included
              ? 'O tratamento escolhido foi o custo financeiro. O principal não entra de novo no caixa.'
              : ctx.capitalGate.reason,
          },
      monthlyValue: 0,
      oneTimeValue: ctx.usePrincipal ? ctx.capitalRelease : 0,
      oneTimeMonth: Math.max(ctx.goLive, ctx.releaseMonth),
      formula: 'Estoque médio antes − estoque médio depois. É caixa pontual, não lucro recorrente.',
    }),
    line({
      id: 'financialCost',
      module: 'Estoque',
      label: 'Custo financeiro do estoque',
      kind: 'recorrente',
      gate:
        ctx.financialMonthly > 0
          ? ctx.capitalGate
          : {
              included: false,
              confidence: ctx.inputs.stock.workingCapital.confidence,
              reason: ctx.capitalGate.included
                ? 'O tratamento escolhido foi a liberação de caixa. O custo financeiro fica só como leitura, para não duplicar o VPL.'
                : ctx.capitalGate.reason,
            },
      monthlyValue: ctx.financialMonthly,
      formula: 'Capital liberado × taxa de custo de capital / 12. Não soma com a liberação do principal.',
    }),
    line({
      id: 'capex',
      module: 'Investimento',
      label: 'CAPEX bruto do robô',
      kind: 'custo',
      gate: {
        included: true,
        confidence: 'comprovavel',
        reason: 'Investimento na data zero, antes do benefício operacional.',
      },
      monthlyValue: 0,
      oneTimeValue: ctx.grossCapex,
      oneTimeMonth: 0,
      formula: 'Equipamento, frete e tributos, instalação, obras, integração, implantação e contingência.',
    }),
    line({
      id: 'opex',
      module: 'Investimento',
      label: 'OPEX mensal do robô',
      kind: 'custo',
      gate: {
        included: true,
        confidence: 'comprovavel',
        reason: 'Custo recorrente abatido do benefício bruto.',
      },
      monthlyValue: ctx.monthlyOpex,
      formula: 'Manutenção, software, energia, indisponibilidade, seguros e outros.',
    }),
  ];

  return lines;
}

function salesLine(
  ctx: {
    salesCandidates: SalesCandidate[];
    droppedSales: Set<string>;
  },
  id: string,
): AuditLine {
  const candidate = ctx.salesCandidates.find((item) => item.id === id);
  if (!candidate) {
    throw new Error(`Alavanca de venda ausente: ${id}`);
  }
  const dropped = ctx.droppedSales.has(id);
  const gate = dropped
    ? {
        included: false,
        confidence: candidate.confidence,
        reason:
          'Outro ganho de venda já entrou no fluxo. Confirme que as alavancas são independentes para somar as duas.',
      }
    : candidate.gate;
  return line({
    id,
    module: candidate.module,
    label: candidate.label,
    kind: 'recorrente',
    gate,
    monthlyValue: gate.included ? candidate.monthlyAt(HORIZON_MONTHS) : candidate.monthlyAt(HORIZON_MONTHS),
    formula: candidate.formula,
  });
}

function line(input: {
  id: string;
  module: string;
  label: string;
  kind: AuditLine['kind'];
  gate: Gate;
  monthlyValue: number;
  oneTimeValue?: number;
  oneTimeMonth?: number | null;
  formula: string;
}): AuditLine {
  return {
    id: input.id,
    module: input.module,
    label: input.label,
    kind: input.kind,
    confidence: input.gate.confidence,
    monthlyValue: input.monthlyValue,
    oneTimeValue: input.oneTimeValue ?? 0,
    oneTimeMonth: input.oneTimeMonth ?? null,
    includedInCashFlow: input.gate.included,
    formula: input.formula,
    reason: input.gate.reason,
    unit: input.kind === 'recorrente' || input.kind === 'custo' ? 'R$/mês' : 'R$',
    dataOrigin: 'Premissa informada na simulação',
    condition: input.gate.reason,
    startMonth: input.oneTimeMonth ?? null,
    captureFactor: 1,
    accumulatedValue: input.gate.included && (input.kind === 'recorrente' || input.kind === 'custo') ? round2(input.monthlyValue * HORIZON_MONTHS) : input.oneTimeValue ?? 0,
    dependencies: [],
    conflicts: [],
  };
}

export { SENSITIVITY_DELTAS };
