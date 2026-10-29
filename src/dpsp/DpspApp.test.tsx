/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DISCLAIMER } from '../components/PrintReport';
import { evaluate } from '../model/calculate';
import { formatPayback } from '../model/format';
import { STORAGE_KEY, STORAGE_VERSION, writeSession } from '../model/storage';
import { exampleInputs } from '../model/example';
import DpspApp from './DpspApp';
import { DPSP_STORAGE_KEY } from './storage';
import { MODEL_DISCLAIMER, dpspPresets } from './stores';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('página DPSP', () => {
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
      root = null;
    }
    document.body.innerHTML = '';
    localStorage.clear();
  });

  async function render() {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<DpspApp />);
    });
    return host;
  }

  it('abre a Fradique com o aviso, as três lojas e sem gravar a calculadora publicada', async () => {
    writeSession(localStorage, {
      version: STORAGE_VERSION,
      draft: {
        inputs: exampleInputs(),
        scenario: 'base',
        section: 'dashboard',
        wizardStep: 0,
        adjustAnchor: exampleInputs(),
      },
      simulations: [],
    });
    const before = localStorage.getItem(STORAGE_KEY);
    const host = await render();
    const text = host.textContent ?? '';
    expect(text).toContain('Dados DPSP (planilha de 29/10/2026) + premissas do modelo a validar');
    expect(text).toContain(MODEL_DISCLAIMER);
    expect(MODEL_DISCLAIMER).toBe(DISCLAIMER);
    expect(host.querySelector('[data-testid="page-nav"]')).toBeNull();
    expect(host.querySelector('[data-testid="preset-loja-2m"]')).toBeNull();
    for (const preset of dpspPresets()) {
      expect(host.querySelector(`[data-testid="preset-${preset.id}"]`)?.getAttribute('aria-pressed')).toBe(
        preset.id === 'dpsp-327' ? 'true' : 'false',
      );
      const payback = formatPayback(evaluate(preset.inputs).payback);
      expect(host.querySelector(`[data-testid="origin-payback-${preset.id}"]`)?.textContent).toBe(payback);
    }
    expect(host.querySelector('[data-testid="kpi-payback"]')?.textContent).toBe(
      formatPayback(evaluate(dpspPresets()[0].inputs).payback),
    );
    expect(host.querySelector('[data-testid="dpsp-positions"]')?.textContent).toContain('4,5 vagas');
    expect(host.querySelector('[data-testid="dpsp-calc"]')?.textContent).toContain('9 × 50% = 4,5');
    expect(host.querySelector('[data-testid="dpsp-calc"]')?.textContent).toContain('× (1 − 43%)');
    const shown = dpspPresets().map(
      (preset) => host.querySelector(`[data-testid="origin-payback-${preset.id}"]`)?.textContent,
    );
    expect(new Set(shown).size).toBe(3);
    expect(localStorage.getItem(DPSP_STORAGE_KEY)).toContain('327 DSP Fradique Coutinho');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('troca a loja sem misturar a chave publicada', async () => {
    const host = await render();
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="preset-dpsp-267"]')?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="preset-replace"]')?.click();
    });
    expect(host.querySelector('h1')?.textContent).toBe('267 DSP João Cachoeira');
    expect(localStorage.getItem(DPSP_STORAGE_KEY)).toContain('267 DSP João Cachoeira');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
