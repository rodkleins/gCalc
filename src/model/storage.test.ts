import { describe, expect, it } from 'vitest';
import { evaluate } from './calculate';
import { exampleInputs } from './example';
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  LEGACY_STORAGE_KEY,
  storageKeys,
  clearSession,
  deleteSimulation,
  duplicateSimulation,
  importPayload,
  insertDuplicate,
  mergeSimulations,
  parseSession,
  readSession,
  renameSimulation,
  serializeSession,
  writeSession,
  type KeyValueStore,
  type PersistedSession,
  type SimulationRecord,
} from './storage';

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) ?? null : null),
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function sessionWith(patch?: Partial<PersistedSession['draft']>): PersistedSession {
  const inputs = exampleInputs();
  inputs.people.payroll.enabled = false;
  inputs.profile.storeType = 'existente';
  inputs.meta.clientName = 'Rede Sul';
  inputs.meta.storeName = 'Loja Centro';
  return {
    version: STORAGE_VERSION,
    draft: {
      inputs,
      scenario: 'otimista',
      section: 'pessoas',
      wizardStep: 0,
      adjustAnchor: structuredClone(inputs),
      ...patch,
    },
    simulations: [
      {
        id: 'sim-a',
        name: 'Rede Sul — Loja Centro — Otimista',
        savedAt: '2026-10-09T12:00:00.000Z',
        inputs,
        scenario: 'otimista',
        section: 'pessoas',
      },
    ],
  };
}

describe('chaves de armazenamento', () => {
  it('mantém a calculadora publicada e isola a prévia', () => {
    expect(storageKeys(false)).toEqual({
      library: 'gcalc.library.v2',
      legacy: 'gcalc.inputs.v1',
      headtohead: 'gcalc.headtohead.v1',
    });
    expect(storageKeys(true)).toEqual({
      library: 'gcalc.preview.library.v2',
      legacy: 'gcalc.preview.inputs.v1',
      headtohead: 'gcalc.preview.headtohead.v1',
    });
    expect(STORAGE_KEY).toBe('gcalc.library.v2');
    expect(LEGACY_STORAGE_KEY).toBe('gcalc.inputs.v1');
    for (const key of Object.values(storageKeys(true))) {
      expect(key.startsWith('gcalc.preview.')).toBe(true);
      expect(key).not.toBe(STORAGE_KEY);
      expect(key).not.toBe(LEGACY_STORAGE_KEY);
    }
  });
});

