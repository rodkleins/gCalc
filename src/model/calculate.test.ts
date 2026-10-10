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
    expect(result.netInvestment).toBe(600_000);
    expect(result.grossCapex - result.avoidedCapex).toBe(600_000);
    expect(result.steadyBenefit).toBe(25_500);
    expect(result.monthlyOpex).toBe(3_300);
    expect(result.steadyNet).toBe(22_200);
    expect(result.annualSteadyNet).toBe(266_400);
    expect(result.roi).toBeCloseTo(266_400 / 600_000, 10);
    expect(result.payback).toBeCloseTo(27.027027027, 6);
    expect(result.payback).toBeCloseTo(600_000 / 22_200, 6);
    expect(result.firstPositiveMonth).toBe(28);
    expect(result.payback).toBeLessThanOrEqual(30);
    expect(result.roi).toBeGreaterThan(0);
    expect(result.npv).toBeGreaterThan(0);
    expect(result.audit.find((line) => line.id === 'shrinkage')?.includedInCashFlow).toBe(false);
    expect(matchesIllustrativeExample(result)).toBe(true);
  });

  it('recupera o investimento em menos de 40 meses no conservador', () => {
    const conservative = evaluate(cloneExample(), { scenario: 'conservador' });
    expect(conservative.payback).not.toBeNull();
    expect(conservative.payback as number).toBeLessThan(40);
    expect(conservative.npv).toBeGreaterThan(0);
  });

  it('mantém o fluxo mensal constante por 60 meses', () => {
    expect(result.cashFlows).toHaveLength(61);
    expect(result.cashFlows[0]).toBe(-600_000);
    expect(result.cashFlows.slice(1).every((value) => value === 22_200)).toBe(true);
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
    expect(result.firstPositiveDiscountedMonth).toBeGreaterThan(28);
  });

  it('reconcilia custos sem robô e com robô', () => {
    const month = result.months[0];
    expect(month.costWithout).toBe(30_500);
    expect(month.costWith).toBe(8_300);
    expect(month.costWithout - month.costWith + month.salesMargin).toBe(month.netOperating);
    expect(month.netOperating).toBe(22_200);
  });

  it('soma das linhas recorrentes incluídas é o benefício bruto', () => {
    const total = result.audit
      .filter((line) => line.includedInCashFlow && line.kind === 'recorrente')
      .reduce((sum, line) => sum + line.monthlyValue, 0);
    expect(total).toBe(result.steadyBenefit);
  });
});

