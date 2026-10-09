import { describe, expect, it } from 'vitest';
import { evaluate } from './calculate';
import { exampleInputs } from './example';
import {
  fieldForAudit,
  leverDelta,
  leversDiffer,
  leverValue,
  nudgeLever,
  reanchor,
  sectionForField,
  withLeverValue,
} from './premises';

describe('premissas e ajuste rápido', () => {
  it('aponta cada premissa do exemplo para um campo editável', () => {
    const result = evaluate(exampleInputs());
    const linked = result.audit.filter(
      (line) => line.includedInCashFlow && (line.monthlyValue !== 0 || line.oneTimeValue !== 0),
    );
    expect(linked.length).toBeGreaterThan(5);
    for (const line of linked) {
      const fieldId = fieldForAudit(line.id);
      expect(fieldId, line.id).toBeTruthy();
      expect(sectionForField(fieldId ?? '')).toBeTruthy();
    }
    expect(sectionForField('robot.capex.equipment')).toBe('investimento');
    expect(sectionForField('people.payroll.monthlyCostPerPosition')).toBe('pessoas');
    expect(sectionForField('profile.historicalLossesMonthly')).toBe('estoque');
    expect(sectionForField('profile.dispensationsPerDay')).toBe('perfil');
  });

  it('escala o CAPEX do robô e o OPEX a partir do valor original', () => {
    const anchor = exampleInputs();
    const gross = leverValue(anchor, 'investimento');
    const raised = withLeverValue(anchor, anchor, 'investimento', gross * 1.3);
    expect(raised.robot.capex.equipment).toBeCloseTo(anchor.robot.capex.equipment * 1.3, 2);
    expect(raised.robot.capex.freightImportTaxes).toBeCloseTo(anchor.robot.capex.freightImportTaxes * 1.3, 2);
    expect(raised.logistics.shelving.avoidedAcquisition).toBeCloseTo(anchor.logistics.shelving.avoidedAcquisition * 1.3, 2);
    expect(leverDelta(raised, anchor, 'investimento')).toBeCloseTo(0.3, 6);

    const opex = withLeverValue(anchor, anchor, 'opex', leverValue(anchor, 'opex') * 1.1);
    expect(leverValue(opex, 'opex')).toBeCloseTo(15_000 * 1.1, 2);
    expect(opex.robot.opexMonthly.software).toBeCloseTo(anchor.robot.opexMonthly.software * 1.1, 2);
  });

  it('aplica salário, turnover, volume, vendas e desconto sem mexer nas outras alavancas', () => {
    const anchor = exampleInputs();
    const salaries = withLeverValue(anchor, anchor, 'salarios', 10_000);
    expect(salaries.people.payroll.monthlyCostPerPosition).toBe(10_000);
    expect(salaries.people.payroll.positionsReduced).toBe(anchor.people.payroll.positionsReduced);

    const turnover = withLeverValue(anchor, anchor, 'turnover', anchor.people.turnover.annualRate * 0.7);
    expect(turnover.people.turnover.annualRate).toBeCloseTo(0.14, 6);
    expect(turnover.people.turnover.costPerReplacement).toBe(anchor.people.turnover.costPerReplacement);

    const volume = withLeverValue(anchor, anchor, 'volume', 990);
    expect(volume.profile.dispensationsPerDay).toBe(990);
    expect(volume.profile.historicalLossesMonthly).toBeCloseTo(18_000 * 1.1, 2);
    expect(volume.stock.losses.projectedLossesMonthly).toBeCloseTo(8_000 * 1.1, 2);
    expect(volume.logistics.boxes.cyclesAvoidedPerMonth).toBeCloseTo(anchor.logistics.boxes.cyclesAvoidedPerMonth * 1.1, 2);

    const salesBase = leverValue(anchor, 'vendas');
    const sales = withLeverValue(anchor, anchor, 'vendas', salesBase * 1.2);
    expect(sales.stock.ruptures.additionalMonthlySales).toBeCloseTo(anchor.stock.ruptures.additionalMonthlySales * 1.2, 2);
    expect(sales.people.consultativeSales.hoursFreedPerMonth).toBe(anchor.people.consultativeSales.hoursFreedPerMonth);

    const discount = withLeverValue(anchor, anchor, 'desconto', 0.15);
    expect(discount.robot.discountRateAnnual).toBe(0.15);
    expect(discount.robot.capex.equipment).toBe(anchor.robot.capex.equipment);
  });

  it('coloca o valor no campo principal quando a base é zero e desfaz pelo âncora', () => {
    const anchor = exampleInputs();
    anchor.robot.capex = {
      equipment: 0,
      freightImportTaxes: 0,
      installationTraining: 0,
      civilElectrical: 0,
      integration: 0,
      implementationContingency: 0,
    };
    const filled = withLeverValue(anchor, anchor, 'investimento', 500_000);
    expect(filled.robot.capex.equipment).toBe(500_000);
    expect(filled.robot.capex.freightImportTaxes).toBe(0);

    const current = nudgeLever(exampleInputs(), exampleInputs(), 'investimento', 1);
    expect(leverValue(current, 'investimento')).toBeCloseTo(2_180_000 * 1.05, 0);

    const zeroed = withLeverValue(exampleInputs(), exampleInputs(), 'investimento', 0);
    expect(leverValue(zeroed, 'investimento')).toBe(0);
    expect(Object.values(zeroed.robot.capex).every((value) => value === 0)).toBe(true);
    expect(zeroed.logistics.shelving.avoidedAcquisition).toBe(exampleInputs().logistics.shelving.avoidedAcquisition);

    let stepped = exampleInputs();
    const fresh = exampleInputs();
    for (let step = 0; step < 7; step += 1) stepped = nudgeLever(stepped, fresh, 'investimento', -1);
    expect(leverValue(stepped, 'investimento')).toBeLessThan(2_180_000 * 0.7);
    for (let step = 0; step < 13; step += 1) stepped = nudgeLever(stepped, fresh, 'investimento', -1);
    expect(leverValue(stepped, 'investimento')).toBe(0);
    expect(leverValue(nudgeLever(stepped, fresh, 'investimento', -1), 'investimento')).toBe(0);

    const typed = withLeverValue(fresh, fresh, 'investimento', 2_180_000 * 1.8);
    const eased = nudgeLever(typed, fresh, 'investimento', -1);
    expect(leverValue(eased, 'investimento')).toBeCloseTo(2_180_000 * 1.75, 0);
    const undone = exampleInputs();
    expect(leversDiffer(current, undone)).toBe(true);
    expect(evaluate(undone).netInvestment).toBe(2_000_000);
    expect(evaluate(undone).steadyNet).toBe(65_000);
  });

  it('grava edição direta no âncora e preserva o ajuste das outras alavancas', () => {
    const anchor = exampleInputs();
    const adjusted = withLeverValue(anchor, anchor, 'investimento', leverValue(anchor, 'investimento') * 1.1);
    const hand = structuredClone(adjusted);
    hand.people.payroll.monthlyCostPerPosition = 10_000;
    hand.meta.storeName = 'Outra loja';
    const nextAnchor = reanchor(anchor, adjusted, hand);
    expect(nextAnchor.meta.storeName).toBe('Outra loja');
    expect(nextAnchor.people.payroll.monthlyCostPerPosition).toBe(10_000);
    expect(nextAnchor.robot.capex.equipment).toBe(anchor.robot.capex.equipment);
    expect(hand.robot.capex.equipment).toBeCloseTo(anchor.robot.capex.equipment * 1.1, 2);
  });
});
