import { formatBRL } from '../model/format';
import { buildMonthTable, type MonthTable } from '../model/monthTable';
import {
  CSV_BOM,
  monthTableColumns,
  monthTableCsv,
  monthTableFilename,
  type MonthTableColumn,
} from '../model/monthTableCsv';
import type { ModelResult } from '../model/types';

type Column = MonthTableColumn;

export { monthTableColumns };

function cell(value: number, key: Column['key']): string {
  if (key !== 'netFlow' && key !== 'cumulative' && Math.abs(value) < 0.005) return '—';
  return formatBRL(value);
}

export function MonthTableGrid({ table, variant }: { table: MonthTable; variant: 'screen' | 'print' }) {
  const columns = monthTableColumns(table);
  return (
    <table className={variant === 'print' ? 'print-flow month-table' : 'month-table'} data-testid={`month-table-${variant}`}>
      <thead>
        <tr>
          <th>Mês</th>
          {columns.map((column) => (
            <th key={column.key} className="num">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr
            key={row.month}
            className={row.isPayback ? 'is-payback' : undefined}
            data-testid={`month-row-${variant}-${row.month}`}
          >
            <td>
              {row.month}
              {row.isPayback ? <span className="payback-tag"> payback</span> : null}
            </td>
            {columns.map((column) => (
              <td
                key={column.key}
                className={`num${column.key === 'cumulative' ? (row.cumulative >= 0 ? ' good' : ' bad') : ''}`}
              >
                {cell(row[column.key], column.key)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Legend({ table }: { table: MonthTable }) {
  return (
    <p className="lede month-table-note">
      Valores em R$. Mês 0 é o investimento já descontados os créditos de impostos recuperáveis. Economia de mão de obra
      soma folha, contratações evitadas, turnover, supervisão e horas realocadas. Redução de perdas soma perdas de
      estoque e quebra evitadas.
      {table.hasOtherBenefits ? ' Outros ganhos reúne logística, área, caixas, contagem e vendas.' : ''}
      {table.hasTaxes ? ' Impostos é o imposto sobre o resultado incremental.' : ''}
      {table.hasOneTimeEvents ? ' Eventos pontuais reúne rescisão, capital de giro, recrutamento e treinamento evitados e valor residual.' : ''}{' '}
      O fluxo do mês é a soma das colunas, e o saldo acumulado é o mesmo da aba Fluxo.
      {table.paybackMonth !== null ? ` A linha destacada (mês ${table.paybackMonth}) é onde o saldo vira positivo.` : ' O saldo não vira positivo no horizonte.'}
    </p>
  );
}

export function downloadMonthTableCsv(table: MonthTable, simulationName?: string | null): string {
  const filename = monthTableFilename(simulationName);
  const blob = new Blob([CSV_BOM + monthTableCsv(table)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return filename;
}

export function MonthByMonthTable({ result, simulationName }: { result: ModelResult; simulationName?: string | null }) {
  const table = buildMonthTable(result);
  return (
    <section className="card month-table-card" data-testid="month-table-card">
      <details>
        <summary>
          <h2>Tabela mês a mês</h2>
        </summary>
        <Legend table={table} />
        <div className="month-table-actions no-print">
          <button
            type="button"
            className="btn ghost month-table-export"
            data-testid="month-table-export"
            onClick={() => downloadMonthTableCsv(table, simulationName)}
          >
            Exportar CSV
          </button>
        </div>
        <div className="table-wrap tall">
          <MonthTableGrid table={table} variant="screen" />
        </div>
      </details>
    </section>
  );
}

export function MonthByMonthPrint({ result }: { result: ModelResult }) {
  const table = buildMonthTable(result);
  return (
    <section className="print-chapter" data-testid="print-month-table">
      <h2>Tabela mês a mês</h2>
      <p className="print-note">
        Valores em R$. Mês 0 é o investimento líquido dos créditos de impostos. O fluxo do mês é a soma das colunas.
        {table.paybackMonth !== null ? ` Payback no mês ${table.paybackMonth} (linha destacada).` : ''}
      </p>
      <MonthTableGrid table={table} variant="print" />
    </section>
  );
}
