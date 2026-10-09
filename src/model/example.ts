import type { Inputs, ModelResult } from './types';

/**
 * Exemplo ilustrativo fictício do escopo.
 * Investimento líquido R$ 2.000.000, benefício líquido R$ 65.000/mês,
 * payback interpolado de 30,8 meses e ROI anual simples de 39%.
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
      'Todos os valores são fictícios e servem para conferir as fórmulas. Não são parâmetros oficiais da Gollmann.',
  },
  assumptions: {
    includePotential: false,
  },
  profile: {
    storeType: 'nova',
    monthlyRevenue: 850_000,
    contributionMarginPct: 0.32,
    attendancesPerDay: 420,
    dispensationsPerDay: 900,
    operatingDaysPerMonth: 26,
    roles: [
      { id: 'farmaceutico', role: 'Farmacêutico', headcount: 3, monthlyCost: 14_500, shift: '6x1' },
      { id: 'auxiliar', role: 'Auxiliar de farmácia', headcount: 10, monthlyCost: 9_200, shift: '6x1' },
      { id: 'estoquista', role: 'Estoquista', headcount: 2, monthlyCost: 6_800, shift: 'Comercial' },
      { id: 'gerente', role: 'Gerente de loja', headcount: 1, monthlyCost: 16_000, shift: 'Comercial' },
    ],
    totalAreaM2: 280,
    backroomAreaM2: 70,
    occupancyCostPerM2: 120,
    averageInventory: 480_000,
    inventoryTurnsPerYear: 8,
    skuCount: 6_500,
    historicalLossesMonthly: 18_000,
    demandGrowthPctPerYear: 0,
    storeCount: 1,
  },
  people: {
    payroll: {
      enabled: true,
      confidence: 'comprovavel',
      positionsReduced: 6,
      monthlyCostPerPosition: 9_200,
      startMonth: 1,
      severanceCost: 18_000,
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
          monthlyCost: 9_200,
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
      costPerPerson: 2_500,
    },
    turnover: {
      enabled: true,
      confidence: 'comprovavel',
      annualRate: 0.2,
      costPerReplacement: 12_000,
    },
    supervision: {
      enabled: true,
      confidence: 'comprovavel',
      alreadyCountedInPayroll: false,
      hoursSavedPerMonth: 40,
      costPerHour: 50,
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
    },
    shelving: {
      enabled: true,
      confidence: 'comprovavel',
      avoidedAcquisition: 180_000,
      resaleValue: 25_000,
      avoidedMaintenanceMonthly: 1_500,
    },
    space: {
      enabled: true,
      confidence: 'comprovavel',
      m2Freed: 20,
      mode: 'ocupacao',
      occupancyCostPerM2: 200,
      contributionPerM2Month: 150,
    },
    movement: {
      enabled: true,
      confidence: 'comprovavel',
      alreadyCountedInPayroll: false,
      hoursSavedPerMonth: 32,
      costPerHour: 50,
    },
    inventoryCount: {
      enabled: true,
      confidence: 'comprovavel',
      hoursSavedPerMonth: 20,
      costPerHour: 50,
    },
  },
  stock: {
    salesIndependenceConfirmed: false,
    losses: {
      enabled: true,
      confidence: 'comprovavel',
      projectedLossesMonthly: 8_000,
    },
    shrinkage: {
      enabled: true,
      confidence: 'comprovavel',
      avoidedMonthly: 5_000,
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
    workingCapital: {
      enabled: false,
      confidence: 'comprovavel',
      inventoryAfter: 350_000,
      releaseMonth: 3,
      treatment: 'liberacao_caixa',
      costOfCapitalAnnual: 0.12,
      reverseAtHorizon: false,
    },
  },
  robot: {
    capex: {
      equipment: 1_750_000,
      freightImportTaxes: 140_000,
      installationTraining: 90_000,
      civilElectrical: 70_000,
      integration: 50_000,
      implementationContingency: 80_000,
    },
    opexMonthly: {
      maintenance: 8_000,
      software: 3_200,
      energy: 1_500,
      downtime: 700,
      insurance: 1_100,
      other: 500,
    },
    availabilityPct: 1,
    capacityDispensationsPerDay: 1_500,
    goLiveMonth: 1,
    residualValue: 0,
    depreciationYears: 10,
    includeTax: false,
    taxRate: 0.34,
    discountRateAnnual: 0.12,
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
    Math.abs(result.netInvestment - 2_000_000) < 1 &&
    Math.abs(result.steadyNet - 65_000) < 1 &&
    result.payback !== null &&
    Math.abs(result.payback - 2_000_000 / 65_000) < 0.05 &&
    result.roi !== null &&
    Math.abs(result.roi - 0.39) < 0.000_001
  );
}
