import { describe, expect, it } from 'vitest';
import { evaluate, opexLooksLikeEquipmentPrice } from './calculate';
import {
  equipmentFloorWarning,
  exampleInputs,
  monthlyRobotCostWarning,
  SUGGESTED_PHARMACIST_MONTHLY_COST,
  SUGGESTED_TRAINING_PER_HIRE,
} from './example';
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
    const payroll = 3 * 4_200;
    const future = 1 * 4_200;
    const turnover = ((3 + 1) * 0.3 * 8_000) / 12;
    const supervision = 24 * 45;
    const movement = 28 * 40;
    const count = 12 * 40;
    const losses = 14_000 - 6_000;
    const maintenance = 600;
    const benefit = payroll + future + turnover + supervision + movement + count + losses + maintenance;
    const opex = 2_800 + 900 + 500 + 300 + 300 + 200;
    expect(benefit).toBe(28_880);
    expect(result.steadyBenefit).toBe(benefit);
    expect(result.steadyNet).toBe(benefit - opex);
    expect(result.netInvestment).toBe(1_235_000);
    expect(result.audit.find((line) => line.id === 'spaceOccupancy')?.includedInCashFlow).toBe(false);

    const asNew = evaluate(preset.inputs, { storeTypeOverride: 'nova' });
    const futureLine = asNew.audit.find((line) => line.id === 'futureHires');
    expect(futureLine?.includedInCashFlow).toBe(false);
    expect(futureLine?.reason).toMatch(/loja existente/i);
    const severance = asNew.audit.find((line) => line.id === 'severance');
    expect(severance?.includedInCashFlow).toBe(false);
    expect(severance?.reason).toMatch(/loja nova/i);
    const payrollOnly = 3 * 4_200;
    const turnoverNew = (3 * 0.3 * 8_000) / 12;
    const benefitNew = payrollOnly + turnoverNew + supervision + movement + count + losses;
    expect(asNew.steadyBenefit).toBe(benefitNew);
  });

  it('aumenta equipe, folha e equipamento com o porte e respeita o piso do robô', () => {
    const presets = storePresets();
    const headcount = presets.map((preset) =>
      preset.inputs.profile.roles.reduce((total, role) => total + role.headcount, 0),
    );
    const payroll = presets.map((preset) =>
      preset.inputs.profile.roles.reduce((total, role) => total + role.headcount * role.monthlyCost, 0),
    );
    expect(headcount).toEqual([12, 24, 47]);
    expect(payroll).toEqual([63_500, 127_000, 249_500]);
    expect(payroll[0]).toBeLessThan(payroll[1]);
    expect(payroll[1]).toBeLessThan(payroll[2]);
    const family = (name: string) =>
      presets.map((preset) =>
        preset.inputs.profile.roles
          .filter((role) => role.role === name)
          .reduce((total, role) => total + role.headcount, 0),
      );
    for (const counts of [family('Farmacêutico'), family('Auxiliar de farmácia'), family('Estoquista'), family('Gerente de loja')]) {
      expect(counts[0]).toBeLessThan(counts[1]);
      expect(counts[1]).toBeLessThan(counts[2]);
    }
    expect(presets[2].inputs.profile.roles.some((role) => role.shift.includes('noite'))).toBe(true);
    expect(presets[0].inputs.robot.capex.civilElectrical).toBe(50_000);
    expect(presets[1].inputs.robot.capex.civilElectrical).toBe(50_000);
    expect(presets[2].inputs.robot.capex.civilElectrical).toBe(50_000);
    const equipment = presets.map((preset) => preset.inputs.robot.capex.equipment);
    const opex = presets.map((preset) =>
      Object.values(preset.inputs.robot.opexMonthly).reduce((total, value) => total + value, 0),
    );
    expect(equipment).toEqual([1_000_000, 1_350_000, 1_850_000]);
    expect(opex).toEqual([5_000, 5_500, 6_000]);
    expect(presets[0].inputs.people.payroll.positionsReduced).toBe(3);
    expect(presets[1].inputs.people.payroll.positionsReduced).toBe(6);
    expect(presets[2].inputs.people.payroll.positionsReduced).toBe(9);

    const base = presets.map((preset) => evaluate(preset.inputs));
    for (const result of base) {
      expect(result.payback).not.toBeNull();
      expect(result.roi).toBeGreaterThan(0);
      expect(result.audit.find((line) => line.id === 'shrinkage')?.includedInCashFlow).toBe(false);
      expect(result.audit.find((line) => line.id === 'spaceOccupancy')?.includedInCashFlow).toBe(false);
    }
    expect(base[0].payback as number).toBeGreaterThan(30);
    expect(base[1].payback as number).toBeGreaterThan(30);
    expect(base[2].payback as number).toBeLessThanOrEqual(30);
    expect(base[2].npv).toBeGreaterThan(0);
    expect(base[1].payback as number).toBeLessThan(base[0].payback as number);
    expect(base[2].payback as number).toBeLessThan(base[1].payback as number);
  });
});

describe('avisos de leitura', () => {
  it('avisa equipamento abaixo de R$ 1.000.000 e custo mensal abaixo de R$ 5.000', () => {
    const inputs = exampleInputs();
    expect(evaluate(inputs).warnings.some((warning) => /1\.000\.000/.test(warning))).toBe(false);
    expect(evaluate(inputs).warnings.some((warning) => /5\.000/.test(warning))).toBe(false);
    inputs.robot.capex.equipment = 900_000;
    expect(evaluate(inputs).warnings).toContain(equipmentFloorWarning(900_000));
    inputs.robot.capex.equipment = 1_000_000;
    inputs.robot.opexMonthly = {
      maintenance: 4_000,
      software: 0,
      energy: 0,
      downtime: 0,
      insurance: 0,
      other: 0,
    };
    expect(evaluate(inputs).warnings).toContain(monthlyRobotCostWarning(4_000));
    inputs.robot.capex.equipment = 0;
    inputs.robot.opexMonthly.maintenance = 0;
    const empty = evaluate(inputs);
    expect(empty.warnings.some((warning) => /1\.000\.000/.test(warning))).toBe(false);
    expect(empty.warnings.some((warning) => /partem desse piso/.test(warning))).toBe(false);
  });

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
