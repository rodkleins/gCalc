import { describe, expect, it } from 'vitest';
import { evaluate, sensitivity } from './calculate';
import { exampleInputs, matchesIllustrativeExample } from './example';
import { npv, simplePayback } from './finance';
import type { Inputs } from './types';

function cloneExample(): Inputs {
  return exampleInputs();
}

function includedMonthly(inputs: Inputs, id: string): number {
  const line = evaluate(inputs).audit.find((item) => item.id === id);
  if (!line?.includedInCashFlow) return 0;
  return line.monthlyValue;
}

describe('exemplo ilustrativo do escopo', () => {
  const result = evaluate(cloneExample());

  it('fecha investimento, benefício, payback e ROI', () => {
    expect(result.netInvestment).toBe(2_000_000);
    expect(result.grossCapex - result.avoidedCapex).toBe(2_000_000);
    expect(result.steadyBenefit).toBe(80_000);
    expect(result.monthlyOpex).toBe(15_000);
    expect(result.steadyNet).toBe(65_000);
    expect(result.annualSteadyNet).toBe(780_000);
    expect(result.roi).toBeCloseTo(0.39, 10);
    expect(result.payback).toBeCloseTo(30.769230769, 6);
    expect(result.payback).toBeCloseTo(2_000_000 / 65_000, 6);
    expect(result.firstPositiveMonth).toBe(31);
    expect(matchesIllustrativeExample(result)).toBe(true);
  });

  it('mantém o fluxo mensal constante por 60 meses', () => {
    expect(result.cashFlows).toHaveLength(61);
    expect(result.cashFlows[0]).toBe(-2_000_000);
    expect(result.cashFlows.slice(1).every((value) => value === 65_000)).toBe(true);
    expect(simplePayback(result.cashFlows)).toBeCloseTo(result.payback as number, 8);
  });

  it('calcula VPL e TIR sobre o fluxo incremental', () => {
    const monthly = Math.pow(1.12, 1 / 12) - 1;
    expect(result.npv).toBeCloseTo(npv(monthly, result.cashFlows), 2);
    expect(result.npv).toBeGreaterThan(0);
    expect(result.irrMonthly).not.toBeNull();
    expect(npv(result.irrMonthly as number, result.cashFlows)).toBeCloseTo(0, 2);
    expect(result.irrAnnual).toBeGreaterThan(0.2);
    expect(result.discountedPayback).not.toBeNull();
    expect(result.discountedPayback as number).toBeGreaterThan(result.payback as number);
    expect(result.firstPositiveDiscountedMonth).toBeGreaterThan(31);
  });

  it('reconcilia custos sem robô e com robô', () => {
    const month = result.months[0];
    expect(month.costWithout).toBe(88_000);
    expect(month.costWith).toBe(23_000);
    expect(month.costWithout - month.costWith + month.salesMargin).toBe(month.netOperating);
    expect(month.netOperating).toBe(65_000);
  });

  it('soma das linhas recorrentes incluídas é o benefício bruto', () => {
    const total = result.audit
      .filter((line) => line.includedInCashFlow && line.kind === 'recorrente')
      .reduce((sum, line) => sum + line.monthlyValue, 0);
    expect(total).toBe(result.steadyBenefit);
  });
});

