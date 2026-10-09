import { scenarioLabel } from './format';
import type { Inputs, ScenarioId } from './types';
import { normalizeWizardStep } from './wizard';

export const STORAGE_VERSION = 2;
export const STORAGE_KEY = 'gcalc.library.v2';
export const LEGACY_STORAGE_KEY = 'gcalc.inputs.v1';

export const SECTION_IDS = [
  'dashboard',
  'perfil',
  'pessoas',
  'logistica',
  'estoque',
  'investimento',
  'cenarios',
  'sensibilidade',
  'fluxo',
  'auditoria',
  'simulacoes',
  'wizard',
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export interface DraftState {
  inputs: Inputs;
  scenario: ScenarioId;
  section: SectionId;
  wizardStep: number;
}

export interface SimulationRecord {
  id: string;
  name: string;
  savedAt: string;
  inputs: Inputs;
  scenario: ScenarioId;
  section: SectionId;
}

export interface PersistedSession {
  version: typeof STORAGE_VERSION;
  draft: DraftState;
  simulations: SimulationRecord[];
}

export interface LoadedSession {
  draft: DraftState | null;
  simulations: SimulationRecord[];
  source: 'current' | 'legacy' | 'empty' | 'invalid';
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const SCENARIOS: ScenarioId[] = ['conservador', 'base', 'otimista'];

export function isScenarioId(value: unknown): value is ScenarioId {
  return SCENARIOS.includes(value as ScenarioId);
}

export function isSectionId(value: unknown): value is SectionId {
  return SECTION_IDS.includes(value as SectionId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isInputs(value: unknown): value is Inputs {
  if (!isRecord(value)) return false;
  const profile = value.profile;
  const people = value.people;
  const scenarios = value.scenarios;
  const robot = value.robot;
  if (!isRecord(profile) || !isRecord(people) || !isRecord(value.logistics) || !isRecord(value.stock)) return false;
  if (!isRecord(robot) || !isRecord(scenarios) || !isRecord(value.meta) || !isRecord(value.assumptions)) return false;
  if (profile.storeType !== 'nova' && profile.storeType !== 'existente') return false;
  if (!isRecord(people.payroll) || typeof people.payroll.enabled !== 'boolean') return false;
  if (!isRecord(scenarios.base) || !isRecord(scenarios.conservador) || !isRecord(scenarios.otimista)) return false;
  if (!isRecord(robot.capex) || !isRecord(robot.opexMonthly)) return false;
  return true;
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `sim-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultSimulationName(inputs: Inputs, scenario: ScenarioId): string {
  const client = inputs.meta.clientName.trim() || 'Cliente';
  const store = inputs.meta.storeName.trim() || 'Loja';
  return `${client} — ${store} — ${scenarioLabel(scenario)}`;
}

function draftFrom(inputs: Inputs, scenario: unknown, section: unknown, wizardStep?: unknown): DraftState {
  return {
    inputs,
    scenario: isScenarioId(scenario) ? scenario : 'base',
    section: isSectionId(section) ? section : 'dashboard',
    wizardStep: normalizeWizardStep(wizardStep),
  };
}

export function parseSimulation(value: unknown): SimulationRecord | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || !value.name.trim()) return null;
  if (!isInputs(value.inputs)) return null;
  return {
    id: value.id,
    name: value.name.trim(),
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date(0).toISOString(),
    inputs: value.inputs,
    scenario: isScenarioId(value.scenario) ? value.scenario : 'base',
    section: isSectionId(value.section) ? value.section : 'dashboard',
  };
}

function parseSimulations(value: unknown): SimulationRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseSimulation).filter((item): item is SimulationRecord => item !== null);
}

export function serializeSession(session: PersistedSession): string {
  return JSON.stringify(session);
}

export function parseSession(raw: string): LoadedSession {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { draft: null, simulations: [], source: 'invalid' };
  }
  if (!isRecord(value)) return { draft: null, simulations: [], source: 'invalid' };

  if (value.version !== STORAGE_VERSION) {
    if (typeof value.version === 'number' && value.version > STORAGE_VERSION) {
      return { draft: null, simulations: [], source: 'invalid' };
    }
    const legacyInputs = isRecord(value.draft) ? value.draft.inputs : value.inputs;
    if (isInputs(legacyInputs)) {
      const scenario = isRecord(value.draft) ? value.draft.scenario : value.scenario;
      const section = isRecord(value.draft) ? value.draft.section : value.section;
      const wizardStep = isRecord(value.draft) ? value.draft.wizardStep : value.wizardStep;
      return { draft: draftFrom(legacyInputs, scenario, section, wizardStep), simulations: [], source: 'legacy' };
    }
    return { draft: null, simulations: [], source: 'invalid' };
  }

  const simulations = parseSimulations(value.simulations);
  if (!isRecord(value.draft) || !isInputs(value.draft.inputs)) {
    return { draft: null, simulations, source: 'current' };
  }
  return {
    draft: draftFrom(value.draft.inputs, value.draft.scenario, value.draft.section, value.draft.wizardStep),
    simulations,
    source: 'current',
  };
}

export function readSession(storage: KeyValueStore): LoadedSession {
  const current = storage.getItem(STORAGE_KEY);
  if (current !== null) return parseSession(current);

  const legacy = storage.getItem(LEGACY_STORAGE_KEY);
  if (legacy === null) return { draft: null, simulations: [], source: 'empty' };
  try {
    const value: unknown = JSON.parse(legacy);
    if (isInputs(value)) {
      return { draft: draftFrom(value, 'base', 'dashboard'), simulations: [], source: 'legacy' };
    }
  } catch {
    return { draft: null, simulations: [], source: 'invalid' };
  }
  return { draft: null, simulations: [], source: 'invalid' };
}

export function writeSession(storage: KeyValueStore, session: PersistedSession): void {
  storage.setItem(STORAGE_KEY, serializeSession(session));
  storage.removeItem(LEGACY_STORAGE_KEY);
}

export function clearSession(storage: KeyValueStore): void {
  storage.removeItem(STORAGE_KEY);
  storage.removeItem(LEGACY_STORAGE_KEY);
}

export function duplicateSimulation(simulation: SimulationRecord, id = createId(), savedAt = new Date().toISOString()): SimulationRecord {
  const copy = structuredClone(simulation);
  return { ...copy, id, name: `${simulation.name} (cópia)`, savedAt };
}

export function renameSimulation(simulations: SimulationRecord[], id: string, name: string): SimulationRecord[] {
  const trimmed = name.trim();
  if (!trimmed) return simulations;
  return simulations.map((simulation) => (simulation.id === id ? { ...simulation, name: trimmed } : simulation));
}

export function deleteSimulation(simulations: SimulationRecord[], id: string): SimulationRecord[] {
  return simulations.filter((simulation) => simulation.id !== id);
}

export function insertDuplicate(simulations: SimulationRecord[], id: string): SimulationRecord[] {
  const index = simulations.findIndex((simulation) => simulation.id === id);
  if (index < 0) return simulations;
  const next = simulations.slice();
  next.splice(index + 1, 0, duplicateSimulation(simulations[index]));
  return next;
}

export interface ImportedPayload {
  draft: DraftState | null;
  simulations: SimulationRecord[];
}

export function importPayload(raw: unknown): ImportedPayload | null {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (isInputs(value)) return { draft: draftFrom(value, 'base', 'dashboard'), simulations: [] };

  const single = parseSimulation(value);
  if (single) {
    return {
      draft: draftFrom(single.inputs, single.scenario, single.section),
      simulations: [single],
    };
  }
  if (!isRecord(value)) return null;

  if (value.version !== undefined && value.version !== STORAGE_VERSION) {
    if (typeof value.version === 'number' && value.version > STORAGE_VERSION) return null;
    const legacyInputs = isRecord(value.draft) ? value.draft.inputs : value.inputs;
    if (!isInputs(legacyInputs)) return null;
    const scenario = isRecord(value.draft) ? value.draft.scenario : value.scenario;
    const section = isRecord(value.draft) ? value.draft.section : value.section;
    const wizardStep = isRecord(value.draft) ? value.draft.wizardStep : value.wizardStep;
    return { draft: draftFrom(legacyInputs, scenario, section, wizardStep), simulations: [] };
  }

  const simulations = parseSimulations(value.simulations);
  const draft = isRecord(value.draft) && isInputs(value.draft.inputs)
    ? draftFrom(value.draft.inputs, value.draft.scenario, value.draft.section, value.draft.wizardStep)
    : null;
  if (!draft && simulations.length === 0) return null;
  return { draft, simulations };
}

export function mergeSimulations(current: SimulationRecord[], incoming: SimulationRecord[]): SimulationRecord[] {
  const ids = new Set(current.map((simulation) => simulation.id));
  const appended = incoming.map((simulation) => {
    if (!ids.has(simulation.id)) {
      ids.add(simulation.id);
      return simulation;
    }
    const copy = { ...structuredClone(simulation), id: createId() };
    ids.add(copy.id);
    return copy;
  });
  return [...current, ...appended];
}
