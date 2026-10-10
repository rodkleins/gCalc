import type { Inputs, PlannedHire } from '../model/types';

/** Escala de trabalho. A presença é a fração do ano em que a pessoa está no posto. */
export type ScaleId = '6x1' | '5x2' | '12x36';
export type ShiftCount = 2 | 3;

export const SCALE_PRESENCE: Record<ScaleId, number> = {
  '6x1': 6 / 7,
  '5x2': 5 / 7,
  '12x36': 12 / 48,
};

export const DEFAULT_YEAR_DAYS = 365;
export const DEFAULT_VACATION_DAYS = 30;
export const DEFAULT_ABSENCE_DAYS = 6;
/** 10%. Só multiplica o terceiro turno, e só quando a loja tem 3 turnos. */
export const DEFAULT_NIGHT_PREMIUM = 0.1;
export const FUTURE_HIRE_MONTH = 13;

export interface RosterCalendar {
  yearDays: number;
  vacationDays: number;
  absenceDays: number;
}

export interface RosterPost {
  id: string;
  role: string;
  counter: string;
  scale: ScaleId;
  /** Custo completo por pessoa presente, R$/mês, sem o adicional noturno. */
  monthlyCost: number;
  /** Pessoas no posto em cada turno: [1, 2, noite]. */
  onDuty: [number, number, number];
  /** Posições que o robô libera em cada turno. Não passa de quem está no posto. */
  freed: [number, number, number];
  /** Contratações futuras que a loja abriria em cada turno, a partir do mês 13. */
  future: [number, number, number];
  /** null usa o fator sugerido da escala. */
  coverageOverride: number | null;
}

export interface Roster {
  shiftCount: ShiftCount;
  nightPremiumPct: number;
  yearDays: number;
  vacationDays: number;
  absenceDays: number;
  posts: RosterPost[];
}

export interface ShiftSnapshot {
  present: number;
  hired: number;
  folguista: number;
  payroll: number;
  freedPresent: number;
  avoidedHired: number;
  avoidedPayroll: number;
  futureSeats: number;
  futureHired: number;
  futurePayroll: number;
}

export interface RosterSummary {
  shifts: ShiftSnapshot[];
  present: number;
  hired: number;
  folguista: number;
  payroll: number;
  avoidedHired: number;
  avoidedPayroll: number;
  futureHired: number;
  futurePayroll: number;
  /** Um mês da folha evitada agora, já com folguista e adicional noturno. */
  severance: number;
}

export function shiftName(index: number, shiftCount: ShiftCount): string {
  if (index === 2 && shiftCount === 3) return 'Turno da noite';
  return `Turno ${index + 1}`;
}

export function scaleLabel(scale: ScaleId): string {
  if (scale === '5x2') return '5x2';
  if (scale === '12x36') return '12x36';
  return '6x1';
}

export function productiveDays(scale: ScaleId, calendar: RosterCalendar): number {
  return calendar.yearDays * SCALE_PRESENCE[scale] - calendar.vacationDays - calendar.absenceDays;
}

/**
 * Pessoas contratadas para manter uma pessoa no turno o ano inteiro.
 * fator = dias do ano / (dias do ano × presença − férias − faltas).
 * O folguista é fator − 1.
 */
export function suggestedCoverageFactor(scale: ScaleId, calendar: RosterCalendar): number {
  const days = productiveDays(scale, calendar);
  if (!(calendar.yearDays > 0) || !(days > 0)) return 0;
  return calendar.yearDays / days;
}

export function coverageFactor(post: RosterPost, roster: RosterCalendar & { posts?: RosterPost[] }): number {
  if (post.coverageOverride !== null && Number.isFinite(post.coverageOverride)) return Math.max(0, post.coverageOverride);
  return suggestedCoverageFactor(post.scale, roster);
}

export function shiftNightMultiplier(shiftIndex: number, roster: Pick<Roster, 'shiftCount' | 'nightPremiumPct'>): number {
  if (roster.shiftCount !== 3 || shiftIndex !== 2) return 1;
  const premium = Number.isFinite(roster.nightPremiumPct) ? roster.nightPremiumPct : 0;
  return 1 + Math.max(0, premium);
}

function emptyShift(): ShiftSnapshot {
  return {
    present: 0,
    hired: 0,
    folguista: 0,
    payroll: 0,
    freedPresent: 0,
    avoidedHired: 0,
    avoidedPayroll: 0,
    futureSeats: 0,
    futureHired: 0,
    futurePayroll: 0,
  };
}

