import {
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  parseSession,
  serializeSession,
  type KeyValueStore,
  type LoadedSession,
  type PersistedSession,
} from '../model/storage';

/** Sessão desta página. Não lê nem grava a calculadora da raiz. */
export const DPSP_STORAGE_KEY = 'gcalc.dpsp.library.v1';

const ROOT_KEYS = [STORAGE_KEY, LEGACY_STORAGE_KEY, 'gcalc.headtohead.v1', 'gcalc.rh.library.v1'] as const;

export function readDpspSession(storage: KeyValueStore): LoadedSession {
  const current = storage.getItem(DPSP_STORAGE_KEY);
  if (current === null) return { draft: null, simulations: [], source: 'empty' };
  return parseSession(current);
}

export function writeDpspSession(storage: KeyValueStore, session: PersistedSession): void {
  storage.setItem(DPSP_STORAGE_KEY, serializeSession(session));
}

export function clearDpspSession(storage: KeyValueStore): void {
  storage.removeItem(DPSP_STORAGE_KEY);
}

export function dpspSessionLeavesRootUntouched(storage: KeyValueStore): boolean {
  return ROOT_KEYS.every((key) => storage.getItem(key) === null);
}
