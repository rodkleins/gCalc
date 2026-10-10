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
import { formatBRL, formatCompactBRL, formatIrr, formatPayback, formatPercent, scenarioLabel, storeLabel } from '../model/format';
import { fieldForAudit, type LeverId } from '../model/premises';
import type { Inputs, ModelResult, ScenarioId } from '../model/types';
import { Callout, PercentField, StageNote, Switch } from './Fields';
import { QuickAdjust } from './QuickAdjust';

const SCENARIOS: ScenarioId[] = ['conservador', 'base', 'otimista'];

export function Dashboard({
  inputs,
  anchor,
  result,
  scenario,
  onScenario,
  onInputs,
  onAdjust,
  onUndo,
  onOpenPremise,
  uiKeys,
  hiddenLevers,
}: {
  inputs: Inputs;
  anchor: Inputs;
  result: ModelResult;
  scenario: ScenarioId;
  onScenario: (scenario: ScenarioId) => void;
  onInputs: (inputs: Inputs) => void;
  onAdjust: (inputs: Inputs) => void;
  onUndo: () => void;
  onOpenPremise: (fieldId: string) => void;
  uiKeys?: { dock: string; adjust: string };
  hiddenLevers?: LeverId[];
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
  const premiseLines = result.audit.filter(
    (line) => line.includedInCashFlow && (line.monthlyValue !== 0 || line.oneTimeValue !== 0) && fieldForAudit(line.id),
  );

  return (
    <div className="stack">
      {inputs.fictional ? (
        <div className="banner fiction">
          Dados fictícios. Este caso não é parâmetro oficial da Gollmann nem resultado de uma loja real.
        </div>
      ) : null}
      {illustrative ? (
        <div className="banner ok" data-testid="example-check">
          Exemplo do escopo reproduzido no cenário base, loja nova: investimento de R$ 1.195.000, benefício líquido de R$
          20.500 por mês, payback de 58,3 meses e ROI de 20,6%.
        </div>
      ) : (
        <div className="banner">
          Os números do documento (R$ 1.195.000, R$ 20.500 por mês, payback de 58,3 meses, ROI de 20,6%) aparecem no
          exemplo fictício, cenário base e loja nova.
        </div>
      )}

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
      <StageNote>
        O gráfico da esquerda mostra de onde vem a sobra mensal. O da direita mostra quando o caixa acumulado devolve o
        investimento: é o payback.
      </StageNote>

      <QuickAdjust
        inputs={inputs}
        anchor={anchor}
        scenario={scenario}
        onAdjust={onAdjust}
        onUndo={onUndo}
        onOpen={onOpenPremise}
        storageKeys={uiKeys}
        hiddenLevers={hiddenLevers}
      />

      <StageNote testId="stage-note-kpis">
        Estes cartões são o resultado da conta. Investimento é o que se paga para ter o robô. A sobra mensal é o que a
        loja passa a economizar depois da manutenção. Payback e ROI saem desses dois números.
      </StageNote>
      <section className="kpis">
        <article className="kpi">
          <span>Investimento líquido</span>
          <PremiseValue fieldId="robot.capex.equipment" testId="open-premise-investment" onOpen={onOpenPremise}>
            <strong data-testid="kpi-investment">{formatBRL(result.netInvestment)}</strong>
          </PremiseValue>
          <em>
            Bruto{' '}
            <PremiseValue fieldId="robot.capex.equipment" onOpen={onOpenPremise}>
              {formatBRL(result.grossCapex)}
            </PremiseValue>{' '}
            − evitado{' '}
            <PremiseValue fieldId="logistics.shelving.avoidedAcquisition" onOpen={onOpenPremise}>
              {formatBRL(result.avoidedCapex)}
            </PremiseValue>
          </em>
        </article>
        <article className="kpi">
          <span>Benefício líquido no mês 60</span>
          <strong data-testid="kpi-net">{formatBRL(result.steadyNet)}</strong>
          <em>
            {formatBRL(result.steadyBenefit)} − OPEX{' '}
            <PremiseValue fieldId="robot.opexMonthly.maintenance" testId="open-premise-opex" onOpen={onOpenPremise}>
              {formatBRL(result.monthlyOpex)}
            </PremiseValue>
          </em>
        </article>
        <article className="kpi accent">
          <span>Payback simples</span>
          <strong data-testid="kpi-payback">{formatPayback(result.payback)}</strong>
          <em>
            {result.payback !== null && result.payback <= 0
              ? 'Sem desembolso a recuperar'
              : result.firstPositiveMonth
                ? `Caixa acumulado positivo no mês ${result.firstPositiveMonth}`
                : 'Não zera em 60 meses'}
          </em>
        </article>
        <article className="kpi accent">
          <span>Retorno anual simples estabilizado</span>
          <strong data-testid="kpi-roi">{formatPercent(result.roi)}</strong>
          <em>
            {result.roi === null
              ? 'Não se aplica sem investimento positivo.'
              : 'Run-rate do mês 60. Não é o ROI acumulado nem a TIR.'}
          </em>
        </article>
        <article className="kpi">
          <span>
            VPL a{' '}
            <PremiseValue fieldId="robot.discountRateAnnual" testId="open-premise-discount" onOpen={onOpenPremise}>
              {formatPercent(result.discountRateAnnual)}
            </PremiseValue>
          </span>
          <strong data-testid="kpi-npv">{formatBRL(result.npv)}</strong>
          <em>Taxa efetiva anual, equivalente mensal</em>
        </article>
        <article className="kpi">
          <span>TIR anual efetiva</span>
          <strong data-testid="kpi-irr">{formatIrr(result.irrAnnual)}</strong>
          <em>
            {result.indicators.irrAmbiguous
              ? 'TIR ambígua: mais de uma troca de sinal. Use o VPL.'
              : result.irrAnnual === null
                ? 'Não há troca de sinal no caixa'
                : `Mensal ${formatPercent(result.irrMonthly, 2)}`}
          </em>
        </article>
      </section>

      <section className="kpis" data-testid="indicator-set">
        <article className="kpi">
          <span>ROI acumulado em 60 meses</span>
          <strong data-testid="kpi-roi-accumulated">{formatPercent(result.indicators.cumulativeRoi)}</strong>
          <em>Soma do operacional líquido ÷ investimento líquido</em>
        </article>
        <article className="kpi">
          <span>Payback descontado</span>
          <strong>{formatPayback(result.discountedPayback)}</strong>
          <em>Caixa descontado à taxa do VPL</em>
        </article>
        <article className="kpi">
          <span>Economia acumulada</span>
          <strong>{formatBRL(result.indicators.accumulatedSavings)}</strong>
          <em>Benefício operacional bruto no horizonte</em>
        </article>
        <article className="kpi">
          <span>Benefício operacional anual</span>
          <strong>{formatBRL(result.indicators.annualOperatingBenefit)}</strong>
          <em>Bruto do mês 60 × 12, antes do OPEX</em>
        </article>
        <article className="kpi">
          <span>Caixa acumulado</span>
          <strong>{formatBRL(result.indicators.cumulativeCash)}</strong>
          <em>Descontado {formatBRL(result.indicators.cumulativeDiscountedCash)}</em>
        </article>
      </section>

      <section className="card executive" data-testid="executive-summary">
        <h2>Como chegamos no payback e no ROI</h2>
        <ol>
          <li>
            O investimento líquido é {formatBRL(result.netInvestment)}: o equipamento e a instalação, menos o que a loja
            deixa de comprar em prateleira.
          </li>
          <li>
            No mês estável a operação deixa {formatBRL(result.steadyBenefit)} e gasta {formatBRL(result.monthlyOpex)} para
            manter o robô. Sobra {formatBRL(result.steadyNet)} por mês.
          </li>
          <li>
            O payback de {formatPayback(result.payback)} é quantos meses essa sobra leva para devolver o investimento. Ele
            não usa a taxa de desconto.
          </li>
          <li>
            O ROI de {formatPercent(result.roi)} é essa sobra vezes 12, dividida pelo investimento. É o ritmo de um ano
            estável, não a soma dos 60 meses.
          </li>
          <li>O preço do robô entra só uma vez. O custo mensal é manutenção e suporte, e não repete o valor do equipamento.</li>
        </ol>
      </section>

      <BenefitClasses result={result} />

      <section className="card memory">
        <h2>Memória do cenário {scenarioLabel(scenario).toLowerCase()}</h2>
        <ol>
          <li>
            Benefício operacional bruto no mês 60: <b>{formatBRL(result.steadyBenefit)}</b>
          </li>
          <li>
            Custo mensal do robô (manutenção e suporte, sem o preço do equipamento):{' '}
            <PremiseValue fieldId="robot.opexMonthly.maintenance" onOpen={onOpenPremise}>
              {formatBRL(result.monthlyOpex)}
            </PremiseValue>
          </li>
          <li>
            Benefício líquido: <b>{formatBRL(result.steadyNet)}</b> por mês, <b>{formatBRL(result.annualSteadyNet)}</b>{' '}
            ao ano
          </li>
          <li>
            Retorno anual simples estabilizado = {formatBRL(result.annualSteadyNet)} /{' '}
            <PremiseValue fieldId="robot.capex.equipment" onOpen={onOpenPremise}>
              {formatBRL(result.netInvestment)}
            </PremiseValue>{' '}
            = <b>{formatPercent(result.roi)}</b>
          </li>
          <li>
            Payback descontado: <b>{formatPayback(result.discountedPayback)}</b>
            {result.discountedPayback !== null && result.discountedPayback <= 0
              ? ''
              : result.firstPositiveDiscountedMonth
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
            onChange={(includePotential) => onInputs({ ...inputs, assumptions: { ...inputs.assumptions, includePotential } })}
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

      <section className="card">
        <h2>Premissas deste resultado</h2>
        <p className="lede">Cada valor abre o campo em que a premissa é editada. O cálculo continua na hora.</p>
        <ul className="premise-list">
          {premiseLines.map((line) => {
            const fieldId = fieldForAudit(line.id) ?? '';
            const amount = line.monthlyValue !== 0 ? line.monthlyValue : line.oneTimeValue;
            return (
              <li key={line.id}>
                <PremiseValue fieldId={fieldId} testId={`open-premise-audit-${line.id}`} onOpen={onOpenPremise}>
                  {line.label}: {formatBRL(amount)}
                  {line.monthlyValue !== 0 ? '/mês' : ''}
                </PremiseValue>
              </li>
            );
          })}
        </ul>
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
        <StageNote testId="stage-note-store">
          A mesma premissa muda de significado conforme a loja. Em loja nova, prateleira evitada reduz o investimento e
          não há rescisão. Em loja existente, a rescisão e a contratação futura podem entrar, e a prateleira vira revenda
          ou manutenção. Se um benefício está zerado, o motivo aparece abaixo.
        </StageNote>
        <p className="lede">
          A coluna ativa é {storeLabel(result.storeType).toLowerCase()}.
        </p>
        <ul className="premise-list">
          {result.audit
            .filter((line) => !line.includedInCashFlow && /loja (nova|existente)/i.test(line.reason))
            .map((line) => (
              <li key={line.id} data-testid={`store-zero-${line.id}`}>
                {line.label}: {line.reason}
              </li>
            ))}
        </ul>
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

      {result.network.mode === 'escalonada' ? (
        <section className="card">
          <h2>Rede com implantação escalonada</h2>
          <p className="lede">
            Consolidado: investimento {formatBRL(result.network.investment)}, líquido {formatBRL(result.network.steadyNet)}{' '}
            por mês e VPL {formatBRL(result.network.npv)}. Cada loja guarda o próprio payback.
          </p>
          <div className="table-wrap short">
            <table>
              <thead>
                <tr>
                  <th>Loja</th>
                  <th className="num">Início</th>
                  <th className="num">Payback</th>
                  <th className="num">VPL</th>
                </tr>
              </thead>
              <tbody>
                {result.network.stores.map((store) => (
                  <tr key={store.id}>
                    <td>
                      {store.name} × {store.count}
                    </td>
                    <td className="num">mês {store.goLiveMonth}</td>
                    <td className="num">{formatPayback(store.payback)}</td>
                    <td className="num">{formatBRL(store.npv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : result.storeCount > 1 ? (
        <section className="card">
          <h2>Rede, {result.storeCount} lojas</h2>
          <p className="lede">
            Investimento {formatBRL(result.network.investment)}, benefício líquido {formatBRL(result.network.steadyNet)}{' '}
            por mês e VPL {formatBRL(result.network.npv)}. Payback e retorno estabilizado permanecem os da loja, porque a
            réplica é linear. A implantação escalonada fica no modo avançado.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function BenefitClasses({ result }: { result: ModelResult }) {
  const groups = [
    {
      title: 'Comprováveis no fluxo',
      lines: result.audit.filter((line) => line.includedInCashFlow && line.confidence === 'comprovavel' && line.kind === 'recorrente'),
    },
    {
      title: 'Potenciais',
      lines: result.audit.filter((line) => line.confidence === 'potencial'),
    },
    {
      title: 'Custos operacionais',
      lines: result.audit.filter((line) => line.id === 'opex'),
    },
    {
      title: 'Investimentos pontuais',
      lines: result.audit.filter((line) => line.id === 'capex' || line.id === 'shelvingCapex'),
    },
    {
      title: 'Caixa não recorrente',
      lines: result.audit.filter((line) => line.kind === 'pontual' || line.kind === 'capital'),
    },
    {
      title: 'Produtividade não monetizada',
      lines: result.audit.filter((line) => line.id === 'reallocated' && !line.includedInCashFlow),
    },
  ];
  return (
    <section className="card">
      <h2>O que entrou no resultado</h2>
      <div className="compare">
        {groups.map((group) => (
          <article key={group.title} className="compare-card">
            <span>{group.title}</span>
            <strong>{group.lines.length}</strong>
            <em>{group.lines.slice(0, 3).map((line) => line.label).join(' · ') || 'Nenhum item'}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function PremiseValue({
  fieldId,
  testId,
  onOpen,
  children,
}: {
  fieldId: string;
  testId?: string;
  onOpen: (fieldId: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="premise-link"
      data-field={fieldId}
      data-testid={testId}
      onClick={() => onOpen(fieldId)}
    >
      {children}
    </button>
  );
}
