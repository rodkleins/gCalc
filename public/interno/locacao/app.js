import {
  DEFAULTS,
  evaluate,
  explain,
  formatBRL,
  formatFixed,
  formatFlex,
  parseBr,
  paybackLabel,
} from './calc.js';

const STORAGE_KEY = 'gcalc.locacao.interno.v3';

const SECTIONS = [
  {
    id: 'repasse',
    title: 'Repasse e aluguel',
    open: true,
    intro: 'No repasse, o aluguel é um percentual da economia mensal e a loja fica com o resto. O campo manual só vale com o repasse desligado. A manutenção terceirizada é custo à parte.',
    fields: [
      {
        key: 'passThroughOn',
        label: 'Modo do aluguel',
        kind: 'check',
        checkLabel: 'Repasse da economia da loja',
        wide: true,
        tooltip: 'Ligado: o aluguel é um percentual da economia mensal da loja. Desligado: vale o valor manual, ou a mínima sugerida se o campo estiver vazio.',
      },
      {
        key: 'passThroughPct',
        label: 'Repasse da economia',
        suffix: '%',
        min: 0,
        max: 100,
        step: 1,
        integer: true,
        slider: true,
        tooltip: 'Percentual da economia mensal que vira aluguel. Padrão: 60%. O saving líquido da loja é o que sobra.',
      },
      {
        key: 'storeSaving',
        label: 'Economia mensal da loja',
        prefix: 'R$/mês',
        min: 0,
        wide: true,
        tooltip: 'Loja de R$ 2 milhões, cenário base, mês 60: R$ 68.720 sem robô menos R$ 19.104 com robô = R$ 49.616. O número pode ser editado.',
      },
      {
        key: 'rent',
        label: 'Aluguel manual por robô',
        prefix: 'R$/mês',
        allowEmpty: true,
        placeholder: 'ex.: 20.000',
        min: 0,
        wide: true,
        tooltip: 'Preço mensal por robô alugado, usado só com o repasse desligado. Vazio: o resultado usa a mensalidade mínima sugerida.',
      },
    ],
  },
  {
    id: 'terceirizada',
    title: 'Manutenção',
    open: true,
    intro: 'Outra empresa faz a manutenção. O custo entra por robô alugado, no mesmo mês do aluguel.',
    fields: [
      {
        key: 'maintenancePerRobot',
        label: 'Manutenção terceirizada (R$/robô/mês)',
        prefix: 'R$',
        min: 0,
        wide: true,
        tooltip: 'O custo entra por robô que está alugado, a partir do mês seguinte à instalação, o mesmo mês em que o aluguel começa. Padrão: R$ 3.500.',
      },
    ],
  },
  {
    id: 'preco',
    title: 'Preço do robô',
    open: true,
    intro: 'O preço sai inteiro no mês da instalação. O crédito de impostos não abate essa compra: volta em parcelas, no avançado.',
    fields: [
      {
        key: 'robotPrice',
        label: 'Preço do robô',
        prefix: 'R$',
        min: 0,
        wide: true,
        tooltip: 'Premissa de R$ 1.300.000. O desconto de volume abate este preço.',
      },
    ],
  },
  {
    id: 'ritmo',
    title: 'Ritmo',
    open: true,
    intro: 'A frota cresce todo mês até o horizonte. A frota máxima, se preenchida, trava as compras novas. Recolocação não conta como compra.',
    fields: [
      {
        key: 'pace',
        label: 'Robôs instalados por mês',
        min: 0,
        max: 20,
        step: 1,
        integer: true,
        slider: true,
        tooltip: 'Compras novas por mês. Padrão: 1. A recolocação de quem não renovou é extra e não usa essa cota.',
      },
      {
        key: 'horizon',
        label: 'Horizonte',
        suffix: 'meses',
        min: 1,
        max: 360,
        step: 1,
        integer: true,
        slider: true,
        tooltip: 'Quantos meses o fluxo da frota acompanha. Padrão: 180, para cobrir o contrato de 10 anos e mais 60 meses. O controle vai até 360.',
      },
      {
        key: 'maxFleet',
        label: 'Frota máxima',
        allowEmpty: true,
        placeholder: 'sem limite',
        min: 0,
        integer: true,
        tooltip: 'Opcional. Em branco, a compra segue o ritmo até o fim do horizonte.',
      },
    ],
  },
  {
    id: 'contrato',
    title: 'Contrato',
    open: true,
    intro: 'O prazo padrão é 10 anos. A instalação conta na vida útil e o aluguel começa no mês seguinte.',
    fields: [
      {
        key: 'contractMonths',
        label: 'Prazo do contrato',
        suffix: 'meses',
        min: 1,
        max: 240,
        step: 1,
        integer: true,
        slider: true,
        wide: true,
        tooltip: 'Meses de calendário de cada contrato, contando a instalação na vida útil. Padrão: 120, dez anos.',
      },
    ],
  },
  {
    id: 'avancado',
    title: 'Avançado',
    open: false,
    intro: 'Desconto de volume, impostos, custos extras, fim de contrato e captação.',
    groups: [
      {
        title: 'Compra',
        fields: [
          {
            key: 'tier1From',
            label: '1ª faixa a partir do robô',
            min: 1,
            max: 500,
            step: 1,
            integer: true,
            slider: true,
            tooltip: 'Compra acumulada em que começa o primeiro desconto. Padrão: o 10º robô. Recolocação não conta.',
          },
          {
            key: 'tier1Pct',
            label: 'Desconto da 1ª faixa',
            suffix: '%',
            min: 0,
            max: 50,
            step: 1,
            slider: true,
            tooltip: 'Desconto sobre o preço de tabela a partir da 1ª faixa. Padrão: 5%.',
          },
          {
            key: 'tier2From',
            label: '2ª faixa a partir do robô',
            min: 1,
            max: 500,
            step: 1,
            integer: true,
            slider: true,
            tooltip: 'Compra acumulada em que começa o segundo desconto. Padrão: o 50º robô. Vale o maior patamar atingido.',
          },
          {
            key: 'tier2Pct',
            label: 'Desconto da 2ª faixa',
            suffix: '%',
            min: 0,
            max: 50,
            step: 1,
            slider: true,
            tooltip: 'Desconto sobre o preço de tabela a partir da 2ª faixa. Padrão: 10%.',
          },
          {
            key: 'taxCreditPct',
            label: 'Créditos de impostos recuperáveis',
            suffix: '%',
            min: 0,
            max: 100,
            step: 1,
            slider: true,
            tooltip: 'Percentual do preço do robô, já com desconto de volume. Frete e peças ficam de fora. Não abate o mês da compra: o crédito volta em parcelas a partir do mês seguinte. Padrão: 25%. Confirme com o contador o que de fato vira crédito.',
          },
          {
            key: 'creditMonths',
            label: 'Meses para recuperar o crédito',
            suffix: 'meses',
            min: 1,
            max: 360,
            step: 1,
            integer: true,
            slider: true,
            wide: true,
            tooltip: 'Parcelas mensais iguais, a partir do mês seguinte à compra. Padrão: 48. A divisão é em centavos e as primeiras parcelas levam o que sobra. A recuperação segue mesmo se o robô sair de campo. Recolocação não gera crédito novo.',
          },
          {
            key: 'freight',
            label: 'Frete e instalação',
            prefix: 'R$',
            min: 0,
            tooltip: 'Por robô, no mês da compra. Padrão zero. Não se repete na recolocação.',
          },
          {
            key: 'partsPerRobot',
            label: 'Estoque de peças por robô',
            prefix: 'R$',
            min: 0,
            tooltip: 'Nasce em zero. Entra na compra e fica fora do custo mensal.',
          },
        ],
      },
      {
        title: 'Receita',
        fields: [
          {
            key: 'targetPayback',
            label: 'Payback alvo da mínima',
            suffix: 'meses',
            min: 1,
            max: 360,
            step: 1,
            integer: true,
            slider: true,
            tooltip: 'A mensalidade mínima é o menor aluguel que faz o caixa acumulado voltar a zero até este mês. Padrão: 36.',
          },
          {
            key: 'annualAdjustmentPct',
            label: 'Reajuste anual',
            suffix: '%',
            min: 0,
            max: 30,
            step: 0.5,
            slider: true,
            tooltip: 'A tabela inteira sobe esse percentual a cada 12 meses de calendário. Padrão: 4%.',
          },
          {
            key: 'setupFee',
            label: 'Taxa de setup por robô',
            prefix: 'R$',
            min: 0,
            tooltip: 'Cobrada na instalação e na recolocação, líquida do imposto sobre receita. Renovação não cobra. Padrão zero.',
          },
          {
            key: 'delinquencyPct',
            label: 'Inadimplência',
            suffix: '%',
            min: 0,
            max: 100,
            step: 0.5,
            slider: true,
            tooltip: 'Reduz o que entra no caixa. Não reduz o imposto, que incide sobre o faturado. Padrão: 2%.',
          },
          {
            key: 'revenueTaxPct',
            label: 'Impostos sobre a receita',
            suffix: '%',
            min: 0,
            max: 40,
            step: 0.01,
            digits: 2,
            slider: true,
            tooltip: 'Premissa editável. 11,33% é um exemplo para a conta, não uma alíquota fechada. Confirme com o contador, inclusive na transição do IBS e da CBS.',
          },
        ],
      },
      {
        title: 'Outros custos',
        fields: [
          {
            key: 'insurancePerRobot',
            label: 'Seguro',
            prefix: 'R$',
            min: 0,
            tooltip: 'Por robô em campo, por mês. Padrão zero.',
          },
          {
            key: 'monitoringPerRobot',
            label: 'Monitoramento',
            prefix: 'R$',
            min: 0,
            tooltip: 'Por robô em campo, por mês. Padrão zero.',
          },
        ],
      },
      {
        title: 'Fim de contrato',
        fields: [
          {
            key: 'usefulLifeYears',
            label: 'Vida útil',
            suffix: 'anos',
            min: 1,
            max: 40,
            step: 1,
            slider: true,
            tooltip: 'Base da depreciação linear, em anos. Padrão: 10. Vira meses arredondados.',
          },
          {
            key: 'residualPct',
            label: 'Valor residual',
            suffix: '%',
            min: 0,
            max: 100,
            step: 1,
            slider: true,
            tooltip: 'Percentual do preço do robô que entra no caixa no fim da vida. Frete e peças vão a zero. Padrão: 20%.',
          },
          {
            key: 'renewalPct',
            label: 'Taxa de renovação',
            suffix: '%',
            min: 0,
            max: 100,
            step: 1,
            slider: true,
            tooltip: 'Parcela que continua alugada, sem setup. O restante é reinstalado no mesmo mês. Padrão: 80%.',
          },
        ],
      },
      {
        title: 'Captação',
        fields: [
          {
            key: 'safetyMarginPct',
            label: 'Margem de segurança',
            suffix: '%',
            min: 0,
            max: 100,
            step: 1,
            slider: true,
            tooltip: 'Captação = pico do caixa negativo × (1 + esta margem). Padrão: 20%.',
          },
          {
            key: 'preMoney',
            label: 'Valuation pre-money',
            prefix: 'R$',
            allowEmpty: true,
            placeholder: 'em branco',
            min: 0,
            tooltip: 'Valor da empresa antes do aporte. Diluição = captação ÷ (pre-money + captação).',
          },
          {
            key: 'discountPct',
            label: 'Taxa de desconto do investidor',
            suffix: '% a.a.',
            min: 0,
            max: 80,
            step: 1,
            slider: true,
            tooltip: 'Taxa efetiva ao ano do VPL. A taxa mensal é (1 + anual) ^ (1 ÷ 12) − 1. Padrão: 25%.',
          },
          {
            key: 'twoTranches',
            label: 'Dividir o aporte',
            kind: 'check',
            checkLabel: 'Duas tranches',
            tooltip: 'A soma continua igual à captação. Nenhuma tranche entra na TIR nem no payback.',
          },
          {
            key: 'tranche2Month',
            label: 'Mês da segunda tranche',
            min: 2,
            max: 360,
            step: 1,
            integer: true,
            slider: true,
            tooltip: 'A primeira tranche cobre o pico até o mês anterior, com a mesma margem. O resto entra aqui.',
          },
        ],
      },
    ],
  },
];

