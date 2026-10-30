/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { rootDefaultStorePreset } from './model/rootPresets';
import { exampleInputs } from './model/example';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function setControl(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

async function openSection(host: HTMLElement, label: string) {
  const button = [...host.querySelectorAll('nav button')].find((node) => node.textContent?.includes(label));
  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const stamp = (host: HTMLElement) => host.querySelector('[data-result-stamp]')?.getAttribute('data-result-stamp') ?? '';

describe('raiz: dupla contagem, benefício fiscal e residual na tela', () => {
  let root: Root | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  async function mount(inputs = rootDefaultStorePreset().inputs) {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<App initialInputs={structuredClone(inputs)} />);
    });
    return host;
  }

  it('avisa a dupla contagem e pede dono das horas e caminho de caixa', async () => {
    const host = await mount(exampleInputs());
    await openSection(host, 'Logística');
    expect(host.querySelector('[data-testid="double-count-warning"]')?.textContent).toMatch(/dupla contagem/i);
    expect(host.querySelector('[data-testid="movement-double-count-warning"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="inventory-double-count-warning"], [data-testid="count-double-count-warning"]')).not.toBeNull();
    const before = stamp(host);
    const owner = host.querySelector<HTMLInputElement>('[data-testid="movement-hours-owner"] input, input[data-testid="movement-hours-owner"]');
    expect(owner).not.toBeNull();
    await act(async () => setControl(owner!, 'outros colaboradores que permanecem'));
    expect(stamp(host)).toBe(before);
    const select = owner!.closest('.card, section, fieldset')?.querySelectorAll('select');
    const cash = [...(select ?? [])].find((node) => [...node.options].some((o) => o.value === 'hora_extra'));
    expect(cash).toBeDefined();
    await act(async () => setControl(cash!, 'hora_extra'));
    expect(stamp(host)).not.toBe(before);
  });

  it('mostra benefício fiscal desligado, residual de 30% do contábil e a sensibilidade', async () => {
    const host = await mount();
    await openSection(host, 'Investimento');
    const panel = host.querySelector('[data-testid="tax-shield-panel"]');
    expect(panel?.textContent).toMatch(/Benefício fiscal da depreciação \(lucro real\)/);
    expect(host.querySelector('[data-testid="tax-shield-note"]')?.textContent).toMatch(/lucro real/);
    expect(host.querySelector('[data-testid="tax-shield-effect"]')?.textContent).toMatch(/VPL/);
    const residual = host.querySelector('[data-testid="residual-panel"]');
    expect(residual?.textContent).toMatch(/Valor residual no mês 60/);
    const pct = host.querySelector<HTMLInputElement>('[data-testid="residual-pct"] input, input[data-testid="residual-pct"]');
    expect(pct?.value).toMatch(/30/);
    await openSection(host, 'Sensibilidade');
    expect(host.querySelector('[data-testid="fiscal-row-escudo"]')).not.toBeNull();
  });
});
