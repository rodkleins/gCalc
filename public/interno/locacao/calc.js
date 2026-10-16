/** Fluxo de caixa da locação. O custo mensal de manutenção vem de calculate() da manutenção, sem cópia da regra. */

import {
  calculate as maintenanceCalculate,
  formatBRL,
  formatFixed,
  formatFlex,
  parseBr,
  toCents,
} from '../manutencao/calc.js';

export const DEFAULTS = {
  pace: 1,
  horizon: 120,
  maxFleet: null,
  robotPrice: 1300000,
  taxCreditPct: 25,
  freight: 0,
  partsPerRobot: 0,
  rent: null,
  contractMonths: 60,
  annualAdjustmentPct: 4,
  setupFee: 0,
  delinquencyPct: 2,
  revenueTaxPct: 11.33,
  insurancePerRobot: 0,
  monitoringPerRobot: 0,
  usefulLifeYears: 10,
  residualPct: 20,
  renewalPct: 80,
  safetyMarginPct: 20,
  preMoney: null,
  discountPct: 25,
  twoTranches: false,
  tranche2Month: 13,
  targetPayback: 36,
};

const serviceCache = new Map();

function num(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function percent(value, fallback) {
  return clamp(num(value, fallback), 0, 100) / 100;
}

export function sanitize(raw = {}) {
  const input = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return input;
  input.pace = clamp(num(raw.pace, DEFAULTS.pace), 0, 100);
  input.horizon = Math.round(clamp(num(raw.horizon, DEFAULTS.horizon), 1, 360));
  if (raw.maxFleet == null || raw.maxFleet === '') input.maxFleet = null;
  else if (typeof raw.maxFleet === 'number' && Number.isFinite(raw.maxFleet)) {
    input.maxFleet = Math.max(0, raw.maxFleet);
  }
  input.robotPrice = Math.max(0, num(raw.robotPrice, DEFAULTS.robotPrice));
  input.taxCreditPct = clamp(num(raw.taxCreditPct, DEFAULTS.taxCreditPct), 0, 100);
  input.freight = Math.max(0, num(raw.freight, DEFAULTS.freight));
  input.partsPerRobot = Math.max(0, num(raw.partsPerRobot, DEFAULTS.partsPerRobot));
  if (raw.rent == null || raw.rent === '') input.rent = null;
  else if (typeof raw.rent === 'number' && Number.isFinite(raw.rent)) input.rent = Math.max(0, raw.rent);
  input.contractMonths = Math.round(clamp(num(raw.contractMonths, DEFAULTS.contractMonths), 1, 360));
  input.annualAdjustmentPct = clamp(num(raw.annualAdjustmentPct, DEFAULTS.annualAdjustmentPct), 0, 100);
  input.setupFee = Math.max(0, num(raw.setupFee, DEFAULTS.setupFee));
  input.delinquencyPct = clamp(num(raw.delinquencyPct, DEFAULTS.delinquencyPct), 0, 100);
  input.revenueTaxPct = clamp(num(raw.revenueTaxPct, DEFAULTS.revenueTaxPct), 0, 100);
  input.insurancePerRobot = Math.max(0, num(raw.insurancePerRobot, DEFAULTS.insurancePerRobot));
  input.monitoringPerRobot = Math.max(0, num(raw.monitoringPerRobot, DEFAULTS.monitoringPerRobot));
  input.usefulLifeYears = clamp(num(raw.usefulLifeYears, DEFAULTS.usefulLifeYears), 1, 40);
  input.residualPct = clamp(num(raw.residualPct, DEFAULTS.residualPct), 0, 100);
  input.renewalPct = clamp(num(raw.renewalPct, DEFAULTS.renewalPct), 0, 100);
  input.safetyMarginPct = clamp(num(raw.safetyMarginPct, DEFAULTS.safetyMarginPct), 0, 100);
  if (raw.preMoney == null || raw.preMoney === '') input.preMoney = null;
  else if (typeof raw.preMoney === 'number' && Number.isFinite(raw.preMoney)) input.preMoney = Math.max(0, raw.preMoney);
  input.discountPct = clamp(num(raw.discountPct, DEFAULTS.discountPct), 0, 200);
  input.twoTranches = raw.twoTranches === true;
  input.tranche2Month = Math.round(clamp(num(raw.tranche2Month, DEFAULTS.tranche2Month), 2, input.horizon));
  input.targetPayback = Math.round(clamp(num(raw.targetPayback, DEFAULTS.targetPayback), 1, input.horizon));
  return input;
}

/** Custo mensal da frota em campo. Robô zero não chama a manutenção: a outra conta ainda monta uma equipe. */
export function maintenanceForFleet(robots) {
  if (!(robots > 0)) {
    return { monthly: 0, teams: 0, coordinators: 0, managers: 0, peopleOnTeam: 0 };
  }
  const key = Math.round(robots * 10000) / 10000;
  const cached = serviceCache.get(key);
  if (cached) return cached;
  const result = maintenanceCalculate({ robots: key });
  const value = {
    monthly: result.monthlyRounded,
    teams: result.teams,
    coordinators: result.coordinators,
    managers: result.managers,
    peopleOnTeam: result.peopleOnTeam,
  };
  serviceCache.set(key, value);
  return value;
}

function lifeMonthsOf(years) {
  return Math.max(1, Math.round(years * 12));
}

function unitBook(price, extras, residualRate, ageMonths, lifeMonths) {
  const t = clamp(ageMonths / lifeMonths, 0, 1);
  return price * (residualRate + (1 - residualRate) * (1 - t)) + extras * (1 - t);
}

function buildSchedule(input) {
  const lifeMonths = lifeMonthsOf(input.usefulLifeYears);
  const contract = input.contractMonths;
  const renewal = input.renewalPct / 100;
  const credit = input.taxCreditPct / 100;
  const residualRate = input.residualPct / 100;
  const tax = input.revenueTaxPct / 100;
  const delinquency = input.delinquencyPct / 100;
  const netFactor = 1 - delinquency - tax;
  const adjustment = input.annualAdjustmentPct / 100;
  const extras = input.freight + input.partsPerRobot;
  const unitCapex = input.robotPrice * (1 - credit) + extras;
  const otherPerRobot = input.insurancePerRobot + input.monitoringPerRobot;
  let cohorts = [];
  const months = [];
  let previousKey = '0';

  for (let month = 1; month <= input.horizon; month += 1) {
    const active = [];
    let redeployed = 0;
    for (const cohort of cohorts) {
      const lastLife = cohort.purchaseMonth + lifeMonths - 1;
      if (month > lastLife) continue;
      const rolling = cohort.billEnd >= cohort.billStart && month === cohort.billEnd + 1 && month < lastLife;
      if (!rolling) {
        active.push(cohort);
        continue;
      }
      const keep = cohort.count * renewal;
      const back = cohort.count - keep;
      if (keep > 1e-8) {
        active.push({
          count: keep,
          purchaseMonth: cohort.purchaseMonth,
          billStart: month,
          billEnd: Math.min(month + contract - 1, lastLife),
        });
      }
      if (back > 1e-8) {
        const billStart = month + 1;
        active.push({
          count: back,
          purchaseMonth: cohort.purchaseMonth,
          billStart,
          billEnd: Math.min(billStart + contract - 1, lastLife),
        });
        redeployed += back;
      }
    }
    cohorts = active;

    const inFieldBefore = cohorts.reduce((sum, cohort) => sum + cohort.count, 0);
    const room = input.maxFleet == null ? Infinity : Math.max(0, input.maxFleet - inFieldBefore);
    const bought = Math.min(input.pace, room);
    if (bought > 1e-8) {
      const lastLife = month + lifeMonths - 1;
      cohorts.push({
        count: bought,
        purchaseMonth: month,
        billStart: month + 1,
        billEnd: Math.min(month + contract, lastLife),
      });
    }

    let billing = 0;
    let inField = 0;
    let scrap = 0;
    let terminal = 0;
    for (const cohort of cohorts) {
      const lastLife = cohort.purchaseMonth + lifeMonths - 1;
      const age = month - cohort.purchaseMonth + 1;
      inField += cohort.count;
      if (month >= cohort.billStart && month <= cohort.billEnd) billing += cohort.count;
      const book = unitBook(input.robotPrice, extras, residualRate, age, lifeMonths) * cohort.count;
      if (month === lastLife) scrap += input.robotPrice * residualRate * cohort.count;
      else if (month === input.horizon) terminal += book;
    }

    const service = maintenanceForFleet(inField);
    const stepKey = `${service.teams}|${service.coordinators}|${service.managers}|${service.peopleOnTeam}`;
    const step = stepKey !== previousKey;
    previousKey = stepKey;
    const listFactor = (1 + adjustment) ** Math.floor((month - 1) / 12);
    const capexCents = toCents(bought * unitCapex);
    const setupCents = toCents((bought + redeployed) * input.setupFee * (1 - tax));
    const maintenanceCents = toCents(service.monthly);
    const otherCents = toCents(inField * otherPerRobot);
    const scrapCents = toCents(scrap);
    const terminalCents = toCents(terminal);
    months.push({
      month,
      bought,
      redeployed,
      billing,
      inField,
      capexCents,
      setupCents,
      maintenanceCents,
      otherCents,
      scrapCents,
      terminalCents,
      listFactor,
      revenuePerReal: billing * listFactor * netFactor,
      fixedCents: -capexCents + setupCents - maintenanceCents - otherCents + scrapCents + terminalCents,
      operatingFixedCents: -capexCents + setupCents - maintenanceCents - otherCents + scrapCents,
      teams: service.teams,
      coordinators: service.coordinators,
      managers: service.managers,
      peopleOnTeam: service.peopleOnTeam,
      step,
    });
  }

  return {
    input,
    months,
    netFactor,
    lifeMonths,
    unitCapex,
  };
}

function simulate(schedule, rent) {
  let cumulative = 0;
  let worstCents = 0;
  let worstMonth = 0;
  let wentNegative = false;
  let payback = null;
  let revenueCents = 0;
  let contributionCents = 0;
  let robotMonths = 0;
  const rows = [];

  for (const month of schedule.months) {
    const salesCents = toCents(month.revenuePerReal * rent);
    const netCents = month.fixedCents + salesCents;
    const operatingCents = month.operatingFixedCents + salesCents;
    cumulative += netCents;
    if (cumulative < worstCents) {
      worstCents = cumulative;
      worstMonth = month.month;
    }
    if (cumulative < 0) wentNegative = true;
    else if (wentNegative && payback == null) payback = month.month;
    revenueCents += salesCents;
    contributionCents += salesCents + month.setupCents - month.maintenanceCents - month.otherCents;
    robotMonths += month.billing;
    rows.push({
      ...month,
      salesCents,
      netCents,
      operatingCents,
      cumulativeCents: cumulative,
    });
  }

  if (!wentNegative) payback = 0;

  return {
    rows,
    cumulativeCents: cumulative,
    worstCents,
    worstMonth,
    wentNegative,
    payback,
    revenueCents,
    contributionCents,
    robotMonths,
  };
}

function minimumRentCents(schedule) {
  const { netFactor, input } = schedule;
  const target = input.targetPayback;
  if (!(netFactor > 0)) return null;
  const reaches = (cents) => {
    const result = simulate(schedule, cents / 100);
    return result.payback != null && result.payback <= target;
  };
  if (reaches(0)) return 0;
  let lo = 0;
  let hi = 100_000;
  let guard = 0;
  while (!reaches(hi) && hi < 500_000_000 && guard < 24) {
    hi *= 2;
    guard += 1;
  }
  if (!reaches(hi)) return null;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (reaches(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

function tranchesOf(input, rows, raiseCents) {
  if (!(raiseCents > 0)) return [{ month: 1, cents: 0 }];
  if (!input.twoTranches) return [{ month: 1, cents: raiseCents }];
  const second = input.tranche2Month;
  let needBefore = 0;
  for (const row of rows) {
    if (row.month >= second) break;
    if (row.cumulativeCents < 0) needBefore = Math.max(needBefore, -row.cumulativeCents);
  }
  const margin = input.safetyMarginPct / 100;
  let first = toCents((needBefore / 100) * (1 + margin));
  if (first > raiseCents) first = raiseCents;
  return [
    { month: 1, cents: first },
    { month: second, cents: raiseCents - first },
  ];
}

function npvOf(rows, annualRate) {
  const monthly = annualRate <= -0.999999 ? -0.999999 : (1 + annualRate) ** (1 / 12) - 1;
  let npv = 0;
  for (const row of rows) {
    npv += row.netCents / 100 / (1 + monthly) ** row.month;
  }
  return npv;
}

function irrAnnual(rows) {
  const npvAt = (rate) => npvOf(rows, rate);
  let lo = -0.9;
  let hi = 5;
  let npvLo = npvAt(lo);
  let npvHi = npvAt(hi);
  let guard = 0;
  while (npvHi > 0 && hi < 1000 && guard < 12) {
    hi *= 2;
    npvHi = npvAt(hi);
    guard += 1;
  }
  if (!(npvLo > 0 && npvHi < 0) && !(npvLo < 0 && npvHi > 0)) return null;
  if (npvLo < 0 && npvHi > 0) return null;
  for (let step = 0; step < 60; step += 1) {
    const mid = (lo + hi) / 2;
    const npv = npvAt(mid);
    if (npv > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function stepsOf(rows) {
  const steps = [];
  for (const row of rows) {
    const last = steps[steps.length - 1];
    if (
      !last ||
      last.teams !== row.teams ||
      last.coordinators !== row.coordinators ||
      last.managers !== row.managers ||
      last.peopleOnTeam !== row.peopleOnTeam
    ) {
      steps.push({
        from: row.month,
        to: row.month,
        teams: row.teams,
        coordinators: row.coordinators,
        managers: row.managers,
        peopleOnTeam: row.peopleOnTeam,
        maintenance: row.maintenanceCents / 100,
        inField: row.inField,
      });
    } else {
      last.to = row.month;
    }
  }
  return steps;
}

function yearsOf(rows) {
  const years = [];
  for (const row of rows) {
    const index = Math.floor((row.month - 1) / 12);
    let year = years[index];
    if (!year) {
      year = {
        year: index + 1,
        from: row.month,
        to: row.month,
        salesCents: 0,
        maintenanceCents: 0,
        capexCents: 0,
        netCents: 0,
        inField: row.inField,
        cumulativeCents: row.cumulativeCents,
        teams: row.teams,
      };
      years[index] = year;
    }
    year.to = row.month;
    year.salesCents += row.salesCents;
    year.maintenanceCents += row.maintenanceCents;
    year.capexCents += row.capexCents;
    year.netCents += row.netCents;
    year.inField = row.inField;
    year.cumulativeCents = row.cumulativeCents;
    year.teams = row.teams;
  }
  return years;
}

export function evaluate(raw = {}) {
  const input = sanitize(raw);
  const schedule = buildSchedule(input);
  const suggestedCents = minimumRentCents(schedule);
  const suggestedRent = suggestedCents == null ? null : suggestedCents / 100;
  const usedSuggestion = input.rent == null;
  const rentUsed = usedSuggestion ? (suggestedRent ?? 0) : input.rent;
  const flow = simulate(schedule, rentUsed);
  const raiseCents = flow.worstCents < 0 ? toCents((-flow.worstCents / 100) * (1 + input.safetyMarginPct / 100)) : 0;
  const preMoney = input.preMoney;
  const dilution = preMoney != null && preMoney + raiseCents / 100 > 0 ? raiseCents / 100 / (preMoney + raiseCents / 100) : null;
  const discount = input.discountPct / 100;
  const margin = flow.robotMonths > 0 ? flow.contributionCents / 100 / flow.robotMonths : null;
  const rows = flow.rows;
  return {
    ...input,
    rentUsed,
    usedSuggestion,
    suggestedRent,
    suggestedCents,
    netFactor: schedule.netFactor,
    lifeMonths: schedule.lifeMonths,
    unitCapex: schedule.unitCapex,
    months: rows,
    years: yearsOf(rows),
    steps: stepsOf(rows),
    payback: flow.payback,
    wentNegative: flow.wentNegative,
    worstCents: flow.worstCents,
    worstMonth: flow.worstMonth,
    worst: flow.worstCents / 100,
    cumulative: flow.cumulativeCents / 100,
    raiseCents,
    raise: raiseCents / 100,
    tranches: tranchesOf(input, rows, raiseCents),
    dilution,
    npv: npvOf(rows, discount),
    irr: irrAnnual(rows),
    margin,
    finalFleet: rows.length ? rows[rows.length - 1].inField : 0,
    revenue: flow.revenueCents / 100,
  };
}

function money(value) {
  return formatBRL(value);
}

function monthLabel(result) {
  if (!result.wentNegative) return 'Sem desembolso no horizonte.';
  if (result.payback == null) return `Não recupera em ${formatFlex(result.horizon)} meses.`;
  return `Mês ${formatFlex(result.payback)}.`;
}

export function paybackLabel(result) {
  return monthLabel(result);
}

export function explain(result) {
  const sample = result.months[1] || result.months[0];
  const first = result.months[0];
  const netFactor = formatFixed(result.netFactor, 4);
  const listAt = (month) => result.rentUsed * (1 + result.annualAdjustmentPct / 100) ** Math.floor((month - 1) / 12);
  const trancheText = result.tranches
    .map((tranche) => `mês ${formatFlex(tranche.month)}: ${money(tranche.cents / 100)}`)
    .join('; ');
  const irrText = result.irr == null ? 'A busca não achou uma taxa que zere o VPL.' : `${formatFixed(result.irr * 100, 2)}% ao ano.`;
  const dilutionText =
    result.dilution == null
      ? 'Diluição fica em branco sem o valuation pre-money.'
      : `Diluição = ${money(result.raise)} ÷ (${money(result.preMoney)} + ${money(result.raise)}) = ${formatFixed(result.dilution * 100, 2)}%.`;
  const rentText = result.usedSuggestion
    ? `O campo de aluguel está vazio. A conta usa a mensalidade mínima sugerida, ${money(result.rentUsed)}.`
    : `Aluguel informado = ${money(result.rentUsed)}. A mínima sugerida, ${result.suggestedRent == null ? 'inexistente neste horizonte' : money(result.suggestedRent)}, é só referência.`;
  const paceLine =
    result.pace === 1
      ? 'Todo mês entra 1 robô novo'
      : `Todo mês entram ${formatFlex(result.pace)} robôs novos`;

  return [
    {
      title: 'Frota',
      lines: [
        `${paceLine}, até o mês ${formatFlex(result.horizon)}${result.maxFleet == null ? ', sem teto de frota' : `, limitado a ${formatFlex(result.maxFleet)} robôs`}.`,
        'O robô comprado no mês t começa a alugar no mês t+1. O contrato vale em meses de aluguel, não no mês da instalação.',
        `Renovação de ${formatFlex(result.renewalPct)}%. Quem renova segue alugado, sem compra nova e sem taxa de setup. Quem não renova é reinstalado no mesmo mês, fica esse mês sem aluguel e volta a faturar no mês seguinte. Não há segunda compra, nem frete de novo.`,
        `Vida útil de ${formatFlex(result.usefulLifeYears)} anos (${formatFlex(result.lifeMonths)} meses). No último mês de vida o caixa recebe ${formatFlex(result.residualPct)}% do preço do robô. No fim do horizonte, o que ainda não completou a vida entra pelo valor de livro: preço deprecia em linha reta até esse residual; frete e estoque de peças depreciam até zero.`,
        'O crédito de impostos não entra na depreciação: ele já reduziu o caixa no mês da compra.',
      ],
    },
    {
      title: 'Investimento',
      lines: [
        `Compra de um robô = ${money(result.robotPrice)} × (1 − ${formatFlex(result.taxCreditPct)}%) + ${money(result.freight)} de frete e instalação + ${money(result.partsPerRobot)} de estoque de peças = ${money(result.unitCapex)}.`,
        'O crédito é premissa e abate no próprio mês da compra. O estoque de peças segue o padrão da manutenção, hoje zero, e é investimento, não custo mensal.',
        first
          ? `Mês 1: compra ${formatFlex(first.bought)} ${first.bought === 1 ? 'robô' : 'robôs'}, desembolso ${money(first.capexCents / 100)}. Robôs alugados nesse mês: ${formatFlex(first.billing)}.`
          : 'Horizonte vazio.',
      ],
    },
    {
      title: 'Receita',
      lines: [
        rentText,
        `Tabela do mês m = aluguel × (1 + ${formatFlex(result.annualAdjustmentPct)}%) ^ piso((m − 1) ÷ 12). O reajuste é da tabela, no calendário, para quem está alugado naquele mês.`,
        `Caixa da mensalidade = faturamento × (1 − ${formatFlex(result.delinquencyPct)}% de inadimplência − ${formatFlex(result.revenueTaxPct)}% de impostos) = faturamento × ${netFactor}. O imposto incide sobre o bruto; a inadimplência não o reduz.`,
        `Taxa de setup = ${money(result.setupFee)} por instalação nova ou recolocação, no mês do evento, líquida do mesmo imposto e sem inadimplência. Renovação não cobra setup.`,
        sample
          ? `Exemplo no mês ${formatFlex(sample.month)}: tabela ${money(listAt(sample.month))}, robôs alugados ${formatFlex(sample.billing)}, receita no caixa ${money(sample.salesCents / 100)}.`
          : 'Sem mês de exemplo.',
      ],
    },
    {
      title: 'Manutenção e outros custos',
      lines: [
        'A mensalidade inclui a manutenção. O custo do mês é o custo mensal de calculate({ robôs em campo }) da calculadora de manutenção, com as premissas padrão de lá: equipe de até 2 pessoas, Fiorino, encargos, gerente, 0,6% do fabricante, absenteísmo, férias e turnover.',
        'Robô nenhum em campo custa zero. A partir do primeiro, vale a equipe que a outra conta monta para aquela quantidade.',
        sample
          ? `Mês ${formatFlex(sample.month)}: ${formatFlex(sample.inField)} robôs em campo, ${formatFlex(sample.teams)} equipes, manutenção ${money(sample.maintenanceCents / 100)}.`
          : 'Sem manutenção no horizonte.',
        `Seguro + monitoramento = (${money(result.insurancePerRobot)} + ${money(result.monitoringPerRobot)}) × robôs em campo.`,
        result.margin == null
          ? 'Não há robô-mês alugado, então não há margem por robô.'
          : `Margem média por robô/mês = (receita no caixa + setup − manutenção − seguro − monitoramento) ÷ robôs-mês alugados = ${money(result.margin)}. Fica de fora a compra e o valor de livro.`,
      ],
    },
    {
      title: 'Payback, captação e retorno',
      lines: [
        'O caixa do mês soma compra, receita, setup, manutenção, seguro, monitoramento, sucata no fim da vida e, só no último mês, o valor de livro do que ainda não depreciou até o fim. Não entra aporte, dívida nem juros: o funding é capital próprio.',
        `Payback: ${monthLabel(result)} É o primeiro mês em que o acumulado volta a ficar maior ou igual a zero depois de ter ficado negativo.`,
        `Pior ponto = ${money(result.worst)} no mês ${formatFlex(result.worstMonth)}. Captação = pico × (1 + ${formatFlex(result.safetyMarginPct)}%) = ${money(result.raise)}.`,
        result.twoTranches
          ? `Duas tranches, somando a captação: ${trancheText}. A primeira cobre o pico até o mês anterior à segunda, com a mesma margem. Tranches não entram na TIR nem no payback.`
          : `Uma tranche no mês 1: ${money(result.raise)}. Ela não entra na TIR nem no payback.`,
        dilutionText,
        `VPL desconta o caixa do projeto a ${formatFlex(result.discountPct)}% ao ano, taxa efetiva. A taxa mensal é (1 + taxa anual) ^ (1 ÷ 12) − 1. VPL = ${money(result.npv)}.`,
        `TIR anual: ${irrText} É a taxa efetiva ao ano que zera esse VPL. O fluxo compra robô todo mês, então pode haver mais de uma raiz; a conta fica com a raiz que a busca encontra quando o VPL troca de sinal.`,
        result.suggestedRent == null
          ? `Não há mensalidade que devolva o caixa até o mês ${formatFlex(result.targetPayback)}. Com o fator líquido da receita em ${netFactor}, aumentar o aluguel não adianta.`
          : `Mensalidade mínima sugerida = menor valor, em centavos, cujo payback cai até o mês ${formatFlex(result.targetPayback)}: ${money(result.suggestedRent)}. A busca é binária. Ela não escreve no campo de aluguel.`,
      ],
    },
  ];
}

export { formatBRL, formatFlex, formatFixed, parseBr };
