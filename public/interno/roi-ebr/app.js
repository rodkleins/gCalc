import {
  CASO_REAL_PRESET,
  DISCLAIMER,
  FIELD_IDS,
  SCENARIOS,
  cashCurve,
  emptyInput,
  evaluate,
  exampleInput,
  formatBRL,
  formatCompactBRL,
  formatNumber,
  formatPayback,
  formatPct,
  formatRoi,
  parseDecimal,
  yearlyCash,
} from './calc.js';

const STORAGE_KEY = 'neo-roi:v1:current';
const THEME_KEY = 'neo-roi:v1:theme';
const NOTES = {
  exemplo: 'Os campos estão preenchidos com uma planta fictícia de médio porte, apenas para demonstração. Os valores de investimento são hipotéticos e não representam o preço do NEO.',
  casoreal: 'Simulação interna de um cliente farmacêutico com dados estimados. Só o número de campos por instrução (500) foi informado; todo o resto é premissa a validar com o cliente. O investimento é hipotético e não é o valor do contrato. Não divulgar sem autorização do cliente.',
  vazio: 'Campos limpos. Captura permanece em 50% e a taxa de desconto em 14%.',
};
const HOURS_PER_PERSON = 1800;
const SEGMENTS = [
  ['op', 'Preenchimento', 's0'],
  ['pr', 'Revisão da produção', 's1'],
  ['gq', 'Revisão da GQ', 's2'],
  ['co', 'Correções', 's3'],
];

/* Cartões do passo 04: mesmos campos e textos de ajuda da versão anterior. */
const CARDS = [
  {
    id: 'b1', title: 'Capital de giro na quarentena', hint: 'Lote liberado antes, menos estoque parado.',
    desc: 'Considere só os dias que dependem da revisão do registro, não do laboratório.',
    fields: [['b1vl', 'Valor médio de um lote', 'R$'], ['b1d', 'Dias de quarentena a menos', 'dias'], ['b1cc', 'Custo de capital anual', '%']],
  },
  {
    id: 'b3', title: 'Desvios de documentação', hint: 'Investigações abertas por erro de registro.',
    desc: 'Só o que vira desvio formal, com investigação. Correção simples dentro do registro já está no campo de erros.',
    fields: [['b3d', 'Desvios de documentação por mês', '/mês'], ['b3h', 'Horas por desvio', 'h']],
    ref: 'Referência relatada: plantas geram em média pouco mais de 1.000 desvios por ano, variando com o porte. Faixa típica de horas, a confirmar: menor 4–8 h, maior 16–40 h, crítico 40–100 h.',
  },
  {
    id: 'b3b', title: 'Desvios de processo', hint: 'Sequência, faixa fora, material errado.',
    desc: 'Sequência, faixa fora, material errado, tempo de espera. Não é erro de preenchimento. A redução fica até 50%.',
    fields: [['b3bd', 'Desvios de processo por mês', '/mês'], ['b3bh', 'Horas por desvio', 'h'], ['b3br', 'Redução esperada', '%']],
    alert: ['process-alert', 'Redução acima de 50% em desvios de processo não tem referência publicada.'],
  },
  {
    id: 'b4', title: 'Lotes perdidos e retrabalho', hint: 'Perdas por causa que o sistema evitaria.',
    fields: [['b4n', 'Lotes por ano por causa evitável', '/ano'], ['b4v', 'Custo médio de cada perda', 'R$'], ['b4e', 'Parcela que o sistema evitaria', '%']],
  },
  {
    id: 'b5', title: 'Limpeza e status de equipamento', hint: 'Controle manual de limpeza e ocorrências.',
    fields: [['b5l', 'Limpezas por mês', '/mês'], ['b5m', 'Controle manual por limpeza', 'min'], ['b5r', 'Redução do controle manual', '%'], ['b5o', 'Ocorrências por ano', '/ano'], ['b5c', 'Custo médio por ocorrência', 'R$']],
  },
  {
    id: 'lb', title: 'Logbooks', hint: 'Campos de equipamento e sala fora da ordem.',
    desc: 'Campos de equipamento, sala e limpeza que não estão na instrução da ordem.',
    fields: [['lbF', 'Campos de logbook por ordem', 'campos'], ['lbsf', 'Tempo para preencher um campo', 's'], ['lbsq', 'Tempo para revisar um campo', 's'], ['lbauto', 'Campos capturados ou eliminados', '%']],
    alert: ['logbook-note', 'Não inclua no logbook os registros de limpeza já contados no bloco de limpeza.'],
  },
  {
    id: 'b6', title: 'Papel, impressão e arquivo', hint: 'Páginas, arquivo físico e buscas.',
    fields: [['b6p', 'Páginas por lote', 'pág.'], ['b6cp', 'Custo por página', 'R$'], ['b6a', 'Arquivo físico por ano', 'R$'], ['b6b', 'Buscas de registros por ano', '/ano'], ['b6hb', 'Horas por busca', 'h'], ['b6e', 'Registros eletrônicos por ano', 'R$']],
  },
  {
    id: 'b9', title: 'Monitoramento ambiental', hint: 'Leituras manuais e investigação de excursões.',
    fields: [['b9l', 'Horas por mês em leituras manuais', 'h/mês'], ['b9x', 'Excursões investigadas por mês', '/mês'], ['b9hh', 'Horas por investigação hoje', 'h'], ['b9hc', 'Horas por investigação com correlação', 'h']],
  },
  {
    id: 'cap', title: 'Capacidade no gargalo', hint: 'Só se a planta vende tudo que produz.',
    desc: 'Só vale para o equipamento que limita a produção da planta e se houver demanda para os lotes adicionais. O preenchimento durante a execução não entra.',
    check: true,
    fields: [['capm', 'Minutos por ordem em que o gargalo espera documentação', 'min'], ['capr', 'Redução com EBR', '%'], ['caph', 'Horas de gargalo por lote', 'h'], ['capmg', 'Margem de contribuição por lote adicional', 'R$'], ['capd', 'Parcela que o mercado absorveria', '%']],
  },
];

