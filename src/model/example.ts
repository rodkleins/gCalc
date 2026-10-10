import type { Inputs, ModelResult } from './types';

/** Sugestão fictícia de drogaria, a validar. R$ 14.500 foi considerado alto para o cargo. */
export const SUGGESTED_PHARMACIST_MONTHLY_COST = 8_500;
/** Sugestão fictícia por contratação, a validar. R$ 2.500 foi considerado baixo para drogaria. */
export const SUGGESTED_TRAINING_PER_HIRE = 6_000;
/** Nenhuma configuração do robô é lançada abaixo deste preço de equipamento. */
export const MINIMUM_EQUIPMENT_PRICE = 1_000_000;
/** Manutenção, suporte e o restante do custo mensal partem deste piso. */
export const MINIMUM_MONTHLY_ROBOT_COST = 5_000;

export function equipmentPriceBelowMinimum(equipment: number): boolean {
  return equipment > 0 && equipment < MINIMUM_EQUIPMENT_PRICE;
}

export function monthlyRobotCostBelowMinimum(monthlyCost: number): boolean {
  return monthlyCost > 0 && monthlyCost < MINIMUM_MONTHLY_ROBOT_COST;
}

export function equipmentFloorWarning(equipment: number): string | null {
  if (!equipmentPriceBelowMinimum(equipment)) return null;
  return 'O equipamento informado está abaixo de R$ 1.000.000. Nenhuma configuração do robô custa menos que isso.';
}

export function monthlyRobotCostWarning(monthlyCost: number): string | null {
  if (!monthlyRobotCostBelowMinimum(monthlyCost)) return null;
  return 'O custo mensal informado está abaixo de R$ 5.000. Manutenção, suporte e os demais gastos recorrentes partem desse piso.';
}

/**
 * Exemplo ilustrativo fictício do escopo.
 * Equipamento R$ 1.000.000, investimento líquido R$ 1.195.000,
 * benefício líquido R$ 20.500/mês. O payback passa de 30 meses:
 * o piso do robô não foi compensado com benefício novo.
 * Avarias ficam fora do caixa: as perdas entram uma vez só.
 */
