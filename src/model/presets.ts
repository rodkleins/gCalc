import { exampleInputs, SUGGESTED_PHARMACIST_MONTHLY_COST, SUGGESTED_TRAINING_PER_HIRE } from './example';
import type { EmployeeRole, Inputs } from './types';

export interface StorePreset {
  id: 'loja-1m' | 'loja-2m' | 'loja-4m';
  name: string;
  revenue: number;
  inputs: Inputs;
}

interface Shape {
  id: StorePreset['id'];
  name: string;
  revenue: number;
  dispensationsPerDay: number;
  roles: EmployeeRole[];
  positionsReduced: number;
  positionCost: number;
  futureHeadcount: number;
  supervisionHours: number;
  movementHours: number;
  countHours: number;
  historicalLosses: number;
  projectedLosses: number;
  shelfMaintenance: number;
  m2Freed: number;
  inventory: number;
  capex: Inputs['robot']['capex'];
  opex: Inputs['robot']['opexMonthly'];
  severance: number;
}

const NOTE =
  'Modelo fictício para a conversa com o Fabio (DPSP). Não é dado de loja. Troque pelos parâmetros reais. O custo do farmacêutico e o treinamento são sugestões a validar. O investimento do robô é independente do faturamento. O estoque não cai por padrão: o robô pode até aumentá-lo.';

const SHAPES: Shape[] = [
  {
    id: 'loja-1m',
    name: 'Loja de R$ 1 milhão/mês',
    revenue: 1_000_000,
    dispensationsPerDay: 800,
    roles: [
      { id: 'farm', role: 'Farmacêutico', headcount: 2, monthlyCost: SUGGESTED_PHARMACIST_MONTHLY_COST, shift: '6x1' },
      { id: 'aux', role: 'Auxiliar de farmácia', headcount: 6, monthlyCost: 4_200, shift: '6x1' },
      { id: 'est', role: 'Estoquista', headcount: 1, monthlyCost: 3_400, shift: 'Comercial' },
      { id: 'ger', role: 'Gerente de loja', headcount: 1, monthlyCost: 9_500, shift: 'Comercial' },
    ],
    positionsReduced: 2,
    positionCost: 4_200,
    futureHeadcount: 1,
    supervisionHours: 16,
    movementHours: 20,
    countHours: 8,
    historicalLosses: 12_000,
    projectedLosses: 6_000,
    shelfMaintenance: 800,
    m2Freed: 12,
    inventory: 550_000,
    capex: {
      equipment: 1_350_000,
      freightImportTaxes: 80_000,
      installationTraining: 60_000,
      civilElectrical: 50_000,
      integration: 30_000,
      implementationContingency: 40_000,
    },
    opex: { maintenance: 4_500, software: 1_800, energy: 900, downtime: 400, insurance: 600, other: 300 },
    severance: 8_000,
  },
  {
    id: 'loja-2m',
    name: 'Loja de R$ 2 milhões/mês',
    revenue: 2_000_000,
    dispensationsPerDay: 1_500,
    roles: [
      { id: 'farm', role: 'Farmacêutico', headcount: 3, monthlyCost: SUGGESTED_PHARMACIST_MONTHLY_COST, shift: '6x1' },
      { id: 'aux', role: 'Auxiliar de farmácia', headcount: 12, monthlyCost: 4_200, shift: '6x1' },
      { id: 'est', role: 'Estoquista', headcount: 2, monthlyCost: 3_400, shift: 'Comercial' },
      { id: 'ger', role: 'Gerente de loja', headcount: 1, monthlyCost: 9_500, shift: 'Comercial' },
    ],
    positionsReduced: 4,
    positionCost: 4_200,
    futureHeadcount: 2,
    supervisionHours: 28,
    movementHours: 36,
    countHours: 14,
    historicalLosses: 22_000,
    projectedLosses: 10_000,
    shelfMaintenance: 1_400,
    m2Freed: 24,
    inventory: 1_000_000,
    capex: {
      equipment: 1_750_000,
      freightImportTaxes: 100_000,
      installationTraining: 80_000,
      civilElectrical: 50_000,
      integration: 40_000,
      implementationContingency: 60_000,
    },
    opex: { maintenance: 6_000, software: 2_400, energy: 1_200, downtime: 500, insurance: 800, other: 400 },
    severance: 16_000,
  },
  {
    id: 'loja-4m',
    name: 'Loja de R$ 4 milhões/mês',
    revenue: 4_000_000,
    dispensationsPerDay: 2_800,
    roles: [
      { id: 'farm', role: 'Farmacêutico', headcount: 5, monthlyCost: SUGGESTED_PHARMACIST_MONTHLY_COST, shift: '6x1' },
      { id: 'aux', role: 'Auxiliar de farmácia', headcount: 20, monthlyCost: 4_200, shift: '6x1' },
      { id: 'est', role: 'Estoquista', headcount: 4, monthlyCost: 3_400, shift: 'Comercial' },
      { id: 'ger', role: 'Gerente de loja', headcount: 2, monthlyCost: 9_500, shift: 'Comercial' },
    ],
    positionsReduced: 8,
    positionCost: 4_200,
    futureHeadcount: 3,
    supervisionHours: 48,
    movementHours: 60,
    countHours: 24,
    historicalLosses: 40_000,
    projectedLosses: 18_000,
    shelfMaintenance: 2_200,
    m2Freed: 48,
    inventory: 1_900_000,
    capex: {
      equipment: 2_200_000,
      freightImportTaxes: 120_000,
      installationTraining: 100_000,
      civilElectrical: 50_000,
      integration: 50_000,
      implementationContingency: 80_000,
    },
    opex: { maintenance: 8_000, software: 3_200, energy: 1_600, downtime: 700, insurance: 1_000, other: 500 },
    severance: 28_000,
  },
];

