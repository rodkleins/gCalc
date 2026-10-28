import {
  DISCLAIMER,
  EXAMPLE_FIELDS,
  EXAMPLE_FLAGS,
  SCENARIOS,
  evaluate,
  formatBRL,
  formatMonths,
  formatNumber,
  formatPct,
  parseBr,
  percentPoints,
} from './calc.js';

const STORAGE_KEY = 'gcalc.roi-mes.v2';

const NUMBER_FIELDS = [
  'opsAno',
  'b2Campos',
  'b2Segundos',
  'b2Pesagens',
  'b2Minutos',
  'b3HorasProd',
  'b3HorasQual',
  'b3TempoSem',
  'b3TempoCom',
  'b3Dias',
  'b3ValorOp',
  'b4HorasErro',
  'b4DesviosAno',
  'b4HorasDesvio',
  'b5Qtd',
  'b5Valor',
  'b6Registros',
  'b6Minutos',
  'b6Ocorrencias',
  'b6Custo',
  'b7Paginas',
  'b7CustoPagina',
  'b7Arquivo',
  'b7Co2',
  'custoHoraProd',
  'custoHoraQual',
  'horasFte',
  'licenca',
  'implantacao',
  'validacao',
  'integracao',
  'infraestrutura',
  'tempoInterno',
  'treinamento',
  'receitas',
];

const PERCENT_FIELDS = [
  'b3PctSem',
  'b3CustoCapital',
  'b4PctErro',
  'b4PctConservador',
  'b4PctProvavel',
  'b4PctOtimista',
  'b5Pct',
  'curva1',
  'curva2',
  'curva3',
  'taxa',
];

const TEXT_FIELDS = ['b8Nota', 'b9Nota'];
const BLOCK_ORDER = ['preenchimento', 'pesagem', 'revisao', 'erros', 'desvios', 'perdas', 'limpeza', 'papel'];

let scenario = 'provavel';
let showingExample = false;

function banner() {
  return document.getElementById('example-banner');
}

function setExampleVisible(on) {
  showingExample = on;
  const node = banner();
  if (node) node.hidden = !on;
}

function writeFields(values) {
  for (const id of [...NUMBER_FIELDS, ...PERCENT_FIELDS, ...TEXT_FIELDS]) {
    const field = document.getElementById(id);
    if (field) field.value = values[id] ?? '';
  }
}

function fillExample() {
  writeFields(EXAMPLE_FIELDS);
  document.querySelector('input[name="modo"][value="dedicado"]').checked = true;
  document.getElementById('b2Dupla').checked = EXAMPLE_FLAGS.b2Dupla;
  document.getElementById('incluirHoras').checked = EXAMPLE_FLAGS.incluirHoras;
  scenario = 'provavel';
  setExampleVisible(true);
}

function clearPlant() {
  writeFields({});
  document.getElementById('b2Dupla').checked = false;
  setExampleVisible(false);
}

function readValue(id) {
  return document.getElementById(id)?.value ?? '';
}

function readInput() {
  const input = {
    modo: document.querySelector('input[name="modo"]:checked')?.value || 'dedicado',
    incluirHoras: document.getElementById('incluirHoras').checked,
    b2Dupla: document.getElementById('b2Dupla').checked,
    b4Pct: {
      conservador: percentPoints(readValue('b4PctConservador')),
      provavel: percentPoints(readValue('b4PctProvavel')),
      otimista: percentPoints(readValue('b4PctOtimista')),
    },
    curva: [percentPoints(readValue('curva1')), percentPoints(readValue('curva2')), percentPoints(readValue('curva3'))],
    b8Nota: readValue('b8Nota').trim(),
    b9Nota: readValue('b9Nota').trim(),
  };
  for (const id of NUMBER_FIELDS) input[id] = parseBr(readValue(id));
  input.b3PctSem = percentPoints(readValue('b3PctSem'));
  input.b3CustoCapital = percentPoints(readValue('b3CustoCapital'));
  input.b4PctErro = percentPoints(readValue('b4PctErro'));
  input.b5Pct = percentPoints(readValue('b5Pct'));
  input.taxa = percentPoints(readValue('taxa'));
  input.horasFte = parseBr(readValue('horasFte'));
  return input;
}

