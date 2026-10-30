/**
 * ROI MES/EBR (NEO), spec v1.0.
 * Bottom-up: cronometra o papel campo a campo e compara com o EBR.
 * Os outros ganhos somam por fora. Sem preço da T2/NEO.
 */

export const DISCLAIMER =
  'Estimativa baseada nos dados informados. Não substitui a avaliação do seu projeto nem a validação do sistema (CSV).';

export const SCENARIOS = {
  conservador: { id: 'conservador', label: 'Conservador', factor: 0.5, rerr: 'rerr_c' },
  provavel: { id: 'provavel', label: 'Provável', factor: 0.75, rerr: 'rerr_p' },
  otimista: { id: 'otimista', label: 'Otimista', factor: 1, rerr: 'rerr_o' },
};

export const TERMS = {
  pt: {
    batchRelease: 'aprovação do lote',
    ebr: 'registro de lote eletrônico (EBR)',
    changeControl: 'controle de mudanças',
    operation: 'entrada em operação',
    sop: 'POP',
  },
  es: {
    batchRelease: 'aprobación del lote',
    ebr: 'registro electrónico de lote (EBR)',
    changeControl: 'control de cambios',
    operation: 'entrada en operación',
    sop: 'POE',
  },
  en: {
    batchRelease: 'batch release',
    ebr: 'electronic batch record (EBR)',
    changeControl: 'change control',
    operation: 'start of operation',
    sop: 'SOP',
  },
};

const EXAMPLE = {
  lotes: 600,
  cGQ: 120,
  cOp: 60,
  captura: 50,
  taxa: 14,
  F: 500,
  sf: 15,
  sp: 10,
  sq: 15,
  err: 1,
  mc: 5,
  auto: 40,
  se: 8,
  exc: 5,
  sxp: 30,
  sxq: 60,
  fin: 10,
  rerr_c: 75,
  rerr_p: 90,
  rerr_o: 100,
  b1vl: 200000,
  b1d: 3,
  b1cc: 14,
  b3d: 15,
  b3h: 12,
  b3bd: 10,
  b3bh: 16,
  b3br: 25,
  b4n: 4,
  b4v: 200000,
  b4e: 50,
  b5l: 200,
  b5m: 10,
  b5r: 80,
  b5o: 6,
  b5c: 15000,
  lbF: 0,
  lbsf: 15,
  lbsq: 10,
  lbauto: 60,
  b6p: 120,
  b6cp: 0.6,
  b6a: 24000,
  b6b: 50,
  b6hb: 2,
  b6e: 6000,
  b9l: 60,
  b9x: 4,
  b9hh: 8,
  b9hc: 1,
  capm: 40,
  capr: 60,
  caph: 8,
  capmg: 50000,
  capd: 33,
  c1: 900000,
  c2: 240000,
  c3: 6,
};

export const CASO_REAL_PRESET = {
  lotes: 2500,
  cGQ: 130,
  cOp: 65,
  captura: 50,
  taxa: 14,
  F: 500,
  sf: 15,
  sp: 10,
  sq: 15,
  err: 2,
  mc: 5,
  auto: 30,
  se: 8,
  exc: 3,
  sxp: 30,
  sxq: 60,
  fin: 10,
  rerr_c: 75,
  rerr_p: 90,
  rerr_o: 100,
  b1vl: 250000,
  b1d: 3,
  b1cc: 14,
  b3d: 20,
  b3h: 10,
  b3bd: 0,
  b3bh: 0,
  b3br: 25,
  b4n: 6,
  b4v: 250000,
  b4e: 40,
  b5l: 600,
  b5m: 10,
  b5r: 80,
  b5o: 10,
  b5c: 15000,
  lbF: 0,
  lbsf: 15,
  lbsq: 10,
  lbauto: 60,
  b6p: 150,
  b6cp: 0.6,
  b6a: 120000,
  b6b: 150,
  b6hb: 2,
  b6e: 20000,
  b9l: 0,
  b9x: 0,
  b9hh: 0,
  b9hc: 0,
  capm: 0,
  capr: 60,
  caph: 8,
  capmg: 0,
  capd: 33,
  c1: 2000000,
  c2: 400000,
  c3: 6,
};

export const FIELD_IDS = Object.keys(EXAMPLE);

export function exampleInput() {
  return { ...EXAMPLE, capOn: false, scenario: 'provavel' };
}

export function emptyInput() {
  const blank = {};
  for (const id of FIELD_IDS) blank[id] = 0;
  blank.captura = 50;
  blank.taxa = 14;
  blank.capOn = false;
  blank.scenario = 'provavel';
  return blank;
}

