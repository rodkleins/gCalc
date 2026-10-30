import { describe, expect, it } from 'vitest';
import { evaluate } from './calculate';
import { rootDefaultStorePreset as defaultStorePreset } from './rootPresets';
import { normalizeWizardStep, validateWizardStep, wizardSeed, withOtherCapex, withTotalOpex, WIZARD_STEPS } from './wizard';

describe('assistente', () => {
  it('tem um passo inicial, um por tema e o resumo', () => {
    expect(WIZARD_STEPS.map((step) => step.id)).toEqual([
      'inicio',
      'farmacia',
      'pessoas',
      'logistica',
      'estoque',
      'investimento',
      'resumo',
    ]);
  });

  it('parte da loja de R$ 2 milhões, com a loja ainda sem nome', () => {
    const seed = wizardSeed();
    const model = defaultStorePreset().inputs;
    const modelResult = evaluate(model);
    expect(seed.meta.storeName).toBe('');
    expect(seed.fictional).toBe(true);
    expect(seed.profile.monthlyRevenue).toBe(2_000_000);
    expect(seed.profile.storeType).toBe('existente');
    expect(seed.people.payroll.positionsReduced).toBe(6);
    expect(seed.robot.capex.equipment).toBe(model.robot.capex.equipment);
    const result = evaluate(seed);
    expect(result.netInvestment).toBe(modelResult.netInvestment);
    expect(result.steadyNet).toBe(modelResult.steadyNet);
    expect(result.payback).toBe(modelResult.payback);
    expect(result.roi).toBe(modelResult.roi);
  });

  it('pede o nome da loja e aceita o restante sugerido', () => {
    const seed = wizardSeed();
    expect(validateWizardStep(0, seed)).toMatch(/nome/i);
    seed.meta.storeName = 'Unidade Centro';
    for (let step = 0; step < WIZARD_STEPS.length; step += 1) {
      expect(validateWizardStep(step, seed)).toBeNull();
    }
  });

  it('barra folha ligada sem vaga e investimento zerado', () => {
    const inputs = wizardSeed();
    inputs.meta.storeName = 'Unidade Centro';
    inputs.people.payroll.positionsReduced = 0;
    expect(validateWizardStep(2, inputs)).toMatch(/vagas/i);
    inputs.people.payroll.enabled = false;
    expect(validateWizardStep(2, inputs)).toBeNull();

    inputs.robot.capex = {
      equipment: 0,
      freightImportTaxes: 0,
      installationTraining: 0,
      civilElectrical: 0,
      integration: 0,
      implementationContingency: 0,
    };
    expect(validateWizardStep(5, inputs)).toBeNull();
    inputs.robot.capex.equipment = -1;
    expect(validateWizardStep(5, inputs)).toMatch(/negativ/i);
  });

  it('normaliza passo inválido e concentra CAPEX e OPEX editados no assistente', () => {
    expect(normalizeWizardStep(3)).toBe(3);
    expect(normalizeWizardStep(1.5)).toBe(0);
    expect(normalizeWizardStep(99)).toBe(0);
    expect(normalizeWizardStep('2')).toBe(0);

    const inputs = withTotalOpex(withOtherCapex(wizardSeed(), 235_000), 5_000);
    expect(inputs.robot.capex.equipment).toBe(1_350_000);
    expect(inputs.robot.capex.implementationContingency).toBe(235_000);
    expect(inputs.robot.capex.freightImportTaxes).toBe(0);
    expect(inputs.robot.opexMonthly.maintenance).toBe(5_000);
    expect(inputs.robot.opexMonthly.other).toBe(wizardSeed().robot.opexMonthly.other);
    expect(inputs.robot.energy.powerKw).toBe(wizardSeed().robot.energy.powerKw);
    const result = evaluate(inputs);
    expect(result.netInvestment).toBe(1_247_500);
    expect(result.monthlyOpex).toBe(6_604);
    expect(result.steadyNet).toBe(46_080.74);
  });
});