let state = { ...exampleInput(), preset: 'exemplo' };
let openCard = null;

const $ = (id) => document.getElementById(id);
const money = (value) => formatCompactBRL(value);
const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function buildCards() {
  $('cards').innerHTML = CARDS.map((card) => {
    const fields = card.fields.map(([id, label, unit]) => `
      <label class="field"><span class="lbl">${esc(label)}</span>
        <span class="in"><input id="${id}" inputmode="decimal" /><span class="unit">${esc(unit)}</span></span>
      </label>`).join('');
    return `
    <div class="card" data-card="${card.id}">
      <button type="button" class="cardbtn" aria-expanded="false" aria-controls="body-${card.id}">
        <span class="card-title">${esc(card.title)}</span>
        <span class="card-gain mono" data-gain="${card.id}">—</span>
        <span class="card-hint">${esc(card.hint)}</span>
        <span class="chev" aria-hidden="true">+</span>
      </button>
      <div class="card-body" id="body-${card.id}">
        ${card.desc ? `<p class="card-desc">${esc(card.desc)}</p>` : ''}
        ${card.check ? '<label class="check"><input type="checkbox" id="capOn" /> Minha planta vende tudo que produz</label>' : ''}
        <div class="fields">${fields}</div>
        ${card.alert ? `<p class="alert" id="${card.alert[0]}" role="status" hidden>${esc(card.alert[1])}</p>` : ''}
        ${card.ref ? `<p class="ref">${esc(card.ref)}</p>` : ''}
        <details class="calc"><summary>Ver cálculo</summary><div data-formula="${card.id}"></div></details>
      </div>
    </div>`;
  }).join('');
  $('cards').addEventListener('click', (event) => {
    const button = event.target.closest('.cardbtn');
    if (!button) return;
    const id = button.parentElement.dataset.card;
    openCard = openCard === id ? null : id;
    syncCards();
  });
  syncCards();
}

function syncCards() {
  document.querySelectorAll('.card').forEach((card) => {
    const open = card.dataset.card === openCard;
    card.classList.toggle('open', open);
    card.querySelector('.cardbtn').setAttribute('aria-expanded', open ? 'true' : 'false');
    card.querySelector('.chev').textContent = open ? '−' : '+';
  });
}

function sizeInline(input) {
  if (!input.classList.contains('ml')) return;
  input.style.width = `${Math.max(2, input.value.length) + 1.6}ch`;
}

