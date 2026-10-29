import { describe, expect, it } from 'vitest';
import { evaluate } from '../model/calculate';
import { formatPayback } from '../model/format';
import { defaultStorePreset } from '../model/presets';
import { STORAGE_KEY } from '../model/storage';
import { defaultDpspDrivers } from './drivers';
import { DPSP_STORAGE_KEY, DPSP_STORAGE_KEY_V1, readDpspSession, writeDpspSession } from './storage';
import { DPSP_BANNER, MODEL_DISCLAIMER, defaultDpspPreset, dpspPresets } from './stores';

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => (data.has(key) ? data.get(key) ?? null : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe('lojas DPSP', () => {
  it('deriva o faturamento das perdas e mantém o restante da loja de R$ 2 milhões', () => {
    const base = defaultStorePreset();
    const presets = dpspPresets();
    expect(presets.map((preset) => preset.fact.code)).toEqual([327, 267, 27]);
    expect(presets.map((preset) => preset.name)).toEqual([
      '327 DSP Fradique Coutinho',
      '267 DSP João Cachoeira',
      '27 DSP Paulista',
    ]);
    expect(presets.map((preset) => preset.inputs.profile.skuCount)).toEqual([11_055, 10_689, 11_655]);
    expect(presets.map((preset) => preset.inputs.profile.historicalLossesMonthly)).toEqual([4445.92, 6973.55, 4776.14]);
    expect(presets.map((preset) => preset.fact.balconistas)).toEqual([9, 6, 8]);
    expect(presets.map((preset) => preset.fact.headcount)).toEqual([31, 23, 32]);
    expect(presets.map((preset) => preset.fact.volume)).toEqual([20_800, 20_387, 20_962]);
    expect(presets.map((preset) => Math.round(preset.revenue / 10_000) / 100)).toEqual([2.27, 2.86, 2.34]);

    for (const preset of presets) {
      const revenue = Math.round((preset.fact.lossesMonthly / preset.fact.lossPct) * 100) / 100;
      expect(preset.inputs.profile.monthlyRevenue).toBe(revenue);
      expect(preset.revenue).toBe(revenue);
      const headcount = preset.inputs.profile.roles.reduce((total, role) => total + role.headcount, 0);
      const balconistas = preset.inputs.profile.roles.find((role) => role.role === 'Balconista');
      expect(headcount).toBe(preset.fact.headcount);
      expect(balconistas?.headcount).toBe(preset.fact.balconistas);
      expect(balconistas?.monthlyCost).toBe(4_200);
      expect(preset.inputs.people.payroll.positionsReduced).toBeCloseTo(preset.fact.balconistas * 0.5, 2);
      expect(preset.inputs.people.payroll.monthlyCostPerPosition).toBe(4_200);
      expect(preset.inputs.people.payroll.severanceCost).toBeCloseTo(preset.fact.balconistas * 0.5 * 4_200, 2);
      expect(preset.inputs.people.futureHires.hires.every((hire) => hire.role === 'Balconista')).toBe(true);
      expect(preset.inputs.people.futureHires.hires[0]?.headcount).toBe(base.inputs.people.futureHires.hires[0]?.headcount);
      expect(preset.inputs.robot.capex).toEqual(base.inputs.robot.capex);
      expect(preset.inputs.stock.losses.projectedLossesMonthly).toBeCloseTo(
        preset.inputs.profile.historicalLossesMonthly * 0.43,
        2,
      );
      expect(preset.inputs.people.supervision.hoursSavedPerMonth).toBe(base.inputs.people.supervision.hoursSavedPerMonth);
      expect(preset.inputs.logistics.movement.hoursSavedPerMonth).toBe(base.inputs.logistics.movement.hoursSavedPerMonth);
      expect(preset.inputs.logistics.inventoryCount.hoursSavedPerMonth).toBe(
        base.inputs.logistics.inventoryCount.hoursSavedPerMonth,
      );
      expect(preset.inputs.profile.dispensationsPerDay).toBe(base.inputs.profile.dispensationsPerDay);
      expect(preset.inputs.fictional).toBe(false);
      const losses = evaluate(preset.inputs).audit.find((line) => line.id === 'losses')?.monthlyValue ?? 0;
      expect(losses).toBeGreaterThan(0);
    }
    expect(presets.map((preset) => preset.inputs.people.payroll.positionsReduced)).toEqual([4.5, 3, 4]);
    expect(presets.map((preset) => formatPayback(evaluate(preset.inputs).payback))).toEqual([
      '48,6 meses',
      '58,7 meses',
      '52,1 meses',
    ]);
  });

  it('grava só a chave DPSP e não lê a calculadora publicada', () => {
    const store = memory();
    store.setItem(STORAGE_KEY, '{"version":2,"draft":{"inputs":{}}}');
    store.setItem(DPSP_STORAGE_KEY_V1, '{"version":2,"draft":{"inputs":{"meta":{"storeName":"loja antiga"}}}}');
    expect(readDpspSession(store).source).toBe('empty');
    const preset = defaultDpspPreset();
    writeDpspSession(
      store,
      {
        version: 2,
        draft: {
          inputs: preset.inputs,
          scenario: 'base',
          section: 'dashboard',
          wizardStep: 0,
          adjustAnchor: preset.inputs,
        },
        simulations: [],
      },
      defaultDpspDrivers(),
    );
    expect(store.getItem(DPSP_STORAGE_KEY)).toContain('327 DSP Fradique Coutinho');
    expect(store.getItem(DPSP_STORAGE_KEY_V1)).toBeNull();
    expect(store.getItem(STORAGE_KEY)).toContain('version');
    expect(readDpspSession(store).draft?.inputs.meta.storeName).toBe(preset.name);
    expect(readDpspSession(store).drivers.balconistaReductionPct).toBe(0.5);
    expect(DPSP_STORAGE_KEY).toBe('gcalc.dpsp.library.v2');
    expect(DPSP_STORAGE_KEY).not.toBe(STORAGE_KEY);
  });

  it('usa o aviso da calculadora publicada', () => {
    expect(DPSP_BANNER).toBe('Dados DPSP (planilha de 29/10/2026) + premissas do modelo a validar');
    expect(MODEL_DISCLAIMER).toBe('Premissas a validar. Não é parâmetro oficial nem resultado de uma loja real.');
  });
});
