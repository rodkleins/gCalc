import {
  AVERAGE_SERVICES_EUR,
  CLASSES,
  CONFIGURATIONS,
  DEFAULTS,
  HEIGHTS,
  LENGTH_INCLUDED,
  NCM_INFO,
  OPTIONS,
  PRESETS,
  SAM_PROTRUSION_M,
  WIDTHS,
  WIDTH_REF_LABELS,
  bonusLedger,
  brazilCost,
  classOf,
  classesAt,
  evaluate,
  explain as explainResult,
  formatBRL as formatBRLLocale,
  formatEUR as formatEURLocale,
  formatFixed as formatFixedLocale,
  formatFlex as formatFlexLocale,
  formatMeters as formatMetersLocale,
  formatPacks as formatPacksLocale,
  maxHeightOf,
  parseBr,
  physicalWidthM,
  widthsAt,
  configLabel as configLabelLocale,
} from './calc.js';
import { I18N } from './i18n.js';

const LANG_KEY = 'gcalc.modelos.interno.lang';
let lang = 'pt';

function uiLocale() {
  return lang === 'en' ? 'en-US' : 'pt-BR';
}

function t(key, fallback, vars) {
  let text = lang === 'en' ? (I18N.en[key] ?? fallback ?? key) : (fallback ?? key);
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value ?? ''));
  }
  return text;
}

function formatBRL(value) {
  return formatBRLLocale(value, uiLocale());
}
function formatEUR(value) {
  return formatEURLocale(value, uiLocale());
}
function formatFixed(value, digits) {
  return formatFixedLocale(value, digits, uiLocale());
}
function formatFlex(value, maxDigits = 2) {
  return formatFlexLocale(value, maxDigits, uiLocale());
}
function formatMeters(value) {
  return formatMetersLocale(value, uiLocale());
}
function formatPacks(value) {
  return formatPacksLocale(value, uiLocale());
}
function configLabel(config) {
  return configLabelLocale(config, uiLocale());
}
function explain(result) {
  return explainResult(result, uiLocale());
}

function loadLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'pt') lang = stored;
  } catch {
    /* navegador sem armazenamento */
  }
}

function applyI18n() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  document.title = t('doc.title', 'Modelos e acordo Gollmann (interno)');
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    if (meta.dataset.i18nPt == null) meta.dataset.i18nPt = meta.getAttribute('content') ?? '';
    meta.setAttribute('content', lang === 'en' ? t('doc.description', meta.dataset.i18nPt) : meta.dataset.i18nPt);
  }
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    if (node.dataset.i18nPt == null) node.dataset.i18nPt = node.innerHTML;
    const key = node.dataset.i18n;
    if (lang === 'en') node.textContent = t(key, node.textContent);
    else node.innerHTML = node.dataset.i18nPt;
  });
  document.querySelectorAll('[data-i18n-title]').forEach((node) => {
    if (node.dataset.i18nTitlePt == null) node.dataset.i18nTitlePt = node.getAttribute('title') ?? '';
    const key = node.dataset.i18nTitle;
    node.setAttribute('title', lang === 'en' ? t(key, node.dataset.i18nTitlePt) : node.dataset.i18nTitlePt);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
    if (node.dataset.i18nAriaPt == null) node.dataset.i18nAriaPt = node.getAttribute('aria-label') ?? '';
    const key = node.dataset.i18nAria;
    node.setAttribute('aria-label', lang === 'en' ? t(key, node.dataset.i18nAriaPt) : node.dataset.i18nAriaPt);
  });
  document.getElementById('lang-pt')?.setAttribute('aria-pressed', lang === 'pt' ? 'true' : 'false');
  document.getElementById('lang-en')?.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
}

function setLang(next) {
  lang = next === 'en' ? 'en' : 'pt';
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* navegador sem armazenamento */
  }
  applyI18n();
  syncParams(paramsAreOpen());
  buildForm();
  fillControls();
  if (current) render(current);
  else commit();
}

