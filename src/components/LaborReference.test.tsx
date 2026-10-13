/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { formatNumber } from '../model/format';
import { defaultStorePreset } from '../model/presets';
import { applyRoster } from '../rh/roster';
import { rhDefaultPreset } from '../rh/presets';
import { VacanciesReference } from './LaborReference';

describe('bloco de vagas evitadas', () => {
  let root: Root | null = null;
  afterEach(() => {
    root?.unmount();
    root = null;
  });

  it('na loja de R$ 2 milhões usa duas casas e omite o fator da escala', async () => {
    const host = document.createElement('div');
    root = createRoot(host);
    await act(async () => {
      root?.render(<VacanciesReference inputs={defaultStorePreset().inputs} />);
    });
    const block = host.querySelector('[data-testid="vacancies-reference"]');
    expect(block?.querySelector('h2')?.textContent).toBe('Vagas evitadas: 6,00 pessoas');
    expect(block?.textContent).toContain('Este é o número usado no cálculo da economia com folha.');
    expect(block?.querySelector('h4')?.textContent).toBe('Referência de mercado');
    expect(block?.querySelector('[data-testid="labor-reference"]')?.textContent).toContain('1.700 unidades por dia');
    expect(block?.querySelector('[data-testid="labor-reference"]')?.textContent).toContain('850 horas de trabalho por mês');
    expect(block?.querySelector('[data-testid="labor-reference"]')?.textContent).toContain('4,83 pessoas na jornada de 176 horas');
    expect(block?.querySelector('[data-testid="labor-reference"]')?.textContent).toContain('6,25 pessoas contando folgas e férias');
    expect(block?.textContent).not.toMatch(/1,2943|6x1/);
  });

  it('no quadro de RH acompanha as vagas da simulação', async () => {
    const host = document.createElement('div');
    root = createRoot(host);
    const preset = rhDefaultPreset();
    const inputs = applyRoster(structuredClone(preset.inputs), preset.roster);
    await act(async () => {
      root?.render(<VacanciesReference inputs={inputs} titleTag="h3" />);
    });
    const title = host.querySelector('[data-testid="vacancies-reference"] h3')?.textContent;
    expect(title).toBe(`Vagas evitadas: ${formatNumber(inputs.people.payroll.positionsReduced, 2)} pessoas`);
    expect(host.textContent).toContain('Referência de mercado');
    expect(host.textContent).not.toMatch(/1,2943|6x1/);
  });
});
