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
    expect(result.steadyNet).toBe(18_396);
    expect(result.npv).toBeCloseTo(-106_366.93, 2);
    expect(formatPayback(result.payback)).toBe('51,4 meses');
    expect(result.firstPositiveMonth).toBe(52);
    expect(formatPayback(result.discountedPayback)).toBe('Não recupera em 60 meses');
    expect(result.firstPositiveDiscountedMonth).toBeNull();
    expect(conteudo).toContain('−R$ 106.366,93');
    expect(conteudo).toContain('51,4 meses');
    expect(conteudo).toContain('Não recupera em 60 meses');
    expect(conteudo).toContain('23,4%');
    const paybacks = sensitivity(exampleInputs(), 'base').investimento.map((point) => formatPayback(point.payback));
    expect(paybacks).toEqual(['36,0 meses', '43,7 meses', '51,4 meses', '59,1 meses', 'Não recupera em 60 meses']);
    expect(conteudo).toContain('36,0 m');
    expect(conteudo).toContain('não recupera');
  });

  it('monta índice, fórmulas e tabelas', () => {
    const { html, toc } = renderMarkdown(conteudo);
    expect(toc[0]?.text).toMatch(/Visão geral/);
    expect(toc.some((item) => item.level === 3 && /Perfil/.test(item.text))).toBe(true);
    expect(html).toContain('<pre><code>');
    expect(html).toContain('goLive');
    expect(html).toContain('51,4 meses');
    expect(html).not.toContain('<script');
    expect((html.match(/<table>/g) ?? []).length).toBeGreaterThan(8);
    expect((html.match(/<pre>/g) ?? []).length).toBeGreaterThan(8);
  });
});
