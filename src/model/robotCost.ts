import { formatBRL } from './format';
import { round2 } from './round';
import type { Inputs, RobotEnergy } from './types';

/** Suporte pago à fornecedora. A faixa vale só para este campo. */
export const DEFAULT_SUPPORT_MONTHLY = 5_500;
export const SUPPORT_MIN = 5_000;
export const SUPPORT_MAX = 6_000;

/** Potência, jornada e tarifa com impostos. O custo sai da conta, não de um valor digitado. */
export const DEFAULT_ENERGY: RobotEnergy = {
  powerKw: 2.5,
  hoursPerDay: 16,
  daysPerMonth: 30,
  tariffPerKwh: 1.17,
};

const REMOVED_OPEX: Array<[string, string]> = [
  ['software', 'Software, conectividade e monitoramento'],
  ['downtime', 'Indisponibilidade e contingência'],
  ['insurance', 'Seguros'],
];

export function energyConsumptionKwh(energy: RobotEnergy): number {
  return round2(Math.max(0, energy.powerKw) * Math.max(0, energy.hoursPerDay) * Math.max(0, energy.daysPerMonth));
}

export function energyMonthlyCost(energy: RobotEnergy): number {
  return round2(energyConsumptionKwh(energy) * Math.max(0, energy.tariffPerKwh));
}

/** Suporte + outros custos + energia calculada, antes do fator de cenário e da inflação. */
export function informedMonthlyRobotCost(robot: Inputs['robot']): number {
  return round2(robot.opexMonthly.maintenance + robot.opexMonthly.other + energyMonthlyCost(robot.energy));
}

export function normalizeEnergy(value: unknown): RobotEnergy {
  const record = isRecord(value) ? value : {};
  const num = (key: keyof RobotEnergy, fallback: number) => {
    const raw = record[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
    return Math.max(0, raw);
  };
  return {
    powerKw: num('powerKw', DEFAULT_ENERGY.powerKw),
    hoursPerDay: num('hoursPerDay', DEFAULT_ENERGY.hoursPerDay),
    daysPerMonth: num('daysPerMonth', DEFAULT_ENERGY.daysPerMonth),
    tariffPerKwh: num('tariffPerKwh', DEFAULT_ENERGY.tariffPerKwh),
  };
}

/** Descarta os campos antigos e troca energia em reais pelos parâmetros padrão. */
export function normalizeRobotCost(robot: Inputs['robot']): void {
  const opex = robot.opexMonthly as Inputs['robot']['opexMonthly'] & { energy?: unknown };
  const legacyEnergy = opex.energy;
  const maintenance = opex.maintenance;
  const other = opex.other;
  robot.opexMonthly = {
    maintenance: typeof maintenance === 'number' && Number.isFinite(maintenance) ? maintenance : DEFAULT_SUPPORT_MONTHLY,
    other: typeof other === 'number' && Number.isFinite(other) ? other : 0,
  };
  const current = robot.energy as unknown;
  if (typeof legacyEnergy === 'number' || !isEnergyRecord(current)) {
    robot.energy = { ...DEFAULT_ENERGY };
    return;
  }
  robot.energy = normalizeEnergy(current);
}

/**
 * Avisos da importação, lidos no JSON cru, antes da normalização apagar os campos.
 * Sessão já salva neste navegador migra em silêncio.
 */
export function opexMigrationWarnings(raw: unknown): string[] {
  const robot = robotOf(raw);
  if (!robot || !isRecord(robot.opexMonthly)) return [];
  const opex = robot.opexMonthly;
  const messages: string[] = [];
  const removed = REMOVED_OPEX.filter(([key]) => Object.prototype.hasOwnProperty.call(opex, key));
  if (removed.length > 0) {
    messages.push(
      `Campos removidos do custo mensal foram descartados: ${removed.map(([, label]) => label).join(', ')}. Eles não entram mais no cálculo.`,
    );
  }
  if (typeof opex.energy === 'number' && Number.isFinite(opex.energy)) {
    messages.push(
      `A energia antiga de ${formatBRL(opex.energy)} por mês foi substituída pelos parâmetros padrão: 2,5 kW, 16 h/dia, 30 dias e R$ 1,17/kWh.`,
    );
  }
  const maintenance = opex.maintenance;
  if (typeof maintenance === 'number' && Number.isFinite(maintenance) && maintenance > 0 && (maintenance < SUPPORT_MIN || maintenance > SUPPORT_MAX)) {
    messages.push(
      `O suporte pago à fornecedora importado (${formatBRL(maintenance)}) ficou fora da faixa de R$ 5.000 a R$ 6.000 e foi mantido.`,
    );
  }
  return messages;
}

/** Escala suporte, outros custos e a tarifa. Potência, horas e dias ficam. */
export function scaleRobotMonthlyCost(robot: Inputs['robot'], factor: number): Inputs['robot'] {
  const maintenance0 = robot.opexMonthly.maintenance;
  const other0 = robot.opexMonthly.other;
  const energy0 = energyMonthlyCost(robot.energy);
  const base = maintenance0 + other0 + energy0;
  if (!(base > 0)) {
    return {
      ...robot,
      opexMonthly: { ...robot.opexMonthly, maintenance: round2(Math.max(0, base * factor)) },
    };
  }
  const target = round2(base * factor);
  let maintenance = round2(maintenance0 * factor);
  let other = round2(other0 * factor);
  const consumption = energyConsumptionKwh(robot.energy);
  let energy = round2(energy0 * factor);
  let tariff = robot.energy.tariffPerKwh * factor;
  const drift = round2(target - (maintenance + other + energy));
  if (drift !== 0) {
    if (consumption > 0) {
      energy = round2(energy + drift);
      tariff = energy / consumption;
    } else if (maintenance0 >= other0) {
      maintenance = Math.max(0, round2(maintenance + drift));
    } else {
      other = Math.max(0, round2(other + drift));
    }
  }
  return {
    ...robot,
    opexMonthly: { maintenance: Math.max(0, maintenance), other: Math.max(0, other) },
    energy: { ...robot.energy, tariffPerKwh: Math.max(0, tariff) },
  };
}

function robotOf(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  if (isRecord(raw.robot)) return raw.robot;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnergyRecord(value: unknown): boolean {
  return isRecord(value) && typeof value.powerKw === 'number' && Number.isFinite(value.powerKw);
}
