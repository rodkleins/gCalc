import {
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  parseSession,
  serializeSession,
  type KeyValueStore,
  type LoadedSession,
  type PersistedSession,
} from '../model/storage';
import { defaultDpspDrivers, sanitizeDpspDrivers, type DpspDrivers } from './drivers';

/** Sessão desta página. A v1 não é lida: percentuais antigos não podem recolocar as vagas fixas. */
export const DPSP_STORAGE_KEY = 'gcalc.dpsp.library.v2';
export const DPSP_STORAGE_KEY_V1 = 'gcalc.dpsp.library.v1';

const ROOT_KEYS = [STORAGE_KEY, LEGACY_STORAGE_KEY, 'gcalc.headtohead.v1', 'gcalc.rh.library.v1'] as const;

export interface DpspLoaded extends LoadedSession {
  drivers: DpspDrivers;
}

export function readDpspSession(storage: KeyValueStore): DpspLoaded {
  const current = storage.getItem(DPSP_STORAGE_KEY);
  if (current === null) {
    return { draft: null, simulations: [], source: 'empty', drivers: defaultDpspDrivers() };
  }
  return { ...parseSession(current), drivers: driversFromRaw(current) };
}

export function writeDpspSession(storage: KeyValueStore, session: PersistedSession, drivers: DpspDrivers): void {
  const payload = JSON.parse(serializeSession(session)) as Record<string, unknown>;
  payload.drivers = sanitizeDpspDrivers(drivers);
  storage.setItem(DPSP_STORAGE_KEY, JSON.stringify(payload));
  storage.removeItem(DPSP_STORAGE_KEY_V1);
}

export function clearDpspSession(storage: KeyValueStore): void {
  storage.removeItem(DPSP_STORAGE_KEY);
  storage.removeItem(DPSP_STORAGE_KEY_V1);
}

export function dpspSessionLeavesRootUntouched(storage: KeyValueStore): boolean {
  return ROOT_KEYS.every((key) => storage.getItem(key) === null);
}

function driversFromRaw(raw: string): DpspDrivers {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('drivers' in value)) return defaultDpspDrivers();
    const drivers = (value as { drivers?: Partial<DpspDrivers> }).drivers;
    return sanitizeDpspDrivers(drivers);
  } catch {
    return defaultDpspDrivers();
  }
}
