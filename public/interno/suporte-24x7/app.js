import {
  DEFAULTS,
  DISCLAIMER,
  evaluate,
  formatBRL,
  formatHours,
  formatNumber,
  formatPct,
  parseBr,
} from './calc.js';

const STORAGE_KEY = 'gcalc.suporte-24x7.v1';

const NUMBER_FIELDS = [
  'salary',
  'charges',
  'hourDivisor',
  'monthHours',
  'workdays',
  'hoursPerDay',
  'weekdayHours',
  'sundayHours',
  'nightHours',
  'toolsCost',
];

const OPTIONAL_FIELDS = ['marginPct', 'includedHours', 'extraHourPrice'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function readValue(id) {
  return document.getElementById(id)?.value ?? '';
}

function displayDefault(id, value) {
  if (id === 'standbyFraction') return Math.abs(value - 1 / 3) < 1e-9 ? '1/3' : formatNumber(value, 4);
  if (id === 'salary' || id === 'toolsCost') return formatNumber(value, 0);
  if (id === 'hoursPerDay') return formatNumber(value, 1);
  if (id === 'charges' || id === 'hourDivisor' || id === 'monthHours' || id === 'workdays') return formatNumber(value, 0);
  if (id === 'weekdayHours' || id === 'sundayHours' || id === 'nightHours') return formatNumber(value, 0);
  return value == null ? '' : String(value);
}

function writeDefaults() {
  for (const id of NUMBER_FIELDS) {
    const field = document.getElementById(id);
    if (field) field.value = displayDefault(id, DEFAULTS[id]);
  }
  const fraction = document.getElementById('standbyFraction');
  if (fraction) fraction.value = '1/3';
  for (const id of OPTIONAL_FIELDS) {
    const field = document.getElementById(id);
    if (field) field.value = '';
  }
  document.getElementById('people').value = String(DEFAULTS.people);
  const plan = document.querySelector(`input[name="plan"][value="${DEFAULTS.plan}"]`);
  if (plan) plan.checked = true;
  const night = document.querySelector(`input[name="nightBase"][value="${DEFAULTS.nightBase}"]`);
  if (night) night.checked = true;
}

function readInput() {
  const input = {
    plan: document.querySelector('input[name="plan"]:checked')?.value || DEFAULTS.plan,
    nightBase: document.querySelector('input[name="nightBase"]:checked')?.value || DEFAULTS.nightBase,
    people: parseBr(document.getElementById('people').value),
    standbyFraction: parseBr(readValue('standbyFraction')),
  };
  for (const id of NUMBER_FIELDS) input[id] = parseBr(readValue(id));
  for (const id of OPTIONAL_FIELDS) input[id] = parseBr(readValue(id));
  return input;
}

function snapshot() {
  const data = {
    plan: document.querySelector('input[name="plan"]:checked')?.value || DEFAULTS.plan,
    nightBase: document.querySelector('input[name="nightBase"]:checked')?.value || DEFAULTS.nightBase,
    people: document.getElementById('people').value,
    standbyFraction: readValue('standbyFraction'),
  };
  for (const id of [...NUMBER_FIELDS, ...OPTIONAL_FIELDS]) data[id] = readValue(id);
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
    raw = null;
  }
  if (!raw) {
    writeDefaults();
    return;
  }
  try {
    const data = JSON.parse(raw);
    writeDefaults();
    for (const id of [...NUMBER_FIELDS, ...OPTIONAL_FIELDS, 'standbyFraction', 'people']) {
      if (data[id] != null && document.getElementById(id)) document.getElementById(id).value = data[id];
    }
    if (data.plan) {
      const plan = document.querySelector(`input[name="plan"][value="${data.plan}"]`);
      if (plan) plan.checked = true;
    }
    if (data.nightBase) {
      const night = document.querySelector(`input[name="nightBase"][value="${data.nightBase}"]`);
      if (night) night.checked = true;
    }
  } catch {
    writeDefaults();
  }
}