describe('regras anti-dupla-contagem', () => {
  it('não soma treinamento que já está no custo de substituição', () => {
    const blocked = evaluate(cloneExample());
    const training = blocked.audit.find((line) => line.id === 'training');
    expect(training?.includedInCashFlow).toBe(false);
    expect(training?.reason).toMatch(/não entra de novo/i);

    const inputs = cloneExample();
    inputs.people.training.includedInReplacementCost = false;
    const opened = evaluate(inputs);
    expect(opened.months[0].incremental).toBe(65_000 + 6 * 2_500);
    expect(opened.months[1].incremental).toBe(65_000);
    expect(opened.steadyNet).toBe(65_000);
  });

  it('não soma recrutamento que já está no turnover', () => {
    const line = evaluate(cloneExample()).audit.find((item) => item.id === 'recruitment');
    expect(line?.includedInCashFlow).toBe(false);
    const inputs = cloneExample();
    inputs.people.recruitment.includedInTurnoverCost = false;
    const opened = evaluate(inputs);
    expect(opened.months[0].incremental).toBe(65_000 + 6 * 3_500);
    expect(opened.steadyNet).toBe(65_000);
  });

  it('não monetiza venda consultiva sem evidência independente', () => {
    const line = evaluate(cloneExample()).audit.find((item) => item.id === 'consultative');
    expect(line?.includedInCashFlow).toBe(false);
    expect(evaluate(cloneExample()).steadyNet).toBe(65_000);

    const inputs = cloneExample();
    inputs.people.consultativeSales.independentEvidence = true;
    inputs.people.consultativeSales.confidence = 'comprovavel';
    expect(evaluate(inputs).steadyNet).toBe(65_000 + 20 * 80);
  });

  it('mantém só a maior alavanca de venda até haver confirmação de independência', () => {
    const inputs = cloneExample();
    inputs.people.consultativeSales.enabled = false;
    inputs.stock.ruptures.enabled = true;
    inputs.stock.ruptures.confidence = 'comprovavel';
    inputs.stock.ruptures.independentEvidence = true;
    inputs.stock.ruptures.additionalMonthlySales = 20_000;
    inputs.stock.serviceSpeed.enabled = true;
    inputs.stock.serviceSpeed.confidence = 'comprovavel';
    inputs.stock.serviceSpeed.independentEvidence = true;
    inputs.stock.serviceSpeed.additionalMonthlySales = 10_000;

    const blocked = evaluate(inputs);
    expect(includedMonthly(inputs, 'ruptures')).toBeCloseTo(20_000 * 0.32, 2);
    expect(blocked.audit.find((line) => line.id === 'service')?.includedInCashFlow).toBe(false);
    expect(blocked.steadyNet).toBeCloseTo(65_000 + 6_400, 2);

    inputs.stock.salesIndependenceConfirmed = true;
    expect(evaluate(inputs).steadyNet).toBeCloseTo(65_000 + 6_400 + 3_200, 2);
  });

  it('deixa caixas de fora até o processo logístico ser validado', () => {
    const blocked = evaluate(cloneExample()).audit.find((line) => line.id === 'boxes');
    expect(blocked?.includedInCashFlow).toBe(false);
    expect(blocked?.reason).toMatch(/não validado/i);

    const inputs = cloneExample();
    inputs.logistics.boxes.processValidated = true;
    inputs.logistics.boxes.confidence = 'comprovavel';
    expect(evaluate(inputs).steadyNet).toBe(65_000 + 400 * 8);
  });

  it('não soma ocupação e margem da mesma área', () => {
    const base = evaluate(cloneExample());
    expect(base.audit.find((line) => line.id === 'spaceOccupancy')?.includedInCashFlow).toBe(true);
    expect(base.audit.find((line) => line.id === 'spaceMargin')?.includedInCashFlow).toBe(false);

    const inputs = cloneExample();
    inputs.logistics.space.mode = 'margem';
    const switched = evaluate(inputs);
    expect(switched.audit.find((line) => line.id === 'spaceOccupancy')?.includedInCashFlow).toBe(false);
    expect(switched.audit.find((line) => line.id === 'spaceMargin')?.includedInCashFlow).toBe(true);
    expect(switched.steadyNet).toBe(65_000 - 4_000 + 20 * 150);
  });

  it('não coloca liberação de capital e custo financeiro no mesmo fluxo', () => {
    const inputs = cloneExample();
    inputs.stock.workingCapital.enabled = true;
    inputs.stock.workingCapital.treatment = 'liberacao_caixa';
    const release = evaluate(inputs);
    expect(release.months[2].workingCapital).toBe(130_000);
    expect(release.months[2].incremental).toBe(65_000 + 130_000);
    expect(release.steadyNet).toBe(65_000);
    expect(release.audit.find((line) => line.id === 'financialCost')?.includedInCashFlow).toBe(false);
    expect(release.informational.financialCostAvoidedAnnual).toBeCloseTo(130_000 * 0.12, 2);
    expect(release.informational.financialCostIncluded).toBe(false);

    inputs.stock.workingCapital.treatment = 'custo_financeiro';
    const interest = evaluate(inputs);
    expect(interest.months.every((month) => month.workingCapital === 0)).toBe(true);
    expect(interest.steadyNet).toBe(65_000 + 1_300);
    expect(interest.audit.find((line) => line.id === 'workingCapital')?.includedInCashFlow).toBe(false);
  });

  it('não antecipa contratação futura para o mês 1', () => {
    const inputs = cloneExample();
    inputs.people.futureHires.enabled = true;
    const result = evaluate(inputs);
    expect(result.months[11].netOperating).toBe(65_000);
    expect(result.months[12].netOperating).toBe(65_000 + 9_200 + 200);
  });

  it('aplica rescisão só em loja existente e CAPEX evitado só em loja nova', () => {
    const fresh = evaluate(cloneExample());
    expect(fresh.avoidedCapex).toBe(180_000);
    expect(fresh.months[0].severance).toBe(0);
    expect(fresh.audit.find((line) => line.id === 'shelvingMaintenance')?.includedInCashFlow).toBe(false);

    const inputs = cloneExample();
    inputs.logistics.shelving.enabled = false;
    inputs.people.payroll.severanceCost = 18_000;
    inputs.profile.storeType = 'existente';
    const existing = evaluate(inputs);
    expect(existing.netInvestment).toBe(2_180_000);
    expect(existing.months[0].incremental).toBe(65_000 - 18_000);
    expect(existing.months[1].incremental).toBe(65_000);

    inputs.profile.storeType = 'nova';
    const opened = evaluate(inputs);
    expect(opened.months[0].incremental).toBe(65_000);
    expect(opened.netInvestment).toBe(2_180_000);
  });

  it('em loja existente troca CAPEX evitado por revenda e manutenção', () => {
    const inputs = cloneExample();
    inputs.profile.storeType = 'existente';
    inputs.people.payroll.severanceCost = 0;
    const result = evaluate(inputs);
    expect(result.netInvestment).toBe(2_180_000);
    expect(result.steadyNet).toBe(65_000 + 1_500);
    expect(result.months[0].resale).toBe(25_000);
    expect(result.months[0].incremental).toBe(65_000 + 1_500 + 25_000);
  });
});

