import {
  DISCLAIMER,
  SCENARIO_LABELS,
  SCENARIOS,
  evaluate,
  formatBRL,
  formatMonths,
  formatNumber,
  formatPct,
  parseBr,
  percentPoints,
} from './calc.js';

const STORAGE_KEY = 'gcalc.roi-mes.v1';

const NUMBER_FIELDS = [
  'lotesAno',
  'b1HorasProd',
  'b1HorasQual',
  'b1TempoSem',
  'b1TempoCom',
  'b1Dias',
  'b1ValorLote',
  'b2Campos',
  'b2Segundos',
  'b3DesviosMes',
  'b3Horas',
  'b4Lotes',
  'b4Valor',
  'b5LimpezasMes',
  'b5Minutos',
  'b5Ocorrencias',
  'b5Custo',
  'b6Paginas',
  'b6CustoPagina',
  'b6Arquivo',
  'b6Co2',
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
  'b1PctSemDesvio',
  'b1CustoCapital',
  'b3PctConservador',
  'b3PctProvavel',
  'b3PctOtimista',
  'b4Pct',
  'curva1',
  'curva2',
  'curva3',
  'taxa',
];

const TEXT_FIELDS = ['b7Nota', 'b8Nota'];
const BLOCKS = {
  b1: 'Revisão e aprovação do lote',
  b2: 'Lançamento manual',
  b3: 'Desvios de documentação',
  b4: 'Lotes perdidos',
  b5: 'Limpeza e status',
  b6: 'Papel e arquivo',
};

let scenario = 'provavel';

function readValue(id) {
  return document.getElementById(id)?.value ?? '';
}

function readInput() {
  const input = {
    scope: document.querySelector('input[name="scope"]:checked')?.value || 'completo',
    modo: document.querySelector('input[name="modo"]:checked')?.value || 'dedicado',
    incluirHoras: document.getElementById('incluirHoras').checked,
    b3Pct: {
      conservador: percentPoints(readValue('b3PctConservador')),
      provavel: percentPoints(readValue('b3PctProvavel')),
      otimista: percentPoints(readValue('b3PctOtimista')),
    },
    curva: [percentPoints(readValue('curva1')), percentPoints(readValue('curva2')), percentPoints(readValue('curva3'))],
    b7Nota: readValue('b7Nota').trim(),
    b8Nota: readValue('b8Nota').trim(),
  };
  for (const id of NUMBER_FIELDS) input[id] = parseBr(readValue(id));
  input.b1PctSemDesvio = percentPoints(readValue('b1PctSemDesvio'));
  input.b1CustoCapital = percentPoints(readValue('b1CustoCapital'));
  input.b4Pct = percentPoints(readValue('b4Pct'));
  input.taxa = percentPoints(readValue('taxa'));
  input.horasFte = parseBr(readValue('horasFte'));
  return input;
}

function snapshot() {
  const data = { scenario };
  for (const id of [...NUMBER_FIELDS, ...PERCENT_FIELDS, ...TEXT_FIELDS]) data[id] = readValue(id);
  data.scope = document.querySelector('input[name="scope"]:checked')?.value || 'completo';
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return;
    for (const id of [...NUMBER_FIELDS, ...PERCENT_FIELDS, ...TEXT_FIELDS]) {
      const field = document.getElementById(id);
      if (field && typeof data[id] === 'string') field.value = data[id];
    }
    if (data.scope === 'pesagem' || data.scope === 'completo') {
      const radio = document.querySelector(`input[name="scope"][value="${data.scope}"]`);
      if (radio) radio.checked = true;
    }
    if (data.modo === 'dedicado' || data.modo === 'base') {
      const radio = document.querySelector(`input[name="modo"][value="${data.modo}"]`);
      if (radio) radio.checked = true;
    }
    if (typeof data.incluirHoras === 'boolean') document.getElementById('incluirHoras').checked = data.incluirHoras;
    if (SCENARIOS.includes(data.scenario)) scenario = data.scenario;
  } catch {
    /* armazenamento corrompido */
  }
}

