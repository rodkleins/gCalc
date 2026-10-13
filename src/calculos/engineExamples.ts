import { evaluate, sensitivity } from '../model/calculate';
import { exampleInputs } from '../model/example';
import { formatBRL, formatIrr, formatPayback, formatPercent, scenarioLabel, storeLabel } from '../model/format';
import { storePresets } from '../model/presets';
import type { Inputs, ModelResult, ScenarioId, SensitivityDriver, StoreType } from '../model/types';

const SCENARIOS: ScenarioId[] = ['conservador', 'base', 'otimista'];
const STORE_TYPES: StoreType[] = ['nova', 'existente'];

const DRIVER_LABEL: Record<SensitivityDriver, string> = {
  investimento: 'Investimento',
  opex: 'Custo mensal do robô',
  maoDeObra: 'Mão de obra',
  turnover: 'Turnover',
  volume: 'Volume',
  vendas: 'Vendas',
  desconto: 'Desconto',
  disponibilidade: 'Disponibilidade',
  cobertura: 'Cobertura do estoque',
};

function money(value: number): string {
  const abs = Math.abs(value);
  const whole = Math.abs(abs - Math.round(abs)) < 0.001;
  const tenth = Math.abs(abs * 10 - Math.round(abs * 10)) < 0.001;
  return formatBRL(value, whole ? 0 : tenth ? 1 : 2);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function table(headers: string[], rows: string[][]): string {
  const head = `<thead><tr>${headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${rows
    .map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  return `<div class="doc-table"><table>${head}${body}</table></div>`;
}

function evaluated(storeType: StoreType, scenario: ScenarioId): ModelResult {
  const inputs: Inputs = exampleInputs();
  inputs.profile.storeType = storeType;
  return evaluate(inputs, { scenario });
}

function paybackNote(payback: number | null): string {
  if (payback === null) return 'não recupera em 60 meses';
  if (payback > 30) return `passa de 30 meses (${formatPayback(payback)})`;
  return `fecha em até 30 meses (${formatPayback(payback)})`;
}

/** Quadros numéricos da página de cálculos. Saem de evaluate e da sensibilidade, não de números copiados. */
export function engineExamplesHtml(): string {
  const example = evaluated('nova', 'base');
  const sensitivityTable = sensitivity(exampleInputs(), 'base');
  const benefits = example.audit.filter(
    (line) => line.includedInCashFlow && line.kind === 'recorrente' && Math.abs(line.monthlyValue) > 0.004,
  );
  const excluded = example.audit.filter(
    (line) => !line.includedInCashFlow && Math.abs(line.monthlyValue) > 0.004,
  );
  const stores = storePresets().map((preset) => ({
    name: preset.name,
    cells: SCENARIOS.map((scenario) => ({ scenario, result: evaluate(preset.inputs, { scenario }) })),
  }));
  const baseStores = stores.map((store) => ({
    name: store.name,
    payback: store.cells.find((cell) => cell.scenario === 'base')?.result.payback ?? null,
  }));

  const sensitivityRows = (Object.keys(DRIVER_LABEL) as SensitivityDriver[]).map((driver) => [
    DRIVER_LABEL[driver],
    ...sensitivityTable[driver].map((point) => formatPayback(point.payback)),
  ]);

  const benefitRows = [
    ...benefits.map((line) => [line.label, line.formula, money(line.monthlyValue)]),
    ['Benefício bruto estabilizado', 'Soma que a conta usa no mês 60', money(example.steadyBenefit)],
    ['Custo mensal do robô', 'Suporte, energia calculada e outros custos, já no cenário base', money(example.monthlyOpex)],
    ['Benefício líquido', 'Benefício bruto menos o custo mensal do robô', money(example.steadyNet)],
  ];

  const indicatorRows: string[][] = [
    ['Investimento bruto', 'Soma dos itens de investimento', money(example.grossCapex)],
    ['Investimento evitado', 'O que deixou de ser gasto, nesta loja', money(example.avoidedCapex)],
    ['Créditos recuperáveis', 'Comprovável. Entra no mês 0', money(example.recoverableTaxCredit)],
    ['Investimento líquido', 'Bruto menos evitado menos crédito', money(example.netInvestment)],
    ['Benefício operacional anual', 'Benefício bruto do mês 60 vezes 12', money(example.indicators.annualOperatingBenefit)],
    ['Economia acumulada em 60 meses', 'Soma do benefício bruto no horizonte', money(example.indicators.accumulatedSavings)],
    ['Operacional líquido anual', 'Líquido do mês 60 vezes 12', money(example.annualSteadyNet)],
    ['Retorno anual simples estabilizado', 'Líquido anual dividido pelo investimento líquido', formatPercent(example.roi)],
    [
      'Retorno acumulado em 60 meses',
      'Soma dos operacionais líquidos dividida pelo investimento',
      formatPercent(example.indicators.cumulativeRoi),
    ],
    ['Caixa acumulado', 'Acumulado do mês 60, já com a data zero', money(example.indicators.cumulativeCash)],
    [
      'Payback simples',
      example.firstPositiveMonth
        ? `Caixa acumulado positivo no mês ${example.firstPositiveMonth}`
        : 'Não cruza zero no horizonte',
      formatPayback(example.payback),
    ],
    ['Payback descontado', 'A mesma interpolação no caixa descontado', formatPayback(example.discountedPayback)],
    ['Valor presente', 'Soma dos fluxos descontados', money(example.npv)],
    [
      'Caixa descontado acumulado',
      'Mesma leitura, neste exemplo plano',
      money(example.indicators.cumulativeDiscountedCash),
    ],
    [
      'Taxa interna de retorno',
      example.irrMonthly === null ? 'Sem taxa mensal' : `Mensal ${formatPercent(example.irrMonthly, 2)}`,
      formatIrr(example.irrAnnual),
    ],
  ];

  const scenarioRows = STORE_TYPES.flatMap((storeType) =>
    SCENARIOS.map((scenario) => {
      const result = evaluated(storeType, scenario);
      return [
        `${scenarioLabel(scenario)}, ${storeLabel(storeType).toLowerCase()}`,
        money(result.netInvestment),
        money(result.steadyNet),
        formatPayback(result.payback),
        formatPercent(result.roi),
        money(result.npv),
        formatIrr(result.irrAnnual),
      ];
    }),
  );

  const storeRows = stores.flatMap((store) =>
    store.cells.map((cell) => [
      store.name,
      scenarioLabel(cell.scenario),
      money(cell.result.netInvestment),
      money(cell.result.monthlyOpex),
      money(cell.result.steadyNet),
      formatPayback(cell.result.payback),
      formatPercent(cell.result.indicators.cumulativeRoi),
      money(cell.result.npv),
    ]),
  );

  const excludedRows = excluded.map((line) => [line.label, line.reason, money(line.monthlyValue)]);
  const storeSentence = baseStores
    .map((store) => `${store.name} no cenário base ${paybackNote(store.payback)}`)
    .join('. ');

  return [
    '<section data-testid="engine-examples">',
    '<h2 id="sensibilidade-calculada">Sensibilidade calculada</h2>',
    '<p>Cenário base, loja nova do exemplo fictício. Payback simples em cada alavanca, nos pontos de −30%, −15%, zero, +15% e +30%. Os valores saem da mesma conta da calculadora no momento da publicação.</p>',
    table(['Alavanca', '−30%', '−15%', '0', '+15%', '+30%'], sensitivityRows),
    '<h2 id="exemplo-calculado">Exemplo calculado</h2>',
    `<p>Cenário base, loja nova. Investimento líquido ${escapeHtml(money(example.netInvestment))}, benefício líquido ${escapeHtml(money(example.steadyNet))} por mês, payback simples ${escapeHtml(formatPayback(example.payback))}.</p>`,
    table(['Benefício que entra no caixa', 'De onde vem', 'R$/mês'], benefitRows),
    table(['Indicador', 'Leitura', 'Resultado'], indicatorRows),
    excludedRows.length
      ? `<h3 id="exemplo-fora-do-fluxo">Fora do fluxo neste exemplo</h3>${table(
          ['Linha', 'Por que ficou de fora', 'R$/mês na auditoria'],
          excludedRows,
        )}`
      : '',
    '<h2 id="cenarios-calculados">Cenários calculados</h2>',
    '<p>O mesmo exemplo, nos três cenários e nos dois tipos de loja.</p>',
    table(
      ['Cenário e loja', 'Investimento líquido', 'Líquido por mês', 'Payback', 'Retorno estabilizado', 'Valor presente', 'Taxa ao ano'],
      scenarioRows,
    ),
    '<h2 id="lojas-calculadas">Lojas calculadas</h2>',
    '<p>Lojas fictícias de R$ 1, 2 e 4 milhões, já existentes. O payback não foi encurtado para caber em 30 meses.</p>',
    table(
      ['Modelo', 'Cenário', 'Investimento líquido', 'Custo mensal', 'Líquido por mês', 'Payback', 'Retorno acumulado', 'Valor presente'],
      storeRows,
    ),
    `<p>${escapeHtml(storeSentence)}.</p>`,
    '</section>',
  ].join('');
}