export function summarizeRoster(roster: Roster): RosterSummary {
  const shifts = Array.from({ length: roster.shiftCount }, emptyShift);
  for (const post of roster.posts) {
    const factor = coverageFactor(post, roster);
    const cost = Math.max(0, post.monthlyCost);
    for (let index = 0; index < roster.shiftCount; index += 1) {
      const present = Math.max(0, post.onDuty[index] ?? 0);
      const freedPresent = Math.min(Math.max(0, post.freed[index] ?? 0), present);
      const futureSeats = Math.max(0, post.future[index] ?? 0);
      const night = shiftNightMultiplier(index, roster);
      const hired = present * factor;
      const avoidedHired = freedPresent * factor;
      const futureHired = futureSeats * factor;
      const shift = shifts[index];
      shift.present += present;
      shift.hired += hired;
      shift.folguista += hired - present;
      shift.payroll += hired * cost * night;
      shift.freedPresent += freedPresent;
      shift.avoidedHired += avoidedHired;
      shift.avoidedPayroll += avoidedHired * cost * night;
      shift.futureSeats += futureSeats;
      shift.futureHired += futureHired;
      shift.futurePayroll += futureHired * cost * night;
    }
  }
  const totals = shifts.reduce(
    (total, shift) => ({
      present: total.present + shift.present,
      hired: total.hired + shift.hired,
      folguista: total.folguista + shift.folguista,
      payroll: total.payroll + shift.payroll,
      avoidedHired: total.avoidedHired + shift.avoidedHired,
      avoidedPayroll: total.avoidedPayroll + shift.avoidedPayroll,
      futureHired: total.futureHired + shift.futureHired,
      futurePayroll: total.futurePayroll + shift.futurePayroll,
    }),
    {
      present: 0,
      hired: 0,
      folguista: 0,
      payroll: 0,
      avoidedHired: 0,
      avoidedPayroll: 0,
      futureHired: 0,
      futurePayroll: 0,
    },
  );
  return { shifts, ...totals, severance: totals.avoidedPayroll };
}

export function postCoverage(post: RosterPost, roster: Roster): { suggested: number; applied: number; overridden: boolean } {
  const suggested = suggestedCoverageFactor(post.scale, roster);
  const overridden = post.coverageOverride !== null;
  return { suggested, applied: coverageFactor(post, roster), overridden };
}

function roleBuckets(roster: Roster): Array<{ id: string; role: string; headcount: number; monthlyCost: number; shift: string }> {
  const buckets = new Map<string, { role: string; headcount: number; payroll: number; shift: string }>();
  for (const post of roster.posts) {
    const factor = coverageFactor(post, roster);
    let headcount = 0;
    let payroll = 0;
    for (let index = 0; index < roster.shiftCount; index += 1) {
      const hired = Math.max(0, post.onDuty[index] ?? 0) * factor;
      headcount += hired;
      payroll += hired * Math.max(0, post.monthlyCost) * shiftNightMultiplier(index, roster);
    }
    if (headcount <= 0) continue;
    const id = post.role.trim().toLowerCase() || post.id;
    const current = buckets.get(id) ?? { role: post.role.trim() || 'Cargo', headcount: 0, payroll: 0, shift: scaleLabel(post.scale) };
    current.headcount += headcount;
    current.payroll += payroll;
    buckets.set(id, current);
  }
  return [...buckets.entries()].map(([id, bucket]) => ({
    id,
    role: bucket.role,
    headcount: bucket.headcount,
    monthlyCost: bucket.payroll / bucket.headcount,
    shift: bucket.shift,
  }));
}

function futureHires(roster: Roster): PlannedHire[] {
  const hires: PlannedHire[] = [];
  for (const post of roster.posts) {
    const factor = coverageFactor(post, roster);
    let headcount = 0;
    let payroll = 0;
    for (let index = 0; index < roster.shiftCount; index += 1) {
      const hired = Math.max(0, post.future[index] ?? 0) * factor;
      headcount += hired;
      payroll += hired * Math.max(0, post.monthlyCost) * shiftNightMultiplier(index, roster);
    }
    if (headcount <= 0) continue;
    hires.push({
      id: post.id,
      role: post.role.trim() || 'Cargo',
      month: FUTURE_HIRE_MONTH,
      headcount,
      monthlyCost: payroll / headcount,
    });
  }
  return hires;
}

/**
 * Projeta o quadro nos campos de pessoas que o motor já sabe ler.
 * A vaga não é digitada à parte: posições liberadas × fator de cobertura.
 * Supervisão, movimentação, inventário e horas realocadas ficam fora do caixa.
 */
export function applyRoster(inputs: Inputs, roster: Roster): Inputs {
  const next = structuredClone(inputs);
  const summary = summarizeRoster(roster);
  const roles = roleBuckets(roster);
  next.profile.roles =
    roles.length > 0
      ? roles
      : [{ id: 'vazio', role: 'Sem posto', headcount: 0, monthlyCost: 0, shift: '6x1' }];
  next.people.payroll = {
    ...next.people.payroll,
    enabled: true,
    positionsReduced: summary.avoidedHired,
    monthlyCostPerPosition: summary.avoidedHired > 0 ? summary.avoidedPayroll / summary.avoidedHired : 0,
    chargesPct: 0,
    benefitsPerPosition: 0,
    costConfirmedFullyLoaded: true,
    severanceCost: summary.severance,
  };
  next.people.futureHires = {
    ...next.people.futureHires,
    enabled: summary.futureHired > 0,
    hires: futureHires(roster),
  };
  next.people.supervision = {
    ...next.people.supervision,
    enabled: false,
    alreadyCountedInPayroll: true,
    hoursSavedPerMonth: 0,
  };
  next.people.reallocatedHours = {
    ...next.people.reallocatedHours,
    enabled: false,
    hoursPerMonth: 0,
    monetization: 'nenhuma',
    costReductionMonthly: 0,
    incrementalMarginMonthly: 0,
  };
  next.logistics.movement = {
    ...next.logistics.movement,
    enabled: false,
    alreadyCountedInPayroll: true,
    hoursSavedPerMonth: 0,
  };
  next.logistics.inventoryCount = {
    ...next.logistics.inventoryCount,
    enabled: false,
    hoursSavedPerMonth: 0,
  };
  return next;
}