describe('investimento zero', () => {
  it('mantém VPL finito, TIR indefinida e payback imediato', () => {
    const inputs = cloneExample();
    inputs.profile.storeType = 'existente';
    for (const key of Object.keys(inputs.robot.capex) as Array<keyof Inputs['robot']['capex']>) {
      inputs.robot.capex[key] = 0;
    }
    const result = evaluate(inputs);
    expect(result.netInvestment).toBe(0);
    expect(result.grossCapex).toBe(0);
    expect(result.payback).toBe(0);
    expect(result.discountedPayback).toBe(0);
    expect(result.irrAnnual).toBeNull();
    expect(result.irrMonthly).toBeNull();
    expect(result.roi).toBeNull();
    expect(Number.isFinite(result.npv)).toBe(true);
    expect(result.cashFlows[0]).toBe(0);
    expect(result.months.every((month) => Number.isFinite(month.incremental) && Number.isFinite(month.cumulative))).toBe(
      true,
    );
  });

  it('não quebra quando o CAPEX do robô zera e a prateleira evitada permanece', () => {
    const inputs = cloneExample();
    for (const key of Object.keys(inputs.robot.capex) as Array<keyof Inputs['robot']['capex']>) {
      inputs.robot.capex[key] = 0;
    }
    const result = evaluate(inputs);
    expect(result.grossCapex).toBe(0);
    expect(result.netInvestment).toBe(-40_000);
    expect(result.payback).toBe(0);
    expect(result.irrAnnual).toBeNull();
    expect(result.roi).toBeNull();
    expect(Number.isFinite(result.npv)).toBe(true);
    expect(result.warnings.some((warning) => /negativo/i.test(warning))).toBe(true);
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
    expect(opened.months[0].incremental).toBe(22_200 + 3 * 6_000);
    expect(opened.months[1].incremental).toBe(22_200);
    expect(opened.steadyNet).toBe(22_200);
  });

  it('não soma recrutamento que já está no turnover', () => {
    const line = evaluate(cloneExample()).audit.find((item) => item.id === 'recruitment');
    expect(line?.includedInCashFlow).toBe(false);
    const inputs = cloneExample();
    inputs.people.recruitment.includedInTurnoverCost = false;
    const opened = evaluate(inputs);
    expect(opened.months[0].incremental).toBe(22_200 + 3 * 3_500);
    expect(opened.steadyNet).toBe(22_200);
  });

  it('não monetiza venda consultiva sem evidência independente', () => {
    const line = evaluate(cloneExample()).audit.find((item) => item.id === 'consultative');
    expect(line?.includedInCashFlow).toBe(false);
    expect(evaluate(cloneExample()).steadyNet).toBe(22_200);

    const inputs = cloneExample();
    inputs.people.consultativeSales.independentEvidence = true;
    inputs.people.consultativeSales.confidence = 'comprovavel';
    expect(evaluate(inputs).steadyNet).toBe(22_200 + 20 * 80);
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
    expect(blocked.steadyNet).toBeCloseTo(22_200 + 6_400, 2);

    inputs.stock.salesIndependenceConfirmed = true;
    expect(evaluate(inputs).steadyNet).toBeCloseTo(22_200 + 6_400 + 3_200, 2);
  });

  it('deixa caixas de fora até o processo logístico ser validado', () => {
    const blocked = evaluate(cloneExample()).audit.find((line) => line.id === 'boxes');
    expect(blocked?.includedInCashFlow).toBe(false);
    expect(blocked?.reason).toMatch(/não validado/i);

    const inputs = cloneExample();
    inputs.logistics.boxes.processValidated = true;
    inputs.logistics.boxes.confidence = 'comprovavel';
    expect(evaluate(inputs).steadyNet).toBe(22_200 + 400 * 8);
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
    expect(switched.steadyNet).toBe(22_200 - 3_200 + 16 * 150);
  });

  it('não coloca liberação de capital e custo financeiro no mesmo fluxo', () => {
    const inputs = cloneExample();
    inputs.stock.workingCapital.enabled = true;
    inputs.stock.workingCapital.reductionProven = true;
    inputs.stock.workingCapital.inventoryAfter = 350_000;
    inputs.stock.workingCapital.treatment = 'liberacao_caixa';
    const release = evaluate(inputs);
    expect(release.months[2].workingCapital).toBe(130_000);
    expect(release.months[2].incremental).toBe(22_200 + 130_000);
    expect(release.steadyNet).toBe(22_200);
    expect(release.audit.find((line) => line.id === 'financialCost')?.includedInCashFlow).toBe(false);
    expect(release.informational.financialCostAvoidedAnnual).toBeCloseTo(130_000 * 0.12, 2);
    expect(release.informational.financialCostIncluded).toBe(false);

    inputs.stock.workingCapital.treatment = 'custo_financeiro';
    const interest = evaluate(inputs);
    expect(interest.months.every((month) => month.workingCapital === 0)).toBe(true);
    expect(interest.steadyNet).toBe(22_200 + 1_300);
    expect(interest.audit.find((line) => line.id === 'workingCapital')?.includedInCashFlow).toBe(false);
  });

  it('não antecipa contratação futura para o mês 1', () => {
    const inputs = cloneExample();
    inputs.profile.storeType = 'existente';
    inputs.people.futureHires.enabled = true;
    const result = evaluate(inputs);
    expect(result.months[11].netOperating).toBe(22_600);
    expect(result.months[12].netOperating).toBe(22_600 + 4_200 + 200);
  });

  it('aplica rescisão só em loja existente e CAPEX evitado só em loja nova', () => {
    const fresh = evaluate(cloneExample());
    expect(fresh.avoidedCapex).toBe(40_000);
    expect(fresh.months[0].severance).toBe(0);
    expect(fresh.audit.find((line) => line.id === 'shelvingMaintenance')?.includedInCashFlow).toBe(false);

    const inputs = cloneExample();
    inputs.logistics.shelving.enabled = false;
    inputs.people.payroll.severanceCost = 18_000;
    inputs.profile.storeType = 'existente';
    const existing = evaluate(inputs);
    expect(existing.netInvestment).toBe(640_000);
    expect(existing.months[0].incremental).toBe(22_200 - 18_000);
    expect(existing.months[1].incremental).toBe(22_200);

    inputs.profile.storeType = 'nova';
    const opened = evaluate(inputs);
    expect(opened.months[0].incremental).toBe(22_200);
    expect(opened.netInvestment).toBe(640_000);
  });

  it('em loja existente troca CAPEX evitado por revenda e manutenção', () => {
    const inputs = cloneExample();
    inputs.profile.storeType = 'existente';
    inputs.people.payroll.severanceCost = 0;
    const result = evaluate(inputs);
    expect(result.netInvestment).toBe(640_000);
    expect(result.steadyNet).toBe(22_200 + 400);
    expect(result.months[0].resale).toBe(8_000);
    expect(result.months[0].incremental).toBe(22_200 + 400 + 8_000);
  });
});

describe('imposto, financiamento e sensibilidade', () => {
  it('reconhece o escudo da depreciação sem tratar depreciação como caixa', () => {
    const inputs = cloneExample();
    inputs.robot.includeTax = true;
    inputs.robot.taxRate = 0.34;
    inputs.robot.depreciationYears = 10;
    const result = evaluate(inputs);
    const depreciation = 600_000 / 120;
    const tax = Math.round((22_200 - depreciation) * 0.34 * 100) / 100;
    expect(result.steadyNet).toBeCloseTo(22_200 - tax, 2);
    expect(result.months[0].opex).toBe(3_300);
  });

  it('mantém o VPL econômico fora do fluxo da dívida', () => {
    const baseline = evaluate(cloneExample());
    const inputs = cloneExample();
    inputs.robot.financing.enabled = true;
    const financed = evaluate(inputs);
    expect(financed.npv).toBe(baseline.npv);
    expect(financed.payback).toBe(baseline.payback);
    expect(financed.financing?.financedAmount).toBe(420_000);
    expect(financed.financing?.monthlyPayment).toBeGreaterThan(0);
  });

  it('alonga o payback quando o investimento sobe 30%', () => {
    const point = sensitivity(cloneExample(), 'base').investimento.find((item) => item.delta === 0.3);
    expect(point?.payback).toBeCloseTo(1.3 * 600_000 / 22_200, 6);
    expect(point?.steadyNet).toBe(22_200);
  });

  it('não altera o caso base no ponto zero da sensibilidade', () => {
    const table = sensitivity(cloneExample(), 'base');
    for (const points of Object.values(table)) {
      const center = points.find((point) => point.delta === 0);
      expect(center?.steadyNet).toBe(22_200);
      expect(center?.payback).toBeCloseTo(600_000 / 22_200, 6);
    }
  });

  it('reduz mão de obra, turnover e horas sem mexer em perdas', () => {
    const point = sensitivity(cloneExample(), 'base').maoDeObra.find((item) => item.delta === -0.3);
    expect(point?.steadyNet).toBeCloseTo(17_610, 2);
  });
});
