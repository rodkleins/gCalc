import { flushSync } from 'react-dom';
import { useState, type ReactNode } from 'react';
import { formatBRL, formatIrr, formatNumber, formatPayback, formatPercent, scenarioLabel, storeLabel } from '../model/format';
import type { AuditLine, Inputs, ModelResult, ScenarioId } from '../model/types';
import './print.css';

export type PrintKind = 'resumo' | 'completo';

const DISCLAIMER = 'Premissas a validar. Não é parâmetro oficial nem resultado de uma loja real.';

function money(value: number): string {
  return formatBRL(value);
}

function dateLabel(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(year, month - 1, day));
  }
  return raw || 'não informada';
}

function printedOn(): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());
}

function opexSum(inputs: Inputs): number {
  return Object.values(inputs.robot.opexMonthly).reduce((total, value) => total + value, 0);
}

function groupsOf(lines: AuditLine[]): Array<{ module: string; lines: AuditLine[] }> {
  const order: string[] = [];
  const map = new Map<string, AuditLine[]>();
  for (const line of lines) {
    if (!map.has(line.module)) {
      order.push(line.module);
      map.set(line.module, []);
    }
    map.get(line.module)?.push(line);
  }
  return order.map((module) => ({ module, lines: map.get(module) ?? [] }));
}

function parameterGroups(inputs: Inputs, scenario: ScenarioId): Array<{ title: string; rows: Array<[string, string]> }> {
  const factors = inputs.scenarios[scenario];
  const capex = inputs.robot.capex;
  const opex = inputs.robot.opexMonthly;
  return [
    {
      title: 'Perfil',
      rows: [
        ['Tipo de loja', storeLabel(inputs.profile.storeType)],
        ['Faturamento mensal', money(inputs.profile.monthlyRevenue)],
        ['Margem de contribuição', formatPercent(inputs.profile.contributionMarginPct)],
        ['Dispensações por dia', formatNumber(inputs.profile.dispensationsPerDay)],
        ['Dias de funcionamento', formatNumber(inputs.profile.operatingDaysPerMonth)],
        ['Área total', `${formatNumber(inputs.profile.totalAreaM2)} m²`],
        ['Estoque médio', money(inputs.profile.averageInventory)],
        ['Perdas históricas', `${money(inputs.profile.historicalLossesMonthly)}/mês`],
        ['Lojas na conta', formatNumber(inputs.profile.storeCount)],
      ],
    },
    {
      title: 'Pessoas',
      rows: [
        ['Vagas evitadas', formatNumber(inputs.people.payroll.positionsReduced, 2)],
        ['Custo completo por vaga', `${money(inputs.people.payroll.monthlyCostPerPosition)}/mês`],
        ['Encargos sobre a vaga', formatPercent(inputs.people.payroll.chargesPct)],
        ['Rescisão', money(inputs.people.payroll.severanceCost)],
        ['Turnover ao ano', formatPercent(inputs.people.turnover.annualRate)],
        ['Custo por substituição', money(inputs.people.turnover.costPerReplacement)],
      ],
    },
    {
      title: 'Logística',
      rows: [
        ['Prateleira evitada', money(inputs.logistics.shelving.avoidedAcquisition)],
        ['Revenda de prateleira', money(inputs.logistics.shelving.resaleValue)],
        ['Área liberada', `${formatNumber(inputs.logistics.space.m2Freed)} m²`],
        ['Horas de movimentação', `${formatNumber(inputs.logistics.movement.hoursSavedPerMonth)}/mês`],
        ['Horas de inventário', `${formatNumber(inputs.logistics.inventoryCount.hoursSavedPerMonth)}/mês`],
      ],
    },
    {
      title: 'Estoque',
      rows: [
        ['Perdas projetadas', `${money(inputs.stock.losses.projectedLossesMonthly)}/mês`],
        ['Estoque depois do robô', money(inputs.stock.workingCapital.inventoryAfter)],
      ],
    },
    {
      title: 'Investimento',
      rows: [
        ['Equipamento', money(capex.equipment)],
        [
          'Créditos recuperáveis (IBS/CBS ou ICMS)',
          `${formatPercent(inputs.robot.recoverableTaxCreditPct)} · ${money(Math.max(0, capex.equipment) * inputs.robot.recoverableTaxCreditPct)} · premissa a validar`,
        ],
        ['Frete e impostos', money(capex.freightImportTaxes)],
        ['Instalação e treinamento', money(capex.installationTraining)],
        ['Obras e elétrica', money(capex.civilElectrical)],
        ['Integração', money(capex.integration)],
        ['Contingência', money(capex.implementationContingency)],
        ['Manutenção e suporte', `${money(opex.maintenance)}/mês`],
        ['Software', `${money(opex.software)}/mês`],
        ['Energia', `${money(opex.energy)}/mês`],
        ['Parada', `${money(opex.downtime)}/mês`],
        ['Seguro', `${money(opex.insurance)}/mês`],
        ['Outros custos mensais', `${money(opex.other)}/mês`],
        ['Custo mensal informado', `${money(opexSum(inputs))}/mês`],
        ['Disponibilidade', formatPercent(inputs.robot.availabilityPct)],
        ['Taxa de desconto', `${formatPercent(inputs.robot.discountRateAnnual)} ao ano`],
        ['Entrada em operação', `mês ${formatNumber(inputs.robot.goLiveMonth)}`],
      ],
    },
    {
      title: `Cenário ${scenarioLabel(scenario).toLowerCase()}`,
      rows: [
        ['Fator de benefício', formatNumber(factors.benefitFactor, 2)],
        ['Fator de venda', formatNumber(factors.salesFactor, 2)],
        ['Fator de OPEX', formatNumber(factors.opexFactor, 2)],
        ['Fator de CAPEX', formatNumber(factors.capexFactor, 2)],
      ],
    },
  ];
}

