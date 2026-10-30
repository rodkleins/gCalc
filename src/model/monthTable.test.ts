import { describe, expect, it } from 'vitest';
import { evaluate } from './calculate';
import { exampleInputs } from './example';
import { buildMonthTable } from './monthTable';
import { defaultStorePreset, storePresets } from './presets';
import { round2 } from './round';
import { HORIZON_MONTHS, type Inputs, type ScenarioId } from './types';

function cases(): Array<{ name: string; inputs: Inputs; scenario: ScenarioId }> {
  const list: Array<{ name: string; inputs: Inputs; scenario: ScenarioId }> = [];
  for (const preset of storePresets()) {
    for (const scenario of ['conservador', 'base', 'otimista'] as ScenarioId[]) {
      list.push({ name: `${preset.id} ${scenario}`, inputs: structuredClone(preset.inputs), scenario });
    }
  }
  list.push({ name: 'exemplo', inputs: exampleInputs(), scenario: 'base' });
  const existing = exampleInputs();
  existing.profile.storeType = 'existente';
  list.push({ name: 'exemplo existente', inputs: existing, scenario: 'base' });
  return list;
}

describe('tabela mês a mês', () => {
  it.each(cases())('fecha com a aba Fluxo em $name', ({ inputs, scenario }) => {
    const result = evaluate(inputs, { scenario });
    const table = buildMonthTable(result);
    expect(table.rows[0].month).toBe(0);
    expect(table.rows.length).toBe(HORIZON_MONTHS + 1);
    expect(table.rows[0].investment).toBe(result.cashFlows[0]);
    expect(table.rows[0].cumulative).toBe(result.cashFlows[0]);
    for (const row of table.rows) {
      const parts =
        row.investment +
        row.laborSavings +
        row.lossReduction +
        row.otherBenefits +
        row.robotCosts +
        row.taxes +
        row.oneTimeEvents;
      expect(round2(parts)).toBeCloseTo(row.netFlow, 2);
      if (row.month > 0) {
        const month = result.months[row.month - 1];
        expect(row.netFlow).toBe(month.incremental);
        expect(row.cumulative).toBe(month.cumulative);
        expect(row.robotCosts).toBe(round2(-month.opex));
      }
    }
  });

  it('o investimento do mês 0 é líquido dos créditos de impostos e negativo', () => {
    const result = evaluate(defaultStorePreset().inputs);
    const table = buildMonthTable(result);
    expect(result.recoverableTaxCredit).toBeGreaterThan(0);
    expect(table.rows[0].investment).toBe(-result.netInvestment);
    expect(table.rows[0].investment).toBeLessThan(0);
    expect(-table.rows[0].investment).toBeLessThan(result.grossCapex);
  });

  it('destaca uma única linha, a do mês em que o saldo vira positivo', () => {
    const result = evaluate(defaultStorePreset().inputs);
    const table = buildMonthTable(result);
    expect(result.payback).not.toBeNull();
    const highlighted = table.rows.filter((row) => row.isPayback);
    expect(highlighted).toHaveLength(1);
    expect(table.paybackMonth).toBe(Math.ceil(result.payback ?? 0));
    const index = highlighted[0].month;
    expect(table.rows[index].cumulative).toBeGreaterThanOrEqual(0);
    expect(table.rows[index - 1].cumulative).toBeLessThan(0);
  });

  it('separa mão de obra e perdas a partir das linhas da auditoria no mês 60', () => {
    const result = evaluate(defaultStorePreset().inputs);
    const steady = result.months[HORIZON_MONTHS - 1];
    expect(steady.laborSavings).toBeGreaterThan(0);
    expect(steady.laborSavings + steady.lossReduction).toBeLessThanOrEqual(steady.benefit + 0.01);
    const lossAudit = result.audit
      .filter((line) => (line.id === 'losses' || line.id === 'shrinkage') && line.includedInCashFlow)
      .reduce((total, line) => total + line.monthlyValue, 0);
    expect(steady.lossReduction).toBeCloseTo(lossAudit, 0);
  });

  it('sem payback no horizonte não destaca linha', () => {
    const inputs = structuredClone(defaultStorePreset().inputs);
    inputs.robot.capex.equipment = inputs.robot.capex.equipment * 100;
    const result = evaluate(inputs);
    const table = buildMonthTable(result);
    expect(result.payback).toBeNull();
    expect(table.paybackMonth).toBeNull();
    expect(table.rows.some((row) => row.isPayback)).toBe(false);
    expect(table.rows.length).toBe(HORIZON_MONTHS + 1);
  });
});
