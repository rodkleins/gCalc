import { describe, expect, it } from 'vitest';
import { npv } from '../model/finance';
import { blankLine, evaluateHeadToHead, exampleDraft } from './model';

describe('comparação head-to-head', () => {
  it('fecha a DRE fictícia de uma loja de R$ 1 milhão', () => {
    const view = evaluateHeadToHead(exampleDraft());
    expect(view.margin.today).toBe(280_000);
    expect(view.margin.withRobot).toBe(280_000);
    expect(view.result.today).toBe(107_900);
    expect(view.result.withRobot).toBe(143_300);
    expect(view.result.delta).toBe(35_400);
    expect(view.monthlyDelta).toBe(35_400);
    expect(view.annualDelta).toBe(424_800);
  });

  it('mostra a diferença por linha de pessoal sem misturar indicador de produtividade', () => {
    const draft = exampleDraft();
    const before = evaluateHeadToHead(draft);
    const balcao = draft.staff.find((line) => line.id === 'balcao');
    expect(balcao?.todayHeadcount).toBe(8);
    expect(balcao && balcao.todayHeadcount * balcao.monthlyCostPerPerson).toBe(33_600);
    balcao!.todayHeadcount = 9;
    draft.indicators[0].today = 10;
    const after = evaluateHeadToHead(draft);
    expect(before.result.today - after.result.today).toBe(4_200);
    expect(after.result.delta - before.result.delta).toBe(4_200);
  });

  it('aceita uma linha criada pela rede', () => {
    const draft = exampleDraft();
    draft.lines.push({ ...blankLine('extra-1'), label: 'Taxa da bandeira', today: 1_000, withRobot: 0 });
    const view = evaluateHeadToHead(draft);
    expect(view.result.today).toBe(106_900);
    expect(view.result.withRobot).toBe(143_300);
    expect(view.result.delta).toBe(36_400);
  });

  it('reusa payback, ROI, VPL e TIR no fluxo de 60 meses', () => {
    const view = evaluateHeadToHead(exampleDraft());
    expect(view.cashFlows).toHaveLength(61);
    expect(view.cashFlows[0]).toBe(-2_000_000);
    expect(view.cashFlows.slice(1).every((value) => value === 35_400)).toBe(true);
    expect(view.payback).toBeCloseTo(2_000_000 / 35_400, 6);
    expect(view.payback as number).toBeLessThan(60);
    expect(view.roi).toBeCloseTo((35_400 * 12) / 2_000_000, 8);
    expect(view.discountedPayback).toBeNull();
    expect(view.npv).toBeCloseTo(npv(Math.pow(1.12, 1 / 12) - 1, view.cashFlows), 2);
    expect(view.npv).toBeLessThan(0);
    expect(view.irrMonthly).not.toBeNull();
    expect(npv(view.irrMonthly as number, view.cashFlows)).toBeCloseTo(0, 2);
    expect(view.irrAnnual).toBeGreaterThan(0);
    expect(view.irrAnnual as number).toBeLessThan(0.12);
  });

  it('trata investimento zero sem quebrar VPL, TIR e payback', () => {
    const draft = exampleDraft();
    draft.investment = 0;
    const view = evaluateHeadToHead(draft);
    expect(view.cashFlows[0]).toBe(0);
    expect(view.payback).toBe(0);
    expect(view.roi).toBeNull();
    expect(view.irrAnnual).toBeNull();
    expect(Number.isFinite(view.npv)).toBe(true);
    expect(view.npv).toBeGreaterThan(0);
  });
});