function readForm() {
  const next = { capOn: $('capOn').checked, scenario: state.scenario, preset: state.preset };
  for (const id of FIELD_IDS) next[id] = parseDecimal($(id)?.value);
  return next;
}

function writeForm(values) {
  for (const id of FIELD_IDS) {
    const field = $(id);
    if (!field) continue;
    const value = values[id];
    field.value = value == null ? '' : String(value).replace('.', ',');
    if (field.type === 'range') field.value = value == null ? 0 : value;
    sizeInline(field);
  }
  $('capOn').checked = values.capOn === true;
}

function showNote(preset) {
  const note = $('preset-note');
  note.hidden = !NOTES[preset];
  note.textContent = NOTES[preset] || '';
}

function loadPreset(values, preset) {
  state = { ...values, capOn: values.capOn === true, scenario: state.scenario || 'provavel', preset };
  writeForm(state);
  showNote(preset);
  refresh();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* armazenamento indisponível */
  }
}

function restore() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    loadPreset(exampleInput(), 'exemplo');
    return;
  }
  if (!raw) {
    loadPreset(exampleInput(), 'exemplo');
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      loadPreset(exampleInput(), 'exemplo');
      return;
    }
    state.scenario = SCENARIOS[data.scenario] ? data.scenario : 'provavel';
    state.preset = data.preset || '';
    if (/^b\x69olab$/i.test(state.preset)) state.preset = 'casoreal';
    writeForm({ ...emptyInput(), ...data, capOn: data.capOn === true });
    showNote(state.preset);
    refresh();
  } catch {
    loadPreset(exampleInput(), 'exemplo');
  }
}

function paybackParts(result) {
  const text = formatPayback(result);
  const match = /^(\d+) (meses?|mês)$/.exec(text);
  if (match) return [match[1], match[2]];
  return [text, ''];
}

function renderHeader(result) {
  const [num, unit] = paybackParts(result);
  $('pay-big').textContent = num;
  $('pay-big').classList.toggle('long', num.length > 3);
  $('pay-unit').textContent = unit;
  $('scen-name').textContent = SCENARIOS[result.scenario].label.toLowerCase();
  $('h-roi3').textContent = formatRoi(result.timeline.roi3, result.blankFinance);
  $('h-roi5').textContent = formatRoi(result.timeline.roi5, result.blankFinance);
  $('k-pay').textContent = formatPayback(result);
  $('k-roi5').textContent = formatRoi(result.timeline.roi5, result.blankFinance);
  $('k-npv').textContent = result.blankFinance ? '—' : money(result.timeline.npv5);
  $('k-ben').textContent = money(result.benefit);
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    const on = button.dataset.scenario === result.scenario;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.classList.toggle('on', on);
  });
}

function renderRecord(result) {
  const om = result.orderMinutes;
  $('min-paper').textContent = formatNumber(om.today, 0);
  $('min-ebr').textContent = formatNumber(om.ebr, 0);
  const drop = om.today > 0 ? (om.today - om.ebr) / om.today : 0;
  $('min-drop').textContent = `${om.today > 0 ? `−${formatNumber(drop * 100, 0)}% de tempo · ` : ''}revisão da GQ ${formatNumber(om.gqToday, 0)} → ${formatNumber(om.gqEbr, 0)} min`;

  const { t, e } = result.record.seconds;
  const total = Object.values(t).reduce((sum, v) => sum + v, 0) || Object.values(e).reduce((sum, v) => sum + v, 0) || 1;
  const segs = (source) => SEGMENTS.map(([key, label, cls]) => {
    const share = source[key] / total;
    if (share <= 0) return '';
    const label2 = share > 0.07 ? `<span>${formatNumber(source[key] / 60, 0)}</span>` : '';
    return `<i class="${cls}" style="width:${(share * 100).toFixed(2)}%" title="${label}: ${formatNumber(source[key] / 60, 1)} min">${label2}</i>`;
  }).join('');
  $('segs-paper').innerHTML = segs(t);
  $('segs-ebr').innerHTML = segs(e);
  $('seg-legend').innerHTML = SEGMENTS.map(([, label, cls]) => `<span><span class="key ${cls}" aria-hidden="true"></span>${label}</span>`).join('') + '<span class="muted">min por ordem</span>';

  const keys = SEGMENTS.map(([key, label]) => [key, label]);
  const body = keys.map(([key, label]) => `<tr><th>${label}</th><td class="num">${formatNumber(result.record.T[key], 1)}</td><td class="num">${formatNumber(result.record.E[key], 1)}</td><td class="num">${formatNumber(Math.max(0, result.record.T[key] - result.record.E[key]), 1)}</td></tr>`).join('');
  $('compare').innerHTML = `<thead><tr><th>h/ano</th><th class="num">Hoje</th><th class="num">EBR</th><th class="num">Economia</th></tr></thead><tbody>${body}<tr class="total"><th>Total</th><td class="num">${formatNumber(result.record.totalT, 1)}</td><td class="num">${formatNumber(result.record.totalE, 1)}</td><td class="num">${formatNumber(Math.max(0, result.record.totalT - result.record.totalE), 1)}</td></tr></tbody>`;
  $('compare-note').textContent = `Por ordem: hoje ${formatNumber(om.today, 1)} min, com EBR ${formatNumber(om.ebr, 1)} min. Revisão da GQ: ${formatNumber(om.gqToday, 1)} min hoje e ${formatNumber(om.gqEbr, 1)} min com EBR. Equivale a ${formatNumber(result.people, 2)} pessoas (economia total ÷ 1.800 h/ano). Os cenários aplicam 50%, 75% ou 100% sobre essa economia, menos a correção de erros, que já tem percentual próprio.`;
}

