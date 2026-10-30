import type { MonthTable, MonthTableRow } from './monthTable';

export type MonthTableColumnKey =
  | 'investment'
  | 'laborSavings'
  | 'lossReduction'
  | 'otherBenefits'
  | 'robotCosts'
  | 'taxes'
  | 'oneTimeEvents'
  | 'netFlow'
  | 'cumulative';

export type MonthTableColumn = { key: MonthTableColumnKey; label: string };

/** Colunas visíveis da tabela mês a mês. As extras só entram quando têm valor. */
export function monthTableColumns(table: MonthTable): MonthTableColumn[] {
  const columns: Array<MonthTableColumn | null> = [
    { key: 'investment', label: 'Investimento' },
    { key: 'laborSavings', label: 'Economia de mão de obra' },
    { key: 'lossReduction', label: 'Redução de perdas' },
    table.hasOtherBenefits ? { key: 'otherBenefits', label: 'Outros ganhos' } : null,
    { key: 'robotCosts', label: 'Custos mensais do robô' },
    table.hasTaxes ? { key: 'taxes', label: 'Impostos' } : null,
    table.hasOneTimeEvents ? { key: 'oneTimeEvents', label: 'Eventos pontuais' } : null,
    { key: 'netFlow', label: 'Fluxo líquido do mês' },
    { key: 'cumulative', label: 'Saldo acumulado' },
  ];
  return columns.filter((column): column is MonthTableColumn => column !== null);
}

/** Número para o Excel em pt-BR: vírgula decimal, duas casas, sem R$ e sem separador de milhar. */
export function csvNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  const fixed = (Math.round(value * 100) / 100).toFixed(2);
  const normalized = fixed === '-0.00' ? '0.00' : fixed;
  return normalized.replace('.', ',');
}

function csvText(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const CSV_BOM = '\uFEFF';

/** CSV com ';', CRLF e cabeçalho. Não inclui o BOM: ele entra no download. */
export function monthTableCsv(table: MonthTable): string {
  const columns = monthTableColumns(table);
  const header = ['Mês', ...columns.map((column) => column.label), 'Payback'];
  const line = (row: MonthTableRow) => [
    String(row.month),
    ...columns.map((column) => csvNumber(row[column.key])),
    row.isPayback ? 'Sim' : '',
  ];
  return [header, ...table.rows.map(line)].map((cells) => cells.map(csvText).join(';')).join('\r\n') + '\r\n';
}

export function slugify(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

function isoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthTableFilename(simulationName: string | null | undefined, date = new Date()): string {
  const slug = slugify(simulationName ?? '') || 'simulacao';
  return `tabela-mes-a-mes-${slug}-${isoDate(date)}.csv`;
}
