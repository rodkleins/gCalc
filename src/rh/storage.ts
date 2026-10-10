import { isInputs, isScenarioId, isSectionId, type KeyValueStore, type SectionId } from '../model/storage';
import { normalizeInputs } from '../model/normalize';
import { normalizeWizardStep } from '../model/wizard';
import type { Inputs, ScenarioId } from '../model/types';
import { rhImportWarnings } from './importCheck';
import {
  DEFAULT_ABSENCE_DAYS,
  DEFAULT_NIGHT_PREMIUM,
  DEFAULT_VACATION_DAYS,
  DEFAULT_YEAR_DAYS,
  applyRoster,
  type Roster,
  type RosterPost,
  type ScaleId,
  type ShiftCount,
} from './roster';

/** Sessão desta versão. Não lê nem grava a calculadora da raiz. */
export const RH_STORAGE_VERSION = 1;
export const RH_KIND = 'gcalc-rh';
export const RH_STORAGE_KEY = 'gcalc.rh.library.v1';

export const RH_UI_KEYS = {
  railCollapsed: 'gcalc.rh.ui.railCollapsed',
  quickDockOpen: 'gcalc.rh.ui.quickDockOpen',
  quickAdjustOpen: 'gcalc.rh.ui.quickAdjustOpen',
} as const;

const ROOT_KEYS = ['gcalc.library.v2', 'gcalc.inputs.v1', 'gcalc.headtohead.v1'] as const;

export interface RhDraft {
  inputs: Inputs;
  roster: Roster;
  scenario: ScenarioId;
  section: SectionId;
  wizardStep: number;
  adjustAnchor: Inputs;
}

export interface RhSimulation {
  id: string;
  name: string;
  savedAt: string;
  inputs: Inputs;
  roster: Roster;
  scenario: ScenarioId;
  section: SectionId;
}

export interface RhSession {
  kind: typeof RH_KIND;
  version: typeof RH_STORAGE_VERSION;
  draft: RhDraft;
  simulations: RhSimulation[];
}

export interface LoadedRhSession {
  draft: RhDraft | null;
  simulations: RhSimulation[];
  source: 'current' | 'legacy' | 'empty' | 'invalid';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function triple(value: unknown): [number, number, number] {
  const source = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((index) => Math.max(0, finiteNumber(source[index], 0))) as [number, number, number];
}

function scaleOf(value: unknown): ScaleId {
  if (value === '5x2' || value === '12x36' || value === '6x1') return value;
  return '6x1';
}

function shiftCountOf(value: unknown): ShiftCount {
  return value === 3 ? 3 : 2;
}

function overrideOf(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  return null;
}

export function normalizeRoster(value: unknown): Roster | null {
  if (!isRecord(value)) return null;
  const posts = Array.isArray(value.posts) ? value.posts : [];
  return {
    shiftCount: shiftCountOf(value.shiftCount),
    nightPremiumPct: Math.max(0, finiteNumber(value.nightPremiumPct, DEFAULT_NIGHT_PREMIUM)),
    yearDays: Math.max(1, finiteNumber(value.yearDays, DEFAULT_YEAR_DAYS)),
    vacationDays: Math.max(0, finiteNumber(value.vacationDays, DEFAULT_VACATION_DAYS)),
    absenceDays: Math.max(0, finiteNumber(value.absenceDays, DEFAULT_ABSENCE_DAYS)),
    posts: posts.map((post, index) => normalizePost(post, index)).filter((post): post is RosterPost => post !== null),
  };
}

function normalizePost(value: unknown, index: number): RosterPost | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && value.id.trim() ? value.id : `posto-${index + 1}`;
  return {
    id,
    role: typeof value.role === 'string' && value.role.trim() ? value.role : 'Cargo',
    counter: typeof value.counter === 'string' && value.counter.trim() ? value.counter : 'Balcão',
    scale: scaleOf(value.scale),
    monthlyCost: Math.max(0, finiteNumber(value.monthlyCost, 0)),
    onDuty: triple(value.onDuty),
    freed: triple(value.freed),
    future: triple(value.future),
    coverageOverride: overrideOf(value.coverageOverride),
  };
}

/** Quadro neutro para uma simulação antiga que ainda não tinha turnos. O fator 1 não reaplica folguista. */
export function rosterFromLegacyInputs(inputs: Inputs): Roster {
  const positions = Math.max(0, inputs.people.payroll.positionsReduced);
  const cost = Math.max(0, inputs.people.payroll.monthlyCostPerPosition);
  const activeHires = (inputs.people.futureHires?.hires ?? []).filter((hire) => hire.headcount > 0);
  const futureHeadcount = activeHires.reduce((total, hire) => total + Math.max(0, hire.headcount), 0);
  const futurePayroll = activeHires.reduce((total, hire) => total + Math.max(0, hire.headcount) * Math.max(0, hire.monthlyCost), 0);
  const posts: RosterPost[] = [
    {
      id: 'migrado',
      role: 'Quadro migrado',
      counter: 'Único',
      scale: '6x1',
      monthlyCost: cost,
      onDuty: [positions, 0, 0],
      freed: [positions, 0, 0],
      future: [0, 0, 0],
      coverageOverride: 1,
    },
  ];
  if (futureHeadcount > 0) {
    posts.push({
      id: 'migrado-futuro',
      role: 'Contratação futura migrada',
      counter: 'Único',
      scale: '6x1',
      monthlyCost: futurePayroll / futureHeadcount,
      onDuty: [0, 0, 0],
      freed: [0, 0, 0],
      future: [futureHeadcount, 0, 0],
      coverageOverride: 1,
    });
  }
  return {
    shiftCount: 2,
    nightPremiumPct: DEFAULT_NIGHT_PREMIUM,
    yearDays: DEFAULT_YEAR_DAYS,
    vacationDays: DEFAULT_VACATION_DAYS,
    absenceDays: DEFAULT_ABSENCE_DAYS,
    posts,
  };
}

