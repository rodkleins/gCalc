/** @vitest-environment happy-dom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { evaluate } from '../model/calculate';
import { formatBRL } from '../model/format';
import { buildMonthTable } from '../model/monthTable';
import { monthTableCsv } from '../model/monthTableCsv';
import { rootDefaultStorePreset as defaultStorePreset } from '../model/rootPresets';
import RhApp from '../rh/RhApp';

// @ts-expect-error o teste lê o CSS no Node; o app não depende dos tipos de fs
import { readFileSync } from 'node:fs';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const clean = (value: string | null | undefined) => (value ?? '').replace(/\u00a0/g, ' ');

describe('tabela mês a mês na tela e na impressão', () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
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

  it('nos Resultados da raiz, fica num bloco fechado com as colunas pedidas e o payback destacado', async () => {
    const host = await mount(<App />);
    const card = host.querySelector('[data-testid="month-table-card"]');
    expect(card).not.toBeNull();
    const details = card?.querySelector('details');
    expect(details?.open).toBe(false);
    expect(card?.querySelector('summary')?.textContent).toBe('Tabela mês a mês');
    const headers = [...(card?.querySelectorAll('th') ?? [])].map((node) => node.textContent);
    for (const label of [
      'Mês',
      'Investimento',
      'Economia de mão de obra',
      'Redução de perdas',
      'Custos mensais do robô',
      'Fluxo líquido do mês',
      'Saldo acumulado',
    ]) {
      expect(headers).toContain(label);
    }
    const result = evaluate(defaultStorePreset().inputs);
    const table = buildMonthTable(result);
    const zero = host.querySelector('[data-testid="month-row-screen-0"]');
    expect(clean(zero?.textContent)).toContain(clean(formatBRL(-result.netInvestment)));
    expect(host.querySelector('[data-testid="month-row-screen-60"]')).not.toBeNull();
    const highlighted = host.querySelectorAll('[data-testid="month-table-screen"] tr.is-payback');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].getAttribute('data-testid')).toBe(`month-row-screen-${table.paybackMonth}`);
    const last = table.rows[table.rows.length - 1];
    expect(clean(host.querySelector('[data-testid="month-row-screen-60"]')?.textContent)).toContain(
      clean(formatBRL(last.cumulative)),
    );
  });

  it('entra no relatório completo da raiz e não no resumo', async () => {
    const host = await mount(<App />);
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-open"]')?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-choice-resumo"]')?.click();
    });
    expect(host.querySelector('[data-testid="print-month-table"]')).toBeNull();
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-close"]')?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-open"]')?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-choice-completo"]')?.click();
    });
    const section = host.querySelector('[data-testid="print-month-table"]');
    expect(section).not.toBeNull();
    expect(section?.querySelector('[data-testid="month-row-print-0"]')).not.toBeNull();
    expect(section?.querySelector('[data-testid="month-row-print-60"]')).not.toBeNull();
    expect(section?.querySelectorAll('tr.is-payback')).toHaveLength(1);
  });

  it('não aparece em /rh/', async () => {
    const host = await mount(<RhApp />);
    expect(host.querySelector('[data-testid="month-table-card"]')).toBeNull();
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-open"]')?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-choice-completo"]')?.click();
    });
    expect(host.querySelector('[data-testid="print-month-table"]')).toBeNull();
  });

  it('o botão Exportar CSV baixa as colunas visíveis com BOM e o nome da simulação', async () => {
    const host = await mount(<App />);
    const blobs: Blob[] = [];
    const created = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:tabela';
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: created });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    const button = host.querySelector<HTMLButtonElement>('[data-testid="month-table-card"] details [data-testid="month-table-export"]');
    expect(button?.textContent).toBe('Exportar CSV');
    expect(button?.closest('.no-print')).not.toBeNull();
    await act(async () => {
      button?.click();
    });
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^tabela-mes-a-mes-simulacao-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(blobs[0].type).toContain('text/csv');
    const bytes = new Uint8Array(await blobs[0].arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    const table = buildMonthTable(evaluate(defaultStorePreset().inputs));
    expect(text).toBe('\uFEFF' + monthTableCsv(table));
    const visible = [...host.querySelectorAll('[data-testid="month-table-screen"] thead th')].map((node) => node.textContent);
    expect(text.slice(1).split('\r\n')[0]).toBe([...visible, 'Payback'].join(';'));
  });

  it('o CSS de impressão esconde o botão de exportar', () => {
    const css = readFileSync('src/components/print.css', 'utf8');
    expect(css).toMatch(/@media print \{[\s\S]*\.month-table-export \{ display: none !important; \}/);
  });
});
