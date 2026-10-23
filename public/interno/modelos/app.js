import {
  CLASSES,
  CONFIGURATIONS,
  DEFAULTS,
  HEIGHTS,
  LENGTH_INCLUDED,
  OPTIONS,
  PRESETS,
  SAM_PROTRUSION_M,
  WIDTHS,
  WIDTH_REF_LABELS,
  YEAR_KEYS,
  bonusLedger,
  classOf,
  classesAt,
  configLabel,
  distributeRobots,
  evaluate,
  explain,
  formatBRL,
  formatEUR,
  formatFixed,
  formatFlex,
  formatMeters,
  formatPacks,
  maxHeightOf,
  parseBr,
  widthsAt,
} from './calc.js';

const STORAGE_KEY = 'gcalc.modelos.interno.v1';

const VIEW_DEFAULTS = { theme: 'azul', xray: false, human: true };

const SECTIONS = [
  {
    id: 'modelo',
    title: '1. Dimensões e Modelo (1 Robô)',
    open: true,
    intro: 'A altura sai do pé-direito, a largura do espaço e a classe da capacidade. Comprimento, capacidade garantida e preço vêm da tabela.',
    fields: [
      {
        key: 'heightM',
        label: 'Altura do robô',
        kind: 'select',
        keep: 'height',
        wide: true,
        tooltip: '10 alturas, de 2,20 m a 3,55 m, uma tabela por altura (slides 14 a 23). Acima de 2,95 m somem as larguras maiores.',
      },
      {
        key: 'widthSam',
        label: 'Largura (c/ SAM · GO.compact · GO.direct)',
        kind: 'select',
        keep: 'width',
        wide: true,
        tooltip: 'A coluna da tabela é o GO.compact com o SAM, que soma 0,20 m. 3,75 m vai até 2,95 m de altura, 4,15 m até 2,65 m e 4,55 m até 2,50 m.',
      },
      {
        key: 'classId',
        label: 'Classe de capacidade',
        kind: 'select',
        keep: 'class',
        wide: true,
        tooltip: 'S a 4XL, de cerca de 10.000 a 40.000 pacotes. A capacidade garantida exata de cada célula aparece no resultado.',
      },
    ],
    status: true,
  },
  {
    id: 'opcionais',
    title: '2. Opcionais e Serviços',
    open: true,
    intro: 'Os opcionais do slide 6 e os serviços do slide 8. Tudo entra na base do bônus de volume.',
    fields: [
      {
        key: 'secondGripper',
        label: '2º braço',
        kind: 'check',
        checkLabel: '2º braço / gripper c/ 2º SAM (+€ 14.000 e +0,68 m)',
        wide: true,
        tooltip: 'Segundo gripper com segundo módulo de saída rápida. Exige +68 cm de comprimento: o filtro da sala já soma isso.',
      },
      {
        key: 'coolingModule',
        label: 'Refrigeração',
        kind: 'check',
        checkLabel: 'Módulo refrigerado (+€ 8.000)',
        wide: true,
        tooltip: 'Módulo de refrigeração integrado ao robô, por robô.',
      },
      {
        key: 'includeServices',
        label: 'Serviços',
        kind: 'check',
        checkLabel: 'Incluir serviços de transporte e instalação (€ 18k–€ 27k)',
        wide: true,
        tooltip: 'Por classe: S € 18.000, M € 19.500, L € 21.000, XL € 22.500, XXL € 24.000, 3XL € 25.500, 4XL € 27.000.',
      },
      {
        key: 'conveyorEur',
        label: 'Tecnologia de esteiras (€)',
        prefix: '€',
        min: 0,
        digits: 2,
        wide: true,
        tooltip: 'Sob consulta na proposta: digite o valor da cotação individual, por robô. Padrão zero.',
      },
    ],
  },
  {
    id: 'espaco',
    title: '3. Busca por Espaço da Loja (Filtro Reverso)',
    open: true,
    intro: 'Informe as medidas da sala e a capacidade mínima. Medida vazia não restringe.',
    fields: [
      {
        key: 'roomFilterOn',
        label: 'Filtro',
        kind: 'check',
        checkLabel: 'Filtrar por medidas da sala',
        wide: true,
        tooltip: 'Ligado: a busca percorre as 286 configurações, a matriz marca as que cabem e o 3D desenha a sala.',
      },
      {
        key: 'roomHeightM',
        label: 'Pé-direito máx. (m)',
        suffix: 'm',
        decimalDot: true,
        allowEmpty: true,
        placeholder: 'livre',
        min: 0.5,
        max: 30,
        lockedBy: 'roomFilterOn',
        tooltip: 'Altura livre da sala. O robô cabe se a altura da tabela for menor ou igual.',
      },
      {
        key: 'roomWidthM',
        label: 'Largura máx. (m)',
        suffix: 'm',
        decimalDot: true,
        allowEmpty: true,
        placeholder: 'livre',
        min: 0.5,
        max: 30,
        lockedBy: 'roomFilterOn',
        tooltip: 'Comparada com a largura escolhida na referência abaixo.',
      },
      {
        key: 'roomWidthRef',
        label: 'Referência de largura',
        kind: 'select',
        lockedBy: 'roomFilterOn',
        wide: true,
        tooltip: 'Com SAM é a coluna da tabela. GO.compact é 0,20 m mais estreito. GO.direct é a referência mais larga, de folga.',
      },
      {
        key: 'roomLengthM',
        label: 'Comprimento máx. (m)',
        suffix: 'm',
        decimalDot: true,
        allowEmpty: true,
        placeholder: 'livre',
        min: 0.5,
        max: 30,
        lockedBy: 'roomFilterOn',
        tooltip: 'Comprimento da tabela, já com carga manual e speed, mais 0,68 m se o 2º braço estiver marcado.',
      },
      {
        key: 'minCapacity',
        label: 'Capacidade mín. (pacotes)',
        integer: true,
        allowEmpty: true,
        placeholder: 'livre',
        min: 0,
        lockedBy: 'roomFilterOn',
        tooltip: 'Capacidade garantida mínima da célula, não a aproximada da classe.',
      },
    ],
  },
  {
    id: 'cambio',
    title: '4. Câmbio e Custo Brasil (R$)',
    open: true,
    intro: 'Converte o pedido em euro para reais, soma a nacionalização e desconta o crédito tributário.',
    fields: [
      {
        key: 'fxRate',
        label: 'Câmbio (R$ por €)',
        prefix: 'R$/€',
        decimalDot: true,
        digits: 4,
        min: 0.01,
        max: 100,
        wide: true,
        tooltip: 'Premissa de R$ 6,20 por euro. Troque pela cotação do dia ou pela taxa contratada.',
      },
      {
        key: 'importCostPct',
        label: 'Custos de importação / nacionalização (%)',
        suffix: '%',
        min: 0,
        max: 150,
        step: 1,
        slider: true,
        quick: [
          { value: 0, label: '0% Proposta pura' },
          { value: 35, label: '35%' },
          { value: 60, label: '60%' },
        ],
        tooltip: 'Impostos, frete internacional e despacho, em % do valor convertido. Padrão 0%: o preço da proposta, sem nacionalizar.',
      },
      {
        key: 'taxCreditPct',
        label: 'Crédito tributário recuperável (%)',
        suffix: '%',
        min: 0,
        max: 100,
        step: 1,
        slider: true,
        tooltip: 'Percentual do custo nacionalizado que volta como crédito. Padrão 25%. Confirme com o contador.',
      },
    ],
  },
  {
    id: 'rollout',
    title: '5. Rollout 5 Anos (Framework Agreement)',
    open: true,
    intro: 'Robôs pedidos por ano no acordo DPSP. A contagem do bônus soma os 5 anos.',
    fields: [
      {
        key: 'fleetTotal',
        label: 'Cenários de frota',
        kind: 'pills',
        wide: true,
        quick: [1, 10, 25, 50, 100].map((value) => ({ value, label: `${value} ${value === 1 ? 'robô' : 'robôs'}` })),
        tooltip: 'Divide o total igualmente pelos 5 anos, o resto nos primeiros. 10, 25, 50 e 100 são os marcos das faixas.',
      },
      ...YEAR_KEYS.map((key, index) => ({
        key,
        label: `Ano ${index + 1}`,
        suffix: 'robôs',
        integer: true,
        min: 0,
        max: 1000,
        tooltip: index < 2 ? `Ano ${index + 1}: preço fixo.` : `Ano ${index + 1}: preço × (1 + VPI)^${index - 1}.`,
      })),
      {
        key: 'germanInflationPct',
        label: 'Inflação alemã VPI (%/ano, anos 3–5)',
        suffix: '% a.a.',
        min: 0,
        max: 10,
        step: 0.1,
        slider: true,
        tooltip: 'Teto do reajuste anual a partir do 3º ano: VPI da Alemanha (Destatis) do ano anterior. Padrão 2,0%.',
      },
    ],
  },
];

let state = freshState();
let view = { ...VIEW_DEFAULTS };
let lastAdjust = null;
let matrixHeight = null;
let current = null;
const controls = new Map();

