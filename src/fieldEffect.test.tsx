/** @vitest-environment happy-dom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { partialAvailabilityMatters } from './model/benefitStatus';
import { evaluate } from './model/calculate';
import { formatPayback } from './model/format';
import { storePresets } from './model/presets';
import RhApp from './rh/RhApp';
import { rhStorePresets } from './rh/presets';
import { applyRoster } from './rh/roster';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const SECTIONS = ['Perfil', 'Pessoas', 'Logística', 'Estoque', 'Investimento'] as const;

function stampOf(host: HTMLElement): string {
  return host.querySelector('[data-result-stamp]')?.getAttribute('data-result-stamp') ?? '';
}

function shown(el: HTMLElement): boolean {
  if ((el as HTMLInputElement).disabled) return false;
  if (el.closest('[hidden], .quick-dock, nav, .print-host')) return false;
  const details = el.closest('details');
  if (details && !details.open) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function marked(el: HTMLElement): boolean {
  const host = el.closest('[data-no-effect]');
  if (!host) return false;
  const reason = host.getAttribute('data-no-effect')?.trim() ?? '';
  const visible = host.querySelector('.no-effect')?.textContent?.trim() ?? '';
  return reason.length > 0 && visible.length > 0;
}

function labelOf(el: HTMLElement): string {
  return (
    el.getAttribute('aria-label') ||
    el.closest('label')?.querySelector('.field-label, span')?.textContent ||
    el.closest('label')?.textContent ||
    el.tagName
  )
    ?.replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) ?? el.tagName;
}

function controls(host: HTMLElement): HTMLElement[] {
  return [...host.querySelectorAll('main input, main select, main textarea')].filter(
    (el): el is HTMLElement => el instanceof HTMLElement && shown(el),
  );
}

function setControl(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

async function poke(el: HTMLElement, host: HTMLElement): Promise<boolean> {
  const before = stampOf(host);
  if (el instanceof HTMLInputElement && el.type === 'checkbox') {
    await act(async () => {
      el.click();
    });
    return stampOf(host) !== before;
  }
  if (el instanceof HTMLSelectElement) {
    for (const option of [...el.options]) {
      if (option.value === el.value) continue;
      await act(async () => {
        setControl(el, option.value);
      });
      if (stampOf(host) !== before) return true;
    }
    return false;
  }
  const input = el as HTMLInputElement;
  const numeric = input.inputMode === 'decimal' || input.type === 'number';
  const attempts = numeric ? ['0', '999999'] : [`${input.value} teste`];
  for (const attempt of attempts) {
    await act(async () => {
      setControl(input, attempt);
    });
    if (stampOf(host) !== before) return true;
  }
  return false;
}

async function openSection(host: HTMLElement, label: string) {
  const button = [...host.querySelectorAll('nav button')].find((node) => node.textContent?.includes(label));
  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('cartões de benefício', () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('mostra Não entra, liga o cartão ao digitar e trava o quadro no RH', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const preset = storePresets().find((item) => item.id === 'loja-2m');
    if (!preset) throw new Error('preset ausente');
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<App initialInputs={structuredClone(preset.inputs)} />);
    });
    await openSection(host, 'Logística');
    const cycles = host.querySelector('[data-field="logistics.boxes.cyclesAvoidedPerMonth"] input') as HTMLInputElement;
    expect(cycles.disabled).toBe(false);
    expect(cycles.closest('.field')?.className).toContain('is-dormant');
    const boxes = cycles.closest('.benefit');
    expect(boxes?.querySelector('[data-testid="benefit-status"]')?.textContent).toMatch(/Não entra:/);
    await act(async () => {
      setControl(cycles, '12');
    });
    expect(boxes?.textContent).toContain('Ativo');
    expect(boxes?.querySelector('[data-testid="benefit-status"]')?.textContent).toMatch(/Processo logístico não validado/);
    const space = [...host.querySelectorAll('.benefit')].find((card) => card.textContent?.includes('Espaço físico'));
    expect(space?.textContent).toMatch(/Monetização da área/);
    expect(space?.textContent).toMatch(/Ocupação evitável|contrato de ocupação não muda/i);
    expect(space?.querySelector('[data-testid="benefit-status"]')?.textContent).toMatch(/Não entra:.*contrato/i);

    act(() => root?.unmount());
    const rhHost = document.createElement('div');
    document.body.appendChild(rhHost);
    const rhPreset = rhStorePresets().find((item) => item.id === 'loja-2m');
    if (!rhPreset) throw new Error('preset de RH ausente');
    root = createRoot(rhHost);
    await act(async () => {
      root?.render(
        <RhApp initial={{ inputs: structuredClone(rhPreset.inputs), roster: structuredClone(rhPreset.roster) }} />,
      );
    });
    await openSection(rhHost, 'Logística');
    const movement = [...rhHost.querySelectorAll('.benefit')].find((card) => card.textContent?.includes('Movimentação interna'));
    const hours = movement?.querySelector('input') as HTMLInputElement;
    expect(hours.disabled).toBe(true);
    expect(movement?.textContent).toMatch(/quadro de RH/i);
    await openSection(rhHost, 'Pessoas');
    expect(rhHost.querySelector('[data-testid="turnover-panel"]')?.textContent).toMatch(/Turnover evitado/);
    expect(rhHost.textContent).toMatch(/já está dentro do custo por substituição/);
    expect(rhHost.textContent).toMatch(/30/);
    const availabilityNote = rhHost.textContent ?? '';
    await openSection(rhHost, 'Investimento');
    expect(rhHost.textContent).toMatch(/Não altera este modelo/);
    expect(availabilityNote.length).toBeGreaterThan(0);
  });
});

describe('campos visíveis', () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('na raiz e no RH, todo campo habilitado mexe no resultado ou explica que não mexe', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const failures: string[] = [];
    const cases: Array<{ name: string; render: () => ReactNode }> = [];
    for (const preset of storePresets()) {
      cases.push({
        name: `raiz ${preset.id}`,
        render: () => <App initialInputs={structuredClone(preset.inputs)} />,
      });
    }
    for (const preset of rhStorePresets()) {
      if (preset.id === 'exemplo') continue;
      cases.push({
        name: `rh ${preset.id}`,
        render: () => (
          <RhApp initial={{ inputs: structuredClone(preset.inputs), roster: structuredClone(preset.roster) }} />
        ),
      });
    }

    async function fresh(render: () => ReactNode, section: string) {
      act(() => root?.unmount());
      document.body.innerHTML = '';
      const host = document.createElement('div');
      document.body.appendChild(host);
      root = createRoot(host);
      await act(async () => {
        root?.render(render());
      });
      await openSection(host, section);
      return host;
    }

    for (const item of cases) {
      for (const section of SECTIONS) {
        let host = await fresh(item.render, section);
        let index = 0;
        while (index < controls(host).length) {
          const field = controls(host)[index];
          index += 1;
          if (!field || marked(field)) continue;
          const changed = await poke(field, host);
          if (!changed) failures.push(`${item.name} · ${section} · ${labelOf(field)}`);
          else host = await fresh(item.render, section);
        }
      }
    }
    expect(failures).toEqual([]);
  }, 180_000);
});

describe('modelos de loja', () => {
  it('mantém o payback base da loja de R$ 2 milhões e mostra o efeito do contrato de espaço', () => {
    const preset = storePresets().find((item) => item.id === 'loja-2m');
    if (!preset) throw new Error('preset ausente');
    const base = evaluate(preset.inputs);
    expect(formatPayback(base.payback)).toBe('29,1 meses');
    expect(base.netInvestment).toBe(1_312_500);
    expect(base.steadyNet).toBeCloseTo(49_616, 0);
    const open = structuredClone(preset.inputs);
    open.logistics.space.contractUnchanged = false;
    const withRent = evaluate(open);
    expect(withRent.steadyNet - base.steadyNet).toBeCloseTo(6_400, 0);
    expect(formatPayback(withRent.payback)).toBe('25,8 meses');

    const rh = rhStorePresets().find((item) => item.id === 'loja-2m');
    if (!rh) throw new Error('preset de RH ausente');
    const rhBase = evaluate(applyRoster(structuredClone(rh.inputs), rh.roster));
    expect(formatPayback(rhBase.payback)).toBe('33,3 meses');
    expect(rhBase.netInvestment).toBe(1_307_500);
    const rhOpen = applyRoster(structuredClone(rh.inputs), rh.roster);
    rhOpen.logistics.space.contractUnchanged = false;
    const rhRent = evaluate(rhOpen);
    expect(rhRent.steadyNet - rhBase.steadyNet).toBeCloseTo(6_400, 0);
    expect(formatPayback(rhRent.payback)).toBe('29,0 meses');
  });

  it('zera caixas e vendas que não entram e deixa a ocupação evitável com contrato parado', () => {
    for (const preset of storePresets()) {
      expect(preset.inputs.logistics.boxes.cyclesAvoidedPerMonth).toBe(0);
      expect(preset.inputs.logistics.boxes.costPerCycle).toBe(0);
      expect(preset.inputs.logistics.boxes.enabled).toBe(false);
      expect(preset.inputs.stock.ruptures.additionalMonthlySales).toBe(0);
      expect(preset.inputs.stock.serviceSpeed.additionalMonthlySales).toBe(0);
      expect(preset.inputs.people.consultativeSales.hoursFreedPerMonth).toBe(0);
      expect(preset.inputs.logistics.space.treatment).toBe('ocupacao_evitavel');
      expect(preset.inputs.logistics.space.contractUnchanged).toBe(true);
      const space = evaluate(preset.inputs).audit.find((line) => line.id === 'spaceOccupancy');
      expect(space?.includedInCashFlow).toBe(false);
      expect(space?.reason).toMatch(/contrato de ocupação não muda/i);
    }
  });

  it('não move o payback do RH com disponibilidade parcial e move a raiz', () => {
    const rh = rhStorePresets().find((item) => item.id === 'loja-2m');
    if (!rh) throw new Error('preset de RH ausente');
    const rhInputs = applyRoster(structuredClone(rh.inputs), rh.roster);
    const rhBase = evaluate(rhInputs);
    const rhPartial = structuredClone(rhInputs);
    rhPartial.robot.availabilityPct = 0.9;
    const rhPartialResult = evaluate(rhPartial);
    expect(partialAvailabilityMatters(rhPartialResult)).toBe(false);
    expect(rhPartialResult.payback).toBeCloseTo(rhBase.payback ?? 0, 6);
    expect(rhPartialResult.steadyNet).toBeCloseTo(rhBase.steadyNet, 2);
    const rhZero = structuredClone(rhInputs);
    rhZero.robot.availabilityPct = 0;
    expect(evaluate(rhZero).steadyNet).toBeLessThan(rhBase.steadyNet);

    const root = storePresets().find((item) => item.id === 'loja-2m');
    if (!root) throw new Error('preset ausente');
    const rootBase = evaluate(root.inputs);
    const rootPartial = structuredClone(root.inputs);
    rootPartial.robot.availabilityPct = 0.9;
    const rootPartialResult = evaluate(rootPartial);
    expect(partialAvailabilityMatters(rootPartialResult)).toBe(true);
    expect(rootPartialResult.payback).not.toBeCloseTo(rootBase.payback ?? 0, 2);
    expect(formatPayback(rootBase.payback)).toBe('29,1 meses');
    expect(formatPayback(rootPartialResult.payback)).toBe('29,2 meses');
  });
});
