import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SENSITIVITY_DELTAS, sensitivity } from '../model/calculate';
import { formatBRL, formatPayback, formatPercent } from '../model/format';
import type { Inputs, ScenarioId, SensitivityDriver } from '../model/types';

const DRIVERS: Array<{ id: SensitivityDriver; label: string; note: string }> = [
  { id: 'investimento', label: 'Investimento', note: 'CAPEX bruto e prateleira evitada' },
  { id: 'opex', label: 'OPEX', note: 'Custo mensal do robô' },
  { id: 'maoDeObra', label: 'Mão de obra', note: 'O mesmo percentual do ajuste rápido' },
  { id: 'turnover', label: 'Turnover', note: 'Taxa anual de substituição' },
  { id: 'vendas', label: 'Vendas', note: 'Margens incrementais' },
  { id: 'volume', label: 'Volume', note: 'Dispensações, perdas, avarias, caixas e movimento' },
  { id: 'desconto', label: 'Desconto', note: 'Taxa do VPL' },
  { id: 'disponibilidade', label: 'Disponibilidade', note: 'Operação do robô' },
  { id: 'cobertura', label: 'Cobertura', note: 'Estoque automatizado' },
];

export function SensitivityPanel({ inputs, scenario }: { inputs: Inputs; scenario: ScenarioId }) {
  const table = sensitivity(inputs, scenario);
  const [driver, setDriver] = useState<SensitivityDriver>('investimento');
  const chart = table[driver].map((point) => ({
    delta: `${point.delta > 0 ? '+' : ''}${Math.round(point.delta * 100)}%`,
    payback: point.payback,
    vpl: point.npv,
  }));
  const salesFlat = table.vendas.every((point) => point.steadyNet === table.vendas[2]?.steadyNet);

  return (
    <div className="stack">
      <p className="lede">
        Cada linha varia um único driver em torno do cenário {scenario}, de −30% a +30%. Os outros permanecem como estão.
      </p>
      {salesFlat ? (
        <p className="lede">
          A linha de vendas está estável porque nenhuma margem incremental entrou no fluxo. Ative uma alavanca com
          evidência para ver o efeito.
        </p>
      ) : null}
      <div className="seg wrap">
        {DRIVERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === driver ? 'is-active' : ''}
            onClick={() => setDriver(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section className="card chart-card">
        <h2>Payback quando {DRIVERS.find((item) => item.id === driver)?.label.toLowerCase()} varia</h2>
        <div className="plot">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
              <CartesianGrid stroke="#eadfce" />
              <XAxis dataKey="delta" stroke="#6d756e" />
              <YAxis stroke="#6d756e" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="payback" name="Payback (meses)" stroke="#14352f" strokeWidth={2.4} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Driver</th>
              {SENSITIVITY_DELTAS.map((delta) => (
                <th key={delta} className="num">
                  {delta > 0 ? '+' : ''}
                  {Math.round(delta * 100)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DRIVERS.map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.label}</b>
                  <small className="cell-note">{item.note}</small>
                </td>
                {table[item.id].map((point) => (
                  <td key={point.delta} className="num">
                    {formatPayback(point.payback)}
                    <small className="cell-note">
                      {formatPercent(point.roi)} · {formatBRL(point.npv)}
                    </small>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
