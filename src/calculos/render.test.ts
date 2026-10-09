import { describe, expect, it } from 'vitest';
import { evaluate, sensitivity } from '../model/calculate';
import { exampleInputs } from '../model/example';
import { formatPayback } from '../model/format';
import conteudo from './conteudo.md?raw';
import { renderMarkdown } from './render';

describe('página de cálculos', () => {
  it('repete os números que o motor produz no exemplo', () => {
    const result = evaluate(exampleInputs());
    expect(result.netInvestment).toBe(2_000_000);
    expect(result.steadyNet).toBe(65_000);
    expect(result.npv).toBeCloseTo(963_206.66, 2);
    expect(formatPayback(result.payback)).toBe('30,8 meses');
    expect(result.firstPositiveMonth).toBe(31);
    expect(formatPayback(result.discountedPayback)).toBe('36,6 meses');
    expect(result.firstPositiveDiscountedMonth).toBe(37);
    expect(conteudo).toContain('R$ 963.206,66');
    expect(conteudo).toContain('30,8 meses');
    expect(conteudo).toContain('36,6 meses');
    expect(conteudo).toContain('39%');
    const paybacks = sensitivity(exampleInputs(), 'base').investimento.map((point) => formatPayback(point.payback));
    expect(paybacks).toEqual(['21,5 meses', '26,2 meses', '30,8 meses', '35,4 meses', '40,0 meses']);
    expect(conteudo).toContain('21,5 m');
    expect(conteudo).toContain('40,0 m');
  });

  it('monta índice, fórmulas e tabelas', () => {
    const { html, toc } = renderMarkdown(conteudo);
    expect(toc[0]?.text).toMatch(/Visão geral/);
    expect(toc.some((item) => item.level === 3 && /Perfil/.test(item.text))).toBe(true);
    expect(html).toContain('<pre><code>');
    expect(html).toContain('goLive');
    expect(html).toContain('30,8 meses');
    expect(html).not.toContain('<script');
    expect((html.match(/<table>/g) ?? []).length).toBeGreaterThan(8);
    expect((html.match(/<pre>/g) ?? []).length).toBeGreaterThan(8);
  });
});
