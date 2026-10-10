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
  totalArea: number;
  backroom: number;
  capacity: number;
  capex: Inputs['robot']['capex'];
  opex: Inputs['robot']['opexMonthly'];
  severance: number;
}

const NOTE =
  'Modelo fictício para a conversa com o Fabio (DPSP). Não é dado de loja. Troque pelos parâmetros reais. O custo do farmacêutico, o do auxiliar e o treinamento são sugestões a validar. O quadro e a folha crescem com o porte: mais pessoas por cargo, mais turnos e mais balcões. O equipamento parte de R$ 1.000.000. A loja de R$ 2 milhões soma um segundo braço. A de R$ 4 milhões soma segundo braço, carregador automático e módulo refrigerado. O custo mensal do robô fica entre R$ 5.000 e R$ 6.000. O estoque não cai por padrão: o robô pode até aumentá-lo.';

const SHAPES: Shape[] = [
  {
    id: 'loja-1m',
    name: 'Loja de R$ 1 milhão/mês',
    revenue: 1_000_000,
    dispensationsPerDay: 850,
    roles: [
      { id: 'farm', role: 'Farmacêutico', headcount: 2, monthlyCost: SUGGESTED_PHARMACIST_MONTHLY_COST, shift: '6x1, 1 balcão' },
      { id: 'aux', role: 'Auxiliar de farmácia', headcount: 8, monthlyCost: 4_200, shift: '6x1, 2 turnos' },
      { id: 'est', role: 'Estoquista', headcount: 1, monthlyCost: 3_400, shift: 'Comercial' },
      { id: 'ger', role: 'Gerente de loja', headcount: 1, monthlyCost: 9_500, shift: 'Comercial' },
    ],
    positionsReduced: 3,
    positionCost: 4_200,
    futureHeadcount: 1,
    supervisionHours: 24,
    movementHours: 28,
    countHours: 12,
    historicalLosses: 14_000,
    projectedLosses: 6_000,
    shelfMaintenance: 600,
    m2Freed: 16,
    inventory: 480_000,
    totalArea: 180,
    backroom: 40,
    capacity: 1_500,
    capex: {
      equipment: 1_000_000,
      freightImportTaxes: 60_000,
      installationTraining: 40_000,
      civilElectrical: 50_000,
      integration: 25_000,
      implementationContingency: 60_000,
    },
    opex: { maintenance: 2_800, software: 900, energy: 500, downtime: 300, insurance: 300, other: 200 },
    severance: 12_600,
  },
  {
    id: 'loja-2m',
    name: 'Loja de R$ 2 milhões/mês',
    revenue: 2_000_000,
    dispensationsPerDay: 1_700,
    roles: [
      { id: 'farm', role: 'Farmacêutico', headcount: 4, monthlyCost: SUGGESTED_PHARMACIST_MONTHLY_COST, shift: '6x1, 2 balcões' },
      { id: 'aux', role: 'Auxiliar de farmácia', headcount: 16, monthlyCost: 4_200, shift: '6x1, 2 turnos, 2 balcões' },
      { id: 'est', role: 'Estoquista', headcount: 2, monthlyCost: 3_400, shift: 'Comercial' },
      { id: 'ger', role: 'Gerente de loja', headcount: 2, monthlyCost: 9_500, shift: 'Comercial' },
    ],
    positionsReduced: 6,
    positionCost: 4_200,
    futureHeadcount: 2,
    supervisionHours: 40,
    movementHours: 48,
    countHours: 20,
    historicalLosses: 28_000,
    projectedLosses: 12_000,
    shelfMaintenance: 1_000,
    m2Freed: 32,
    inventory: 900_000,
    totalArea: 320,
    backroom: 70,
    capacity: 2_200,
    capex: {
      equipment: 1_350_000,
      freightImportTaxes: 80_000,
      installationTraining: 55_000,
      civilElectrical: 50_000,
      integration: 35_000,
      implementationContingency: 80_000,
    },
    opex: { maintenance: 3_100, software: 950, energy: 550, downtime: 300, insurance: 400, other: 200 },
    severance: 25_200,
  },
  {
    id: 'loja-4m',
    name: 'Loja de R$ 4 milhões/mês',
    revenue: 4_000_000,
    dispensationsPerDay: 3_400,
    roles: [
      { id: 'farm', role: 'Farmacêutico', headcount: 6, monthlyCost: SUGGESTED_PHARMACIST_MONTHLY_COST, shift: '6x1, manhã e tarde, 3 balcões' },
      { id: 'farm-noite', role: 'Farmacêutico', headcount: 2, monthlyCost: 9_400, shift: '6x1, turno noite' },
      { id: 'aux', role: 'Auxiliar de farmácia', headcount: 24, monthlyCost: 4_200, shift: '6x1, 2 turnos, 3 balcões' },
      { id: 'aux-noite', role: 'Auxiliar de farmácia', headcount: 8, monthlyCost: 4_600, shift: '6x1, turno noite' },
      { id: 'est', role: 'Estoquista', headcount: 4, monthlyCost: 3_400, shift: 'Comercial' },
      { id: 'ger', role: 'Gerente de loja', headcount: 3, monthlyCost: 9_500, shift: 'Comercial' },
    ],
    positionsReduced: 9,
    positionCost: 4_200,
    futureHeadcount: 3,
    supervisionHours: 72,
    movementHours: 96,
    countHours: 36,
    historicalLosses: 56_000,
    projectedLosses: 24_000,
    shelfMaintenance: 1_800,
    m2Freed: 56,
    inventory: 1_600_000,
    totalArea: 560,
    backroom: 120,
    capacity: 4_200,
    capex: {
      equipment: 1_850_000,
      freightImportTaxes: 110_000,
      installationTraining: 75_000,
      civilElectrical: 50_000,
      integration: 45_000,
      implementationContingency: 105_000,
    },
    opex: { maintenance: 3_400, software: 1_000, energy: 600, downtime: 350, insurance: 450, other: 200 },
    severance: 37_800,
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
  inputs.profile.totalAreaM2 = shape.totalArea;
  inputs.profile.backroomAreaM2 = shape.backroom;
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
  inputs.robot.capacityDispensationsPerDay = shape.capacity;
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
