/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
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
    expect(host.querySelector('pre code')?.textContent).toContain('goLive');
    expect(host.querySelector('table')).not.toBeNull();
    expect(host.querySelector('[data-testid="doc-back"]')?.getAttribute('href')).toBe('/gCalc/');
    expect(host.querySelector('[data-testid="doc-headtohead"]')?.getAttribute('href')).toBe('/gCalc/headtohead/');
    const index = host.querySelector('.doc-toc a');
    expect(index?.getAttribute('href')).toMatch(/^#/);
    act(() => root.unmount());
  });
});
