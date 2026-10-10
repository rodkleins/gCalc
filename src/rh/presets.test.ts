import { describe, expect, it } from 'vitest';
import { MINIMUM_EQUIPMENT_PRICE, MINIMUM_MONTHLY_ROBOT_COST } from '../model/example';
import { evaluate } from '../model/calculate';
import { formatPayback } from '../model/format';
import { rhModels, rhScorecard } from './presets';
import { suggestedCoverageFactor, summarizeRoster } from './roster';

describe('modelos com quadro de RH', () => {
  it('mantém o piso do equipamento e a faixa de custo mensal, com o quadro ligado ao resultado', () => {
    const rows = rhScorecard();
    expect(rows.map((row) => row.id)).toEqual(['exemplo', 'loja-1m', 'loja-2m', 'loja-4m']);
    for (const row of rows) {
      expect(row.equipment).toBeGreaterThanOrEqual(MINIMUM_EQUIPMENT_PRICE);
      expect(row.informedMonthlyCost).toBeGreaterThanOrEqual(MINIMUM_MONTHLY_ROBOT_COST);
      expect(row.informedMonthlyCost).toBeLessThanOrEqual(6_000);
      expect(row.present).toBeGreaterThan(0);
      expect(row.payroll).toBeGreaterThan(0);
      expect(row.avoidedHired).toBeGreaterThan(0);
      const model = rhModels().find((item) => item.id === row.id);
      if (!model) throw new Error(row.id);
      const result = evaluate(model.inputs);
      const summary = summarizeRoster(model.roster);
      expect(result.audit.find((line) => line.id === 'payroll')?.monthlyValue).toBeCloseTo(summary.avoidedPayroll, 0);
      expect(model.inputs.people.supervision.enabled).toBe(false);
      expect(model.inputs.logistics.movement.enabled).toBe(false);
      expect(model.inputs.logistics.inventoryCount.enabled).toBe(false);
      expect(model.inputs.people.reallocatedHours.enabled).toBe(false);
    }
    expect(rows[0].shiftCount).toBe(2);
    expect(rows[1].shiftCount).toBe(2);
    expect(rows[2].shiftCount).toBe(2);
    expect(rows[3].shiftCount).toBe(3);
    expect(rows[0].storeType).toBe('nova');
    expect(rows[1].storeType).toBe('existente');
    expect(rows.map((row) => row.equipment)).toEqual([1_000_000, 1_000_000, 1_350_000, 1_850_000]);
    expect(rows.map((row) => row.informedMonthlyCost)).toEqual([5_000, 5_000, 5_500, 6_000]);
    const people = rows.map((row) => row.present);
    expect(people[1]).toBeLessThan(people[2]);
    expect(people[2]).toBeLessThan(people[3]);
    const factor61 = suggestedCoverageFactor('6x1', { yearDays: 365, vacationDays: 30, absenceDays: 6 });
    const factor12 = suggestedCoverageFactor('12x36', { yearDays: 365, vacationDays: 30, absenceDays: 6 });
    expect(rows[0].avoidedPayroll).toBeCloseTo(2 * factor61 * 4_200, 2);
    expect(rows[3].avoidedPayroll).toBeCloseTo(6 * factor61 * 4_200 + 3 * factor12 * 4_200 * 1.1, 2);
    expect(rows.map((row) => row.cells.map((cell) => formatPayback(cell.payback)))).toEqual([
      ['Não recupera em 60 meses', 'Não recupera em 60 meses', '58,5 meses'],
      ['Não recupera em 60 meses', 'Não recupera em 60 meses', '52,5 meses'],
      ['54,5 meses', '39,1 meses', '33,6 meses'],
      ['19,8 meses', '14,7 meses', '12,8 meses'],
    ]);
  });
});