function fromShape(shape: Shape): Inputs {
  const inputs = exampleInputs();
  inputs.fictional = true;
  inputs.meta = {
    clientName: 'DPSP (modelo fictício)',
    storeName: shape.name,
    preparedBy: 'Sugestão comercial',
    premiseDate: '2026-10-09',
    source: 'Modelo fictício. Aguardando os parâmetros reais do Fabio.',
    owner: 'A validar',
    notes: NOTE,
  };
  inputs.profile.storeType = 'existente';
  inputs.profile.monthlyRevenue = shape.revenue;
  inputs.profile.contributionMarginPct = 0.3;
  inputs.profile.attendancesPerDay = Math.round(shape.dispensationsPerDay * 0.45);
  inputs.profile.dispensationsPerDay = shape.dispensationsPerDay;
  inputs.profile.roles = shape.roles;
  inputs.profile.averageInventory = shape.inventory;
  inputs.profile.historicalLossesMonthly = shape.historicalLosses;
  inputs.profile.totalAreaM2 = shape.m2Freed * 8;
  inputs.profile.backroomAreaM2 = shape.m2Freed;
  inputs.people.payroll.enabled = true;
  inputs.people.payroll.confidence = 'comprovavel';
  inputs.people.payroll.positionsReduced = shape.positionsReduced;
  inputs.people.payroll.monthlyCostPerPosition = shape.positionCost;
  inputs.people.payroll.chargesPct = 0;
  inputs.people.payroll.benefitsPerPosition = 0;
  inputs.people.payroll.costConfirmedFullyLoaded = true;
  inputs.people.payroll.startMonth = 1;
  inputs.people.payroll.severanceCost = shape.severance;
  inputs.people.futureHires = {
    enabled: true,
    confidence: 'comprovavel',
    hires: [
      {
        id: 'hire-13',
        role: 'Auxiliar de farmácia',
        month: 13,
        headcount: shape.futureHeadcount,
        monthlyCost: shape.positionCost,
      },
    ],
  };
  inputs.people.training.costPerPerson = SUGGESTED_TRAINING_PER_HIRE;
  inputs.people.training.includedInReplacementCost = true;
  inputs.people.recruitment.includedInTurnoverCost = true;
  inputs.people.turnover.enabled = true;
  inputs.people.turnover.annualRate = 0.3;
  inputs.people.turnover.costMode = 'consolidado';
  inputs.people.turnover.costPerReplacement = 8_000;
  inputs.people.supervision.enabled = true;
  inputs.people.supervision.hoursSavedPerMonth = shape.supervisionHours;
  inputs.people.supervision.costPerHour = 45;
  inputs.people.supervision.alreadyCountedInPayroll = false;
  inputs.people.consultativeSales.enabled = false;
  inputs.people.consultativeSales.independentEvidence = false;
  inputs.people.reallocatedHours.enabled = false;
  inputs.logistics.boxes.enabled = false;
  inputs.logistics.boxes.processValidated = false;
  inputs.logistics.shelving.enabled = true;
  inputs.logistics.shelving.avoidedAcquisition = 0;
  inputs.logistics.shelving.resaleValue = 0;
  inputs.logistics.shelving.avoidedMaintenanceMonthly = shape.shelfMaintenance;
  inputs.logistics.shelving.stillRequired = false;
  inputs.logistics.shelving.removalCost = 0;
  inputs.logistics.space.enabled = true;
  inputs.logistics.space.m2Freed = shape.m2Freed;
  inputs.logistics.space.mode = 'ocupacao';
  inputs.logistics.space.treatment = 'sem_monetizacao';
  inputs.logistics.space.contractUnchanged = true;
  inputs.logistics.space.commercialEvidence = false;
  inputs.logistics.movement.enabled = true;
  inputs.logistics.movement.alreadyCountedInPayroll = false;
  inputs.logistics.movement.hoursSavedPerMonth = shape.movementHours;
  inputs.logistics.movement.costPerHour = 40;
  inputs.logistics.inventoryCount.enabled = true;
  inputs.logistics.inventoryCount.hoursSavedPerMonth = shape.countHours;
  inputs.logistics.inventoryCount.costPerHour = 40;
  inputs.stock.losses.enabled = true;
  inputs.stock.losses.useDetailed = false;
  inputs.stock.losses.projectedLossesMonthly = shape.projectedLosses;
  inputs.stock.shrinkage.enabled = false;
  inputs.stock.shrinkage.avoidedMonthly = 0;
  inputs.stock.ruptures.enabled = false;
  inputs.stock.serviceSpeed.enabled = false;
  inputs.stock.abandonment.enabled = false;
  inputs.stock.workingCapital.enabled = false;
  inputs.stock.workingCapital.reductionProven = false;
  inputs.stock.workingCapital.inventoryAfter = shape.inventory;
  inputs.robot.capex = shape.capex;
  inputs.robot.opexMonthly = shape.opex;
  inputs.robot.capacityDispensationsPerDay = Math.max(shape.dispensationsPerDay, 1_500);
  inputs.network.enabled = false;
  inputs.network.stores = [];
  return inputs;
}

export function storePresets(): StorePreset[] {
  return SHAPES.map((shape) => ({
    id: shape.id,
    name: shape.name,
    revenue: shape.revenue,
    inputs: fromShape(shape),
  }));
}
