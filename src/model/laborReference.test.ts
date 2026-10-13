import { describe, expect, it } from 'vitest';
import { evaluate } from './calculate';
import { exampleInputs } from './example';
import { formatNumber, formatPayback } from './format';
import { laborReference, marketReferenceText } from './laborReference';
import { potentialGain } from './potentialGain';
import { defaultStorePreset } from './presets';
import { applyRoster } from '../rh/roster';
import { rhDefaultPreset } from '../rh/presets';

describe('referência de mão de obra', () => {
  it('na loja de R$ 2 milhões calcula horas e pessoas sem mudar o payback', () => {
    const root = defaultStorePreset().inputs;
    const before = evaluate(root);
    const reference = laborReference(root);
    expect(reference.hoursPerMonth).toBe(850);
    expect(reference.journeyHoursPerMonth).toBe(176);
    expect(reference.people).toBeCloseTo(850 / 176, 8);
    expect(reference.coverageFactor).toBeCloseTo((7 / 6) * (365 / 329), 8);
    expect(formatNumber(reference.people, 2)).toBe('4,83');
    expect(formatNumber(reference.peopleWithCoverage, 2)).toBe('6,25');
    expect(marketReferenceText(root)).toBe(
      'Receber, conferir, guardar e separar cada unidade leva cerca de 1 minuto. Com 1.700 unidades por dia, são 850 horas de trabalho por mês: 4,83 pessoas na jornada de 176 horas, ou 6,25 pessoas contando folgas e férias. A referência ajuda a validar as vagas evitadas, mas não soma ao resultado.',
    );
    expect(marketReferenceText(root)).not.toMatch(/1,2943|6x1|fator/);
    expect(formatPayback(evaluate(root).payback)).toBe(formatPayback(before.payback));
    expect(formatPayback(before.payback)).toBe('29,1 meses');

    const rhPreset = rhDefaultPreset();
    const rhInputs = applyRoster(structuredClone(rhPreset.inputs), rhPreset.roster);
    const rhBefore = evaluate(rhInputs);
    const rhReference = laborReference(rhInputs);
    expect(rhReference.hoursPerMonth).toBe(850);
    expect(formatNumber(rhReference.people, 2)).toBe('4,83');
    expect(formatNumber(rhReference.peopleWithCoverage, 2)).toBe('6,25');
    expect(formatPayback(rhBefore.payback)).toBe('33,3 meses');
    expect(formatPayback(evaluate(rhInputs).payback)).toBe('33,3 meses');
  });
});

describe('ganho potencial fora do caixa', () => {
  it('não aparece na loja de R$ 2 milhões, porque os potenciais estão zerados', () => {
    const inputs = defaultStorePreset().inputs;
    expect(potentialGain(inputs, evaluate(inputs))).toBeNull();
  });

  it('lista caixas potenciais com valor e o payback que elas teriam', () => {
    const inputs = exampleInputs();
    inputs.logistics.boxes.enabled = true;
    inputs.logistics.boxes.confidence = 'potencial';
    inputs.logistics.boxes.processValidated = true;
    inputs.logistics.boxes.cyclesAvoidedPerMonth = 400;
    inputs.logistics.boxes.costPerCycle = 8;
    inputs.assumptions.includePotential = false;
    const result = evaluate(inputs);
    const gain = potentialGain(inputs, result);
    expect(gain).not.toBeNull();
    expect(gain?.lines.some((line) => line.label.includes('Caixas'))).toBe(true);
    expect(gain?.monthlyTotal).toBeGreaterThan(0);
    expect(result.audit.find((line) => line.id === 'boxes')?.includedInCashFlow).toBe(false);
    expect(formatPayback(result.payback)).not.toBe(formatPayback(gain?.payback ?? null));
  });

  it('tira o crédito de impostos do grupo de potenciais', () => {
    const result = evaluate(defaultStorePreset().inputs);
    const credit = result.audit.find((line) => line.id === 'taxCredit');
    expect(credit?.confidence).toBe('comprovavel');
    expect(credit?.includedInCashFlow).toBe(true);
    expect(result.audit.filter((line) => line.confidence === 'potencial').some((line) => line.id === 'taxCredit')).toBe(
      false,
    );
  });
});