function freshState() {
  return { ...DEFAULTS };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    const next = freshState();
    for (const key of Object.keys(DEFAULTS)) {
      const value = parsed[key];
      if (value === null && DEFAULTS[key] !== null && ['roomHeightM', 'roomWidthM', 'roomLengthM', 'minCapacity'].includes(key)) {
        next[key] = null;
      } else if (typeof DEFAULTS[key] === typeof value && (typeof value !== 'number' || Number.isFinite(value))) {
        next[key] = value;
      }
    }
    state = next;
    if (parsed.view && typeof parsed.view === 'object') {
      if (['azul', 'verde', 'magenta'].includes(parsed.view.theme)) view.theme = parsed.view.theme;
      if (typeof parsed.view.xray === 'boolean') view.xray = parsed.view.xray;
      if (typeof parsed.view.human === 'boolean') view.human = parsed.view.human;
    }
  } catch {
    /* armazenamento corrompido: fica o padrão */
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, view }));
  } catch {
    /* navegador sem armazenamento */
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function clampField(field, value) {
  let next = value;
  if (field.integer) next = Math.round(next);
  if (field.min != null) next = Math.max(field.min, next);
  if (field.max != null) next = Math.min(field.max, next);
  return next;
}

function toDisplay(field, value) {
  if (value == null || !Number.isFinite(value)) return '';
  return formatFlex(value, field.integer ? 0 : field.digits ?? 2);
}

function fromDisplay(field, raw) {
  if (field.allowEmpty && String(raw).trim() === '') return null;
  const parsed = parseBr(raw, { decimalDot: field.decimalDot || String(field.suffix ?? '').includes('%') });
  if (parsed == null) return undefined;
  return clampField(field, parsed);
}

/* Opções dos seletores. Combinações sem célula continuam escolhíveis: a troca automática ajusta o resto. */

function selectOptions(key) {
  if (key === 'heightM') {
    return HEIGHTS.map((heightM) => ({
      value: heightM.toFixed(2),
      label: `${formatMeters(heightM)} · ${widthsAt(heightM).length} larguras`,
    }));
  }
  if (key === 'widthSam') {
    return WIDTHS.map((width) => {
      const max = maxHeightOf(width.sam);
      const off = state.heightM > max + 1e-9;
      return {
        value: width.key,
        label: `${formatMeters(width.sam)} c/ SAM · GO.compact ${formatFixed(width.compact, 2)} · GO.direct ${formatFixed(width.direct, 2)}${off ? ` (até ${formatMeters(max)})` : ''}`,
      };
    });
  }
  if (key === 'classId') {
    const valid = classesAt(state.heightM, state.widthSam);
    return CLASSES.map((cls) => ({
      value: cls.id,
      label: `Robô ${cls.id} · aprox. ${formatPacks(cls.approxPacks)}${valid.includes(cls.id) ? '' : ' — não existe nesta largura'}`,
    }));
  }
  if (key === 'roomWidthRef') {
    return Object.entries(WIDTH_REF_LABELS).map(([value, label]) => ({ value, label }));
  }
  return [];
}

function selectValue(key) {
  if (key === 'heightM') return state.heightM.toFixed(2);
  if (key === 'widthSam') return state.widthSam.toFixed(2);
  return String(state[key]);
}

function readSelect(key, raw) {
  if (key === 'heightM' || key === 'widthSam') return Number(raw);
  return raw;
}

function renderField(field) {
  const wrap = el('div', field.wide || field.slider ? 'field field-wide' : 'field');
  const head = el('div', 'field-head');
  const label = el(field.kind === 'pills' ? 'span' : 'label', null, field.label);
  if (field.kind !== 'pills') label.htmlFor = field.kind === 'check' || field.kind === 'select' ? field.key : `${field.key}-text`;
  label.id = `lbl-${field.key}`;
  head.append(label);
  const tipBtn = el('button', 'tip-btn', 'Ajuda');
  tipBtn.type = 'button';
  tipBtn.setAttribute('aria-expanded', 'false');
  tipBtn.setAttribute('aria-controls', `tip-${field.key}`);
  const tip = el('p', 'tip', field.tooltip);
  tip.id = `tip-${field.key}`;
  tip.hidden = true;
  tipBtn.addEventListener('click', () => toggleTip(tipBtn, tip));
  head.append(tipBtn);
  wrap.append(head, tip);

  if (field.kind === 'check') {
    const row = el('div', 'check');
    const input = el('input');
    input.type = 'checkbox';
    input.id = field.key;
    input.addEventListener('change', () => {
      state[field.key] = input.checked;
      commit();
    });
    row.append(input, el('span', null, field.checkLabel || 'Ligado'));
    wrap.append(row);
    controls.set(field.key, { field, check: input, wrap });
    return wrap;
  }

  if (field.kind === 'select') {
    const affix = el('div', 'affix');
    const select = el('select');
    select.id = field.key;
    select.setAttribute('aria-describedby', tip.id);
    select.addEventListener('change', () => {
      state[field.key] = readSelect(field.key, select.value);
      commit(field.keep ?? null);
    });
    affix.append(select);
    wrap.append(affix);
    controls.set(field.key, { field, select, wrap });
    return wrap;
  }

  if (field.kind === 'pills') {
    wrap.append(quickRow(field, (value) => {
      distributeRobots(value).forEach((count, index) => {
        state[YEAR_KEYS[index]] = count;
      });
      commit();
    }));
    controls.set(field.key, { field, wrap });
    return wrap;
  }

  const control = el('div', 'control');
  let slider = null;
  if (field.slider) {
    slider = el('input');
    slider.type = 'range';
    slider.min = String(field.min);
    slider.max = String(field.max);
    slider.step = String(field.step ?? 1);
    slider.id = `${field.key}-slider`;
    slider.setAttribute('aria-labelledby', label.id);
    slider.addEventListener('input', () => {
      const raw = Number(slider.value);
      const value = field.integer ? Math.round(raw) : Math.round(raw * 100) / 100;
      state[field.key] = clampField(field, value);
      const text = controls.get(field.key)?.text;
      if (text) text.value = toDisplay(field, state[field.key]);
      commit();
    });
    control.append(slider);
  }

  const affix = el('div', 'affix');
  if (field.prefix) affix.append(el('span', 'affix-label', field.prefix));
  const text = el('input');
  text.type = 'text';
  text.id = `${field.key}-text`;
  text.inputMode = field.integer ? 'numeric' : 'decimal';
  text.autocomplete = 'off';
  if (field.placeholder) text.placeholder = field.placeholder;
  text.setAttribute('aria-describedby', tip.id);
  text.addEventListener('input', () => {
    const value = fromDisplay(field, text.value);
    if (value === undefined) return;
    state[field.key] = value;
    if (slider && value != null) slider.value = String(value);
    commit();
  });
  text.addEventListener('blur', () => {
    text.value = state[field.key] == null ? '' : toDisplay(field, state[field.key]);
  });
  affix.append(text);
  if (field.suffix) affix.append(el('span', 'affix-label', field.suffix));
  control.append(affix);
  wrap.append(control);
  if (field.quick) {
    wrap.append(quickRow(field, (value) => {
      state[field.key] = value;
      fillControls();
      commit();
    }));
  }
  if (field.key === 'conveyorEur') {
    const hint = el('p', 'hint');
    hint.id = 'options-hint';
    wrap.append(hint);
  }
  if (field.key === 'fxRate') {
    const hint = el('p', 'hint');
    hint.id = 'fx-hint';
    wrap.append(hint);
  }
  controls.set(field.key, { field, text, slider, wrap });
  return wrap;
}

function quickRow(field, apply) {
  const row = el('div', 'quick');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', `Atalhos: ${field.label}`);
  for (const item of field.quick) {
    const button = el('button', null, item.label);
    button.type = 'button';
    button.dataset.quick = String(item.value);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => apply(item.value));
    row.append(button);
  }
  return row;
}

function toggleTip(button, tip) {
  const open = tip.hidden;
  document.querySelectorAll('.tip').forEach((node) => {
    node.hidden = true;
  });
  document.querySelectorAll('.tip-btn').forEach((node) => node.setAttribute('aria-expanded', 'false'));
  if (open) {
    tip.hidden = false;
    button.setAttribute('aria-expanded', 'true');
  }
}

function buildForm() {
  const form = document.getElementById('form');
  form.replaceChildren();
  for (const section of SECTIONS) {
    const card = el('details', 'card fold');
    card.id = `sec-${section.id}`;
    if (section.open) card.open = true;
    const summary = el('summary');
    summary.append(el('span', 'fold-title', section.title));
    const body = el('div', 'fold-body');
    body.append(el('p', 'intro', section.intro));
    const grid = el('div', 'fields');
    for (const field of section.fields) grid.append(renderField(field));
    body.append(grid);
    if (section.status) {
      const status = el('p', 'mode');
      status.id = 'selection-status';
      status.setAttribute('role', 'status');
      body.append(status);
    }
    card.append(summary, body);
    form.append(card);
  }
}

function fillControls() {
  for (const [key, control] of controls) {
    const value = state[key];
    if (control.check) control.check.checked = Boolean(value);
    if (control.select) {
      const options = selectOptions(key);
      control.select.replaceChildren(
        ...options.map((option) => {
          const node = el('option', null, option.label);
          node.value = option.value;
          return node;
        }),
      );
      control.select.value = selectValue(key);
    }
    if (control.text && document.activeElement !== control.text) {
      control.text.value = value == null ? '' : toDisplay(control.field, value);
    }
    if (control.slider && value != null) control.slider.value = String(value);
  }
}

function lockControl(key, off) {
  const control = controls.get(key);
  if (!control?.wrap) return;
  if (control.text) control.text.disabled = off;
  if (control.slider) control.slider.disabled = off;
  if (control.select) control.select.disabled = off;
  control.wrap.classList.toggle('is-off', off);
}

function syncLocks() {
  for (const [key, control] of controls) {
    if (control.field.lockedBy) lockControl(key, !state[control.field.lockedBy]);
  }
}

