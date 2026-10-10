import { describe, expect, it } from 'vitest';
import { evaluate, sensitivity } from '../model/calculate';
import { exampleInputs } from '../model/example';
import { formatPayback } from '../model/format';
import conteudo from './conteudo.md?raw';
import { renderMarkdown } from './render';

describe('página de cálculos', () => {
  it('repete os números que o motor produz no exemplo', () => {
    const result = evaluate(exampleInputs());
    expect(result.netInvestment).toBe(600_000);
    expect(result.steadyNet).toBe(22_200);
    expect(result.npv).toBeCloseTo(412_049.04, 2);
    expect(formatPayback(result.payback)).toBe('27,0 meses');
    expect(result.firstPositiveMonth).toBe(28);
    expect(formatPayback(result.discountedPayback)).toBe('31,4 meses');
    expect(result.firstPositiveDiscountedMonth).toBe(32);
    expect(conteudo).toContain('R$ 412.049,04');
    expect(conteudo).toContain('27,0 meses');
    expect(conteudo).toContain('31,4 meses');
    expect(conteudo).toContain('44,4%');
    const paybacks = sensitivity(exampleInputs(), 'base').investimento.map((point) => formatPayback(point.payback));
    expect(paybacks).toEqual(['18,9 meses', '23,0 meses', '27,0 meses', '31,1 meses', '35,1 meses']);
    expect(conteudo).toContain('18,9 m');
    expect(conteudo).toContain('35,1 m');
  });

  it('monta índice, fórmulas e tabelas', () => {
    const { html, toc } = renderMarkdown(conteudo);
    expect(toc[0]?.text).toMatch(/Visão geral/);
    expect(toc.some((item) => item.level === 3 && /Perfil/.test(item.text))).toBe(true);
    expect(html).toContain('<pre><code>');
    expect(html).toContain('goLive');
    expect(html).toContain('27,0 meses');
    expect(html).not.toContain('<script');
    expect((html.match(/<table>/g) ?? []).length).toBeGreaterThan(8);
    expect((html.match(/<pre>/g) ?? []).length).toBeGreaterThan(8);
  });
});
