import {
  CHARGE_LINES,
  DEFAULTS,
  calculate,
  chargeNote,
  costSeries,
  explain,
  FLEET_MAX,
  formatBRL,
  formatFixed,
  formatFlex,
  headcountLabel,
  parseBr,
  plateaus,
  restoreCorrectivesPerYear,
  staffSummary,
} from './calc.js';

const STORAGE_KEY = 'gcalc.manutencao.interno.v3';
const LEGACY_STORAGE_KEYS = ['gcalc.manutencao.interno.v2'];
const RETIRED_KEYS = ['pairMaxRobots'];

const SECTIONS = [
  {
    id: 'frota',
    title: 'Frota',
    fields: [
      {
        key: 'robots',
        label: 'Número de robôs',
        slider: true,
        integer: true,
        min: 1,
        max: FLEET_MAX,
        step: 1,
        wide: true,
        tooltip:
          'Quantidade de robôs Gollmann atendidos por esta base, de 1 a 1.000. O controle anda de 1 em 1 e o campo aceita o número digitado. Multiplica visitas, taxa do fabricante e o estoque inicial de peças.',
      },
    ],
  },
  {
    id: 'equipe',
    title: 'Equipe CLT',
    intro:
      'A cabine da Fiat Strada leva 2 pessoas, então a equipe tem no máximo sênior e pleno, e sempre começa pelo sênior. Cada equipe sai com o próprio carro. Os salários são premissa interna, acima das médias de mercado.',
    fields: [
      {
        key: 'salarySenior',
        label: 'Sênior',
        prefix: 'R$',
        min: 0,
        tooltip: 'Salário-base mensal CLT, sem adicionais. Premissa interna de R$ 10.000. A pesquisa de mercado em SP fica bem abaixo disso.',
      },
      {
        key: 'salaryPleno',
        label: 'Pleno',
        prefix: 'R$',
        min: 0,
        tooltip: 'Salário-base mensal CLT, sem adicionais. Premissa interna de R$ 6.000. Só entra quando a equipe é de duas pessoas.',
      },
      {
        key: 'autoScale',
        label: 'Escalonamento automático',
        kind: 'check',
        checkLabel: 'Ligado',
        wide: true,
        tooltip:
          'Ligado: até o limite, uma equipe só com sênior, se as visitas couberem na metade; a partir do robô seguinte entra o pleno. Outra equipe só quando as visitas passam da capacidade da dupla. Desligado: a composição marcada vale para todas as equipes, o limite fica de fora e o número de equipes segue só a capacidade.',
      },
      {
        key: 'soloMaxRobots',
        label: 'Até quantos robôs a equipe é só Sênior',
        integer: true,
        min: 0,
        max: 200,
        tooltip:
          'No modo automático, até este número a equipe é só o sênior, se as visitas couberem na metade da capacidade. Se não couberem, entra o pleno na mesma equipe, em vez de abrir outra equipe só de sênior. No modo manual este campo fica desligado. Default 5.',
      },
      {
        key: 'includeSenior',
        label: 'Sênior na equipe',
        kind: 'check',
        checkLabel: 'Sempre na equipe',
        locked: true,
        tooltip: 'A equipe sempre começa pelo sênior. Este papel não sai da composição. No máximo duas pessoas por carro.',
      },
      {
        key: 'includePleno',
        label: 'Pleno na equipe',
        kind: 'check',
        checkLabel: 'Incluir o pleno',
        tooltip:
          'Marcar ou desmarcar compõe a equipe à mão e desliga o escalonamento automático. No modo automático o campo mostra o que a regra escolheu. Máximo de 2 pessoas.',
      },
    ],
  },
  {
    id: 'encargos',
    title: 'Encargos',
    intro:
      'O custo multiplica o salário pelo multiplicador efetivo. O 1,65 cobre encargos, 13º, férias e a multa do FGTS. Com a provisão de rescisão ligada, soma-se o aviso prévio indenizado e os encargos diretos sobre ele.',
    fields: [
      {
        key: 'encargosMultiplier',
        label: 'Multiplicador de encargos',
        min: 0,
        digits: 3,
        wide: true,
        tooltip:
          'Fator base sobre o salário (e sobre a periculosidade, se estiver ligada). Default 1,65, já com a provisão da multa de 40% do FGTS. Não inclui aviso prévio indenizado. Não multiplica VR nem plano de saúde.',
      },
      ...CHARGE_LINES.map((line) => ({
        key: line.key,
        label: line.label,
        suffix: '%',
        min: 0,
        max: 100,
        tooltip:
          line.key === 'multaFgts'
            ? '40% × 8% de FGTS ≈ 3,2% do salário. É a provisão da multa rescisória do FGTS e já está dentro do multiplicador de 1,65. Não cobre aviso prévio indenizado nem os encargos sobre o aviso: isso fica na provisão de rescisão, para não contar duas vezes.'
            : `${line.label} entra na composição exibida. Mudar esta alíquota atualiza a soma, a referência com incidência e, no caso de INSS, RAT, terceiros e FGTS, também o reflexo da provisão de rescisão. O 1,65 só muda se você editar o multiplicador.`,
      })),
      {
        key: 'severanceOn',
        label: 'Provisão de rescisão',
        kind: 'check',
        checkLabel: 'Ligada',
        wide: true,
        tooltip:
          'Ligada por padrão. Soma ao multiplicador o aviso prévio indenizado e a incidência de INSS, RAT, terceiros e FGTS sobre esse aviso. Não inclui a multa de 40% do FGTS, que já está no 1,65. Vale para técnicos e coordenador.',
      },
      {
        key: 'severanceRate',
        label: 'Aviso prévio indenizado',
        suffix: '%',
        min: 0,
        max: 100,
        tooltip:
          'Percentual do salário provisionado como aviso prévio indenizado. Default 8,33% (um salário ÷ 12). INSS, RAT, terceiros e FGTS incidem sobre esse percentual e entram no multiplicador efetivo. A multa de 40% do FGTS não é recalculada aqui.',
      },
    ],
  },
  {
    id: 'periculosidade',
    title: 'Periculosidade',
    fields: [
      {
        key: 'hazardOn',
        label: 'Aplicar periculosidade sobre o salário dos técnicos',
        kind: 'check',
        wide: true,
        tooltip:
          '30% do salário-base quando há exposição que caracterize periculosidade (CLT art. 193 / NR-16). Em robô de baixa tensão a premissa é deixar desligado. Não incide sobre o coordenador.',
      },
      {
        key: 'hazardRate',
        label: 'Percentual de periculosidade',
        suffix: '%',
        scale: 100,
        min: 0,
        max: 1,
        tooltip: 'Percentual legal usual de 30% do salário-base. Só entra na conta se o interruptor estiver ligado.',
      },
    ],
  },
  {
    id: 'beneficios',
    title: 'Benefícios por pessoa',
    intro: 'VR e plano não levam encargos. Entram uma vez para cada pessoa que está de fato na equipe, e também para cada coordenador.',
    fields: [
      {
        key: 'mealVoucher',
        label: 'Vale-refeição',
        prefix: 'R$',
        min: 0,
        tooltip:
          'Por pessoa e por mês. A FIPE registrou R$ 612,30 em São Paulo no 1º trimestre de 2026. O campo usa R$ 612.',
      },
      {
        key: 'healthPlan',
        label: 'Plano de saúde',
        prefix: 'R$',
        min: 0,
        tooltip:
          'Por vida e por mês. Premissa de R$ 450, no meio da faixa empresarial de SP citada na pesquisa (R$ 200 a R$ 600).',
      },
    ],
  },
  {
    id: 'carro',
    title: 'Carro da equipe',
    intro: 'Uma locação por equipe, no tamanho da Strada (cabine para 2). Combustível = quilômetros ÷ consumo × preço do litro.',
    fields: [
      {
        key: 'carRental',
        label: 'Locação',
        prefix: 'R$',
        min: 0,
        tooltip:
          'Assinatura mensal com impostos, seguro e assistência na referência da Strada PJ (a partir de R$ 2.660). O default de R$ 2.700 é a premissa arredondada.',
      },
      {
        key: 'kmPerMonth',
        label: 'Quilômetros por mês',
        suffix: 'km',
        min: 0,
        tooltip: 'Rodagem mensal de um carro. Premissa de 2.500 km.',
      },
      {
        key: 'kmPerLiter',
        label: 'Consumo',
        suffix: 'km/L',
        min: 0.1,
        tooltip: 'Quilômetros por litro na cidade, gasolina. Premissa de 10,5 km/L (faixa de 10 a 11 da Strada/Fiorino 1.3).',
      },
      {
        key: 'fuelPrice',
        label: 'Gasolina',
        prefix: 'R$',
        suffix: '/L',
        min: 0,
        tooltip: 'Preço do litro. ANP, cidade de São Paulo, semana de 4 a 10/10/2026: R$ 6,34.',
      },
      {
        key: 'tolls',
        label: 'Pedágio e estacionamento',
        prefix: 'R$',
        min: 0,
        tooltip: 'Soma mensal de pedágio e estacionamento de um carro. Premissa de R$ 400.',
      },
    ],
  },
  {
    id: 'capacidade',
    title: 'Capacidade e visitas',
    intro:
      'O campo de visitas por semana vale para a equipe cheia de 2. Uma pessoa faz a metade: visitas/semana × (pessoas ÷ 2) × semanas no ano. O fator de 4,33 semanas só mostra a capacidade mensal.',
    fields: [
      {
        key: 'visitsPerWeek',
        label: 'Visitas por semana por equipe',
        slider: true,
        min: 2,
        max: 5,
        step: 0.1,
        digits: 1,
        wide: true,
        tooltip:
          'Capacidade da equipe cheia, com sênior e pleno. A faixa usual é 3 a 4; o controle aceita de 2 a 5. Uma pessoa sozinha faz a metade. O default 3,5 é premissa.',
      },
      {
        key: 'weeksPerMonth',
        label: 'Semanas por mês (referência)',
        min: 1,
        max: 6,
        tooltip:
          'Cerca de 4,33. Serve só para exibir visitas por mês (visitas por semana × semanas por mês). A divisão de equipes usa as semanas no ano.',
      },
      {
        key: 'weeksPerYear',
        label: 'Semanas no ano',
        integer: true,
        min: 1,
        max: 53,
        tooltip: 'Entra na capacidade anual: visitas por semana × semanas no ano. Default 52. 4,33 × 12 fica próximo de 52, mas a conta de equipes usa este campo.',
      },
      {
        key: 'preventivesPerYear',
        label: 'Preventivas por ano por robô',
        slider: true,
        integer: true,
        min: 1,
        max: 12,
        step: 1,
        tooltip: 'Visitas preventivas de cada robô no ano. Default 4, trimestral. Premissa operacional, sem histórico da Gollmann nesta pesquisa.',
      },
      {
        key: 'correctivesPerYear',
        label: 'Corretivas por ano por robô (premissa)',
        slider: true,
        integer: true,
        min: 0,
        max: 12,
        step: 1,
        tooltip: 'Visitas corretivas de cada robô no ano. Default 2. Premissa, sem fonte: validar com o histórico.',
      },
    ],
  },
  {
    id: 'disponibilidade',
    title: 'Disponibilidade e turnover',
    intro:
      'Absenteísmo e a cobertura de férias só diminuem as visitas que a equipe consegue fazer. O salário de férias já está nos encargos. O turnover é o custo de substituir quem sai, em cima do salário-base.',
    fields: [
      {
        key: 'absenteeismOn',
        label: 'Absenteísmo',
        kind: 'check',
        checkLabel: 'Ligado',
        wide: true,
        tooltip:
          'Ligado por padrão. Reduz a capacidade de visitas da equipe. Não soma salário de novo: a folha de quem falta continua nas pessoas. Default 3%, premissa interna.',
      },
      {
        key: 'absenteeismRate',
        label: 'Taxa de absenteísmo',
        suffix: '%',
        min: 0,
        max: 100,
        tooltip: 'Percentual da capacidade perdido com faltas. Default 3%. Premissa interna, na borda baixa da faixa industrial citada nas fontes.',
      },
      {
        key: 'vacationCoverOn',
        label: 'Cobertura de férias',
        kind: 'check',
        checkLabel: 'Ligada',
        wide: true,
        tooltip:
          'Ligada por padrão. Tira da capacidade o tempo de férias, porque alguém precisa cobrir as visitas. O pagamento das férias já está no multiplicador de encargos e não entra outra vez.',
      },
      {
        key: 'vacationCoverRate',
        label: 'Percentual da cobertura',
        suffix: '%',
        min: 0,
        max: 100,
        tooltip: 'Default 8,33%, que é 1/12 (30 dias em 12 meses, CLT). A capacidade da dupla multiplica por (1 − este percentual).',
      },
      {
        key: 'turnoverRate',
        label: 'Turnover ao ano',
        suffix: '%',
        min: 0,
        max: 100,
        tooltip:
          'Percentual ao ano de pessoas substituídas, igual para técnicos, coordenadores e gerentes. Default 25%. Premissa interna, acima do 16,65% do setor de energia em 2024.',
      },
      {
        key: 'replacementFactor',
        label: 'Custo de substituição',
        suffix: '× salário',
        min: 0,
        max: 24,
        digits: 2,
        tooltip:
          'Salários-base mensais por substituição. Default 1,25. Premissa interna para rescisão que a provisão não cobre, recrutamento, treinamento e curva de aprendizado. Não leva encargos nem periculosidade.',
      },
    ],
  },
  {
    id: 'coordenacao',
    title: 'Coordenação',
    intro: 'Só existe quando há mais de uma equipe. Coordenadores = teto(equipes ÷ limite). Com uma equipe, o resultado é zero.',
    fields: [
      {
        key: 'coordinatorSalary',
        label: 'Salário do coordenador',
        prefix: 'R$',
        min: 0,
        tooltip:
          'Salário-base mensal. Premissa de R$ 12.000, multiplicada pelo mesmo fator efetivo dos técnicos, inclusive a provisão de rescisão quando está ligada. Os benefícios usam o VR e o plano por pessoa. Sem periculosidade.',
      },
      {
        key: 'teamsPerCoordinator',
        label: 'Equipes por coordenador',
        integer: true,
        min: 1,
        max: 50,
        tooltip: 'Um coordenador a cada N equipes. Default 4. Com 2, 3 ou 4 equipes há 1 coordenador; a 5ª equipe abre o segundo.',
      },
      {
        key: 'managerSalary',
        label: 'Salário do gerente',
        prefix: 'R$',
        min: 0,
        tooltip:
          'Salário-base mensal. Premissa de R$ 18.000, multiplicada pelo mesmo fator efetivo dos técnicos e do coordenador, inclusive a provisão de rescisão quando está ligada. Benefícios de VR e plano por pessoa. Sem periculosidade.',
      },
      {
        key: 'coordinatorsPerManager',
        label: 'Coordenadores por gerente',
        integer: true,
        min: 1,
        max: 50,
        tooltip:
          'O primeiro gerente entra quando os coordenadores atingem este número. Default 3. Gerentes = teto(coordenadores ÷ limite) a partir daí; abaixo do limite, zero.',
      },
    ],
  },
  {
    id: 'fabricante',
    title: 'Taxa anual ao fabricante',
    intro: 'Percentual do valor do robô por ano, dividido por 12. Entra no custo mensal, uma vez por robô.',
    fields: [
      {
        key: 'manufacturerFeeRate',
        label: 'Taxa anual',
        suffix: '%',
        scale: 100,
        min: 0,
        max: 1,
        digits: 2,
        tooltip: 'Premissa de 0,6% do valor do robô ao ano. O mês leva um doze avos.',
      },
      {
        key: 'robotValue',
        label: 'Valor médio do robô',
        prefix: 'R$',
        min: 0,
        tooltip: 'Valor médio do equipamento para a taxa do fabricante. Premissa de R$ 1.300.000.',
      },
    ],
  },
  {
    id: 'estoque',
    title: 'Estoque local de peças',
    intro: 'Investimento no mês 0. Não entra no custo mensal nem no custo por robô/mês.',
    fields: [
      {
        key: 'partsPerRobot',
        label: 'Valor médio de estoque de peças por robô',
        prefix: 'R$',
        min: 0,
        allowEmpty: true,
        wide: true,
        placeholder: 'A preencher',
        tooltip:
          'Valor parado em peças por robô. O investimento inicial é este valor × número de robôs, no mês 0. Em branco conta como zero e continua fora do mensal.',
      },
    ],
  },
  {
    id: 'diarias',
    title: 'Diárias e hospedagem',
    intro: 'Opcional. A diária incide sobre a parcela das visitas que exigem pernoite, para cada pessoa que viaja.',
    fields: [
      {
        key: 'overnightShare',
        label: 'Visitas com pernoite',
        suffix: '%',
        scale: 100,
        min: 0,
        max: 1,
        tooltip: 'Parcela das visitas do ano (preventivas + corretivas) que exigem hospedagem. Default 0%. Premissa.',
      },
      {
        key: 'perDiem',
        label: 'Diária por pessoa',
        prefix: 'R$',
        min: 0,
        tooltip:
          'Hotel e refeições por pessoa por noite. Premissa de R$ 450. A referência do Estado de SP fica entre R$ 471 e R$ 555.',
      },
      {
        key: 'overnightFollow',
        label: 'Pessoas da diária',
        kind: 'check',
        checkLabel: 'Usar o tamanho da equipe',
        wide: true,
        tooltip: 'Ligado: a diária multiplica pelas pessoas que estão de fato na equipe (1 ou 2). Desligado: vale o número do campo ao lado.',
      },
      {
        key: 'peoplePerOvernight',
        label: 'Pessoas por pernoite',
        integer: true,
        min: 0,
        max: 12,
        tooltip: 'Quantas pessoas dormem fora na visita, se o tamanho da equipe não for usado. A diária não inclui coordenador nem gerente.',
      },
    ],
  },
];

