/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { exampleInputs } from './model/example';
import { STORAGE_KEY, STORAGE_VERSION, writeSession } from './model/storage';
import { QUICK_ADJUST_OPEN_KEY, QUICK_DOCK_OPEN_KEY, RAIL_COLLAPSED_KEY } from './model/uiChrome';
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
    setViewport(1024);
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
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 1.195.000');
    expect(text('[data-testid="kpi-net"]')).toContain('R$ 20.500');
    expect(text('[data-testid="kpi-payback"]')).toContain('58,3');
    expect(text('[data-testid="kpi-roi"]')).toBe('20,6%');
    const charts = host.querySelector('.chart-grid');
    const summary = host.querySelector('[data-testid="executive-summary"]');
    const comparison = host.querySelector('table');
    expect(charts).not.toBeNull();
    expect(summary).not.toBeNull();
    expect(comparison).not.toBeNull();
    expect(charts!.compareDocumentPosition(summary!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(charts!.compareDocumentPosition(comparison!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const navLabels = [...host.querySelectorAll('nav button')].map((button) => button.textContent);
    expect(navLabels[0]).toBe('Perfil');
    expect(navLabels.at(-1)).toBe('Resultados');
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
    expect(host.querySelector('[data-testid="export-json"]')).toBeNull();
    expect(host.querySelector('[data-testid="import-json"]')).toBeNull();
    expect(host.textContent).toContain('Copiar resumo');
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
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 1.195.000');
    expect(text('[data-testid="kpi-net"]')).toContain('R$ 20.500');
    expect(text('[data-testid="kpi-payback"]')).toContain('58,3');
    expect(text('[data-testid="kpi-roi"]')).toBe('20,6%');
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
    expect(host.querySelector('.field.is-target')?.textContent).toContain('Manutenção e suporte');

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
    expect(host.querySelector('[data-testid="quick-salarios-slider"]')).not.toBeNull();
    expect(host.querySelector('[data-field-help]')).toBeNull();
    expect(host.querySelector('.field-help')).toBeNull();
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="quick-investimento-up"]')?.click();
    });
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 1.254.750');
    expect(text('[data-testid="quick-kpi-payback"]')).toContain('Não recupera em 60 meses');
    expect(text('[data-testid="quick-kpi-roi"]')).toContain('vs original');
    expect(text('[data-testid="quick-kpi-npv"]')).toContain('vs original');
    expect(text('[data-testid="quick-kpi-irr"]')).toContain('vs original');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="quick-undo"]')?.click();
    });
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 1.195.000');
    expect(text('[data-testid="kpi-net"]')).toContain('R$ 20.500');
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
    expect(saved.draft.adjustAnchor.robot.capex.equipment).toBe(1_000_000);
    expect(saved.draft.inputs.robot.capex.equipment).toBe(1_050_000);
    act(() => root.unmount());

    const next = document.createElement('div');
    document.body.appendChild(next);
    const restored = createRoot(next);
    await act(async () => {
      restored.render(<App />);
    });
    const text = (selector: string) => next.querySelector(selector)?.textContent?.replace(/\u00a0/g, ' ') ?? '';
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 1.254.750');
    await act(async () => {
      next.querySelector<HTMLButtonElement>('[data-testid="quick-undo"]')?.click();
    });
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 1.195.000');
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

  it('pede confirmação antes de trocar o porte e pode salvar o rascunho', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App />);
    });
    expect(host.querySelector('[data-testid="store-presets"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="preset-loja-1m"]')).not.toBeNull();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="preset-loja-1m"]')?.click();
    });
    expect(host.querySelector('[data-testid="preset-confirm"]')).not.toBeNull();
    expect(host.querySelector('h1')?.textContent).toBe('Farmácia Aurora — Unidade Centro');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="preset-cancel"]')?.click();
    });
    expect(host.querySelector('[data-testid="preset-confirm"]')).toBeNull();
    expect(host.querySelector('h1')?.textContent).toBe('Farmácia Aurora — Unidade Centro');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="preset-loja-1m"]')?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="preset-save-then-load"]')?.click();
    });
    expect(host.querySelector('h1')?.textContent).toBe('Loja de R$ 1 milhão/mês');
    expect(host.querySelector('[data-testid="store-zero-futureHires"]')).toBeNull();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(saved.simulations).toHaveLength(1);
    expect(saved.simulations[0].inputs.meta.storeName).toBe('Farmácia Aurora — Unidade Centro');

    const pessoas = [...host.querySelectorAll('nav button')].find((button) => button.textContent === 'Pessoas') as HTMLButtonElement;
    await act(async () => {
      pessoas.click();
    });
    expect(host.querySelector('[data-testid="preset-loja-2m"]')).not.toBeNull();
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="preset-loja-2m"]')?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="preset-replace"]')?.click();
    });
    expect(host.querySelector('h1')?.textContent).toBe('Loja de R$ 2 milhões/mês');
    expect(host.querySelector('nav .is-active')?.textContent).toBe('Resultados');
    act(() => root.unmount());
  });

  it('recolhe o ajuste rápido e lembra a escolha', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App initialInputs={exampleInputs()} />);
    });
    const toggle = () => host.querySelector<HTMLButtonElement>('[data-testid="quick-adjust-toggle"]');
    expect(toggle()?.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('#quick-adjust-body')?.hasAttribute('hidden')).toBe(false);
    expect(host.querySelector('[data-testid="quick-dock"]')).not.toBeNull();

    await act(async () => {
      toggle()?.click();
    });
    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('#quick-adjust-body')?.hasAttribute('hidden')).toBe(true);
    expect(host.querySelector('[data-testid="quick-dock-toggle"]')).not.toBeNull();
    expect(localStorage.getItem(QUICK_ADJUST_OPEN_KEY)).toBe('0');
    act(() => root.unmount());

    const next = document.createElement('div');
    document.body.appendChild(next);
    const restored = createRoot(next);
    await act(async () => {
      restored.render(<App initialInputs={exampleInputs()} />);
    });
    expect(next.querySelector('[data-testid="quick-adjust-toggle"]')?.getAttribute('aria-expanded')).toBe('false');
    expect(next.querySelector('#quick-adjust-body')?.hasAttribute('hidden')).toBe(true);
    await act(async () => {
      next.querySelector<HTMLButtonElement>('[data-testid="quick-adjust-toggle"]')?.click();
    });
    expect(next.querySelector('#quick-adjust-body')?.hasAttribute('hidden')).toBe(false);
    expect(localStorage.getItem(QUICK_ADJUST_OPEN_KEY)).toBe('1');
    act(() => restored.unmount());
  });

  it('resume a faixa de resultados num chip e lembra se o painel está aberto', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App initialInputs={exampleInputs()} />);
    });
    const text = (selector: string) => host.querySelector(selector)?.textContent?.replace(/\u00a0/g, ' ') ?? '';
    expect(host.querySelector('[data-testid="quick-dock"]')?.classList.contains('is-open')).toBe(false);
    expect(host.querySelector('[data-testid="quick-dock-panel"]')?.hasAttribute('hidden')).toBe(true);
    expect(host.querySelector('[data-testid="quick-dock-toggle"]')?.getAttribute('aria-expanded')).toBe('false');
    expect(text('[data-testid="quick-dock-toggle"]')).toContain('Payback');
    expect(text('[data-testid="quick-dock-toggle"]')).toContain('58,3');
    expect(text('[data-testid="quick-dock-toggle"]')).toContain('ROI');
    expect(text('[data-testid="quick-dock-toggle"]')).toContain('20,6%');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="quick-dock-toggle"]')?.click();
    });
    expect(host.querySelector('[data-testid="quick-dock"]')?.classList.contains('is-open')).toBe(true);
    expect(host.querySelector('[data-testid="quick-dock-panel"]')?.hasAttribute('hidden')).toBe(false);
    expect(text('[data-testid="quick-kpi-npv"]')).toContain('VPL');
    expect(text('[data-testid="quick-kpi-irr"]')).toContain('TIR');
    expect(localStorage.getItem(QUICK_DOCK_OPEN_KEY)).toBe('1');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="quick-dock-toggle"]')?.click();
    });
    expect(host.querySelector('[data-testid="quick-dock-panel"]')?.hasAttribute('hidden')).toBe(true);
    expect(localStorage.getItem(QUICK_DOCK_OPEN_KEY)).toBe('0');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="quick-dock-toggle"]')?.click();
    });
    await act(async () => {
      host.querySelector('h1')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="quick-dock"]')?.classList.contains('is-open')).toBe(false);
    expect(localStorage.getItem(QUICK_DOCK_OPEN_KEY)).toBe('0');
    act(() => root.unmount());

    localStorage.setItem(QUICK_DOCK_OPEN_KEY, '1');
    const next = document.createElement('div');
    document.body.appendChild(next);
    const restored = createRoot(next);
    await act(async () => {
      restored.render(<App initialInputs={exampleInputs()} />);
    });
    expect(next.querySelector('[data-testid="quick-dock"]')?.classList.contains('is-open')).toBe(true);
    expect(next.querySelector('[data-testid="quick-dock-panel"]')?.hasAttribute('hidden')).toBe(false);
    act(() => restored.unmount());
  });

  it('recolhe o menu em ícones, amplia o conteúdo e lembra a escolha', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    setViewport(1280);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App initialInputs={exampleInputs()} />);
    });
    expect(host.querySelector('[data-testid="rail"]')?.classList.contains('is-collapsed')).toBe(false);
    expect(host.querySelector('.app')?.classList.contains('is-rail-collapsed')).toBe(false);
    expect(host.querySelector('[data-testid="rail-toggle"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[data-testid="rail-toggle"]')?.textContent?.trim()).toBe('');
    expect(host.querySelector('[data-testid="rail-toggle"]')?.getAttribute('aria-label')).toBe('Recolher menu');
    expect(host.querySelector('[data-testid="rail-toggle"]')?.getAttribute('data-tooltip')).toBe('Recolher menu');
    const pessoas = () =>
      [...host.querySelectorAll('nav button')].find((button) => button.textContent === 'Pessoas') as HTMLButtonElement;
    expect(pessoas().getAttribute('data-tooltip')).toBe('Pessoas');
    expect(pessoas().getAttribute('title')).toBe('Pessoas');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="rail-toggle"]')?.click();
    });
    expect(host.querySelector('[data-testid="rail"]')?.classList.contains('is-collapsed')).toBe(true);
    expect(host.querySelector('.app')?.classList.contains('is-rail-collapsed')).toBe(true);
    expect(host.querySelector('[data-testid="rail-toggle"]')?.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('[data-testid="rail-toggle"]')?.getAttribute('title')).toBe('Expandir menu');
    expect(localStorage.getItem(RAIL_COLLAPSED_KEY)).toBe('1');
    expect(pessoas().textContent).toBe('Pessoas');
    act(() => root.unmount());

    const remembered = document.createElement('div');
    document.body.appendChild(remembered);
    const rememberedRoot = createRoot(remembered);
    await act(async () => {
      rememberedRoot.render(<App initialInputs={exampleInputs()} />);
    });
    expect(remembered.querySelector('[data-testid="rail"]')?.classList.contains('is-collapsed')).toBe(true);
    act(() => rememberedRoot.unmount());

    localStorage.removeItem(RAIL_COLLAPSED_KEY);
    setViewport(800);
    const narrow = document.createElement('div');
    document.body.appendChild(narrow);
    const narrowRoot = createRoot(narrow);
    await act(async () => {
      narrowRoot.render(<App initialInputs={exampleInputs()} />);
    });
    expect(narrow.querySelector('[data-testid="rail"]')?.classList.contains('is-collapsed')).toBe(true);
    expect(narrow.querySelector('[data-testid="rail-toggle"]')?.getAttribute('aria-label')).toBe('Expandir menu');
    act(() => narrowRoot.unmount());
  });

  it('remove cargos e contratações na hora e confirma antes de apagar uma simulação', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App />);
    });
    const nav = (label: string) =>
      [...host.querySelectorAll('nav button')].find((button) => button.textContent === label) as HTMLButtonElement;

    await act(async () => {
      nav('Pessoas').click();
    });
    const hire = host.querySelector<HTMLButtonElement>('[data-testid="remove-hire-hire-13"]');
    expect(hire?.getAttribute('aria-label')).toBe('Remover');
    expect(hire?.getAttribute('title')).toBe('Remover');
    expect(hire?.getAttribute('data-tooltip')).toBe('Remover');
    expect(hire?.className).toBe('btn-remove');
    expect(hire?.querySelector('svg')).not.toBeNull();
    expect(hire?.textContent?.trim()).toBe('');
    expect(hire?.closest('.remove-field')).not.toBeNull();
    await act(async () => {
      hire?.click();
    });
    expect(host.querySelector('[data-testid="remove-hire-hire-13"]')).toBeNull();
    expect(host.querySelector('[data-testid="remove-hire-hire-13-confirm"]')).toBeNull();

    await act(async () => {
      nav('Perfil').click();
    });
    const rolesBefore = host.querySelectorAll('[data-testid^="remove-role-"]').length;
    expect(rolesBefore).toBeGreaterThan(1);
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="remove-role-auxiliar"]')?.click();
    });
    expect(host.querySelectorAll('[data-testid^="remove-role-"]')).toHaveLength(rolesBefore - 1);
    expect(host.textContent).not.toContain('Auxiliar de farmácia');

    await act(async () => {
      nav('Simulações').click();
    });
    await act(async () => {
      [...host.querySelectorAll('button')].find((button) => button.textContent === 'Salvar simulação')?.click();
    });
    const saved = host.querySelector<HTMLButtonElement>('[data-testid^="remove-simulation-"]');
    expect(saved?.getAttribute('aria-label')).toBe('Remover');
    await act(async () => {
      saved?.click();
    });
    expect(host.querySelector('[data-testid$="-confirm"]')).not.toBeNull();
    expect(host.textContent).toContain('Apagar esta simulação salva neste navegador?');
    expect(host.querySelectorAll('article.library-item')).toHaveLength(1);
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid$="-cancel"]')?.click();
    });
    expect(host.querySelector('[data-testid$="-confirm"]')).toBeNull();
    expect(host.querySelectorAll('article.library-item')).toHaveLength(1);
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid^="remove-simulation-"]')?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid$="-confirm"]')?.click();
    });
    expect(host.textContent).toContain('Nenhuma simulação nomeada ainda.');
    act(() => root.unmount());
  });

  it('avisa na tela quando equipamento ou custo mensal ficam abaixo do piso', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const inputs = exampleInputs();
    inputs.robot.capex.equipment = 800_000;
    inputs.robot.opexMonthly.maintenance = 1_000;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App initialInputs={inputs} />);
    });
    expect(host.textContent).toContain('abaixo de R$ 1.000.000');
    expect(host.textContent).toContain('abaixo de R$ 5.000');
    const nav = [...host.querySelectorAll('nav button')].find((button) => button.textContent === 'Investimento');
    await act(async () => {
      nav?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="equipment-floor-warning"]')?.textContent).toContain('R$ 1.000.000');
    expect(host.querySelector('[data-testid="opex-floor-warning"]')?.textContent).toContain('R$ 5.000');
    act(() => root.unmount());
  });
});

function setViewport(width: number, height = 800) {
  (window as unknown as { happyDOM: { setViewport: (size: { width: number; height: number }) => void } }).happyDOM.setViewport({
    width,
    height,
  });
}

function setNativeValue(element: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