const EXAMPLE: Inputs = {
  fictional: true,
  meta: {
    clientName: 'Rede Aurora (fictícia)',
    storeName: 'Farmácia Aurora — Unidade Centro',
    preparedBy: 'Simulação ilustrativa',
    premiseDate: '2026-10-09',
    source: 'Hipóteses do escopo funcional, não são dados de uma loja real',
    owner: 'Time comercial (exemplo)',
    notes:
      'Todos os valores são fictícios e servem para conferir as fórmulas. Não são parâmetros oficiais da Gollmann. O custo do farmacêutico (R$ 8.500 por pessoa/mês), o do auxiliar (R$ 4.200) e o treinamento por contratação (R$ 6.000) são sugestões a validar, não dados de loja. O turnover sugerido é 30% ao ano. Perdas entram uma vez só: avarias não somam de novo. O equipamento da configuração base é R$ 1.000.000 e o custo mensal do robô é R$ 5.000.',
  },
  assumptions: {
    includePotential: false,
    viewMode: 'avancado',
  },
  profile: {
    storeType: 'nova',
    monthlyRevenue: 850_000,
    contributionMarginPct: 0.32,
    attendancesPerDay: 320,
    dispensationsPerDay: 720,
    operatingDaysPerMonth: 26,
    roles: [
      { id: 'farmaceutico', role: 'Farmacêutico', headcount: 2, monthlyCost: SUGGESTED_PHARMACIST_MONTHLY_COST, shift: '6x1, 1 balcão' },
      { id: 'auxiliar', role: 'Auxiliar de farmácia', headcount: 8, monthlyCost: 4_200, shift: '6x1, 2 turnos' },
      { id: 'estoquista', role: 'Estoquista', headcount: 1, monthlyCost: 3_400, shift: 'Comercial' },
      { id: 'gerente', role: 'Gerente de loja', headcount: 1, monthlyCost: 9_500, shift: 'Comercial' },
    ],
    totalAreaM2: 200,
    backroomAreaM2: 40,
    occupancyCostPerM2: 120,
    averageInventory: 480_000,
    inventoryTurnsPerYear: 8,
    skuCount: 6_500,
    historicalLossesMonthly: 12_000,
    demandGrowthPctPerYear: 0,
    wageGrowthPctPerYear: 0,
    opexInflationPctPerYear: 0,
    priceInflationPctPerYear: 0,
    moneyBasis: 'nominal',
    storeCount: 1,
  },
  people: {
    payroll: {
      enabled: true,
      confidence: 'comprovavel',
      positionsReduced: 3,
      monthlyCostPerPosition: 4_200,
      chargesPct: 0,
      benefitsPerPosition: 0,
      costConfirmedFullyLoaded: true,
      startMonth: 1,
      severanceCost: 12_600,
    },
    journeyHoursPerMonth: 176,
    reallocatedHours: {
      enabled: false,
      confidence: 'potencial',
      hoursPerMonth: 0,
      monetization: 'nenhuma',
      costReductionMonthly: 0,
      incrementalMarginMonthly: 0,
      evidence: false,
    },
    futureHires: {
      enabled: false,
      confidence: 'comprovavel',
      hires: [
        {
          id: 'hire-13',
          role: 'Auxiliar de farmácia',
          month: 13,
          headcount: 1,
          monthlyCost: 4_200,
        },
      ],
    },
    recruitment: {
      enabled: true,
      confidence: 'comprovavel',
      includedInTurnoverCost: true,
      costPerHire: 3_500,
    },
    training: {
      enabled: true,
      confidence: 'comprovavel',
      includedInReplacementCost: true,
      costPerPerson: SUGGESTED_TRAINING_PER_HIRE,
    },
    turnover: {
      enabled: true,
      confidence: 'comprovavel',
      annualRate: 0.3,
      costPerReplacement: 8_000,
      costMode: 'consolidado',
      components: {
        recruitment: 0,
        replacementTraining: 0,
        adaptationLoss: 0,
        termination: 0,
        supervision: 0,
      },
    },
    supervision: {
      enabled: true,
      confidence: 'comprovavel',
      alreadyCountedInPayroll: false,
      hoursSavedPerMonth: 20,
      costPerHour: 45,
    },
    consultativeSales: {
      enabled: true,
      confidence: 'potencial',
      independentEvidence: false,
      hoursFreedPerMonth: 20,
      marginPerHour: 80,
    },
  },
  logistics: {
    boxes: {
      enabled: true,
      confidence: 'potencial',
      processValidated: false,
      cyclesAvoidedPerMonth: 400,
      costPerCycle: 8,
      useDetailed: false,
      cyclesEnabled: true,
      reverseTransportMonthly: 0,
      reverseTransportEnabled: false,
      sanitationMonthly: 0,
      sanitationEnabled: false,
      handlingMonthly: 0,
      handlingEnabled: false,
      lossReplacementMonthly: 0,
      lossReplacementEnabled: false,
      spaceMonthly: 0,
      spaceEnabled: false,
    },
    shelving: {
      enabled: true,
      confidence: 'comprovavel',
      avoidedAcquisition: 40_000,
      resaleValue: 8_000,
      avoidedMaintenanceMonthly: 400,
      stillRequired: false,
      removalCost: 0,
    },
    space: {
      enabled: true,
      confidence: 'comprovavel',
      m2Freed: 16,
      mode: 'ocupacao',
      treatment: 'ocupacao_evitavel',
      contractUnchanged: false,
      occupancyCostPerM2: 200,
      contributionPerM2Month: 150,
      avoidedRealEstate: 0,
      commercialEvidence: false,
    },
    movement: {
      enabled: true,
      confidence: 'comprovavel',
      alreadyCountedInPayroll: false,
      hoursSavedPerMonth: 20,
      costPerHour: 40,
    },
    inventoryCount: {
      enabled: true,
      confidence: 'comprovavel',
      hoursSavedPerMonth: 10,
      costPerHour: 40,
    },
  },
  stock: {
    salesIndependenceConfirmed: false,
    losses: {
      enabled: true,
      confidence: 'comprovavel',
      projectedLossesMonthly: 5_000,
      useDetailed: false,
      expiryMonthly: 0,
      damageMonthly: 0,
      missingMonthly: 0,
      errorsMonthly: 0,
    },
    shrinkage: {
      enabled: false,
      confidence: 'comprovavel',
      avoidedMonthly: 0,
    },
    ruptures: {
      enabled: false,
      confidence: 'potencial',
      independentEvidence: false,
      additionalMonthlySales: 20_000,
    },
    serviceSpeed: {
      enabled: false,
      confidence: 'potencial',
      independentEvidence: false,
      additionalMonthlySales: 10_000,
    },
    abandonment: {
      enabled: false,
      confidence: 'potencial',
      independentEvidence: false,
      additionalMonthlySales: 0,
    },
    workingCapital: {
      enabled: false,
      confidence: 'comprovavel',
      inventoryAfter: 480_000,
      releaseMonth: 3,
      treatment: 'liberacao_caixa',
      costOfCapitalAnnual: 0.12,
      reverseAtHorizon: false,
      reductionProven: false,
    },
  },
  network: {
    enabled: false,
    sharedMonthlyCost: 0,
    stores: [],
  },
  robot: {
    capex: {
      equipment: 1_000_000,
      freightImportTaxes: 60_000,
      installationTraining: 40_000,
      civilElectrical: 50_000,
      integration: 25_000,
      implementationContingency: 60_000,
    },
    opexMonthly: {
      maintenance: 2_800,
      software: 900,
      energy: 500,
      downtime: 300,
      insurance: 300,
      other: 200,
    },
    availabilityPct: 1,
    capacityDispensationsPerDay: 1_200,
    reorganizationEffectiveness: 1,
    automatedStockShare: 1,
    serviceLevel: 1,
    conversionFactor: 1,
    goLiveMonth: 1,
    residualValue: 0,
    depreciationYears: 10,
    includeTax: false,
    taxRate: 0.34,
    taxPolicy: 'sem_impostos',
    lossUtilizationLimit: 0,
    taxCapacityMonthly: 0,
    taxBenefitValidated: false,
    taxValidated: false,
    extraordinaryEventsTaxable: true,
    discountRateAnnual: 0.12,
    discountBasis: 'nominal',
    ramp: { people: [1], logistics: [1], stock: [1], sales: [1] },
    capexSchedule: [{ month: 0, share: 1 }],
    financing: {
      enabled: false,
      downPaymentPct: 0.3,
      termMonths: 48,
      annualInterest: 0.14,
      balloon: 0,
    },
  },
  scenarios: {
    conservador: { benefitFactor: 0.8, opexFactor: 1.15, capexFactor: 1.08, salesFactor: 0.6 },
    base: { benefitFactor: 1, opexFactor: 1, capexFactor: 1, salesFactor: 1 },
    otimista: { benefitFactor: 1.12, opexFactor: 0.92, capexFactor: 0.97, salesFactor: 1.2 },
  },
};

