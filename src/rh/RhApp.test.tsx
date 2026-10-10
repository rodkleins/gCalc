/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { formatPayback } from '../model/format';
import { rhExample, rhScorecard } from './presets';
import RhApp from './RhApp';
import { RhCalculosPage } from './calculos/RhCalculosPage';
import { RH_STORAGE_KEY } from './storage';
import { STORAGE_KEY } from '../model/storage';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('versão em validação', () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('mostra o aviso, o quadro e não grava a chave da calculadora atual', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<RhApp />);
    });
    const notice = host.querySelector('[data-testid="rh-validation-notice"]');
    expect(notice?.textContent).toContain('Versão em validação');
    expect(host.querySelector('[data-testid="rh-back-to-current"]')?.getAttribute('href')).toBe('/gCalc/');
    expect(host.querySelector('[data-testid="store-presets"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="roster-strip"]')).toBeNull();
    expect(host.querySelector('[data-testid="roster-summary"]')).toBeNull();
    expect(host.querySelector('[data-testid="shift-count"]')).toBeNull();
    expect(host.querySelector('[data-testid="kpi-payback"]')?.textContent).toContain(
      formatPayback(rhScorecard()[0].cells[1].payback),
    );
    expect(localStorage.getItem(RH_STORAGE_KEY)).toContain('gcalc-rh');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    const pessoas = [...host.querySelectorAll('.nav-label')].find((node) => node.textContent === 'Pessoas');
    await act(async () => {
      pessoas?.closest('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="roster-avoided"]')?.textContent).toContain('1 no turno 1');
    expect(host.querySelector('[data-testid="roster-summary"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="shift-count-2"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="night-premium"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="shift-present-2"]')).toBeNull();
    await act(async () => {
      host.querySelector('[data-testid="shift-count-3"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="shift-present-2"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="roster-summary"]')?.textContent).toContain('Turno da noite');
    const resultados = [...host.querySelectorAll('.nav-label')].find((node) => node.textContent === 'Resultados');
    await act(async () => {
      resultados?.closest('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="roster-summary"]')).toBeNull();
    expect(host.querySelector('[data-testid="shift-count"]')).toBeNull();
    expect(host.querySelector('[data-testid="store-presets"]')).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('abre o modelo de R$ 4 milhões com 3 turnos e o payback real', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<RhApp initial={rhExample()} />);
    });
    await act(async () => {
      host.querySelector('[data-testid="preset-loja-4m"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      host.querySelector('[data-testid="preset-replace"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="roster-summary"]')).toBeNull();
    expect(host.querySelector('[data-testid="kpi-payback"]')?.textContent).toContain('14,7');
    const pessoas = [...host.querySelectorAll('.nav-label')].find((node) => node.textContent === 'Pessoas');
    await act(async () => {
      pessoas?.closest('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="roster-summary"]')?.textContent).toContain('Turno da noite');
    expect(host.querySelector('[data-testid="shift-count-3"]')?.classList.contains('is-active')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('página de cálculos desta versão', () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
  });

  it('explica o folguista e publica a tabela dos modelos', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<RhCalculosPage />);
    });
    const text = host.textContent ?? '';
    expect(text).toContain('Versão em validação');
    expect(text).toContain('1,3184');
    expect(text).toContain('6,6063');
    expect(host.querySelector('[data-testid="rh-back-to-current"]')?.getAttribute('href')).toBe('/gCalc/');
    expect(host.querySelector('[data-testid="score-exemplo-base"]')?.textContent).toContain('Não recupera em 60 meses');
    expect(host.querySelector('[data-testid="score-loja-4m-base"]')?.textContent).toContain('14,7 meses');
    expect(host.querySelector('[data-testid="score-loja-1m-base"]')?.textContent?.replace(/\u00a0/g, ' ')).toContain(
      'R$ 1.235.000',
    );
  });
});