function draftFrom(inputs: Inputs, roster: Roster, scenario: unknown, section: unknown, wizardStep: unknown, adjustAnchor: unknown): RhDraft {
  const applied = applyRoster(normalizeInputs(inputs), roster);
  const anchorInputs = isInputs(adjustAnchor) ? normalizeInputs(adjustAnchor) : structuredClone(applied);
  return {
    inputs: applied,
    roster,
    scenario: isScenarioId(scenario) ? scenario : 'base',
    section: isSectionId(section) ? section : 'dashboard',
    wizardStep: normalizeWizardStep(wizardStep),
    adjustAnchor: applyRoster(anchorInputs, roster),
  };
}

function parseSimulation(value: unknown): RhSimulation | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || !value.name.trim()) return null;
  if (!isInputs(value.inputs)) return null;
  const roster = normalizeRoster(value.roster) ?? rosterFromLegacyInputs(value.inputs);
  const draft = draftFrom(value.inputs, roster, value.scenario, value.section, 0, value.inputs);
  return {
    id: value.id,
    name: value.name.trim(),
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date(0).toISOString(),
    inputs: draft.inputs,
    roster: draft.roster,
    scenario: draft.scenario,
    section: draft.section,
  };
}

function isFutureRh(value: Record<string, unknown>): boolean {
  return value.kind === RH_KIND && typeof value.version === 'number' && value.version > RH_STORAGE_VERSION;
}

export function parseRhSession(raw: string): LoadedRhSession {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { draft: null, simulations: [], source: 'invalid' };
  }
  if (!isRecord(value)) return { draft: null, simulations: [], source: 'invalid' };
  if (isFutureRh(value)) return { draft: null, simulations: [], source: 'invalid' };

  const simulations = Array.isArray(value.simulations)
    ? value.simulations.map(parseSimulation).filter((item): item is RhSimulation => item !== null)
    : [];
  const draftRecord = isRecord(value.draft) ? value.draft : null;
  const rawInputs = draftRecord && isInputs(draftRecord.inputs) ? draftRecord.inputs : isInputs(value.inputs) ? value.inputs : null;
  if (!rawInputs) return { draft: null, simulations, source: simulations.length > 0 ? 'legacy' : 'invalid' };

  const inputs = normalizeInputs(rawInputs);
  const explicitRoster = normalizeRoster(draftRecord?.roster ?? value.roster);
  const roster = explicitRoster ?? rosterFromLegacyInputs(inputs);
  const migrated = explicitRoster === null;
  return {
    draft: draftFrom(inputs, roster, draftRecord?.scenario ?? value.scenario, draftRecord?.section ?? value.section, draftRecord?.wizardStep, draftRecord?.adjustAnchor),
    simulations,
    source: migrated ? 'legacy' : 'current',
  };
}

export function readRhSession(storage: KeyValueStore): LoadedRhSession {
  const current = storage.getItem(RH_STORAGE_KEY);
  if (current === null) return { draft: null, simulations: [], source: 'empty' };
  return parseRhSession(current);
}

export function serializeRhSession(session: RhSession): string {
  return JSON.stringify(session);
}

export function writeRhSession(storage: KeyValueStore, session: RhSession): void {
  storage.setItem(RH_STORAGE_KEY, serializeRhSession(session));
}

export function clearRhSession(storage: KeyValueStore): void {
  storage.removeItem(RH_STORAGE_KEY);
}

export function rootKeysUntouched(before: KeyValueStore, after: KeyValueStore): boolean {
  return ROOT_KEYS.every((key) => before.getItem(key) === after.getItem(key));
}

export interface ImportedRh {
  draft: RhDraft | null;
  simulations: RhSimulation[];
  warnings: string[];
}

export function importRhPayload(raw: unknown): ImportedRh | null {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isRecord(value) && !isInputs(value)) return null;
  if (isRecord(value) && isFutureRh(value)) return null;
  const warnings = isRecord(value) ? importWarnings(value) : [];
  const parsed = parseRhSession(JSON.stringify(value));
  if (!parsed.draft && parsed.simulations.length === 0) return null;
  return { draft: parsed.draft, simulations: parsed.simulations, warnings: [...new Set(warnings)] };
}

function importWarnings(value: Record<string, unknown>): string[] {
  const messages: string[] = [];
  const chunks: Array<{ inputs: unknown; roster: unknown }> = [];
  if (isRecord(value.draft)) chunks.push({ inputs: value.draft.inputs, roster: value.draft.roster });
  else if (isInputs(value.inputs) || isInputs(value)) chunks.push({ inputs: isInputs(value.inputs) ? value.inputs : value, roster: value.roster });
  if (Array.isArray(value.simulations)) {
    for (const simulation of value.simulations) {
      if (isRecord(simulation)) chunks.push({ inputs: simulation.inputs, roster: simulation.roster });
    }
  }
  for (const chunk of chunks) {
    if (!isInputs(chunk.inputs)) continue;
    const inputs = normalizeInputs(chunk.inputs);
    const explicitRoster = normalizeRoster(chunk.roster);
    const roster = explicitRoster ?? rosterFromLegacyInputs(inputs);
    messages.push(...rhImportWarnings(inputs, roster, explicitRoster !== null));
  }
  return messages;
}
