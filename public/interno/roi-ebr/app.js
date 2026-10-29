import {
  BIOLAB_PRESET,
  DISCLAIMER,
  FIELD_IDS,
  SCENARIOS,
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
} from './calc.js';

const STORAGE_KEY = 'neo-roi:v1:current';
const NOTES = {
  exemplo: 'Os campos estão preenchidos com uma planta fictícia de médio porte, apenas para demonstração. Os valores de investimento são hipotéticos e não representam o preço do NEO.',
  biolab: 'Simulação interna da Biolab com dados estimados. Só o número de campos por instrução (500) foi informado; todo o resto é premissa a validar com a Biolab. O investimento é hipotético e não é o valor do contrato. Não divulgar sem autorização do cliente.',
  vazio: 'Campos limpos. Captura permanece em 50% e a taxa de desconto em 14%.',
};

let state = { ...exampleInput(), preset: 'exemplo' };

function readForm() {
  const next = { capOn: document.getElementById('capOn').checked, scenario: state.scenario, preset: state.preset };
  for (const id of FIELD_IDS) next[id] = parseDecimal(document.getElementById(id)?.value);
  return next;
}

function writeForm(values) {
  for (const id of FIELD_IDS) {
    const field = document.getElementById(id);
    if (!field) continue;
    const value = values[id];
    field.value = value == null ? '' : String(value).replace('.', ',');
  }
  document.getElementById('capOn').checked = values.capOn === true;
}

function loadPreset(values, preset) {
  state = { ...values, capOn: values.capOn === true, scenario: state.scenario || 'provavel', preset };
  writeForm(state);
  const note = document.getElementById('preset-note');
  note.hidden = !NOTES[preset];
  note.textContent = NOTES[preset] || '';
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
    writeForm({ ...emptyInput(), ...data, capOn: data.capOn === true });
    const note = document.getElementById('preset-note');
    note.hidden = !NOTES[state.preset];
    note.textContent = NOTES[state.preset] || '';
    refresh();
  } catch {
    loadPreset(exampleInput(), 'exemplo');
  }
}

function money(value) {
  return formatCompactBRL(value);
}