function SheetHead({
  inputs,
  scenario,
  kind,
  edition,
}: {
  inputs: Inputs;
  scenario: ScenarioId;
  kind: PrintKind;
  edition: 'raiz' | 'rh';
}) {
  return (
    <header className="print-head">
      <p className="print-kicker">gCalc · {edition === 'rh' ? 'versão com quadro de RH' : 'calculadora'}</p>
      <h1>{kind === 'resumo' ? 'Resumo executivo' : 'Relatório completo'}</h1>
      <p className="print-meta">
        <strong>Cliente:</strong> {inputs.meta.clientName || 'não informado'}
      </p>
      <p className="print-meta">
        <strong>Loja:</strong> {inputs.meta.storeName || 'não informada'}
      </p>
      <p className="print-meta">
        <strong>Data das premissas:</strong> {dateLabel(inputs.meta.premiseDate)} · <strong>Impresso em</strong> {printedOn()}
      </p>
      <p className="print-meta">
        <strong>Cenário:</strong> {scenarioLabel(scenario)} · <strong>Loja:</strong> {storeLabel(inputs.profile.storeType)}
        {inputs.fictional ? ' · dados fictícios' : ''}
      </p>
      <hr className="print-rule" />
    </header>
  );
}

function Indicators({ result }: { result: ModelResult }) {
  const items = [
    ['Payback', formatPayback(result.payback)],
    ['ROI', formatPercent(result.roi)],
    ['VPL', money(result.npv)],
    ['TIR', formatIrr(result.irrAnnual)],
  ];
  return (
    <section>
      <p className="print-note">
        Investimento líquido {money(result.netInvestment)}. Benefício líquido {money(result.steadyNet)} por mês no mês 60.
        Payback descontado {formatPayback(result.discountedPayback)}. ROI acumulado em 60 meses{' '}
        {formatPercent(result.indicators.cumulativeRoi)}.
      </p>
      <div className="print-kpis" data-testid="print-kpis">
        {items.map(([label, value]) => (
          <article key={label} className="print-kpi">
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function cashPoints(result: ModelResult): Array<{ month: number; accumulated: number; discounted: number }> {
  return [
    { month: 0, accumulated: -result.netInvestment, discounted: -result.netInvestment },
    ...result.months.map((month) => ({
      month: month.month,
      accumulated: month.cumulative,
      discounted: month.cumulativeDiscounted,
    })),
  ];
}

function CashChart({ result }: { result: ModelResult }) {
  const points = cashPoints(result);
  const width = 680;
  const height = 210;
  const pad = { left: 64, right: 8, top: 10, bottom: 26 };
  const values = points.flatMap((point) => [point.accumulated, point.discounted]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (month: number) => pad.left + (month / 60) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (1 - (value - min) / span) * (height - pad.top - pad.bottom);
  const path = (key: 'accumulated' | 'discounted') =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.month).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ');
  const ticks = [0, 12, 24, 36, 48, 60];
  return (
    <figure className="print-chart" data-testid="print-chart-cash">
      <h2>Caixa acumulado em 60 meses</h2>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Caixa acumulado e caixa descontado">
        <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="#111" strokeWidth="0.8" />
        {ticks.map((tick) => (
          <text key={tick} x={x(tick)} y={height - 6} textAnchor="middle" fontSize="11" fill="#111">
            {tick}
          </text>
        ))}
        <text x="8" y={y(max)} fontSize="11" fill="#111">
          {formatNumber(max)}
        </text>
        <text x="8" y={y(min)} fontSize="11" fill="#111">
          {formatNumber(min)}
        </text>
        <path d={path('accumulated')} fill="none" stroke="#111" strokeWidth="1.8" />
        <path d={path('discounted')} fill="none" stroke="#111" strokeWidth="1.4" strokeDasharray="5 3" />
        {result.payback !== null && result.payback > 0 && result.payback <= 60 ? (
          <line x1={x(result.payback)} x2={x(result.payback)} y1={pad.top} y2={height - pad.bottom} stroke="#111" strokeDasharray="2 2" />
        ) : null}
      </svg>
      <figcaption>Linha contínua: caixa acumulado. Linha tracejada: caixa descontado. Traço vertical: payback simples.</figcaption>
    </figure>
  );
}

function BenefitChart({ result }: { result: ModelResult }) {
  const lines = result.audit.filter((line) => line.includedInCashFlow && line.kind === 'recorrente' && line.monthlyValue > 0);
  const width = 680;
  const row = 22;
  const height = Math.max(70, 28 + lines.length * row);
  const max = Math.max(1, ...lines.map((line) => line.monthlyValue));
  const labelWidth = 210;
  return (
    <figure className="print-chart" data-testid="print-chart-benefits">
      <h2>De onde vem o benefício mensal</h2>
      {lines.length === 0 ? (
        <p className="print-note">Nenhum benefício recorrente entrou no fluxo deste cenário.</p>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Composição do benefício mensal">
          {lines.map((line, index) => {
            const y = 8 + index * row;
            const bar = ((width - labelWidth - 90) * line.monthlyValue) / max;
            return (
              <g key={line.id}>
                <text x="0" y={y + 12} fontSize="11" fill="#111">
                  {line.label.slice(0, 32)}
                </text>
                <rect x={labelWidth} y={y} width={Math.max(1, bar)} height="14" fill="#111" />
                <text x={labelWidth + bar + 6} y={y + 12} fontSize="11" fill="#111">
                  {formatNumber(line.monthlyValue)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <figcaption>Barras pretas, valores em R$ por mês. O tamanho acompanha o valor, então a leitura não depende de cor.</figcaption>
    </figure>
  );
}

function BenefitCost({ result }: { result: ModelResult }) {
  const benefits = result.audit.filter((line) => line.includedInCashFlow && line.kind === 'recorrente' && line.monthlyValue > 0);
  const costs = result.audit.filter((line) => line.includedInCashFlow && (line.kind === 'custo' || line.id === 'opex' || line.monthlyValue < 0));
  return (
    <section data-testid="print-benefit-cost">
      <h2>Benefícios e custos</h2>
      <table className="print-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Tipo</th>
            <th className="num">R$/mês</th>
          </tr>
        </thead>
        <tbody>
          {benefits.map((line) => (
            <tr key={line.id}>
              <td>{line.label}</td>
              <td>Benefício</td>
              <td className="num">{money(line.monthlyValue)}</td>
            </tr>
          ))}
          <tr>
            <td>Custo mensal do robô</td>
            <td>Custo</td>
            <td className="num">{money(result.monthlyOpex)}</td>
          </tr>
          {costs
            .filter((line) => line.id !== 'opex')
            .map((line) => (
              <tr key={line.id}>
                <td>{line.label}</td>
                <td>Custo</td>
                <td className="num">{money(line.monthlyValue)}</td>
              </tr>
            ))}
          <tr>
            <td>Benefício líquido no mês 60</td>
            <td>Resultado</td>
            <td className="num">{money(result.steadyNet)}</td>
          </tr>
          <tr data-testid="print-tax-credit">
            <td>Créditos recuperáveis de impostos (IBS/CBS ou ICMS)</td>
            <td>Premissa a validar</td>
            <td className="num">{money(result.recoverableTaxCredit)}</td>
          </tr>
          <tr>
            <td>Investimento líquido</td>
            <td>Uma vez</td>
            <td className="num">{money(result.netInvestment)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function MainPremises({ inputs, scenario }: { inputs: Inputs; scenario: ScenarioId }) {
  const rows = parameterGroups(inputs, scenario).flatMap((group) =>
    group.rows.filter((row) =>
      ['Tipo de loja', 'Faturamento mensal', 'Equipamento', 'Créditos recuperáveis (IBS/CBS ou ICMS)', 'Instalação e treinamento', 'Custo mensal informado', 'Taxa de desconto', 'Vagas evitadas'].includes(
        row[0],
      ),
    ),
  );
  return (
    <section data-testid="print-main-premises">
      <h2>Premissas principais</h2>
      <table className="print-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="num">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Modules({ result }: { result: ModelResult }) {
  const groups = groupsOf(result.audit);
  return (
    <section className="print-chapter print-modules" data-testid="print-modules">
      <h2>Premissas por módulo</h2>
      <p className="print-note">Cada linha é o que o cálculo leu. “No fluxo” entra no payback. “Fora” fica registrado e não soma.</p>
      {groups.map((group) => (
        <div key={group.module}>
          <h3>{group.module}</h3>
          <table className="print-table">
            <thead>
              <tr>
                <th>Premissa</th>
                <th className="num">Valor</th>
                <th>No fluxo</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {group.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.label}</td>
                  <td className="num">{line.monthlyValue !== 0 ? `${money(line.monthlyValue)}/mês` : line.oneTimeValue !== 0 ? money(line.oneTimeValue) : '—'}</td>
                  <td>{line.includedInCashFlow ? 'Sim' : 'Não'}</td>
                  <td>{line.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

function Parameters({ inputs, scenario }: { inputs: Inputs; scenario: ScenarioId }) {
  return (
    <section className="print-chapter" data-testid="print-parameters">
      <h2>Parâmetros digitados</h2>
      {parameterGroups(inputs, scenario).map((group) => (
        <div key={group.title}>
          <h3>{group.title}</h3>
          <table className="print-table">
            <tbody>
              {group.rows.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

function Cashflow({ result }: { result: ModelResult }) {
  return (
    <section className="print-chapter" data-testid="print-cashflow">
      <h2>Fluxo de caixa mensal</h2>
      <p className="print-note">Valores em R$. Mês 0 é o investimento líquido. O horizonte é de 60 meses.</p>
      <table className="print-flow">
        <thead>
          <tr>
            <th>Mês</th>
            <th className="num">Sem robô</th>
            <th className="num">Com robô</th>
            <th className="num">Operacional</th>
            <th className="num">Fluxo</th>
            <th className="num">Acumulado</th>
            <th className="num">Descontado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0</td>
            <td className="num">—</td>
            <td className="num">—</td>
            <td className="num">—</td>
            <td className="num">{money(-result.netInvestment)}</td>
            <td className="num">{money(-result.netInvestment)}</td>
            <td className="num">{money(-result.netInvestment)}</td>
          </tr>
          {result.months.map((month) => (
            <tr key={month.month} data-testid={`print-month-${month.month}`}>
              <td>{month.month}</td>
              <td className="num">{money(month.costWithout)}</td>
              <td className="num">{money(month.costWith)}</td>
              <td className="num">{money(month.netOperating)}</td>
              <td className="num">{money(month.incremental)}</td>
              <td className="num">{money(month.cumulative)}</td>
              <td className="num">{money(month.cumulativeDiscounted)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ReportBody({
  inputs,
  result,
  scenario,
  kind,
  edition,
  completeExtra,
}: {
  inputs: Inputs;
  result: ModelResult;
  scenario: ScenarioId;
  kind: PrintKind;
  edition: 'raiz' | 'rh';
  completeExtra?: ReactNode;
}) {
  return (
    <article className="print-sheet" data-testid="print-sheet" data-print-kind={kind}>
      <SheetHead inputs={inputs} scenario={scenario} kind={kind} edition={edition} />
      <Indicators result={result} />
      <div className="print-charts">
        <BenefitChart result={result} />
        <CashChart result={result} />
      </div>
      <BenefitCost result={result} />
      <MainPremises inputs={inputs} scenario={scenario} />
      {kind === 'completo' ? (
        <>
          <Modules result={result} />
          <Parameters inputs={inputs} scenario={scenario} />
          {completeExtra}
          <Cashflow result={result} />
        </>
      ) : null}
      <p className="print-end">{inputs.fictional ? `Dados fictícios. ${DISCLAIMER}` : DISCLAIMER}</p>
    </article>
  );
}

export function PrintReport({
  inputs,
  result,
  scenario,
  edition,
  completeExtra,
}: {
  inputs: Inputs;
  result: ModelResult;
  scenario: ScenarioId;
  edition: 'raiz' | 'rh';
  completeExtra?: ReactNode;
}) {
  const [dialog, setDialog] = useState(false);
  const [kind, setKind] = useState<PrintKind | null>(null);

  function choose(next: PrintKind) {
    flushSync(() => {
      setDialog(false);
      setKind(next);
    });
    window.print();
  }

  return (
    <>
      <div className="print-launch">
        <button type="button" className="btn" data-testid="print-open" onClick={() => setDialog(true)}>
          Imprimir
        </button>
        <span>Relatório da simulação aberta, para imprimir ou salvar em PDF.</span>
      </div>
      {dialog ? (
        <div className="modal-backdrop" data-testid="print-dialog" role="presentation" onClick={(event) => event.target === event.currentTarget && setDialog(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="print-dialog-title">
            <h2 id="print-dialog-title">Imprimir simulação</h2>
            <p>Escolha o relatório. O navegador abre a impressão, onde dá para salvar em PDF no computador ou no iPad.</p>
            <button type="button" className="btn print-choice" data-testid="print-choice-resumo" onClick={() => choose('resumo')}>
              <strong>Resumo executivo</strong>
              <small>Uma ou duas páginas: cliente, loja, data, cenário, payback, ROI, VPL, TIR, gráficos, benefícios e custos, premissas principais.</small>
            </button>
            <button type="button" className="btn print-choice" data-testid="print-choice-completo" onClick={() => choose('completo')}>
              <strong>Completo</strong>
              <small>
                O resumo, as premissas de cada módulo, os parâmetros digitados
                {edition === 'rh' ? ', a tabela cargo por turno com folguista e postos liberados' : ''} e o fluxo de caixa dos 60 meses.
              </small>
            </button>
            <button type="button" className="btn ghost" data-testid="print-cancel" onClick={() => setDialog(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {kind ? (
        <div className="print-host is-preview" data-testid="print-preview">
          <div className="print-toolbar">
            <button type="button" className="btn primary" data-testid="print-now" onClick={() => window.print()}>
              Imprimir ou salvar PDF
            </button>
            <button type="button" className="btn" data-testid="print-close" onClick={() => setKind(null)}>
              Fechar
            </button>
            <span>{kind === 'resumo' ? 'Resumo executivo' : 'Relatório completo'} · A4 retrato</span>
          </div>
          <ReportBody inputs={inputs} result={result} scenario={scenario} kind={kind} edition={edition} completeExtra={completeExtra} />
        </div>
      ) : null}
    </>
  );
}