const CHART = { w: 760, h: 340, left: 78, right: 86, top: 16, bottom: 32 };

let state = freshState();
const controls = new Map();

function freshState() {
  return { ...DEFAULTS };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return freshState();
    const next = freshState();
    for (const key of Object.keys(DEFAULTS)) {
      if (parsed[key] == null && (key === 'rent' || key === 'maxFleet' || key === 'preMoney')) {
        next[key] = null;
        continue;
      }
      if (typeof DEFAULTS[key] === 'boolean') {
        if (typeof parsed[key] === 'boolean') next[key] = parsed[key];
      } else if (typeof parsed[key] === 'number' && Number.isFinite(parsed[key])) {
        next[key] = parsed[key];
      }
    }
    return next;
  } catch {
    return freshState();
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  return formatFlex(value, field.digits ?? 2);
}

function fromDisplay(field, raw) {
  if (field.allowEmpty && String(raw).trim() === '') return null;
  const parsed = parseBr(raw);
  if (parsed == null) return undefined;
  return clampField(field, parsed);
}

function renderField(field) {
  const wrap = el('div', field.wide || field.slider ? 'field field-wide' : 'field');
  const head = el('div', 'field-head');
  const label = el('label', null, field.label);
  label.htmlFor = field.kind === 'check' ? field.key : `${field.key}-text`;
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
  if (field.key === 'rent') {
    const hint = el('p', 'hint');
    hint.id = 'rent-hint';
    wrap.append(hint);
  }
  if (field.key === 'storeSaving') {
    const hint = el('p', 'hint');
    hint.id = 'saving-hint';
    wrap.append(hint);
  }
  if (field.key === 'maintenancePerRobot') {
    const hint = el('p', 'hint');
    hint.id = 'maintenance-hint';
    wrap.append(hint);
  }
  controls.set(field.key, { field, text, slider, wrap });
  return wrap;
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

function appendFields(parent, fields) {
  const grid = el('div', 'fields');
  for (const field of fields) grid.append(renderField(field));
  parent.append(grid);
}

function buildForm() {
  const form = document.getElementById('form');
  form.replaceChildren();
  for (const section of SECTIONS) {
    const card = el('details', 'card fold');
    if (section.open) card.open = true;
    const summary = el('summary');
    summary.append(el('span', 'fold-title', section.title));
    const body = el('div', 'fold-body');
    body.append(el('p', 'intro', section.intro));
    if (section.fields) appendFields(body, section.fields);
    for (const group of section.groups || []) {
      const block = el('div', 'fold-group');
      block.append(el('h3', null, group.title));
      appendFields(block, group.fields);
      body.append(block);
    }
    card.append(summary, body);
    form.append(card);
  }
}

function fillControls() {
  for (const [key, control] of controls) {
    const value = state[key];
    if (control.check) control.check.checked = Boolean(value);
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
  control.wrap.classList.toggle('is-off', off);
}

function syncLocks() {
  lockControl('tranche2Month', !state.twoTranches);
  lockControl('rent', state.passThroughOn === true);
  lockControl('passThroughPct', state.passThroughOn !== true);
}

function money(cents) {
  return formatBRL(cents / 100);
}

function compact(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function compactBRL(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return compact(value);
}

function paybackView(result) {
  if (!result.wentNegative) return { value: 'Sem desembolso', sub: 'no horizonte' };
  if (result.payback == null) return { value: 'Não recupera', sub: `em ${formatFlex(result.horizon)} meses` };
  return { value: `Mês ${formatFlex(result.payback)}`, sub: null };
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

function moneyKpi(id, label, amount, extra = {}) {
  return {
    id,
    label,
    value: compactBRL(amount),
    exact: formatBRL(amount),
    title: formatBRL(amount),
    ...extra,
  };
}

function renderKpis(result) {
  const hero = document.getElementById('hero-kpis');
  const host = document.getElementById('kpis');
  const payback = paybackView(result);
  hero.replaceChildren();
  renderKpi(hero, {
    id: 'payback',
    label: 'Payback da frota',
    value: payback.value,
    sub: payback.sub,
    title: paybackLabel(result),
    hero: true,
  });
  renderKpi(hero, moneyKpi('raise', 'Captação necessária', result.raise, { hero: true }));
  renderKpi(hero, moneyKpi('saving', 'Saving líquido da loja', result.storeNetSaving, { hero: true }));
  renderKpi(hero, moneyKpi('rent-used', 'Aluguel', result.rentUsed, { hero: true }));

  const fleet = document.getElementById('fleet-note');
  if (fleet) {
    fleet.textContent = `Frota no fim: ${formatFlex(result.finalFleet)} ${result.finalFleet === 1 ? 'robô' : 'robôs'}.`;
  }
  const dilutionHint = document.getElementById('dilution-hint');
  if (dilutionHint) dilutionHint.hidden = result.dilution != null;

  const irr = result.irr == null ? '—' : `${formatFixed(result.irr * 100, 2)}% a.a.`;
  host.replaceChildren();
  renderKpi(host, { id: 'irr', label: 'TIR', value: irr, title: irr });
  renderKpi(host, moneyKpi('npv', 'VPL', result.npv));
  renderKpi(
    host,
    moneyKpi('worst', 'Pior caixa', result.worst, { sub: `mês ${formatFlex(result.worstMonth)}` }),
  );
  renderKpi(host, result.margin == null
    ? { id: 'margin', label: 'Margem/robô', value: '—', title: 'Sem robô alugado' }
    : moneyKpi('margin', 'Margem/robô', result.margin));
  renderKpi(host, result.suggestedRent == null
    ? { id: 'minimum', label: 'Mensalidade mínima', value: '—', title: 'Sem mensalidade que devolva o caixa' }
    : moneyKpi('minimum', 'Mensalidade mínima', result.suggestedRent));
  if (result.dilution != null) {
    const dilution = `${formatFixed(result.dilution * 100, 2)}%`;
    renderKpi(host, { id: 'dilution', label: 'Diluição', value: dilution, title: dilution });
  }
  const banner = document.getElementById('rent-banner');
  if (result.passThroughOn) {
    banner.hidden = false;
    banner.textContent = `Repasse de ${formatFlex(result.passThroughPct)}% sobre ${formatBRL(result.storeSaving)}: aluguel ${formatBRL(result.rentUsed)}. Saving líquido da loja ${formatBRL(result.storeNetSaving)}.`;
  } else if (result.usedSuggestion) {
    banner.hidden = false;
    banner.textContent = `Aluguel em branco: o resultado usa a mensalidade mínima sugerida, ${formatBRL(result.rentUsed)}.`;
  } else {
    banner.hidden = true;
    banner.textContent = '';
  }
  const hint = document.getElementById('rent-hint');
  if (hint) {
    hint.textContent =
      result.suggestedRent == null
        ? `Não há aluguel que devolva o caixa até o mês ${formatFlex(result.targetPayback)}. Referência, não altera o campo.`
        : `Mínima para payback em ${formatFlex(result.targetPayback)} meses: ${formatBRL(result.suggestedRent)}. Referência, não altera o campo.`;
  }
  const saving = document.getElementById('saving-hint');
  if (saving) {
    saving.textContent = `Saving líquido da loja = ${formatBRL(result.storeSaving)} − ${formatBRL(result.rentUsed)} = ${formatBRL(result.storeNetSaving)}. O reajuste anual reduz esse líquido depois do primeiro ano.`;
  }
  const maintenanceHint = document.getElementById('maintenance-hint');
  if (maintenanceHint) {
    maintenanceHint.textContent = `${formatBRL(result.maintenancePerRobot)} por robô alugado, no mesmo mês do aluguel. No mês da instalação o custo é zero.`;
  }
  const note = document.getElementById('funding-note');
  const parts = result.tranches.map((tranche) => `${money(tranche.cents)} no mês ${formatFlex(tranche.month)}`);
  note.textContent = result.twoTranches
    ? `Tranches do aporte, fora da TIR: ${parts.join(' e ')}.`
    : `Aporte único no mês 1, fora da TIR: ${parts[0]}.`;
  document.getElementById('dock-payback').textContent = payback.value;
  document.getElementById('dock-raise').textContent = compactBRL(result.raise);
  document.getElementById('dock-saving').textContent = compactBRL(result.storeNetSaving);
  renderContract(result);
}

function renderContract(result) {
  const host = document.getElementById('contract-kpis');
  const note = document.getElementById('contract-note');
  const contract = result.contract;
  if (!host || !contract) return;
  const irr = contract.irr == null ? '—' : `${formatFixed(contract.irr * 100, 2)}% a.a.`;
  const contractPayback = paybackView(contract);
  host.replaceChildren();
  renderKpi(host, {
    id: 'contract-payback',
    label: 'Payback',
    value: contractPayback.value,
    sub: contractPayback.sub,
    title: contract.label,
  });
  renderKpi(host, { id: 'contract-irr', label: 'TIR', value: irr, title: irr });
  renderKpi(host, moneyKpi('contract-npv', 'VPL', contract.npv));
  renderKpi(host, moneyKpi('contract-profit', 'Lucro total', contract.profit));
  if (note) {
    note.textContent = `Um robô no preço de tabela, contrato de ${formatFlex(result.contractMonths)} meses, sem renovação e sem recolocação. A manutenção terceirizada é ${formatBRL(contract.maintenanceMonthly)} por robô alugado, no mesmo mês do aluguel. O aluguel cobre ${formatFlex(contract.billingMonths)} meses.`;
  }
}

function renderYears(result) {
  const table = document.getElementById('years');
  table.replaceChildren();
  table.append(el('caption', null, 'Caixa por ano'));
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const label of ['Ano', 'Robôs no fim', 'Receita no caixa', 'Manutenção', 'Compra', 'Caixa do ano', 'Acumulado']) {
    hr.append(el('th', label === 'Ano' ? null : 'num', label));
  }
  head.append(hr);
  const body = document.createElement('tbody');
  for (const year of result.years) {
    const tr = document.createElement('tr');
    tr.append(el('th', null, formatFlex(year.year)));
    tr.append(el('td', 'num', formatFlex(year.inField)));
    tr.append(el('td', 'num', money(year.salesCents)));
    tr.append(el('td', 'num', money(year.maintenanceCents)));
    tr.append(el('td', 'num', money(year.capexCents)));
    tr.append(el('td', 'num', money(year.netCents)));
    tr.append(el('td', 'num', money(year.cumulativeCents)));
    body.append(tr);
  }
  table.append(head, body);
}

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

function svgEl(name, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function drawChart(result) {
  const rows = result.months;
  const host = document.getElementById('chart');
  const readout = document.getElementById('chart-readout');
  if (!rows.length) {
    host.replaceChildren();
    readout.textContent = '';
    return;
  }
  const { w, h, left, right, top, bottom } = CHART;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const ops = rows.map((row) => row.operatingCents / 100);
  const cums = rows.map((row) => row.cumulativeCents / 100);
  const opMax = Math.max(0, ...ops);
  const opMin = Math.min(0, ...ops);
  const opSpan = opMax - opMin || 1;
  const cumMax = Math.max(0, ...cums);
  const cumMin = Math.min(0, ...cums);
  const cumSpan = cumMax - cumMin || 1;
  const yOp = (value) => top + ((opMax - value) / opSpan) * plotH;
  const yCum = (value) => top + ((cumMax - value) / cumSpan) * plotH;
  const xAt = (index) => left + ((index + 0.5) / rows.length) * plotW;
  const barW = Math.max(1.2, (plotW / rows.length) * 0.62);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${w} ${h}`,
    role: 'img',
    'aria-labelledby': 'chart-title chart-readout',
  });
  svg.append(svgEl('rect', { x: 0, y: 0, width: w, height: h, fill: '#fffdf8' }));
  svg.append(
    svgEl('line', {
      x1: left,
      x2: w - right,
      y1: yOp(0),
      y2: yOp(0),
      stroke: '#e6dfd4',
    }),
  );

  for (const value of [opMin, 0, opMax]) {
    const label = svgEl('text', { x: left - 8, y: yOp(value) + 4, 'text-anchor': 'end', class: 'axis' });
    label.textContent = compact(value);
    svg.append(label);
  }
  for (const value of [cumMin, 0, cumMax]) {
    const label = svgEl('text', { x: w - right + 8, y: yCum(value) + 4, class: 'axis' });
    label.textContent = compact(value);
    svg.append(label);
  }

  rows.forEach((row, index) => {
    const value = ops[index];
    const y = yOp(Math.max(value, 0));
    const height = Math.max(1, Math.abs(yOp(value) - yOp(0)));
    svg.append(
      svgEl('rect', {
        x: xAt(index) - barW / 2,
        y,
        width: barW,
        height,
        fill: value < 0 ? '#9a3b2f' : '#0f5c4c',
      }),
    );
  });

  const line = rows
    .map((row, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(2)},${yCum(cums[index]).toFixed(2)}`)
    .join(' ');
  svg.append(
    svgEl('path', {
      d: line,
      fill: 'none',
      stroke: '#1a2421',
      'stroke-width': 2.2,
      'stroke-linejoin': 'round',
    }),
  );

  const mark = (month, color) => {
    if (!(month > 0) || month > rows.length) return;
    const index = month - 1;
    svg.append(
      svgEl('circle', {
        cx: xAt(index),
        cy: yCum(cums[index]),
        r: 4.5,
        fill: color,
        stroke: '#fffdf8',
        'stroke-width': 1.5,
      }),
    );
  };
  mark(result.worstMonth, '#9a3b2f');
  mark(result.payback, '#0f5c4c');

  const tickEvery = rows.length > 180 ? 24 : 12;
  for (let month = tickEvery; month <= rows.length; month += tickEvery) {
    const label = svgEl('text', {
      x: xAt(month - 1),
      y: h - 8,
      'text-anchor': 'middle',
      class: 'axis',
    });
    label.textContent = formatFlex(month);
    svg.append(label);
  }

  host.replaceChildren(svg);
  const describe = (index) => {
    const row = rows[index];
    readout.textContent = `Mês ${formatFlex(row.month)}: caixa ${money(row.operatingCents)}, acumulado ${money(row.cumulativeCents)}, ${formatFlex(row.inField)} robôs em campo, ${formatFlex(row.billing)} alugados, manutenção ${money(row.maintenanceCents)}.`;
  };
  describe(rows.length - 1);
  svg.addEventListener('pointermove', (event) => {
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * w;
    const index = Math.min(rows.length - 1, Math.max(0, Math.floor(((x - left) / plotW) * rows.length)));
    describe(index);
  });
}

function render() {
  const result = evaluate(state);
  syncLocks();
  renderKpis(result);
  renderYears(result);
  renderMemory(result);
  drawChart(result);
  const stamp = document.getElementById('print-date');
  if (stamp) {
    stamp.textContent = `Memória de cálculo · ${new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}.`;
  }
}

function commit() {
  if (state.targetPayback > state.horizon) state.targetPayback = state.horizon;
  if (state.tranche2Month > state.horizon) state.tranche2Month = state.horizon;
  const target = controls.get('targetPayback');
  if (target?.text && document.activeElement !== target.text) target.text.value = toDisplay(target.field, state.targetPayback);
  if (target?.slider) target.slider.value = String(state.targetPayback);
  render();
  persist();
}

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
    fillControls();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    commit();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.tip').forEach((node) => {
      node.hidden = true;
    });
    document.querySelectorAll('.tip-btn').forEach((node) => node.setAttribute('aria-expanded', 'false'));
  });
}

state = loadState();
buildForm();
fillControls();
bindChrome();
commit();