function syncQuick() {
  const fleet = YEAR_KEYS.map((key) => state[key]).join(',');
  for (const [key, control] of controls) {
    if (!control.field.quick) continue;
    control.wrap.querySelectorAll('[data-quick]').forEach((button) => {
      const value = Number(button.dataset.quick);
      const on = key === 'fleetTotal' ? distributeRobots(value).join(',') === fleet : state[key] === value;
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
}

function compactBRL(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function m2(value) {
  return `${formatFixed(value, 2)} m²`;
}

function pct(value) {
  return `${formatFlex(value, 2)}%`;
}

function cents(value) {
  return formatEUR(value / 100);
}

function renderKpi(host, spec) {
  const card = el('article', spec.hero ? 'kpi kpi-hero' : 'kpi');
  card.dataset.testid = spec.id;
  if (spec.title) card.title = spec.title;
  card.append(el('p', 'kpi-label', spec.label));
  card.append(el('p', 'kpi-value', spec.value));
  if (spec.sub) card.append(el('p', 'kpi-sub', spec.sub));
  if (spec.exact && spec.exact !== spec.value) card.append(el('p', 'kpi-exact', spec.exact));
  host.append(card);
}

const CHANGE_LABELS = { heightM: 'a altura', widthSam: 'a largura', classId: 'a classe' };

function adjustMessage(selection) {
  const { requested } = selection;
  const parts = selection.changed.map((key) => CHANGE_LABELS[key]);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts[0];
  return `${formatMeters(requested.heightM)} × ${formatMeters(requested.widthSam)} · Robô ${requested.classId} não existe na tabela. Ajustei ${list}: ${configLabel(selection.config)}.`;
}

function renderStatus(result) {
  const status = document.getElementById('selection-status');
  const banner = document.getElementById('model-banner');
  const { config } = result.selection;
  const valid = classesAt(config.heightM, config.widthSam);
  if (status) {
    status.classList.toggle('is-adjusted', Boolean(lastAdjust));
    status.replaceChildren(
      el('span', 'mode-result', lastAdjust ? 'Combinação ajustada' : `Combinação válida da tabela de ${formatMeters(config.heightM)}`),
      el(
        'span',
        'mode-reason',
        lastAdjust ??
          `Nesta largura e altura existem as classes ${valid.join(', ')}. Larguras nesta altura: ${widthsAt(config.heightM)
            .map((width) => formatFixed(width.sam, 2))
            .join(' · ')} m.`,
      ),
    );
  }
  banner.hidden = !lastAdjust;
  banner.textContent = lastAdjust ?? '';
}

function renderHero(result) {
  const { quote, brazil } = result;
  const hero = document.getElementById('hero-kpis');
  hero.replaceChildren();
  renderKpi(hero, {
    id: 'robot-price',
    label: 'Preço total do robô',
    value: formatEUR(quote.tablePriceEur),
    sub: `pedido c/ opcionais e serviços ${formatEUR(quote.orderEur)}`,
    title: `${formatEUR(quote.baseRobotEur)} + ${formatEUR(quote.autoLoadingEur)} + ${formatEUR(quote.samEur)}`,
    hero: true,
  });
  renderKpi(hero, {
    id: 'gross-brl',
    label: 'Investimento bruto',
    value: compactBRL(brazil.landedBrl),
    exact: formatBRL(brazil.landedBrl),
    sub: `câmbio ${formatFlex(brazil.fxRate, 4)} · nacionalização ${pct(brazil.importCostPct)}`,
    title: formatBRL(brazil.landedBrl),
    hero: true,
  });
  renderKpi(hero, {
    id: 'net-brl',
    label: 'Investimento líquido pós-crédito',
    value: compactBRL(brazil.netBrl),
    exact: formatBRL(brazil.netBrl),
    sub: `crédito de ${pct(brazil.taxCreditPct)}: −${formatBRL(brazil.creditBrl)}`,
    title: formatBRL(brazil.netBrl),
    hero: true,
  });
  renderKpi(hero, {
    id: 'capacity',
    label: 'Capacidade e dimensões',
    value: formatPacks(quote.capacityPacks),
    sub: `${formatFixed(quote.heightM, 2)} × ${formatFixed(quote.widthSam, 2)} × ${formatFixed(quote.totalLengthM, 2)} m · ${m2(quote.footprintM2)}`,
    title: 'Altura × largura c/ SAM × comprimento total',
    hero: true,
  });
  document.getElementById('model-note').textContent = `${configLabel(quote.config)}. GO.compact ${formatMeters(quote.widthCompact)} sem o SAM, GO.direct ${formatMeters(quote.widthDirect)} de referência. Comprimento da tabela ${formatMeters(quote.tableLengthM)}${quote.secondGripper ? `, ${formatMeters(quote.totalLengthM)} com o 2º braço` : ''}.`;
  const options = document.getElementById('options-hint');
  if (options) {
    options.textContent = `Equipamento ${formatEUR(quote.equipmentEur)} + serviços ${formatEUR(quote.servicesEur)} = pedido de ${formatEUR(quote.orderEur)} por robô.`;
  }
  const fx = document.getElementById('fx-hint');
  if (fx) fx.textContent = `${formatEUR(quote.orderEur)} × ${formatFlex(brazil.fxRate, 4)} = ${formatBRL(brazil.grossBrl)}.`;
}

function renderDims(result) {
  const { quote, room } = result;
  const host = document.getElementById('dims');
  const status = (dim) => {
    if (!result.roomFilterOn) return '';
    const check = room.checks.find((item) => item.dim === dim);
    return check?.status === 'over' ? 'is-over' : check?.status === 'tight' ? 'is-tight' : '';
  };
  const pills = [
    ['Altura', formatMeters(quote.heightM), status('height')],
    ['Largura c/ SAM', formatMeters(quote.widthSam), result.roomWidthRef === 'sam' ? status('width') : ''],
    ['GO.compact · GO.direct', `${formatFixed(quote.widthCompact, 2)} · ${formatFixed(quote.widthDirect, 2)} m`, result.roomWidthRef === 'sam' ? '' : status('width')],
    ['Comprimento total', formatMeters(quote.totalLengthM), status('length')],
    ['Área m²', m2(quote.footprintM2), ''],
    ['Volume m³', `${formatFixed(quote.volumeM3, 2)} m³`, ''],
    ['Capacidade garantida', formatPacks(quote.capacityPacks), result.roomFilterOn && !room.capacityOk ? 'is-over' : ''],
  ];
  host.replaceChildren(
    ...pills.map(([label, value, cls]) => {
      const pill = el('div', `pill ${cls}`.trim());
      pill.append(el('span', null, label), el('strong', null, value));
      return pill;
    }),
  );
}

function applyConfig(config) {
  state.heightM = config.heightM;
  state.widthSam = config.widthSam;
  state.classId = config.classId;
  lastAdjust = null;
  matrixHeight = config.heightM;
  fillControls();
  commit();
}

function renderSpace(result) {
  const { space, room, quote } = result;
  const summary = document.getElementById('space-summary');
  const host = document.getElementById('space-cards');
  host.replaceChildren();
  if (!result.roomFilterOn) {
    summary.textContent = 'Filtro desligado. Ligue "Filtrar por medidas da sala" no bloco 3 para buscar entre as 286 configurações as que cabem na loja.';
    return;
  }
  const limit = (value) => (value == null ? 'livre' : formatMeters(value));
  const fitText = room.fits
    ? 'O modelo atual cabe.'
    : `O modelo atual não cabe: ${[
        ...room.checks
          .filter((item) => !item.ok)
          .map((item) => `${{ height: 'altura', width: 'largura', length: 'comprimento' }[item.dim]} excede ${formatMeters(-item.marginM)}`),
        ...(room.capacityOk ? [] : [`capacidade ${formatPacks(quote.capacityPacks)} abaixo do mínimo`]),
      ].join(', ')}.`;
  summary.textContent = `${formatFlex(space.count)} de ${formatFlex(space.total)} configurações cabem: pé-direito ${limit(result.roomHeightM)}, largura ${limit(result.roomWidthM)} (${WIDTH_REF_LABELS[result.roomWidthRef]}), comprimento ${limit(result.roomLengthM)}${result.secondGripper ? ' já com +0,68 m do 2º braço' : ''}, capacidade mínima ${result.minCapacity == null ? 'livre' : formatPacks(result.minCapacity)}. ${fitText}`;
  if (!space.count) {
    host.append(el('p', 'banner', 'Nenhuma configuração cabe. Afrouxe uma medida, troque a referência de largura ou baixe a capacidade mínima.'));
    return;
  }
  const cards = [
    { id: 'cheapest', title: 'Mais barato', pick: space.cheapest, main: (item) => formatEUR(item.orderEur) },
    { id: 'smallest', title: 'Menor área (m²)', pick: space.smallest, main: (item) => m2(item.footprintM2) },
    { id: 'largest', title: 'Maior capacidade', pick: space.largest, main: (item) => formatPacks(item.capacityPacks) },
  ];
  for (const card of cards) {
    const item = card.pick;
    const isCurrent = item.config.id === quote.config.id;
    const node = el('article', isCurrent ? 'space-card is-current' : 'space-card');
    node.dataset.testid = `space-${card.id}`;
    node.append(el('p', 'kpi-label', card.title));
    node.append(el('h4', null, configLabel(item.config)));
    node.append(el('p', 'kpi-value', card.main(item)));
    node.append(
      el(
        'p',
        'kpi-sub',
        `${formatEUR(item.orderEur)} · ${m2(item.footprintM2)} · ${formatPacks(item.capacityPacks)} · ${formatMeters(item.totalLengthM)}`,
      ),
    );
    const button = el('button', null, isCurrent ? 'Em uso' : 'Aplicar esta configuração');
    button.type = 'button';
    button.disabled = isCurrent;
    button.addEventListener('click', () => applyConfig(item.config));
    node.append(button);
    host.append(node);
  }
}

function renderPrice(result) {
  const { quote, brazil, brl } = result;
  const fx = brazil.fxRate;
  const approx = (value) => `≈ ${formatEUR(value / fx)}`;
  const cls = classOf(quote.classId);
  const rows = [
    ['Robô base (tabela − € 25.000)', formatEUR(quote.baseRobotEur), formatBRL(brl.baseRobot)],
    ['+ Carga automática c/ OCR e carga manual', formatEUR(quote.autoLoadingEur), formatBRL(brl.autoLoading)],
    ['+ SAM c/ 4 saídas', formatEUR(quote.samEur), formatBRL(brl.sam)],
    ['= Preço de tabela (total do robô)', formatEUR(quote.tablePriceEur), formatBRL(brl.tablePrice), 'is-total'],
    [`+ 2º braço c/ 2º SAM${quote.secondGripper ? ` (+${formatFixed(OPTIONS.secondGripperLengthM, 2)} m)` : ' (não)'}`, formatEUR(quote.secondGripperEur), formatBRL(brl.secondGripper)],
    [`+ Módulo refrigerado${quote.coolingModule ? '' : ' (não)'}`, formatEUR(quote.coolingEur), formatBRL(brl.cooling)],
    ['+ Tecnologia de esteiras', formatEUR(quote.conveyorEur), formatBRL(brl.conveyor)],
    [`+ Serviços de transporte e instalação (${cls.id})${quote.includeServices ? '' : ' (fora)'}`, formatEUR(quote.servicesEur), formatBRL(brl.services)],
    ['= Pedido por robô (base do bônus)', formatEUR(quote.orderEur), formatBRL(brazil.grossBrl), 'is-total is-key'],
    [`+ Impostos de nacionalização (${pct(brazil.importCostPct)})`, approx(brazil.importBrl), formatBRL(brazil.importBrl)],
    ['= Custo nacionalizado', approx(brazil.landedBrl), formatBRL(brazil.landedBrl), 'is-total'],
    [`− Crédito recuperável (${pct(brazil.taxCreditPct)})`, `≈ −${formatEUR(brazil.creditBrl / fx)}`, `−${formatBRL(brazil.creditBrl)}`, 'is-minus'],
    ['= Custo líquido efetivo', approx(brazil.netBrl), formatBRL(brazil.netBrl), 'is-total is-key'],
    [
      'Custo por pacote de capacidade',
      `${formatEUR(quote.eurPerPack)} (pedido)`,
      `${formatBRL(result.brlPerPack)} (líquido)`,
    ],
  ];
  const table = document.getElementById('price-table');
  table.replaceChildren();
  table.append(el('caption', null, `${configLabel(quote.config)} · câmbio R$ ${formatFlex(fx, 4)} por €`));
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const [label, cls2] of [['Item', null], ['EUR', 'num'], ['R$', 'num']]) {
    const th = el('th', cls2, label);
    th.scope = 'col';
    hr.append(th);
  }
  head.append(hr);
  const body = document.createElement('tbody');
  for (const [label, eurText, brlText, rowCls] of rows) {
    const tr = document.createElement('tr');
    if (rowCls) tr.className = rowCls;
    const th = el('th', null, label);
    th.scope = 'row';
    tr.append(th, el('td', 'num', eurText), el('td', 'num', brlText));
    body.append(tr);
  }
  table.append(head, body);
  document.getElementById('price-note').textContent = `Na tabela o preço já inclui a carga automática (${formatEUR(22000)}) e o SAM (${formatEUR(3000)}). As linhas em euro depois do pedido são o equivalente pelo câmbio. O custo por pacote divide o pedido em euro e o líquido em reais pela capacidade garantida de ${formatPacks(quote.capacityPacks)}.`;
}

function focusTab(heightM) {
  matrixHeight = heightM;
  renderMatrix(current);
  document.querySelector(`#matrix-tabs [data-height="${heightM.toFixed(2)}"]`)?.focus();
}

function renderMatrix(result) {
  const { quote, space } = result;
  if (matrixHeight == null) matrixHeight = quote.heightM;
  const tabs = document.getElementById('matrix-tabs');
  tabs.replaceChildren(
    ...HEIGHTS.map((heightM, index) => {
      const tab = el('button', null, formatMeters(heightM));
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.dataset.height = heightM.toFixed(2);
      const selected = heightM === matrixHeight;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.setAttribute('aria-controls', 'matrix');
      tab.tabIndex = selected ? 0 : -1;
      const fits = result.roomFilterOn && space.matches.some((item) => item.heightM === heightM);
      if (fits) tab.classList.add('has-fit');
      if (heightM === quote.heightM) tab.title = 'Altura do modelo atual';
      tab.addEventListener('click', () => {
        matrixHeight = heightM;
        renderMatrix(current);
      });
      tab.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight') focusTab(HEIGHTS[(index + 1) % HEIGHTS.length]);
        if (event.key === 'ArrowLeft') focusTab(HEIGHTS[(index - 1 + HEIGHTS.length) % HEIGHTS.length]);
      });
      return tab;
    }),
  );
  const table = document.getElementById('matrix');
  table.replaceChildren();
  table.append(el('caption', null, `Robô de ${formatMeters(matrixHeight)} de altura`));
  const available = widthsAt(matrixHeight).map((width) => width.key);
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  const corner = el('th', null, 'Classe / largura c/ SAM');
  corner.scope = 'col';
  hr.append(corner);
  for (const width of WIDTHS) {
    const th = el('th', null);
    th.scope = 'col';
    th.append(el('strong', null, formatMeters(width.sam)), document.createElement('br'));
    th.append(el('span', null, `GO.compact ${formatFixed(width.compact, 2)} · GO.direct ${formatFixed(width.direct, 2)}`));
    if (!available.includes(width.key)) th.classList.add('is-off');
    hr.append(th);
  }
  head.append(hr);
  const body = document.createElement('tbody');
  for (const cls of CLASSES) {
    const tr = document.createElement('tr');
    const th = el('th', null, `Robô ${cls.id}`);
    th.scope = 'row';
    th.append(document.createElement('br'), el('small', null, `aprox. ${formatFlex(cls.approxPacks)}`));
    tr.append(th);
    for (const width of WIDTHS) {
      const config = CONFIGURATIONS.find(
        (item) => item.heightM === matrixHeight && item.widthSam === width.sam && item.classId === cls.id,
      );
      if (!config) {
        tr.append(el('td', 'empty', '–'));
        continue;
      }
      const td = document.createElement('td');
      const active = config.id === quote.config.id;
      const fit = result.roomFilterOn && space.matchIds.has(config.id);
      const button = el('button', 'cell');
      button.type = 'button';
      if (active) button.classList.add('is-active');
      if (result.roomFilterOn) button.classList.add(fit ? 'is-fit' : 'is-out');
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute(
        'aria-label',
        `Robô ${cls.id}, ${formatMeters(width.sam)} c/ SAM, altura ${formatMeters(matrixHeight)}: ${formatEUR(config.priceEur)}, ${formatMeters(config.lengthM)}, ${formatPacks(config.capacityPacks)}${result.roomFilterOn ? (fit ? ', cabe na sala' : ', não cabe na sala') : ''}`,
      );
      button.append(
        el('strong', null, formatEUR(config.priceEur)),
        el('small', null, `${formatFixed(config.lengthM, 2)} m · ${formatFlex(config.capacityPacks)}`),
      );
      button.addEventListener('click', () => applyConfig(config));
      td.append(button);
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(head, body);
  const fitCount = result.roomFilterOn ? space.matches.filter((item) => item.heightM === matrixHeight).length : null;
  document.getElementById('matrix-legend').textContent = `${available.length} larguras nesta altura. Célula escura: modelo atual.${
    fitCount == null ? '' : ` Verde: cabe na sala (${formatFlex(fitCount)} nesta altura); apagada: não cabe.`
  } "–": a proposta não oferece a combinação.`;
}

function renderRollout(result) {
  const plan = result.rollout;
  const kpis = document.getElementById('rollout-kpis');
  kpis.replaceChildren();
  renderKpi(kpis, {
    id: 'fleet-total',
    label: 'Total de robôs',
    value: formatFlex(plan.totalRobots),
    sub: `por ano: ${plan.years.map((year) => formatFlex(year.robots)).join(' · ')}`,
  });
  renderKpi(kpis, {
    id: 'fleet-tier',
    label: 'Faixa final do bônus',
    value: pct(plan.finalTierPct),
    sub: plan.next ? `faltam ${formatFlex(plan.next.from - plan.totalRobots)} para ${pct(plan.next.pct)}` : 'faixa máxima',
  });
  renderKpi(kpis, {
    id: 'fleet-bonus',
    label: 'Bônus total',
    value: formatEUR(plan.bonus),
    sub: `${formatBRL(plan.bonusBrl)} · ${pct(plan.effectivePct)} efetivo`,
  });
  renderKpi(kpis, {
    id: 'fleet-average',
    label: 'Preço médio efetivo por robô',
    value: plan.avgNetEur == null ? '—' : formatEUR(plan.avgNetEur),
    sub: plan.avgGrossEur == null ? 'sem robôs' : `bruto médio ${formatEUR(plan.avgGrossEur)}`,
  });
  document.getElementById('rollout-note').textContent = `Pedido por robô de ${formatEUR(result.quote.orderEur)} (${configLabel(result.quote.config)}, com opcionais e serviços). Anos 1 e 2 fixos; anos 3 a 5 com VPI de ${pct(result.germanInflationPct)} ao ano.`;

  const years = document.getElementById('rollout-years');
  years.replaceChildren();
  years.append(el('caption', null, 'Ano a ano'));
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  const columns = ['Ano', 'Robôs', 'Acumulado', 'Pedido por robô', 'Volume bruto', 'Bônus na fatura', 'Notas de crédito', 'Bônus do ano', 'Líquido (€)', 'Líquido (R$)', 'Líquido custo Brasil'];
  for (const label of columns) {
    const th = el('th', label === 'Ano' ? null : 'num', label);
    th.scope = 'col';
    hr.append(th);
  }
  head.append(hr);
  const body = document.createElement('tbody');
  for (const year of plan.years) {
    const tr = document.createElement('tr');
    const th = el('th', null, `Ano ${year.year}`);
    th.scope = 'row';
    th.append(document.createElement('br'), el('small', null, year.multiplier === 1 ? 'preço fixo' : `× ${formatFixed(year.multiplier, 4)}`));
    tr.append(th);
    tr.append(el('td', 'num', formatFlex(year.robots)));
    const cumulative = el('td', 'num');
    cumulative.append(el('span', null, formatFlex(year.cumulative)), document.createElement('br'));
    cumulative.append(el('span', year.tierPct > 0 ? 'tier-pill' : 'tier-pill is-off', pct(year.tierPct)));
    tr.append(cumulative);
    tr.append(el('td', 'num', formatEUR(year.unitGrossEur)));
    tr.append(el('td', 'num', cents(year.grossCents)));
    tr.append(el('td', 'num', cents(year.invoiceBonusCents)));
    const credit = el('td', 'num', cents(year.creditNoteCents));
    if (year.milestones.length) {
      credit.append(document.createElement('br'), el('small', null, year.milestones.map((robot) => `${robot}º robô`).join(', ')));
    }
    tr.append(credit);
    tr.append(el('td', 'num', cents(year.bonusCents)));
    tr.append(el('td', 'num', cents(year.netCents)));
    tr.append(el('td', 'num', formatBRL(year.netBrl)));
    tr.append(el('td', 'num', formatBRL(year.netLandedBrl)));
    body.append(tr);
  }
  const foot = document.createElement('tfoot');
  const fr = document.createElement('tr');
  const total = el('th', null, 'Total');
  total.scope = 'row';
  const sum = (key) => plan.years.reduce((acc, year) => acc + year[key], 0);
  fr.append(
    total,
    el('td', 'num', formatFlex(plan.totalRobots)),
    el('td', 'num', pct(plan.finalTierPct)),
    el('td', 'num', plan.avgGrossEur == null ? '—' : `média ${formatEUR(plan.avgGrossEur)}`),
    el('td', 'num', formatEUR(plan.gross)),
    el('td', 'num', cents(sum('invoiceBonusCents'))),
    el('td', 'num', cents(sum('creditNoteCents'))),
    el('td', 'num', formatEUR(plan.bonus)),
    el('td', 'num', formatEUR(plan.net)),
    el('td', 'num', formatBRL(plan.netBrl)),
    el('td', 'num', formatBRL(plan.netLandedBrl)),
  );
  foot.append(fr);
  years.append(head, body, foot);

  const table = document.getElementById('rollout-milestones');
  table.replaceChildren();
  table.append(el('caption', null, 'Marcos do bônus e notas de crédito (formato do slide 12)'));
  const mh = document.createElement('thead');
  const mr = document.createElement('tr');
  for (const label of ['Robôs pedidos', 'Bônus na fatura', 'Faixa alcançada com', 'Nota de crédito', 'Bônus total até ali', 'Bônus efetivo']) {
    const th = el('th', label === 'Robôs pedidos' ? null : 'num', label);
    th.scope = 'col';
    mr.append(th);
  }
  mh.append(mr);
  const mb = document.createElement('tbody');
  for (const row of plan.milestones) {
    const tr = document.createElement('tr');
    const th = el('th', null, row.to == null ? `${formatFlex(row.from)} e mais` : `${formatFlex(row.from)} – ${formatFlex(row.to)}`);
    th.scope = 'row';
    tr.append(th);
    tr.append(el('td', 'num', row.invoicePct === 0 ? '–' : `${pct(row.invoicePct)}${row.reached ? ` (${cents(row.bandInvoiceBonusCents)})` : ''}`));
    if (row.to == null) {
      tr.append(
        el('td', 'num', '–'),
        el('td', 'num', '–'),
        el('td', 'num', row.reached ? `${pct(row.levelPct)} em ${formatFlex(row.robots)} robôs` : `faltam ${formatFlex(row.missing)} robôs`),
        el('td', 'num', pct(row.levelPct)),
      );
    } else if (row.reached) {
      tr.append(
        el('td', 'num', `${formatFlex(row.to)}º robô (ano ${formatFlex(row.year)}) → ${pct(row.levelPct)}`),
        el('td', 'num', cents(row.creditNoteCents)),
        el('td', 'num', cents(row.bonusToDateCents)),
        el('td', 'num', `${pct(row.effectivePct)} de ${cents(row.cumulativeCents)}`),
      );
    } else {
      tr.append(
        el('td', 'num', `${formatFlex(row.to)}º robô → ${pct(row.levelPct)}`),
        el('td', 'num', `faltam ${formatFlex(row.missing)} robôs`),
        el('td', 'num', '—'),
        el('td', 'num', '—'),
      );
    }
    mb.append(tr);
  }
  table.append(mh, mb);
  document.getElementById('milestone-note').textContent = `Conferência do slide 12, com ${formatEUR(100000)} por robô e sem VPI: ${SLIDE_12.milestones
    .map((item) => `${item.robot}º robô ${cents(item.bonusToDateCents)}`)
    .join(' · ')}. No 25º: robôs 11 a 25 já tiveram 2% na fatura (${cents(SLIDE_12.milestones[1].bandInvoiceBonusCents)}) e a nota de ${cents(SLIDE_12.milestones[1].creditNoteCents)} leva os 25 a 4%.`;
}

const SLIDE_12 = bonusLedger(Array.from({ length: 100 }, () => 100000));

function renderMemory(result) {
  const host = document.getElementById('memoria');
  const open = !host.classList.contains('is-collapsed');
  host.replaceChildren();
  if (!open) host.classList.add('is-collapsed');
  for (const block of explain(result)) {
    host.append(el('h3', null, block.title));
    const list = document.createElement('ol');
    for (const line of block.lines) list.append(el('li', null, line));
    host.append(list);
  }
}

function renderDock(result) {
  document.getElementById('dock-price').textContent = formatEUR(result.quote.tablePriceEur);
  document.getElementById('dock-order').textContent = formatEUR(result.quote.orderEur);
  document.getElementById('dock-net').textContent = compactBRL(result.brazil.netBrl);
  document.getElementById('dock-bonus').textContent = `${pct(result.rollout.finalTierPct)} · ${formatEUR(result.rollout.bonus)}`;
}

function syncPresets(result) {
  const { quote } = result;
  const plain = !quote.secondGripper && !quote.coolingModule && quote.conveyorEur === 0 && quote.includeServices;
  document.querySelectorAll('[data-preset]').forEach((button) => {
    const preset = PRESETS.find((item) => item.id === button.dataset.preset);
    const on = plain && preset && getId(preset) === quote.config.id;
    button.classList.toggle('is-active', Boolean(on));
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function getId(preset) {
  return `${preset.heightM.toFixed(2)}|${preset.widthSam.toFixed(2)}|${preset.classId}`;
}

function render(result) {
  current = result;
  syncLocks();
  syncQuick();
  renderStatus(result);
  renderHero(result);
  renderDims(result);
  renderSpace(result);
  renderPrice(result);
  renderMatrix(result);
  renderRollout(result);
  renderMemory(result);
  renderDock(result);
  syncPresets(result);
  viewer?.setModel(result);
  const stamp = document.getElementById('print-date');
  if (stamp) {
    stamp.textContent = `Memória de cálculo · ${new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}.`;
  }
}

/**
 * keep: o seletor que o usuário mexeu. Se a combinação não existe, o calc ajusta os outros dois e o
 * ajuste volta para o estado, para os seletores mostrarem o modelo que entrou na conta.
 */
function commit(keep = null) {
  const previousHeight = current?.quote.heightM;
  const result = evaluate(state, keep);
  const { selection } = result;
  if (keep) lastAdjust = selection.changed.length ? adjustMessage(selection) : null;
  if (selection.changed.length || keep) {
    state.heightM = selection.heightM;
    state.widthSam = selection.widthSam;
    state.classId = selection.classId;
    fillControls();
  }
  if (previousHeight !== result.quote.heightM) matrixHeight = result.quote.heightM;
  render(result);
  persist();
}

/* ------------------------------------------------------------------------------------------------ */
/* Visualizador 3D do GO.compact. Canvas 2D com projeção em perspectiva e pintura por profundidade.  */
/* Eixos em metros: x = largura (+ à direita de quem olha a frente), y = altura, z = −profundidade.  */
/* A frente do robô fica em z = 0 e o fundo em z = −comprimento.                                     */
/* ------------------------------------------------------------------------------------------------ */

const THEMES = {
  azul: { label: 'Azul Gollmann', color: '#009bb4' },
  verde: { label: 'Verde Lima', color: '#8ab81a' },
  magenta: { label: 'Magenta', color: '#b5124b' },
};

const COLORS = {
  anthracite: '#23272b',
  side: '#2c3135',
  glass: '#dfe8eb',
  window: '#353d43',
  shelf: '#9aa7ae',
  rack: '#c9d3d8',
  rail: '#b5c0c6',
  bin: '#f3f5f6',
  chute: '#121517',
  screen: '#1f6fd1',
  grip: '#f08a24',
  manual: '#7c8b93',
  speed: '#4f9d69',
  direct: '#8a8f93',
  cool: '#3d9be0',
  ok: '#0f5c4c',
  tight: '#d68910',
  over: '#c0392b',
};

const CAMERA_PRESETS = {
  iso: { yaw: -0.62, pitch: 0.4, zoom: 1 },
  front: { yaw: 0, pitch: 0.06, zoom: 1.05 },
  cut: { yaw: -1.12, pitch: 0.46, zoom: 1, xray: true },
  top: { yaw: -0.0001, pitch: 1.5, zoom: 1 },
};

const LIGHT = normalize([-0.45, 0.85, 0.55]);
const FOV = (40 * Math.PI) / 180;

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(a) {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
}

function hexRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function shade(hex, factor, alpha = 1) {
  const [r, g, b] = hexRgb(hex).map((channel) => Math.max(0, Math.min(255, Math.round(channel * factor))));
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

function mixHex(a, b, t) {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  const mixed = ca.map((channel, index) => Math.round(channel + (cb[index] - channel) * t));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** Ponto do robô: x, altura y e profundidade d a partir da frente. */
function P(x, y, d) {
  return [x, y, -d];
}

/** Caixa com 6 faces de normal conhecida. style.faces sobrepõe o estilo por face. */
function box(x0, x1, y0, y1, d0, d1, style = {}) {
  const spec = {
    front: { n: [0, 0, 1], pts: [P(x0, y1, d0), P(x1, y1, d0), P(x1, y0, d0), P(x0, y0, d0)] },
    back: { n: [0, 0, -1], pts: [P(x1, y1, d1), P(x0, y1, d1), P(x0, y0, d1), P(x1, y0, d1)] },
    left: { n: [-1, 0, 0], pts: [P(x0, y1, d1), P(x0, y1, d0), P(x0, y0, d0), P(x0, y0, d1)] },
    right: { n: [1, 0, 0], pts: [P(x1, y1, d0), P(x1, y1, d1), P(x1, y0, d1), P(x1, y0, d0)] },
    top: { n: [0, 1, 0], pts: [P(x0, y1, d1), P(x1, y1, d1), P(x1, y1, d0), P(x0, y1, d0)] },
    bottom: { n: [0, -1, 0], pts: [P(x0, y0, d0), P(x1, y0, d0), P(x1, y0, d1), P(x0, y0, d1)] },
  };
  return Object.entries(spec)
    .filter(([name]) => !(style.skip || []).includes(name))
    .map(([name, face]) => ({ name, fill: style.fill, alpha: style.alpha ?? 1, stroke: style.stroke, ...face, ...(style.faces?.[name] || {}) }));
}

/** Quadrilátero num plano do robô, usado para decalques (faixas, janelas, telas). */
function quadX(x, y0, y1, d0, d1) {
  return [P(x, y1, d0), P(x, y1, d1), P(x, y0, d1), P(x, y0, d0)];
}

function quadZ(d, x0, x1, y0, y1) {
  return [P(x0, y1, d), P(x1, y1, d), P(x1, y0, d), P(x0, y0, d)];
}

function quadFloor(x0, x1, d0, d1, y = 0.002) {
  return [P(x0, y, d0), P(x1, y, d0), P(x1, y, d1), P(x0, y, d1)];
}

/** Gerador pseudoaleatório estável, para as caixas de remédio não piscarem a cada quadro. */
function seeded(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const HUMAN_HALF = [
  [0.028, 0.86], [0.11, 0.835], [0.148, 0.79], [0.165, 0.52], [0.14, 0.5], [0.118, 0.7], [0.104, 0.5],
  [0.098, 0.03], [0.1, 0], [0.03, 0], [0.024, 0.03], [0.012, 0.46], [0, 0.47],
];

function createViewer(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const cam = { ...CAMERA_PRESETS.iso };
  const camTarget = { ...CAMERA_PRESETS.iso };
  let dims = null;
  let dimsTarget = null;
  let model = null;
  let xrayMix = view.xray ? 1 : 0;
  let time = 0;
  let last = 0;
  let raf = 0;
  let visible = true;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let basis = null;
  const pointers = new Map();
  let pinch = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    wake();
  }

  function wake() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const moving = step(dt);
    draw();
    const animating = xrayMix > 0.02 && !reduceMotion && visible && document.visibilityState !== 'hidden';
    if (moving || animating) wake();
    else last = 0;
  }

  function approach(value, target, k) {
    const next = value + (target - value) * k;
    return Math.abs(next - target) < 1e-4 ? target : next;
  }

  function step(dt) {
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 7);
    let moving = false;
    for (const key of ['yaw', 'pitch', 'zoom']) {
      cam[key] = approach(cam[key], camTarget[key], k);
      if (cam[key] !== camTarget[key]) moving = true;
    }
    if (dims && dimsTarget) {
      for (const key of Object.keys(dimsTarget)) {
        dims[key] = approach(dims[key], dimsTarget[key], k);
        if (dims[key] !== dimsTarget[key]) moving = true;
      }
    }
    xrayMix = approach(xrayMix, view.xray ? 1 : 0, k);
    if (xrayMix !== (view.xray ? 1 : 0)) moving = true;
    if (!reduceMotion) time += dt;
    return moving;
  }

  function setModel(result) {
    const { quote } = result;
    const next = {
      H: quote.heightM,
      Wc: quote.widthCompact,
      Wd: quote.widthDirect,
      Lt: quote.tableLengthM,
      L: quote.totalLengthM,
      roomH: result.roomHeightM ?? quote.heightM + 0.4,
      roomW: result.roomWidthM ?? quote.widthDirect + 0.6,
      roomL: result.roomLengthM ?? quote.totalLengthM + 0.8,
    };
    dimsTarget = next;
    if (!dims) dims = { ...next };
    const worst = result.room.checks.some((item) => item.status === 'over')
      ? 'over'
      : result.room.checks.some((item) => item.status === 'tight')
        ? 'tight'
        : 'ok';
    model = {
      classId: quote.classId,
      capacity: quote.capacityPacks,
      gripper2: quote.secondGripper,
      cooling: quote.coolingModule,
      room: result.roomFilterOn
        ? { status: worst, checks: result.room.checks, ref: result.roomWidthRef, capacityOk: result.room.capacityOk }
        : null,
      labels: {
        H: formatMeters(quote.heightM),
        Ws: formatMeters(quote.widthSam),
        L: formatMeters(quote.totalLengthM),
        core: formatMeters(quote.coreLengthM),
      },
    };
    canvas.setAttribute(
      'aria-label',
      `Modelo 3D do GO.compact Robô ${quote.classId}: altura ${formatMeters(quote.heightM)}, largura com SAM ${formatMeters(quote.widthSam)}, comprimento total ${formatMeters(quote.totalLengthM)}, ${formatFixed(quote.footprintM2, 2)} m², capacidade garantida ${formatPacks(quote.capacityPacks)}${quote.secondGripper ? ', com 2º braço' : ''}${quote.coolingModule ? ', com módulo refrigerado' : ''}${result.roomFilterOn ? (result.room.roomOk ? ', cabe na sala' : ', não cabe na sala') : ''}.`,
    );
    wake();
  }

  function setCamera(name) {
    const preset = CAMERA_PRESETS[name];
    if (!preset) return;
    camTarget.yaw = preset.yaw;
    camTarget.pitch = preset.pitch;
    camTarget.zoom = preset.zoom;
    if (preset.xray && !view.xray) setXray(true);
    zoomInput.value = String(Math.round(camTarget.zoom * 100));
    document.querySelectorAll('[data-camera]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.camera === name ? 'true' : 'false');
    });
    wake();
  }

  function clearCameraPreset() {
    document.querySelectorAll('[data-camera]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  }

  function orbit(dyaw, dpitch, immediate = true) {
    camTarget.yaw += dyaw;
    camTarget.pitch = Math.max(0.02, Math.min(1.52, camTarget.pitch + dpitch));
    if (immediate) {
      cam.yaw = camTarget.yaw;
      cam.pitch = camTarget.pitch;
    }
    clearCameraPreset();
    wake();
  }

  function zoomTo(value) {
    camTarget.zoom = Math.max(0.45, Math.min(2.4, value));
    zoomInput.value = String(Math.round(camTarget.zoom * 100));
    wake();
  }

  /* Câmera: órbita em torno do centro do robô; a distância cobre o robô, a pessoa e a sala. */
  function computeBasis() {
    const d = dims;
    const xLeft = -d.Wc / 2 - SAM_PROTRUSION_M;
    const target = [(xLeft + d.Wc / 2) / 2, d.H * 0.42, -d.L / 2];
    let radius = 0.5 * Math.hypot(d.Wc + 1.6, d.H, d.L + 1.2);
    if (model?.room) radius = Math.max(radius, 0.5 * Math.hypot(d.roomW, d.roomH, d.roomL) + 0.2);
    const fit = Math.min(width, height * 1.25);
    const focal = (height / 2) / Math.tan(FOV / 2);
    const dist = (radius / Math.tan(FOV / 2)) * (height / fit) * 1.14 / cam.zoom + 0.4;
    const cp = Math.cos(cam.pitch);
    const eye = [target[0] + dist * cp * Math.sin(cam.yaw), target[1] + dist * Math.sin(cam.pitch), target[2] + dist * cp * Math.cos(cam.yaw)];
    const f = normalize(sub(target, eye));
    const r = normalize(cross(f, [0, 1, 0]));
    const u = cross(r, f);
    return { eye, f, r, u, focal, cx: width / 2, cy: height / 2 + height * 0.04 };
  }

  function project(p) {
    const v = sub(p, basis.eye);
    const z = dot(v, basis.f);
    return { x: basis.cx + (basis.focal * dot(v, basis.r)) / z, y: basis.cy - (basis.focal * dot(v, basis.u)) / z, z };
  }

  function projectAll(pts) {
    const out = pts.map(project);
    return out.some((point) => point.z < 0.15) ? null : out;
  }

  function facing(face) {
    const center = face.pts.reduce((acc, p) => [acc[0] + p[0] / face.pts.length, acc[1] + p[1] / face.pts.length, acc[2] + p[2] / face.pts.length], [0, 0, 0]);
    return dot(face.n, sub(basis.eye, center)) > 0;
  }

  function path(points) {
    ctx.beginPath();
    points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
    ctx.closePath();
  }

  function light(n) {
    return 0.62 + 0.42 * Math.max(0, dot(n, LIGHT));
  }

  function paintPoly(pts, fill, alpha, n, stroke, strokeAlpha = 0.35, lineWidth = 1) {
    const projected = projectAll(pts);
    if (!projected) return null;
    path(projected);
    if (fill) {
      ctx.fillStyle = shade(fill, n ? light(n) : 1, alpha);
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = shade(stroke, 1, strokeAlpha);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    return projected;
  }

  function line3(a, b, color, alpha = 1, lineWidth = 1, dash = null) {
    const pa = project(a);
    const pb = project(b);
    if (pa.z < 0.15 || pb.z < 0.15) return;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.strokeStyle = shade(color, 1, alpha);
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Desenha numa face com transformação afim pelos cantos projetados (sup. esq., sup. dir., inf. esq.). */
  function onFace(projected, w, h, drawLocal) {
    const [tl, tr, , bl] = projected;
    ctx.save();
    ctx.transform((tr.x - tl.x) / w, (tr.y - tl.y) / w, (bl.x - tl.x) / h, (bl.y - tl.y) / h, tl.x, tl.y);
    drawLocal();
    ctx.restore();
  }

  function drawFace(face) {
    const projected = paintPoly(face.pts, face.fill, face.alpha, face.n, face.stroke, face.strokeAlpha ?? 0.35, face.lineWidth ?? 1);
    if (!projected) return;
    for (const decal of face.decals || []) {
      const dp = paintPoly(decal.pts, decal.fill, decal.alpha ?? face.alpha, face.n, decal.stroke, decal.strokeAlpha ?? 0.6, decal.lineWidth ?? 1);
      if (dp && decal.draw) onFace(dp, decal.w, decal.h, () => decal.draw(ctx, face));
    }
    for (const seg of face.lines || []) line3(seg[0], seg[1], face.lineColor || '#ffffff', face.lineAlpha ?? 0.25, face.lineWidthPx ?? 1);
    if (face.children) drawSorted(face.children, true);
  }

  function depthOf(face) {
    let sum = 0;
    for (const p of face.pts) sum += dot(sub(p, basis.eye), basis.f);
    return sum / face.pts.length;
  }

  function drawSorted(faces, cull) {
    const list = faces
      .filter((face) => !(cull && (face.alpha ?? 1) >= 0.99 && !facing(face)))
      .map((face) => ({ face, depth: depthOf(face) + (face.bias || 0) }))
      .sort((a, b) => b.depth - a.depth);
    for (const item of list) drawFace(item.face);
  }

  function logo(color) {
    return (context) => {
      context.fillStyle = color;
      const steps = [
        [0, 30, 10, 10],
        [10, 20, 10, 20],
        [20, 10, 10, 30],
        [30, 0, 10, 40],
      ];
      for (const [x, y, w, h] of steps) context.fillRect(x, y + 10, w - 1.5, h);
      context.font = '600 30px Outfit, "Segoe UI", sans-serif';
      context.textBaseline = 'middle';
      context.fillText('Gollmann', 50, 32);
    };
  }

  function lettering(text, color, size = 26) {
    return (context) => {
      context.fillStyle = color;
      context.font = `600 ${size}px Outfit, "Segoe UI", sans-serif`;
      context.textBaseline = 'middle';
      context.fillText(text, 4, 24);
    };
  }

  function buildRobot() {
    const d = dims;
    const theme = THEMES[view.theme].color;
    const mix = xrayMix;
    const H = d.H;
    const Wc = d.Wc;
    const L = d.L;
    const Lt = d.Lt;
    const x0 = -Wc / 2;
    const x1 = Wc / 2;
    const fh = Math.min(0.42, Math.max(0.3, H * 0.12));
    const cw = Math.min(0.2, Wc * 0.09);
    const yb = H - fh;
    const sideFill = mixHex(COLORS.side, COLORS.glass, mix);
    const sideAlpha = 1 - 0.8 * mix;
    const fasciaAlpha = 1 - 0.45 * mix;
    const topAlpha = 1 - 0.85 * mix;
    const frontAlpha = 1 - 0.12 * mix;
    const extStart = Lt;
    const hasExt = model.gripper2 && L - Lt > 0.01;

    /* Painel lateral: faixa colorida, colunas nas quinas, juntas verticais e o trecho do 2º braço. */
    const sideDecals = (x) => {
      const decals = [
        { pts: quadX(x, yb, H, 0, L), fill: theme, alpha: fasciaAlpha },
        { pts: quadX(x, 0, yb, 0, cw), fill: theme, alpha: fasciaAlpha },
        { pts: quadX(x, 0, yb, L - cw, L), fill: theme, alpha: fasciaAlpha },
        { pts: quadX(x, 0, 0.06, cw, L - cw), fill: '#111416', alpha: sideAlpha },
      ];
      if (hasExt) {
        decals.push({ pts: quadX(x, 0.06, yb, extStart, L - cw), fill: COLORS.grip, alpha: 0.22 + 0.1 * mix, stroke: COLORS.grip, strokeAlpha: 0.9, lineWidth: 1.6 });
      }
      if (x < 0) {
        decals.push({
          pts: quadX(x, yb + fh * 0.2, yb + fh * 0.8, 0.12 + Math.min(fh * 2.4, L * 0.5), 0.12),
          fill: null,
          w: 240,
          h: 60,
          draw: logo('#14181b'),
        });
      }
      return decals;
    };
    const seams = (x) => {
      const count = Math.max(1, Math.round((L - 2 * cw) / 0.7));
      const lines = [];
      for (let index = 1; index < count; index += 1) {
        const dd = cw + ((L - 2 * cw) * index) / count;
        lines.push([P(x, 0.06, dd), P(x, yb, dd)]);
      }
      return lines;
    };

    /* Frente: baia antracite, colunas coloridas, janelas com prateleiras, nicho das caixas e logo. */
    const bayX0 = x0 + cw;
    const bayX1 = x1 - cw;
    const bayW = bayX1 - bayX0;
    const logoW = Math.min(fh * 2.4, bayW * 0.6);
    const letterW = Math.min(fh * 1.9, Wc * 0.4);
    const frontDecals = [
      { pts: quadZ(0, x0, x1, yb, H), fill: theme, alpha: frontAlpha },
      { pts: quadZ(0, x0, bayX0, 0, yb), fill: theme, alpha: frontAlpha },
      { pts: quadZ(0, bayX1, x1, 0, yb), fill: theme, alpha: frontAlpha },
      { pts: quadZ(0, x0 + cw * 0.3, x0 + cw * 0.3 + 0.03, 1.35, 1.38), fill: '#e2312d', alpha: 1 },
      {
        pts: quadZ(0, x1 - cw * 0.6 - logoW, x1 - cw * 0.6, yb + fh * 0.5 - logoW / 8, yb + fh * 0.5 + logoW / 8),
        fill: null,
        w: 240,
        h: 60,
        draw: logo('#14181b'),
      },
      {
        pts: quadZ(0, x0 + cw * 0.6, x0 + cw * 0.6 + letterW, yb + fh * 0.5 - letterW / 8.3, yb + fh * 0.5 + letterW / 8.3),
        fill: null,
        w: 200,
        h: 48,
        draw: lettering('GO.compact', 'rgba(255,255,255,0.95)'),
      },
    ];
    const winCount = Math.max(2, Math.min(4, Math.round(bayW / 0.6)));
    const winW = Math.min(0.32, (bayW * 0.62) / winCount - 0.06);
    const winY0 = 0.86;
    const winY1 = yb - 0.2;
    const random = seeded(Math.round(dimsTarget.Wc * 1000 + dimsTarget.H * 100));
    const shelfLines = [];
    for (let index = 0; index < winCount; index += 1) {
      const wx0 = bayX0 + 0.12 + index * (winW + 0.07);
      frontDecals.push({ pts: quadZ(-0.002, wx0, wx0 + winW, winY0, winY1), fill: COLORS.window, alpha: 1, stroke: '#0e1012', strokeAlpha: 0.8 });
      for (let y = winY0 + 0.12; y < winY1 - 0.02; y += 0.13) {
        shelfLines.push([P(wx0 + 0.01, y, -0.004), P(wx0 + winW - 0.01, y, -0.004)]);
        let bx = wx0 + 0.02;
        while (bx < wx0 + winW - 0.06) {
          const bw = 0.03 + random() * 0.05;
          const bh = 0.04 + random() * 0.06;
          if (random() > 0.25 && bx + bw < wx0 + winW - 0.015) {
            const tone = ['#f4f1ea', '#dbe9f4', '#f6e7b8', '#f3d3cf', '#d6ecd9'][Math.floor(random() * 5)];
            frontDecals.push({ pts: quadZ(-0.003, bx, bx + bw, y + 0.004, y + 0.004 + bh), fill: tone, alpha: 0.92 });
          }
          bx += bw + 0.012;
        }
      }
    }
    const binW = Math.min(0.36, (bayW - 0.3) / 3);
    const recessX0 = bayX0 + 0.12;
    const recessX1 = recessX0 + binW * 3 + 0.08;
    frontDecals.push({ pts: quadZ(-0.002, recessX0, recessX1, 0.1, 0.56), fill: '#121416', alpha: 1 });

    const frontChildren = [];
    for (let index = 0; index < 3; index += 1) {
      const bx = recessX0 + 0.04 + index * binW;
      frontChildren.push(...box(bx + 0.015, bx + binW - 0.015, 0.14, 0.42, -0.16, 0.02, { fill: COLORS.bin, stroke: '#9aa3a8', faces: { front: { fill: '#ffffff' } } }));
    }
    const hmiX1 = bayX1 - 0.06;
    const hmiX0 = hmiX1 - Math.min(0.46, bayW * 0.3);
    frontChildren.push(...box(hmiX1 - 0.04, bayX1 + 0.02, 1.34, 1.4, -0.12, 0, { fill: '#1a1d20' }));
    frontChildren.push(
      ...box(hmiX0, hmiX1, 1.18, 1.52, -0.17, -0.11, {
        fill: '#16191c',
        faces: {
          front: {
            decals: [
              { pts: quadZ(-0.171, hmiX0 + 0.025, hmiX1 - 0.025, 1.2, 1.5), fill: COLORS.screen, alpha: 1 },
              { pts: quadZ(-0.172, hmiX0 + 0.025, hmiX1 - 0.025, 1.45, 1.5), fill: '#7fb6f2', alpha: 1 },
              ...[0, 1, 2, 3].map((index) => {
                const span = (hmiX1 - hmiX0 - 0.1) / 4;
                const bx = hmiX0 + 0.05 + index * span;
                return { pts: quadZ(-0.172, bx + span * 0.2, bx + span * 0.8, 1.27, 1.36), fill: '#eaf3fd', alpha: 1 };
              }),
            ],
          },
        },
      }),
    );

    const samChildren = box(x0 - SAM_PROTRUSION_M, x0, 0.92, 1.3, 0.06, 0.62, {
      fill: COLORS.chute,
      stroke: '#000000',
      faces: {
        left: { decals: [{ pts: quadX(x0 - SAM_PROTRUSION_M - 0.001, 0.98, 1.22, 0.14, 0.54), fill: '#2f363b', alpha: 1 }] },
      },
    });

    const shell = box(x0, x1, 0, H, 0, L, {
      fill: COLORS.anthracite,
      stroke: '#0c0e10',
      skip: ['bottom'],
      faces: {
        front: { fill: COLORS.anthracite, alpha: frontAlpha, decals: frontDecals, lines: shelfLines, lineColor: COLORS.shelf, lineAlpha: 0.9, children: frontChildren },
        left: { fill: sideFill, alpha: sideAlpha, decals: sideDecals(x0), lines: seams(x0), lineColor: '#5a636a', lineAlpha: 0.7, children: samChildren },
        right: { fill: sideFill, alpha: sideAlpha, decals: sideDecals(x1), lines: seams(x1), lineColor: '#5a636a', lineAlpha: 0.7 },
        back: { fill: sideFill, alpha: sideAlpha, decals: [{ pts: quadZ(L, x1, x0, yb, H), fill: theme, alpha: fasciaAlpha }] },
        top: { fill: mixHex(theme, '#e8f4f6', mix * 0.6), alpha: topAlpha, stroke: '#0c0e10' },
      },
    });
    return { shell, internals: mix > 0.02 ? buildInternals(fh) : [] };
  }

  /* Interior para os raios-X: estantes deslizantes, pórtico de alumínio e um ou dois grippers. */
  function buildInternals(fh) {
    const d = dims;
    const mix = xrayMix;
    const theme = THEMES[view.theme].color;
    const H = d.H;
    const Wc = d.Wc;
    const Lt = d.Lt;
    const L = d.L;
    const x0 = -Wc / 2;
    const x1 = Wc / 2;
    const faces = [];
    const aisle = Math.min(0.78, Wc * 0.42);
    const side = (Wc - aisle) / 2 - 0.06;
    const units = Math.max(1, Math.round(side / 0.45));
    const unitDepth = (side - (units - 1) * 0.05) / units;
    const dStart = LENGTH_INCLUDED.manualLoadingM + LENGTH_INCLUDED.speedOptionM + 0.04;
    const dEnd = Lt - 0.06;
    const rackTop = H - fh - 0.06;
    const shelfLines = (x) => {
      const lines = [];
      for (let y = 0.3; y < rackTop; y += 0.24) lines.push([P(x, y, dStart), P(x, y, dEnd)]);
      for (let dd = dStart + 0.5; dd < dEnd; dd += 0.5) lines.push([P(x, 0.12, dd), P(x, rackTop, dd)]);
      return lines;
    };
    for (const sign of [-1, 1]) {
      for (let index = 0; index < units; index += 1) {
        const outer = sign < 0 ? x0 + 0.06 + index * (unitDepth + 0.05) : x1 - 0.06 - index * (unitDepth + 0.05);
        const a = sign < 0 ? outer : outer - unitDepth;
        const b = sign < 0 ? outer + unitDepth : outer;
        const cooled = model.cooling && sign < 0 && index === units - 1;
        const fill = cooled ? COLORS.cool : COLORS.rack;
        faces.push(
          ...box(a, b, 0.12, rackTop, dStart, cooled ? Math.min(dEnd, dStart + 0.9) : dEnd, {
            fill,
            alpha: 0.5 * mix,
            stroke: '#7d8a91',
            faces: {
              left: { lines: shelfLines(a), lineColor: '#56636a', lineAlpha: 0.55 * mix },
              right: { lines: shelfLines(b), lineColor: '#56636a', lineAlpha: 0.55 * mix },
            },
          }),
        );
      }
    }
    const railY0 = H - 0.24;
    const railY1 = H - 0.16;
    const railStyle = { fill: COLORS.rail, alpha: 0.95 * mix, stroke: '#6f7b82' };
    faces.push(...box(x0 + 0.06, x0 + 0.14, railY0, railY1, 0.1, L - 0.08, railStyle));
    faces.push(...box(x1 - 0.14, x1 - 0.06, railY0, railY1, 0.1, L - 0.08, railStyle));
    faces.push(...box(x0 + 0.06, x1 - 0.06, railY0, railY1, 0.1, 0.18, railStyle));
    faces.push(...box(x0 + 0.06, x1 - 0.06, railY0, railY1, L - 0.16, L - 0.08, railStyle));

    const hasExt = model.gripper2 && L - Lt > 0.01;
    const grip = (dCenter, phase, color, accent) => {
      const swing = Math.max(0, aisle / 2 - 0.16);
      const gx = Math.sin(time * 0.8 + phase) * swing;
      const top = railY0;
      const gy = 0.45 + (rackTop - 0.9) * (0.5 + 0.5 * Math.sin(time * 1.1 + phase * 1.7));
      const start = faces.length;
      faces.push(
        ...box(x0 + 0.08, x1 - 0.08, top - 0.08, top, dCenter - 0.07, dCenter + 0.07, {
          fill: COLORS.rail,
          alpha: mix,
          stroke: '#6f7b82',
          faces: { top: { decals: [{ pts: [P(gx - 0.2, top + 0.002, dCenter + 0.06), P(gx + 0.2, top + 0.002, dCenter + 0.06), P(gx + 0.2, top + 0.002, dCenter - 0.06), P(gx - 0.2, top + 0.002, dCenter - 0.06)], fill: '#3f8f3a', alpha: mix }] } },
        }),
      );
      faces.push(...box(gx - 0.035, gx + 0.035, gy, top - 0.08, dCenter - 0.035, dCenter + 0.035, { fill: '#8d989e', alpha: mix }));
      faces.push(
        ...box(gx - 0.2, gx + 0.2, gy - 0.2, gy, dCenter - 0.16, dCenter + 0.16, {
          fill: color,
          alpha: mix,
          stroke: '#3b4247',
          faces: { front: { decals: [{ pts: quadZ(dCenter - 0.161, gx - 0.2, gx + 0.2, gy - 0.06, gy - 0.025), fill: accent, alpha: mix }] } },
        }),
      );
      /* O gripper fica no corredor entre estantes translúcidas: pinta por último para não sumir. */
      for (let index = start; index < faces.length; index += 1) faces[index].bias = -20;
    };
    const sweep = (from, to, phase) => from + (to - from) * (0.5 + 0.5 * Math.sin(time * 0.45 + phase));
    if (hasExt) {
      grip(sweep(dStart + 0.2, Math.max(dStart + 0.3, (dStart + Lt) / 2 - 0.15), 0), 0, '#e9edef', theme);
      grip(sweep(Math.min(Lt - 0.3, (dStart + Lt) / 2 + 0.15), L - 0.3, 1.9), 2.1, COLORS.grip, '#ffffff');
      faces.push(
        ...box(x0 + 0.02, x1 - 0.02, 0.03, H - 0.03, Lt, L - 0.02, {
          fill: COLORS.grip,
          alpha: 0.14 * mix,
          stroke: COLORS.grip,
          strokeAlpha: 0.85 * mix,
          lineWidth: 1.4,
        }).map((face) => ({ ...face, bias: -0.05 })),
      );
    } else {
      grip(sweep(dStart + 0.2, Lt - 0.3, 0), 0, '#e9edef', theme);
    }
    return faces;
  }

  function drawFloor() {
    const d = dims;
    const theme = THEMES[view.theme].color;
    const x0 = -d.Wc / 2;
    const x1 = d.Wc / 2;
    const xs = x0 - SAM_PROTRUSION_M;
    let gx0 = Math.floor(Math.min(-d.Wd / 2, xs) - 1.6);
    let gx1 = Math.ceil(Math.max(d.Wd / 2, x1) + 1.6);
    let gd0 = -2;
    let gd1 = Math.ceil(d.L + 1.5);
    if (model.room) {
      const cx = model.room.ref === 'sam' ? (xs + x1) / 2 : 0;
      gx0 = Math.min(gx0, Math.floor(cx - d.roomW / 2 - 0.5));
      gx1 = Math.max(gx1, Math.ceil(cx + d.roomW / 2 + 0.5));
      gd0 = Math.min(gd0, Math.floor(d.L / 2 - d.roomL / 2 - 0.5));
      gd1 = Math.max(gd1, Math.ceil(d.L / 2 + d.roomL / 2 + 0.5));
    }
    paintPoly(quadFloor(gx0, gx1, gd0, gd1, 0), '#f7f5ef', 0.55, null);
    for (let x = gx0; x <= gx1; x += 1) line3(P(x, 0, gd0), P(x, 0, gd1), '#1a2421', 0.13);
    for (let dd = gd0; dd <= gd1; dd += 1) line3(P(gx0, 0, dd), P(gx1, 0, dd), '#1a2421', 0.13);

    if (model.room) {
      const cx = model.room.ref === 'sam' ? (xs + x1) / 2 : 0;
      paintPoly(
        quadFloor(cx - d.roomW / 2, cx + d.roomW / 2, d.L / 2 - d.roomL / 2, d.L / 2 + d.roomL / 2, 0.001),
        COLORS[model.room.status],
        0.07,
        null,
      );
    }
    paintPoly(quadFloor(x0 - 0.06, x1 + 0.08, -0.04, d.L + 0.1, 0.003), '#000000', 0.16, null);
    const outline = (pts, color, dash, lineWidth) => {
      const projected = projectAll(pts);
      if (!projected) return;
      path(projected);
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.setLineDash([]);
    };
    outline(quadFloor(-d.Wd / 2, d.Wd / 2, -0.02, d.L + 0.02, 0.004), shade(COLORS.direct, 1, 0.9), [7, 5], 1.4);
    outline(quadFloor(xs, x1, 0, d.L, 0.005), shade(theme, 0.9, 0.95), [4, 4], 1.6);
    outline(quadFloor(x0, x1, 0, d.L, 0.006), shade(COLORS.anthracite, 1, 0.9), [], 1.2);

    const bandX0 = xs - 0.3;
    const bandX1 = xs - 0.12;
    const manualEnd = LENGTH_INCLUDED.manualLoadingM;
    const speedEnd = manualEnd + LENGTH_INCLUDED.speedOptionM;
    const segments = [
      { from: 0, to: manualEnd, color: COLORS.manual, label: '+0,15 m carga manual' },
      { from: manualEnd, to: speedEnd, color: COLORS.speed, label: '+0,17 m speed' },
      { from: speedEnd, to: d.Lt, color: theme, label: `núcleo ${model.labels.core}` },
    ];
    if (model.gripper2 && d.L - d.Lt > 0.01) segments.push({ from: d.Lt, to: d.L, color: COLORS.grip, label: '+0,68 m 2º braço' });
    for (const segment of segments) {
      paintPoly(quadFloor(bandX0, bandX1, segment.from + 0.005, segment.to - 0.005, 0.007), segment.color, 0.92, null);
    }
    return segments.map((segment) => ({ ...segment, anchor: P(bandX0, 0, (segment.from + segment.to) / 2) }));
  }

  function drawHuman() {
    const d = dims;
    const base = P(d.Wc / 2 + 0.95, 0, -0.55);
    const pb = project(base);
    const pt = project([base[0], 1.7, base[2]]);
    if (pb.z < 0.15 || pt.z < 0.15) return;
    const hpx = pb.y - pt.y;
    ctx.save();
    if (hpx < 28) {
      const side = project([base[0] + 0.25, 0, base[2]]);
      const radius = Math.max(4, Math.hypot(side.x - pb.x, side.y - pb.y));
      ctx.fillStyle = 'rgba(61,74,82,0.55)';
      ctx.beginPath();
      ctx.ellipse(pb.x, pb.y, radius, radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(61,74,82,0.85)';
      ctx.beginPath();
      ctx.arc(pb.x, pb.y, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const scale = hpx;
    const toScreen = ([x, y], mirror) => ({ x: pb.x + (mirror ? -x : x) * scale, y: pb.y - y * scale });
    ctx.beginPath();
    const right = HUMAN_HALF.map((point) => toScreen(point, false));
    const left = [...HUMAN_HALF].reverse().map((point) => toScreen(point, true));
    [...right, ...left].forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
    ctx.closePath();
    ctx.fillStyle = 'rgba(55,68,76,0.82)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pb.x, pb.y - 0.93 * scale, 0.068 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(26,36,33,0.55)';
    ctx.lineWidth = 1;
    const tx = pb.x + 0.3 * scale;
    ctx.beginPath();
    ctx.moveTo(tx, pb.y);
    ctx.lineTo(tx, pt.y);
    ctx.moveTo(tx - 4, pb.y);
    ctx.lineTo(tx + 4, pb.y);
    ctx.moveTo(tx - 4, pt.y);
    ctx.lineTo(tx + 4, pt.y);
    ctx.stroke();
    tag(tx + 6, (pb.y + pt.y) / 2, '1,70 m', '#37444c', 'left');
    ctx.restore();
  }

  function tag(x, y, text, color, align = 'center', strong = false) {
    ctx.save();
    ctx.font = `${strong ? 700 : 600} 12px Outfit, "Segoe UI", sans-serif`;
    const w = ctx.measureText(text).width + 12;
    const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    ctx.fillStyle = 'rgba(255,253,248,0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(left, y - 10, w, 20, 8);
    else ctx.rect(left, y - 10, w, 20);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + 6, y + 0.5);
    ctx.restore();
  }

  function dimension(a, b, label, color) {
    const ends = [project(a), project(b)];
    if (Math.hypot(ends[0].x - ends[1].x, ends[0].y - ends[1].y) < 64) return;
    line3(a, b, color, 0.9, 1.3);
    const pa = project(a);
    const pb = project(b);
    if (pa.z < 0.15 || pb.z < 0.15 ) return;
    for (const point of [pa, pb]) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    tag((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, label, color, 'center', true);
  }

  function drawSegmentLabels(segments) {
    const items = segments
      .map((segment) => ({ ...segment, p: project(segment.anchor) }))
      .filter((item) => item.p.z > 0.15)
      .sort((a, b) => a.p.y - b.p.y);
    let lastY = -Infinity;
    for (const item of items) {
      const y = Math.max(item.p.y, lastY + 22);
      lastY = y;
      const x = Math.max(8, item.p.x - 26);
      ctx.strokeStyle = shade(item.color, 0.9, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(item.p.x, item.p.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      tag(x, y, item.label, shade(item.color, 0.7), 'right');
    }
  }

  function drawRoom() {
    const d = dims;
    const room = model.room;
    const xs = -d.Wc / 2 - SAM_PROTRUSION_M;
    const cx = room.ref === 'sam' ? (xs + d.Wc / 2) / 2 : 0;
    const a = cx - d.roomW / 2;
    const b = cx + d.roomW / 2;
    const f = d.L / 2 - d.roomL / 2;
    const r = d.L / 2 + d.roomL / 2;
    const h = d.roomH;
    const color = COLORS[room.status];
    const corners = [P(a, 0, f), P(b, 0, f), P(b, 0, r), P(a, 0, r), P(a, h, f), P(b, h, f), P(b, h, r), P(a, h, r)];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const [i, j] of edges) line3(corners[i], corners[j], color, 0.75, 1.6, [8, 5]);
    paintPoly([corners[4], corners[5], corners[6], corners[7]], color, 0.05, null);
    const status = { ok: 'cabe', tight: 'cabe, folga < 10 cm', over: 'não cabe' }[room.status];
    const top = project(corners[4]);
    if (top.z > 0.15) {
      const free = (check) => (check.limit == null ? 'livre' : formatFixed(check.limit, 2));
      const [hc, wc, lc] = room.checks;
      tag(top.x, top.y - 16, `Sala ${free(hc)} × ${free(wc)} × ${free(lc)} m · ${status}`, color, 'left', true);
    }
    room.checks
      .filter((check) => check.status === 'over')
      .forEach((check, index) => {
        const anchor = project(check.dim === 'height' ? P(cx, h, f) : check.dim === 'width' ? P(b, 0, f) : P(a, 0, r));
        if (anchor.z > 0.15) {
          const name = { height: 'altura', width: 'largura', length: 'comprimento' }[check.dim];
          tag(anchor.x, anchor.y + 18 + index * 22, `${name} excede ${formatFixed(-check.marginM, 2)} m`, COLORS.over, 'center', true);
        }
      });
  }

  function drawCoolingBadge() {
    const d = dims;
    const fh = Math.min(0.42, Math.max(0.3, d.H * 0.12));
    const anchor = project(P(-d.Wc / 2 + 0.25, d.H - fh / 2, -0.05));
    if (anchor.z < 0.15) return;
    const radius = 13;
    ctx.save();
    ctx.fillStyle = COLORS.cool;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y - 22, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.6;
    for (let index = 0; index < 6; index += 1) {
      const angle = (index * Math.PI) / 3;
      const ex = anchor.x + Math.cos(angle) * (radius - 4);
      const ey = anchor.y - 22 + Math.sin(angle) * (radius - 4);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y - 22);
      ctx.lineTo(ex, ey);
      const bx = anchor.x + Math.cos(angle) * (radius - 8);
      const by = anchor.y - 22 + Math.sin(angle) * (radius - 8);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(angle + 0.9) * 3, by + Math.sin(angle + 0.9) * 3);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(angle - 0.9) * 3, by + Math.sin(angle - 0.9) * 3);
      ctx.stroke();
    }
    ctx.restore();
    tag(anchor.x + radius + 4, anchor.y - 22, 'Refrigerado', COLORS.cool, 'left', true);
  }

  function drawHud() {
    ctx.save();
    ctx.font = '700 14px Outfit, "Segoe UI", sans-serif';
    ctx.fillStyle = '#1a2421';
    ctx.textBaseline = 'top';
    ctx.fillText(`GO.compact · Robô ${model.classId}`, 14, 12);
    ctx.font = '500 12px Outfit, "Segoe UI", sans-serif';
    ctx.fillStyle = '#5c675f';
    ctx.fillText(`${formatFlex(model.capacity)} pacotes · ${THEMES[view.theme].label}${xrayMix > 0.5 ? ' · raios-X' : ''}`, 14, 31);
    ctx.textBaseline = 'bottom';
    ctx.fillText('Grade de 1 m × 1 m', 14, height - 10);
    ctx.restore();
  }

  function draw() {
    if (!dims || !model || !width) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineJoin = 'round';
    basis = computeBasis();
    const d = dims;
    const segments = drawFloor();
    const { shell, internals } = buildRobot();
    const humanPoint = project(P(d.Wc / 2 + 0.95, 0.85, -0.55));
    const corner = project(P(d.Wc / 2, 0.85, 0));
    const humanFirst = humanPoint.z > corner.z;
    if (view.human && humanFirst) drawHuman();
    if (internals.length) {
      const back = shell.filter((face) => !facing(face));
      const front = shell.filter((face) => facing(face));
      drawSorted(back, false);
      drawSorted(internals, false);
      drawSorted(front, false);
    } else {
      drawSorted(shell, true);
    }
    if (model.cooling) drawCoolingBadge();
    if (view.human && !humanFirst) drawHuman();
    if (model.room) drawRoom();
    const xs = -d.Wc / 2 - SAM_PROTRUSION_M;
    dimension(P(d.Wc / 2 + 0.22, 0, -0.08), P(d.Wc / 2 + 0.22, d.H, -0.08), model.labels.H, '#0b3d34');
    dimension(P(xs, 0, -0.45), P(d.Wc / 2, 0, -0.45), `${model.labels.Ws} c/ SAM`, '#0b3d34');
    dimension(P(xs - 0.62, 0, 0), P(xs - 0.62, 0, d.L), model.labels.L, '#0b3d34');
    drawSegmentLabels(segments);
    drawHud();
  }

  const zoomInput = document.getElementById('zoom');
  zoomInput.addEventListener('input', () => zoomTo(Number(zoomInput.value) / 100));

  canvas.addEventListener('pointerdown', (event) => {
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: camTarget.zoom };
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    const prev = pointers.get(event.pointerId);
    if (!prev) return;
    const next = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, next);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      zoomTo(pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / (pinch.dist || 1)));
      return;
    }
    orbit(-(next.x - prev.x) * 0.008, (next.y - prev.y) * 0.006);
  });
  const release = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener(
    'wheel',
    (event) => {
      if (document.activeElement !== canvas) return;
      event.preventDefault();
      zoomTo(camTarget.zoom * Math.exp(-event.deltaY * 0.0012));
    },
    { passive: false },
  );
  canvas.addEventListener('dblclick', () => setCamera('iso'));
  canvas.addEventListener('keydown', (event) => {
    const moves = { ArrowLeft: [0.12, 0], ArrowRight: [-0.12, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] };
    if (moves[event.key]) {
      event.preventDefault();
      orbit(moves[event.key][0], moves[event.key][1], false);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomTo(camTarget.zoom * 1.12);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomTo(camTarget.zoom / 1.12);
    }
  });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) wake();
    }).observe(canvas);
  }
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('beforeprint', () => {
    resize();
    step(1);
    draw();
  });
  resize();
  return { setModel, setCamera, wake };
}

function setXray(on) {
  view.xray = on;
  document.getElementById('xray').setAttribute('aria-pressed', on ? 'true' : 'false');
  viewer?.wake();
  persist();
}

function syncViewButtons() {
  document.getElementById('xray').setAttribute('aria-pressed', view.xray ? 'true' : 'false');
  document.getElementById('human').setAttribute('aria-pressed', view.human ? 'true' : 'false');
  document.querySelectorAll('[data-theme]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.theme === view.theme ? 'true' : 'false');
  });
}

let viewer = null;

function bindChrome() {
  document.getElementById('form').addEventListener('submit', (event) => event.preventDefault());
  document.getElementById('ver-calculo').addEventListener('click', () => {
    const memory = document.getElementById('memoria');
    const button = document.getElementById('ver-calculo');
    const willOpen = memory.classList.contains('is-collapsed');
    memory.classList.toggle('is-collapsed', !willOpen);
    button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (willOpen) memory.scrollIntoView({ block: 'nearest' });
  });
  document.getElementById('print').addEventListener('click', () => window.print());
  document.getElementById('reset').addEventListener('click', () => {
    state = freshState();
    view = { ...VIEW_DEFAULTS };
    lastAdjust = null;
    matrixHeight = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    syncViewButtons();
    viewer?.setCamera('iso');
    fillControls();
    commit();
  });
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = PRESETS.find((item) => item.id === button.dataset.preset);
      if (!preset) return;
      Object.assign(state, {
        heightM: preset.heightM,
        widthSam: preset.widthSam,
        classId: preset.classId,
        secondGripper: false,
        coolingModule: false,
        conveyorEur: 0,
        includeServices: true,
      });
      lastAdjust = null;
      matrixHeight = preset.heightM;
      fillControls();
      commit();
    });
  });
  document.querySelectorAll('[data-camera]').forEach((button) => {
    button.addEventListener('click', () => viewer?.setCamera(button.dataset.camera));
  });
  document.getElementById('xray').addEventListener('click', () => setXray(!view.xray));
  document.getElementById('human').addEventListener('click', () => {
    view.human = !view.human;
    syncViewButtons();
    viewer?.wake();
    persist();
  });
  document.querySelectorAll('[data-theme]').forEach((button) => {
    button.addEventListener('click', () => {
      view.theme = button.dataset.theme;
      syncViewButtons();
      viewer?.wake();
      persist();
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.tip').forEach((node) => {
      node.hidden = true;
    });
    document.querySelectorAll('.tip-btn').forEach((node) => node.setAttribute('aria-expanded', 'false'));
  });
}

loadState();
buildForm();
fillControls();
bindChrome();
syncViewButtons();
viewer = createViewer(document.getElementById('viewer'));
commit();