function renderHours(result) {
  const capt = result.captura;
  const fte = result.H / HOURS_PER_PERSON;
  $('fte').textContent = formatNumber(fte, 1);
  $('hrs').textContent = `${formatNumber(result.H, 0)} h`;
  $('cap-people-pct').textContent = formatPct(capt);
  $('cap-cap-pct').textContent = formatPct(1 - capt);
  $('captura').style.setProperty('--fill', `${capt * 100}%`);
  $('people-val').textContent = `${money(result.HV * capt)}/ano`;
  $('people-fte').textContent = formatNumber(fte * capt, 1);
  $('cap-hrs').textContent = `${formatNumber(result.H * (1 - capt), 0)} h/ano`;
  $('cap-fte').textContent = formatNumber(fte * (1 - capt), 1);

  const lotes = Number(state.lotes) || 0;
  const reg = result.blocks.find((b) => b.id === 'reg');
  const totalT = result.record.totalT;
  const freed = (reg ? reg.hours : 0) * (1 - capt);
  $('lotes-txt').textContent = formatNumber(lotes, 0);
  $('orders-cap').textContent = lotes > 0 && totalT > freed ? formatNumber((lotes * totalT) / (totalT - freed), 0) : '—';

  const { prod, qa } = result.areas;
  /* Arredonda as partes para que somem exatamente o total exibido. */
  const parts = (total, first, digits) => {
    const f = 10 ** digits;
    const t = Math.round(total * f) / f;
    const a = Math.round(first * f) / f;
    return [a, Math.round((t - a) * f) / f, t];
  };
  const kilo = (value) => `R$ ${formatNumber(value, 0)} mil`;
  const hP = parts(result.H * capt, prod.savingHours, 0);
  const pP = parts(fte * capt, prod.savingPeople, 1);
  const vP = parts((result.HV * capt) / 1000, prod.savingValue / 1000, 0);
  $('people-split').innerHTML = `<thead><tr><th>Área</th><td>h/ano</td><td>pessoas</td><td>R$/ano</td></tr></thead><tbody>
    <tr><th>Produção</th><td>${formatNumber(hP[0], 0)}</td><td>${formatNumber(pP[0], 1)}</td><td>${kilo(vP[0])}</td></tr>
    <tr><th>Qualidade</th><td>${formatNumber(hP[1], 0)}</td><td>${formatNumber(pP[1], 1)}</td><td>${kilo(vP[1])}</td></tr>
    <tr class="total"><th>Total</th><td>${formatNumber(hP[2], 0)}</td><td>${formatNumber(pP[2], 1)}</td><td>${kilo(vP[2])}</td></tr></tbody>`;
  const hK = parts(result.H * (1 - capt), prod.capacityHours, 0);
  const pK = parts(fte * (1 - capt), prod.capacityPeople, 1);
  $('cap-split').innerHTML = `<thead><tr><th>Área</th><td>h/ano</td><td>pessoas</td></tr></thead><tbody>
    <tr><th>Produção</th><td>${formatNumber(hK[0], 0)}</td><td>${formatNumber(pK[0], 1)}</td></tr>
    <tr><th>Qualidade</th><td>${formatNumber(hK[1], 0)}</td><td>${formatNumber(pK[1], 1)}</td></tr>
    <tr class="total"><th>Total</th><td>${formatNumber(hK[2], 0)}</td><td>${formatNumber(pK[2], 1)}</td></tr></tbody>`;

  const icon = (cls) => `<svg class="pp ${cls}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.6"></circle><path d="M4.5 21c0-4.2 3.4-7.4 7.5-7.4s7.5 3.2 7.5 7.4z"></path></svg>`;
  const scale = fte > 40 ? 40 / fte : 1;
  const row = (area) => {
    const n = Math.round(area.people * scale * 2) / 2;
    const whole = Math.ceil(n);
    const peopleN = Math.round(n * capt);
    let html = '';
    for (let i = 0; i < whole; i += 1) html += icon(i < peopleN ? 'e' : 'k');
    const label = `${area.label}: ${formatNumber(area.people, 1)} pessoas-ano, ${formatNumber(area.savingPeople, 1)} viram economia e ${formatNumber(area.capacityPeople, 1)} viram capacidade`;
    return `<div class="people-area" data-area="${area.id}">
      <div class="people-area-h"><span>${area.label}</span><span class="mono">${formatNumber(area.people, 1)} pessoas · ${formatNumber(area.hours, 0)} h</span></div>
      <div class="people" role="img" aria-label="${esc(label)}">${html || '<span class="muted small">Sem horas liberadas.</span>'}</div>
    </div>`;
  };
  $('people').innerHTML = result.H > 0 ? row(prod) + row(qa) : '<span class="muted small">Sem horas liberadas.</span>';
  $('people-caption').textContent = `Cada figura ≈ 1 pessoa-ano (${formatNumber(HOURS_PER_PERSON, 0)} h)${fte > 40 ? ' · escala reduzida para até 40 figuras' : ''}`;

  const itemRows = (area) => area.items.filter((item) => item.hours > 0).map((item) => `<tr><th>${area.id === 'prod' ? 'Produção' : 'Qualidade'} · ${item.label}</th><td class="num">${formatNumber(item.hours, 1)}</td><td class="num">${formatBRL(item.cost)}</td><td class="num">${formatBRL(item.hv)}</td></tr>`).join('');
  const sumRow = (area) => `<tr class="total"><th>${area.label}</th><td class="num">${formatNumber(area.hours, 1)}</td><td class="num"></td><td class="num">${formatBRL(area.hv)}</td></tr>`;
  $('hours-calc').innerHTML = `
    <p class="formula">Horas liberadas = soma das horas de todos os blocos = ${formatNumber(result.H, 1)} h/ano. Pessoas-ano = horas ÷ ${formatNumber(HOURS_PER_PERSON, 0)} h = ${formatNumber(fte, 2)}.</p>
    <p class="formula">Produção = preenchimento do registro, revisão da produção, limpeza e preenchimento de logbook. Garantia da Qualidade = revisão da GQ, correções, desvios, buscas de registros, monitoramento ambiental e revisão de logbook. Custo-hora: operador ${formatBRL(Number(state.cOp) || 0)}; quem revisa (produção e GQ) ${formatBRL(Number(state.cGQ) || 0)}, como na spec.</p>
    <div class="table-wrap"><table class="yearly"><thead><tr><th>Área · atividade</th><th class="num">h/ano</th><th class="num">R$/h</th><th class="num">Valor/ano</th></tr></thead><tbody>${itemRows(prod)}${sumRow(prod)}${itemRows(qa)}${sumRow(qa)}<tr class="total"><th>Total</th><td class="num">${formatNumber(result.H, 1)}</td><td class="num"></td><td class="num">${formatBRL(result.HV)}</td></tr></tbody></table></div>
    <p class="formula">Economia de pessoas (${formatPct(capt)}): Produção ${formatNumber(prod.savingHours, 1)} h = ${formatNumber(prod.savingPeople, 2)} pessoas = ${formatBRL(prod.savingValue)}; Qualidade ${formatNumber(qa.savingHours, 1)} h = ${formatNumber(qa.savingPeople, 2)} pessoas = ${formatBRL(qa.savingValue)}; total ${formatBRL(result.HV * capt)}, que entra no ROI.</p>
    <p class="formula">Capacidade liberada (${formatPct(1 - capt)}): Produção ${formatNumber(prod.capacityHours, 1)} h; Qualidade ${formatNumber(qa.capacityHours, 1)} h; total ${formatNumber(result.H * (1 - capt), 1)} h. Não entra no ROI.</p>`;
}