function kpi(label, value, note) {
  const node = el('div', 'kpi');
  node.append(el('span', null, label), el('strong', 'kpi-value', value));
  if (note) node.append(el('span', null, note));
  return node;
}

function renderKpis(result) {
  const host = document.getElementById('kpis');
  host.replaceChildren(
    kpi('Valor da hora', formatBRL(result.hourValue)),
    kpi('Sobreaviso com encargos', formatBRL(result.standbyCost), `sem encargos ${formatBRL(result.standbyCostGross)}`),
    kpi('Acionamentos com encargos', formatBRL(result.activationCost), `${formatHours(result.activationHours)} no mês`),
    kpi('Custo total de RH', formatBRL(result.rhCost)),
    kpi('Ferramentas e outros', formatBRL(result.toolsCost), 'fora do RH'),
    result.price == null
      ? kpi('Preço (mensalidade)', 'informe a margem', 'O preço depende da margem.')
      : kpi('Preço (mensalidade)', formatBRL(result.price), result.marginPct == null ? '' : `margem ${formatNumber(result.marginPct, 0)}%`),
  );
}

function addRow(body, label, hours, gross, charged, strong = false) {
  const tr = document.createElement('tr');
  const name = document.createElement(strong ? 'th' : 'td');
  name.textContent = label;
  const h = el('td', 'num', hours);
  const g = el('td', 'num', gross);
  const c = el('td', 'num', charged);
  tr.append(name, h, g, c);
  body.append(tr);
}

function renderBreakdown(result) {
  const body = document.getElementById('breakdown');
  body.replaceChildren();
  addRow(body, 'Sobreaviso', formatHours(result.paidStandbyHours), formatBRL(result.standbyCostGross), formatBRL(result.standbyCost));
  addRow(body, `Acionamento em dia útil (${formatBRL(result.weekdayRate)}/h)`, formatHours(result.weekdayHours), formatBRL(result.weekdayCostGross), formatBRL(result.weekdayCost));
  addRow(body, `Acionamento em domingo ou feriado (${formatBRL(result.sundayRate)}/h)`, formatHours(result.sundayHours), formatBRL(result.sundayCostGross), formatBRL(result.sundayCost));
  addRow(body, `Acionamento noturno (${formatBRL(result.nightRate)}/h)`, formatHours(result.nightHours), formatBRL(result.nightCostGross), formatBRL(result.nightCost));
  addRow(body, 'Acionamentos (soma)', formatHours(result.activationHours), formatBRL(result.activationCostGross), formatBRL(result.activationCost));
  addRow(body, 'Total de RH', '—', formatBRL(result.standbyCostGross + result.activationCostGross), formatBRL(result.rhCost), true);
}

function renderPeople(result) {
  const note = document.getElementById('people-note');
  const grid = document.getElementById('people-grid');
  const n = result.people;
  note.textContent = n === 1
    ? 'Uma pessoa na escala: horas e custo de RH ficam inteiros. Mudar o número de pessoas não altera o custo total.'
    : `${formatNumber(n, 0)} pessoas na escala. O custo de RH permanece ${formatBRL(result.rhCost)}; abaixo, a divisão igualitária.`;
  const item = result.perPerson;
  grid.replaceChildren(
    kpi('Fora do expediente / pessoa', formatHours(item.offHours)),
    kpi('Sobreaviso pago / pessoa', formatHours(item.paidStandbyHours)),
    kpi('Acionamento / pessoa', formatHours(item.activationHours)),
    kpi('Custo de RH / pessoa', formatBRL(item.rhCost)),
  );
}

