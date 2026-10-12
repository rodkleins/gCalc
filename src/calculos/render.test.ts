import { describe, expect, it } from 'vitest';
import { evaluate, sensitivity } from '../model/calculate';
import { exampleInputs } from '../model/example';
import { formatPayback } from '../model/format';
import conteudo from './conteudo.md?raw';
import { renderMarkdown } from './render';

describe('página de cálculos', () => {
  it('repete os números que o motor produz no exemplo', () => {
    const result = evaluate(exampleInputs());
    expect(result.netInvestment).toBe(945_000);
    expect(result.steadyNet).toBe(20_500);
    expect(result.npv).toBeCloseTo(-10_450.21, 2);
    expect(formatPayback(result.payback)).toBe('46,1 meses');
    expect(result.firstPositiveMonth).toBe(47);
    expect(formatPayback(result.discountedPayback)).toBe('Não recupera em 60 meses');
    expect(result.firstPositiveDiscountedMonth).toBeNull();
    expect(conteudo).toContain('−R$ 10.450,21');
    expect(conteudo).toContain('46,1 meses');
    expect(conteudo).toContain('Não recupera em 60 meses');
    expect(conteudo).toContain('26%');
    const paybacks = sensitivity(exampleInputs(), 'base').investimento.map((point) => formatPayback(point.payback));
    expect(paybacks).toEqual(['32,3 meses', '39,2 meses', '46,1 meses', '53,0 meses', '59,9 meses']);
    expect(conteudo).toContain('32,3 m');
    expect(conteudo).toContain('não recupera');
  });

  it('monta índice, fórmulas e tabelas', () => {
    const { html, toc } = renderMarkdown(conteudo);
    expect(toc[0]?.text).toMatch(/Visão geral/);
    expect(toc.some((item) => item.level === 3 && /Perfil/.test(item.text))).toBe(true);
    expect(html).toContain('<pre><code>');
    expect(html).toContain('goLive');
    expect(html).toContain('46,1 meses');
    expect(html).not.toContain('<script');
    expect((html.match(/<table>/g) ?? []).length).toBeGreaterThan(8);
    expect((html.match(/<pre>/g) ?? []).length).toBeGreaterThan(8);
  });
});