function renderBlocks(result) {
  for (const item of result.blocks) {
    const gain = document.querySelector(`[data-gain="${item.id}"]`);
    if (gain) {
      if (item.id === 'cap' && !state.capOn) gain.textContent = 'desligado';
      else gain.textContent = item.gain === 0 ? '—' : `${money(item.gain)}/ano`;
      gain.classList.toggle('zero', item.gain === 0);
    }
    const formula = document.querySelector(`[data-formula="${item.id}"]`);
    if (formula) formula.innerHTML = item.formula.map((line) => `<p class="formula">${line}</p>`).join('');
  }
  const invest = document.querySelector('[data-gain="invest"]');
  if (invest) invest.textContent = result.investment.c1 ? `investimento ${money(result.investment.c1)}` : '';
  document.querySelector('[data-formula="invest"]').innerHTML = `<p class="formula">Mês 0 = − ${formatBRL(result.investment.c1)}. O custo recorrente de ${formatBRL(result.investment.c2)} por ano começa no mês 1. A entrada em operação é no mês ${formatNumber(result.investment.c3, 0)}: nesse mês e no anterior ao ganho cheio o fator é 0%; no mês seguinte, 50%; depois, 100%.</p>`;

  const maxGain = Math.max(...result.blocks.map((b) => Math.max(0, b.cash) + b.hv), 1);
  const rows = result.blocks.filter((b) => b.gain !== 0 || b.hv !== 0);
  $('bars').innerHTML = rows.map((b) => {
    const cw = (Math.max(0, b.cash) / maxGain) * 100;
    const pw = ((b.hv * result.captura) / maxGain) * 100;
    const kw = ((b.hv * (1 - result.captura)) / maxGain) * 100;
    const capTxt = b.hv * (1 - result.captura) > 0 ? ` <span class="c-cap">+ ${money(b.hv * (1 - result.captura))} em capacidade</span>` : '';
    return `<div class="bb-row"><div class="bb-head"><span>${b.label}</span><span class="mono"><b>${money(b.gain)}</b>${capTxt}</span></div>
      <div class="bb"><i class="c" style="width:${cw.toFixed(2)}%"></i><i class="p" style="width:${pw.toFixed(2)}%"></i><i class="k" style="width:${kw.toFixed(2)}%"></i></div></div>`;
  }).join('') || '<p class="muted">Sem benefício informado.</p>';
}

