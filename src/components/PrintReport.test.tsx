/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import { evaluate } from '../model/calculate';
import { exampleInputs } from '../model/example';
import RhApp from '../rh/RhApp';
import { PrintReport } from './PrintReport';

// @ts-expect-error o teste lê o CSS no Node; o app não depende dos tipos de fs
import { readFileSync } from 'node:fs';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('relatório de impressão', () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('o CSS de impressão é A4 retrato, sem a interface, com rodapé e página', () => {
    const css = readFileSync('src/components/print.css', 'utf8');
    expect(css).toContain('@media print');
    expect(css).toContain('size: A4 portrait');
    expect(css).toContain('counter(page)');
    expect(css).toContain('Premissas a validar');
    expect(css).toContain('.main > *:not(.print-host)');
    expect(css).toContain('.print-toolbar');
    expect(css).toContain('.quick-dock { display: none !important; }');
    const screen = readFileSync('src/styles.css', 'utf8');
    expect(screen).toContain('@media (max-width: 1439px)');
    expect(screen).toMatch(/@media \(max-width: 1439px\) \{[\s\S]*\.quick-dock \{[\s\S]*position: sticky;/);
    expect(screen).toMatch(/@media \(max-width: 1099px\) \{[\s\S]*\.quick-dock \{ top: 76px; \}/);
  });

  it('abre o diálogo e monta o resumo sem fluxo de 60 meses nem quadro de RH', async () => {
    window.print = () => undefined;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const inputs = exampleInputs();
    await act(async () => {
      root?.render(<PrintReport inputs={inputs} result={evaluate(inputs)} scenario="base" edition="raiz" />);
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-open"]')?.click();
    });
    expect(host.querySelector('[data-testid="print-choice-resumo"]')?.textContent).toContain('Resumo executivo');
    expect(host.querySelector('[data-testid="print-choice-completo"]')?.textContent).toContain('60 meses');
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-choice-resumo"]')?.click();
    });
    const sheet = host.querySelector('[data-testid="print-sheet"]');
    expect(sheet?.getAttribute('data-print-kind')).toBe('resumo');
    expect(sheet?.textContent).toContain('Rede Aurora (fictícia)');
    expect(sheet?.textContent).toContain('Farmácia Aurora — Unidade Centro');
    expect(sheet?.textContent).toContain('Base');
    expect(sheet?.textContent).toContain('Payback');
    expect(sheet?.textContent).toContain('50,3 meses');
    expect(host.querySelector('[data-testid="print-calc-memory"]')).toBeNull();
    expect(host.querySelector('[data-testid="print-tax-credit"]')?.textContent).toContain('Comprovável, mês 0');
    expect(host.querySelector('[data-testid="print-potential-gain"]')).toBeNull();
    expect(host.querySelector('[data-testid="print-tax-credit"]')?.textContent).toContain('250.000');
    expect(host.querySelector('[data-testid="print-main-premises"]')?.textContent).toContain('Créditos recuperáveis');
    expect(host.querySelector('[data-testid="print-chart-cash"] svg')).not.toBeNull();
    expect(host.querySelector('[data-testid="print-chart-benefits"] svg')).not.toBeNull();
    expect(host.querySelector('[data-testid="print-benefit-cost"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="print-main-premises"]')?.textContent).toContain('Equipamento');
    expect(host.querySelector('[data-testid="print-cashflow"]')).toBeNull();
    expect(host.querySelector('[data-testid="print-roster"]')).toBeNull();
    expect(sheet?.querySelector('img')).toBeNull();
    expect(sheet?.textContent).toContain('Premissas a validar');
  });

  it('na raiz, Resultados oferece o completo com os 60 meses e sem a tabela de turno', async () => {
    window.print = () => undefined;
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<App initialInputs={exampleInputs()} />);
    });
    expect(host.querySelector('[data-testid="print-open"]')?.textContent).toBe('Imprimir');
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-open"]')?.click();
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-choice-completo"]')?.click();
    });
    expect(host.querySelector('[data-testid="print-modules"]')?.textContent).toContain('Pessoas');
    expect(host.querySelector('[data-testid="print-parameters"]')?.textContent).toContain('Equipamento');
    expect(host.querySelector('[data-testid="print-month-60"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="print-month-1"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="print-roster"]')).toBeNull();
    expect(host.querySelector('[data-testid="print-calc-memory"]')?.textContent).toMatch(/não considerado/i);
    expect(host.querySelector('[data-testid="print-calc-memory"]')?.textContent).toContain('Investimento líquido');
    expect(host.querySelector('[data-testid="print-sheet"] img')).toBeNull();
    expect(host.querySelector('[data-testid="print-calc-memory"]')?.textContent).toContain('Referência de mercado');
    expect(host.querySelector('[data-testid="print-calc-memory"]')?.textContent).toContain('não soma ao resultado');
    expect(host.querySelector('[data-testid="print-calc-memory"]')?.textContent).not.toContain('1,2943');
    expect(host.querySelector('[data-testid="print-calc-memory"]')?.textContent).not.toContain('6x1');
    expect(host.querySelector('[data-testid="print-potential-gain"]')).toBeNull();
  });

  it('mostra o ganho potencial no resumo e no completo quando há valor fora do caixa', async () => {
    window.print = () => undefined;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const inputs = exampleInputs();
    inputs.logistics.boxes.enabled = true;
    inputs.logistics.boxes.confidence = 'potencial';
    inputs.logistics.boxes.processValidated = true;
    inputs.logistics.boxes.cyclesAvoidedPerMonth = 400;
    inputs.logistics.boxes.costPerCycle = 8;
    const result = evaluate(inputs);
    await act(async () => {
      root?.render(<PrintReport inputs={inputs} result={result} scenario="base" edition="raiz" />);
    });
    for (const choice of ['print-choice-resumo', 'print-choice-completo']) {
      await act(async () => {
        host.querySelector<HTMLButtonElement>('[data-testid="print-open"]')?.click();
      });
      await act(async () => {
        host.querySelector<HTMLButtonElement>(`[data-testid="${choice}"]`)?.click();
      });
      const section = host.querySelector('[data-testid="print-potential-gain"]');
      expect(section?.textContent).toContain('Ganho potencial (não incluído)');
      expect(section?.textContent).toContain('Caixas retornáveis');
      expect(section?.textContent).toContain('Soma mensal');
      expect(section?.textContent).toMatch(/payback/i);
      expect(section?.textContent).toContain('ROI');
      await act(async () => {
        host.querySelector<HTMLButtonElement>('[data-testid="print-close"]')?.click();
      });
    }
  });

  it('em /rh/, o completo inclui o quadro cargo x turno e o fluxo', async () => {
    window.print = () => undefined;
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<RhApp />);
    });
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-open"]')?.click();
    });
    expect(host.querySelector('[data-testid="print-choice-completo"]')?.textContent).toContain('cargo por turno');
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-choice-completo"]')?.click();
    });
    const roster = host.querySelector('[data-testid="print-roster"]');
    expect(roster?.textContent).toContain('Auxiliar de farmácia');
    expect(roster?.textContent).toContain('Folguista');
    expect(roster?.textContent).toContain('1,2943');
    expect(host.querySelector('[data-testid="print-month-60"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="print-sheet"] img')).toBeNull();
    const simulacoes = [...host.querySelectorAll('.nav-label')].find((node) => node.textContent === 'Simulações');
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="print-close"]')?.click();
    });
    await act(async () => {
      simulacoes?.closest('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="print-open"]')?.textContent).toBe('Imprimir');
  });
});
