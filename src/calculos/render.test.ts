import { describe, expect, it } from 'vitest';
import { evaluate, sensitivity } from '../model/calculate';
import { exampleInputs } from '../model/example';
import { formatBRL, formatPayback } from '../model/format';
import { storePresets } from '../model/presets';
import rhConteudo from '../rh/calculos/conteudo.md?raw';
import conteudo from './conteudo.md?raw';
import { engineExamplesHtml } from './engineExamples';
import { renderMarkdown } from './render';

function plain(html: string): string {
  return html.replace(/\u00a0/g, ' ');
}

function assertClientLanguage(source: string) {
  expect(source).not.toMatch(/\/gCalc\//);
  expect(source).not.toMatch(/rodkleins\.github\.io|gcalc\.t2software\.co/);
  expect(source).not.toMatch(/src\/|\.tsx?\b|\.jsx?\b/);
  expect(source).not.toMatch(/\bevaluate\b|\bfunction\b|\bclass\b|\bimport\b/);
  expect(source).not.toMatch(/\b[a-z]{3,}[A-Z][A-Za-z0-9]*\b/);
  expect(source).not.toMatch(/\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b/);
}

describe('página de cálculos', () => {
  it('repete os números que o motor produz no exemplo', () => {
    const result = evaluate(exampleInputs());
    expect(result.netInvestment).toBe(945_000);
    expect(result.steadyNet).toBe(18_796);
    expect(result.npv).toBeCloseTo(-88_131.81, 2);
    expect(formatPayback(result.payback)).toBe('50,3 meses');
    expect(result.firstPositiveMonth).toBe(51);
    expect(formatPayback(result.discountedPayback)).toBe('Não recupera em 60 meses');
    expect(result.firstPositiveDiscountedMonth).toBeNull();
    const examples = plain(engineExamplesHtml());
    expect(examples).toContain(plain(formatBRL(result.npv, 2)));
    expect(examples).toContain(formatPayback(result.payback));
    expect(examples).toContain(formatPayback(result.discountedPayback));
    expect(examples).toContain('23,9%');
    const paybacks = sensitivity(exampleInputs(), 'base').investimento.map((point) => formatPayback(point.payback));
    expect(paybacks).toEqual(['35,2 meses', '42,7 meses', '50,3 meses', '57,8 meses', 'Não recupera em 60 meses']);
    for (const payback of paybacks) expect(examples).toContain(payback);
    const store = evaluate(storePresets()[0].inputs, { scenario: 'base' });
    expect(examples).toContain(formatPayback(store.payback));
    expect(examples).not.toMatch(/\/gCalc\/|src\/|\bevaluate\b|rodkleins\.github\.io|gcalc\.t2software\.co/);
    expect(examples).not.toMatch(/\b[a-z]{3,}[A-Z][A-Za-z0-9]*\b/);
  });

  it('monta índice, fórmulas e tabelas', () => {
    const { html, toc } = renderMarkdown(conteudo);
    expect(toc[0]?.text).toMatch(/Visão geral/);
    expect(toc.some((item) => item.level === 3 && /Perfil/.test(item.text))).toBe(true);
    expect(html).toContain('<pre><code>');
    expect(html).toContain('mês de início');
    expect(html).not.toContain('<script');
    expect((html.match(/<table>/g) ?? []).length).toBeGreaterThan(8);
    expect((html.match(/<pre>/g) ?? []).length).toBeGreaterThan(8);
  });

  it('explica a conta em linguagem de negócio, sem arquivo nem código', () => {
    assertClientLanguage(conteudo);
    assertClientLanguage(rhConteudo);
    expect(conteudo).toContain('mês de início da operação');
    expect(conteudo).toContain('R$ 7.104');
    expect(rhConteudo).toContain('1,2943');
    expect(rhConteudo).not.toContain('alreadyCounted');
  });
});
