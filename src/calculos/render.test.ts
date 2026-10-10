import { describe, expect, it } from 'vitest';
import { evaluate, sensitivity } from '../model/calculate';
import { exampleInputs } from '../model/example';
import { formatPayback } from '../model/format';
import conteudo from './conteudo.md?raw';
import { renderMarkdown } from './render';

describe('página de cálculos', () => {
  it('repete os números que o motor produz no exemplo', () => {
    const result = evaluate(exampleInputs());
    expect(result.netInvestment).toBe(1_195_000);
    expect(result.steadyNet).toBe(20_500);
    expect(result.npv).toBeCloseTo(-260_450.21, 2);
    expect(formatPayback(result.payback)).toBe('58,3 meses');
    expect(result.firstPositiveMonth).toBe(59);
    expect(formatPayback(result.discountedPayback)).toBe('Não recupera em 60 meses');
    expect(result.firstPositiveDiscountedMonth).toBeNull();
    expect(conteudo).toContain('−R$ 260.450,21');
    expect(conteudo).toContain('58,3 meses');
    expect(conteudo).toContain('Não recupera em 60 meses');
    expect(conteudo).toContain('20,6%');
    const paybacks = sensitivity(exampleInputs(), 'base').investimento.map((point) => formatPayback(point.payback));
    expect(paybacks).toEqual([
      '40,8 meses',
      '49,5 meses',
      '58,3 meses',
      'Não recupera em 60 meses',
      'Não recupera em 60 meses',
    ]);
    expect(conteudo).toContain('40,8 m');
    expect(conteudo).toContain('não recupera');
  });

  it('monta índice, fórmulas e tabelas', () => {
    const { html, toc } = renderMarkdown(conteudo);
    expect(toc[0]?.text).toMatch(/Visão geral/);
    expect(toc.some((item) => item.level === 3 && /Perfil/.test(item.text))).toBe(true);
    expect(html).toContain('<pre><code>');
    expect(html).toContain('goLive');
    expect(html).toContain('58,3 meses');
    expect(html).not.toContain('<script');
    expect((html.match(/<table>/g) ?? []).length).toBeGreaterThan(8);
    expect((html.match(/<pre>/g) ?? []).length).toBeGreaterThan(8);
  });
});
