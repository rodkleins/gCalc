import { describe, expect, it } from 'vitest';
import { calculationMemory } from './calcMemory';
import { evaluate } from './calculate';
import {
  DEFAULT_INFLATION,
  FOCUS_IPCA,
  inflationWarning,
  realFromNominal,
  switchMoneyBasis,
  withInflationShock,
  withoutInflation,
} from './inflation';
import { defaultStorePreset, storePresets } from './presets';
import { ROOT_LOSSES_2M, rootDefaultStorePreset, rootStorePresets } from './rootPresets';

describe('inflação da calculadora raiz', () => {
  it('usa a mediana do IPCA de 2027 do Focus e salário IPCA + 1 p.p.', () => {
    expect(FOCUS_IPCA.ipca2027).toBe(0.0434);
    expect(FOCUS_IPCA.surveyDate).toBe('2026-10-23');
    expect(FOCUS_IPCA.reportUrl).toMatch(/^https:\/\/www\.bcb\.gov\.br\//);
    expect(DEFAULT_INFLATION.priceInflationPctPerYear).toBe(0.0434);
    expect(DEFAULT_INFLATION.opexInflationPctPerYear).toBe(0.0434);
    expect(DEFAULT_INFLATION.wageGrowthPctPerYear).toBeCloseTo(0.0534, 10);
  });

  it('os portes da raiz saem nominais com inflação e a loja de R$ 2 milhões com perdas de R$ 6.600', () => {
    for (const preset of rootStorePresets()) {
      expect(preset.inputs.profile.moneyBasis).toBe('nominal');
      expect(preset.inputs.robot.discountBasis).toBe('nominal');
      expect(preset.inputs.robot.discountRateAnnual).toBe(0.12);
      expect(preset.inputs.profile.priceInflationPctPerYear).toBe(0.0434);
      expect(inflationWarning(preset.inputs)).toBeNull();
      expect(evaluate(preset.inputs).warnings.join(' ')).not.toMatch(/base/i);
    }
    const root = rootDefaultStorePreset().inputs;
    expect(root.profile.historicalLossesMonthly).toBe(ROOT_LOSSES_2M.historical);
    expect(root.stock.losses.projectedLossesMonthly).toBe(ROOT_LOSSES_2M.projected);
    expect(root.meta.notes).toContain('Focus');
    const byId = Object.fromEntries(rootStorePresets().map((preset) => [preset.id, preset.inputs]));
    expect(byId['loja-1m'].profile.historicalLossesMonthly).toBe(14_000);
    expect(byId['loja-4m'].profile.historicalLossesMonthly).toBe(56_000);
  });

  it('não mexe nos portes compartilhados de /rh/ e /dpsp/', () => {
    const shared = defaultStorePreset().inputs;
    expect(shared.profile.historicalLossesMonthly).toBe(28_000);
    expect(shared.stock.losses.projectedLossesMonthly).toBe(12_000);
    for (const preset of storePresets()) {
      expect(preset.inputs.profile.priceInflationPctPerYear).toBe(0);
      expect(preset.inputs.profile.wageGrowthPctPerYear).toBe(0);
      expect(preset.inputs.profile.opexInflationPctPerYear).toBe(0);
    }
    expect(calculationMemory(shared, evaluate(shared)).flatMap((block) => block.rows).some((row) => row.id === 'inflation')).toBe(
      false,
    );
  });

  it('base real zera os reajustes e converte a taxa pela equação de Fisher; nominal restaura', () => {
    const nominal = rootDefaultStorePreset().inputs;
    const real = switchMoneyBasis(nominal, 'real');
    expect(real.profile.moneyBasis).toBe('real');
    expect(real.robot.discountBasis).toBe('real');
    expect(real.profile.priceInflationPctPerYear).toBe(0);
    expect(real.profile.wageGrowthPctPerYear).toBe(0);
    expect(real.profile.opexInflationPctPerYear).toBe(0);
    expect(real.robot.discountRateAnnual).toBeCloseTo(1.12 / 1.0434 - 1, 6);
    expect(realFromNominal(0.12, 0.0434)).toBeCloseTo(0.073414, 6);
    expect(inflationWarning(real)).toBeNull();
    const back = switchMoneyBasis(real, 'nominal');
    expect(back.robot.discountRateAnnual).toBeCloseTo(0.12, 6);
    expect(back.profile.priceInflationPctPerYear).toBe(0.0434);
    expect(back.profile.wageGrowthPctPerYear).toBeCloseTo(0.0534, 10);
  });

  it('avisa quando a inflação não combina com a base', () => {
    const nominal = rootDefaultStorePreset().inputs;
    expect(inflationWarning(withoutInflation(nominal))).toMatch(/nominal/i);
    const real = switchMoneyBasis(nominal, 'real');
    real.profile.priceInflationPctPerYear = 0.05;
    expect(inflationWarning(real)).toMatch(/real/i);
  });

  it('a inflação entra no fluxo e aparece no Ver cálculo com o efeito no payback', () => {
    const inputs = rootDefaultStorePreset().inputs;
    const result = evaluate(inputs);
    const flat = evaluate(withoutInflation(inputs));
    expect(result.months[59].laborSavings).toBeGreaterThan(flat.months[59].laborSavings);
    expect(result.months[0].laborSavings).toBe(flat.months[0].laborSavings);
    const rows = calculationMemory(inputs, result).flatMap((block) => block.rows);
    expect(rows.find((row) => row.id === 'inflation')?.text).toContain('4,34%');
    expect(rows.find((row) => row.id === 'inflation-effect')?.text).toContain('Sem reajuste');
    const stressed = evaluate(withInflationShock(inputs));
    expect(stressed.steadyNet).not.toBe(result.steadyNet);
  });

  it('perdas consolidadas seguem o IPCA e ficam iguais sem inflação', () => {
    const inputs = rootDefaultStorePreset().inputs;
    const shared = evaluate(defaultStorePreset().inputs);
    const flatShared = evaluate(withoutInflation(defaultStorePreset().inputs));
    expect(shared.steadyNet).toBe(flatShared.steadyNet);
    const result = evaluate(inputs);
    const flat = evaluate(withoutInflation(inputs));
    expect(result.months[59].lossReduction).toBeGreaterThan(flat.months[59].lossReduction);
  });
});