const CHART = { w: 720, h: 368, left: 76, right: 40, top: 16, plotBottom: 250, ribbon: 28 };

let state = freshState();
const controls = new Map();
let chartPoints = [];
let chartScale = null;
let chartKey = '';
let probe = null;

function freshState() {
  return { ...DEFAULTS, partsPerRobot: null, correctivesDefaultMigrated: true };
}

function readStored() {
  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  }
  return null;
}

function applyStored(parsed) {
  const alreadyMigrated = parsed.correctivesDefaultMigrated === true;
  const next = freshState();
  for (const key of RETIRED_KEYS) delete parsed[key];
  for (const key of Object.keys(DEFAULTS)) {
    if (key === 'partsPerRobot') {
      if (parsed.partsPerRobot == null) next.partsPerRobot = null;
      else if (typeof parsed.partsPerRobot === 'number' && Number.isFinite(parsed.partsPerRobot)) {
        next.partsPerRobot = parsed.partsPerRobot;
      }
      continue;
    }
    if (typeof DEFAULTS[key] === 'boolean') {
      if (typeof parsed[key] === 'boolean') next[key] = parsed[key];
    } else if (typeof parsed[key] === 'number' && Number.isFinite(parsed[key])) {
      next[key] = parsed[key];
    }
  }
  next.correctivesPerYear = restoreCorrectivesPerYear(next.correctivesPerYear, alreadyMigrated);
  next.correctivesDefaultMigrated = true;
  return next;
}

