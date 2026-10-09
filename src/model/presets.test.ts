import { describe, expect, it } from 'vitest';
import { evaluate, opexLooksLikeEquipmentPrice } from './calculate';
import { exampleInputs, SUGGESTED_PHARMACIST_MONTHLY_COST, SUGGESTED_TRAINING_PER_HIRE } from './example';
import { normalizeInputs } from './normalize';
import { storePresets } from './presets';

describe('modelos de loja', () => {
  it('oferece três portes fictícios, com o robô à parte e sem queda de estoque', () => {
    const presets = storePresets();
    expect(presets.map((preset) => preset.revenue)).toEqual([1_000_000, 2_000_000, 4_000_000]);
    const ratios = presets.map((preset) => {
      const gross = Object.values(preset.inputs.robot.capex).reduce((total, value) => total + value, 0);
      return gross / preset.revenue;
    });
    expect(new Set(ratios.map((ratio) => ratio.toFixed(2))).size).toBe(3);
    for (const preset of presets) {
      expect(preset.inputs.fictional).toBe(true);
      expect(preset.inputs.meta.notes).toMatch(/fictício/i);
      expect(preset.inputs.meta.notes).toMatch(/Fabio|parâmetros reais/i);
      expect(preset.inputs.stock.workingCapital.reductionProven).toBe(false);
      expect(preset.inputs.stock.workingCapital.inventoryAfter).toBe(preset.inputs.profile.averageInventory);
      expect(preset.inputs.people.training.costPerPerson).toBe(SUGGESTED_TRAINING_PER_HIRE);
      expect(preset.inputs.profile.roles.find((role) => role.role === 'Farmacêutico')?.monthlyCost).toBe(
        SUGGESTED_PHARMACIST_MONTHLY_COST,
      );
      const gross = Object.values(preset.inputs.robot.capex).reduce((total, value) => total + value, 0);
      const opex = Object.values(preset.inputs.robot.opexMonthly).reduce((total, value) => total + value, 0);
      expect(opexLooksLikeEquipmentPrice(gross, opex)).toBe(false);
      expect(preset.inputs.profile.dispensationsPerDay).toBeGreaterThan(0);
      expect(preset.inputs.logistics.space.m2Freed).toBeGreaterThan(0);
    }
  });

  it('fecha a loja de R$ 1 milhão na mão e zera contratação futura em loja nova', () => {
    const preset = storePresets()[0];
    const result = evaluate(preset.inputs);
    const payroll = 2 * 4_200;
    const future = 1 * 4_200;
    const turnover = ((2 + 1) * 0.3 * 8_000) / 12;
    const supervision = 16 * 45;
    const movement = 20 * 40;
    const count = 8 * 40;
    const losses = 12_000 - 6_000;
    const maintenance = 800;
    const benefit = payroll + future + turnover + supervision + movement + count + losses + maintenance;
    const opex = 4_500 + 1_800 + 900 + 400 + 600 + 300;
    expect(benefit).toBe(21_840);
    expect(result.steadyBenefit).toBe(benefit);
    expect(result.steadyNet).toBe(benefit - opex);
    expect(result.netInvestment).toBe(1_610_000);
    expect(result.audit.find((line) => line.id === 'spaceOccupancy')?.includedInCashFlow).toBe(false);

    const asNew = evaluate(preset.inputs, { storeTypeOverride: 'nova' });
    const futureLine = asNew.audit.find((line) => line.id === 'futureHires');
    expect(futureLine?.includedInCashFlow).toBe(false);
    expect(futureLine?.reason).toMatch(/loja existente/i);
    const severance = asNew.audit.find((line) => line.id === 'severance');
    expect(severance?.includedInCashFlow).toBe(false);
    expect(severance?.reason).toMatch(/loja nova/i);
    const payrollOnly = 2 * 4_200;
    const turnoverNew = (2 * 0.3 * 8_000) / 12;
    const benefitNew = payrollOnly + turnoverNew + supervision + movement + count + losses;
    expect(asNew.steadyBenefit).toBe(benefitNew);
  });
});

describe('avisos de leitura', () => {
  it('avisa quando o OPEX anual passa de 20% do CAPEX', () => {
    const inputs = exampleInputs();
    inputs.robot.opexMonthly = {
      maintenance: 40_000,
      software: 0,
      energy: 0,
      downtime: 0,
      insurance: 0,
      other: 0,
    };
    const result = evaluate(inputs);
    expect(opexLooksLikeEquipmentPrice(result.grossCapex, result.monthlyOpex)).toBe(true);
    expect(result.warnings.some((warning) => /20% do CAPEX/.test(warning))).toBe(true);
    expect(evaluate(exampleInputs()).warnings.some((warning) => /20% do CAPEX/.test(warning))).toBe(false);
  });

  it('não presume queda de estoque quando a simulação antiga não traz o campo', () => {
    const inputs = exampleInputs();
    inputs.stock.workingCapital.enabled = true;
    inputs.stock.workingCapital.inventoryAfter = 100_000;
    delete (inputs.stock.workingCapital as { reductionProven?: boolean }).reductionProven;
    const normalized = normalizeInputs(inputs);
    expect(normalized.stock.workingCapital.reductionProven).toBe(false);
    expect(evaluate(normalized).informational.workingCapitalRelease).toBe(0);
  });
});
