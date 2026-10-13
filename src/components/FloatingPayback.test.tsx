/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import { exampleInputs } from '../model/example';
import RhApp from '../rh/RhApp';
import { exampleRoster } from '../rh/presets';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const EDITING_TABS = ['Perfil', 'Pessoas', 'Logística', 'Estoque', 'Investimento'] as const;

function expectPaybackOnTab(host: HTMLElement, label: string) {
  const dock = host.querySelector('[data-testid="quick-dock"]');
  expect(dock, label).not.toBeNull();
  expect(dock?.textContent, label).toMatch(/Payback/);
  expect(dock?.closest('.main'), label).not.toBeNull();
  const field = host.querySelector('.main .field');
  if (field && dock) {
    expect(dock.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING, label).toBeTruthy();
  }
}

async function openTab(host: HTMLElement, label: string) {
  const button = [...host.querySelectorAll('nav button')].find(
    (node) => (node.querySelector('.nav-label')?.textContent ?? node.textContent) === label,
  );
  expect(button, label).toBeTruthy();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('indicador flutuante de payback', () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('aparece em cada aba de edição da calculadora e do RH, inclusive no assistente', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(<App initialInputs={exampleInputs()} />);
    });
    for (const label of EDITING_TABS) {
      await openTab(host, label);
      expectPaybackOnTab(host, `raiz ${label}`);
    }
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="open-wizard"]')?.click();
    });
    expectPaybackOnTab(host, 'raiz Assistente');

    await act(async () => {
      root?.render(<RhApp initial={{ inputs: exampleInputs(), roster: exampleRoster() }} />);
    });
    for (const label of EDITING_TABS) {
      await openTab(host, label);
      expectPaybackOnTab(host, `rh ${label}`);
    }
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="open-wizard"]')?.click();
    });
    expectPaybackOnTab(host, 'rh Assistente');
  });
});
