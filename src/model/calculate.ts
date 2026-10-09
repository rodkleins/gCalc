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
import { clamp, round2, sum } from './round';
import type {
  AuditLine,
  Confidence,
  EvalOptions,
  FinancingResult,
  Inputs,
  ModelResult,
  MonthDetail,
  ScenarioId,
  SensitivityDriver,
  SensitivityPoint,
  StoreType,
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

export function evaluate(inputs: Inputs, options: EvalOptions = {}): ModelResult {
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

  const grossCapex = round2(sum(Object.values(inputs.robot.capex)) * capexMultiplier);
  const monthlyOpex = round2(sum(Object.values(inputs.robot.opexMonthly)) * factors.opexFactor);
  const monthlyRate = monthlyRateFromAnnual(inputs.robot.discountRateAnnual);

  const shelvingGate = gateBenefit(
    inputs.logistics.shelving.enabled,
    inputs.logistics.shelving.confidence,
    includePotential,
    null,
  );

  const avoidedCapex =
    storeType === 'nova' && shelvingGate.included
      ? round2(inputs.logistics.shelving.avoidedAcquisition * capexMultiplier)
      : 0;
  const netInvestment = round2(grossCapex - avoidedCapex);

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
  const recruitmentGate = gateBenefit(
    inputs.people.recruitment.enabled,
    inputs.people.recruitment.confidence,
    includePotential,
    inputs.people.recruitment.includedInTurnoverCost
      ? 'Recrutamento e seleção já estão no custo por substituição do turnover. Não entram de novo.'
      : null,
  );
  const trainingGate = gateBenefit(
    inputs.people.training.enabled,
    inputs.people.training.confidence,
    includePotential,
    inputs.people.training.includedInReplacementCost
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
  const spaceGate = gateBenefit(
    inputs.logistics.space.enabled,
    inputs.logistics.space.confidence,
    includePotential,
    null,
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
    null,
  );
  const capitalGate = gateBenefit(
    inputs.stock.workingCapital.enabled,
    inputs.stock.workingCapital.confidence,
    includePotential,
    null,
  );

  const payrollAmount = (month: number) => {
    if (!payrollGate.included || month < Math.max(goLive, inputs.people.payroll.startMonth)) return 0;
    return round2(
      inputs.people.payroll.positionsReduced *
        inputs.people.payroll.monthlyCostPerPosition *
        laborFactor *
        capture *
        benefitFactor,
    );
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
    return round2(raw * capture * benefitFactor);
  };

  const turnoverAmount = (month: number) => {
    if (!turnoverGate.included || month < goLive) return 0;
    const opened =
      (payrollGate.included && month >= inputs.people.payroll.startMonth
        ? inputs.people.payroll.positionsReduced
        : 0) + activeFutureHeadcount(month);
    return round2(
      ((opened * inputs.people.turnover.annualRate * turnoverFactor * inputs.people.turnover.costPerReplacement * laborFactor) /
        12) *
        capture *
        benefitFactor,
    );
  };

  const supervisionAmount = (month: number) => {
    if (!supervisionGate.included || month < goLive) return 0;
    return round2(
      inputs.people.supervision.hoursSavedPerMonth *
        inputs.people.supervision.costPerHour *
        laborFactor *
        capture *
        benefitFactor,
    );
  };

  const boxesAmount = (month: number) => {
    if (!boxesGate.included || month < goLive) return 0;
    return round2(
      inputs.logistics.boxes.cyclesAvoidedPerMonth *
        inputs.logistics.boxes.costPerCycle *
        volumeGrowth(month) *
        capture *
        benefitFactor,
    );
  };

  const maintenanceAmount = (month: number) => {
    if (!shelvingGate.included || storeType !== 'existente' || month < goLive) return 0;
    return round2(inputs.logistics.shelving.avoidedMaintenanceMonthly * capture * benefitFactor);
  };

  const spaceAmount = (month: number) => {
    if (!spaceGate.included || month < goLive) return 0;
    const rate =
      inputs.logistics.space.mode === 'ocupacao'
        ? inputs.logistics.space.occupancyCostPerM2
        : inputs.logistics.space.contributionPerM2Month;
    return round2(inputs.logistics.space.m2Freed * rate * capture * benefitFactor);
  };

  const movementAmount = (month: number) => {
    if (!movementGate.included || month < goLive) return 0;
    return round2(
      inputs.logistics.movement.hoursSavedPerMonth *
        inputs.logistics.movement.costPerHour *
        laborFactor *
        volumeGrowth(month) *
        capture *
        benefitFactor,
    );
  };

  const countAmount = (month: number) => {
    if (!countGate.included || month < goLive) return 0;
    return round2(
      inputs.logistics.inventoryCount.hoursSavedPerMonth *
        inputs.logistics.inventoryCount.costPerHour *
        laborFactor *
        capture *
        benefitFactor,
    );
  };

  const historicalLosses = (month: number) =>
    round2(inputs.profile.historicalLossesMonthly * volumeGrowth(month) * capture);
  const projectedLosses = (month: number) =>
    round2(inputs.stock.losses.projectedLossesMonthly * volumeGrowth(month) * capture);

  const lossesAmount = (month: number) => {
    if (!lossesGate.included || month < goLive) return 0;
    return round2(Math.max(0, historicalLosses(month) - projectedLosses(month)) * benefitFactor);
  };

  const shrinkageAmount = (month: number) => {
    if (!shrinkageGate.included || month < goLive) return 0;
    return round2(inputs.stock.shrinkage.avoidedMonthly * volumeGrowth(month) * capture * benefitFactor);
  };

  const marginOf = (sales: number, month: number) =>
    round2(
      sales *
        inputs.profile.contributionMarginPct *
        volumeGrowth(month) *
        capture *
        benefitFactor *
        salesMultiplier,
    );

  const consultativeMonthly = (month: number) => {
    if (month < goLive) return 0;
    return round2(
      inputs.people.consultativeSales.hoursFreedPerMonth *
        inputs.people.consultativeSales.marginPerHour *
        growthAt(month) *
        capture *
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

  const releaseBase = Math.max(
    0,
    inputs.profile.averageInventory * volumeFactor - inputs.stock.workingCapital.inventoryAfter * volumeFactor,
  );
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
        (month >= goLive ? financialMonthly : 0),
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
    if (storeType !== 'existente' || !shelvingGate.included) return 0;
    if (month !== goLive) return 0;
    return round2(inputs.logistics.shelving.resaleValue);
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
    if (!inputs.robot.includeTax || residual === 0) return residual;
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
  let cumulative = -netInvestment;
  let cumulativeDiscounted = -netInvestment;

  for (let month = 1; month <= HORIZON_MONTHS; month += 1) {
    const salesMargin = salesAmount(month);
    const benefit = operatingBenefit(month);
    const opex = month >= goLive ? monthlyOpex : 0;
    const preTax = round2(benefit - opex);
    const depreciation = depreciationAt(month);
    const tax = inputs.robot.includeTax ? round2((preTax - depreciation) * inputs.robot.taxRate) : 0;
    const netOperating = round2(preTax - tax);
    const workingCapital = workingCapitalAt(month);
    const severance = severanceAt(month);
    const resale = resaleAt(month);
    const residual = residualAt(month);
    const oneTimeExtras = round2(eventTotal(recruitment, month) + eventTotal(training, month));
    const oneTime = round2(workingCapital + -severance + resale + residual + oneTimeExtras);
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
  const cashFlows = [-netInvestment, ...months.map((month) => month.incremental)];
  const steadyBenefit = steady.benefit;
  const steadyNet = steady.netOperating;
  const annualSteadyNet = round2(steadyNet * 12);
  const roi = simpleAnnualRoi(annualSteadyNet, netInvestment);
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
    warnings.push('Os fluxos estão depois do imposto, com o escudo da depreciação linear.');
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

  const financing = buildFinancing(inputs, netInvestment);

  const storeCount = Math.max(1, Math.round(inputs.profile.storeCount) || 1);

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
    network: {
      investment: round2(netInvestment * storeCount),
      steadyNet: round2(steadyNet * storeCount),
      npv: round2(presentValue * storeCount),
    },
  };
}

export function sensitivity(
  inputs: Inputs,
  scenario: ScenarioId,
): Record<SensitivityDriver, SensitivityPoint[]> {
  const drivers: SensitivityDriver[] = ['investimento', 'maoDeObra', 'turnover', 'vendas', 'volume'];
  const table = {} as Record<SensitivityDriver, SensitivityPoint[]>;
  for (const driver of drivers) {
    table[driver] = SENSITIVITY_DELTAS.map((delta) => {
      const factor = 1 + delta;
      const result = evaluate(inputs, {
        scenario,
        capexFactor: driver === 'investimento' ? factor : undefined,
        laborFactor: driver === 'maoDeObra' ? factor : undefined,
        turnoverFactor: driver === 'turnover' ? factor : undefined,
        salesFactor: driver === 'vendas' ? factor : undefined,
        volumeFactor: driver === 'volume' ? factor : undefined,
      });
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

function buildFinancing(inputs: Inputs, netInvestment: number): FinancingResult | null {
  if (!inputs.robot.financing.enabled) return null;
  const down = clamp(inputs.robot.financing.downPaymentPct, 0, 1);
  const term = Math.max(1, Math.round(inputs.robot.financing.termMonths));
  const balloon = Math.max(0, inputs.robot.financing.balloon);
  const principal = Math.max(0, round2(netInvestment * (1 - down)));
  const monthlyRate = monthlyRateFromAnnual(inputs.robot.financing.annualInterest);
  let payment = 0;
  if (principal > 0) {
    if (Math.abs(monthlyRate) < 1e-12) {
      payment = (principal - balloon) / term;
    } else {
      const annuity = (1 - Math.pow(1 + monthlyRate, -term)) / monthlyRate;
      const balloonPresent = balloon / Math.pow(1 + monthlyRate, term);
      payment = (principal - balloonPresent) / annuity;
    }
  }
  payment = round2(Math.max(0, payment));
  const totalPaid = round2(netInvestment * down + payment * term + balloon);
  return {
    enabled: true,
    financedAmount: principal,
    monthlyPayment: payment,
    termMonths: term,
    balloon,
    totalPaid,
    interestTotal: round2(totalPaid - netInvestment),
    note: 'Visão de financiamento, separada do retorno econômico do investimento total.',
  };
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
    line({
      id: 'spaceMargin',
      module: 'Logística',
      label: 'Margem da área liberada',
      kind: 'recorrente',
      gate:
        spaceMode === 'margem'
          ? ctx.spaceGate
          : {
              included: false,
              confidence: ctx.inputs.logistics.space.confidence,
              reason: 'A área está valorizada pelo custo de ocupação. A margem da mesma área não entra junto.',
            },
      monthlyValue: spaceMode === 'margem' ? ctx.spaceAmount(steady) : 0,
      formula: 'm² liberados × margem de contribuição mensal por m².',
    }),
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
    monthlyValue: input.gate.included ? input.monthlyValue : input.monthlyValue,
    oneTimeValue: input.gate.included ? (input.oneTimeValue ?? 0) : input.oneTimeValue ?? 0,
    oneTimeMonth: input.oneTimeMonth ?? null,
    includedInCashFlow: input.gate.included,
    formula: input.formula,
    reason: input.gate.reason,
  };
}

export { SENSITIVITY_DELTAS };
