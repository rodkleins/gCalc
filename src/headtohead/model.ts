import {
  annualizeMonthlyRate,
  discountedPayback,
  emptyHorizon,
  irr,
  monthlyRateFromAnnual,
  npv,
  simpleAnnualRoi,
  simplePayback,
} from '../model/finance';
import { formatBRL, formatNumber } from '../model/format';
import { round2 } from '../model/round';

export const HEADTOHEAD_SECTIONS = [
  'receita',
  'cmv',
  'ocupacao',
  'logistica',
  'perdas',
  'outras',
  'robo',
  'extra',
] as const;

export type HeadToHeadSection = (typeof HEADTOHEAD_SECTIONS)[number];
export type LineEffect = 'soma' | 'subtrai';

export interface DreLine {
  id: string;
  section: HeadToHeadSection;
  label: string;
  effect: LineEffect;
  today: number;
  withRobot: number;
}

export interface StaffLine {
  id: string;
  role: string;
  todayHeadcount: number;
  withRobotHeadcount: number;
  monthlyCostPerPerson: number;
}

export interface ProductivityIndicator {
  id: string;
  name: string;
  unit: string;
  today: number;
  withRobot: number;
}

export interface HeadToHeadDraft {
  version: 1;
  fictional: boolean;
  storeName: string;
  lines: DreLine[];
  staff: StaffLine[];
  indicators: ProductivityIndicator[];
  investment: number;
  discountRateAnnual: number;
}

export interface SideAmounts {
  today: number;
  withRobot: number;
  delta: number;
}

export interface HeadToHeadView {
  margin: SideAmounts;
  result: SideAmounts;
  monthlyDelta: number;
  annualDelta: number;
  investment: number;
  payback: number | null;
  discountedPayback: number | null;
  roi: number | null;
  npv: number;
  irrMonthly: number | null;
  irrAnnual: number | null;
  cashFlows: number[];
}

const SECTION_SET = new Set<string>(HEADTOHEAD_SECTIONS);

export function exampleDraft(): HeadToHeadDraft {
  return {
    version: 1,
    fictional: true,
    storeName: 'Loja exemplo',
    lines: [
      { id: 'receita', section: 'receita', label: 'Receita da loja', effect: 'soma', today: 1_000_000, withRobot: 1_000_000 },
      { id: 'cmv', section: 'cmv', label: 'CMV', effect: 'subtrai', today: 720_000, withRobot: 720_000 },
      { id: 'ocupacao', section: 'ocupacao', label: 'Aluguel, condomínio e ocupação', effect: 'subtrai', today: 35_000, withRobot: 24_000 },
      { id: 'logistica', section: 'logistica', label: 'Logística e movimentação', effect: 'subtrai', today: 9_500, withRobot: 2_500 },
      { id: 'perdas', section: 'perdas', label: 'Perdas e avarias', effect: 'subtrai', today: 15_000, withRobot: 6_000 },
      { id: 'outras', section: 'outras', label: 'Outras despesas', effect: 'subtrai', today: 40_000, withRobot: 40_000 },
      { id: 'robo', section: 'robo', label: 'Custo mensal do robô', effect: 'subtrai', today: 0, withRobot: 15_000 },
    ],
    staff: [
      { id: 'balcao', role: 'Balcão de medicamentos', todayHeadcount: 8, withRobotHeadcount: 5, monthlyCostPerPerson: 4_200 },
      { id: 'estoque', role: 'Separação e estoque', todayHeadcount: 4, withRobotHeadcount: 1, monthlyCostPerPerson: 3_600 },
      { id: 'caixa', role: 'Caixa', todayHeadcount: 3, withRobotHeadcount: 3, monthlyCostPerPerson: 3_200 },
      { id: 'farmaceutico', role: 'Farmacêutico responsável', todayHeadcount: 2, withRobotHeadcount: 2, monthlyCostPerPerson: 7_500 },
    ],
    indicators: [
      { id: 'caixinhas', name: 'Caixinhas por pessoa', unit: 'por dia', today: 180, withRobot: 320 },
      { id: 'dispensacoes', name: 'Dispensações por hora de balcão', unit: 'por hora', today: 28, withRobot: 46 },
    ],
    investment: 2_000_000,
    discountRateAnnual: 0.12,
  };
}

