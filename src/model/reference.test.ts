import { describe, expect, it } from 'vitest';
import { evaluate, sensitivity } from './calculate';
import { blankInputs } from './example';
import { withLeverValue } from './premises';
import type { Inputs } from './types';

function bare(): Inputs {
  const inputs = blankInputs();
  inputs.fictional = true;
  inputs.robot.discountRateAnnual = 0;
  inputs.robot.availabilityPct = 1;
  inputs.robot.capacityDispensationsPerDay = 1_000;
  inputs.robot.reorganizationEffectiveness = 1;
  inputs.robot.automatedStockShare = 1;
  inputs.profile.dispensationsPerDay = 100;
  inputs.profile.contributionMarginPct = 0.5;
  inputs.profile.roles = [];
  return inputs;
}

describe('casos de referência independentes do exemplo', () => {
  it('investimento zero mantém VPL finito e TIR indefinida', () => {
    const inputs = bare();
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 1;
    inputs.people.payroll.monthlyCostPerPosition = 1_000;
    const result = evaluate(inputs);
    expect(result.netInvestment).toBe(0);
    expect(result.steadyNet).toBe(1_000);
    expect(result.payback).toBe(0);
    expect(result.irrAnnual).toBeNull();
    expect(result.roi).toBeNull();
    expect(result.indicators.cumulativeRoi).toBeNull();
    expect(Number.isFinite(result.npv)).toBe(true);
  });

  it('investimento negativo não vira retorno percentual', () => {
    const inputs = bare();
    inputs.profile.storeType = 'nova';
    inputs.logistics.shelving.enabled = true;
    inputs.logistics.shelving.avoidedAcquisition = 5_000;
    const result = evaluate(inputs);
    expect(result.netInvestment).toBe(-5_000);
    expect(result.cashFlows[0]).toBe(5_000);
    expect(result.roi).toBeNull();
    expect(result.payback).toBe(0);
  });

  it('benefício operacional negativo não recupera o investimento', () => {
    const inputs = bare();
    inputs.robot.capex.equipment = 60_000;
    inputs.robot.opexMonthly.maintenance = 2_000;
    const result = evaluate(inputs);
    expect(result.steadyNet).toBe(-2_000);
    expect(result.payback).toBeNull();
    expect(result.npv).toBeLessThan(0);
  });

  it('payback além de 60 meses fica indefinido', () => {
    const inputs = bare();
    inputs.robot.capex.equipment = 120_000;
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 1;
    inputs.people.payroll.monthlyCostPerPosition = 1_000;
    const result = evaluate(inputs);
    expect(result.steadyNet).toBe(1_000);
    expect(result.payback).toBeNull();
    expect(60 * 1_000).toBeLessThan(120_000);
  });

  it('turnover zero não cria economia de substituição', () => {
    const inputs = bare();
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 2;
    inputs.people.payroll.monthlyCostPerPosition = 1_000;
    inputs.people.turnover.enabled = true;
    inputs.people.turnover.annualRate = 0;
    inputs.people.turnover.costPerReplacement = 12_000;
    const result = evaluate(inputs);
    expect(result.audit.find((line) => line.id === 'turnover')?.monthlyValue).toBe(0);
    expect(result.steadyNet).toBe(2_000);
  });

  it('turnover elevado usa posições expostas vezes custo, sem somar o consolidado e o detalhe', () => {
    const inputs = bare();
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 1;
    inputs.people.payroll.monthlyCostPerPosition = 0;
    inputs.people.turnover.enabled = true;
    inputs.people.turnover.annualRate = 1;
    inputs.people.turnover.costPerReplacement = 12_000;
    inputs.people.turnover.costMode = 'consolidado';
    inputs.people.turnover.components.recruitment = 9_999;
    const consolidated = evaluate(inputs);
    expect(consolidated.steadyNet).toBe(1_000);

    inputs.people.recruitment.enabled = true;
    inputs.people.recruitment.costPerHire = 6_000;
    inputs.people.turnover.costMode = 'detalhado';
    inputs.people.turnover.components = {
      recruitment: 6_000,
      replacementTraining: 3_000,
      adaptationLoss: 1_200,
      termination: 1_200,
      supervision: 600,
    };
    const detailed = evaluate(inputs);
    expect(detailed.steadyNet).toBe(1_000);
    expect(detailed.audit.find((line) => line.id === 'recruitment')?.includedInCashFlow).toBe(false);
  });

  it('nenhuma vaga eliminada zera a folha', () => {
    const inputs = bare();
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 0;
    inputs.people.payroll.monthlyCostPerPosition = 8_000;
    expect(evaluate(inputs).steadyNet).toBe(0);
  });

  it('contratação futura começa no mês previsto', () => {
    const inputs = bare();
    inputs.people.futureHires.enabled = true;
    inputs.people.futureHires.hires = [{ id: 'h', role: 'Auxiliar', month: 6, headcount: 1, monthlyCost: 3_000 }];
    const result = evaluate(inputs);
    expect(result.months[4].netOperating).toBe(0);
    expect(result.months[5].netOperating).toBe(3_000);
  });

  it('treinamento e recrutamento já inclusos não entram de novo', () => {
    const inputs = bare();
    inputs.profile.storeType = 'nova';
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 2;
    inputs.people.payroll.monthlyCostPerPosition = 100;
    inputs.people.training.enabled = true;
    inputs.people.training.includedInReplacementCost = true;
    inputs.people.training.costPerPerson = 500;
    inputs.people.recruitment.enabled = true;
    inputs.people.recruitment.includedInTurnoverCost = true;
    inputs.people.recruitment.costPerHire = 700;
    const blocked = evaluate(inputs);
    expect(blocked.months[0].incremental).toBe(200);
    inputs.people.training.includedInReplacementCost = false;
    inputs.people.recruitment.includedInTurnoverCost = false;
    const opened = evaluate(inputs);
    expect(opened.months[0].incremental).toBe(200 + 2 * 500 + 2 * 700);
  });

  it('horas realocadas sem monetização não reduzem folha', () => {
    const inputs = bare();
    inputs.people.reallocatedHours.enabled = true;
    inputs.people.reallocatedHours.hoursPerMonth = 80;
    inputs.people.reallocatedHours.monetization = 'nenhuma';
    inputs.people.reallocatedHours.costReductionMonthly = 5_000;
    const idle = evaluate(inputs);
    expect(idle.steadyNet).toBe(0);
    expect(idle.audit.find((line) => line.id === 'reallocated')?.includedInCashFlow).toBe(false);

    inputs.people.reallocatedHours.monetization = 'reducao_custo';
    inputs.people.reallocatedHours.confidence = 'comprovavel';
    expect(evaluate(inputs).steadyNet).toBe(5_000);
  });

  it('disponibilidade zero zera a operação e capacidade insuficiente não corta a folha pela metade', () => {
    const inputs = bare();
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 1;
    inputs.people.payroll.monthlyCostPerPosition = 1_000;
    inputs.robot.availabilityPct = 0;
    expect(evaluate(inputs).steadyNet).toBe(0);

    inputs.robot.availabilityPct = 1;
    inputs.profile.dispensationsPerDay = 1_000;
    inputs.robot.capacityDispensationsPerDay = 500;
    inputs.stock.ruptures.enabled = true;
    inputs.stock.ruptures.confidence = 'comprovavel';
    inputs.stock.ruptures.independentEvidence = true;
    inputs.stock.ruptures.additionalMonthlySales = 10_000;
    const tight = evaluate(inputs);
    expect(tight.audit.find((line) => line.id === 'payroll')?.monthlyValue).toBe(1_000);
    expect(tight.audit.find((line) => line.id === 'ruptures')?.monthlyValue).toBe(2_500);
    expect(tight.steadyNet).toBe(3_500);
  });

  it('go-live atrasado e rampa mudam o mês em que o benefício aparece', () => {
    const inputs = bare();
    inputs.robot.capex.equipment = 12_000;
    inputs.robot.goLiveMonth = 4;
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 1;
    inputs.people.payroll.monthlyCostPerPosition = 1_000;
    const late = evaluate(inputs);
    expect(late.months[0].incremental).toBe(0);
    expect(late.months[2].incremental).toBe(0);
    expect(late.months[3].incremental).toBe(1_000);

    inputs.robot.goLiveMonth = 1;
    inputs.robot.ramp.people = [0.5, 1];
    const ramp = evaluate(inputs);
    expect(ramp.months[0].netOperating).toBe(500);
    expect(ramp.months[1].netOperating).toBe(1_000);
  });

  it('capital de giro liberado volta no fim e não soma o custo financeiro', () => {
    const inputs = bare();
    inputs.robot.capex.equipment = 1_000;
    inputs.profile.averageInventory = 10_000;
    inputs.stock.workingCapital.enabled = true;
    inputs.stock.workingCapital.reductionProven = true;
    inputs.stock.workingCapital.inventoryAfter = 4_000;
    inputs.stock.workingCapital.releaseMonth = 2;
    inputs.stock.workingCapital.reverseAtHorizon = true;
    inputs.stock.workingCapital.treatment = 'liberacao_caixa';
    const result = evaluate(inputs);
    expect(result.months[1].workingCapital).toBe(6_000);
    expect(result.months[59].workingCapital).toBe(-6_000);
    expect(result.audit.find((line) => line.id === 'financialCost')?.includedInCashFlow).toBe(false);
    expect(result.indicators.irrAmbiguous).toBe(true);
  });

  it('prejuízo tributável sem crédito imediato não aumenta o caixa', () => {
    const inputs = bare();
    inputs.robot.capex.equipment = 120_000;
    inputs.robot.opexMonthly.maintenance = 10_000;
    inputs.robot.includeTax = true;
    inputs.robot.taxPolicy = 'prejuizo_com_limite';
    inputs.robot.taxRate = 0.34;
    inputs.robot.lossUtilizationLimit = 0;
    inputs.robot.depreciationYears = 10;
    const result = evaluate(inputs);
    expect(result.months[0].tax).toBe(0);
    expect(result.months[0].accountingResult).toBe(-10_000);
    expect(result.steadyNet).toBe(-10_000);
  });

  it('loja nova abate prateleira e loja existente cobra rescisão', () => {
    const inputs = bare();
    inputs.robot.capex.equipment = 10_000;
    inputs.logistics.shelving.enabled = true;
    inputs.logistics.shelving.avoidedAcquisition = 1_000;
    inputs.logistics.shelving.resaleValue = 400;
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 1;
    inputs.people.payroll.monthlyCostPerPosition = 100;
    inputs.people.payroll.severanceCost = 250;
    inputs.profile.storeType = 'nova';
    const fresh = evaluate(inputs);
    expect(fresh.netInvestment).toBe(9_000);
    expect(fresh.months[0].severance).toBe(0);
    inputs.profile.storeType = 'existente';
    const current = evaluate(inputs);
    expect(current.netInvestment).toBe(10_000);
    expect(current.months[0].incremental).toBe(100 - 250 + 400);
  });

  it('financiamento não muda o VPL do projeto, com ou sem juros', () => {
    const inputs = bare();
    inputs.robot.capex.equipment = 12_000;
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 1;
    inputs.people.payroll.monthlyCostPerPosition = 1_000;
    inputs.robot.discountRateAnnual = 0.12;
    const project = evaluate(inputs);
    inputs.robot.financing.enabled = true;
    inputs.robot.financing.annualInterest = 0;
    inputs.robot.financing.downPaymentPct = 0.25;
    inputs.robot.financing.termMonths = 12;
    inputs.robot.financing.balloon = 0;
    const cash = evaluate(inputs);
    expect(cash.npv).toBe(project.npv);
    expect(cash.financing?.financedAmount).toBe(9_000);
    expect(cash.financing?.monthlyPayment).toBe(750);
    expect(cash.financing?.equityCashFlows[0]).toBe(-3_000);
    inputs.robot.financing.annualInterest = 0.12;
    const interest = evaluate(inputs);
    expect(interest.npv).toBe(project.npv);
    expect(interest.financing?.monthlyPayment).toBeGreaterThan(750);
    expect(interest.financing?.totalFinancialCost).toBeGreaterThan(0);
  });

  it('vendas sobrepostas ficam só com a maior até haver independência', () => {
    const inputs = bare();
    inputs.stock.ruptures.enabled = true;
    inputs.stock.ruptures.confidence = 'comprovavel';
    inputs.stock.ruptures.independentEvidence = true;
    inputs.stock.ruptures.additionalMonthlySales = 10_000;
    inputs.stock.serviceSpeed.enabled = true;
    inputs.stock.serviceSpeed.confidence = 'comprovavel';
    inputs.stock.serviceSpeed.independentEvidence = true;
    inputs.stock.serviceSpeed.additionalMonthlySales = 2_000;
    const blocked = evaluate(inputs);
    expect(blocked.steadyNet).toBe(5_000);
    expect(blocked.audit.find((line) => line.id === 'service')?.includedInCashFlow).toBe(false);
    inputs.stock.salesIndependenceConfirmed = true;
    expect(evaluate(inputs).steadyNet).toBe(6_000);
  });

  it('caixa retornável sem processo validado fica fora', () => {
    const inputs = bare();
    inputs.logistics.boxes.enabled = true;
    inputs.logistics.boxes.confidence = 'comprovavel';
    inputs.logistics.boxes.processValidated = false;
    inputs.logistics.boxes.cyclesAvoidedPerMonth = 10;
    inputs.logistics.boxes.costPerCycle = 5;
    expect(evaluate(inputs).steadyNet).toBe(0);
    inputs.logistics.boxes.processValidated = true;
    expect(evaluate(inputs).steadyNet).toBe(50);
  });

  it('quinze por cento no ajuste rápido equivale à sensibilidade', () => {
    const inputs = bare();
    inputs.robot.capex.equipment = 24_000;
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 2;
    inputs.people.payroll.monthlyCostPerPosition = 1_000;
    inputs.people.supervision.enabled = true;
    inputs.people.supervision.hoursSavedPerMonth = 10;
    inputs.people.supervision.costPerHour = 20;
    const table = sensitivity(inputs, 'base').maoDeObra.find((point) => point.delta === 0.15);
    const quick = evaluate(withLeverValue(inputs, inputs, 'salarios', 1_000 * 1.15));
    expect(quick.steadyNet).toBeCloseTo(table?.steadyNet ?? 0, 2);
    expect(quick.payback).toBeCloseTo(table?.payback ?? 0, 4);
    expect(quick.npv).toBeCloseTo(table?.npv ?? 0, 2);
  });

  it('salário e OPEX acompanham o índice e a demanda não cresce sozinha sem aviso', () => {
    const inputs = bare();
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 1;
    inputs.people.payroll.monthlyCostPerPosition = 1_000;
    inputs.robot.opexMonthly.maintenance = 100;
    inputs.profile.wageGrowthPctPerYear = 0.12;
    inputs.profile.opexInflationPctPerYear = 0.12;
    inputs.profile.demandGrowthPctPerYear = 0;
    const result = evaluate(inputs);
    expect(result.months[0].netOperating).toBe(900);
    expect(result.months[12].netOperating).toBeCloseTo(1_000 * 1.12 - 100 * 1.12, 2);
  });

  it('rede escalonada guarda paybacks diferentes', () => {
    const inputs = bare();
    inputs.robot.capex.equipment = 12_000;
    inputs.people.payroll.enabled = true;
    inputs.people.payroll.positionsReduced = 1;
    inputs.people.payroll.monthlyCostPerPosition = 1_000;
    inputs.network.enabled = true;
    inputs.network.stores = [
      {
        id: 'a',
        name: 'Centro',
        storeType: 'nova',
        count: 1,
        goLiveMonth: 1,
        investmentFactor: 1,
        volumeFactor: 1,
        laborFactor: 1,
      },
      {
        id: 'b',
        name: 'Bairro',
        storeType: 'nova',
        count: 1,
        goLiveMonth: 13,
        investmentFactor: 2,
        volumeFactor: 1,
        laborFactor: 1,
      },
    ];
    const result = evaluate(inputs);
    expect(result.network.mode).toBe('escalonada');
    expect(result.network.stores[0]?.payback).toBeCloseTo(12, 4);
    expect(result.network.stores[1]?.payback).toBeCloseTo(24, 4);
    expect(result.network.stores[0]?.payback).not.toBe(result.network.stores[1]?.payback);
  });
});