function persistState(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
}

function loadState() {
  try {
    const parsed = readStored();
    if (!parsed) return freshState();
    const next = applyStored(parsed);
    try {
      persistState(next);
    } catch {
      /* navegador sem armazenamento */
    }
    return next;
  } catch {
    return freshState();
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function fieldByKey(key) {
  for (const section of SECTIONS) {
    const field = section.fields.find((item) => item.key === key);
    if (field) return field;
  }
  return null;
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
  return formatFlex(value * (field.scale || 1), field.digits ?? 2);
}

function fromDisplay(field, raw) {
  if (field.allowEmpty && String(raw).trim() === '') return null;
  const parsed = parseBr(raw);
  if (parsed == null) return undefined;
  return clampField(field, parsed / (field.scale || 1));
}

function renderField(field) {
  const wrap = el('div', field.wide || field.slider ? 'field field-wide' : 'field');
  const head = el('div', 'field-head');
  const label = el('label', null, field.label);
  label.htmlFor = field.kind === 'check' ? field.key : `${field.key}-text`;
  label.id = `lbl-${field.key}`;
  head.append(label);
  const tipBtn = el('button', 'tip-btn');
  tipBtn.type = 'button';
  tipBtn.textContent = 'Ajuda';
  tipBtn.setAttribute('aria-expanded', 'false');
  tipBtn.setAttribute('aria-controls', `tip-${field.key}`);
  const tip = el('p', 'tip');
  tip.id = `tip-${field.key}`;
  tip.hidden = true;
  tip.textContent = field.tooltip;
  tipBtn.addEventListener('click', () => toggleTip(tipBtn, tip));
  head.append(tipBtn);
  wrap.append(head, tip);

  if (field.kind === 'check') {
    const row = el('div', 'check');
    const input = el('input');
    input.type = 'checkbox';
    input.id = field.key;
    if (field.locked) input.disabled = true;
    input.addEventListener('change', () => {
      if (field.key === 'includePleno' || field.key === 'includeSenior') {
        state.autoScale = false;
        state.includeSenior = true;
        state.includePleno = field.key === 'includePleno' ? input.checked : state.includePleno;
        commit();
        return;
      }
      if (field.key === 'autoScale' && !input.checked) {
        state.includeSenior = true;
        state.includePleno = Boolean(controls.get('includePleno')?.check?.checked);
      }
      state[field.key] = input.checked;
      commit();
    });
    row.append(input, el('span', null, field.checkLabel || 'Incluir no custo'));
    wrap.append(row);
    controls.set(field.key, { field, check: input });
    return wrap;
  }

  const control = el('div', 'control');
  let slider = null;
  if (field.slider) {
    slider = el('input');
    slider.type = 'range';
    slider.min = String(field.min);
    slider.max = String(field.max);
    slider.step = String(field.step ?? (field.integer ? 1 : 0.1));
    slider.id = `${field.key}-slider`;
    slider.setAttribute('aria-labelledby', label.id);
    slider.addEventListener('input', () => {
      const raw = Number(slider.value);
      const value = field.integer ? Math.round(raw) : Math.round(raw * 10) / 10;
      state[field.key] = clampField(field, value);
      const text = controls.get(field.key)?.text;
      if (text) text.value = toDisplay(field, state[field.key]);
      slider.setAttribute('aria-valuetext', text?.value ?? slider.value);
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
  text.spellcheck = false;
  text.setAttribute('aria-describedby', tip.id);
  if (field.placeholder) text.placeholder = field.placeholder;
  text.addEventListener('input', () => {
    const value = fromDisplay(field, text.value);
    if (value === undefined) return;
    if (field.key === 'peoplePerOvernight') state.overnightFollow = false;
    state[field.key] = value;
    if (slider && value != null) slider.value = String(value * (field.scale || 1));
    commit();
  });
  text.addEventListener('blur', () => {
    text.value = state[field.key] == null ? '' : toDisplay(field, state[field.key]);
  });
  affix.append(text);
  if (field.suffix) affix.append(el('span', 'affix-label', field.suffix));
  control.append(affix);
  wrap.append(control);
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

function renderForm() {
  const form = document.getElementById('form');
  form.replaceChildren();
  for (const section of SECTIONS) {
    const card = el('section', 'card');
    card.append(el('h2', null, section.title));
    if (section.intro) card.append(el('p', 'intro', section.intro));
    const grid = el('div', 'fields');
    for (const field of section.fields) grid.append(renderField(field));
    card.append(grid);
    if (section.id === 'equipe') {
      const note = el('p', 'mode');
      note.id = 'mode-status';
      card.insertBefore(note, grid);
    }
    if (section.id === 'capacidade') {
      const note = el('p', 'readout');
      note.id = 'capacity-readout';
      card.append(note);
    }
    if (section.id === 'encargos') {
      const note = el('p', 'readout');
      note.id = 'encargos-nota';
      card.append(note);
    }
    if (section.id === 'coordenacao') {
      const note = el('p', 'readout');
      note.id = 'coord-status';
      card.append(note);
    }
    form.append(card);
  }
}

function fillControls() {
  for (const [key, control] of controls) {
    if (control.check) {
      control.check.checked = Boolean(state[key]);
      continue;
    }
    if (document.activeElement !== control.text) {
      control.text.value = state[key] == null ? '' : toDisplay(control.field, state[key]);
    }
    if (control.slider && document.activeElement !== control.slider && state[key] != null) {
      control.slider.value = String(state[key]);
      control.slider.setAttribute('aria-valuetext', toDisplay(control.field, state[key]));
    }
  }
}

function scenario() {
  return calculate({
    ...state,
    partsPerRobot: state.partsPerRobot ?? 0,
    partsUnfilled: state.partsPerRobot == null,
  });
}

function renderKpis(result) {
  const host = document.getElementById('kpis');
  host.replaceChildren();
  const cards = [
    ['monthly-total', 'Custo mensal', formatBRL(result.monthlyRounded), true],
    ['annual-total', 'Custo anual', formatBRL(result.annualRounded), false],
    ['per-robot', 'Custo por robô/mês', formatBRL(result.perRobotRounded), false],
    ['teams', 'Equipes', formatFlex(result.teams), false],
    ['coordinators', 'Coordenadores', formatFlex(result.coordinators), false],
    ['robots-per-team', 'Robôs por equipe', formatFlex(result.robotsPerTeam), false],
    ['composition', 'Composição', result.compositionLabel, false],
  ];
  for (const [id, label, value, main] of cards) {
    const card = el('article', main ? 'kpi kpi-main' : 'kpi');
    card.append(el('p', 'kpi-label', label), el('p', 'kpi-value', value));
    card.dataset.testid = id;
    if (main) card.setAttribute('aria-live', 'polite');
    host.append(card);
  }
  document.getElementById('dock-monthly').textContent = formatBRL(result.monthlyRounded);
  document.getElementById('dock-robot').textContent = formatBRL(result.perRobotRounded);
  const crew = document.getElementById('dock-crew');
  if (crew) crew.textContent = headcountLabel(result);
}

function renderParts(result) {
  const card = document.getElementById('parts-card');
  card.replaceChildren();
  card.append(el('p', 'kpi-label', 'Investimento inicial em peças'));
  const value = el('p', 'kpi-value', formatBRL(result.partsInvestment));
  value.dataset.testid = 'parts-investment';
  card.append(value);
  card.append(
    el(
      'p',
      'fine',
      result.partsUnfilled
        ? 'Campo em branco: conta como R$ 0,00 no mês 0 e fica fora do custo mensal.'
        : 'Mês 0. Fora do custo mensal e do custo por robô/mês.',
    ),
  );
}

function renderBreakdown(result) {
  const table = document.getElementById('breakdown');
  table.replaceChildren();
  const caption = el('caption', null, 'Composição do custo mensal');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Linha', 'Mensal', 'Anual']) {
    headRow.append(el('th', label === 'Linha' ? null : 'num', label));
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  const rows = [
    ['Pessoas', result.lines.people],
    ['Benefícios', result.lines.benefits],
    ['Carro', result.lines.car],
    ['Coordenação', result.lines.coordination],
    ['Gerência', result.lines.management],
    ['Turnover', result.lines.turnover],
    ['Fabricante', result.lines.manufacturer],
    ['Diárias', result.lines.perDiem],
  ];
  for (const [label, line] of rows) {
    const row = document.createElement('tr');
    row.append(el('th', null, label));
    row.append(el('td', 'num', formatBRL(line.monthly)));
    row.append(el('td', 'num', formatBRL(line.annual)));
    body.append(row);
  }
  const foot = document.createElement('tfoot');
  const total = document.createElement('tr');
  total.append(el('th', null, 'Total'));
  total.append(el('td', 'num', formatBRL(result.monthlyRounded)));
  total.append(el('td', 'num', formatBRL(result.annualRounded)));
  foot.append(total);
  table.append(caption, head, body, foot);
}

function renderMemory(result) {
  const host = document.getElementById('memoria');
  const blocks = explain(result);
  host.replaceChildren();
  host.append(el('h3', null, 'Memória de cálculo'));
  for (const block of blocks) {
    const section = el('section', 'memory-block');
    section.append(el('h4', null, block.title));
    const list = document.createElement('ol');
    for (const line of block.lines) list.append(el('li', null, line));
    section.append(list);
    host.append(section);
  }
}

function plural(count, one, many) {
  return `${formatFlex(count)} ${count === 1 ? one : many}`;
}

function describePoint(point, current) {
  const where = current ? 'Cenário atual' : 'No gráfico';
  const crew = point.peopleOnTeam === 1 ? 'só sênior' : 'sênior + pleno';
  const managers = point.managers > 0 ? ` · ${plural(point.managers, 'gerente', 'gerentes')}` : '';
  return `${where}: ${formatFlex(point.robots)} robôs · ${formatBRL(point.perRobotRounded)} por robô/mês · ${plural(point.teams, 'equipe', 'equipes')} (${crew}) · ${plural(point.coordinators, 'coordenador', 'coordenadores')}${managers}.`;
}

function chartInputKey(input) {
  const premises = { ...input };
  delete premises.robots;
  return JSON.stringify(premises);
}

function pointAt(robots) {
  if (!chartPoints.length) return null;
  const from = chartPoints[0].robots;
  const index = Math.min(chartPoints.length - 1, Math.max(0, robots - from));
  return chartPoints[index];
}

function axisTicks(from, to) {
  if (to - from <= 200) return [from, 50, 100, 150, to].filter((value, index, all) => value >= from && value <= to && all.indexOf(value) === index);
  const ticks = [from];
  for (let value = 250; value < to; value += 250) ticks.push(value);
  ticks.push(to);
  return ticks;
}

function renderChart(result) {
  const input = scenarioInput();
  const key = chartInputKey(input);
  if (key !== chartKey || chartPoints.length !== FLEET_MAX) {
    chartPoints = costSeries(input, 1, FLEET_MAX);
    chartKey = key;
    drawChart();
  }
  placeCurrent(result);
  setProbe(probe);
}

function drawChart() {
  const rows = plateaus(chartPoints);
  const values = chartPoints.map((point) => point.perRobotRounded);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV || 1;
  const yMin = Math.max(0, minV - span * 0.08);
  const yMax = maxV + span * 0.08;
  const from = chartPoints[0].robots;
  const to = chartPoints[chartPoints.length - 1].robots;
  const plotW = CHART.w - CHART.left - CHART.right;
  const plotH = CHART.plotBottom - CHART.top;
  const xSpan = Math.max(1, to - from);
  const xOf = (robots) => CHART.left + ((robots - from) / xSpan) * plotW;
  const yOf = (value) => CHART.top + (1 - (value - yMin) / (yMax - yMin)) * plotH;
  chartScale = { xOf, yOf, yMin, yMax, from, to };

  const svg = svgEl('svg', {
    viewBox: `0 0 ${CHART.w} ${CHART.h}`,
    role: 'img',
    'aria-labelledby': 'chart-title chart-readout',
  });
  svg.append(svgEl('rect', { x: 0, y: 0, width: CHART.w, height: CHART.h, fill: '#fffdf8' }));

  for (let tick = 0; tick < 4; tick += 1) {
    const value = yMin + ((yMax - yMin) * tick) / 3;
    const y = yOf(value);
    svg.append(
      svgEl('line', {
        x1: CHART.left,
        x2: CHART.w - CHART.right,
        y1: y,
        y2: y,
        stroke: '#e6dfd4',
      }),
    );
    const label = svgEl('text', { x: CHART.left - 8, y: y + 4, 'text-anchor': 'end', class: 'axis' });
    label.textContent = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
    svg.append(label);
  }

  for (const robot of axisTicks(from, to)) {
    const label = svgEl('text', {
      x: xOf(robot),
      y: CHART.plotBottom + CHART.ribbon + 22,
      'text-anchor': robot === to ? 'end' : 'middle',
      class: 'axis',
    });
    label.textContent = formatFlex(robot);
    svg.append(label);
  }

  const ribbonY = CHART.plotBottom + 8;
  const robotWidth = plotW / xSpan;
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    const structural =
      !previous ||
      previous.peopleOnTeam !== row.peopleOnTeam ||
      previous.coordinators !== row.coordinators ||
      previous.managers !== row.managers;
    const x = xOf(row.from);
    const width = Math.max(robotWidth, xOf(row.to) - x + robotWidth);
    svg.append(
      svgEl('rect', {
        x,
        y: ribbonY,
        width,
        height: 18,
        fill: index % 2 === 0 ? '#d7ebe3' : '#8fbfb0',
        'data-step': `${row.from}-${row.to}`,
      }),
    );
    if (width >= 14) {
      const label = svgEl('text', {
        x: x + width / 2,
        y: ribbonY + 13,
        'text-anchor': 'middle',
        class: 'ribbon',
      });
      label.textContent = ribbonLabel(row, width);
      svg.append(label);
    }
    if (row.from > from) {
      svg.append(
        svgEl('line', {
          x1: x,
          x2: x,
          y1: CHART.top,
          y2: ribbonY + 18,
          stroke: '#8a5a12',
          'stroke-dasharray': structural ? '3 3' : '2 4',
          'stroke-opacity': structural ? 0.9 : 0.28,
        }),
      );
    }
  });

  const area = chartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${xOf(point.robots).toFixed(2)},${yOf(point.perRobotRounded).toFixed(2)}`)
    .join(' ');
  const baseline = chartPoints[chartPoints.length - 1];
  svg.append(
    svgEl('path', {
      d: `${area} L${xOf(baseline.robots).toFixed(2)},${yOf(yMin).toFixed(2)} L${xOf(1).toFixed(2)},${yOf(yMin).toFixed(2)} Z`,
      fill: 'rgba(15,92,76,0.12)',
    }),
  );
  const line = svgEl('path', {
    d: area,
    fill: 'none',
    stroke: '#0f5c4c',
    'stroke-width': 2.4,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
  });
  line.dataset.testid = 'cost-line';
  svg.append(line);

  const current = svgEl('circle', {
    cx: 0,
    cy: 0,
    r: 5,
    fill: '#0f5c4c',
    stroke: '#fffdf8',
    'stroke-width': 2,
  });
  current.id = 'chart-current';
  svg.append(current);
  const guide = svgEl('line', {
    x1: 0,
    x2: 0,
    y1: CHART.top,
    y2: ribbonY + 18,
    stroke: '#1a2421',
    'stroke-width': 1,
    visibility: 'hidden',
  });
  guide.id = 'chart-guide';
  const probeDot = svgEl('circle', { cx: 0, cy: 0, r: 4, fill: '#8a5a12', visibility: 'hidden' });
  probeDot.id = 'chart-probe';
  svg.append(guide, probeDot);

  const host = document.getElementById('chart');
  host.replaceChildren(svg);
  svg.addEventListener('pointermove', onChartPointer);
  svg.addEventListener('pointerdown', onChartPointer);
  svg.addEventListener('pointerleave', () => setProbe(null));

  const table = document.getElementById('plateaus');
  table.replaceChildren();
  table.append(el('caption', null, 'Degraus de equipe, composição, coordenação e gerência'));
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const label of ['Robôs', 'Equipes', 'Composição', 'Coordenadores', 'Gerentes', 'R$/robô no início', 'R$/robô no fim']) {
    hr.append(el('th', label === 'Robôs' || label === 'Composição' ? null : 'num', label));
  }
  head.append(hr);
  const body = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.append(el('th', null, row.from === row.to ? formatFlex(row.from) : `${formatFlex(row.from)}–${formatFlex(row.to)}`));
    tr.append(el('td', 'num', formatFlex(row.teams)));
    tr.append(el('td', null, row.peopleOnTeam === 1 ? 'Sênior' : 'Sênior + Pleno'));
    tr.append(el('td', 'num', formatFlex(row.coordinators)));
    tr.append(el('td', 'num', formatFlex(row.managers)));
    tr.append(el('td', 'num', formatBRL(row.perRobotAtStart)));
    tr.append(el('td', 'num', formatBRL(row.perRobotAtEnd)));
    body.append(tr);
  }
  table.append(head, body);
}

function ribbonLabel(row, width) {
  if (width < 32) return formatFlex(row.teams);
  if (row.peopleOnTeam === 1) return `${formatFlex(row.teams)}×sênior`;
  if (row.managers > 0) return `${formatFlex(row.teams)} eq · ${formatFlex(row.managers)} g`;
  if (row.coordinators > 0) return `${formatFlex(row.teams)} eq · ${formatFlex(row.coordinators)} c`;
  return `${formatFlex(row.teams)} eq`;
}

function placeCurrent(result) {
  const node = document.getElementById('chart-current');
  const point = pointAt(result.robots);
  if (!node || !point || !chartScale) return;
  node.setAttribute('cx', String(chartScale.xOf(point.robots)));
  node.setAttribute('cy', String(chartScale.yOf(point.perRobotRounded)));
}

function svgEl(name, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function scenarioInput() {
  return {
    ...state,
    partsPerRobot: state.partsPerRobot ?? 0,
    partsUnfilled: state.partsPerRobot == null,
  };
}

function onChartPointer(event) {
  if (!chartScale) return;
  const svg = event.currentTarget;
  const rect = svg.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * CHART.w;
  if (x < CHART.left || x > CHART.w - CHART.right) return;
  const plotW = CHART.w - CHART.left - CHART.right;
  const robots = Math.round(chartScale.from + ((x - CHART.left) / plotW) * (chartScale.to - chartScale.from));
  setProbe(Math.min(chartScale.to, Math.max(chartScale.from, robots)));
}

function setProbe(robots) {
  probe = robots;
  const guide = document.getElementById('chart-guide');
  const dot = document.getElementById('chart-probe');
  const readout = document.getElementById('chart-readout');
  const point = pointAt(robots || state.robots || 1);
  if (!point || !readout) return;
  readout.textContent = describePoint(point, !robots || point.robots === state.robots);
  if (!guide || !dot || !chartScale) return;
  if (!robots) {
    guide.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
    return;
  }
  const x = chartScale.xOf(point.robots);
  const y = chartScale.yOf(point.perRobotRounded);
  guide.setAttribute('x1', String(x));
  guide.setAttribute('x2', String(x));
  guide.setAttribute('visibility', 'visible');
  dot.setAttribute('cx', String(x));
  dot.setAttribute('cy', String(y));
  dot.setAttribute('visibility', 'visible');
}

function renderNotes(result) {
  const capacity = document.getElementById('capacity-readout');
  if (capacity) {
    const absence = result.absenteeismOn ? result.absenteeismRate : 0;
    const vacation = result.vacationCoverOn ? result.vacationCoverRate : 0;
    capacity.textContent = `Esta equipe (${result.compositionLabel}) faz ${formatFlex(result.visitsPerWeek, 1)} × (${formatFlex(result.peopleOnTeam)} ÷ 2) × ${formatFlex(result.weeksPerYear)} × (1 − ${formatFlex(absence)}%) × (1 − ${formatFlex(vacation)}%) = ${formatFlex(result.visitsPerTeamYear)} visitas por ano. No mês, a referência bruta é ${formatFlex(result.visitsPerTeamMonth)}, sem essa disponibilidade.`;
  }
  const charges = document.getElementById('encargos-nota');
  if (charges) {
    charges.textContent = chargeNote(result);
  }
  const coord = document.getElementById('coord-status');
  if (coord) {
    coord.textContent =
      result.teams <= 1
        ? `Com ${formatFlex(result.teams)} equipe este custo fica zerado.`
        : `${plural(result.teams, 'equipe', 'equipes')} pedem ${plural(result.coordinators, 'coordenador', 'coordenadores')} (1 a cada ${formatFlex(result.teamsPerCoordinator)}).`;
  }
}

function syncStaffControls(result) {
  const senior = controls.get('includeSenior')?.check;
  const pleno = controls.get('includePleno')?.check;
  const auto = controls.get('autoScale')?.check;
  const follow = controls.get('overnightFollow')?.check;
  const mode = document.getElementById('mode-status');
  if (senior) {
    senior.checked = true;
    senior.disabled = true;
  }
  if (pleno && document.activeElement !== pleno) {
    pleno.checked = state.autoScale ? result.pleno : Boolean(state.includePleno);
  }
  if (auto && document.activeElement !== auto) auto.checked = Boolean(state.autoScale);
  if (follow && document.activeElement !== follow) follow.checked = Boolean(state.overnightFollow);
  const notice = controls.get('severanceRate');
  if (notice?.text) {
    const off = !state.severanceOn;
    notice.text.disabled = off;
    notice.wrap?.classList.toggle('is-off', off);
  }
  for (const [toggle, field] of [
    ['absenteeismOn', 'absenteeismRate'],
    ['vacationCoverOn', 'vacationCoverRate'],
  ]) {
    const control = controls.get(field);
    if (!control?.text) continue;
    const off = !state[toggle];
    control.text.disabled = off;
    control.wrap?.classList.toggle('is-off', off);
  }
  const solo = controls.get('soloMaxRobots');
  if (solo?.text) {
    const off = !state.autoScale;
    solo.text.disabled = off;
    solo.wrap?.classList.toggle('is-off', off);
  }
  if (mode) {
    mode.classList.toggle('is-manual', !state.autoScale);
    const summary = staffSummary(result);
    mode.replaceChildren(el('span', 'mode-result', summary.resultLine), el('span', 'mode-reason', summary.reasonLine));
  }
  const overnight = controls.get('peoplePerOvernight');
  if (overnight?.text && state.overnightFollow && document.activeElement !== overnight.text) {
    overnight.text.value = toDisplay(overnight.field, result.peopleOnTeam);
  }
}

function renderOutputs() {
  const result = scenario();
  syncStaffControls(result);
  renderKpis(result);
  renderParts(result);
  renderBreakdown(result);
  renderMemory(result);
  renderNotes(result);
  renderChart(result);
  const stamp = document.getElementById('print-date');
  if (stamp) {
    stamp.textContent = `Memória de cálculo · ${new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}.`;
  }
}

function commit() {
  renderOutputs();
  try {
    persistState(state);
  } catch {
    /* navegador sem armazenamento */
  }
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
    probe = null;
    fillControls();
    try {
      localStorage.removeItem(STORAGE_KEY);
      for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
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
  const field = fieldByKey('visitsPerWeek');
  if (field) field.digits = 1;
}

function init() {
  state = loadState();
  renderForm();
  for (const [key, control] of controls) {
    if (control.field.kind === 'check' || state[key] == null) continue;
    state[key] = clampField(control.field, state[key]);
  }
  bindChrome();
  fillControls();
  renderOutputs();
  const boot = document.getElementById('boot');
  if (boot) boot.remove();
}

init();