const STORAGE_KEY = 'gcalc.modelos.interno.v3';

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
        key: 'modelLine',
        label: 'Modelo',
        kind: 'select',
        wide: true,
        tooltip: 'GO.compact é o padrão: a largura física é a do corpo, sem o SAM. GO.direct usa a largura física da outra linha. O preço continua o da classe (coluna com SAM). Exemplo: Classe 2,80 m · GO.direct 3,00 m.',
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
    intro: 'Opcionais, transporte (média € 22.500) e serviços locais em R$, separados.',
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
        key: 'conveyorEur',
        label: 'Tecnologia de esteiras (€)',
        prefix: '€',
        min: 0,
        digits: 2,
        wide: true,
        tooltip: 'Sob consulta na proposta: digite o valor da cotação individual, por robô. Padrão zero.',
      },
      {
        key: 'servicesEur',
        label: 'Transporte e instalação (€)',
        prefix: '€',
        min: 0,
        digits: 2,
        wide: true,
        quick: [
          { value: AVERAGE_SERVICES_EUR, label: 'Média (€ 22.500)' },
          { value: 'class', label: 'Valor da classe' },
          { value: 18000, label: 'Mín. (€ 18.000)' },
          { value: 27000, label: 'Máx. (€ 27.000)' },
          { value: 0, label: '€ 0' },
        ],
        tooltip: 'Varia por obra. Padrão: média de € 22.500 das 7 classes do slide 8 (S € 18.000, M € 19.500, L € 21.000, XL € 22.500, XXL € 24.000, 3XL € 25.500, 4XL € 27.000).',
      },
      {
        key: 'localServicesBrl',
        label: 'Serviços locais no Brasil (R$)',
        prefix: 'R$',
        min: 0,
        digits: 2,
        wide: true,
        quick: [
          { value: 0, label: 'R$ 0' },
          { value: 50000, label: 'R$ 50 mil' },
          { value: 100000, label: 'R$ 100 mil' },
          { value: 150000, label: 'R$ 150 mil' },
        ],
        tooltip: 'Valor faturado aqui no Brasil, em reais, por robô. Soma ao Preço Total sem câmbio, nacionalização, crédito ou desconto por volume.',
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
    title: '4. Câmbio, Importação (NCM 8479.89.99) e Créditos',
    open: true,
    intro: 'NCM 8479.89.99 em cascata: II, IPI 0%, PIS 2,10%, COFINS 10,25% e ICMS por dentro.',
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
        key: 'exTarifario',
        label: 'Ex-Tarifário (II)',
        kind: 'check',
        checkLabel: 'Aplicar Ex-Tarifário de Bem de Capital — zera o II para 0% (NCM 8479.89.99)',
        wide: true,
        tooltip: 'Com o Ex-Tarifário de BK o Imposto de Importação cai para 0%. Desligado, vale a alíquota do campo abaixo. O II nunca gera crédito e entra na base do IPI e do ICMS.',
      },
      {
        key: 'iiRatePct',
        label: 'Alíquota do II sem Ex-Tarifário (%)',
        suffix: '%',
        min: 0,
        max: 100,
        lockedByNot: 'exTarifario',
        wide: true,
        quick: [
          { value: 12.6, label: '12,6% TEC Mercosul' },
          { value: 20, label: '20,0% Res. GECEX 852/2026' },
        ],
        tooltip: 'Usada só com o Ex-Tarifário desligado. 12,6% é a TEC Mercosul da NCM 8479.89.99; 20% é a alíquota da Res. GECEX 852/2026.',
      },
      {
        key: 'icmsRatePct',
        label: 'ICMS-Importação por dentro (%)',
        suffix: '%',
        min: 0,
        max: 40,
        wide: true,
        quick: [
          { value: 8.8, label: '8,80% Convênio 52/91 (BK)' },
          { value: 18, label: '18,00% ICMS cheio SP' },
        ],
        tooltip: 'Carga efetiva do ICMS-Importação em SP, calculado por dentro: base = (VA + II + IPI + PIS + COFINS + despesas) ÷ (1 − alíquota). O Convênio ICMS 52/91 (Anexo I, subitem 62.7) reduz a carga do BK para 8,80%.',
      },
      {
        key: 'customsExpensesPct',
        label: 'Despesas aduaneiras / Siscomex / AFRMM (% do VA)',
        suffix: '%',
        min: 0,
        max: 50,
        wide: true,
        quick: [
          { value: 0, label: '0% Só impostos' },
          { value: 2.5, label: '2,5% C/ despesas' },
        ],
        tooltip: 'Taxa Siscomex, AFRMM, armazenagem e despachante, em % do Valor Aduaneiro. Entram na base do ICMS e não geram crédito neste cálculo. Padrão 0% para ver só os impostos.',
      },
      {
        key: 'creditPisCofins',
        label: 'Crédito PIS + COFINS (11,75%)',
        kind: 'check',
        checkLabel: 'Creditar PIS (2,10%) + COFINS base (9,65%) = 11,75% do VA (Lucro Real 48x / CBS)',
        wide: true,
        tooltip: 'No Lucro Real, PIS e COFINS-Importação do Ativo Imobilizado viram crédito em 48 meses (ou integral via CBS). O adicional de 0,60% da COFINS não gera crédito por vedação legal (Lei 10.865/2004, art. 15, § 1º-A) e fica sempre como custo.',
      },
      {
        key: 'creditIcms',
        label: 'Crédito ICMS-Importação',
        kind: 'check',
        checkLabel: 'Creditar ICMS-Importação (CIAP 48x / IBS)',
        wide: true,
        tooltip: 'ICMS do Ativo Imobilizado vira crédito em 48 parcelas no CIAP (LC 87/96, art. 20, § 5º), na proporção das saídas tributadas, ou integral via IBS.',
      },
      {
        key: 'icmsCreditFactorPct',
        label: 'Aproveitamento do crédito de ICMS (%)',
        suffix: '%',
        min: 0,
        max: 100,
        lockedBy: 'creditIcms',
        wide: true,
        quick: [
          { value: 100, label: '100% Integral / IBS' },
          { value: 50, label: '50% Rateio CIAP Farmácia' },
          { value: 0, label: '0% Locadora s/ ICMS' },
        ],
        tooltip: '100%: crédito integral (ou IBS). 50%: rateio do CIAP numa farmácia com parte das saídas isentas ou com ST. 0%: locadora pura, sem débito de ICMS (Súmula Vinculante 31).',
      },
    ],
  },
  {
    id: 'rollout',
    title: '5. Desconto por Volume (Faixas do Acordo)',
    open: true,
    intro: 'Escolha a quantidade de robôs para aplicar a faixa de desconto por volume (0% a 8%) sobre o pedido Gollmann.',
    fields: [
      {
        key: 'fleetRobots',
        label: 'Quantidade de robôs',
        suffix: 'robôs',
        integer: true,
        min: 1,
        max: 250,
        step: 1,
        slider: true,
        quick: [
          { value: 1, label: '1 robô (0%)' },
          { value: 10, label: '10 robôs (2%)' },
          { value: 25, label: '25 robôs (4%)' },
          { value: 50, label: '50 robôs (6%)' },
          { value: 100, label: '100 robôs (8%)' },
        ],
        tooltip: 'Faixas de desconto por volume (slides 11 e 12): 1–9 robôs = 0%, 10–24 = 2%, 25–49 = 4%, 50–99 = 6%, 100+ = 8%.',
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

const PARAMS_KEY = 'gcalc.modelos.interno.params';
const paramsQuery = window.matchMedia('(min-width: 900px)');

function paramsWide() {
  return paramsQuery.matches;
}

function storedParamsOpen() {
  try {
    const value = localStorage.getItem(PARAMS_KEY);
    if (value === 'closed') return false;
    if (value === 'open') return true;
  } catch {
    /* navegador sem armazenamento */
  }
  return true;
}

function paramsAreOpen() {
  const workspace = document.getElementById('workspace');
  if (!workspace) return true;
  if (paramsWide()) return !workspace.classList.contains('params-collapsed');
  return workspace.classList.contains('params-drawer');
}

function syncParams(open, { persistChoice = false } = {}) {
  const workspace = document.getElementById('workspace');
  const button = document.getElementById('toggle-params');
  const backdrop = document.getElementById('params-backdrop');
  const wide = paramsWide();
  workspace.classList.toggle('params-collapsed', wide && !open);
  workspace.classList.toggle('params-drawer', !wide && open);
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.textContent = wide && open ? t('params.toggleClose', 'Recolher') : t('params.toggleOpen', 'Parâmetros');
  if (backdrop) backdrop.hidden = wide || !open;
  document.body.classList.toggle('params-lock', !wide && open);
  if (persistChoice) {
    try {
      localStorage.setItem(PARAMS_KEY, open ? 'open' : 'closed');
    } catch {
      /* navegador sem armazenamento */
    }
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

function parseInput(raw) {
  const text = String(raw)
    .trim()
    .replace(/[\s ]/g, '')
    .replace(/R\$|€|EUR/gi, '')
    .replace(/%/g, '')
    .replace(/m$/i, '');
  if (!text || text === '-' || text === ',' || text === '.') return null;
  const value = Number(text.replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function fromDisplay(field, raw) {
  if (field.allowEmpty && String(raw).trim() === '') return null;
  const parsed = lang === 'en'
    ? parseInput(raw)
    : parseBr(raw, { decimalDot: field.decimalDot || String(field.suffix ?? '').includes('%') });
  if (parsed == null) return undefined;
  return clampField(field, parsed);
}

/* Opções dos seletores. Combinações sem célula continuam escolhíveis: a troca automática ajusta o resto. */

function selectOptions(key) {
  if (key === 'heightM') {
    return HEIGHTS.map((heightM) => ({
      value: heightM.toFixed(2),
      label: `${formatMeters(heightM)} · ${widthsAt(heightM).length} ${t('opt.widths', 'larguras')}`,
    }));
  }
  if (key === 'widthSam') {
    return WIDTHS.map((width) => {
      const max = maxHeightOf(width.sam);
      const off = state.heightM > max + 1e-9;
      return {
        value: width.key,
        label: `${formatMeters(width.sam)} ${t('opt.withSam', 'c/ SAM')} · GO.compact ${formatFixed(width.compact, 2)} · GO.direct ${formatFixed(width.direct, 2)}${off ? ` (${t('opt.upTo', 'até')} ${formatMeters(max)})` : ''}`,
      };
    });
  }
  if (key === 'modelLine') {
    return [
      { value: 'compact', label: t('model.compact', 'GO.compact') },
      { value: 'direct', label: t('model.direct', 'GO.direct') },
    ];
  }
  if (key === 'classId') {
    const valid = classesAt(state.heightM, state.widthSam);
    return CLASSES.map((cls) => ({
      value: cls.id,
      label: `${t('opt.robot', 'Robô')} ${cls.id} · ${t('opt.approx', 'aprox.')} ${formatPacks(cls.approxPacks)}${valid.includes(cls.id) ? '' : ` — ${t('opt.missing', 'não existe nesta largura')}`}`,
    }));
  }
  if (key === 'roomWidthRef') {
    return Object.entries(WIDTH_REF_LABELS).map(([value, label]) => ({
      value,
      label: t(`ref.${value}`, label),
    }));
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

function fieldLabel(field) {
  return t(`field.${field.key}.label`, field.label);
}

function fieldTip(field) {
  return t(`field.${field.key}.tip`, field.tooltip);
}

function fieldCheck(field) {
  return t(`field.${field.key}.check`, field.checkLabel || 'Ligado');
}

function fieldPlaceholder(field) {
  if (!field.placeholder) return '';
  return t(`field.${field.key}.placeholder`, field.placeholder);
}

function fieldSuffix(field) {
  if (!field.suffix) return '';
  return t(`field.${field.key}.suffix`, field.suffix);
}

function quickLabel(field, item) {
  return t(`quick.${field.key}.${item.value}`, item.label);
}

function renderField(field) {
  const wrap = el('div', field.wide || field.slider ? 'field field-wide' : 'field');
  const head = el('div', 'field-head');
  const label = el(field.kind === 'pills' ? 'span' : 'label', null, fieldLabel(field));
  if (field.kind !== 'pills') label.htmlFor = field.kind === 'check' || field.kind === 'select' ? field.key : `${field.key}-text`;
  label.id = `lbl-${field.key}`;
  head.append(label);
  const tipBtn = el('button', 'tip-btn', t('field.help', 'Ajuda'));
  tipBtn.type = 'button';
  tipBtn.setAttribute('aria-expanded', 'false');
  tipBtn.setAttribute('aria-controls', `tip-${field.key}`);
  const tip = el('p', 'tip', fieldTip(field));
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
    row.append(input, el('span', null, fieldCheck(field)));
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
  if (field.placeholder) text.placeholder = fieldPlaceholder(field);
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
  if (field.suffix) affix.append(el('span', 'affix-label', fieldSuffix(field)));
  control.append(affix);
  wrap.append(control);
  if (field.quick) {
    wrap.append(quickRow(field, (value) => {
      state[field.key] = quickValue(value);
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

/** Atalho 'class' do transporte e instalação: o valor da classe escolhida no slide 8. */
function quickValue(value) {
  return value === 'class' ? classOf(state.classId).servicesEur : value;
}

function quickRow(field, apply) {
  const row = el('div', 'quick');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', `${t('field.shortcuts', 'Atalhos')}: ${fieldLabel(field)}`);
  for (const item of field.quick) {
    const button = el('button', null, quickLabel(field, item));
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
  const openState = new Map([...form.querySelectorAll('details')].map((node) => [node.id, node.open]));
  form.replaceChildren();
  for (const section of SECTIONS) {
    const card = el('details', 'card fold');
    card.id = `sec-${section.id}`;
    if (openState.has(card.id)) card.open = openState.get(card.id);
    else if (section.open) card.open = true;
    const summary = el('summary');
    summary.append(el('span', 'fold-title', t(`section.${section.id}.title`, section.title)));
    const body = el('div', 'fold-body');
    body.append(el('p', 'intro', t(`section.${section.id}.intro`, section.intro)));
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
  control.wrap.querySelectorAll('[data-quick]').forEach((button) => {
    button.disabled = off;
  });
  control.wrap.classList.toggle('is-off', off);
}

function syncLocks() {
  for (const [key, control] of controls) {
    if (control.field.lockedBy) lockControl(key, !state[control.field.lockedBy]);
    // lockedByNot: trava quando a chave está ligada (a alíquota do II só vale sem Ex-Tarifário).
    if (control.field.lockedByNot) lockControl(key, Boolean(state[control.field.lockedByNot]));
  }
}

function syncQuick() {
  for (const [key, control] of controls) {
    if (!control.field.quick) continue;
    control.wrap.querySelectorAll('[data-quick]').forEach((button) => {
      const raw = button.dataset.quick;
      // Na classe XL o valor da classe é a própria média: fica marcado só o atalho da média.
      const on = raw === 'class'
        ? state[key] === quickValue(raw) && state[key] !== AVERAGE_SERVICES_EUR
        : state[key] === Number(raw);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
}

function compactBRL(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(uiLocale(), {
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

/** Largura física da linha escolhida. O preço e o footprintM2 da classe não entram aqui. */
function selectedLine(result) {
  const quote = result.quote;
  const line = result.modelLine === 'direct' ? 'direct' : 'compact';
  const name = line === 'direct' ? 'GO.direct' : 'GO.compact';
  const width = physicalWidthM(quote.widthSam, line);
  const area = Math.round(width * quote.totalLengthM * 10000) / 10000;
  const volume = Math.round(area * quote.heightM * 10000) / 10000;
  return { line, name, width, area, volume };
}

function classLine(result, model = selectedLine(result)) {
  return t('model.classLine', `Classe ${formatMeters(result.quote.widthSam)} · ${model.name} ${formatMeters(model.width)}`, {
    cls: formatMeters(result.quote.widthSam),
    model: model.name,
    width: formatMeters(model.width),
  });
}

function adjustMessage(selection) {
  const { requested } = selection;
  const parts = selection.changed.map((key) => t(`change.${key}`, CHANGE_LABELS[key]));
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ${t('change.and', 'e')} ${parts[parts.length - 1]}` : parts[0];
  return t('adjust.message', '{size} · Robô {cls} não existe na tabela. Ajustei {list}: {config}.', {
    size: `${formatMeters(requested.heightM)} × ${formatMeters(requested.widthSam)}`,
    cls: requested.classId,
    list,
    config: configLabel(selection.config),
  });
}

function renderStatus(result) {
  const status = document.getElementById('selection-status');
  const banner = document.getElementById('model-banner');
  const { config } = result.selection;
  const valid = classesAt(config.heightM, config.widthSam);
  if (status) {
    status.classList.toggle('is-adjusted', Boolean(lastAdjust));
    status.replaceChildren(
      el('span', 'mode-line', classLine(result)),
      el('span', 'mode-result', lastAdjust ? t('status.adjusted', 'Combinação ajustada') : t('status.valid', 'Combinação válida da tabela de {height}', { height: formatMeters(config.heightM) })),
      el(
        'span',
        'mode-reason',
        lastAdjust ??
          t('status.classes', 'Nesta largura e altura existem as classes {classes}. Larguras nesta altura: {widths} m.', {
            classes: valid.join(', '),
            widths: widthsAt(config.heightM).map((width) => formatFixed(width.sam, 2)).join(' · '),
          }),
      ),
    );
  }
  banner.hidden = !lastAdjust;
  banner.textContent = lastAdjust ?? '';
}

function renderHero(result) {
  const { quote, brazil } = result;
  const model = selectedLine(result);
  const hero = document.getElementById('hero-kpis');
  hero.replaceChildren();
  renderKpi(hero, {
    id: 'total-price',
    label: t('kpi.total', '1. Preço Total (1 Robô)'),
    value: compactBRL(result.totalGrossBrl),
    exact: `${formatBRL(result.totalGrossBrl)} · ≈ ${formatEUR(result.totalEurApprox)}`,
    sub: [
      quote.discountPct > 0 ? t('kpi.totalSubVolume', `−${pct(quote.discountPct)} volume`, { pct: pct(quote.discountPct) }) : null,
      brazil.exTarifario ? t('kpi.totalSubIi0', 'II 0%') : t('kpi.totalSubIi', `II ${pct(brazil.effectiveIiPct)}`, { pct: pct(brazil.effectiveIiPct) }),
      t('kpi.totalSubImport', `imp. ${formatBRL(brazil.importBrl)}`, { value: formatBRL(brazil.importBrl) }),
    ].filter(Boolean).join(' · '),
    title: t('kpi.totalTitle', `VA ${formatBRL(brazil.vaBrl)} + impostos da NCM ${NCM_INFO.code} ${formatBRL(brazil.importBrl)} (${pct(brazil.effectiveImportPct)} s/ VA) + serviços locais ${formatBRL(quote.localServicesBrl)}. Pedido Gollmann ${formatEUR(quote.netOrderEur)}${quote.discountPct > 0 ? `, desconto ${pct(quote.discountPct)} (−${formatEUR(quote.discountEur)})` : ''}.`, {
      va: formatBRL(brazil.vaBrl),
      ncm: NCM_INFO.code,
      tax: formatBRL(brazil.importBrl),
      pct: pct(brazil.effectiveImportPct),
      local: formatBRL(quote.localServicesBrl),
      order: formatEUR(quote.netOrderEur),
      discount: quote.discountPct > 0 ? t('kpi.totalDiscount', `, desconto ${pct(quote.discountPct)} (−${formatEUR(quote.discountEur)})`, { pct: pct(quote.discountPct), value: formatEUR(quote.discountEur) }) : '',
    }),
    hero: true,
  });
  renderKpi(hero, {
    id: 'robot-price',
    label: t('kpi.robot', 'Preço do Robô (Tabela)'),
    value: formatEUR(quote.tablePriceEur),
    exact: formatBRL(result.brl.tablePrice),
    sub: `${formatPacks(quote.capacityPacks)} · ${formatFixed(quote.heightM, 2)} × ${formatFixed(model.width, 2)} × ${formatFixed(quote.totalLengthM, 2)} m`,
    title: `${formatEUR(quote.baseRobotEur)} + ${formatEUR(quote.autoLoadingEur)} + ${formatEUR(quote.samEur)}`,
    hero: true,
  });
  const chosen = [
    quote.secondGripper && t('kpi.optArm', '2º braço'),
    quote.coolingModule && t('kpi.optCool', 'refrigeração'),
    quote.conveyorEur > 0 && t('kpi.optBelt', 'esteiras'),
  ].filter(Boolean);
  renderKpi(hero, {
    id: 'options-price',
    label: t('kpi.options', '2. Opcionais (Separado)'),
    value: formatEUR(quote.optionsEur),
    exact: formatBRL(result.brl.options),
    sub: chosen.length ? chosen.join(' · ') : t('kpi.optionsNone', 'nenhum opcional selecionado'),
  });
  renderKpi(hero, {
    id: 'services-price',
    label: t('kpi.transport', '2. Transporte e Instalação'),
    value: formatEUR(quote.servicesEur),
    exact: formatBRL(result.brl.services),
    sub: quote.servicesEur === AVERAGE_SERVICES_EUR ? t('kpi.average', 'média') : t('kpi.edited', 'editado'),
    title: t('kpi.transportTitle', `Classe ${quote.classId}: ${formatEUR(quote.classServicesEur)}. Média da proposta: € 22.500.`, { cls: quote.classId, value: formatEUR(quote.classServicesEur) }),
  });
  renderKpi(hero, {
    id: 'local-services',
    label: t('kpi.local', '3. Serviços Locais (Brasil)'),
    value: formatBRL(quote.localServicesBrl),
    exact: t('kpi.localExact', `≈ ${formatEUR(quote.localServicesEurApprox)} pelo câmbio`, { value: formatEUR(quote.localServicesEurApprox) }),
    title: t('kpi.localTitle', 'Faturado em R$ no Brasil, fora dos impostos de importação e do desconto por volume.'),
  });
  renderKpi(hero, {
    id: 'net-brl',
    label: t('kpi.net', 'Investimento Líquido Pós-Crédito'),
    value: compactBRL(result.totalNetBrl),
    exact: formatBRL(result.totalNetBrl),
    sub: t('kpi.netSub', `créditos −${formatBRL(brazil.creditBrl)}`, { value: formatBRL(brazil.creditBrl) }),
    title: t('kpi.netTitle', `${formatBRL(result.totalGrossBrl)} − créditos ${formatBRL(brazil.creditBrl)} = ${formatBRL(result.totalNetBrl)}. PIS + COFINS ${formatBRL(brazil.creditPisCofinsBrl)} · ICMS ${formatBRL(brazil.creditIcmsBrl)}. Custo não recuperável ${formatBRL(brazil.nonRecoverableBrl)}${brazil.exTarifario ? '' : ', com o II'}.`, {
      gross: formatBRL(result.totalGrossBrl),
      credit: formatBRL(brazil.creditBrl),
      net: formatBRL(result.totalNetBrl),
      pis: formatBRL(brazil.creditPisCofinsBrl),
      icms: formatBRL(brazil.creditIcmsBrl),
      left: formatBRL(brazil.nonRecoverableBrl),
      ii: brazil.exTarifario ? '' : t('kpi.netIi', ', com o II'),
    }),
  });
  const note = document.getElementById('model-note');
  note.textContent = `${classLine(result, model)} · ${configLabel(quote.config)}`;
  note.title = t('note.title', `${model.name} ${formatMeters(model.width)}. GO.compact ${formatMeters(quote.widthCompact)} sem o SAM, GO.direct ${formatMeters(quote.widthDirect)} de referência. Comprimento da tabela ${formatMeters(quote.tableLengthM)}${quote.secondGripper ? `, ${formatMeters(quote.totalLengthM)} com o 2º braço` : ''}. Área do modelo ${m2(model.area)}. Área da classe ${m2(quote.footprintM2)}.`, {
    model: model.name,
    width: formatMeters(model.width),
    compact: formatMeters(quote.widthCompact),
    direct: formatMeters(quote.widthDirect),
    table: formatMeters(quote.tableLengthM),
    arm: quote.secondGripper ? t('note.arm', `, ${formatMeters(quote.totalLengthM)} com o 2º braço`, { length: formatMeters(quote.totalLengthM) }) : '',
    area: m2(model.area),
    classArea: m2(quote.footprintM2),
  });
  const options = document.getElementById('options-hint');
  if (options) {
    options.textContent = t('hint.options', `Robô ${formatEUR(quote.tablePriceEur)} + opcionais ${formatEUR(quote.optionsEur)} + transporte e instalação ${formatEUR(quote.servicesEur)} = pedido Gollmann de ${formatEUR(quote.orderEur)} por robô.`, {
      robot: formatEUR(quote.tablePriceEur),
      options: formatEUR(quote.optionsEur),
      services: formatEUR(quote.servicesEur),
      order: formatEUR(quote.orderEur),
    });
  }
  const fx = document.getElementById('fx-hint');
  if (fx) {
    fx.textContent = t('hint.fx', `Valor Aduaneiro: ${formatEUR(quote.netOrderEur)} × ${formatFlex(brazil.fxRate, 4)} = ${formatBRL(brazil.vaBrl)}.`, {
      eur: formatEUR(quote.netOrderEur),
      fx: formatFlex(brazil.fxRate, 4),
      brl: formatBRL(brazil.vaBrl),
    });
  }
}

/** Barra do Ex-Tarifário e do Convênio ICMS 52/91, acima dos quadrantes. */
function renderFiscalBar(result) {
  const { quote, brazil } = result;
  const exButton = document.getElementById('toggle-ex-tarifario');
  const convButton = document.getElementById('toggle-convenio-icms');
  const summary = document.getElementById('ex-tarifario-summary');
  if (!exButton || !convButton || !summary) return;
  exButton.setAttribute('aria-pressed', brazil.exTarifario ? 'true' : 'false');
  exButton.classList.toggle('is-on', brazil.exTarifario);
  exButton.classList.toggle('is-warn', !brazil.exTarifario);
  exButton.textContent = brazil.exTarifario
    ? t('fiscal.exOn', 'Ex-Tarifário: LIGADO (II = 0%)')
    : t('fiscal.exOff', `Ex-Tarifário: DESLIGADO (II = ${pct(brazil.effectiveIiPct)})`, { pct: pct(brazil.effectiveIiPct) });
  convButton.setAttribute('aria-pressed', brazil.convenioIcms5291 ? 'true' : 'false');
  convButton.classList.toggle('is-on', brazil.convenioIcms5291);
  convButton.classList.toggle('is-warn', !brazil.convenioIcms5291);
  convButton.textContent = t('fiscal.conv', `Convênio ICMS 52/91: ${brazil.convenioIcms5291 ? 'LIGADO' : 'DESLIGADO'} (ICMS ${formatFixed(brazil.icmsRatePct, 2)}%)`, {
    state: brazil.convenioIcms5291 ? t('fiscal.on', 'LIGADO') : t('fiscal.off', 'DESLIGADO'),
    pct: formatFixed(brazil.icmsRatePct, 2),
  });
  const load = t('fiscal.load', `Carga ${formatFixed(brazil.effectiveImportPct, 2)}% s/ VA`, { pct: formatFixed(brazil.effectiveImportPct, 2) });
  if (brazil.exTarifario) {
    // O que o Ex-Tarifário poupa: o II e o reflexo dele no IPI e no ICMS por dentro.
    const without = brazilCost(quote.netOrderEur, { ...state, exTarifario: false });
    summary.textContent = t('fiscal.save', `${load} · II −${formatBRL(without.iiBrl)}`, { load, value: formatBRL(without.iiBrl) });
    summary.title = t('fiscal.saveTitle', `Economia de II ${formatBRL(without.iiBrl)}. Com o reflexo no ICMS, ${formatBRL(without.importBrl - brazil.importBrl)}.`, {
      ii: formatBRL(without.iiBrl),
      total: formatBRL(without.importBrl - brazil.importBrl),
    });
  } else {
    summary.textContent = t('fiscal.pay', `${load} · II ${formatBRL(brazil.iiBrl)}`, { load, value: formatBRL(brazil.iiBrl) });
    summary.title = t('fiscal.payTitle', `II ${formatBRL(brazil.iiBrl)} não gera crédito e entra na base do IPI e do ICMS.`, { value: formatBRL(brazil.iiBrl) });
  }
}

function renderDims(result) {
  const { quote, room } = result;
  const model = selectedLine(result);
  const host = document.getElementById('dims');
  const status = (dim) => {
    if (!result.roomFilterOn) return '';
    const check = room.checks.find((item) => item.dim === dim);
    return check?.status === 'over' ? 'is-over' : check?.status === 'tight' ? 'is-tight' : '';
  };
  const pills = [
    [t('pill.height', 'Altura'), formatMeters(quote.heightM), status('height')],
    [t('pill.width', 'Largura c/ SAM'), formatMeters(quote.widthSam), result.roomWidthRef === 'sam' ? status('width') : ''],
    [model.name, formatMeters(model.width), result.roomWidthRef === model.line ? status('width') : ''],
    [t('pill.length', 'Comprimento total'), formatMeters(quote.totalLengthM), status('length')],
    [t('pill.area', 'Área do modelo'), m2(model.area), ''],
    [t('pill.volume', 'Volume do modelo'), `${formatFixed(model.volume, 2)} m³`, ''],
    [t('pill.capacity', 'Capacidade garantida'), formatPacks(quote.capacityPacks), result.roomFilterOn && !room.capacityOk ? 'is-over' : ''],
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
    summary.textContent = t('space.off', 'Filtro desligado. Ligue "Filtrar por medidas da sala" no bloco 3 para buscar entre as 286 configurações as que cabem na loja.');
    return;
  }
  const limit = (value) => (value == null ? t('free', 'livre') : formatMeters(value));
  const reasons = [
    ...room.checks
      .filter((item) => !item.ok)
      .map((item) => t('space.over', `${{ height: 'altura', width: 'largura', length: 'comprimento' }[item.dim]} excede ${formatMeters(-item.marginM)}`, {
        dim: t(`space.dim.${item.dim}`, { height: 'altura', width: 'largura', length: 'comprimento' }[item.dim]),
        margin: formatMeters(-item.marginM),
      })),
    ...(room.capacityOk ? [] : [t('space.capacity', `capacidade ${formatPacks(quote.capacityPacks)} abaixo do mínimo`, { packs: formatPacks(quote.capacityPacks) })]),
  ];
  const fitText = room.fits ? t('space.fits', 'O modelo atual cabe.') : t('space.miss', `O modelo atual não cabe: ${reasons.join(', ')}.`, { reasons: reasons.join(', ') });
  summary.textContent = t('space.summary', `${formatFlex(space.count)} de ${formatFlex(space.total)} configurações cabem: pé-direito ${limit(result.roomHeightM)}, largura ${limit(result.roomWidthM)} (${WIDTH_REF_LABELS[result.roomWidthRef]}), comprimento ${limit(result.roomLengthM)}${result.secondGripper ? ' já com +0,68 m do 2º braço' : ''}, capacidade mínima ${result.minCapacity == null ? 'livre' : formatPacks(result.minCapacity)}. ${fitText}`, {
    count: formatFlex(space.count),
    total: formatFlex(space.total),
    height: limit(result.roomHeightM),
    width: limit(result.roomWidthM),
    ref: t(`ref.${result.roomWidthRef}`, WIDTH_REF_LABELS[result.roomWidthRef]),
    length: limit(result.roomLengthM),
    arm: result.secondGripper ? t('space.arm', ' já com +0,68 m do 2º braço') : '',
    capacity: result.minCapacity == null ? t('free', 'livre') : formatPacks(result.minCapacity),
    fit: fitText,
  });
  if (!space.count) {
    host.append(el('p', 'banner', t('space.none', 'Nenhuma configuração cabe. Afrouxe uma medida, troque a referência de largura ou baixe a capacidade mínima.')));
    return;
  }
  const cards = [
    { id: 'cheapest', title: t('space.cheapest', 'Mais barato'), pick: space.cheapest, main: (item) => formatEUR(item.orderEur) },
    { id: 'smallest', title: t('space.smallest', 'Menor área (m²)'), pick: space.smallest, main: (item) => m2(item.footprintM2) },
    { id: 'largest', title: t('space.largest', 'Maior capacidade'), pick: space.largest, main: (item) => formatPacks(item.capacityPacks) },
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
    const button = el('button', null, isCurrent ? t('space.use', 'Em uso') : t('space.apply', 'Aplicar esta configuração'));
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
  const fleetWord = result.fleetRobots === 1 ? t('price.one', 'robô') : t('price.many', 'robôs');
  const fleet = `${formatFlex(result.fleetRobots)} ${fleetWord}`;
  const armExtra = quote.secondGripper
    ? t('price.armOn', ` (+${formatFixed(OPTIONS.secondGripperLengthM, 2)} m)`, { m: formatFixed(OPTIONS.secondGripperLengthM, 2) })
    : t('price.armOff', ' (não)');
  const rows = [
    [t('price.base', 'Robô base (tabela − € 25.000)'), formatEUR(quote.baseRobotEur), formatBRL(brl.baseRobot)],
    [t('price.auto', '+ Carga automática c/ OCR e carga manual'), formatEUR(quote.autoLoadingEur), formatBRL(brl.autoLoading)],
    [t('price.sam', '+ SAM c/ 4 saídas'), formatEUR(quote.samEur), formatBRL(brl.sam)],
    [t('price.table', '= Preço de tabela do robô'), formatEUR(quote.tablePriceEur), formatBRL(brl.tablePrice), 'is-total'],
    [t('price.arm', `+ 2º braço c/ 2º SAM${armExtra}`, { extra: armExtra }), formatEUR(quote.secondGripperEur), formatBRL(brl.secondGripper)],
    [t('price.cool', `+ Módulo refrigerado${quote.coolingModule ? '' : ' (não)'}`, { extra: quote.coolingModule ? '' : t('price.coolOff', ' (não)') }), formatEUR(quote.coolingEur), formatBRL(brl.cooling)],
    [t('price.belt', '+ Tecnologia de esteiras'), formatEUR(quote.conveyorEur), formatBRL(brl.conveyor)],
    [t('price.options', '= Subtotal de opcionais'), formatEUR(quote.optionsEur), formatBRL(brl.options), 'is-total'],
    [t('price.transport', `+ Transporte e instalação (média € 22.500; classe ${cls.id}: ${formatEUR(quote.classServicesEur)})`, { cls: cls.id, value: formatEUR(quote.classServicesEur) }), formatEUR(quote.servicesEur), formatBRL(brl.services)],
    [t('price.order', '= Pedido Gollmann bruto (1 robô)'), formatEUR(quote.orderEur), formatBRL(brl.order), 'is-total'],
    [t('price.discount', `− Desconto por volume (${pct(quote.discountPct)} p/ ${fleet})`, { pct: pct(quote.discountPct), fleet }), `−${formatEUR(quote.discountEur)}`, `−${formatBRL(brl.discount)}`, 'is-minus'],
    [t('price.net', '= Pedido Gollmann líquido (Valor Aduaneiro — VA)'), formatEUR(quote.netOrderEur), formatBRL(brazil.vaBrl), 'is-total is-key'],
    [t('price.ii', `+ II — Imposto de Importação (${brazil.exTarifario ? '0% c/ Ex-Tarifário BK' : `${pct(brazil.effectiveIiPct)} s/ Ex-Tarifário`})`, { rate: brazil.exTarifario ? t('price.iiOn', '0% c/ Ex-Tarifário BK') : t('price.iiOff', `${pct(brazil.effectiveIiPct)} s/ Ex-Tarifário`, { pct: pct(brazil.effectiveIiPct) }) }), approx(brazil.iiBrl), formatBRL(brazil.iiBrl)],
    [t('price.ipi', `+ IPI — NCM ${NCM_INFO.code} (${pct(brazil.ipiRatePct)} na TIPI)`, { ncm: NCM_INFO.code, pct: pct(brazil.ipiRatePct) }), approx(brazil.ipiBrl), formatBRL(brazil.ipiBrl)],
    [t('price.pis', `+ PIS-Importação (${pct(brazil.pisRatePct)} s/ VA)`, { pct: pct(brazil.pisRatePct) }), approx(brazil.pisBrl), formatBRL(brazil.pisBrl)],
    [t('price.cofins', `+ COFINS-Importação base (${pct(brazil.cofinsBaseRatePct)} s/ VA)`, { pct: pct(brazil.cofinsBaseRatePct) }), approx(brazil.cofinsBaseBrl), formatBRL(brazil.cofinsBaseBrl)],
    [t('price.cofinsAdd', `+ Adicional COFINS-Importação 2026 (${pct(brazil.cofinsAddRatePct)} s/ VA — Lei 14.973/24, não creditável)`, { pct: pct(brazil.cofinsAddRatePct) }), approx(brazil.cofinsAddBrl), formatBRL(brazil.cofinsAddBrl)],
    ...(brazil.customsExpensesBrl > 0
      ? [[t('price.customs', `+ Despesas aduaneiras / Siscomex / AFRMM (${pct(brazil.customsExpensesPct)} s/ VA)`, { pct: pct(brazil.customsExpensesPct) }), approx(brazil.customsExpensesBrl), formatBRL(brazil.customsExpensesBrl)]]
      : []),
    [t('price.icms', `+ ICMS-Importação por dentro (${pct(brazil.icmsRatePct)}${brazil.convenioIcms5291 ? ' · Convênio ICMS 52/91' : ' · Alíquota cheia'})`, { pct: pct(brazil.icmsRatePct), extra: brazil.convenioIcms5291 ? t('price.icmsOn', ' · Convênio ICMS 52/91') : t('price.icmsOff', ' · Alíquota cheia') }), approx(brazil.icmsBrl), formatBRL(brazil.icmsBrl)],
    [t('price.import', `= Total de impostos de importação (${pct(brazil.effectiveImportPct)} efetivo s/ VA)`, { pct: pct(brazil.effectiveImportPct) }), approx(brazil.importBrl), formatBRL(brazil.importBrl), 'is-total'],
    [t('price.landed', '= Parte importada nacionalizada (VA + impostos)'), approx(brazil.landedBrl), formatBRL(brazil.landedBrl), 'is-total'],
    [t('price.local', '+ Serviços locais faturados no Brasil (R$)'), `≈ ${formatEUR(quote.localServicesEurApprox)}`, formatBRL(brl.localServices)],
    [t('price.gross', '= 1. Preço Total Bruto no Brasil (1 robô)'), `≈ ${formatEUR(result.totalEurApprox)}`, formatBRL(result.totalGrossBrl), 'is-total is-key'],
    [t('price.creditPis', `− Crédito recuperável PIS + COFINS (${brazil.creditPisCofins ? '2,10% + 9,65% = 11,75% s/ VA' : 'desligado'})`, { state: brazil.creditPisCofins ? t('price.creditPisOn', '2,10% + 9,65% = 11,75% s/ VA') : t('price.creditPisOff', 'desligado') }), `≈ −${formatEUR(brazil.creditPisCofinsBrl / fx)}`, `−${formatBRL(brazil.creditPisCofinsBrl)}`, 'is-minus'],
    [t('price.creditIcms', `− Crédito recuperável ICMS (${brazil.creditIcms ? `${pct(brazil.icmsCreditFactorPct)} do ICMS pago` : 'desligado'})`, { state: brazil.creditIcms ? t('price.creditIcmsOn', `${pct(brazil.icmsCreditFactorPct)} do ICMS pago`, { pct: pct(brazil.icmsCreditFactorPct) }) : t('price.creditIcmsOff', 'desligado') }), `≈ −${formatEUR(brazil.creditIcmsBrl / fx)}`, `−${formatBRL(brazil.creditIcmsBrl)}`, 'is-minus'],
    [t('price.credits', `= Total de créditos tributários recuperáveis (${pct(brazil.effectiveCreditOnVaPct)} s/ VA · ${pct(brazil.effectiveCreditOnLandedPct)} s/ nacionalizado)`, { va: pct(brazil.effectiveCreditOnVaPct), landed: pct(brazil.effectiveCreditOnLandedPct) }), `≈ −${formatEUR(brazil.creditBrl / fx)}`, `−${formatBRL(brazil.creditBrl)}`, 'is-minus is-total'],
    [t('price.netInvest', '= Investimento Líquido Efetivo Pós-Créditos (1 robô)'), approx(result.totalNetBrl), formatBRL(result.totalNetBrl), 'is-total is-key'],
    [t('price.nonRec', `Custo tributário líquido não recuperável (impostos − créditos · ${pct(brazil.effectiveNetTaxPct)} s/ VA)`, { pct: pct(brazil.effectiveNetTaxPct) }), approx(brazil.nonRecoverableBrl), formatBRL(brazil.nonRecoverableBrl)],
    [
      t('price.perPack', `Custo por pacote de capacidade (${formatPacks(quote.capacityPacks)})`, { packs: formatPacks(quote.capacityPacks) }),
      t('price.perPackEur', `${formatEUR(quote.eurPerPack)} (pedido líquido)`, { value: formatEUR(quote.eurPerPack) }),
      t('price.perPackBrl', `${formatBRL(result.brlPerPack)} (líquido)`, { value: formatBRL(result.brlPerPack) }),
    ],
  ];
  const table = document.getElementById('price-table');
  table.replaceChildren();
  table.append(el('caption', null, t('price.caption', `${configLabel(quote.config)} · câmbio R$ ${formatFlex(fx, 4)} por €`, { config: configLabel(quote.config), fx: formatFlex(fx, 4) })));
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const [label, cls2] of [[t('price.item', 'Item'), null], ['EUR', 'num'], ['R$', 'num']]) {
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
  document.getElementById('price-note').textContent = t('price.note', `Na tabela o preço já inclui a carga automática (${formatEUR(22000)}) e o SAM (${formatEUR(3000)}). Opcionais, transporte e instalação e serviços locais vêm separados. O desconto por volume vale para o pedido Gollmann, que é o Valor Aduaneiro da NCM ${NCM_INFO.code}; os impostos de importação e os créditos valem só para essa parte importada. Os serviços locais entram em reais, sem câmbio. Linhas em euro marcadas com ≈ são o equivalente pelo câmbio.`, {
    auto: formatEUR(22000),
    sam: formatEUR(3000),
    ncm: NCM_INFO.code,
  });
  renderNcmTable(brazil);
}

function taxView(line, brazil) {
  const pill = line.creditable ? t('tax.yes', 'Sim · Creditável') : t('tax.no', 'Não · Custo definitivo');
  if (lang !== 'en') {
    return {
      label: line.label,
      base: `Base: ${line.baseLabel}`,
      rate: line.rateLabel,
      legal: line.legalBasis,
      pill,
      rule: line.creditRule,
    };
  }
  const rates = {
    ii: brazil.exTarifario
      ? t('tax.ii.rateOn', '0% c/ Ex-Tarifário')
      : t('tax.ii.rateOff', line.rateLabel, {
          pct: pct(brazil.effectiveIiPct),
          tec: pct(NCM_INFO.iiTecPct),
          gecex: pct(NCM_INFO.iiGecex2026Pct),
        }),
    ipi: pct(brazil.ipiRatePct),
    pis: pct(brazil.pisRatePct),
    cofins: pct(brazil.cofinsBaseRatePct),
    cofinsAdd: pct(brazil.cofinsAddRatePct),
    customs: pct(brazil.customsExpensesPct),
    icms: `${formatFlex(brazil.icmsRatePct, 2)}%`,
  };
  return {
    label: t(`tax.${line.key}.label`, line.label),
    base: t('tax.base', `Base: ${line.baseLabel}`, { base: t(`tax.${line.key}.base`, line.baseLabel) }),
    rate: rates[line.key] ?? line.rateLabel,
    legal: t(`tax.${line.key}.legal`, line.legalBasis),
    pill,
    rule: t(`tax.${line.key}.rule`, line.creditRule),
  };
}

/** Tabela de referência: impostos da NCM 8479.89.99, o que gera crédito e o custo que fica. */
function renderNcmTable(brazil) {
  const table = document.getElementById('ncm-tax-table');
  if (!table) return;
  table.replaceChildren();
  table.append(el('caption', null, t('tax.caption', `Tabela de Referência: Impostos da NCM ${NCM_INFO.code} e O Que Pode Creditar`, { ncm: NCM_INFO.code })));
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  const columns = [
    [t('tax.col.tax', `Tributo / Encargo (NCM ${NCM_INFO.code})`, { ncm: NCM_INFO.code }), null],
    [t('tax.col.legal', 'Alíquota e Base Legal'), null],
    [t('tax.col.paid', 'Pago na Importação (R$)'), 'num'],
    [t('tax.col.credit', 'Gera Crédito?'), null],
    [t('tax.col.amount', 'Crédito no Cálculo (R$)'), 'num'],
    [t('tax.col.net', 'Custo Líquido (R$)'), 'num'],
  ];
  for (const [label, cls] of columns) {
    const th = el('th', cls, label);
    th.scope = 'col';
    hr.append(th);
  }
  head.append(hr);
  const body = document.createElement('tbody');
  for (const line of brazil.taxLines) {
    const view = taxView(line, brazil);
    const tr = document.createElement('tr');
    const th = el('th', null, view.label);
    th.scope = 'row';
    th.append(document.createElement('br'), el('small', null, view.base));
    const rate = el('td', 'tax-legal');
    rate.append(el('strong', null, view.rate), document.createElement('br'), el('small', null, view.legal));
    const credit = el('td', 'tax-credit');
    credit.append(
      el('span', line.creditable ? 'tax-pill is-yes' : 'tax-pill is-no', view.pill),
      document.createElement('br'),
      el('small', null, view.rule),
    );
    tr.append(
      th,
      rate,
      el('td', 'num', formatBRL(line.amountBrl)),
      credit,
      el('td', 'num', line.creditBrl > 0 ? `−${formatBRL(line.creditBrl)}` : formatBRL(0)),
      el('td', 'num', formatBRL(line.netCostBrl)),
    );
    body.append(tr);
  }
  const foot = document.createElement('tfoot');
  const fr = document.createElement('tr');
  fr.className = 'is-total is-key';
  const label = el('th', null, t('tax.foot', 'Total Pago na Importação · Total Creditável · Custo Tributário Definitivo (Não Recuperável)'));
  label.scope = 'row';
  label.colSpan = 2;
  fr.append(
    label,
    el('td', 'num', formatBRL(brazil.importBrl)),
    el('td', null, t('tax.footBack', `${pct(brazil.effectiveCreditOnVaPct)} do VA volta como crédito`, { pct: pct(brazil.effectiveCreditOnVaPct) })),
    el('td', 'num', `−${formatBRL(brazil.creditBrl)}`),
    el('td', 'num', formatBRL(brazil.nonRecoverableBrl)),
  );
  foot.append(fr);
  table.append(head, body, foot);
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
      if (heightM === quote.heightM) tab.title = t('matrix.current', 'Altura do modelo atual');
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
  table.append(el('caption', null, t('matrix.caption', `Robô de ${formatMeters(matrixHeight)} de altura`, { height: formatMeters(matrixHeight) })));
  const available = widthsAt(matrixHeight).map((width) => width.key);
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  const corner = el('th', null, t('matrix.corner', 'Classe / largura c/ SAM'));
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
    const th = el('th', null, t('matrix.robot', `Robô ${cls.id}`, { id: cls.id }));
    th.scope = 'row';
    th.append(document.createElement('br'), el('small', null, t('matrix.approx', `aprox. ${formatFlex(cls.approxPacks)}`, { n: formatFlex(cls.approxPacks) })));
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
        t('matrix.cell', `Robô ${cls.id}, ${formatMeters(width.sam)} c/ SAM, altura ${formatMeters(matrixHeight)}: ${formatEUR(config.priceEur)}, ${formatMeters(config.lengthM)}, ${formatPacks(config.capacityPacks)}${result.roomFilterOn ? (fit ? ', cabe na sala' : ', não cabe na sala') : ''}`, {
          cls: cls.id,
          width: formatMeters(width.sam),
          height: formatMeters(matrixHeight),
          price: formatEUR(config.priceEur),
          length: formatMeters(config.lengthM),
          packs: formatPacks(config.capacityPacks),
          fit: result.roomFilterOn ? (fit ? t('matrix.fit', ', cabe na sala') : t('matrix.out', ', não cabe na sala')) : '',
        }),
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
  const fitLegend = fitCount == null ? '' : t('matrix.fitLegend', ` Verde: cabe na sala (${formatFlex(fitCount)} nesta altura); apagada: não cabe.`, { n: formatFlex(fitCount) });
  document.getElementById('matrix-legend').textContent = t('matrix.legend', `${available.length} larguras nesta altura. Célula escura: modelo atual.${fitLegend} "–": a proposta não oferece a combinação.`, {
    n: available.length,
    fit: fitLegend,
  });
}

function setFleet(count) {
  state.fleetRobots = count;
  fillControls();
  commit();
}

function renderRollout(result) {
  const { quote, volume } = result;
  const robots = (count) => `${formatFlex(count)} ${count === 1 ? t('price.one', 'robô') : t('price.many', 'robôs')}`;
  const kpis = document.getElementById('rollout-kpis');
  kpis.replaceChildren();
  renderKpi(kpis, {
    id: 'fleet-tier',
    label: t('rollout.tier', 'Faixa aplicada'),
    value: pct(volume.pct),
    sub: `${robots(volume.count)} · ${volume.next ? t('rollout.next', `faltam ${formatFlex(volume.next.from - volume.count)} p/ ${pct(volume.next.pct)}`, { n: formatFlex(volume.next.from - volume.count), pct: pct(volume.next.pct) }) : t('rollout.top', 'faixa máxima')}`,
  });
  renderKpi(kpis, {
    id: 'fleet-unit-discount',
    label: t('rollout.unit', 'Desconto por robô'),
    value: formatEUR(volume.unitDiscountEur),
    sub: formatBRL(volume.unitDiscountBrl),
  });
  renderKpi(kpis, {
    id: 'fleet-unit-net',
    label: t('rollout.net', 'Pedido líquido por robô'),
    value: formatEUR(volume.unitNetEur),
    sub: t('rollout.gross', `bruto ${formatEUR(volume.unitGrossEur)}`, { value: formatEUR(volume.unitGrossEur) }),
  });
  renderKpi(kpis, {
    id: 'fleet-total',
    label: t('rollout.fleet', 'Preço Total da frota'),
    value: compactBRL(volume.fleetTotalGrossBrl),
    exact: formatBRL(volume.fleetTotalGrossBrl),
    sub: t('rollout.fleetSub', `${robots(volume.count)} · desconto −${formatEUR(volume.fleetDiscountEur)}`, { robots: robots(volume.count), value: formatEUR(volume.fleetDiscountEur) }),
  });
  document.getElementById('rollout-note').textContent = t('rollout.note', `Pedido Gollmann bruto de ${formatEUR(quote.orderEur)} por robô (${configLabel(quote.config)}: robô, opcionais e transporte e instalação). A faixa sai da quantidade de robôs; os serviços locais em R$ entram no total sem desconto. Clique numa faixa para aplicá-la.`, {
    order: formatEUR(quote.orderEur),
    config: configLabel(quote.config),
  });

  const table = document.getElementById('rollout-milestones');
  table.replaceChildren();
  table.append(el('caption', null, t('rollout.caption', 'Tabela de faixas de desconto por volume (por robô)')));
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  const columns = [
    t('rollout.col.tier', 'Faixa'),
    t('rollout.col.pct', 'Desconto'),
    t('rollout.col.unit', 'Desconto por robô'),
    t('rollout.col.net', 'Pedido líquido (€)'),
    t('rollout.col.gross', 'Preço Total (R$)'),
    t('rollout.col.after', 'Líquido pós-crédito (R$)'),
    t('rollout.col.note', 'Nota de crédito no marco'),
  ];
  for (const label of columns) {
    const th = el('th', label === t('rollout.col.tier', 'Faixa') ? null : 'num', label);
    th.scope = 'col';
    hr.append(th);
  }
  head.append(hr);
  const body = document.createElement('tbody');
  for (const tier of volume.tiers) {
    const tr = document.createElement('tr');
    if (tier.active) tr.className = 'is-active';
    tr.tabIndex = 0;
    tr.dataset.from = String(tier.from);
    const range = t(`tier.${tier.from}`, tier.rangeLabel);
    tr.setAttribute('aria-label', t('rollout.apply', `Aplicar a faixa ${tier.rangeLabel}, ${pct(tier.pct)}`, { range, pct: pct(tier.pct) }));
    if (tier.active) tr.setAttribute('aria-current', 'true');
    const th = el('th', null, range);
    th.scope = 'row';
    tr.append(th);
    tr.append(el('td', 'num'));
    tr.lastChild.append(el('span', tier.pct > 0 ? 'tier-pill' : 'tier-pill is-off', pct(tier.pct)));
    tr.append(el('td', 'num', tier.pct === 0 ? '–' : `−${formatEUR(tier.unitDiscountEur)}`));
    tr.append(el('td', 'num', formatEUR(tier.unitNetEur)));
    tr.append(el('td', 'num', formatBRL(tier.unitTotalGrossBrl)));
    tr.append(el('td', 'num', formatBRL(tier.unitTotalNetBrl)));
    const credit = el('td', 'num', tier.pct === 0 ? '–' : formatEUR(tier.creditNoteEur));
    if (tier.pct > 0) {
      credit.append(document.createElement('br'), el('small', null, t('rollout.nth', `${formatFlex(tier.from)}º robô · ${formatBRL(tier.creditNoteBrl)}`, { n: formatFlex(tier.from), value: formatBRL(tier.creditNoteBrl) })));
    }
    tr.append(credit);
    tr.addEventListener('click', () => setFleet(tier.from));
    tr.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      setFleet(tier.from);
    });
    body.append(tr);
  }
  table.append(head, body);
  const slideList = SLIDE_12.milestones
    .map((item) => t('rollout.slide', `${item.robot}º robô ${cents(item.bonusToDateCents)}`, { n: item.robot, value: cents(item.bonusToDateCents) }))
    .join(' · ');
  document.getElementById('milestone-note').textContent = t('rollout.milestone', `Nota de crédito: ao alcançar 10, 25, 50 e 100 robôs, os robôs já pedidos são levados à faixa nova, com ${formatEUR(volume.unitGrossEur)} por robô. Conferência do slide 12, com ${formatEUR(100000)} por robô: ${slideList} de desconto acumulado.`, {
    unit: formatEUR(volume.unitGrossEur),
    base: formatEUR(100000),
    list: slideList,
  });
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
  const { quote } = result;
  document.getElementById('dock-net').textContent = compactBRL(result.totalGrossBrl);
  document.getElementById('dock-price').textContent = formatEUR(quote.equipmentEur);
  const local = quote.localServicesBrl > 0 ? compactBRL(quote.localServicesBrl) : (lang === 'en' ? formatBRL(0) : 'R$ 0');
  document.getElementById('dock-order').textContent = `${formatEUR(quote.servicesEur)} + ${local}`;
  document.getElementById('dock-bonus').textContent = `${pct(quote.discountPct)} · −${formatEUR(quote.discountEur)}`;
}

function syncPresets(result) {
  const { quote } = result;
  const plain =
    !quote.secondGripper &&
    !quote.coolingModule &&
    quote.conveyorEur === 0 &&
    quote.servicesEur === AVERAGE_SERVICES_EUR &&
    quote.localServicesBrl === 0;
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

function renderModelChrome(result) {
  const model = selectedLine(result);
  const title = document.getElementById('viewer-title');
  if (title) title.textContent = model.name;
  const classLineNode = document.getElementById('model-class-line');
  if (classLineNode) classLineNode.textContent = classLine(result, model);
  const legendBody = document.querySelector('[data-i18n="legend.body"]');
  if (legendBody) legendBody.textContent = model.name;
  const legendOther = document.querySelector('[data-i18n="legend.direct"]');
  if (legendOther) {
    legendOther.textContent = model.line === 'direct'
      ? t('legend.otherCompact', 'GO.compact (referência)')
      : t('legend.direct', 'GO.direct (folga)');
  }
  const colorGroup = document.querySelector('.swatches');
  if (colorGroup) colorGroup.setAttribute('aria-label', t('viewer.colorModel', `Cor do ${model.name}`, { model: model.name }));
}

function render(result) {
  current = result;
  syncLocks();
  syncQuick();
  renderModelChrome(result);
  renderStatus(result);
  renderFiscalBar(result);
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
    const when = new Date().toLocaleString(uiLocale(), { dateStyle: 'long', timeStyle: 'short' });
    stamp.textContent = t('results.printDate', `Memória de cálculo · ${when}.`, { when });
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
  if (state.modelLine !== result.modelLine) {
    state.modelLine = result.modelLine;
    fillControls();
  }
  // A alíquota de ICMS digitada decide o convênio: o botão do convênio acompanha o que entrou na conta.
  state.convenioIcms5291 = result.brazil.convenioIcms5291;
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
  cut: { yaw: 0.72, pitch: 0.48, zoom: 1.18, xray: true },
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
    const picked = selectedLine(result);
    const next = {
      H: quote.heightM,
      Wc: picked.width,
      Wd: picked.line === 'direct' ? quote.widthCompact : quote.widthDirect,
      sam: picked.line === 'direct' ? 0 : SAM_PROTRUSION_M,
      Lt: quote.tableLengthM,
      L: quote.totalLengthM,
      roomH: result.roomHeightM ?? quote.heightM + 0.4,
      roomW: result.roomWidthM ?? Math.max(quote.widthSam, picked.width) + 0.6,
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
      line: picked.line,
      name: picked.name,
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
        physical: `${picked.name} ${formatMeters(picked.width)}`,
        L: formatMeters(quote.totalLengthM),
        core: formatMeters(quote.coreLengthM),
      },
    };
    canvas.setAttribute(
      'aria-label',
      t('viewer.aria', `Modelo 3D do ${picked.name} Robô ${quote.classId}: altura ${formatMeters(quote.heightM)}, largura física ${formatMeters(picked.width)}, comprimento total ${formatMeters(quote.totalLengthM)}, ${formatFixed(picked.area, 2)} m², capacidade garantida ${formatPacks(quote.capacityPacks)}${quote.secondGripper ? ', com 2º braço' : ''}${quote.coolingModule ? ', com módulo refrigerado' : ''}${result.roomFilterOn ? (result.room.roomOk ? ', cabe na sala' : ', não cabe na sala') : ''}.`, {
        model: picked.name,
        cls: quote.classId,
        h: formatMeters(quote.heightM),
        w: formatMeters(picked.width),
        l: formatMeters(quote.totalLengthM),
        area: formatFixed(picked.area, 2),
        packs: formatPacks(quote.capacityPacks),
        arm: quote.secondGripper ? (lang === 'en' ? ', with 2nd arm' : ', com 2º braço') : '',
        cool: quote.coolingModule ? (lang === 'en' ? ', with refrigerated module' : ', com módulo refrigerado') : '',
        room: result.roomFilterOn ? (result.room.roomOk ? t('matrix.fit', ', cabe na sala') : t('matrix.out', ', não cabe na sala')) : '',
      }),
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
    const xLeft = -d.Wc / 2 - (d.sam || 0);
    const target = [(xLeft + d.Wc / 2) / 2, d.H * 0.42, -d.L / 2];
    // A distância usa a maior das duas linhas, para a troca de modelo não afastar a câmera.
    const envelope = Math.max(d.Wc + (d.sam || 0), d.Wd);
    let radius = 0.5 * Math.hypot(envelope + 1.6, d.H, d.L + 1.2);
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
    const frontAlpha = 1 - 0.75 * mix;
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
        draw: lettering(model.name || 'GO.compact', 'rgba(255,255,255,0.95)'),
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

    const sam = d.sam || 0;
    const samChildren = sam > 0.01
      ? box(x0 - sam, x0, 0.92, 1.3, 0.06, 0.62, {
          fill: COLORS.chute,
          stroke: '#000000',
          faces: {
            left: { decals: [{ pts: quadX(x0 - sam - 0.001, 0.98, 1.22, 0.14, 0.54), fill: '#2f363b', alpha: 1 }] },
          },
        })
      : [];

    const shell = box(x0, x1, 0, H, 0, L, {
      fill: COLORS.anthracite,
      stroke: '#0c0e10',
      skip: ['bottom'],
      faces: {
        front: { fill: COLORS.anthracite, alpha: frontAlpha, decals: frontDecals, lines: shelfLines, lineColor: COLORS.shelf, lineAlpha: 0.9, children: frontChildren },
        left: { fill: sideFill, alpha: sideAlpha, decals: sideDecals(x0), lines: seams(x0), lineColor: '#5a636a', lineAlpha: 0.7, children: samChildren },
        right: { fill: sideFill, alpha: sideAlpha, decals: sideDecals(x1), lines: seams(x1), lineColor: '#5a636a', lineAlpha: 0.7 },
        back: {
          fill: sideFill,
          alpha: sideAlpha,
          decals: [
            { pts: quadZ(L, x1, x0, yb, H), fill: theme, alpha: fasciaAlpha },
            ...(model.cooling ? [{ pts: quadZ(L + 0.002, x1 - cw, x0 + cw, 0.12, yb - 0.12), fill: COLORS.cool, alpha: 0.35 + 0.4 * mix, stroke: COLORS.cool, strokeAlpha: 0.9, lineWidth: 1.4 }] : []),
          ],
        },
        top: { fill: mixHex(theme, '#e8f4f6', mix * 0.6), alpha: topAlpha, stroke: '#0c0e10' },
      },
    });
    return { shell, internals: mix > 0.02 ? buildInternals(fh) : [] };
  }

  /* Interior para os raios-X: estantes que deslizam em d, corredor lateral e o ciclo do gripper. */
  function buildInternals(fh) {
    const d = dims;
    const mix = xrayMix;
    const H = d.H;
    const Wc = d.Wc;
    const Lt = d.Lt;
    const L = d.L;
    const x0 = -Wc / 2;
    const x1 = Wc / 2;
    const faces = [];
    const hasExt = model.gripper2 && L - Lt > 0.01;
    const dStart = LENGTH_INCLUDED.manualLoadingM + LENGTH_INCLUDED.speedOptionM + 0.04;
    const rackTop = H - fh - 0.06;
    /* Estantes rolantes transversais: cruzam a largura e deixam à direita o corredor do trilho, da esteira e do braço. */
    const shelfX0 = x0 + 0.08;
    const shelfX1 = x1 - 0.34;
    const dCool0 = Math.max(dStart + 0.6, L - 0.92);
    const dCool1 = L - 0.06;
    const dEnd = model.cooling ? dCool0 - 0.04 : L - 0.06;
    const aisleW = 0.62;
    const gap = 0.045;
    const rowDepth = 0.32;
    const RACK_LETTERS = 'BCDEFGHIJKLMNOPQRSTUVWXYZ';
    const PACK_TONES = ['#f6ead2', '#e7a23a', '#d5e6c8', '#f3d3cf', '#cfe3f6', '#f4f1ea'];
    const CYCLE = 8.6;

    const smoothstep = (value) => {
      const t = Math.max(0, Math.min(1, value));
      return t * t * (3 - 2 * t);
    };

    /* Ciclo do gripper, em fração de CYCLE:
       0–0,22 corre no corredor lateral, braço recolhido, e as estantes deslizam até o corredor alvo.
       0,22–0,26 o vão fica aberto, com o braço ainda na lateral.
       0,26–0,44 entra no corredor, acende o feixe de laser e abre as pás.
       0,44–0,62 as pás recuam e puxam a caixa para a bandeja.
       0,62–0,80 recua até a esteira preta.
       0,80–1 empurra a caixa na esteira, que a leva para a frente. */
    const gripperCycle = (phase, zone0, zone1) => {
      const shifted = time + phase;
      const slot = Math.floor(shifted / CYCLE);
      const local = (shifted % CYCLE) / CYCLE;
      const span = Math.max(0.3, zone1 - zone0);
      const open = Math.min(aisleW, Math.max(0.42, span * 0.28));
      const pitch = rowDepth + gap;
      const count = Math.max(1, Math.floor((span - open + gap) / pitch));
      const place = (nLeft) => {
        const nL = Math.max(0, Math.min(count, nLeft));
        const nR = count - nL;
        const leftEnd = nL === 0 ? zone0 : zone0 + nL * pitch - gap;
        const rightStart = nR === 0 ? zone1 : zone1 - (nR * pitch - gap);
        const free = Math.max(0, rightStart - leftEnd);
        const openUse = Math.min(open, free);
        const extra = Math.max(0, free - openUse);
        const open0 = leftEnd + extra / 2;
        const rows = [];
        for (let index = 0; index < nL; index += 1) rows.push(zone0 + index * pitch);
        for (let index = 0; index < nR; index += 1) rows.push(rightStart + index * pitch);
        return { rows, center: open0 + openUse / 2, openUse };
      };
      const stops = [0.18, 0.42, 0.66, 0.88].map((fraction) => Math.max(0, Math.min(count, Math.round(fraction * count))));
      const from = stops[((slot % stops.length) + stops.length) % stops.length];
      const to = stops[((slot + 1) % stops.length + stops.length) % stops.length];
      const travel = local < 0.22 ? smoothstep(local / 0.22) : 1;
      const nL = Math.max(0, Math.min(count, from + (to - from) * travel));
      const lo = Math.floor(nL);
      const hi = Math.min(count, Math.ceil(nL));
      const frac = nL - lo;
      const laidA = place(lo);
      const laidB = place(hi);
      const dCenter = laidA.center + (laidB.center - laidA.center) * frac;
      const openNow = laidA.openUse + (laidB.openUse - laidA.openUse) * frac;
      const open0 = dCenter - openNow / 2;
      const open1 = dCenter + openNow / 2;
      const rows = laidA.rows.map((r0a, index) => {
        const r0 = r0a + (laidB.rows[index] - r0a) * frac;
        const r1 = r0 + rowDepth;
        let aisleFace = null;
        if (Math.abs(r1 - open0) < 0.1) aisleFace = 'back';
        else if (Math.abs(r0 - open1) < 0.1) aisleFace = 'front';
        return [r0, r1, aisleFace];
      });
      const heights = [0.3, 0.58, 0.42, 0.74];
      const yNorm = heights[slot % 4] + (heights[(slot + 1) % 4] - heights[slot % 4]) * travel;
      let reach = 0;
      let paddle = 0;
      let boxMode = 'none';
      let boxU = 0;
      let laser = false;
      if (local < 0.26) {
        reach = 0;
      } else if (local < 0.44) {
        const u = smoothstep((local - 0.26) / 0.18);
        reach = u;
        paddle = u;
        laser = true;
        boxMode = 'shelf';
      } else if (local < 0.62) {
        const u = smoothstep((local - 0.44) / 0.18);
        reach = 1;
        paddle = 1 - u * 0.7;
        laser = u < 0.35;
        boxMode = 'pull';
        boxU = u;
      } else if (local < 0.8) {
        const u = smoothstep((local - 0.62) / 0.18);
        reach = 1 - u;
        paddle = 0.3 * (1 - u);
        boxMode = 'tray';
      } else if (local < 0.9) {
        reach = 0;
        boxMode = 'dump';
        boxU = smoothstep((local - 0.8) / 0.1);
      } else {
        reach = 0;
        boxMode = 'belt';
        boxU = (local - 0.9) / 0.1;
      }
      return { dCenter, open: openNow, yNorm, reach, paddle, boxMode, boxU, laser, rows };
    };

    const rowLines = (dd) => {
      const lines = [];
      for (let y = 0.28; y < rackTop; y += 0.22) lines.push([P(shelfX0, y, dd), P(shelfX1, y, dd)]);
      for (let x = shelfX0 + 0.4; x < shelfX1 - 0.05; x += 0.4) lines.push([P(x, 0.12, dd), P(x, rackTop, dd)]);
      return lines;
    };
    const stencil = (letter) => (context) => {
      context.fillStyle = 'rgba(255,255,255,0.94)';
      context.font = '600 68px Outfit, "Segoe UI", sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(letter, 40, 40);
    };
    const ledPanel = (context) => {
      context.fillStyle = '#121416';
      context.fillRect(0, 0, 96, 36);
      context.font = '700 20px Outfit, "Segoe UI", sans-serif';
      context.textBaseline = 'middle';
      context.fillStyle = '#3dff7a';
      context.fillText('002', 8, 18);
      context.fillStyle = '#ff3b30';
      context.fillText('174', 52, 18);
    };

    /* Com o 2º braço, cada gripper tem a sua metade da profundidade e o seu corredor. O refrigerado fica depois, no fundo. */
    const mid = (dStart + dEnd) / 2;
    const zones = hasExt
      ? [
          { d0: dStart, d1: mid - 0.16, phase: 0 },
          { d0: mid + 0.16, d1: dEnd, phase: CYCLE / 2 },
        ]
      : [{ d0: dStart, d1: dEnd, phase: 0 }];
    const poses = zones.map((zone) => ({ zone, pose: gripperCycle(zone.phase, zone.d0, zone.d1) }));

    let letterIndex = 0;
    const rack = (r0, r1, fill, stroke, alpha, letter, aisleFace) => {
      const midD = (r0 + r1) / 2;
      /* Topo só com linhas ao longo de x: linhas em d se alinham na planta e parecem colunas longitudinais. */
      const topLines = [r0 + (r1 - r0) * 0.25, midD, r0 + (r1 - r0) * 0.75].map((dd) => [P(shelfX0, rackTop, dd), P(shelfX1, rackTop, dd)]);
      const levels = (x) => {
        const lines = [];
        for (let y = 0.28; y < rackTop; y += 0.22) lines.push([P(x, y, r0), P(x, y, r1)]);
        return lines;
      };
      const letterTop = Math.min(rackTop - 0.16, 1.92);
      const letterBottom = letterTop - 0.7;
      const letterDecals = letter
        ? [{
            pts: quadX(shelfX1 + 0.004, letterBottom, letterTop, r0 + 0.015, r1 - 0.015),
            fill: null,
            w: 80,
            h: 80,
            draw: stencil(letter),
          }]
        : [];
      const packDecals = [];
      const sidePacks = [];
      if (aisleFace && letter) {
        const plane = aisleFace === 'back' ? r1 + 0.004 : r0 - 0.004;
        const rand = seeded(letter.charCodeAt(0) * 131 + (aisleFace === 'back' ? 3 : 11));
        for (let level = 0; level < 4; level += 1) {
          const y = 0.36 + level * 0.28;
          if (y + 0.08 > rackTop) break;
          const bw = 0.09 + rand() * 0.05;
          const x = shelfX0 + 0.18 + rand() * Math.max(0.2, shelfX1 - shelfX0 - 0.5);
          const xPack = Math.min(shelfX1 - 0.08, x + bw);
          if (xPack - x < 0.04) continue;
          packDecals.push({
            pts: quadZ(plane, x, xPack, y, y + 0.065),
            fill: PACK_TONES[Math.floor(rand() * PACK_TONES.length)],
            alpha: 0.95 * mix,
          });
        }
        for (let level = 0; level < 3; level += 1) {
          const y = 0.3 + level * 0.32;
          if (y + 0.08 > letterBottom) break;
          const bw = 0.07 + rand() * 0.05;
          const dPack = r0 + 0.04 + rand() * Math.max(0.02, rowDepth - bw - 0.1);
          const dPack1 = Math.min(r1 - 0.03, dPack + bw);
          if (dPack1 - dPack < 0.04) continue;
          sidePacks.push({
            pts: quadX(shelfX1 + 0.006, y, y + 0.07, dPack, dPack1),
            fill: PACK_TONES[Math.floor(rand() * PACK_TONES.length)],
            alpha: 0.95 * mix,
          });
        }
      }
      faces.push(
        ...box(shelfX0, shelfX1, 0.12, rackTop, r0, r1, {
          fill,
          alpha,
          stroke,
          faces: {
            front: { lines: rowLines(r0), lineColor: '#56636a', lineAlpha: 0.55 * mix, decals: aisleFace === 'front' ? packDecals : [] },
            back: { lines: rowLines(r1), lineColor: '#56636a', lineAlpha: 0.55 * mix, decals: aisleFace === 'back' ? packDecals : [] },
            top: { lines: topLines, lineColor: '#56636a', lineAlpha: 0.4 * mix },
            left: { lines: levels(shelfX0), lineColor: '#56636a', lineAlpha: 0.55 * mix },
            right: { lines: levels(shelfX1), lineColor: '#56636a', lineAlpha: 0.55 * mix, decals: [...letterDecals, ...sidePacks] },
          },
        }),
      );
    };

    for (const { pose } of poses) {
      for (const [r0, r1, aisleFace] of pose.rows) {
        const letter = RACK_LETTERS[letterIndex % RACK_LETTERS.length];
        letterIndex += 1;
        rack(r0, r1, '#b7c3c9', '#6d787e', 0.72 * mix, letter, aisleFace);
      }
    }

    /* Módulo refrigerado: sempre a última seção, no fundo do robô, com duas fileiras transversais numa câmara azul. */
    if (model.cooling) {
      const coolDepth = (dCool1 - dCool0 - gap) / 2;
      rack(dCool0, dCool0 + coolDepth, COLORS.cool, COLORS.cool, 0.62 * mix, null, null);
      rack(dCool1 - coolDepth, dCool1, COLORS.cool, COLORS.cool, 0.62 * mix, null, null);
      faces.push(
        ...box(shelfX0 - 0.03, shelfX1 + 0.03, 0.08, rackTop + 0.04, dCool0 - 0.02, dCool1 + 0.02, {
          fill: COLORS.cool,
          alpha: 0.12 * mix,
          stroke: COLORS.cool,
          strokeAlpha: 0.85 * mix,
          lineWidth: 1.4,
        }).map((face) => ({ ...face, bias: -0.05 })),
      );
    }

    const railY0 = H - 0.24;
    const railY1 = H - 0.16;
    const railStyle = { fill: COLORS.rail, alpha: 0.95 * mix, stroke: '#6f7b82' };
    /* Guia linear principal: longitudinal, no alto da lateral direita, com a faixa verde e os rasgos do perfil T. */
    faces.push(
      ...box(x1 - 0.22, x1 - 0.06, railY0, railY1, 0.1, L - 0.08, {
        ...railStyle,
        faces: {
          top: { decals: [{ pts: [P(x1 - 0.19, railY1 + 0.002, L - 0.1), P(x1 - 0.09, railY1 + 0.002, L - 0.1), P(x1 - 0.09, railY1 + 0.002, 0.12), P(x1 - 0.19, railY1 + 0.002, 0.12)], fill: '#3f8f3a', alpha: mix }] },
          left: {
            decals: [
              { pts: quadX(x1 - 0.222, railY0 + 0.02, railY1 - 0.02, 0.12, L - 0.1), fill: '#3f8f3a', alpha: mix },
              { pts: quadX(x1 - 0.226, railY0 + 0.04, railY0 + 0.058, 0.14, L - 0.12), fill: '#8e989e', alpha: mix },
              { pts: quadX(x1 - 0.226, railY1 - 0.058, railY1 - 0.04, 0.14, L - 0.12), fill: '#8e989e', alpha: mix },
            ],
          },
        },
      }),
    );
    faces.push(...box(x0 + 0.06, x0 + 0.12, railY0, railY1, 0.1, L - 0.08, railStyle));
    faces.push(...box(x0 + 0.06, x1 - 0.06, railY0, railY1, 0.1, 0.18, railStyle));
    faces.push(...box(x0 + 0.06, x1 - 0.06, railY0, railY1, L - 0.16, L - 0.08, railStyle));

    /* Esteira preta fosca no corredor lateral direito, correndo para a saída da frente. */
    const beltX0 = x1 - 0.31;
    const beltX1 = x1 - 0.08;
    const beltLines = [];
    const beltShift = (time * 0.42) % 0.3;
    for (let dd = L - 0.16 - beltShift; dd > 0.16; dd -= 0.3) {
      beltLines.push([P(beltX0 + 0.01, 0.152, dd), P(beltX1 - 0.01, 0.152, dd)]);
    }
    faces.push(
      ...box(beltX0, beltX1, 0.08, 0.15, 0.12, L - 0.1, {
        fill: '#1a1d20',
        alpha: 0.96 * mix,
        stroke: '#3a4044',
        faces: { top: { lines: beltLines, lineColor: '#4a5158', lineAlpha: 0.7 * mix } },
      }),
    );

    const biased = (parts, bias) => parts.map((face) => ({ ...face, bias }));
    const chainLink = (xA, xB, yA, yB, dA, dB) => {
      faces.push(
        ...biased(
          box(xA, xB, yA, yB, Math.min(dA, dB), Math.max(dA, dB), {
            fill: '#1a1d20',
            alpha: mix,
            stroke: '#5c656b',
            skip: ['bottom', 'left', 'right'],
          }),
          -12,
        ),
      );
    };
    /* Esteira porta-cabos preta: corre no alto e faz a curva em U até o carro. */
    const dragChain = (dCenter) => {
      const cx0 = x1 - 0.19;
      const cx1 = x1 - 0.13;
      const yLift = railY1 + 0.1;
      const tail = Math.min(L - 0.14, dCenter + 0.72);
      const run = Math.max(0, tail - (dCenter + 0.18));
      const links = 5;
      for (let index = 0; index < links; index += 1) {
        const a = dCenter + 0.18 + (run * index) / links;
        const b = dCenter + 0.18 + (run * (index + 1)) / links;
        if (b - a > 0.03) chainLink(cx0, cx1, yLift, yLift + 0.03, a, b);
      }
      for (let index = 0; index <= 4; index += 1) {
        const ang = (Math.PI * index) / 4;
        const y = railY1 + 0.02 + Math.sin(ang) * 0.08;
        const dd = dCenter + 0.05 + Math.cos(ang) * 0.14;
        chainLink(cx0, cx1, y, y + 0.028, dd, dd + 0.045);
      }
    };

    const grip = (pose) => {
      const xOut = (beltX0 + beltX1) / 2 - 0.02;
      const xIn = shelfX0 + (shelfX1 - shelfX0) * 0.48;
      const gx = xOut + (xIn - xOut) * pose.reach;
      let gy = 0.42 + (rackTop - 0.95) * pose.yNorm;
      if (pose.boxMode === 'dump') gy += (0.32 - gy) * pose.boxU;
      const carX0 = x1 - 0.24;
      const carY1 = railY1 + 0.03;
      const dCenter = pose.dCenter;
      const headD = 0.1;
      const headX0 = gx - 0.12;
      const headX1 = gx + 0.08;
      const start = faces.length;
      faces.push(
        ...box(carX0, x1 - 0.05, railY0 - 0.05, carY1, dCenter - 0.16, dCenter + 0.16, {
          fill: '#c5ced3',
          alpha: mix,
          stroke: '#5e686e',
          faces: {
            top: {
              decals: [{
                pts: [P(x1 - 0.18, carY1 + 0.002, dCenter + 0.13), P(x1 - 0.11, carY1 + 0.002, dCenter + 0.13), P(x1 - 0.11, carY1 + 0.002, dCenter - 0.13), P(x1 - 0.18, carY1 + 0.002, dCenter - 0.13)],
                fill: '#3f8f3a',
                alpha: mix,
              }],
            },
          },
        }),
      );
      faces.push(...box(carX0, carX0 + 0.055, gy - 0.02, railY0, dCenter - 0.035, dCenter + 0.035, { fill: '#9aa6ac', alpha: mix, stroke: '#6f7b82' }));
      faces.push(...box(Math.min(headX1, carX0), Math.max(headX1, carX0), gy - 0.03, gy + 0.02, dCenter - 0.03, dCenter + 0.03, { fill: '#c5ced3', alpha: mix, stroke: '#6d767c' }));
      faces.push(
        ...box(headX0, headX1, gy - 0.07, gy + 0.02, dCenter - headD, dCenter + headD, {
          fill: '#d7dee2',
          alpha: mix,
          stroke: '#667077',
          faces: {
            front: {
              decals: [{
                pts: quadZ(dCenter - headD - 0.001, headX0 + 0.01, headX1 - 0.01, gy - 0.055, gy - 0.012),
                fill: null,
                w: 96,
                h: 36,
                draw: ledPanel,
              }],
            },
            top: {
              decals: [{
                pts: [P(headX0 + 0.02, gy + 0.022, dCenter + headD - 0.02), P(headX1 - 0.02, gy + 0.022, dCenter + headD - 0.02), P(headX1 - 0.02, gy + 0.022, dCenter - headD + 0.02), P(headX0 + 0.02, gy + 0.022, dCenter - headD + 0.02)],
                fill: '#eef2f4',
                alpha: mix,
              }],
            },
          },
        }),
      );
      const paddleTip = headX0 - 0.04 - pose.paddle * 0.16;
      for (const sign of [-1, 1]) {
        const face = dCenter + sign * (headD - 0.01);
        faces.push(
          ...box(paddleTip, headX0 + 0.03, gy - 0.055, gy + 0.045, Math.min(face, face + sign * 0.014), Math.max(face, face + sign * 0.014), {
            fill: '#b7c0c6',
            alpha: mix,
            stroke: '#5c656b',
          }),
        );
      }
      if (pose.laser) {
        const tip = paddleTip - 0.02;
        faces.push(
          ...biased(
            box(tip - 0.5, tip, gy - 0.014, gy + 0.01, dCenter - 0.008, dCenter + 0.008, {
              fill: '#e2312d',
              alpha: 0.92 * mix,
              stroke: '#ff4a42',
              strokeAlpha: 0.9,
              lineWidth: 1.6,
              faces: {
                top: {
                  lines: [[P(tip - 0.5, gy, dCenter), P(tip, gy, dCenter)]],
                  lineColor: '#ff2a22',
                  lineAlpha: mix,
                  lineWidthPx: 2,
                },
              },
            }),
            -30,
          ),
        );
      }
      let boxX = gx;
      let boxY = gy + 0.02;
      let boxD = dCenter;
      let showBox = pose.boxMode !== 'none';
      if (pose.boxMode === 'shelf') {
        boxX = headX0 - 0.2;
        boxY = gy + 0.02;
      } else if (pose.boxMode === 'pull') {
        const from = headX0 - 0.2;
        boxX = from + (gx - from) * pose.boxU;
        boxY = gy + 0.02;
      } else if (pose.boxMode === 'tray') {
        boxX = gx - 0.02;
        boxY = gy + 0.02;
      } else if (pose.boxMode === 'dump') {
        const beltCenter = (beltX0 + beltX1) / 2;
        boxX = gx + (beltCenter - gx) * pose.boxU;
        boxY = gy + 0.02 + (0.16 - (gy + 0.02)) * pose.boxU;
      } else if (pose.boxMode === 'belt') {
        boxX = (beltX0 + beltX1) / 2 - 0.02;
        boxY = 0.15;
        boxD = dCenter - pose.boxU * Math.min(1.15, Math.max(0.2, dCenter - 0.35));
      }
      if (showBox) {
        const bw = 0.12;
        const bh = 0.055;
        const bd = 0.07;
        faces.push(
          ...biased(
            box(boxX - bw / 2, boxX + bw / 2, boxY, boxY + bh, boxD - bd, boxD + bd, {
              fill: '#f6ead2',
              alpha: mix,
              stroke: '#c4a574',
              faces: {
                top: { decals: [{ pts: [P(boxX - bw / 2 + 0.01, boxY + bh + 0.001, boxD + bd - 0.01), P(boxX + bw / 2 - 0.01, boxY + bh + 0.001, boxD + bd - 0.01), P(boxX + bw / 2 - 0.01, boxY + bh + 0.001, boxD - bd + 0.01), P(boxX - bw / 2 + 0.01, boxY + bh + 0.001, boxD - bd + 0.01)], fill: '#e07a2f', alpha: mix }] },
              },
            }),
            -24,
          ),
        );
      }
      dragChain(dCenter);
      for (let index = start; index < faces.length; index += 1) {
        if (faces[index].bias == null) faces[index].bias = -20;
      }
    };

    for (const item of poses) grip(item.pose);
    if (hasExt) {
      faces.push(
        ...box(x0 + 0.02, x1 - 0.02, 0.03, H - 0.03, Lt, L - 0.02, {
          fill: COLORS.grip,
          alpha: 0.08 * mix,
          stroke: COLORS.grip,
          strokeAlpha: 0.55 * mix,
          lineWidth: 1.2,
        }).map((face) => ({ ...face, bias: -0.05 })),
      );
    }
    return faces;
  }

  function drawFloor() {
    const d = dims;
    const theme = THEMES[view.theme].color;
    const x0 = -d.Wc / 2;
    const x1 = d.Wc / 2;
    const xs = x0 - (d.sam || 0);
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
      { from: 0, to: manualEnd, color: COLORS.manual, label: t('seg.manual', '+0,15 m carga manual') },
      { from: manualEnd, to: speedEnd, color: COLORS.speed, label: t('seg.speed', '+0,17 m speed') },
      { from: speedEnd, to: d.Lt, color: theme, label: t('seg.core', `núcleo ${model.labels.core}`, { length: model.labels.core }) },
      ];
    if (model.gripper2 && d.L - d.Lt > 0.01) segments.push({ from: d.Lt, to: d.L, color: COLORS.grip, label: t('seg.arm', '+0,68 m 2º braço') });
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
    tag(tx + 6, (pb.y + pt.y) / 2, t('human.meters', '1,70 m'), '#37444c', 'left');
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

  function tagWidth(text, strong = false) {
    ctx.save();
    ctx.font = `${strong ? 700 : 600} 12px Outfit, "Segoe UI", sans-serif`;
    const w = ctx.measureText(text).width + 12;
    ctx.restore();
    return w;
  }

  function drawSegmentLabels(segments) {
    const items = segments
      .map((segment) => ({ ...segment, p: project(segment.anchor) }))
      .filter((item) => item.p.z > 0.15)
      .sort((a, b) => a.p.y - b.p.y);
    /* Em perspectiva a cota total fica à esquerda, junto aos trechos: os rótulos desviam da pílula dela. */
    let pill = null;
    if (cam.pitch <= 1.05) {
      const xs = -dims.Wc / 2 - SAM_PROTRUSION_M;
      const center = project(P(xs - 0.55, 0, dims.L / 2));
      if (center.z > 0.15) pill = { x: center.x, y: center.y, w: tagWidth(model.labels.L, true) };
    }
    const hitsPill = (x, y, w) => pill && x > pill.x - pill.w / 2 - 6 && x - w < pill.x + pill.w / 2 + 6 && Math.abs(y - pill.y) < 24;
    let lastY = -Infinity;
    for (const item of items) {
      let y = Math.max(item.p.y, lastY + 22);
      const x = Math.max(8, item.p.x - 26);
      const w = tagWidth(item.label);
      if (hitsPill(x, y, w)) {
        y = Math.max(item.p.y <= pill.y ? pill.y - 24 : pill.y + 24, lastY + 22);
        if (hitsPill(x, y, w)) y = pill.y + 24;
      }
      lastY = y;
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
    const xs = -d.Wc / 2 - (d.sam || 0);
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
    const status = { ok: t('room.ok', 'cabe'), tight: t('room.tight', 'cabe, folga < 10 cm'), over: t('room.over', 'não cabe') }[room.status];
    const top = project(corners[4]);
    if (top.z > 0.15) {
      const free = (check) => (check.limit == null ? t('free', 'livre') : formatFixed(check.limit, 2));
      const [hc, wc, lc] = room.checks;
      tag(top.x, top.y - 16, t('room.tag', `Sala ${free(hc)} × ${free(wc)} × ${free(lc)} m · ${status}`, { h: free(hc), w: free(wc), l: free(lc), status }), color, 'left', true);
    }
    room.checks
      .filter((check) => check.status === 'over')
      .forEach((check, index) => {
        const anchor = project(check.dim === 'height' ? P(cx, h, f) : check.dim === 'width' ? P(b, 0, f) : P(a, 0, r));
        if (anchor.z > 0.15) {
          const name = t(`room.${check.dim}`, { height: 'altura', width: 'largura', length: 'comprimento' }[check.dim]);
          tag(anchor.x, anchor.y + 18 + index * 22, t('room.exceeds', `${name} excede ${formatFixed(-check.marginM, 2)} m`, { name, m: formatFixed(-check.marginM, 2) }), COLORS.over, 'center', true);
        }
      });
  }

  function drawCoolingBadge() {
    const d = dims;
    const fh = Math.min(0.42, Math.max(0.3, d.H * 0.12));
    /* Selo no fundo, sobre o módulo refrigerado: na planta fica no alto, longe da cota frontal. */
    const anchor = project(P(-d.Wc / 2 + 0.25, d.H - fh / 2, d.L - 0.35));
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
    tag(anchor.x + radius + 4, anchor.y - 22, t('cool.badge', 'Refrigerado'), COLORS.cool, 'left', true);
  }

  function drawHud() {
    ctx.save();
    ctx.font = '700 14px Outfit, "Segoe UI", sans-serif';
    ctx.fillStyle = '#1a2421';
    ctx.textBaseline = 'top';
    ctx.fillText(t('hud.title', `${model.name} · Robô ${model.classId}`, { model: model.name, cls: model.classId }), 14, 12);
    ctx.font = '500 12px Outfit, "Segoe UI", sans-serif';
    ctx.fillStyle = '#5c675f';
    ctx.fillText(`${formatFlex(model.capacity)} ${t('hud.packs', 'pacotes')} · ${t(`hud.theme.${view.theme}`, THEMES[view.theme].label)}${xrayMix > 0.5 ? ` · ${t('hud.xray', 'raios-X')}` : ''}`, 14, 31);
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('hud.grid', 'Grade de 1 m × 1 m'), 14, height - 10);
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
    dimension(P(-d.Wc / 2, 0, -0.45), P(d.Wc / 2, 0, -0.45), model.labels.physical, '#0b3d34');
    /* Comprimento total: à direita na planta; em perspectiva, à esquerda em primeiro plano, sem cruzar o corpo do robô. */
    if (cam.pitch > 1.05) dimension(P(d.Wc / 2 + 0.48, 0, 0), P(d.Wc / 2 + 0.48, 0, d.L), model.labels.L, '#0b3d34');
    else dimension(P(xs - 0.55, 0, 0), P(xs - 0.55, 0, d.L), model.labels.L, '#0b3d34');
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
  document.getElementById('lang-pt')?.addEventListener('click', () => {
    if (lang !== 'pt') setLang('pt');
  });
  document.getElementById('lang-en')?.addEventListener('click', () => {
    if (lang !== 'en') setLang('en');
  });
  document.getElementById('ver-calculo').addEventListener('click', () => {
    const memory = document.getElementById('memoria');
    const button = document.getElementById('ver-calculo');
    const willOpen = memory.classList.contains('is-collapsed');
    memory.classList.toggle('is-collapsed', !willOpen);
    button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (willOpen) memory.scrollIntoView({ block: 'nearest' });
  });
  const modal = document.getElementById('premissas-modal');
  const opener = document.getElementById('open-premissas');
  const closeModal = () => {
    if (!modal.open) return;
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  };
  opener.addEventListener('click', () => {
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
    document.getElementById('close-premissas').focus();
  });
  document.getElementById('close-premissas').addEventListener('click', closeModal);
  // Clique no fundo escurecido: o alvo é o próprio dialog, fora do cartão.
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  modal.addEventListener('close', () => opener.focus());
  document.getElementById('print').addEventListener('click', () => window.print());
  document.getElementById('toggle-ex-tarifario').addEventListener('click', () => {
    state.exTarifario = !state.exTarifario;
    fillControls();
    commit();
  });
  document.getElementById('toggle-convenio-icms').addEventListener('click', () => {
    state.convenioIcms5291 = !state.convenioIcms5291;
    state.icmsRatePct = state.convenioIcms5291 ? NCM_INFO.icmsConvenio5291Pct : NCM_INFO.icmsFullSpPct;
    fillControls();
    commit();
  });
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
        servicesEur: AVERAGE_SERVICES_EUR,
        localServicesBrl: 0,
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
  const closeParams = () => syncParams(false, { persistChoice: true });
  document.getElementById('toggle-params').addEventListener('click', () => {
    const workspace = document.getElementById('workspace');
    const open = paramsWide()
      ? workspace.classList.contains('params-collapsed')
      : !workspace.classList.contains('params-drawer');
    syncParams(open, { persistChoice: true });
  });
  document.getElementById('close-params').addEventListener('click', closeParams);
  document.getElementById('params-backdrop').addEventListener('click', closeParams);
  paramsQuery.addEventListener('change', () => {
    syncParams(paramsWide() ? storedParamsOpen() : false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (modal.open) {
      event.preventDefault();
      closeModal();
    } else if (!paramsWide() && document.getElementById('workspace').classList.contains('params-drawer')) {
      event.preventDefault();
      closeParams();
      document.getElementById('toggle-params').focus();
    }
    document.querySelectorAll('.tip').forEach((node) => {
      node.hidden = true;
    });
    document.querySelectorAll('.tip-btn').forEach((node) => node.setAttribute('aria-expanded', 'false'));
  });
  syncParams(paramsWide() ? storedParamsOpen() : false);
}

loadLang();
loadState();
applyI18n();
buildForm();
fillControls();
bindChrome();
syncViewButtons();
viewer = createViewer(document.getElementById('viewer'));
commit();
