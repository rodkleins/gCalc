import { describe, expect, it } from 'vitest';
import { evaluate } from './calculate';
import { exampleInputs } from './example';
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

  it('parte das sugestões do exemplo, com a loja ainda sem nome', () => {
    const seed = wizardSeed();
    expect(seed.meta.storeName).toBe('');
    expect(seed.fictional).toBe(true);
    expect(seed.people.payroll.positionsReduced).toBe(exampleInputs().people.payroll.positionsReduced);
    const result = evaluate(seed);
    expect(result.netInvestment).toBe(2_000_000);
    expect(result.steadyNet).toBe(65_000);
    expect(result.payback).toBeCloseTo(2_000_000 / 65_000, 6);
    expect(result.roi).toBeCloseTo(0.39, 8);
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
    expect(validateWizardStep(5, inputs)).toMatch(/investimento/i);
  });

  it('normaliza passo inválido e concentra CAPEX e OPEX editados no assistente', () => {
    expect(normalizeWizardStep(3)).toBe(3);
    expect(normalizeWizardStep(1.5)).toBe(0);
    expect(normalizeWizardStep(99)).toBe(0);
    expect(normalizeWizardStep('2')).toBe(0);

    const inputs = withTotalOpex(withOtherCapex(wizardSeed(), 430_000), 15_000);
    expect(inputs.robot.capex.equipment).toBe(1_750_000);
    expect(inputs.robot.capex.implementationContingency).toBe(430_000);
    expect(inputs.robot.capex.freightImportTaxes).toBe(0);
    expect(inputs.robot.opexMonthly.maintenance).toBe(15_000);
    expect(inputs.robot.opexMonthly.software).toBe(0);
    const result = evaluate(inputs);
    expect(result.netInvestment).toBe(2_000_000);
    expect(result.monthlyOpex).toBe(15_000);
    expect(result.steadyNet).toBe(65_000);
  });
});