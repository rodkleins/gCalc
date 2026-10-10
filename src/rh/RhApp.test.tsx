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
    expect(host.querySelector('[data-testid="kpi-payback"]')?.textContent).toContain(
      formatPayback(rhScorecard()[3].cells[1].payback),
    );
    const pessoas = [...host.querySelectorAll('.nav-label')].find((node) => node.textContent === 'Pessoas');
    await act(async () => {
      pessoas?.closest('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.querySelector('[data-testid="roster-summary"]')?.textContent).toContain('Turno da noite');
    expect(host.querySelector('[data-testid="shift-count-3"]')?.classList.contains('is-active')).toBe(true);
    expect(host.querySelector('[data-testid="post-coverage-aux-noite-1"]')?.textContent).toContain('2 × 365 / (365 − 30 − 6)');
    expect(host.querySelector('[data-testid="post-coverage-aux-noite-1"]')?.textContent).toContain('2,2188');
    expect(host.querySelector('[data-testid="post-coverage-aux-1"]')?.textContent).toContain('7/6');
    const nightFactor = host.querySelector<HTMLInputElement>('[data-testid="post-factor-aux-noite-1"]');
    const dayFactor = host.querySelector<HTMLInputElement>('[data-testid="post-factor-aux-1"]');
    expect(nightFactor?.readOnly).toBe(true);
    expect(nightFactor?.value).toBe('2,2188');
    expect(dayFactor?.readOnly).toBe(true);
    expect(dayFactor?.value).toBe('1,2943');
    const advanced = host.querySelector('[data-testid="post-override-advanced-aux-noite-1"]');
    expect(advanced?.tagName).toBe('DETAILS');
    expect(advanced?.hasAttribute('open')).toBe(false);
    expect(advanced?.textContent).toContain('substitui o cálculo');
    expect(host.querySelector<HTMLInputElement>('[data-testid="vacation-days"]')?.readOnly).toBe(false);
    expect(host.querySelector<HTMLInputElement>('[data-testid="absence-days"]')?.readOnly).toBe(false);
    expect(host.textContent).not.toContain('Fator de cobertura manual');
    expect(host.querySelector('[data-testid="roster-summary"]')?.textContent).not.toContain('328.571');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('exporta o JSON da simulação atual em Simulações e em Mais ações, sem a alavanca de mão de obra', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<RhApp />);
    });
    expect(host.querySelector('[data-testid="quick-salarios-slider"]')).toBeNull();
    expect(host.querySelector('[data-testid="quick-investimento-slider"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="quick-opex-slider"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="quick-turnover-slider"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="quick-volume-slider"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="quick-vendas-slider"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="quick-desconto-slider"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="quick-disponibilidade-slider"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="quick-cobertura-slider"]')).not.toBeNull();

    const downloads: string[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() {
      if (this.download) downloads.push(this.download);
    };
    try {
      await act(async () => {
        host.querySelector<HTMLButtonElement>('[data-testid="more-actions"]')?.click();
      });
      expect(host.querySelector('[data-testid="export-json"]')?.textContent).toBe('Exportar JSON');
      expect(host.querySelector('[data-testid="import-json"]')?.textContent).toBe('Importar JSON');
      await act(async () => {
        host.querySelector<HTMLButtonElement>('[data-testid="export-json"]')?.click();
      });
      expect(downloads).toContain('gcalc-rh-simulacao.json');

      const simulacoes = [...host.querySelectorAll('.nav-label')].find((node) => node.textContent === 'Simulações');
      await act(async () => {
        simulacoes?.closest('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(host.querySelector('[data-testid="export-current"]')?.textContent).toBe('Exportar JSON');
      expect(host.querySelector('[data-testid="export-current"]')?.className).toContain('primary');
      expect(host.querySelector('[data-testid="import-json"]')?.textContent).toContain('Importar JSON');
      expect(host.querySelector('[data-testid="export-library"]')?.textContent).toBe('Exportar biblioteca');
      await act(async () => {
        host.querySelector<HTMLButtonElement>('[data-testid="export-current"]')?.click();
      });
      expect(downloads.filter((name) => name === 'gcalc-rh-simulacao.json')).toHaveLength(2);
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
  });
});

function controlsMissingHelp(host: ParentNode): string[] {
  return [...host.querySelectorAll('input, select, textarea, button[role="switch"]')].flatMap((control) => {
    if (!(control instanceof HTMLElement)) return [];
    if (control.getAttribute('type') === 'hidden') return [];
    const help = control.getAttribute('data-field-help')?.trim() ?? '';
    if (help.length >= 12) return [];
    const name =
      control.getAttribute('data-testid') ??
      control.getAttribute('aria-label') ??
      control.closest('label')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 90) ??
      control.tagName;
    return [name];
  });
}

async function openSection(host: HTMLElement, label: string) {
  const item = [...host.querySelectorAll('.nav-label')].find((node) => node.textContent === label);
  await act(async () => {
    item?.closest('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('ajuda dos campos', () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('falha se algum campo de entrada não tiver descrição', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<RhApp />);
    });
    const missing = new Set<string>();
    const collect = () => {
      for (const name of controlsMissingHelp(host)) missing.add(name);
    };
    collect();
    for (const label of ['Perfil', 'Pessoas', 'Logística', 'Estoque', 'Investimento', 'Cenários', 'Sensibilidade', 'Fluxo', 'Auditoria', 'Simulações', 'Resultados']) {
      await openSection(host, label);
      if (label === 'Perfil') {
        const addStore = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Adicionar loja');
        await act(async () => {
          addStore?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
      }
      if (label === 'Simulações') {
        const save = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Salvar simulação');
        await act(async () => {
          save?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          save?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        const rename = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Renomear');
        await act(async () => {
          rename?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
      }
      collect();
    }
    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="open-wizard"]')?.click();
    });
    for (let step = 0; step < 8; step += 1) {
      collect();
      const next = host.querySelector<HTMLButtonElement>('[data-testid="wizard-next"]');
      if (!next) break;
      await act(async () => {
        next.click();
      });
    }
    expect([...missing]).toEqual([]);
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
    expect(text).toContain('1,2943');
    expect(text).toContain('2,2188');
    expect(text).not.toContain('6,6063');
    expect(host.querySelector('[data-testid="rh-back-to-current"]')?.getAttribute('href')).toBe('/gCalc/');
    expect(host.querySelector('[data-testid="score-exemplo-base"]')?.textContent).toContain('Não recupera em 60 meses');
    expect(formatPayback(rhScorecard()[3].cells[1].payback)).not.toBe('14,7 meses');
    expect(host.querySelector('[data-testid="score-loja-4m-base"]')?.textContent).toContain(
      formatPayback(rhScorecard()[3].cells[1].payback),
    );
    expect(host.querySelector('[data-testid="score-loja-1m-base"]')?.textContent?.replace(/\u00a0/g, ' ')).toContain(
      'R$ 1.235.000',
    );
  });
});