function renderKpis(result) {
  $('kpis').innerHTML = [
    ['ROI 3 anos', formatRoi(result.timeline.roi3, result.blankFinance)],
    ['ROI 5 anos', formatRoi(result.timeline.roi5, result.blankFinance)],
    ['VPL 5 anos', result.blankFinance ? '—' : money(result.timeline.npv5)],
    ['Benefício anual considerado', money(result.benefit)],
    ['Capacidade liberada', `${formatNumber(result.H, 0)} h/ano`],
    ['Valor dessas horas', money(result.HV)],
    ['Ganho direto em caixa', money(result.C)],
  ].map(([label, value]) => `<article class="kpi"><span>${label}</span><strong class="mono">${value}</strong></article>`).join('');
}

function renderChart(result) {
  const chart = $('chart');
  const warn = $('chart-warn');
  const meta = $('chart-meta');
  const foot = $('chart-foot');
  meta.textContent = result.blankFinance ? '' : `VPL ${money(result.timeline.npv5)} · ROI 3 ${formatRoi(result.timeline.roi3, false)} · ROI 5 ${formatRoi(result.timeline.roi5, false)}`;

  if (result.blankFinance) {
    warn.hidden = false;
    warn.textContent = 'Preencha o investimento ou os custos recorrentes para ver o caixa acumulado.';
    chart.innerHTML = '';
    foot.textContent = '';
    $('chart-calc').innerHTML = '';
    return;
  }

  const curve = cashCurve(result);
  const values = curve.map((p) => p.accumulated);
  const mn = Math.min(0, ...values);
  const mx = Math.max(0, ...values);
  const span = mx - mn || 1;
  const W = 1000;
  const H = 300;
  const X = (m) => (m / 60) * W;
  const Y = (v) => 14 + ((mx - v) / span) * 272;
  const y0 = Y(0);
  const line = curve.map((p) => `${X(p.month).toFixed(1)},${Y(p.accumulated).toFixed(1)}`).join(' ');
  const area = `${X(0)},${y0.toFixed(1)} ${line} ${X(60)},${y0.toFixed(1)}`;
  const pay = result.timeline.payback;
  const payX = pay != null ? X(pay) : null;

  const grid = [12, 24, 36, 48].map((m) => `<line class="grid" x1="${X(m)}" y1="14" x2="${X(m)}" y2="286" />`).join('');
  chart.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Caixa acumulado do mês 0 ao mês 60. Começa em ${formatBRL(-result.investment.c1)} e termina em ${formatBRL(values[60])}.${pay != null ? ` Empata no mês ${pay}.` : ' Não empata em 60 meses.'}">
      <defs>
        <clipPath id="clip-neg"><rect x="0" y="${y0.toFixed(1)}" width="${W}" height="${(H - y0).toFixed(1)}" /></clipPath>
        <clipPath id="clip-pos"><rect x="0" y="0" width="${W}" height="${y0.toFixed(1)}" /></clipPath>
      </defs>
      ${grid}
      <polygon class="neg" points="${area}" clip-path="url(#clip-neg)" />
      <polygon class="pos" points="${area}" clip-path="url(#clip-pos)" />
      <line class="zero" x1="0" y1="${y0.toFixed(1)}" x2="${W}" y2="${y0.toFixed(1)}" />
      ${payX != null ? `<line class="pay" x1="${payX.toFixed(1)}" y1="14" x2="${payX.toFixed(1)}" y2="286" />` : ''}
      <polyline class="ln" points="${line}" />
      ${payX != null ? `<circle class="pay-dot" cx="${payX.toFixed(1)}" cy="${Y(curve[pay].accumulated).toFixed(1)}" r="5" />` : ''}
    </svg>
    <span class="chart-zero mono" style="top:${((y0 / H) * 100).toFixed(2)}%">R$ 0</span>
    <span class="chart-start mono" style="top:${((Y(values[0]) / H) * 100).toFixed(2)}%">${money(values[0])}</span>
    <span class="chart-end mono" style="top:${((Y(values[60]) / H) * 100).toFixed(2)}%">${money(values[60])}</span>
    ${payX != null ? `<span class="pill mono${pay > 48 ? ' left' : ''}" style="left:${((payX / W) * 100).toFixed(2)}%">mês ${pay} · empata</span>` : ''}`;

  if (pay == null) {
    warn.hidden = false;
    warn.textContent = `Sem retorno em 60 meses: o caixa acumulado termina o ano 5 em ${formatBRL(values[60])}. Revise o investimento, os custos ou os ganhos.`;
  } else {
    warn.hidden = true;
    warn.textContent = '';
  }
  foot.innerHTML = `<span>pior ponto ${money(mn)} · fim do ano 5 ${money(values[60])}</span><span>curva de aprendizado 0% → 50% → 100% a partir do mês ${formatNumber(result.investment.c3, 0)}</span>`;

  const rows = yearlyCash(result).map((r) => `<tr><th>${r.year === 0 ? 'Ano 0 (mês 0)' : `Ano ${r.year} (meses ${(r.year - 1) * 12 + 1}–${r.year * 12})`}</th><td class="num">${formatBRL(r.benefit)}</td><td class="num">${formatBRL(r.cost)}</td><td class="num">${formatBRL(r.flow)}</td><td class="num${r.accumulated >= -0.005 ? ' pos-t' : ' neg-t'}">${formatBRL(r.accumulated)}</td></tr>`).join('');
  $('chart-calc').innerHTML = `
    <p class="formula">Mês 0 = − investimento (${formatBRL(result.investment.c1)}). A partir do mês 1: fluxo = benefício anual (${formatBRL(result.benefit)}) ÷ 12 × fator de aprendizado − custos recorrentes (${formatBRL(result.investment.c2)}) ÷ 12. Fator: 0% até o mês ${formatNumber(result.investment.c3 + 1, 0)}, 50% no mês ${formatNumber(result.investment.c3 + 2, 0)} e 100% depois. Cenário ${SCENARIOS[result.scenario].label.toLowerCase()}.</p>
    <p class="formula">Payback = primeiro mês em que o caixa acumulado chega a zero: ${formatPayback(result)}. É o mesmo número do topo da página.</p>
    <div class="table-wrap"><table class="yearly"><thead><tr><th>Ano</th><th class="num">Benefício</th><th class="num">Custo</th><th class="num">Fluxo</th><th class="num">Acumulado</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderScenarios(result) {
  const input = readForm();
  $('scenario-rows').innerHTML = Object.values(SCENARIOS).map((item) => {
    const view = item.id === result.scenario ? result : evaluate({ ...input, scenario: item.id });
    return `<button type="button" class="scen-row${item.id === result.scenario ? ' on' : ''}" data-scenario="${item.id}" aria-pressed="${item.id === result.scenario}">
      <span class="scen-name">${item.label}</span>
      <span class="mono scen-pay">${formatPayback(view)}</span>
      <span class="mono scen-roi">ROI 5 anos ${formatRoi(view.timeline.roi5, view.blankFinance)}</span></button>`;
  }).join('');
}

function render(result) {
  renderHeader(result);
  renderRecord(result);
  renderHours(result);
  renderBlocks(result);
  renderKpis(result);
  renderChart(result);
  renderScenarios(result);

  const breakEven = $('breakeven');
  if (result.breakeven == null) {
    breakEven.textContent = 'Preencha o bloco de lotes perdidos e o investimento para ver quanto das perdas atuais o projeto precisa evitar para se pagar.';
  } else {
    const extra = result.breakeven > 1 ? ' Isso é mais do que as perdas atuais: o projeto depende dos outros blocos.' : '';
    breakEven.textContent = `Mesmo sem nenhum outro ganho, o projeto se paga em 5 anos se evitar ${formatPct(result.breakeven)} das perdas de lote que vocês têm hoje (${formatBRL(result.lossesNow)} por ano).${extra}`;
  }

  $('gq-alert').hidden = !result.gqAlert;
  $('gq-alert').textContent = `A revisão da GQ está em ${formatNumber(result.gqMinutes, 0)} min por ordem. Referências do setor ficam entre 1h30 e 3h. Confira o tempo por campo.`;
  $('process-alert').hidden = !result.processAlert;
  $('logbook-note').hidden = !result.logbookNote;
  $('disclaimer').textContent = DISCLAIMER;
}

function refresh() {
  state = readForm();
  const result = evaluate(state);
  render(result);
  persist();
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('theme').textContent = theme === 'light' ? 'Tema escuro' : 'Tema claro';
}

function bind() {
  const form = $('form');
  form.addEventListener('input', (event) => {
    if (event.target.classList?.contains('ml')) sizeInline(event.target);
    refresh();
  });
  form.addEventListener('change', refresh);
  $('load-example').addEventListener('click', () => loadPreset(exampleInput(), 'exemplo'));
  $('clear-all').addEventListener('click', () => loadPreset(emptyInput(), 'vazio'));
  $('load-casoreal').addEventListener('click', () => loadPreset({ ...CASO_REAL_PRESET, capOn: false }, 'casoreal'));
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-scenario]');
    if (!button) return;
    state.scenario = button.dataset.scenario;
    refresh();
  });
  $('print').addEventListener('click', () => window.print());
  $('theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  });
  try {
    const theme = localStorage.getItem(THEME_KEY);
    if (theme === 'light' || theme === 'dark') setTheme(theme);
  } catch {
    /* ignore */
  }

  /* Impressão: abre todos os "Ver cálculo" e devolve o estado depois. */
  let opened = [];
  window.addEventListener('beforeprint', () => {
    opened = [...document.querySelectorAll('details.calc:not([open])')];
    opened.forEach((d) => { d.open = true; });
  });
  window.addEventListener('afterprint', () => {
    opened.forEach((d) => { d.open = false; });
    opened = [];
  });
}

buildCards();
bind();
restore();