function applyScope(scope) {
  const weighing = scope === 'pesagem';
  document.querySelectorAll('[data-full]').forEach((node) => {
    node.hidden = weighing;
  });
  document.getElementById('b2-title').textContent = weighing
    ? 'B2 · Lançamento manual na pesagem'
    : 'B2 · Eliminação de lançamento manual';
  document.getElementById('b2-campos').textContent = weighing ? 'Campos manuais da pesagem por lote' : 'Campos manuais por lote';
  document.getElementById('b3-title').textContent = weighing
    ? 'B3 · Erros e desvios da documentação de pesagem'
    : 'B3 · Erros de preenchimento e desvios de documentação';
  document.getElementById('b6-title').textContent = weighing
    ? 'B6 · Papel da ordem de pesagem'
    : 'B6 · Papel, impressão e arquivo';
  document.getElementById('b6-paginas').textContent = weighing ? 'Páginas da ordem de pesagem por lote' : 'Páginas por lote';
  document.getElementById('scope-label').textContent = weighing ? 'Só pesagem' : 'MES/EBR completo';
  document.getElementById('break-even-card').hidden = weighing;
}

function moneyCell(value) {
  return `<td class="num">${formatBRL(value)}</td>`;
}

function render(result) {
  applyScope(result.scope);
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

  const rows = Object.entries(BLOCKS).filter(([key]) => result.scope === 'completo' || ['b2', 'b3', 'b6'].includes(key));
  document.getElementById('blocks').innerHTML = rows.map(([key, label]) => {
    const block = current.blocks[key];
    return `<tr><th>${label}</th>${moneyCell(block.caixa)}<td class="num">${formatNumber(block.horas, 0)} h</td>${moneyCell(block.total)}</tr>`;
  }).join('') + (result.ambiente > 0
    ? `<tr><th>Ambiente, fora do ROI</th><td class="num" colspan="3">${formatNumber(result.ambiente, 1)} kg CO₂/ano</td></tr>`
    : '');

  document.getElementById('people').innerHTML = [
    ['Produção', current.horasProducao, current.fteProducao, current.reaisProducao],
    ['Qualidade', current.horasQualidade, current.fteQualidade, current.reaisQualidade],
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

  const notes = [
    result.scope === 'completo' && result.inputNotes,
  ];
  document.getElementById('break-even').textContent = result.breakEven == null
    ? 'Informe os lotes rejeitados e o valor médio do lote para ver qual percentual evita o suficiente para cobrir o investimento inicial e um ano de assinatura.'
    : `O projeto precisa evitar ${formatPct(result.breakEven)} das perdas anuais (${formatBRL(result.perdaAnual)}) para cobrir ${formatBRL(result.money.total + result.money.licenca)}. A parcela evitável que você informou segue igual nos três cenários.`;

  const assumptions = [
    result.scope === 'pesagem'
      ? 'Escopo só pesagem: entram lançamento manual, desvios de documentação da pesagem e papel da ordem. Revisão, perdas, limpeza, inspeção e quadro ficam de fora.'
      : 'Escopo MES/EBR completo. Inspeção e crescimento de quadro ficam só no texto e fora do payback.',
    `Lotes por ano usados na conta: ${formatNumber(result.lotes, 0)}.`,
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
    readValue('b7Nota') ? `Inspeção: ${readValue('b7Nota')}` : '',
    readValue('b8Nota') ? `Crescimento sem aumentar o quadro: ${readValue('b8Nota')}` : '',
  ].filter(Boolean);
  document.getElementById('assumptions').innerHTML = assumptions.map((item) => `<li>${item}</li>`).join('');
  document.getElementById('disclaimer').textContent = DISCLAIMER;
  void notes;
}

function refresh() {
  const result = evaluate(readInput());
  render(result);
  persist();
}

function bind() {
  const form = document.getElementById('form');
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    button.addEventListener('click', () => {
      scenario = button.dataset.scenario;
      refresh();
    });
  });
  document.getElementById('print').addEventListener('click', () => window.print());
  document.getElementById('reset').addEventListener('click', () => {
    form.reset();
    document.querySelector('input[name="scope"][value="completo"]').checked = true;
    document.querySelector('input[name="modo"][value="dedicado"]').checked = true;
    document.getElementById('incluirHoras').checked = true;
    scenario = 'provavel';
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
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