function renderProposal(result) {
  const host = document.getElementById('proposal');
  const wrap = el('div', 'proposal-grid');
  const line = (label, value, hint) => {
    const node = el('div', 'proposal-line');
    node.append(el('span', null, label), el('strong', null, value));
    if (hint) node.append(el('p', 'hint', hint));
    wrap.append(node);
  };
  line('Plano', result.planLabel, 'Rótulo da proposta; a conta usa as horas de acionamento digitadas.');
  if (result.price == null) {
    line('Mensalidade fixa', 'o preço depende da margem', 'Preencha a margem percentual para obter o preço.');
  } else {
    line('Mensalidade fixa', formatBRL(result.price), result.includedHours == null
      ? 'Horas incluídas ainda não definidas.'
      : `Com ${formatHours(result.includedHours)} incluídas na mensalidade.`);
  }
  if (result.includedHours == null) {
    line('Horas incluídas', 'a definir', 'Campo sem padrão, para não inventar um número.');
  } else {
    line('Horas incluídas', formatHours(result.includedHours));
  }
  if (result.extraHourPrice != null) {
    line('Hora excedente', formatBRL(result.extraHourPrice));
  } else if (result.suggestedExtraHour != null) {
    line(
      'Hora excedente (sugestão)',
      formatBRL(result.suggestedExtraHour),
      `Sugestão calculada: custo da hora de acionamento em dia útil com encargos (${formatBRL(result.weekdayRateCharged)}) × (1 + ${formatPct(result.margin)}). Não é um padrão preenchido.`,
    );
  } else {
    line(
      'Hora excedente',
      'informe a margem para ver a sugestão',
      'A sugestão é o custo da hora de acionamento em dia útil com encargos × (1 + margem).',
    );
  }
  host.replaceChildren(wrap);
}

function renderMemory(result) {
  const host = document.getElementById('memory');
  host.replaceChildren(
    ...result.memory.map((block) => {
      const section = el('div');
      section.append(el('h3', null, block.title));
      for (const line of block.lines) section.append(el('p', null, line));
      return section;
    }),
  );
}

function refresh() {
  const result = evaluate(readInput());
  document.getElementById('plan-kicker').textContent = `Proposta · ${result.planLabel}`;
  document.getElementById('hours-formula').textContent = `${result.commercialLine}.\n${result.offLine}.\n${result.paidLine}.`;
  document.getElementById('rates-formula').textContent =
    `Hora ${formatBRL(result.hourValue)} · dia útil ${formatBRL(result.weekdayRate)}/h (${formatBRL(result.weekdayRateCharged)} c/ encargos) · domingo ou feriado ${formatBRL(result.sundayRate)}/h (${formatBRL(result.sundayRateCharged)} c/ encargos) · noturno ${formatBRL(result.nightRate)}/h (${formatBRL(result.nightRateCharged)} c/ encargos).`;
  const hint = document.getElementById('extra-hint');
  hint.textContent = result.suggestedExtraHour == null
    ? 'Sem margem informada, não há sugestão de hora excedente. Quando houver, a sugestão é o custo da hora de acionamento em dia útil com encargos × (1 + margem).'
    : `Sugestão calculada (não preenchida automaticamente): ${formatBRL(result.suggestedExtraHour)}.`;
  document.getElementById('disclaimer').textContent = DISCLAIMER;
  renderKpis(result);
  renderBreakdown(result);
  renderPeople(result);
  renderProposal(result);
  renderMemory(result);
  persist();
}

function bind() {
  document.getElementById('form').addEventListener('input', refresh);
  document.getElementById('form').addEventListener('change', refresh);
  document.getElementById('form').addEventListener('submit', (event) => event.preventDefault());
  document.getElementById('print').addEventListener('click', () => {
    const stamp = document.getElementById('print-date');
    const when = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
    stamp.textContent = `Memória de cálculo · ${when}.`;
    window.print();
  });
  document.getElementById('reset').addEventListener('click', () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* navegador sem armazenamento */
    }
    writeDefaults();
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

document.getElementById('disclaimer').textContent = DISCLAIMER;
restore();
bind();
refresh();
