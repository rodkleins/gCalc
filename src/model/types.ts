export const HORIZON_MONTHS = 60;

export type StoreType = 'nova' | 'existente';
export type ScenarioId = 'conservador' | 'base' | 'otimista';
export type Confidence = 'comprovavel' | 'potencial';
export type SpaceMode = 'ocupacao' | 'margem';
export type SpaceTreatment =
  | 'aluguel_evitado'
  | 'ocupacao_evitavel'
  | 'expansao_comercial'
  | 'sem_monetizacao'
  | 'investimento_imobiliario';
export type WorkingCapitalTreatment = 'liberacao_caixa' | 'custo_financeiro';
export type TaxPolicy =
  | 'sem_impostos'
  | 'incremental_simplificado'
  | 'prejuizo_com_limite'
  | 'beneficio_condicionado';
export type ViewMode = 'simples' | 'avancado';
export type MoneyBasis = 'nominal' | 'real';
export type TurnoverCostMode = 'consolidado' | 'detalhado';
export type HourMonetization = 'nenhuma' | 'reducao_custo' | 'ganho_incremental';

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

export interface NetworkStore {
  id: string;
  name: string;
  storeType: StoreType;
  count: number;
  goLiveMonth: number;
  investmentFactor: number;
  volumeFactor: number;
  laborFactor: number;
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
    viewMode: ViewMode;
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
    wageGrowthPctPerYear: number;
    opexInflationPctPerYear: number;
    priceInflationPctPerYear: number;
    moneyBasis: MoneyBasis;
    storeCount: number;
  };
  people: {
    payroll: BenefitSwitch & {
      positionsReduced: number;
      monthlyCostPerPosition: number;
      chargesPct: number;
      benefitsPerPosition: number;
      costConfirmedFullyLoaded: boolean;
      startMonth: number;
      severanceCost: number;
    };
    journeyHoursPerMonth: number;
    reallocatedHours: BenefitSwitch & {
      hoursPerMonth: number;
      monetization: HourMonetization;
      costReductionMonthly: number;
      incrementalMarginMonthly: number;
      evidence: boolean;
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
      costMode: TurnoverCostMode;
      components: {
        recruitment: number;
        replacementTraining: number;
        adaptationLoss: number;
        termination: number;
        supervision: number;
      };
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
      useDetailed: boolean;
      cyclesEnabled: boolean;
      reverseTransportMonthly: number;
      reverseTransportEnabled: boolean;
      sanitationMonthly: number;
      sanitationEnabled: boolean;
      handlingMonthly: number;
      handlingEnabled: boolean;
      lossReplacementMonthly: number;
      lossReplacementEnabled: boolean;
      spaceMonthly: number;
      spaceEnabled: boolean;
    };
    shelving: BenefitSwitch & {
      avoidedAcquisition: number;
      resaleValue: number;
      avoidedMaintenanceMonthly: number;
      stillRequired: boolean;
      removalCost: number;
    };
    space: BenefitSwitch & {
      m2Freed: number;
      mode: SpaceMode;
      treatment: SpaceTreatment;
      contractUnchanged: boolean;
      occupancyCostPerM2: number;
      contributionPerM2Month: number;
      avoidedRealEstate: number;
      commercialEvidence: boolean;
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
      useDetailed: boolean;
      expiryMonthly: number;
      damageMonthly: number;
      missingMonthly: number;
      errorsMonthly: number;
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
    abandonment: BenefitSwitch & {
      independentEvidence: boolean;
      additionalMonthlySales: number;
    };
    workingCapital: BenefitSwitch & {
      inventoryAfter: number;
      releaseMonth: number;
      treatment: WorkingCapitalTreatment;
      costOfCapitalAnnual: number;
      reverseAtHorizon: boolean;
      reductionProven: boolean;
    };
  };
  network: {
    enabled: boolean;
    sharedMonthlyCost: number;
    stores: NetworkStore[];
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
    reorganizationEffectiveness: number;
    automatedStockShare: number;
    serviceLevel: number;
    conversionFactor: number;
    goLiveMonth: number;
    residualValue: number;
    depreciationYears: number;
    includeTax: boolean;
    taxRate: number;
    taxPolicy: TaxPolicy;
    lossUtilizationLimit: number;
    taxCapacityMonthly: number;
    taxBenefitValidated: boolean;
    taxValidated: boolean;
    extraordinaryEventsTaxable: boolean;
    discountRateAnnual: number;
    discountBasis: MoneyBasis;
    ramp: {
      people: number[];
      logistics: number[];
      stock: number[];
      sales: number[];
    };
    capexSchedule: Array<{ month: number; share: number }>;
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
  unit: string;
  dataOrigin: string;
  condition: string;
  startMonth: number | null;
  captureFactor: number;
  accumulatedValue: number;
  dependencies: string[];
  conflicts: string[];
}

export interface MonthDetail {
  month: number;
  costWithout: number;
  costWith: number;
  salesMargin: number;
  benefit: number;
  opex: number;
  accountingResult: number;
  taxableBase: number;
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
  projectNpv: number;
  projectIrrAnnual: number | null;
  equityCashFlows: number[];
  equityIrrAnnual: number | null;
  debtServiceMonthly: number;
  debtBalanceByMonth: number[];
  totalFinancialCost: number;
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
  indicators: FinancialIndicators;
  network: {
    investment: number;
    steadyNet: number;
    npv: number;
    mode: 'replicacao' | 'escalonada';
    sharedMonthlyCost: number;
    stores: NetworkStoreResult[];
  };
}

export interface FinancialIndicators {
  stabilizedAnnualReturn: number | null;
  cumulativeRoi: number | null;
  simplePayback: number | null;
  discountedPayback: number | null;
  npv: number;
  irrAnnualEffective: number | null;
  irrAmbiguous: boolean;
  cumulativeCash: number;
  cumulativeDiscountedCash: number;
  annualOperatingBenefit: number;
  accumulatedSavings: number;
  totalNetInvestment: number;
}

export interface NetworkStoreResult {
  id: string;
  name: string;
  count: number;
  goLiveMonth: number;
  payback: number | null;
  npv: number;
  netInvestment: number;
  steadyNet: number;
}

export interface EvalOptions {
  scenario?: ScenarioId;
  laborFactor?: number;
  turnoverFactor?: number;
  salesFactor?: number;
  volumeFactor?: number;
  capexFactor?: number;
  storeTypeOverride?: StoreType;
  /** Evita recursão quando a rede consolidada reavalia cada loja. */
  skipNetwork?: boolean;
}

export type SensitivityDriver =
  | 'investimento'
  | 'opex'
  | 'maoDeObra'
  | 'turnover'
  | 'vendas'
  | 'volume'
  | 'desconto'
  | 'disponibilidade'
  | 'cobertura';

export interface SensitivityPoint {
  delta: number;
  payback: number | null;
  roi: number | null;
  npv: number;
  steadyNet: number;
}
