/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../model/storage';
import { HeadToHeadApp } from './HeadToHeadApp';
import { exampleDraft } from './model';
import { HEADTOHEAD_STORAGE_KEY } from './storage';

describe('tela head-to-head', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('mostra Hoje, Com robô e o resultado que sobra', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<HeadToHeadApp initialDraft={exampleDraft()} />);
    });
    const text = (selector: string) => host.querySelector(selector)?.textContent?.replace(/\u00a0/g, ' ') ?? '';
    expect(host.textContent).toContain('Hoje');
    expect(host.textContent).toContain('Com robô');
    expect(host.textContent).toContain('Números fictícios');
    expect(text('[data-testid="hh-result-today"]')).toContain('R$ 107.900');
    expect(text('[data-testid="hh-result-robot"]')).toContain('R$ 143.300');
    expect(text('[data-testid="hh-result-delta"]')).toContain('35.400');
    expect(text('[data-testid="hh-payback"]')).toContain('56,5');
    expect(text('[data-testid="hh-roi"]')).toBe('21,2%');
    expect(text('[data-testid="hh-npv"]')).toMatch(/R\$/);
    expect(text('[data-testid="hh-npv"]')).not.toMatch(/NaN/);
    expect(text('[data-testid="hh-irr"]')).not.toBe('Indefinida');
    expect(host.querySelector<HTMLAnchorElement>('[data-testid="back-to-current"]')?.getAttribute('href')).toBe('/gCalc/');
    expect(host.querySelector<HTMLAnchorElement>('[data-testid="open-calculos"]')?.getAttribute('href')).toBe(
      '/gCalc/calculos/',
    );
    expect(localStorage.getItem(HEADTOHEAD_STORAGE_KEY)).toBeNull();
    act(() => root.unmount());
  });

  it('recalcula o resultado ao editar a receita e ao criar uma linha', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<HeadToHeadApp initialDraft={exampleDraft()} />);
    });
    const text = (selector: string) => host.querySelector(selector)?.textContent?.replace(/\u00a0/g, ' ') ?? '';
    const revenue = host.querySelector<HTMLInputElement>('[data-testid="hh-line-receita-today"]');
    await act(async () => {
      setNativeValue(revenue!, '1100000');
      revenue?.blur();
    });
    expect(text('[data-testid="hh-result-today"]')).toContain('R$ 207.900');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="hh-add-extra"]')?.click();
    });
    const names = [...host.querySelectorAll('input')].map((input) => input.value);
    expect(names).toContain('Nova linha');
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="hh-add-staff"]')?.click();
    });
    expect([...host.querySelectorAll('input')].map((input) => input.value)).toContain('Nova função');
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="hh-add-indicator"]')?.click();
    });
    expect([...host.querySelectorAll('input')].map((input) => input.value)).toContain('Novo indicador');
    act(() => root.unmount());
  });

  it('persiste o rascunho sem apagar a calculadora atual', async () => {
    localStorage.setItem(STORAGE_KEY, '{"version":2}');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<HeadToHeadApp />);
    });
    const name = host.querySelector<HTMLInputElement>('[data-testid="hh-store-name"]');
    await act(async () => {
      setNativeValue(name!, 'Rede Sul');
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{"version":2}');
    expect(localStorage.getItem(HEADTOHEAD_STORAGE_KEY)).toContain('Rede Sul');
    act(() => root.unmount());

    const next = document.createElement('div');
    document.body.appendChild(next);
    const restored = createRoot(next);
    await act(async () => {
      restored.render(<HeadToHeadApp />);
    });
    expect(next.querySelector<HTMLInputElement>('[data-testid="hh-store-name"]')?.value).toBe('Rede Sul');
    act(() => restored.unmount());
  });
});

function setNativeValue(element: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
