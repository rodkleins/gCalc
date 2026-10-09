/** Preferências da interface, separadas da sessão da simulação. */
export const RAIL_COLLAPSED_KEY = 'gcalc.ui.railCollapsed';
export const QUICK_DOCK_OPEN_KEY = 'gcalc.ui.quickDockOpen';
export const QUICK_ADJUST_OPEN_KEY = 'gcalc.ui.quickAdjustOpen';

export const NARROW_VIEWPORT_QUERY = '(max-width: 1099px)';

export function readUiFlag(storage: Pick<Storage, 'getItem'>, key: string): boolean | null {
  try {
    const value = storage.getItem(key);
    if (value === '1') return true;
    if (value === '0') return false;
  } catch {
    return null;
  }
  return null;
}

export function writeUiFlag(storage: Pick<Storage, 'setItem'>, key: string, value: boolean): void {
  try {
    storage.setItem(key, value ? '1' : '0');
  } catch {
    /* navegador sem armazenamento */
  }
}

export function isNarrowViewport(): boolean {
  try {
    return window.matchMedia(NARROW_VIEWPORT_QUERY).matches;
  } catch {
    return false;
  }
}

/** Sem escolha salva, telas estreitas começam com o menu recolhido. */
export function initialRailCollapsed(storage: Pick<Storage, 'getItem'>): boolean {
  const stored = readUiFlag(storage, RAIL_COLLAPSED_KEY);
  if (stored !== null) return stored;
  return isNarrowViewport();
}

export function initialQuickDockOpen(storage: Pick<Storage, 'getItem'>): boolean {
  return readUiFlag(storage, QUICK_DOCK_OPEN_KEY) === true;
}

/** Sem escolha salva, o painel de premissas começa aberto. */
export function initialQuickAdjustOpen(storage: Pick<Storage, 'getItem'>): boolean {
  return readUiFlag(storage, QUICK_ADJUST_OPEN_KEY) !== false;
}