function snapshot() {
  const data = { scenario, example: showingExample, b2Dupla: document.getElementById('b2Dupla').checked };
  for (const id of [...NUMBER_FIELDS, ...PERCENT_FIELDS, ...TEXT_FIELDS]) data[id] = readValue(id);
  data.modo = document.querySelector('input[name="modo"]:checked')?.value || 'dedicado';
  data.incluirHoras = document.getElementById('incluirHoras').checked;
  return data;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
  } catch {
    /* navegador sem armazenamento */
  }
}

function restore() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    fillExample();
    return;
  }
  if (!raw) {
    fillExample();
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      fillExample();
      return;
    }
    for (const id of [...NUMBER_FIELDS, ...PERCENT_FIELDS, ...TEXT_FIELDS]) {
      const field = document.getElementById(id);
      if (field && typeof data[id] === 'string') field.value = data[id];
    }
    if (typeof data.b2Dupla === 'boolean') document.getElementById('b2Dupla').checked = data.b2Dupla;
    if (data.modo === 'dedicado' || data.modo === 'base') {
      const radio = document.querySelector(`input[name="modo"][value="${data.modo}"]`);
      if (radio) radio.checked = true;
    }
    if (typeof data.incluirHoras === 'boolean') document.getElementById('incluirHoras').checked = data.incluirHoras;
    if (SCENARIOS.includes(data.scenario)) scenario = data.scenario;
    setExampleVisible(data.example === true);
  } catch {
    fillExample();
  }
}

function moneyCell(value) {
  return `<td class="num">${formatBRL(value)}</td>`;
}

