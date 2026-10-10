import { summarizeRoster } from './roster';
import { formatBRL, formatNumber } from '../model/format';
import type { RhPreset } from './presets';

function peopleLabel(value: number): string {
  return formatNumber(value, Number.isInteger(value) ? 0 : 1);
}

export function RhPresetPanel({ presets, onLoad }: { presets: RhPreset[]; onLoad: (preset: RhPreset) => void }) {
  return (
    <section className="card" data-testid="rh-preset-table">
      <h2>Três portes com quadro por turno</h2>
      <p className="lede">
        Modelos fictícios. O equipamento fica em R$ 1.000.000 ou mais e o custo mensal do robô fica entre R$ 5.000 e R$
        6.000. A loja de R$ 4 milhões tem 3 turnos. O turno da noite usa escala 12x36, então o folguista dessa escala pesa
        na folha e na vaga evitada.
      </p>
      <div className="preset-actions">
        {presets.map((preset) => (
          <button key={preset.id} type="button" className="btn" data-testid={`preset-table-${preset.id}`} onClick={() => onLoad(preset)}>
            Carregar {preset.name.replace('Loja de ', '')}
          </button>
        ))}
      </div>
      <div className="table-wrap short">
        <table>
          <thead>
            <tr>
              <th>Quadro</th>
              {presets.map((preset) => (
                <th key={preset.id} className="num">
                  {preset.name.replace('Loja de ', '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Turnos</td>
              {presets.map((preset) => (
                <td key={preset.id} className="num">
                  {preset.roster.shiftCount === 3 ? '3 (24h)' : '2'}
                </td>
              ))}
            </tr>
            <tr>
              <td>Pessoas no turno</td>
              {presets.map((preset) => {
                const summary = summarizeRoster(preset.roster);
                return (
                  <td key={preset.id} className="num">
                    {summary.shifts.map((shift) => peopleLabel(shift.present)).join(' + ')}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td>Folha do mês</td>
              {presets.map((preset) => (
                <td key={preset.id} className="num">
                  {formatBRL(summarizeRoster(preset.roster).payroll)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RhStorePicker({ presets, onLoad }: { presets: RhPreset[]; onLoad: (preset: RhPreset) => void }) {
  return (
    <div className="store-size" data-testid="store-presets" role="group" aria-label="Porte da loja">
      <span className="store-size-label">Porte da loja</span>
      {presets.map((preset) => (
        <button key={preset.id} type="button" className="btn" data-testid={`preset-${preset.id}`} onClick={() => onLoad(preset)}>
          {preset.name.replace('Loja de ', '')}
        </button>
      ))}
    </div>
  );
}
