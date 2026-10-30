/** @vitest-environment happy-dom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import RhApp from '../rh/RhApp';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const clean = (value: string | null | undefined) => (value ?? '').replace(/\u00a0/g, ' ');

describe('bloco Inflação na calculadora raiz', () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  async function mount(node: ReactNode) {
    window.print = () => undefined;
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(node);
    });
    return host;
  }

  const click = async (element: Element | null | undefined) => {
    await act(async () => {
      (element as HTMLElement | null)?.click();
    });
  };

  it('aparece nos Resultados e no Perfil, no modo simples e no avançado, com fonte e data', async () => {
    const host = await mount(<App />);
    const nav = (label: string) => [...host.querySelectorAll('nav button')].find((button) => button.textContent === label);
    for (const mode of ['simples', 'avancado']) {
      await click(host.querySelector(`[data-testid="view-${mode}"]`));
      await click(nav('Resultados'));
      expect(host.querySelector('[data-testid="inflation-panel"]')).not.toBeNull();
      await click(nav('Perfil'));
      const panel = host.querySelector('[data-testid="inflation-panel"]');
      expect(panel).not.toBeNull();
      expect(panel?.querySelector<HTMLInputElement>('[data-testid="inflation-ipca"]')?.value).toMatch(/^4,34|^4\.34/);
      expect(clean(panel?.textContent)).toContain('Focus');
      expect(clean(panel?.textContent)).toContain('23/10/2026');
      expect(clean(panel?.textContent)).toContain('+ 1 p.p.');
      expect(panel?.querySelector('a')?.getAttribute('href')).toContain('bcb.gov.br');
      expect(host.querySelector('[data-testid="inflation-warning"]')).toBeNull();
    }
  });

  it('troca para base real, zera os reajustes e mostra a taxa real', async () => {
    const host = await mount(<App />);
    const nav = (label: string) => [...host.querySelectorAll('nav button')].find((button) => button.textContent === label);
    await click(nav('Perfil'));
    await click(host.querySelector('[data-testid="money-basis-real"]'));
    expect(host.querySelector('[data-testid="money-basis-real"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector<HTMLInputElement>('[data-testid="inflation-ipca"]')?.value).toMatch(/^0/);
    expect(clean(host.querySelector('[data-testid="inflation-discount-note"]')?.textContent)).toContain('7,34%');
    expect(host.querySelector('[data-testid="inflation-warning"]')).toBeNull();
  });

  it('a sensibilidade traz a linha Inflação alta (IPCA +3 p.p.)', async () => {
    const host = await mount(<App />);
    const nav = (label: string) => [...host.querySelectorAll('nav button')].find((button) => button.textContent === label);
    await click(nav('Sensibilidade'));
    expect(clean(host.querySelector('[data-testid="inflation-stress-row"]')?.textContent)).toContain('Inflação alta (IPCA +3 p.p.)');
  });

  it('não aparece em /rh/', async () => {
    const host = await mount(<RhApp />);
    expect(host.querySelector('[data-testid="inflation-panel"]')).toBeNull();
  });
});
