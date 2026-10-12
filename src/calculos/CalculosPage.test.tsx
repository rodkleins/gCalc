/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluate } from '../model/calculate';
import { exampleInputs } from '../model/example';
import { formatPayback } from '../model/format';
import { CalculosPage } from './CalculosPage';

describe('tela de cálculos', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mostra o índice, uma fórmula e os links de volta', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<CalculosPage />);
    });
    const text = host.textContent ?? '';
    expect(text).toContain('Como os cálculos são feitos');
    expect(text).toContain('Visão geral');
    expect(host.querySelector('pre code')?.textContent).toContain('mês de início');
    expect(host.querySelector('[data-testid="engine-examples"]')).not.toBeNull();
    expect(text).toContain('A calculadora abre na loja de R$ 2 milhões');
    expect(text.replace(/\u00a0/g, ' ')).toContain(formatPayback(evaluate(exampleInputs()).payback));
    expect(host.querySelector('table')).not.toBeNull();
    expect(host.querySelector('[data-testid="quick-dock"]')).toBeNull();
    expect(host.querySelector('[data-testid="doc-back"]')?.getAttribute('href')).toBe('../');
    expect(host.querySelector('[data-testid="doc-headtohead"]')?.getAttribute('href')).toBe('../headtohead/');
    expect(text).not.toMatch(/\/gCalc\/|src\/|\bevaluate\b/);
    const index = host.querySelector('.doc-toc a');
    expect(index?.getAttribute('href')).toMatch(/^#/);
    act(() => root.unmount());
  });
});
