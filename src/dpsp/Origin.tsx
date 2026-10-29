import { evaluate } from '../model/calculate';
import { formatBRL, formatNumber, formatPayback } from '../model/format';
import { MODEL_DISCLAIMER, type DpspPreset } from './stores';

export function DpspStorePicker({
  presets,
  selectedName,
  onLoad,
}: {
  presets: DpspPreset[];
  selectedName?: string;
  onLoad: (preset: DpspPreset) => void;
}) {
  return (
    <div className="store-size" data-testid="dpsp-presets" role="group" aria-label="Loja DPSP">
      <span className="store-size-label">Loja DPSP</span>
      {presets.map((preset) => {
        const selected = preset.name === selectedName;
        return (
          <button
            key={preset.id}
            type="button"
            className={selected ? 'btn is-active' : 'btn'}
            aria-pressed={selected}
            data-testid={`preset-${preset.id}`}
            onClick={() => onLoad(preset)}
          >
            {preset.name}
          </button>
        );
      })}
    </div>
  );
}

export function DpspOrigin({
  presets,
  onLoad,
}: {
  presets: DpspPreset[];
  onLoad: (preset: DpspPreset) => void;
}) {
  return (
    <section className="card" data-testid="dpsp-origin">
      <h2>O que veio da planilha e o que é premissa</h2>
      <p className="lede">
        A faixa de cima separa os dois. Faturamento = perdas mensais ÷ percentual de perda. SKUs, perdas, HC e
        balconistas também são da planilha. O ganho de gente é a redução de balconistas. Todo o resto continua editável
        e começa na loja de R$ 2 milhões.
      </p>
      <div className="table-wrap short">
        <table>
          <thead>
            <tr>
              <th>Planilha DPSP · 29/10/2026</th>
              {presets.map((preset) => (
                <th key={preset.id} className="num">
                  {preset.fact.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Loja</td>
              {presets.map((preset) => (
                <td key={preset.id}>{preset.name}</td>
              ))}
            </tr>
            <tr>
              <td>Faturamento derivado</td>
              {presets.map((preset) => (
                <td key={preset.id} className="num">
                  {formatBRL(preset.revenue, 2)}
                </td>
              ))}
            </tr>
            <tr>
              <td>SKUs</td>
              {presets.map((preset) => (
                <td key={preset.id} className="num">
                  {formatNumber(preset.fact.skus)}
                </td>
              ))}
            </tr>
            <tr>
              <td>Perdas / mês</td>
              {presets.map((preset) => (
                <td key={preset.id} className="num">
                  {formatBRL(preset.inputs.profile.historicalLossesMonthly, 2)}
                </td>
              ))}
            </tr>
            <tr>
              <td>% de perda</td>
              {presets.map((preset) => (
                <td key={preset.id} className="num">
                  {formatNumber(preset.fact.lossPct * 100, 3)}%
                </td>
              ))}
            </tr>
            <tr>
              <td>HC (balconistas)</td>
              {presets.map((preset) => (
                <td key={preset.id} className="num">
                  {preset.fact.headcount} ({preset.fact.balconistas})
                </td>
              ))}
            </tr>
            <tr>
              <td>Volume (não entra no payback)</td>
              {presets.map((preset) => (
                <td key={preset.id} className="num">
                  {formatNumber(preset.fact.volume)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="lede">
        Premissas do modelo de R$ 2 milhões, a validar: CAPEX, salários, 6 vagas de balconista reduzidas a R$ 4.200,
        dispensações por dia, área, OPEX e perdas projetadas de R$ 12.000. Essas perdas projetadas superam as da
        planilha, então a economia de perdas começa zerada. Horas de supervisão, movimentação e inventário entram no
        payback; os interruptores “já foram retiradas na redução de folha” seguem desligados, como na calculadora
        padrão.
      </p>
      <p className="lede" data-testid="model-disclaimer">
        {MODEL_DISCLAIMER}
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
            Carregar {preset.name}
          </button>
        ))}
      </div>
      <div className="table-wrap short">
        <table>
          <thead>
            <tr>
              <th>Com as premissas atuais</th>
              {presets.map((preset) => (
                <th key={preset.id} className="num">
                  {preset.fact.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Payback</td>
              {presets.map((preset) => (
                <td key={preset.id} className="num" data-testid={`origin-payback-${preset.id}`}>
                  {formatPayback(evaluate(preset.inputs).payback)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
