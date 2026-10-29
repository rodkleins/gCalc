import { NumberField, PercentField } from '../components/Fields';
import { evaluate } from '../model/calculate';
import { formatBRL, formatNumber, formatPayback } from '../model/format';
import {
  applyDpspDrivers,
  balconistaCount,
  dpspFormulaLines,
  lossSavings,
  reducedPositions,
  type DpspDrivers,
} from './drivers';
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
  drivers,
  inputs,
  onDrivers,
  onLoad,
}: {
  presets: DpspPreset[];
  drivers: DpspDrivers;
  inputs: DpspPreset['inputs'];
  onDrivers: (drivers: DpspDrivers) => void;
  onLoad: (preset: DpspPreset) => void;
}) {
  const balconistas = balconistaCount(inputs);
  const positions = reducedPositions(balconistas, drivers.balconistaReductionPct);
  const savings = lossSavings(inputs.profile.historicalLossesMonthly, drivers.retainedLossPct);
  const formulas = dpspFormulaLines(inputs, drivers);
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
      <div className="dpsp-driver" data-testid="dpsp-drivers">
        <PercentField
          label="% dos balconistas reduzidos"
          value={drivers.balconistaReductionPct}
          testId="dpsp-reduction-pct"
          hint="Premissa a validar."
          help="Percentual dos balconistas da loja que o robô deixa de exigir. A premissa inicial é 50%."
          onChange={(balconistaReductionPct) => onDrivers({ ...drivers, balconistaReductionPct })}
        />
        <p className="computed" data-testid="dpsp-positions">
          {countLabel(positions)} vagas
        </p>
        <NumberField
          label="Custo por vaga de balconista"
          value={drivers.positionCost}
          suffix="R$"
          testId="dpsp-position-cost"
          hint="Premissa a validar."
          help="Custo mensal de uma vaga reduzida. Começa em R$ 4.200, o auxiliar do modelo de R$ 2 milhões, e pode ser trocado."
          onChange={(positionCost) => onDrivers({ ...drivers, positionCost })}
        />
        <PercentField
          label="% das perdas que permanece com o robô"
          value={drivers.retainedLossPct}
          testId="dpsp-retained-loss-pct"
          hint="Premissa a validar."
          help="No modelo de R$ 2 milhões, R$ 12.000 de R$ 28.000 permanecem, cerca de 43%. A economia é o restante das perdas desta loja."
          onChange={(retainedLossPct) => onDrivers({ ...drivers, retainedLossPct })}
        />
        <p className="computed" data-testid="dpsp-loss-savings">
          economia {formatBRL(savings, 2)}
        </p>
      </div>
      <details className="calc-memory" data-testid="dpsp-calc">
        <summary>Ver cálculo</summary>
        <div className="calc-memory-body">
          <ul>
            {formulas.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </details>
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
                  {formatPayback(evaluate(applyDpspDrivers(preset.inputs, drivers)).payback)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function countLabel(value: number): string {
  const digits = Math.abs(value - Math.round(value)) < 0.001 ? 0 : 1;
  return formatNumber(value, digits);
}
