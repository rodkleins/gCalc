/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { exampleInputs } from './model/example';
import { STORAGE_KEY, STORAGE_VERSION, writeSession } from './model/storage';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('aplicação', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('mostra o exemplo ilustrativo no dashboard', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App initialInputs={exampleInputs()} />);
    });
    const text = (selector: string) => host.querySelector(selector)?.textContent?.replace(/\u00a0/g, ' ') ?? '';
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 2.000.000');
    expect(text('[data-testid="kpi-net"]')).toContain('R$ 65.000');
    expect(text('[data-testid="kpi-payback"]')).toContain('30,8');
    expect(text('[data-testid="kpi-roi"]')).toBe('39%');
    expect(host.querySelector('[data-testid="example-check"]')).not.toBeNull();
    act(() => root.unmount());
  });

  it('carrega a sessão salva e os botões restauram ou apagam os dados', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const inputs = exampleInputs();
    inputs.profile.storeType = 'existente';
    inputs.people.payroll.severanceCost = 0;
    inputs.meta.storeName = 'Loja Salva';
    writeSession(localStorage, {
      version: STORAGE_VERSION,
      draft: { inputs, scenario: 'conservador', section: 'pessoas' },
      simulations: [
        {
          id: 'salva',
          name: 'Caso salvo',
          savedAt: '2026-10-09T00:00:00.000Z',
          inputs,
          scenario: 'conservador',
          section: 'pessoas',
        },
      ],
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App />);
    });

    expect(host.textContent).toContain('Loja Salva');
    expect(host.textContent).toContain('Folha e encargos');
    expect(host.querySelector('[aria-label="Cenário"] .is-active')?.textContent).toBe('Conservador');
    expect(host.textContent).toContain('Os dados ficam só neste navegador.');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="restore-example"]')?.click();
    });
    expect(host.textContent).toContain('Farmácia Aurora — Unidade Centro');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').simulations).toHaveLength(1);

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="clear-storage"]')?.click();
    });
    const cleared = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(cleared.simulations).toEqual([]);
    expect(cleared.draft.scenario).toBe('base');
    expect(cleared.draft.inputs.profile.storeType).toBe('nova');
    act(() => root.unmount());
  });
});
