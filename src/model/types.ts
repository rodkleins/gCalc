export const HORIZON_MONTHS = 60;

export type StoreType = 'nova' | 'existente';
export type ScenarioId = 'conservador' | 'base' | 'otimista';
export type Confidence = 'comprovavel' | 'potencial';
export type SpaceMode = 'ocupacao' | 'margem';
export type WorkingCapitalTreatment = 'liberacao_caixa' | 'custo_financeiro';

export interface ScenarioFactors {
  benefitFactor: number;
  opexFactor: number;
  capexFactor: number;
  salesFactor: number;
}

export interface EmployeeRole {
  id: string;
  role: string;
  headcount: number;
  monthlyCost: number;
  shift: string;
}

export interface PlannedHire {
  id: string;
  role: string;
  month: number;
  headcount: number;
  monthlyCost: number;
}

export interface BenefitSwitch {
  enabled: boolean;
  confidence: Confidence;
}

export interface Inputs {
  fictional: boolean;
  meta: {
    clientName: string;
    storeName: string;
    preparedBy: string;
    premiseDate: string;
    source: string;
    owner: string;
    notes: string;
  };
  assumptions: {
    includePotential: boolean;
  };
  profile: {
    storeType: StoreType;
    monthlyRevenue: number;
    contributionMarginPct: number;
    attendancesPerDay: number;
    dispensationsPerDay: number;
    operatingDaysPerMonth: number;
    roles: EmployeeRole[];
    totalAreaM2: number;
    backroomAreaM2: number;
    occupancyCostPerM2: number;
    averageInventory: number;
    inventoryTurnsPerYear: number;
    skuCount: number;
    historicalLossesMonthly: number;
    demandGrowthPctPerYear: number;
    storeCount: number;
  };
  people: {
    payroll: BenefitSwitch & {
      positionsReduced: number;
      monthlyCostPerPosition: number;
      startMonth: number;
      severanceCost: number;
    };
    futureHires: BenefitSwitch & {
      hires: PlannedHire[];
    };
    recruitment: BenefitSwitch & {
      includedInTurnoverCost: boolean;
      costPerHire: number;
    };
    training: BenefitSwitch & {
      includedInReplacementCost: boolean;
      costPerPerson: number;
    };
    turnover: BenefitSwitch & {
      annualRate: number;
      costPerReplacement: number;
    };
    supervision: BenefitSwitch & {
      alreadyCountedInPayroll: boolean;
      hoursSavedPerMonth: number;
      costPerHour: number;
    };
    consultativeSales: BenefitSwitch & {
      independentEvidence: boolean;
      hoursFreedPerMonth: number;
      marginPerHour: number;
    };
  };
  logistics: {
    boxes: BenefitSwitch & {
      processValidated: boolean;
      cyclesAvoidedPerMonth: number;
      costPerCycle: number;
    };
    shelving: BenefitSwitch & {
      avoidedAcquisition: number;
      resaleValue: number;
      avoidedMaintenanceMonthly: number;
    };
    space: BenefitSwitch & {
      m2Freed: number;
      mode: SpaceMode;
      occupancyCostPerM2: number;
      contributionPerM2Month: number;
    };
    movement: BenefitSwitch & {
      alreadyCountedInPayroll: boolean;
      hoursSavedPerMonth: number;
      costPerHour: number;
    };
    inventoryCount: BenefitSwitch & {
      hoursSavedPerMonth: number;
      costPerHour: number;
    };
  };
  stock: {
    salesIndependenceConfirmed: boolean;
    losses: BenefitSwitch & {
      projectedLossesMonthly: number;
    };
    shrinkage: BenefitSwitch & {
      avoidedMonthly: number;
    };
    ruptures: BenefitSwitch & {
      independentEvidence: boolean;
      additionalMonthlySales: number;
    };
    serviceSpeed: BenefitSwitch & {
      independentEvidence: boolean;
      additionalMonthlySales: number;
    };
    workingCapital: BenefitSwitch & {
      inventoryAfter: number;
      releaseMonth: number;
      treatment: WorkingCapitalTreatment;
      costOfCapitalAnnual: number;
      reverseAtHorizon: boolean;
    };
  };
  robot: {
    capex: {
      equipment: number;
      freightImportTaxes: number;
      installationTraining: number;
      civilElectrical: number;
      integration: number;
      implementationContingency: number;
    };
    opexMonthly: {
      maintenance: number;
      software: number;
      energy: number;
      downtime: number;
      insurance: number;
      other: number;
    };
    availabilityPct: number;
    capacityDispensationsPerDay: number;
    goLiveMonth: number;
    residualValue: number;
    depreciationYears: number;
    includeTax: boolean;
    taxRate: number;
    discountRateAnnual: number;
    financing: {
      enabled: boolean;
      downPaymentPct: number;
      termMonths: number;
      annualInterest: number;
      balloon: number;
    };
  };
  scenarios: Record<ScenarioId, ScenarioFactors>;
}

export interface AuditLine {
  id: string;
  module: string;
  label: string;
  kind: 'recorrente' | 'pontual' | 'capital' | 'custo';
  confidence: Confidence | 'nao_se_aplica';
  monthlyValue: number;
  oneTimeValue: number;
  oneTimeMonth: number | null;
  includedInCashFlow: boolean;
  formula: string;
  reason: string;
}

export interface MonthDetail {
  month: number;
  costWithout: number;
  costWith: number;
  salesMargin: number;
  benefit: number;
  opex: number;
  tax: number;
  netOperating: number;
  workingCapital: number;
  severance: number;
  resale: number;
  residual: number;
  oneTime: number;
  incremental: number;
  cumulative: number;
  discountedIncremental: number;
  cumulativeDiscounted: number;
}

export interface FinancingResult {
  enabled: true;
  financedAmount: number;
  monthlyPayment: number;
  termMonths: number;
  balloon: number;
  totalPaid: number;
  interestTotal: number;
  note: string;
}

export interface ModelResult {
  scenario: ScenarioId;
  storeType: StoreType;
  storeCount: number;
  netInvestment: number;
  grossCapex: number;
  avoidedCapex: number;
  monthlyOpex: number;
  steadyBenefit: number;
  steadySales: number;
  steadyNet: number;
  annualSteadyNet: number;
  roi: number | null;
  payback: number | null;
  firstPositiveMonth: number | null;
  discountedPayback: number | null;
  firstPositiveDiscountedMonth: number | null;
  npv: number;
  irrMonthly: number | null;
  irrAnnual: number | null;
  discountRateAnnual: number;
  discountRateMonthly: number;
  cashFlows: number[];
  months: MonthDetail[];
  audit: AuditLine[];
  warnings: string[];
  financing: FinancingResult | null;
  informational: {
    workingCapitalRelease: number;
    financialCostAvoidedAnnual: number;
    workingCapitalIncluded: boolean;
    financialCostIncluded: boolean;
  };
  network: {
    investment: number;
    steadyNet: number;
    npv: number;
  };
}

export interface EvalOptions {
  scenario?: ScenarioId;
  laborFactor?: number;
  turnoverFactor?: number;
  salesFactor?: number;
  volumeFactor?: number;
  capexFactor?: number;
  storeTypeOverride?: StoreType;
}

export type SensitivityDriver = 'investimento' | 'maoDeObra' | 'turnover' | 'vendas' | 'volume';

export interface SensitivityPoint {
  delta: number;
  payback: number | null;
  roi: number | null;
  npv: number;
  steadyNet: number;
}
