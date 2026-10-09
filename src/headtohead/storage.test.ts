import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, storageKeys } from '../model/storage';
import { exampleDraft } from './model';
import { HEADTOHEAD_STORAGE_KEY, loadDraft, saveDraft } from './storage';

function memory(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('rascunho head-to-head no navegador', () => {
  it('grava na chave própria e não mexe na calculadora atual', () => {
    const storage = memory();
    storage.setItem(STORAGE_KEY, '{"version":2,"draft":"atual"}');
    const draft = exampleDraft();
    draft.storeName = 'Rede Norte';
    draft.fictional = false;
    saveDraft(storage, draft);

    expect(HEADTOHEAD_STORAGE_KEY).toBe(storageKeys(false).headtohead);
    expect(HEADTOHEAD_STORAGE_KEY).not.toBe(STORAGE_KEY);
    expect(storageKeys(true).headtohead).not.toBe(HEADTOHEAD_STORAGE_KEY);
    expect(storage.getItem(STORAGE_KEY)).toBe('{"version":2,"draft":"atual"}');
    const loaded = loadDraft(storage);
    expect(loaded.storeName).toBe('Rede Norte');
    expect(loaded.fictional).toBe(false);
    expect(loaded.lines.find((line) => line.id === 'receita')?.today).toBe(1_000_000);
    expect(loaded.staff).toHaveLength(4);
    expect(loaded.indicators).toHaveLength(2);
  });

  it('volta ao exemplo quando o JSON está inválido', () => {
    const storage = memory();
    storage.setItem(HEADTOHEAD_STORAGE_KEY, '{');
    expect(loadDraft(storage).storeName).toBe('Loja exemplo');
    storage.setItem(HEADTOHEAD_STORAGE_KEY, '{"lines":"nao"}');
    expect(loadDraft(storage).storeName).toBe('Loja exemplo');
  });
});
