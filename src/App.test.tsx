/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { exampleInputs } from './model/example';
import { STORAGE_KEY, STORAGE_VERSION, writeSession } from './model/storage';
import { WIZARD_STEPS } from './model/wizard';

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
    const summary = host.querySelector('[data-testid="executive-summary"]');
    expect(summary?.querySelectorAll('li')).toHaveLength(5);
    expect(summary?.textContent).toMatch(/payback/i);
    expect(summary?.textContent).toMatch(/ROI/);
    expect(summary?.textContent).toMatch(/não repete o valor do equipamento/i);
    expect(host.querySelector('[data-testid="store-presets"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="example-check"]')).not.toBeNull();
    expect(host.querySelector<HTMLAnchorElement>('[data-testid="open-headtohead"]')?.getAttribute('href')).toBe(
      '/gCalc/headtohead/',
    );
    expect(host.querySelector<HTMLAnchorElement>('[data-testid="open-calculos"]')?.getAttribute('href')).toBe(
      '/gCalc/calculos/',
    );
    expect(host.querySelector('[data-testid="page-nav"] [aria-current="page"]')?.textContent).toBe('Calculadora');
    expect(host.querySelector('.command-bar [data-testid="open-headtohead"]')).toBeNull();
    expect(host.querySelector('[data-testid="view-avancado"]')?.className).toContain('is-active');
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="view-simples"]')?.click();
    });
    expect(host.querySelector('[data-testid="view-simples"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[data-testid="more-actions"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="copy-summary"]')).toBeNull();
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
      draft: { inputs, scenario: 'conservador', section: 'pessoas', wizardStep: 0, adjustAnchor: inputs },
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
    expect(host.querySelector('.command-bar [data-testid="open-headtohead"]')).toBeNull();
    expect(host.querySelector('[data-testid="restore-example"]')).toBeNull();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="more-actions"]')?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="restore-example"]')?.click();
    });
    expect(host.textContent).toContain('Farmácia Aurora — Unidade Centro');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').simulations).toHaveLength(1);

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="more-actions"]')?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="clear-storage"]')?.click();
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').simulations).toHaveLength(1);
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="clear-storage-confirm"]')?.click();
    });
    const cleared = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(cleared.simulations).toEqual([]);
    expect(cleared.draft.scenario).toBe('base');
    expect(cleared.draft.inputs.profile.storeType).toBe('nova');
    act(() => root.unmount());
  });

  it('abre o assistente numa simulação nova, valida o nome e volta ao dashboard', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="new-simulation"]')?.click();
    });
    expect(host.querySelector('[data-testid="wizard"]')).not.toBeNull();
    expect(host.querySelector('#wizard-title')?.textContent).toBe('A loja');
    expect(host.textContent).toContain(`Passo 1 de ${WIZARD_STEPS.length}`);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').draft.section).toBe('wizard');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="wizard-next"]')?.click();
    });
    expect(host.querySelector('[data-testid="wizard-error"]')?.textContent).toMatch(/nome/i);
    expect(host.querySelector('#wizard-title')?.textContent).toBe('A loja');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="wizard-skip"]')?.click();
    });
    expect(host.querySelector('#wizard-title')?.textContent).toBe('Movimento');
    expect(host.querySelector('[data-testid="wizard-error"]')).toBeNull();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="wizard-back"]')?.click();
    });
    const store = host.querySelector<HTMLInputElement>('[data-testid="wizard-store-name"]');
    expect(store).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(store, 'Unidade Centro');
      store?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="wizard-next"]')?.click();
    });
    expect(host.querySelector('#wizard-title')?.textContent).toBe('Movimento');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').draft.wizardStep).toBe(1);

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="wizard-full"]')?.click();
    });
    expect(host.querySelector('[data-testid="wizard"]')).toBeNull();
    const text = (selector: string) => host.querySelector(selector)?.textContent?.replace(/\u00a0/g, ' ') ?? '';
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 2.000.000');
    expect(text('[data-testid="kpi-net"]')).toContain('R$ 65.000');
    expect(text('[data-testid="kpi-payback"]')).toContain('30,8');
    expect(text('[data-testid="kpi-roi"]')).toBe('39%');
    act(() => root.unmount());
  });

  it('retoma o assistente no passo salvo', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const inputs = exampleInputs();
    inputs.meta.storeName = 'Loja no meio';
    writeSession(localStorage, {
      version: STORAGE_VERSION,
      draft: { inputs, scenario: 'base', section: 'wizard', wizardStep: 4, adjustAnchor: inputs },
      simulations: [],
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App />);
    });
    expect(host.querySelector('#wizard-title')?.textContent).toBe('Estoque');
    expect(host.textContent).toContain('Passo 5 de 7');
    act(() => root.unmount());
  });

  it('abre a premissa no campo focado e desfaz o ajuste rápido', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App initialInputs={exampleInputs()} />);
    });

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="open-premise-investment"]')?.click();
    });
    expect(host.querySelector('nav .is-active')?.textContent).toBe('Investimento');
    const investment = host.querySelector<HTMLLabelElement>('.field.is-target');
    expect(investment?.textContent).toContain('Equipamento');
    expect(document.activeElement).toBe(investment?.querySelector('input'));

    const resultados = () =>
      [...host.querySelectorAll('nav button')].find((button) => button.textContent === 'Resultados') as HTMLButtonElement;
    await act(async () => {
      resultados().click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="open-premise-opex"]')?.click();
    });
    expect(host.querySelector('.field.is-target')?.textContent).toContain('Manutenção e peças');

    await act(async () => {
      resultados().click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="open-premise-audit-payroll"]')?.click();
    });
    expect(host.querySelector('nav .is-active')?.textContent).toBe('Pessoas');
    expect(host.querySelector('.field.is-target')?.textContent).toContain('Custo completo por pessoa');

    await act(async () => {
      resultados().click();
    });
    const text = (selector: string) => host.querySelector(selector)?.textContent?.replace(/\u00a0/g, ' ') ?? '';
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="quick-investimento-up"]')?.click();
    });
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 2.100.000');
    expect(text('[data-testid="quick-kpi-payback"]')).toContain('vs original');
    expect(text('[data-testid="quick-kpi-roi"]')).toContain('vs original');
    expect(text('[data-testid="quick-kpi-npv"]')).toContain('vs original');
    expect(text('[data-testid="quick-kpi-irr"]')).toContain('vs original');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="quick-undo"]')?.click();
    });
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 2.000.000');
    expect(text('[data-testid="kpi-net"]')).toContain('R$ 65.000');
    expect(text('[data-testid="quick-kpi-payback"]')).toContain('igual ao original');
    act(() => root.unmount());
  });

  it('persiste o ajuste rápido e o valor original', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="quick-investimento-up"]')?.click();
    });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.draft.adjustAnchor.robot.capex.equipment).toBe(1_750_000);
    expect(saved.draft.inputs.robot.capex.equipment).toBe(1_837_500);
    act(() => root.unmount());

    const next = document.createElement('div');
    document.body.appendChild(next);
    const restored = createRoot(next);
    await act(async () => {
      restored.render(<App />);
    });
    const text = (selector: string) => next.querySelector(selector)?.textContent?.replace(/\u00a0/g, ' ') ?? '';
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 2.100.000');
    await act(async () => {
      next.querySelector<HTMLButtonElement>('[data-testid="quick-undo"]')?.click();
    });
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 2.000.000');
    act(() => restored.unmount());
  });

  it('deixa o investimento do robô ir a zero e não volta pelo slider', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App initialInputs={exampleInputs()} />);
    });
    const text = (selector: string) => host.querySelector(selector)?.textContent?.replace(/\u00a0/g, ' ') ?? '';
    const investment = host.querySelector<HTMLInputElement>('[data-testid="quick-investimento-value"]');
    const slider = host.querySelector<HTMLInputElement>('[data-testid="quick-investimento-slider"]');
    expect(slider?.min).toBe('-100');
    expect(slider?.max).toBe('30');

    await act(async () => {
      setNativeValue(investment!, '0');
      investment?.blur();
    });
    expect(host.querySelector<HTMLInputElement>('[data-testid="quick-investimento-value"]')?.value).toBe('0');
    await act(async () => {
      slider?.dispatchEvent(new Event('input', { bubbles: true }));
      slider?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector<HTMLInputElement>('[data-testid="quick-investimento-value"]')?.value).toBe('0');
    expect(text('[data-testid="kpi-payback"]')).toContain('Imediato');
    expect(text('[data-testid="kpi-irr"]')).toBe('Indefinida');
    expect(text('[data-testid="kpi-npv"]')).not.toMatch(/NaN|—/);
    expect(text('[data-testid="quick-kpi-payback"]')).toContain('Imediato');
    expect(text('[data-testid="quick-kpi-irr"]')).toContain('Indefinida');

    await act(async () => {
      const field = host.querySelector<HTMLInputElement>('[data-testid="quick-investimento-value"]');
      field?.focus();
      setNativeValue(field!, '5000000');
      field?.blur();
    });
    expect(host.querySelector<HTMLInputElement>('[data-testid="quick-investimento-value"]')?.value.replace(/\u00a0/g, ' ')).toBe(
      '5.000.000',
    );
    await act(async () => {
      slider?.dispatchEvent(new Event('input', { bubbles: true }));
      slider?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector<HTMLInputElement>('[data-testid="quick-investimento-value"]')?.value.replace(/\u00a0/g, ' ')).toBe(
      '5.000.000',
    );

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="open-premise-investment"]')?.click();
    });
    const robot = [...host.querySelectorAll<HTMLLabelElement>('.field')].find((field) =>
      field.textContent?.includes('Equipamento'),
    );
    const robotInput = robot?.querySelector('input');
    await act(async () => {
      robotInput?.focus();
      setNativeValue(robotInput!, '0');
      robotInput?.blur();
    });
    expect(robot?.querySelector('input')?.value).toBe('0');
    act(() => root.unmount());
  });

  it('carrega um modelo de loja fictício com um clique', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App initialInputs={exampleInputs()} />);
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="preset-loja-1m"]')?.click();
    });
    expect(host.querySelector('h1')?.textContent).toBe('Loja de R$ 1 milhão/mês');
    expect(host.querySelector('[data-testid="store-zero-futureHires"]')).toBeNull();
    expect(host.textContent).toMatch(/fictícios/i);
    act(() => root.unmount());
  });
});

function setNativeValue(element: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
