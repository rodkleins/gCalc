import { evaluate } from '../model/calculate';
import { formatBRL, formatPayback, formatPercent } from '../model/format';
import { storePresets, type StorePreset } from '../model/presets';

export function StoreSizePicker({ onLoad }: { onLoad: (preset: StorePreset) => void }) {
  const presets = storePresets();
  return (
    <div className="store-size" data-testid="store-presets" role="group" aria-label="Porte da loja">
      <span className="store-size-label">Porte da loja</span>
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="btn"
          data-testid={`preset-${preset.id}`}
          onClick={() => onLoad(preset)}
        >
          {preset.name.replace('Loja de ', '')}
        </button>
      ))}
    </div>
  );
}

export function StorePresets({ onLoad }: { onLoad: (preset: StorePreset) => void }) {
  const presets = storePresets();
  const rows = presets.map((preset) => ({ preset, result: evaluate(preset.inputs) }));

  return (
    <section className="card" data-testid="store-preset-table">
      <h2>Três portes de loja</h2>
      <p className="lede">
        Modelos fictícios de R$ 1, 2 e 4 milhões de faturamento mensal, prontos para os parâmetros reais. O investimento
        do robô não é uma porcentagem do faturamento. A área liberada está registrada e ainda não vira aluguel.
      </p>
      <div className="preset-actions">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="btn"
            data-testid={`preset-table-${preset.id}`}
            onClick={() => onLoad(preset)}
          >
            Carregar {preset.name.replace('Loja de ', '')}
          </button>
        ))}
      </div>
      <div className="table-wrap short">
        <table>
          <thead>
            <tr>
              <th>Indicador</th>
              {rows.map((row) => (
                <th key={row.preset.id} className="num">
                  {row.preset.name.replace('Loja de ', '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Faturamento</td>
              {rows.map((row) => (
                <td key={row.preset.id} className="num">
                  {formatBRL(row.preset.revenue)}
                </td>
              ))}
            </tr>
            <tr>
              <td>Dispensações/dia</td>
              {rows.map((row) => (
                <td key={row.preset.id} className="num">
                  {row.preset.inputs.profile.dispensationsPerDay}
                </td>
              ))}
            </tr>
            <tr>
              <td>Equipe</td>
              {rows.map((row) => (
                <td key={row.preset.id} className="num">
                  {row.preset.inputs.profile.roles.reduce((total, role) => total + role.headcount, 0)} pessoas
                </td>
              ))}
            </tr>
            <tr>
              <td>Área liberada</td>
              {rows.map((row) => (
                <td key={row.preset.id} className="num">
                  {row.preset.inputs.logistics.space.m2Freed} m²
                </td>
              ))}
            </tr>
            <tr>
              <td>Investimento do robô</td>
              {rows.map((row) => (
                <td key={row.preset.id} className="num">
                  {formatBRL(row.result.netInvestment)}
                </td>
              ))}
            </tr>
            <tr>
              <td>Sobra mensal</td>
              {rows.map((row) => (
                <td key={row.preset.id} className="num">
                  {formatBRL(row.result.steadyNet)}
                </td>
              ))}
            </tr>
            <tr>
              <td>Payback</td>
              {rows.map((row) => (
                <td key={row.preset.id} className="num">
                  {formatPayback(row.result.payback)}
                </td>
              ))}
            </tr>
            <tr>
              <td>ROI estabilizado</td>
              {rows.map((row) => (
                <td key={row.preset.id} className="num">
                  {formatPercent(row.result.roi)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
