import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { evaluate } from '../model/calculate';
import { matchesIllustrativeExample } from '../model/example';
import { formatBRL, formatCompactBRL, formatPayback, formatPercent, scenarioLabel, storeLabel } from '../model/format';
import type { Inputs, ModelResult, ScenarioId } from '../model/types';
import { Callout, PercentField, Switch } from './Fields';

const SCENARIOS: ScenarioId[] = ['conservador', 'base', 'otimista'];

export function Dashboard({
  inputs,
  result,
  scenario,
  onScenario,
  onInputs,
}: {
  inputs: Inputs;
  result: ModelResult;
  scenario: ScenarioId;
  onScenario: (scenario: ScenarioId) => void;
  onInputs: (inputs: Inputs) => void;
}) {
  const illustrative = matchesIllustrativeExample(result);
  const nova = evaluate(inputs, { scenario, storeTypeOverride: 'nova' });
  const existente = evaluate(inputs, { scenario, storeTypeOverride: 'existente' });
  const scenarios = SCENARIOS.map((id) => ({ id, result: evaluate(inputs, { scenario: id }) }));
  const composition = result.audit
    .filter((line) => line.includedInCashFlow && line.kind === 'recorrente' && line.monthlyValue > 0)
    .map((line) => ({ name: line.label, valor: line.monthlyValue }));
  const cash = [
    { month: 0, acumulado: -result.netInvestment, descontado: -result.netInvestment, sem: 0, com: 0 },
    ...result.months.map((month) => ({
      month: month.month,
      acumulado: month.cumulative,
      descontado: month.cumulativeDiscounted,
      sem: month.costWithout,
      com: month.costWith,
    })),
  ];
  const steady = result.months[59];

  return (
    <div className="stack">
      {inputs.fictional ? (
        <div className="banner fiction">
          Dados fictícios. Este caso não é parâmetro oficial da Gollmann nem resultado de uma loja real.
        </div>
      ) : null}
      {illustrative ? (
        <div className="banner ok" data-testid="example-check">
          Exemplo do escopo reproduzido no cenário base, loja nova: investimento de R$ 2.000.000, benefício líquido de R$
          65.000 por mês, payback de 30,8 meses e ROI de 39%.
        </div>
      ) : (
        <div className="banner">
          Os números do documento (R$ 2.000.000, R$ 65.000 por mês, payback de 30,8 meses, ROI de 39%) aparecem no
          exemplo fictício, cenário base e loja nova.
        </div>
      )}

      <section className="kpis">
        <article className="kpi">
          <span>Investimento líquido</span>
          <strong data-testid="kpi-investment">{formatBRL(result.netInvestment)}</strong>
          <em>
            Bruto {formatBRL(result.grossCapex)} − evitado {formatBRL(result.avoidedCapex)}
          </em>
        </article>
        <article className="kpi">
          <span>Benefício líquido no mês 60</span>
          <strong data-testid="kpi-net">{formatBRL(result.steadyNet)}</strong>
          <em>
            {formatBRL(result.steadyBenefit)} − OPEX {formatBRL(result.monthlyOpex)}
          </em>
        </article>
        <article className="kpi accent">
          <span>Payback simples</span>
          <strong data-testid="kpi-payback">{formatPayback(result.payback)}</strong>
          <em>
            {result.firstPositiveMonth
              ? `Caixa acumulado positivo no mês ${result.firstPositiveMonth}`
              : 'Não zera em 60 meses'}
          </em>
        </article>
        <article className="kpi accent">
          <span>ROI anual simples</span>
          <strong data-testid="kpi-roi">{formatPercent(result.roi)}</strong>
          <em>Não é a TIR. Usa o run-rate do mês 60.</em>
        </article>
        <article className="kpi">
          <span>VPL a {formatPercent(result.discountRateAnnual)}</span>
          <strong data-testid="kpi-npv">{formatBRL(result.npv)}</strong>
          <em>Taxa efetiva anual, equivalente mensal</em>
        </article>
        <article className="kpi">
          <span>TIR anual efetiva</span>
          <strong data-testid="kpi-irr">{formatPercent(result.irrAnnual)}</strong>
          <em>Mensal {formatPercent(result.irrMonthly, 2)}</em>
        </article>
      </section>

      <section className="card memory">
        <h2>Memória do cenário {scenarioLabel(scenario).toLowerCase()}</h2>
        <ol>
          <li>
            Benefício operacional bruto no mês 60: <b>{formatBRL(result.steadyBenefit)}</b>
          </li>
          <li>
            OPEX do robô: <b>{formatBRL(result.monthlyOpex)}</b>
          </li>
          <li>
            Benefício líquido: <b>{formatBRL(result.steadyNet)}</b> por mês, <b>{formatBRL(result.annualSteadyNet)}</b>{' '}
            ao ano
          </li>
          <li>
            ROI = {formatBRL(result.annualSteadyNet)} / {formatBRL(result.netInvestment)} = <b>{formatPercent(result.roi)}</b>
          </li>
          <li>
            Payback descontado: <b>{formatPayback(result.discountedPayback)}</b>
            {result.firstPositiveDiscountedMonth
              ? `, positivo no mês ${result.firstPositiveDiscountedMonth}`
              : ''}
          </li>
        </ol>
        <div className="inline-controls">
          <PercentField
            label="Taxa de desconto"
            value={inputs.robot.discountRateAnnual}
            onChange={(discountRateAnnual) =>
              onInputs({ ...inputs, robot: { ...inputs.robot, discountRateAnnual } })
            }
          />
          <Switch
            checked={inputs.assumptions.includePotential}
            onChange={(includePotential) => onInputs({ ...inputs, assumptions: { includePotential } })}
            label={inputs.assumptions.includePotential ? 'Potenciais no fluxo' : 'Só comprováveis'}
          />
        </div>
      </section>

      {result.warnings.length > 0 ? (
        <Callout tone="warn">
          <ul>
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <div className="chart-grid two">
        <section className="card chart-card">
          <h2>Composição do benefício mensal</h2>
          <div className="plot">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={composition} layout="vertical" margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#eadfce" horizontal={false} />
                <XAxis type="number" tickFormatter={formatCompactBRL} stroke="#6d756e" />
                <YAxis type="category" dataKey="name" width={148} tick={{ fontSize: 12, fill: '#24302a' }} />
                <Tooltip formatter={(value) => formatBRL(Number(value))} />
                <Bar dataKey="valor" name="Benefício" radius={[0, 8, 8, 0]}>
                  {composition.map((entry) => (
                    <Cell key={entry.name} fill="#1e4c43" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card chart-card">
          <h2>Caixa incremental em 60 meses</h2>
          <div className="plot">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cash} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                <CartesianGrid stroke="#eadfce" />
                <XAxis dataKey="month" type="number" domain={[0, 60]} ticks={[0, 12, 24, 36, 48, 60]} stroke="#6d756e" />
                <YAxis tickFormatter={formatCompactBRL} width={72} stroke="#6d756e" />
                <Tooltip formatter={(value) => formatBRL(Number(value))} labelFormatter={(label) => `Mês ${label}`} />
                <Legend />
                <ReferenceLine y={0} stroke="#8c5e1a" />
                {result.payback !== null ? <ReferenceLine x={result.payback} stroke="#a56b24" /> : null}
                <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke="#14352f" fill="#1e4c43" fillOpacity={0.2} />
                <Area
                  type="monotone"
                  dataKey="descontado"
                  name="Acumulado descontado"
                  stroke="#a56b24"
                  fill="#d7a15a"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="card chart-card wide">
        <h2>Custos relevantes sem robô e com robô</h2>
        <p className="lede">
          No mês 60, custos sem robô {formatBRL(steady?.costWithout ?? 0)} e com robô {formatBRL(steady?.costWith ?? 0)}.
          A diferença, somada à margem incremental de {formatBRL(steady?.salesMargin ?? 0)}, é o benefício líquido.
        </p>
        <div className="plot">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cash.slice(1)} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
              <CartesianGrid stroke="#eadfce" />
              <XAxis dataKey="month" stroke="#6d756e" />
              <YAxis tickFormatter={formatCompactBRL} width={72} stroke="#6d756e" />
              <Tooltip formatter={(value) => formatBRL(Number(value))} labelFormatter={(label) => `Mês ${label}`} />
              <Legend />
              <Area type="monotone" dataKey="sem" name="Sem robô" stroke="#8e3030" fill="#8e3030" fillOpacity={0.12} />
              <Area type="monotone" dataKey="com" name="Com robô" stroke="#1e4c43" fill="#1e4c43" fillOpacity={0.18} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <h2>Cenários</h2>
        <div className="compare">
          {scenarios.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`compare-card ${item.id === scenario ? 'is-active' : ''}`}
              onClick={() => onScenario(item.id)}
            >
              <span>{scenarioLabel(item.id)}</span>
              <strong>{formatPayback(item.result.payback)}</strong>
              <em>ROI {formatPercent(item.result.roi)}</em>
              <em>VPL {formatBRL(item.result.npv)}</em>
              <em>Líquido {formatBRL(item.result.steadyNet)}/mês</em>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Loja nova e loja existente</h2>
        <p className="lede">
          A coluna ativa é {storeLabel(result.storeType).toLowerCase()}. A outra aplica as regras do tipo de loja sobre
          as mesmas premissas: CAPEX de prateleira, revenda, manutenção e rescisão.
        </p>
        <div className="table-wrap short">
          <table>
            <thead>
              <tr>
                <th>Indicador</th>
                <th className="num">Loja nova</th>
                <th className="num">Loja existente</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Investimento líquido</td>
                <td className="num">{formatBRL(nova.netInvestment)}</td>
                <td className="num">{formatBRL(existente.netInvestment)}</td>
              </tr>
              <tr>
                <td>Benefício líquido mensal</td>
                <td className="num">{formatBRL(nova.steadyNet)}</td>
                <td className="num">{formatBRL(existente.steadyNet)}</td>
              </tr>
              <tr>
                <td>Payback simples</td>
                <td className="num">{formatPayback(nova.payback)}</td>
                <td className="num">{formatPayback(existente.payback)}</td>
              </tr>
              <tr>
                <td>ROI</td>
                <td className="num">{formatPercent(nova.roi)}</td>
                <td className="num">{formatPercent(existente.roi)}</td>
              </tr>
              <tr>
                <td>VPL</td>
                <td className="num">{formatBRL(nova.npv)}</td>
                <td className="num">{formatBRL(existente.npv)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {result.storeCount > 1 ? (
        <section className="card">
          <h2>Rede, {result.storeCount} lojas</h2>
          <p className="lede">
            Investimento {formatBRL(result.network.investment)}, benefício líquido {formatBRL(result.network.steadyNet)}{' '}
            por mês e VPL {formatBRL(result.network.npv)}. Payback e ROI permanecem os da loja, porque a réplica é linear.
          </p>
        </section>
      ) : null}
    </div>
  );
}