function render(result) {
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.scenario === result.scenario ? 'true' : 'false');
  });
  document.getElementById('payback').textContent = formatPayback(result);
  document.getElementById('kpis').innerHTML = [
    ['ROI 3 anos', formatRoi(result.timeline.roi3, result.blankFinance)],
    ['ROI 5 anos', formatRoi(result.timeline.roi5, result.blankFinance)],
    ['VPL 5 anos', result.blankFinance ? '—' : money(result.timeline.npv5)],
    ['Benefício anual considerado', money(result.benefit)],
    ['Capacidade liberada', `${formatNumber(result.H, 0)} h/ano`],
    ['Valor dessas horas', money(result.HV)],
    ['Ganho direto em caixa', money(result.C)],
  ].map(([label, value]) => `<article class="kpi"><span>${label}</span><strong>${value}</strong></article>`).join('');

  const maxGain = Math.max(...result.blocks.map((item) => Math.abs(item.gain)), 1);
  document.getElementById('bars').innerHTML = result.blocks.map((item) => {
    const width = Math.max(0, Math.round((Math.abs(item.gain) / maxGain) * 100));
    return `<div class="bar"><span>${item.label}</span><i style="width:${width}%"></i><b>${money(item.gain)}</b></div>`;
  }).join('');

  for (const item of result.blocks) {
    const gain = document.querySelector(`[data-gain="${item.id}"]`);
    if (gain) gain.textContent = money(item.gain);
    const formula = document.querySelector(`[data-formula="${item.id}"]`);
    if (formula) formula.innerHTML = item.formula.map((line) => `<p class="formula">${line}</p>`).join('');
  }
  const invest = document.querySelector('[data-gain="invest"]');
  if (invest) invest.textContent = money(result.investment.c1);
  const investFormula = document.querySelector('[data-formula="invest"]');
  if (investFormula) {
    investFormula.innerHTML = `<p class="formula">Mês 0 = − ${formatBRL(result.investment.c1)}. O custo recorrente de ${formatBRL(result.investment.c2)} por ano começa no mês 1. A entrada em operação é no mês ${formatNumber(result.investment.c3, 0)}: nesse mês e no anterior ao ganho cheio o fator é 0%; no mês seguinte, 50%; depois, 100%.</p>`;
  }

  const keys = [
    ['op', 'Preenchimento'],
    ['pr', 'Revisão da produção'],
    ['gq', 'Revisão da GQ'],
    ['co', 'Correções'],
  ];
  const body = keys.map(([key, label]) => `<tr><th>${label}</th><td class="num">${formatNumber(result.record.T[key], 1)}</td><td class="num">${formatNumber(result.record.E[key], 1)}</td><td class="num">${formatNumber(Math.max(0, result.record.T[key] - result.record.E[key]), 1)}</td></tr>`).join('');
  document.getElementById('compare').innerHTML = `<thead><tr><th>h/ano</th><th class="num">Hoje</th><th class="num">EBR</th><th class="num">Economia</th></tr></thead><tbody>${body}<tr><th>Total</th><td class="num">${formatNumber(result.record.totalT, 1)}</td><td class="num">${formatNumber(result.record.totalE, 1)}</td><td class="num">${formatNumber(Math.max(0, result.record.totalT - result.record.totalE), 1)}</td></tr></tbody>`;
  document.getElementById('compare-note').textContent = `Por ordem: hoje ${formatNumber(result.orderMinutes.today, 1)} min, com EBR ${formatNumber(result.orderMinutes.ebr, 1)} min. Revisão da GQ: ${formatNumber(result.orderMinutes.gqToday, 1)} min hoje e ${formatNumber(result.orderMinutes.gqEbr, 1)} min com EBR. Equivale a ${formatNumber(result.people, 2)} pessoas (economia total ÷ 1.800 h/ano). Os cenários aplicam 50%, 75% ou 100% sobre essa economia, menos a correção de erros, que já tem percentual próprio.`;

  const rows = Object.values(SCENARIOS).map((item) => {
    const view = item.id === result.scenario ? result : evaluate({ ...readForm(), scenario: item.id });
    return `<tr><th>${item.label}</th><td class="num">${formatPayback(view)}</td><td class="num">${formatRoi(view.timeline.roi5, view.blankFinance)}</td></tr>`;
  });
  document.getElementById('scenario-table').innerHTML = `<thead><tr><th></th><th class="num">Retorno</th><th class="num">ROI 5 anos</th></tr></thead><tbody>${rows.join('')}</tbody>`;

  const breakEven = document.getElementById('breakeven');
  if (result.breakeven == null) {
    breakEven.textContent = 'Preencha o bloco de lotes perdidos e o investimento para ver quanto das perdas atuais o projeto precisa evitar para se pagar.';
  } else {
    const extra = result.breakeven > 1 ? ' Isso é mais do que as perdas atuais: o projeto depende dos outros blocos.' : '';
    breakEven.textContent = `Mesmo sem nenhum outro ganho, o projeto se paga em 5 anos se evitar ${formatPct(result.breakeven)} das perdas de lote que vocês têm hoje (${formatBRL(result.lossesNow)} por ano).${extra}`;
  }

  document.getElementById('gq-alert').hidden = !result.gqAlert;
  document.getElementById('gq-alert').textContent = `A revisão da GQ está em ${formatNumber(result.gqMinutes, 0)} min por ordem. Referências do setor ficam entre 1h30 e 3h. Confira o tempo por campo.`;
  document.getElementById('process-alert').hidden = !result.processAlert;
  document.getElementById('logbook-note').hidden = !result.logbookNote;
  document.getElementById('disclaimer').textContent = DISCLAIMER;
}

function refresh() {
  state = readForm();
  const result = evaluate(state);
  render(result);
  persist();
}

function bind() {
  const form = document.getElementById('form');
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  document.getElementById('load-example').addEventListener('click', () => loadPreset(exampleInput(), 'exemplo'));
  document.getElementById('clear-all').addEventListener('click', () => loadPreset(emptyInput(), 'vazio'));
  document.getElementById('load-biolab').addEventListener('click', () => loadPreset({ ...BIOLAB_PRESET, capOn: false }, 'biolab'));
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    button.addEventListener('click', () => {
      state.scenario = button.dataset.scenario;
      refresh();
    });
  });
  document.getElementById('print').addEventListener('click', () => window.print());
  document.getElementById('theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    document.getElementById('theme').textContent = next === 'light' ? 'Tema escuro' : 'Tema claro';
    try {
      localStorage.setItem('neo-roi:v1:theme', next);
    } catch {
      /* ignore */
    }
  });
  try {
    const theme = localStorage.getItem('neo-roi:v1:theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.dataset.theme = theme;
      document.getElementById('theme').textContent = theme === 'light' ? 'Tema escuro' : 'Tema claro';
    }
  } catch {
    /* ignore */
  }
}

restore();
bind();