describe('imposto, financiamento e sensibilidade', () => {
  it('reconhece o escudo da depreciação sem tratar depreciação como caixa', () => {
    const inputs = cloneExample();
    inputs.robot.includeTax = true;
    inputs.robot.taxRate = 0.34;
    inputs.robot.depreciationYears = 10;
    const result = evaluate(inputs);
    const depreciation = 2_000_000 / 120;
    const tax = Math.round((65_000 - depreciation) * 0.34 * 100) / 100;
    expect(result.steadyNet).toBeCloseTo(65_000 - tax, 2);
    expect(result.months[0].opex).toBe(15_000);
  });

  it('mantém o VPL econômico fora do fluxo da dívida', () => {
    const baseline = evaluate(cloneExample());
    const inputs = cloneExample();
    inputs.robot.financing.enabled = true;
    const financed = evaluate(inputs);
    expect(financed.npv).toBe(baseline.npv);
    expect(financed.payback).toBe(baseline.payback);
    expect(financed.financing?.financedAmount).toBe(1_400_000);
    expect(financed.financing?.monthlyPayment).toBeGreaterThan(0);
  });

  it('alonga o payback quando o investimento sobe 30%', () => {
    const point = sensitivity(cloneExample(), 'base').investimento.find((item) => item.delta === 0.3);
    expect(point?.payback).toBeCloseTo(40, 6);
    expect(point?.steadyNet).toBe(65_000);
  });

  it('não altera o caso base no ponto zero da sensibilidade', () => {
    const table = sensitivity(cloneExample(), 'base');
    for (const points of Object.values(table)) {
      const center = points.find((point) => point.delta === 0);
      expect(center?.steadyNet).toBe(65_000);
      expect(center?.payback).toBeCloseTo(2_000_000 / 65_000, 6);
    }
  });

  it('reduz mão de obra, turnover e horas sem mexer em perdas', () => {
    const point = sensitivity(cloneExample(), 'base').maoDeObra.find((item) => item.delta === -0.3);
    expect(point?.steadyNet).toBeCloseTo(46_700, 2);
  });
});