export function parseDecimal(text) {
  if (text == null) return 0;
  let raw = String(text).trim().replace(/\s/g, '').replace('%', '').replace('R$', '');
  if (!raw || raw === '-' || raw === ',' || raw === '.') return 0;
  if (raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.');
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function n(value) {
  const num = typeof value === 'number' ? value : parseDecimal(value);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function pct(value) {
  return Math.min(1, n(value) / 100);
}

function hoursFromSeconds(seconds, lotes) {
  return (seconds * n(lotes)) / 3600;
}

export function recordSeconds(input, rerrPct) {
  const F = n(input.F);
  const t = {
    op: F * n(input.sf),
    pr: F * n(input.sp),
    gq: F * n(input.sq),
    co: F * pct(input.err) * n(input.mc) * 60,
  };
  const e = {
    op: F * (1 - pct(input.auto)) * n(input.se),
    pr: F * pct(input.exc) * n(input.sxp),
    gq: F * pct(input.exc) * n(input.sxq) + n(input.fin) * 60,
    co: t.co * (1 - pct(rerrPct)),
  };
  return { t, e };
}

export function recordHours(input, rerrPct) {
  const { t, e } = recordSeconds(input, rerrPct);
  const L = n(input.lotes);
  const T = {};
  const E = {};
  for (const key of ['op', 'pr', 'gq', 'co']) {
    T[key] = hoursFromSeconds(t[key], L);
    E[key] = hoursFromSeconds(e[key], L);
  }
  const sum = (row) => row.op + row.pr + row.gq + row.co;
  return { T, E, totalT: sum(T), totalE: sum(E), seconds: { t, e } };
}

function scenarioOf(input) {
  return SCENARIOS[input.scenario] || SCENARIOS.provavel;
}

function block(id, label, hours, hv, cash, formula) {
  return { id, label, hours, hv, cash, gain: 0, formula };
}

export function evaluate(input = {}) {
  const data = { ...emptyInput(), ...input };
  const scenario = scenarioOf(data);
  const S = scenario.factor;
  const rerr = n(data[scenario.rerr]);
  const L = n(data.lotes);
  const cGQ = n(data.cGQ);
  const cOp = n(data.cOp);
  const captura = pct(data.captura);
  const record = recordHours(data, rerr);
  const save = {
    op: Math.max(0, record.T.op - record.E.op) * S,
    pr: Math.max(0, record.T.pr - record.E.pr) * S,
    gq: Math.max(0, record.T.gq - record.E.gq) * S,
    co: Math.max(0, record.T.co - record.E.co),
  };
  const regHours = save.op + save.pr + save.gq + save.co;
  const regHvOp = save.op * cOp;
  const regHvReview = (save.pr + save.gq + save.co) * cGQ;

  const b3brUsed = Math.min(n(data.b3br), 50);
  const b1Cash = n(data.b1vl) * L * n(data.b1d) / 365 * pct(data.b1cc) * S;
  const b3Hours = n(data.b3d) * 12 * n(data.b3h) * pct(rerr);
  const b3bHours = n(data.b3bd) * 12 * n(data.b3bh) * pct(b3brUsed);
  const b4Cash = n(data.b4n) * n(data.b4v) * pct(data.b4e) * S;
  const b5Hours = n(data.b5l) * 12 * n(data.b5m) / 60 * pct(data.b5r) * S;
  const b5Cash = n(data.b5o) * n(data.b5c) * pct(data.b5r) * S;
  const lbHours = n(data.lbF) * L * (n(data.lbsf) + n(data.lbsq)) / 3600 * pct(data.lbauto) * S;
  const lbHv = n(data.lbF) * L * (n(data.lbsf) * cOp + n(data.lbsq) * cGQ) / 3600 * pct(data.lbauto) * S;
  const lbHoursProd = n(data.lbF) * L * n(data.lbsf) / 3600 * pct(data.lbauto) * S;
  const lbHoursQa = n(data.lbF) * L * n(data.lbsq) / 3600 * pct(data.lbauto) * S;
  const paperGain = (n(data.b6p) * L * n(data.b6cp) + n(data.b6a)) * S;
  const b6Cash = paperGain - n(data.b6e);
  const b6Hours = n(data.b6b) * n(data.b6hb) * S;
  const b9Hours = (n(data.b9l) * 12 + n(data.b9x) * 12 * Math.max(0, n(data.b9hh) - n(data.b9hc))) * S;
  const caph = n(data.caph);
  const capCash = data.capOn && caph > 0
    ? ((n(data.capm) * pct(data.capr) * L) / 60 / caph) * n(data.capmg) * pct(data.capd) * S
    : 0;

  const blocks = [
    block('reg', 'Registro de lote', regHours, regHvOp + regHvReview, 0, [
      `Hoje, preenchimento = ${fmt(data.F)} campos × ${fmt(data.sf)} s = ${fmt(record.seconds.t.op, 0)} s/ordem → ${fmt(record.T.op, 1)} h/ano`,
      `EBR, preenchimento = ${fmt(data.F)} × (1 − ${fmt(data.auto)}%) × ${fmt(data.se)} s = ${fmt(record.seconds.e.op, 0)} s/ordem → ${fmt(record.E.op, 1)} h/ano`,
      `Economia do operador = max(0, ${fmt(record.T.op, 1)} − ${fmt(record.E.op, 1)}) × ${fmt(S * 100, 0)}% = ${fmt(save.op, 1)} h × ${fmtMoney(cOp)}`,
      `Revisão e correção: produção ${fmt(save.pr, 1)} h + GQ ${fmt(save.gq, 1)} h, ambas com o fator do cenário, e correções ${fmt(save.co, 1)} h sem esse fator (a redução de erros já é do cenário, ${fmt(rerr)}%).`,
      `Valor das horas = ${fmtMoney(regHvOp + regHvReview)}. Caixa considerado = esse valor × ${fmt(data.captura)}% de captura.`,
    ]),
    block('b1', 'Capital de giro', 0, 0, b1Cash, [
      `Caixa = ${fmtMoney(data.b1vl)} × ${fmt(L, 0)} ordens × ${fmt(data.b1d)} dias ÷ 365 × ${fmt(data.b1cc)}% × ${fmt(S * 100, 0)}% = ${fmtMoney(b1Cash)}`,
    ]),
    block('b3', 'Desvios de documentação', b3Hours, b3Hours * cGQ, 0, [
      `Horas = ${fmt(data.b3d)} desvios/mês × 12 × ${fmt(data.b3h)} h × ${fmt(rerr)}% = ${fmt(b3Hours, 1)} h`,
      `Não multiplica pelo fator global: a redução já é a do cenário. Valor = horas × ${fmtMoney(cGQ)}.`,
    ]),
    block('b3b', 'Desvios de processo', b3bHours, b3bHours * cGQ, 0, [
      `Horas = ${fmt(data.b3bd)} × 12 × ${fmt(data.b3bh)} h × ${fmt(b3brUsed)}% = ${fmt(b3bHours, 1)} h × fator ${fmt(S * 100, 0)}%`,
      n(data.b3br) > 50 ? 'O valor digitado passou de 50%. A conta usa 50%, o teto sem referência publicada.' : 'Redução limitada a 50%.',
    ]),
    block('b4', 'Lotes perdidos', 0, 0, b4Cash, [
      `Caixa = ${fmt(data.b4n)} × ${fmtMoney(data.b4v)} × ${fmt(data.b4e)}% × ${fmt(S * 100, 0)}% = ${fmtMoney(b4Cash)}`,
    ]),
    block('b5', 'Limpeza', b5Hours, b5Hours * cOp, b5Cash, [
      `Horas = ${fmt(data.b5l)} limpezas/mês × 12 × ${fmt(data.b5m)} min ÷ 60 × ${fmt(data.b5r)}% × ${fmt(S * 100, 0)}% = ${fmt(b5Hours, 1)} h`,
      `Ocorrências = ${fmt(data.b5o)} × ${fmtMoney(data.b5c)} × ${fmt(data.b5r)}% × ${fmt(S * 100, 0)}% = ${fmtMoney(b5Cash)}`,
    ]),
    block('lb', 'Logbooks', lbHours, lbHv, 0, [
      `Horas = ${fmt(data.lbF)} campos × ${fmt(L, 0)} × (${fmt(data.lbsf)} + ${fmt(data.lbsq)}) s ÷ 3.600 × ${fmt(data.lbauto)}% × ${fmt(S * 100, 0)}% = ${fmt(lbHours, 1)} h`,
      `Valor = campos × ordens × (segundos do operador × custo do operador + segundos da revisão × custo de quem revisa) ÷ 3.600 × captura do sistema × fator = ${fmtMoney(lbHv)}`,
    ]),
    block('b6', 'Papel e arquivo', b6Hours, b6Hours * cGQ, b6Cash, [
      `Impressão e arquivo = (${fmt(data.b6p)} páginas × ${fmt(L, 0)} × ${fmtMoney(data.b6cp)} + ${fmtMoney(data.b6a)}) × ${fmt(S * 100, 0)}% = ${fmtMoney(paperGain)}`,
      `Registros eletrônicos = ${fmtMoney(data.b6e)}, sem o fator do cenário.`,
      `Caixa = ${fmtMoney(paperGain)} − ${fmtMoney(data.b6e)} = ${fmtMoney(b6Cash)}`,
      `Buscas = ${fmt(data.b6b)} × ${fmt(data.b6hb)} h × ${fmt(S * 100, 0)}% = ${fmt(b6Hours, 1)} h`,
    ]),
    block('b9', 'Monitoramento ambiental', b9Hours, b9Hours * cGQ, 0, [
      `Horas = (${fmt(data.b9l)} h/mês × 12 + ${fmt(data.b9x)} × 12 × max(0, ${fmt(data.b9hh)} − ${fmt(data.b9hc)})) × ${fmt(S * 100, 0)}% = ${fmt(b9Hours, 1)} h`,
    ]),
    block('cap', 'Capacidade no gargalo', 0, 0, capCash, [
      data.capOn
        ? `Caixa = (${fmt(data.capm)} min × ${fmt(data.capr)}% × ${fmt(L, 0)} ÷ 60) ÷ ${fmt(data.caph)} h × ${fmtMoney(data.capmg)} × ${fmt(data.capd)}% × ${fmt(S * 100, 0)}% = ${fmtMoney(capCash)}`
        : 'Toggle desligado: este bloco vale zero, mesmo com os campos preenchidos.',
    ]),
  ];

  const H = blocks.reduce((sum, item) => sum + item.hours, 0);
  const HV = blocks.reduce((sum, item) => sum + item.hv, 0);
  const C = blocks.reduce((sum, item) => sum + item.cash, 0);
  const benefit = C + HV * captura;
  for (const item of blocks) item.gain = item.cash + item.hv * captura;

  /*
   * Divisão por área (só exibição; H, HV e o benefício não mudam).
   * Produção: preenchimento (cOp), revisão da produção (cGQ, como na spec),
   * limpeza (cOp) e preenchimento de logbook (cOp).
   * Garantia da Qualidade: revisão da GQ, correções, desvios, buscas de
   * registros, monitoramento ambiental (todos cGQ) e revisão de logbook (cGQ).
   */
  const areaItem = (label, hours, cost) => ({ label, hours, cost, hv: hours * cost });
  const prodItems = [
    areaItem('Preenchimento do registro', save.op, cOp),
    areaItem('Revisão da produção', save.pr, cGQ),
    areaItem('Limpeza', b5Hours, cOp),
    areaItem('Logbooks, preenchimento', lbHoursProd, cOp),
  ];
  const qaItems = [
    areaItem('Revisão da GQ', save.gq, cGQ),
    areaItem('Correções', save.co, cGQ),
    areaItem('Desvios de documentação', b3Hours, cGQ),
    areaItem('Desvios de processo', b3bHours, cGQ),
    areaItem('Buscas de registros', b6Hours, cGQ),
    areaItem('Monitoramento ambiental', b9Hours, cGQ),
    areaItem('Logbooks, revisão', lbHoursQa, cGQ),
  ];
  const areaOf = (id, label, items) => {
    const hours = items.reduce((sum, item) => sum + item.hours, 0);
    const hv = items.reduce((sum, item) => sum + item.hv, 0);
    return {
      id,
      label,
      items,
      hours,
      hv,
      people: hours / 1800,
      savingHours: hours * captura,
      savingPeople: (hours * captura) / 1800,
      savingValue: hv * captura,
      capacityHours: hours * (1 - captura),
      capacityPeople: (hours * (1 - captura)) / 1800,
    };
  };
  const areas = {
    prod: areaOf('prod', 'Produção', prodItems),
    qa: areaOf('qa', 'Garantia da Qualidade', qaItems),
  };

  const timeline = buildTimeline(benefit, n(data.c1), n(data.c2), n(data.c3), pct(data.taxa));
  const lossesNow = n(data.b4n) * n(data.b4v);
  const equivalent = n(data.c1) / 5 + n(data.c2);
  const breakeven = lossesNow > 0 ? equivalent / lossesNow : null;
  const gqMinutes = (n(data.F) * n(data.sq)) / 60;
  const orderMinutes = {
    today: L > 0 ? (record.totalT * 60) / L : (record.seconds.t.op + record.seconds.t.pr + record.seconds.t.gq + record.seconds.t.co) / 60,
    ebr: L > 0 ? (record.totalE * 60) / L : (record.seconds.e.op + record.seconds.e.pr + record.seconds.e.gq + record.seconds.e.co) / 60,
    gqToday: L > 0 ? (record.T.gq * 60) / L : record.seconds.t.gq / 60,
    gqEbr: L > 0 ? (record.E.gq * 60) / L : record.seconds.e.gq / 60,
  };

  return {
    scenario: scenario.id,
    factor: S,
    rerr,
    record,
    save,
    blocks,
    areas,
    H,
    HV,
    C,
    benefit,
    captura,
    timeline,
    lossesNow,
    breakeven,
    gqMinutes,
    gqAlert: gqMinutes > 0 && (gqMinutes < 60 || gqMinutes > 240),
    processAlert: n(data.b3br) > 50,
    logbookNote: n(data.lbF) > 0 && n(data.b5l) > 0,
    orderMinutes,
    people: (record.totalT - record.totalE) / 1800,
    investment: { c1: n(data.c1), c2: n(data.c2), c3: n(data.c3) },
    blankFinance: n(data.c1) === 0 && n(data.c2) === 0,
    disclaimer: DISCLAIMER,
  };
}

function buildTimeline(annual, c1, c2, c3, rate) {
  const months = [];
  let accumulated = -c1;
  let npv = -c1;
  const monthlyRate = (1 + rate) ** (1 / 12) - 1;
  let payback = null;
  let benefit3 = 0;
  let benefit5 = 0;
  let cost3 = c1;
  let cost5 = c1;
  for (let month = 1; month <= 60; month += 1) {
    const k = month - c3;
    const factor = k <= 1 ? 0 : k === 2 ? 0.5 : 1;
    const benefit = (annual / 12) * factor;
    const cost = c2 / 12;
    const flow = benefit - cost;
    accumulated += flow;
    npv += flow / (1 + monthlyRate) ** month;
    if (payback == null && accumulated >= -0.005) payback = month;
    if (month <= 36) {
      benefit3 += benefit;
      cost3 += cost;
    }
    benefit5 += benefit;
    cost5 += cost;
    months.push({ month, factor, benefit, cost, flow, accumulated });
  }
  const roi = (benefits, costs) => (c1 === 0 && c2 === 0 ? null : (benefits - costs) / costs);
  return {
    months,
    payback: c1 === 0 && c2 === 0 ? null : payback,
    npv5: npv,
    roi3: roi(benefit3, cost3),
    roi5: roi(benefit5, cost5),
  };
}

function fmt(value, digits = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function fmtMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

export function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatBRL(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatCompactBRL(value) {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}R$ ${formatNumber(abs / 1_000_000, 1)} mi`;
  if (abs >= 1_000) return `${sign}R$ ${formatNumber(abs / 1_000, abs >= 10_000 ? 0 : 1)} mil`;
  return formatBRL(value);
}

export function formatPct(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

export function formatPayback(result) {
  if (result.blankFinance) return '—';
  if (result.timeline.payback == null) return 'mais de 5 anos';
  return `${result.timeline.payback} meses`;
}

export function formatRoi(value, blank) {
  if (blank || value == null || !Number.isFinite(value)) return '—';
  return formatPct(value);
}

/**
 * Caixa acumulado do mês 0 ao 60, com o mesmo fluxo do payback
 * (curva de aprendizado, custo recorrente e cenário já aplicados em evaluate).
 */
export function cashCurve(result) {
  const c1 = result.investment.c1;
  return [
    { month: 0, factor: 0, benefit: 0, cost: c1, flow: -c1, accumulated: -c1 },
    ...result.timeline.months,
  ];
}

/** Resumo anual da curva: ano 0 (investimento) e anos 1 a 5. */
export function yearlyCash(result) {
  const curve = cashCurve(result);
  const rows = [{ year: 0, benefit: 0, cost: curve[0].cost, flow: curve[0].flow, accumulated: curve[0].accumulated }];
  for (let year = 1; year <= 5; year += 1) {
    const slice = curve.slice((year - 1) * 12 + 1, year * 12 + 1);
    const benefit = slice.reduce((sum, item) => sum + item.benefit, 0);
    const cost = slice.reduce((sum, item) => sum + item.cost, 0);
    rows.push({ year, benefit, cost, flow: benefit - cost, accumulated: slice[slice.length - 1].accumulated });
  }
  return rows;
}