export function exampleInputs(): Inputs {
  return structuredClone(EXAMPLE);
}

export function blankInputs(): Inputs {
  const inputs = exampleInputs();
  inputs.fictional = false;
  inputs.meta = {
    clientName: '',
    storeName: 'Nova simulação',
    preparedBy: '',
    premiseDate: new Date().toISOString().slice(0, 10),
    source: '',
    owner: '',
    notes: '',
  };
  inputs.assumptions.includePotential = false;
  inputs.profile.storeType = 'nova';
  inputs.profile.monthlyRevenue = 0;
  inputs.profile.contributionMarginPct = 0.3;
  inputs.profile.attendancesPerDay = 0;
  inputs.profile.dispensationsPerDay = 0;
  inputs.profile.operatingDaysPerMonth = 26;
  inputs.profile.roles = [
    { id: 'cargo-1', role: 'Auxiliar de farmácia', headcount: 0, monthlyCost: 0, shift: '6x1' },
  ];
  inputs.profile.totalAreaM2 = 0;
  inputs.profile.backroomAreaM2 = 0;
  inputs.profile.occupancyCostPerM2 = 0;
  inputs.profile.averageInventory = 0;
  inputs.profile.inventoryTurnsPerYear = 0;
  inputs.profile.skuCount = 0;
  inputs.profile.historicalLossesMonthly = 0;
  inputs.profile.demandGrowthPctPerYear = 0;
  inputs.profile.storeCount = 1;
  inputs.people.payroll.enabled = false;
  inputs.people.payroll.positionsReduced = 0;
  inputs.people.payroll.monthlyCostPerPosition = 0;
  inputs.people.payroll.severanceCost = 0;
  inputs.people.futureHires.enabled = false;
  inputs.people.futureHires.hires = [];
  inputs.people.recruitment.enabled = false;
  inputs.people.training.enabled = false;
  inputs.people.turnover.enabled = false;
  inputs.people.turnover.annualRate = 0;
  inputs.people.turnover.costPerReplacement = 0;
  inputs.people.supervision.enabled = false;
  inputs.people.supervision.hoursSavedPerMonth = 0;
  inputs.people.consultativeSales.enabled = false;
  inputs.people.consultativeSales.independentEvidence = false;
  inputs.logistics.boxes.enabled = false;
  inputs.logistics.boxes.processValidated = false;
  inputs.logistics.shelving.enabled = false;
  inputs.logistics.shelving.avoidedAcquisition = 0;
  inputs.logistics.shelving.resaleValue = 0;
  inputs.logistics.shelving.avoidedMaintenanceMonthly = 0;
  inputs.logistics.space.enabled = false;
  inputs.logistics.space.m2Freed = 0;
  inputs.logistics.movement.enabled = false;
  inputs.logistics.inventoryCount.enabled = false;
  inputs.stock.losses.enabled = false;
  inputs.stock.shrinkage.enabled = false;
  inputs.stock.ruptures.enabled = false;
  inputs.stock.serviceSpeed.enabled = false;
  inputs.stock.workingCapital.enabled = false;
  inputs.stock.workingCapital.inventoryAfter = 0;
  inputs.stock.workingCapital.reductionProven = false;
  inputs.stock.losses.useDetailed = false;
  inputs.stock.abandonment.enabled = false;
  inputs.people.reallocatedHours.enabled = false;
  inputs.network.enabled = false;
  inputs.network.stores = [];
  inputs.robot.capex = {
    equipment: 0,
    freightImportTaxes: 0,
    installationTraining: 0,
    civilElectrical: 0,
    integration: 0,
    implementationContingency: 0,
  };
  inputs.robot.opexMonthly = {
    maintenance: 0,
    software: 0,
    energy: 0,
    downtime: 0,
    insurance: 0,
    other: 0,
  };
  inputs.robot.residualValue = 0;
  inputs.robot.includeTax = false;
  inputs.robot.financing.enabled = false;
  return inputs;
}

export function matchesIllustrativeExample(result: ModelResult): boolean {
  return (
    result.scenario === 'base' &&
    result.storeType === 'nova' &&
    result.storeCount === 1 &&
    Math.abs(result.netInvestment - 1_195_000) < 1 &&
    Math.abs(result.steadyNet - 20_500) < 1 &&
    result.payback !== null &&
    Math.abs(result.payback - 1_195_000 / 20_500) < 0.05 &&
    result.roi !== null &&
    Math.abs(result.roi - 246_000 / 1_195_000) < 0.000_001
  );
}
