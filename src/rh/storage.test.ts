import { describe, expect, it } from 'vitest';
import { exampleInputs } from '../model/example';
import { STORAGE_KEY } from '../model/storage';
import { exampleRoster } from './presets';
import { applyRoster } from './roster';
import {
  RH_KIND,
  RH_STORAGE_KEY,
  RH_STORAGE_VERSION,
  clearRhSession,
  importRhPayload,
  parseRhSession,
  readRhSession,
  rootKeysUntouched,
  writeRhSession,
  type RhSession,
} from './storage';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
}

describe('sessão do quadro de RH', () => {
  it('rejeita uma versão futura desta chave e não apaga o que estava gravado', () => {
    const raw = JSON.stringify({ kind: RH_KIND, version: 99, draft: { inputs: exampleInputs(), roster: exampleRoster() } });
    expect(parseRhSession(raw).source).toBe('invalid');
    expect(importRhPayload(raw)).toBeNull();
  });

  it('completa posto antigo sem futuro, sem sobrescrita e sem adicional', () => {
    const inputs = applyRoster(exampleInputs(), exampleRoster());
    const raw = JSON.stringify({
      kind: RH_KIND,
      version: 1,
      draft: {
        inputs,
        roster: {
          shiftCount: 3,
          posts: [{ id: 'aux', role: 'Auxiliar', counter: 'Balcão 1', scale: '6x1', monthlyCost: 4_200, onDuty: [1, 2] }],
        },
        scenario: 'base',
        section: 'pessoas',
      },
      simulations: [],
    });
    const loaded = parseRhSession(raw);
    const post = loaded.draft?.roster.posts[0];
    expect(loaded.source).toBe('current');
    expect(loaded.draft?.roster.shiftCount).toBe(3);
    expect(loaded.draft?.roster.nightPremiumPct).toBe(0.1);
    expect(loaded.draft?.roster.vacationDays).toBe(30);
    expect(loaded.draft?.roster.absenceDays).toBe(6);
    expect(post?.future).toEqual([0, 0, 0]);
    expect(post?.onDuty).toEqual([1, 2, 0]);
    expect(post?.coverageOverride).toBeNull();
    expect(post?.freed).toEqual([0, 0, 0]);
  });

  it('migra uma simulação sem quadro sem contar folguista duas vezes', () => {
    const inputs = exampleInputs();
    inputs.people.payroll.positionsReduced = 3;
    inputs.people.payroll.monthlyCostPerPosition = 4_200;
    inputs.people.payroll.severanceCost = 99_000;
    const loaded = parseRhSession(JSON.stringify({ version: 2, draft: { inputs, scenario: 'otimista', section: 'dashboard' } }));
    expect(loaded.source).toBe('legacy');
    expect(loaded.draft?.scenario).toBe('otimista');
    expect(loaded.draft?.roster.posts[0].coverageOverride).toBe(1);
    expect(loaded.draft?.inputs.people.payroll.positionsReduced).toBe(3);
    expect(loaded.draft?.inputs.people.payroll.monthlyCostPerPosition).toBe(4_200);
    expect(loaded.draft?.inputs.people.payroll.severanceCost).toBe(3 * 4_200);
  });

  it('grava só a chave do RH e deixa a biblioteca da raiz intacta', () => {
    const inputs = applyRoster(exampleInputs(), exampleRoster());
    const session: RhSession = {
      kind: RH_KIND,
      version: RH_STORAGE_VERSION,
      draft: {
        inputs,
        roster: exampleRoster(),
        scenario: 'base',
        section: 'dashboard',
        wizardStep: 0,
        adjustAnchor: inputs,
      },
      simulations: [],
    };
    const before = memory({ [STORAGE_KEY]: '{"raiz":true}', 'gcalc.inputs.v1': 'legado', 'gcalc.headtohead.v1': 'h2h' });
    const after = memory({ [STORAGE_KEY]: '{"raiz":true}', 'gcalc.inputs.v1': 'legado', 'gcalc.headtohead.v1': 'h2h' });
    writeRhSession(after, session);
    expect(after.getItem(RH_STORAGE_KEY)).toContain(RH_KIND);
    expect(rootKeysUntouched(before, after)).toBe(true);
    expect(after.getItem(STORAGE_KEY)).toBe('{"raiz":true}');
    clearRhSession(after);
    expect(after.getItem(RH_STORAGE_KEY)).toBeNull();
    expect(after.getItem(STORAGE_KEY)).toBe('{"raiz":true}');
    expect(readRhSession(after).source).toBe('empty');
  });
});