function render(result) {
  const current = result.scenarios[scenario];
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.scenario === scenario ? 'true' : 'false');
  });
  const paybackBase = result.incluirHoras ? 'caixa + horas' : 'só caixa';
  document.getElementById('kpis').innerHTML = [
    ['Caixa por ano', formatBRL(current.caixa)],
    ['Capacidade', `${formatNumber(current.horasProducao + current.horasQualidade, 0)} h`],
    ['Equivalente das horas', formatBRL(current.reaisHoras)],
    ['Base do payback', formatBRL(current.base)],
    ['Payback', formatMonths(current.paybackMeses)],
    ['Ganho no ano 1', formatBRL(current.ano1)],
  ].map(([label, value]) => `<article class="kpi"><span>${label}</span><strong>${value}</strong></article>`).join('')
    + `<p class="hint">Payback em ${paybackBase}. Capacidade e caixa aparecem separados mesmo quando as horas entram na conta.</p>`;

  document.getElementById('blocks').innerHTML = BLOCK_ORDER.map((key) => {
    const block = current.blocks[key];
    const steps = (block.formula || []).map((line) => `<p class="formula">${line}</p>`).join('');
    return `<tr>
      <th>${block.label}<details class="calc"><summary>Ver cálculo</summary>${steps}</details></th>
      ${moneyCell(block.caixa)}
      <td class="num">${formatNumber(block.horas, 1)} h</td>
      ${moneyCell(block.total)}
    </tr>`;
  }).join('') + (result.ambiente > 0
    ? `<tr><th>Ambiente, fora do ROI</th><td class="num" colspan="3">${formatNumber(result.ambiente, 1)} kg CO₂/ano</td></tr>`
    : '');

  document.getElementById('people').innerHTML = [
    ['Produção', current.horasProducao, current.fteProducao, current.reaisProducao],
    ['Garantia da Qualidade', current.horasQualidade, current.fteQualidade, current.reaisQualidade],
  ].map(([name, hours, fte, reais]) => `
    <article class="person">
      <span>${name}</span>
      <strong>${formatNumber(hours, 0)} h/ano</strong>
      <p>${formatNumber(fte, 2)} FTE · ${formatBRL(reais)}</p>
    </article>`).join('');

  const metric = (label, pick, format) => `<tr><th>${label}</th>${SCENARIOS.map((name) => `<td class="num">${format(pick(result.scenarios[name]))}</td>`).join('')}</tr>`;
  document.getElementById('compare').innerHTML = [
    metric('Redução de desvios', (item) => item.pct, formatPct),
    metric('Caixa', (item) => item.caixa, formatBRL),
    metric('Horas em R$', (item) => item.reaisHoras, formatBRL),
    metric('Base do payback', (item) => item.base, formatBRL),
    metric('Payback', (item) => item.paybackMeses, formatMonths),
    metric('ROI em 3 anos', (item) => item.roi3, formatPct),
    metric('ROI em 5 anos', (item) => item.roi5, formatPct),
    metric('VPL em 3 anos', (item) => item.npv3, formatBRL),
    metric('VPL em 5 anos', (item) => item.npv5, formatBRL),
  ].join('');

  document.getElementById('break-even').textContent = result.breakEven == null
    ? 'Informe os lotes rejeitados e o valor médio do lote para ver qual percentual evita o suficiente para cobrir o investimento inicial e um ano de assinatura.'
    : `O projeto precisa evitar ${formatPct(result.breakEven)} das perdas anuais (${formatBRL(result.perdaAnual)}) para cobrir ${formatBRL(result.money.total + result.money.licenca)}. A parcela evitável que você informou segue igual nos três cenários.`;

  const assumptions = [
    'OP e lote são a mesma coisa. Inspeção e crescimento de quadro ficam só no texto e fora do payback.',
    `OPs (lotes) por ano usados na conta: ${formatNumber(result.ops, 0)}.`,
    result.incluirHoras
      ? 'As horas economizadas entram no payback, convertidas pelo custo-hora de cada área.'
      : 'O payback usa só caixa: lotes perdidos, papel, arquivo, ocorrências e capital de giro.',
    result.fte.assumed
      ? 'Horas por FTE em branco: o equivalente de quadro usa 1.760 h/ano.'
      : `Equivalente de quadro usa ${formatNumber(result.fte.horas, 0)} h por FTE.`,
    result.curve.assumed
      ? 'Curva de aprendizado em branco: 0%, 50% e 100% nos meses 1 a 3.'
      : `Curva informada: ${result.curve.values.map((item) => formatPct(item)).join(', ')}.`,
    result.modo === 'base'
      ? 'Implantação pela base com key users: cada fator da curva dura dois meses e o ganho cheio começa no mês 7.'
      : 'Implantação planta a planta com time dedicado: a curva vale nos meses 1 a 3 e o ganho cheio começa no mês 4.',
    'Os cenários conservador, provável e otimista mudam somente o percentual de redução dos desvios de documentação.',
    'O CO₂ das páginas não entra no ROI, no payback nem no VPL.',
    'Referências do painel são exemplos sem nome de cliente e não preenchem campo nenhum.',
    result.taxa == null
      ? 'VPL em branco até você informar a taxa de desconto.'
      : `VPL descontado a ${formatPct(result.taxa)} ao ano.`,
    readValue('b8Nota') ? `Inspeção: ${readValue('b8Nota')}` : '',
    readValue('b9Nota') ? `Crescimento sem aumentar o quadro: ${readValue('b9Nota')}` : '',
  ].filter(Boolean);
  document.getElementById('assumptions').innerHTML = assumptions.map((item) => `<li>${item}</li>`).join('');
  document.getElementById('disclaimer').textContent = DISCLAIMER;
}

function refresh() {
  const result = evaluate(readInput());
  render(result);
  persist();
}

function bind() {
  const form = document.getElementById('form');
  const edited = () => {
    setExampleVisible(false);
    refresh();
  };
  form.addEventListener('input', edited);
  form.addEventListener('change', edited);
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    button.addEventListener('click', () => {
      scenario = button.dataset.scenario;
      refresh();
    });
  });
  document.getElementById('print').addEventListener('click', () => window.print());
  document.getElementById('clear-data').addEventListener('click', () => {
    clearPlant();
    refresh();
  });
  document.getElementById('restore-example').addEventListener('click', () => {
    fillExample();
    refresh();
  });
  const workspace = document.getElementById('workspace');
  const toggle = document.getElementById('toggle-params');
  const backdrop = document.getElementById('backdrop');
  const wide = () => window.matchMedia('(min-width: 900px)').matches;
  let open = wide();
  const setOpen = (next) => {
    open = next;
    workspace.classList.toggle('collapsed', wide() && !open);
    workspace.classList.toggle('drawer', !wide() && open);
    backdrop.hidden = wide() || !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = wide() && open ? 'Recolher' : 'Dados';
  };
  setOpen(open);
  toggle.addEventListener('click', () => setOpen(!open));
  backdrop.addEventListener('click', () => setOpen(false));
  window.matchMedia('(min-width: 900px)').addEventListener('change', () => setOpen(wide()));
}

restore();
bind();
refresh();