describe('serialização da sessão', () => {
  it('preserva premissas, cenário, tipo de loja, benefícios e módulo', () => {
    const session = sessionWith();
    const loaded = parseSession(serializeSession(session));
    expect(loaded.source).toBe('current');
    expect(loaded.draft?.scenario).toBe('otimista');
    expect(loaded.draft?.section).toBe('pessoas');
    expect(loaded.draft?.inputs.profile.storeType).toBe('existente');
    expect(loaded.draft?.inputs.people.payroll.enabled).toBe(false);
    expect(loaded.draft?.inputs.meta.clientName).toBe('Rede Sul');
    expect(loaded.draft?.inputs.robot.capex.equipment).toBe(1_750_000);
    expect(loaded.simulations).toHaveLength(1);
    expect(loaded.simulations[0].name).toBe('Rede Sul — Loja Centro — Otimista');
    expect(loaded.draft?.wizardStep).toBe(0);
  });

  it('preserva o passo do assistente e aceita rascunho antigo sem esse campo', () => {
    const raw = JSON.parse(serializeSession(sessionWith({ section: 'wizard', wizardStep: 4 }))) as {
      draft: { wizardStep?: number; section: string };
    };
    const kept = parseSession(JSON.stringify(raw));
    expect(kept.draft?.section).toBe('wizard');
    expect(kept.draft?.wizardStep).toBe(4);
    expect(kept.draft?.adjustAnchor.robot.capex.equipment).toBe(kept.draft?.inputs.robot.capex.equipment);

    delete (raw.draft as { adjustAnchor?: unknown }).adjustAnchor;
    expect(parseSession(JSON.stringify(raw)).draft?.adjustAnchor.people.payroll.enabled).toBe(false);

    delete raw.draft.wizardStep;
    expect(parseSession(JSON.stringify(raw)).draft?.wizardStep).toBe(0);

    raw.draft.wizardStep = 40;
    expect(parseSession(JSON.stringify(raw)).draft?.wizardStep).toBe(0);
  });

  it('rejeita JSON inválido e versão futura', () => {
    expect(parseSession('{').source).toBe('invalid');
    expect(parseSession('null').source).toBe('invalid');
    expect(parseSession('{"version":99,"draft":{"inputs":{}}}').source).toBe('invalid');
    const almost = sessionWith();
    const future = JSON.stringify({ ...almost, version: 99 });
    expect(parseSession(future).draft).toBeNull();
    expect(parseSession(future).simulations).toEqual([]);
  });

  it('recupera um envelope antigo quando a forma das premissas ainda é reconhecível', () => {
    const inputs = exampleInputs();
    inputs.profile.storeType = 'existente';
    const loaded = parseSession(JSON.stringify({ version: 1, inputs, scenario: 'conservador', section: 'estoque' }));
    expect(loaded.source).toBe('legacy');
    expect(loaded.draft?.scenario).toBe('conservador');
    expect(loaded.draft?.section).toBe('estoque');
    expect(loaded.draft?.inputs.profile.storeType).toBe('existente');
    expect(loaded.simulations).toEqual([]);
  });

  it('ignora rascunho incompleto e mantém simulações válidas da versão atual', () => {
    const valid = sessionWith().simulations[0];
    const loaded = parseSession(JSON.stringify({ version: 2, draft: { inputs: { perfil: true } }, simulations: [valid, { id: 'ruim' }] }));
    expect(loaded.source).toBe('current');
    expect(loaded.draft).toBeNull();
    expect(loaded.simulations.map((item) => item.id)).toEqual(['sim-a']);
  });

  it('migra a chave antiga sem versão e descarta conteúdo ilegível', () => {
    const store = memory();
    const inputs = exampleInputs();
    inputs.people.turnover.enabled = false;
    store.setItem(LEGACY_STORAGE_KEY, JSON.stringify(inputs));
    const migrated = readSession(store);
    expect(migrated.source).toBe('legacy');
    expect(migrated.draft?.inputs.people.turnover.enabled).toBe(false);
    expect(migrated.draft?.scenario).toBe('base');

    const broken = memory();
    broken.setItem(LEGACY_STORAGE_KEY, 'não é json');
    expect(readSession(broken).source).toBe('invalid');

    const empty = memory();
    expect(readSession(empty).source).toBe('empty');
  });

  it('mantém as simulações da raiz quando faltam os campos novos', () => {
    const stored = exampleInputs();
    const raw = JSON.parse(JSON.stringify(stored)) as Record<string, any>;
    delete raw.assumptions.viewMode;
    delete raw.profile.wageGrowthPctPerYear;
    delete raw.profile.opexInflationPctPerYear;
    delete raw.profile.priceInflationPctPerYear;
    delete raw.profile.moneyBasis;
    delete raw.people.journeyHoursPerMonth;
    delete raw.people.reallocatedHours;
    delete raw.people.payroll.chargesPct;
    delete raw.people.payroll.benefitsPerPosition;
    delete raw.people.payroll.costConfirmedFullyLoaded;
    delete raw.people.turnover.costMode;
    delete raw.people.turnover.components;
    for (const key of [
      'useDetailed',
      'cyclesEnabled',
      'reverseTransportMonthly',
      'reverseTransportEnabled',
      'sanitationMonthly',
      'sanitationEnabled',
      'handlingMonthly',
      'handlingEnabled',
      'lossReplacementMonthly',
      'lossReplacementEnabled',
      'spaceMonthly',
      'spaceEnabled',
    ]) {
      delete raw.logistics.boxes[key];
    }
    delete raw.logistics.shelving.stillRequired;
    delete raw.logistics.shelving.removalCost;
    for (const key of ['treatment', 'contractUnchanged', 'avoidedRealEstate', 'commercialEvidence']) {
      delete raw.logistics.space[key];
    }
    for (const key of ['useDetailed', 'expiryMonthly', 'damageMonthly', 'missingMonthly', 'errorsMonthly']) {
      delete raw.stock.losses[key];
    }
    delete raw.stock.abandonment;
    delete raw.stock.workingCapital.reductionProven;
    delete raw.network;
    for (const key of [
      'reorganizationEffectiveness',
      'automatedStockShare',
      'serviceLevel',
      'conversionFactor',
      'taxPolicy',
      'lossUtilizationLimit',
      'taxCapacityMonthly',
      'taxBenefitValidated',
      'taxValidated',
      'extraordinaryEventsTaxable',
      'discountBasis',
      'ramp',
      'capexSchedule',
    ]) {
      delete raw.robot[key];
    }

    const store = memory();
    store.setItem(
      'gcalc.library.v2',
      JSON.stringify({
        version: 2,
        draft: { inputs: raw, scenario: 'base', section: 'dashboard', wizardStep: 0, adjustAnchor: raw },
        simulations: [
          {
            id: 'loja-centro',
            name: 'Loja Centro salva',
            savedAt: '2026-10-01T12:00:00.000Z',
            inputs: raw,
            scenario: 'base',
            section: 'dashboard',
          },
        ],
      }),
    );
    store.setItem('gcalc.preview.library.v2', '{"version":2,"simulations":[{"id":"prev","name":"Só prévia"}]}');

    expect(STORAGE_KEY).toBe('gcalc.library.v2');
    const loaded = readSession(store);
    expect(loaded.source).toBe('current');
    expect(loaded.simulations.map((item) => item.name)).toEqual(['Loja Centro salva']);
    expect(loaded.draft?.inputs.meta.storeName).toBe('Farmácia Aurora — Unidade Centro');
    expect(loaded.draft?.inputs.assumptions.viewMode).toBe('avancado');
    const result = evaluate(loaded.simulations[0].inputs);
    expect(result.netInvestment).toBe(1_980_000);
    expect(result.steadyNet).toBe(65_000);
    expect(result.roi).toBeCloseTo(780_000 / 1_980_000);
    expect(store.getItem('gcalc.preview.library.v2')).toContain('Só prévia');

    writeSession(store, {
      version: STORAGE_VERSION,
      draft: loaded.draft!,
      simulations: loaded.simulations,
    });
    const rewritten = readSession(store);
    expect(rewritten.simulations).toHaveLength(1);
    expect(rewritten.simulations[0].id).toBe('loja-centro');
    expect(store.getItem(STORAGE_KEY)).toContain('Loja Centro salva');
    expect(store.getItem('gcalc.preview.library.v2')).toContain('Só prévia');
  });

  it('grava a versão atual e apaga a chave antiga', () => {
    const store = memory();
    store.setItem(LEGACY_STORAGE_KEY, JSON.stringify(exampleInputs()));
    const session = sessionWith();
    writeSession(store, session);
    expect(store.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(store.getItem(STORAGE_KEY)).toContain(`"version":${STORAGE_VERSION}`);
    expect(readSession(store).draft?.section).toBe('pessoas');
  });

  it('limpa as duas chaves', () => {
    const store = memory();
    writeSession(store, sessionWith());
    store.setItem(LEGACY_STORAGE_KEY, '{}');
    clearSession(store);
    expect(store.getItem(STORAGE_KEY)).toBeNull();
    expect(store.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(readSession(store).source).toBe('empty');
  });
});

describe('biblioteca de simulações', () => {
  const original = sessionWith().simulations[0];

  it('duplica sem alterar o original', () => {
    const copy = duplicateSimulation(original, 'sim-b', '2026-10-09T13:00:00.000Z');
    expect(copy.id).toBe('sim-b');
    expect(copy.name).toBe(`${original.name} (cópia)`);
    expect(copy.inputs.profile.storeType).toBe('existente');
    expect(original.name.endsWith('(cópia)')).toBe(false);
    copy.inputs.meta.storeName = 'Outra';
    expect(original.inputs.meta.storeName).toBe('Loja Centro');
  });

  it('insere, renomeia e exclui', () => {
    const listed = insertDuplicate([original], original.id);
    expect(listed).toHaveLength(2);
    expect(listed[1].name).toContain('(cópia)');
    expect(listed[0]).toBe(original);

    const renamed = renameSimulation(listed, original.id, '  Caso revisado  ');
    expect(renamed[0].name).toBe('Caso revisado');
    expect(renameSimulation(renamed, original.id, '   ')).toEqual(renamed);

    expect(deleteSimulation(renamed, original.id).map((item) => item.id)).toEqual([listed[1].id]);
    expect(deleteSimulation(renamed, 'ausente')).toHaveLength(2);
  });

  it('importa arquivo da versão atual, premissas soltas e versão antiga', () => {
    const session = sessionWith();
    const imported = importPayload(serializeSession(session));
    expect(imported?.draft?.section).toBe('pessoas');
    expect(imported?.simulations).toHaveLength(1);

    const loose = exampleInputs();
    loose.profile.storeType = 'nova';
    expect(importPayload(loose)?.draft?.inputs.profile.storeType).toBe('nova');

    expect(importPayload('{')).toBeNull();
    expect(importPayload('{"version":4,"inputs":{}}')).toBeNull();

    const oldInputs = exampleInputs();
    const old = importPayload({ version: 1, inputs: oldInputs, scenario: 'conservador' });
    expect(old?.draft?.scenario).toBe('conservador');
    expect(old?.simulations).toEqual([]);
  });

  it('não reutiliza id já existente na hora de importar', () => {
    const incoming: SimulationRecord = { ...original, name: 'Importada' };
    const merged = mergeSimulations([original], [incoming]);
    expect(merged).toHaveLength(2);
    expect(merged[1].id).not.toBe(original.id);
    expect(merged[1].name).toBe('Importada');
  });

  it('mantém as premissas calculáveis depois da ida e volta', () => {
    const nova = exampleInputs();
    const existente = exampleInputs();
    existente.profile.storeType = 'existente';
    existente.people.payroll.severanceCost = 0;
    const records: SimulationRecord[] = [
      { id: 'nova', name: 'Nova', savedAt: '2026-10-09T00:00:00.000Z', inputs: nova, scenario: 'base', section: 'dashboard' },
      { id: 'existente', name: 'Existente', savedAt: '2026-10-09T00:00:00.000Z', inputs: existente, scenario: 'base', section: 'dashboard' },
    ];
    const session: PersistedSession = {
      version: STORAGE_VERSION,
      draft: { inputs: nova, scenario: 'base', section: 'dashboard', wizardStep: 0, adjustAnchor: nova },
      simulations: records,
    };
    const loaded = parseSession(serializeSession(session));
    const left = evaluate(loaded.simulations[0].inputs, { scenario: loaded.simulations[0].scenario });
    const right = evaluate(loaded.simulations[1].inputs, { scenario: loaded.simulations[1].scenario });
    expect(left.netInvestment).toBe(1_980_000);
    expect(left.steadyNet).toBe(65_000);
    expect(right.netInvestment).toBe(2_160_000);
    expect(right.steadyNet).toBe(66_500);
  });
});
