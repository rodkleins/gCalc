import { describe, expect, it } from 'vitest';
import { evaluate } from './calculate';
import { buildMonthTable } from './monthTable';
import { csvNumber, monthTableColumns, monthTableCsv, monthTableFilename, slugify } from './monthTableCsv';
import { defaultStorePreset } from './presets';

describe('CSV da tabela mês a mês', () => {
  const table = buildMonthTable(evaluate(defaultStorePreset().inputs));

  it('formata números em pt-BR sem R$ e sem milhar', () => {
    expect(csvNumber(-1312500)).toBe('-1312500,00');
    expect(csvNumber(45180.5)).toBe('45180,50');
    expect(csvNumber(0)).toBe('0,00');
    expect(csvNumber(-0.001)).toBe('0,00');
    expect(csvNumber(1234.567)).toBe('1234,57');
  });

  it('tem cabeçalho com as colunas visíveis, ";" e uma linha por mês', () => {
    const csv = monthTableCsv(table);
    expect(csv.startsWith('\uFEFF')).toBe(false);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(table.rows.length + 1);
    const labels = monthTableColumns(table).map((column) => column.label);
    expect(lines[0]).toBe(['Mês', ...labels, 'Payback'].join(';'));
    for (const line of lines) expect(line.split(';')).toHaveLength(labels.length + 2);
    expect(lines[1].split(';')[1]).toBe('-1312500,00');
    expect(csv).not.toContain('R$');
    expect(csv).not.toMatch(/\d\.\d/);
  });

  it('marca só a linha do payback e fecha com o saldo da tabela', () => {
    const lines = monthTableCsv(table).trimEnd().split('\r\n').slice(1);
    const marked = lines.filter((line) => line.endsWith(';Sim'));
    expect(marked).toHaveLength(1);
    expect(marked[0].split(';')[0]).toBe(String(table.paybackMonth));
    const last = lines[lines.length - 1].split(';');
    expect(last[last.length - 2]).toBe(csvNumber(table.rows[table.rows.length - 1].cumulative));
  });

  it('monta o nome do arquivo com a simulação ou "simulacao" e a data', () => {
    const date = new Date(2026, 9, 30, 15, 0);
    expect(monthTableFilename('Loja Centro – São Paulo', date)).toBe('tabela-mes-a-mes-loja-centro-sao-paulo-2026-10-30.csv');
    expect(monthTableFilename(null, date)).toBe('tabela-mes-a-mes-simulacao-2026-10-30.csv');
    expect(monthTableFilename('   ', date)).toBe('tabela-mes-a-mes-simulacao-2026-10-30.csv');
    expect(slugify('Ação/Teste')).toBe('acao-teste');
  });
});