export function blankLine(id: string): DreLine {
  return { id, section: 'extra', label: 'Nova linha', effect: 'subtrai', today: 0, withRobot: 0 };
}

export function blankStaff(id: string): StaffLine {
  return { id, role: 'Nova função', todayHeadcount: 1, withRobotHeadcount: 1, monthlyCostPerPerson: 0 };
}

export function blankIndicator(id: string): ProductivityIndicator {
  return { id, name: 'Novo indicador', unit: '', today: 0, withRobot: 0 };
}

export function signedLine(line: DreLine, side: 'today' | 'withRobot'): number {
  const raw = finite(side === 'today' ? line.today : line.withRobot);
  return line.effect === 'soma' ? raw : -raw;
}

export function signedStaff(line: StaffLine, side: 'today' | 'withRobot'): number {
  const heads = Math.max(0, finite(side === 'today' ? line.todayHeadcount : line.withRobotHeadcount));
  const cost = Math.max(0, finite(line.monthlyCostPerPerson));
  return -(heads * cost);
}

export function evaluateHeadToHead(draft: HeadToHeadDraft): HeadToHeadView {
  const margin = sumSides(
    draft.lines.filter((line) => line.section === 'receita' || line.section === 'cmv').map((line) => sidesOf(line)),
  );
  const lineSides = draft.lines.map((line) => sidesOf(line));
  const staffSides = draft.staff.map((line) => ({
    today: signedStaff(line, 'today'),
    withRobot: signedStaff(line, 'withRobot'),
  }));
  const result = sumSides([...lineSides, ...staffSides]);
  const monthlyDelta = round2(result.delta);
  const annualDelta = round2(monthlyDelta * 12);
  const investment = Math.max(0, round2(finite(draft.investment)));
  const opening = investment === 0 ? 0 : -investment;
  const cashFlows = [opening, ...emptyHorizon(monthlyDelta)];
  const discountMonthly = monthlyRateFromAnnual(finite(draft.discountRateAnnual));
  const present = Number.isFinite(discountMonthly) ? round2(npv(discountMonthly, cashFlows)) : Number.NaN;
  const irrMonthly = irr(cashFlows);
  return {
    margin,
    result,
    monthlyDelta,
    annualDelta,
    investment,
    payback: simplePayback(cashFlows),
    discountedPayback: Number.isFinite(discountMonthly) ? discountedPayback(cashFlows, discountMonthly) : null,
    roi: simpleAnnualRoi(annualDelta, investment),
    npv: present,
    irrMonthly,
    irrAnnual: irrMonthly === null ? null : annualizeMonthlyRate(irrMonthly),
    cashFlows,
  };
}

export function formatImpact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.5) return formatBRL(0);
  return `${value > 0 ? '+' : '−'}${formatBRL(Math.abs(value))}`;
}

export function formatIndicatorDelta(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const digits = Number.isInteger(value) ? 0 : 1;
  if (Math.abs(value) < 0.05) return formatNumber(0, digits);
  return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value), digits)}`;
}

export function sectionTitle(section: HeadToHeadSection): string {
  if (section === 'receita') return 'Receita';
  if (section === 'cmv') return 'CMV';
  if (section === 'ocupacao') return 'Ocupação';
  if (section === 'logistica') return 'Logística';
  if (section === 'perdas') return 'Perdas';
  if (section === 'outras') return 'Outras despesas';
  if (section === 'robo') return 'Robô';
  return 'Linhas da rede';
}

export function isHeadToHeadSection(value: string): value is HeadToHeadSection {
  return SECTION_SET.has(value);
}

function sidesOf(line: DreLine): { today: number; withRobot: number } {
  return { today: signedLine(line, 'today'), withRobot: signedLine(line, 'withRobot') };
}

function sumSides(rows: Array<{ today: number; withRobot: number }>): SideAmounts {
  const today = round2(rows.reduce((total, row) => total + row.today, 0));
  const withRobot = round2(rows.reduce((total, row) => total + row.withRobot, 0));
  return { today, withRobot, delta: round2(withRobot - today) };
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
