/** Fluxo de caixa da locação. A manutenção é um valor terceirizado por robô alugado, sem a conta de equipes. */

/**
 * Lê número no formato brasileiro. Com um ponto só e três dígitos depois, o ponto é milhar ("1.500"),
 * exceto se a parte inteira começa com zero ("0.250" = 0,25). Com decimalDot, um ponto só é sempre
 * decimal: é o caso dos campos de percentual.
 */
export function parseBr(raw, options = {}) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw == null) return null;
  const text = String(raw)
    .trim()
    .replace(/[\s\u00a0]/g, '')
    .replace(/R\$/gi, '')
    .replace(/%/g, '');
  if (!text || text === '-' || text === ',' || text === '.') return null;
  const hasComma = text.includes(',');
  const dots = text.match(/\./g)?.length ?? 0;
  let normalized = text;
  if (hasComma) normalized = text.replace(/\./g, '').replace(',', '.');
  else if (dots > 1) normalized = text.replace(/\./g, '');
  else if (dots === 1) {
    const [head, tail] = text.split('.');
    if (!options.decimalDot && /^-?[1-9]\d{0,2}$/.test(head) && /^\d{3}$/.test(tail)) normalized = head + tail;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function toCents(value) {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(value) * 100 + 0.5 + 1e-6);
}

function roundMoney(value) {
  return toCents(value) / 100;
}

export function formatFixed(value, digits) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatFlex(value, maxDigits = 2) {
  if (value == null || !Number.isFinite(value)) return '—';
  const factor = 10 ** maxDigits;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  }).format(rounded);
}

export function formatBRL(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundMoney(value));
}

/** Loja de R$ 2 milhões, cenário base, mês 60: sem robô menos com robô. Travado pelo teste da calculadora de compra. */
export const STORE_COST_WITHOUT = 68720;
export const STORE_COST_WITH = 19104;
export const STORE_SAVING_DEFAULT = STORE_COST_WITHOUT - STORE_COST_WITH;

/**
 * Regime fixo: lucro real, apurado mês a mês de forma simplificada. Edite aqui as alíquotas.
 * - PIS/COFINS não cumulativo sobre o aluguel faturado e o setup, com crédito sobre a manutenção terceirizada.
 * - O crédito de impostos recuperáveis da compra abate só débitos de PIS/COFINS; o que sobra fica para os meses seguintes.
 * - IRPJ + adicional acima do limite mensal + CSLL sobre o lucro tributável, com compensação de prejuízo
 *   limitada a um percentual do lucro do mês.
 */
export const LUCRO_REAL = {
  pisCofinsPct: 9.25,
  maintenanceCreditPct: 9.25,
  irpjPct: 15,
  irpjSurchargePct: 10,
  irpjSurchargeThreshold: 20000,
  csllPct: 9,
  lossOffsetCapPct: 30,
};

export const DEFAULTS = {
  pace: 1,
  horizon: 180,
  maxFleet: null,
  robotPrice: 1300000,
  taxCreditPct: 25,
  creditMonths: 48,
  freight: 0,
  partsPerRobot: 0,
  rent: null,
  passThroughOn: true,
  passThroughPct: 60,
  storeSaving: STORE_SAVING_DEFAULT,
  tier1From: 10,
  tier1Pct: 5,
  tier2From: 50,
  tier2Pct: 10,
  contractMonths: 120,
  annualAdjustmentPct: 4,
  setupFee: 0,
  delinquencyPct: 2,
  insurancePerRobot: 0,
  monitoringPerRobot: 0,
  maintenancePerRobot: 3500,
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

function num(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
  input.creditMonths = Math.round(clamp(num(raw.creditMonths, DEFAULTS.creditMonths), 1, 360));
  input.freight = Math.max(0, num(raw.freight, DEFAULTS.freight));
  input.partsPerRobot = Math.max(0, num(raw.partsPerRobot, DEFAULTS.partsPerRobot));
  if (raw.rent == null || raw.rent === '') input.rent = null;
  else if (typeof raw.rent === 'number' && Number.isFinite(raw.rent)) input.rent = Math.max(0, raw.rent);
  if (typeof raw.passThroughOn === 'boolean') input.passThroughOn = raw.passThroughOn;
  input.passThroughPct = clamp(num(raw.passThroughPct, DEFAULTS.passThroughPct), 0, 100);
  input.storeSaving = Math.max(0, num(raw.storeSaving, DEFAULTS.storeSaving));
  input.maintenancePerRobot = Math.max(0, num(raw.maintenancePerRobot, DEFAULTS.maintenancePerRobot));
  input.tier1From = Math.round(clamp(num(raw.tier1From, DEFAULTS.tier1From), 1, 100000));
  input.tier1Pct = clamp(num(raw.tier1Pct, DEFAULTS.tier1Pct), 0, 100);
  input.tier2From = Math.max(input.tier1From + 1, Math.round(clamp(num(raw.tier2From, DEFAULTS.tier2From), 1, 100000)));
  input.tier2Pct = clamp(num(raw.tier2Pct, DEFAULTS.tier2Pct), 0, 100);
  input.contractMonths = Math.round(clamp(num(raw.contractMonths, DEFAULTS.contractMonths), 1, 360));
  input.annualAdjustmentPct = clamp(num(raw.annualAdjustmentPct, DEFAULTS.annualAdjustmentPct), 0, 100);
  input.setupFee = Math.max(0, num(raw.setupFee, DEFAULTS.setupFee));
  input.delinquencyPct = clamp(num(raw.delinquencyPct, DEFAULTS.delinquencyPct), 0, 100);
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

function lifeMonthsOf(years) {
  return Math.max(1, Math.round(years * 12));
}

function unitBook(price, extras, residualRate, ageMonths, lifeMonths) {
  const t = clamp(ageMonths / lifeMonths, 0, 1);
  return price * (residualRate + (1 - residualRate) * (1 - t)) + extras * (1 - t);
}

function tiersOf(input) {
  return [
    { from: input.tier1From, pct: input.tier1Pct / 100 },
    { from: input.tier2From, pct: input.tier2Pct / 100 },
  ];
}

/** Desconto da compra de índice 1-based. Vale o maior patamar cujo início já foi atingido. */
export function volumeDiscountPct(index, tiers) {
  let pct = 0;
  const ordered = [...tiers].sort((a, b) => a.from - b.from);
  for (const tier of ordered) {
    if (index + 1e-9 >= tier.from) pct = tier.pct;
  }
  return pct;
}

function purchaseLots(bought, purchasedBefore, tiers, listPrice) {
  const lots = [];
  const push = (count, unitPrice) => {
    const last = lots[lots.length - 1];
    if (last && Math.abs(last.unitPrice - unitPrice) < 1e-6) last.count += count;
    else lots.push({ count, unitPrice });
  };
  const whole = Math.floor(bought + 1e-9);
  const fraction = bought - whole;
  for (let step = 1; step <= whole; step += 1) {
    const discount = volumeDiscountPct(purchasedBefore + step, tiers);
    push(1, listPrice * (1 - discount));
  }
  if (fraction > 1e-8) {
    const discount = volumeDiscountPct(purchasedBefore + whole + 1, tiers);
    push(fraction, listPrice * (1 - discount));
  }
  return lots;
}

/** Parcela index (0-based) de um crédito dividido em centavos iguais. As primeiras levam o resto. */
function creditInstallmentCents(totalCents, months, index) {
  if (!(totalCents > 0) || months < 1 || index < 0 || index >= months) return 0;
  const base = Math.floor(totalCents / months);
  const extra = totalCents % months;
  return base + (index < extra ? 1 : 0);
}

function buildSchedule(input, options = {}) {
  const lifeMonths = lifeMonthsOf(input.usefulLifeYears);
  const contract = input.contractMonths;
  const renewal = input.renewalPct / 100;
  const credit = input.taxCreditPct / 100;
  const residualRate = input.residualPct / 100;
  const delinquency = input.delinquencyPct / 100;
  const netFactor = 1 - delinquency - LUCRO_REAL.pisCofinsPct / 100;
  const adjustment = input.annualAdjustmentPct / 100;
  const extras = input.freight + input.partsPerRobot;
  const tiers = tiersOf(input);
  const singleContract = options.singleContract === true;
  const singlePurchase = options.singlePurchase === true;
  // Depreciação fiscal: o custo exclui o crédito recuperável; o robô vai até o residual, frete e peças até zero.
  const depreciableOf = (unitPrice) => Math.max(0, unitPrice * (1 - credit - residualRate)) + extras;
  let cohorts = [];
  let credits = [];
  let purchased = 0;
  const months = [];

  for (let month = 1; month <= input.horizon; month += 1) {
    const active = [];
    let redeployed = 0;
    let release = 0;
    for (const cohort of cohorts) {
      const lastLife = cohort.purchaseMonth + lifeMonths - 1;
      if (month > lastLife) continue;
      const rolling = cohort.billEnd >= cohort.billStart && month === cohort.billEnd + 1 && month < lastLife;
      if (!rolling) {
        active.push(cohort);
        continue;
      }
      if (singleContract) {
        const age = month - cohort.purchaseMonth + 1;
        release += unitBook(cohort.unitPrice, extras, residualRate, age, lifeMonths) * cohort.count;
        continue;
      }
      const keep = cohort.count * renewal;
      const back = cohort.count - keep;
      if (keep > 1e-8) {
        active.push({
          count: keep,
          unitPrice: cohort.unitPrice,
          purchaseMonth: cohort.purchaseMonth,
          billStart: month,
          billEnd: Math.min(month + contract - 1, lastLife),
        });
      }
      if (back > 1e-8) {
        const billStart = month + 1;
        active.push({
          count: back,
          unitPrice: cohort.unitPrice,
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
    const bought = singlePurchase && purchased > 0 ? 0 : Math.min(input.pace, room);
    let capex = 0;
    if (bought > 1e-8) {
      const lastLife = month + lifeMonths - 1;
      const lots = purchaseLots(bought, purchased, tiers, input.robotPrice);
      for (const lot of lots) {
        capex += lot.count * (lot.unitPrice + extras);
        const creditTotal = toCents(lot.count * lot.unitPrice * credit);
        if (creditTotal > 0) {
          credits.push({ startMonth: month + 1, totalCents: creditTotal, months: input.creditMonths });
        }
        cohorts.push({
          count: lot.count,
          unitPrice: lot.unitPrice,
          purchaseMonth: month,
          billStart: month + 1,
          billEnd: Math.min(month + contract, lastLife),
        });
      }
      purchased += bought;
    }

    let billing = 0;
    let inField = 0;
    let scrap = 0;
    let terminal = 0;
    let depreciation = 0;
    for (const cohort of cohorts) {
      const lastLife = cohort.purchaseMonth + lifeMonths - 1;
      const age = month - cohort.purchaseMonth + 1;
      inField += cohort.count;
      depreciation += (cohort.count * depreciableOf(cohort.unitPrice)) / lifeMonths;
      if (month >= cohort.billStart && month <= cohort.billEnd) billing += cohort.count;
      const book = unitBook(cohort.unitPrice, extras, residualRate, age, lifeMonths) * cohort.count;
      if (month === lastLife) scrap += cohort.unitPrice * residualRate * cohort.count;
      else if (month === input.horizon) terminal += book;
    }

    let creditCents = 0;
    for (const item of credits) {
      creditCents += creditInstallmentCents(item.totalCents, item.months, month - item.startMonth);
    }

    const listFactor = (1 + adjustment) ** Math.floor((month - 1) / 12);
    const capexCents = toCents(capex);
    const setupCents = toCents((bought + redeployed) * input.setupFee);
    const maintenanceCents = toCents(billing * input.maintenancePerRobot);
    const maintenanceCreditCents = Math.round(maintenanceCents * (LUCRO_REAL.maintenanceCreditPct / 100));
    const otherCents = toCents(inField * (input.insurancePerRobot + input.monitoringPerRobot));
    const depreciationCents = toCents(depreciation);
    const scrapCents = toCents(scrap);
    const terminalCents = toCents(terminal);
    const releaseCents = toCents(release);
    months.push({
      month,
      bought,
      redeployed,
      billing,
      inField,
      capexCents,
      creditCents,
      setupCents,
      maintenanceCents,
      maintenanceCreditCents,
      otherCents,
      depreciationCents,
      scrapCents,
      terminalCents,
      releaseCents,
      listFactor,
      revenuePerReal: billing * listFactor,
      operatingFixedCents: -capexCents - maintenanceCents - otherCents + scrapCents + releaseCents,
    });
  }

  return {
    input,
    months,
    netFactor,
    delinquency,
    lifeMonths,
    unitCapex: input.robotPrice + extras,
  };
}

/** IRPJ + adicional + CSLL de um mês, em centavos, sobre a base já compensada. */
function incomeTaxCents(baseCents) {
  if (!(baseCents > 0)) return 0;
  const flat = (LUCRO_REAL.irpjPct + LUCRO_REAL.csllPct) / 100;
  const over = Math.max(0, baseCents - toCents(LUCRO_REAL.irpjSurchargeThreshold));
  return Math.round(baseCents * flat + over * (LUCRO_REAL.irpjSurchargePct / 100));
}

/**
 * Caixa mês a mês para um aluguel. Os impostos dependem do aluguel, então a apuração mora aqui:
 * créditos de PIS/COFINS limitados ao débito do mês, com saldo carregado, e IR/CSLL com prejuízo
 * compensado até o teto do lucro do mês. O payback e o pior caixa usam o acumulado sem o valor de livro
 * terminal, que fica à parte.
 */
function simulate(schedule, rent) {
  const pisCofins = LUCRO_REAL.pisCofinsPct / 100;
  const lossCap = LUCRO_REAL.lossOffsetCapPct / 100;
  let cumulative = 0;
  let worstCents = 0;
  let worstMonth = 0;
  let wentNegative = false;
  let payback = null;
  let revenueCents = 0;
  let contributionCents = 0;
  let robotMonths = 0;
  let creditPool = 0;
  let lossCarry = 0;
  let pisCofinsTotal = 0;
  let incomeTaxTotal = 0;
  let terminalTotal = 0;
  const rows = [];

  for (const month of schedule.months) {
    const grossCents = toCents(month.revenuePerReal * rent);
    const lossCents = Math.round(grossCents * schedule.delinquency);
    const salesCents = grossCents - lossCents;
    const debitCents = Math.round((grossCents + month.setupCents) * pisCofins);
    creditPool += month.creditCents + month.maintenanceCreditCents;
    const creditUsedCents = Math.min(creditPool, debitCents);
    creditPool -= creditUsedCents;
    const pisCofinsCents = debitCents - creditUsedCents;

    const taxableCents =
      grossCents +
      month.setupCents -
      debitCents -
      lossCents -
      (month.maintenanceCents - month.maintenanceCreditCents) -
      month.otherCents -
      month.depreciationCents;
    let lossOffsetCents = 0;
    if (taxableCents < 0) lossCarry -= taxableCents;
    else {
      lossOffsetCents = Math.min(lossCarry, Math.floor(taxableCents * lossCap));
      lossCarry -= lossOffsetCents;
    }
    const incomeTaxCentsOfMonth = incomeTaxCents(taxableCents - lossOffsetCents);

    const operatingCents = month.operatingFixedCents + salesCents + month.setupCents - pisCofinsCents - incomeTaxCentsOfMonth;
    const netCents = operatingCents + month.terminalCents;
    cumulative += operatingCents;
    if (cumulative < worstCents) {
      worstCents = cumulative;
      worstMonth = month.month;
    }
    if (cumulative < 0) wentNegative = true;
    else if (wentNegative && payback == null) payback = month.month;
    revenueCents += salesCents;
    contributionCents +=
      salesCents + month.setupCents - debitCents + month.maintenanceCreditCents - month.maintenanceCents - month.otherCents;
    robotMonths += month.billing;
    pisCofinsTotal += pisCofinsCents;
    incomeTaxTotal += incomeTaxCentsOfMonth;
    terminalTotal += month.terminalCents;
    rows.push({
      ...month,
      grossCents,
      lossCents,
      salesCents,
      debitCents,
      creditUsedCents,
      creditBalanceCents: creditPool,
      pisCofinsCents,
      taxableCents,
      lossOffsetCents,
      lossCarryCents: lossCarry,
      incomeTaxCents: incomeTaxCentsOfMonth,
      netCents,
      operatingCents,
      cumulativeCents: cumulative,
    });
  }

  if (!wentNegative) payback = 0;

  return {
    rows,
    cumulativeCents: cumulative,
    terminalCents: terminalTotal,
    worstCents,
    worstMonth,
    wentNegative,
    payback,
    revenueCents,
    contributionCents,
    robotMonths,
    pisCofinsCents: pisCofinsTotal,
    incomeTaxCents: incomeTaxTotal,
    creditBalanceCents: creditPool,
    lossCarryCents: lossCarry,
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
        pisCofinsCents: 0,
        incomeTaxCents: 0,
        netCents: 0,
        inField: row.inField,
        cumulativeCents: row.cumulativeCents,
      };
      years[index] = year;
    }
    year.to = row.month;
    year.salesCents += row.salesCents;
    year.maintenanceCents += row.maintenanceCents;
    year.capexCents += row.capexCents;
    year.pisCofinsCents += row.pisCofinsCents;
    year.incomeTaxCents += row.incomeTaxCents;
    year.netCents += row.operatingCents;
    year.inField = row.inField;
    year.cumulativeCents = row.cumulativeCents;
  }
  return years;
}

function contractOf(input, rentUsed) {
  const lifeMonths = lifeMonthsOf(input.usefulLifeYears);
  const horizon = Math.min(360, Math.max(input.contractMonths + 1, lifeMonths));
  const unitInput = sanitize({
    ...input,
    pace: 1,
    horizon,
    maxFleet: 1,
    renewalPct: 0,
    tier1Pct: 0,
    tier2Pct: 0,
    targetPayback: Math.min(input.targetPayback, horizon),
  });
  const schedule = buildSchedule(unitInput, { singleContract: true, singlePurchase: true });
  const flow = simulate(schedule, rentUsed);
  const view = {
    horizon,
    payback: flow.payback,
    wentNegative: flow.wentNegative,
    profit: (flow.cumulativeCents + flow.terminalCents) / 100,
    terminal: flow.terminalCents / 100,
    incomeTax: flow.incomeTaxCents / 100,
    pisCofins: flow.pisCofinsCents / 100,
    billingMonths: flow.robotMonths,
    maintenanceMonthly: input.maintenancePerRobot,
    rentUsed,
  };
  return {
    ...view,
    npv: npvOf(flow.rows, input.discountPct / 100),
    irr: irrAnnual(flow.rows),
    label: monthLabel(view),
  };
}

export function evaluate(raw = {}) {
  const input = sanitize(raw);
  const schedule = buildSchedule(input);
  const suggestedCents = minimumRentCents(schedule);
  const suggestedRent = suggestedCents == null ? null : suggestedCents / 100;
  const passThroughRent = toCents(input.storeSaving * (input.passThroughPct / 100)) / 100;
  const usedSuggestion = !input.passThroughOn && input.rent == null;
  const rentUsed = input.passThroughOn ? passThroughRent : usedSuggestion ? (suggestedRent ?? 0) : input.rent;
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
    passThroughRent,
    storeNetSaving: toCents(input.storeSaving - rentUsed) / 100,
    netFactor: schedule.netFactor,
    lifeMonths: schedule.lifeMonths,
    unitCapex: schedule.unitCapex,
    months: rows,
    years: yearsOf(rows),
    payback: flow.payback,
    wentNegative: flow.wentNegative,
    worstCents: flow.worstCents,
    worstMonth: flow.worstMonth,
    worst: flow.worstCents / 100,
    cumulative: flow.cumulativeCents / 100,
    terminalCents: flow.terminalCents,
    terminal: flow.terminalCents / 100,
    cumulativeWithTerminal: (flow.cumulativeCents + flow.terminalCents) / 100,
    pisCofins: flow.pisCofinsCents / 100,
    incomeTax: flow.incomeTaxCents / 100,
    creditBalance: flow.creditBalanceCents / 100,
    lossCarry: flow.lossCarryCents / 100,
    taxRules: { ...LUCRO_REAL },
    raiseCents,
    raise: raiseCents / 100,
    tranches: tranchesOf(input, rows, raiseCents),
    dilution,
    npv: npvOf(rows, discount),
    irr: irrAnnual(rows),
    margin,
    finalFleet: rows.length ? rows[rows.length - 1].inField : 0,
    revenue: flow.revenueCents / 100,
    contract: contractOf(input, rentUsed),
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

/** Nota curta das premissas tributárias, para a tela. */
export function taxNote(result) {
  const rules = result.taxRules;
  const flat = rules.irpjPct + rules.csllPct;
  return `Lucro real, apurado mês a mês de forma simplificada. PIS/COFINS não cumulativo de ${formatFlex(rules.pisCofinsPct)}% sobre o aluguel, com crédito de ${formatFlex(rules.maintenanceCreditPct)}% sobre a manutenção terceirizada. O crédito da compra (${formatFlex(result.taxCreditPct)}% em ${formatFlex(result.creditMonths)} parcelas) só abate esse débito; o saldo passa para o mês seguinte. IR/CSLL de ${formatFlex(flat + rules.irpjSurchargePct)}% (${formatFlex(rules.irpjPct)}% + ${formatFlex(rules.irpjSurchargePct)}% acima de ${money(rules.irpjSurchargeThreshold)}/mês + ${formatFlex(rules.csllPct)}%) sobre receita líquida − manutenção − outros custos − depreciação, com prejuízo compensado até ${formatFlex(rules.lossOffsetCapPct)}% do lucro do mês. Sem IBS/CBS. Valide com o contador.`;
}

function taxLines(result) {
  const rules = result.taxRules;
  const sample = result.months.find((month) => month.billing > 0);
  return [
    'Regime fixo em lucro real, sem seletor. As alíquotas ficam na constante LUCRO_REAL do calc.js. A apuração é mensal e simplificada: na prática o IR/CSLL é trimestral ou anual com estimativas, e a reforma do IBS/CBS não entra.',
    `PIS/COFINS: débito de ${formatFlex(rules.pisCofinsPct)}% sobre faturamento + setup. Crédito de ${formatFlex(rules.maintenanceCreditPct)}% sobre a manutenção terceirizada e as parcelas do crédito da compra. Os créditos abatem só o débito do mês; o que sobra fica em saldo. Saldo sem uso no fim do horizonte: ${money(result.creditBalance)}.`,
    `Lucro tributável = faturamento + setup − débito de PIS/COFINS − inadimplência − manutenção líquida do crédito − seguro − monitoramento − depreciação. A depreciação é linear na vida útil, sobre o preço sem o crédito recuperável, até o residual; frete e peças vão a zero.`,
    `IR/CSLL = ${formatFlex(rules.irpjPct + rules.csllPct)}% da base + ${formatFlex(rules.irpjSurchargePct)}% do que passar de ${money(rules.irpjSurchargeThreshold)} no mês. Mês com prejuízo não paga e acumula o prejuízo; mês com lucro compensa no máximo ${formatFlex(rules.lossOffsetCapPct)}% do lucro. Prejuízo a compensar no fim: ${money(result.lossCarry)}.`,
    'Sucata, saída do robô e valor terminal não geram IR sobre ganho de capital: é uma simplificação.',
    sample
      ? `Mês ${formatFlex(sample.month)}: débito ${money(sample.debitCents / 100)}, créditos usados ${money(sample.creditUsedCents / 100)}, PIS/COFINS pago ${money(sample.pisCofinsCents / 100)}, lucro tributável ${money(sample.taxableCents / 100)}, prejuízo compensado ${money(sample.lossOffsetCents / 100)}, IR/CSLL ${money(sample.incomeTaxCents / 100)}.`
      : 'Sem mês com aluguel.',
    `No horizonte: PIS/COFINS pago ${money(result.pisCofins)}, IR/CSLL ${money(result.incomeTax)}.`,
  ];
}

export function explain(result) {
  const sample = result.months.find((month) => month.billing > 0) || result.months[0];
  const first = result.months[0];
  const netFactor = formatFixed(result.netFactor, 4);
  const listAt = (month) => result.rentUsed * (1 + result.annualAdjustmentPct / 100) ** Math.floor((month - 1) / 12);
  const trancheText = result.tranches
    .map((tranche) => `mês ${formatFlex(tranche.month)}: ${money(tranche.cents / 100)}`)
    .join('; ');
  const irrText = result.irr == null ? 'A busca não achou uma taxa que zere o VPL.' : `${formatFixed(result.irr * 100, 2)}% ao ano.`;
  const contractIrr =
    result.contract.irr == null ? 'A busca não achou uma taxa que zere o VPL.' : `${formatFixed(result.contract.irr * 100, 2)}% ao ano.`;
  const dilutionText =
    result.dilution == null
      ? 'Diluição fica em branco sem o valuation pre-money.'
      : `Diluição = ${money(result.raise)} ÷ (${money(result.preMoney)} + ${money(result.raise)}) = ${formatFixed(result.dilution * 100, 2)}%.`;
  const rentText = result.passThroughOn
    ? `Repasse ligado: aluguel = ${formatFlex(result.passThroughPct)}% × ${money(result.storeSaving)} = ${money(result.rentUsed)}. A economia padrão é a da loja de R$ 2 milhões no cenário base, mês 60: ${money(STORE_COST_WITHOUT)} sem robô − ${money(STORE_COST_WITH)} com robô = ${money(STORE_SAVING_DEFAULT)}. O campo aceita outro valor.`
    : result.usedSuggestion
      ? `Repasse desligado e aluguel vazio. A conta usa a mensalidade mínima sugerida, ${money(result.rentUsed)}.`
      : `Repasse desligado. Aluguel informado = ${money(result.rentUsed)}.`;
  const paceLine =
    result.pace === 1
      ? 'Todo mês entra 1 robô novo'
      : `Todo mês entram ${formatFlex(result.pace)} robôs novos`;
  return [
    {
      title: 'Frota',
      lines: [
        `${paceLine}, até o mês ${formatFlex(result.horizon)}${result.maxFleet == null ? ', sem teto de frota' : `, limitado a ${formatFlex(result.maxFleet)} robôs`}. O padrão do horizonte é 180 meses, para o gráfico passar do fim do contrato de ${formatFlex(result.contractMonths)} meses.`,
        'O robô comprado no mês t começa a alugar no mês t+1. O contrato vale em meses de calendário a partir da compra, e o mês da instalação entra na vida útil. Com vida e contrato de 120 meses, o aluguel vai do mês 2 ao mês 120: 119 mensalidades. No mês 120 também entra o residual.',
        `Renovação de ${formatFlex(result.renewalPct)}%. Quem renova segue alugado, sem compra nova e sem taxa de setup. Quem não renova é reinstalado no mesmo mês, fica esse mês sem aluguel e volta a faturar no mês seguinte. Não há segunda compra, nem frete de novo.`,
        `Vida útil de ${formatFlex(result.usefulLifeYears)} anos (${formatFlex(result.lifeMonths)} meses). No último mês de vida o caixa recebe ${formatFlex(result.residualPct)}% do preço pago naquele robô, já com o desconto de volume. No fim do horizonte, o que ainda não completou a vida tem um valor de livro (preço depreciado em linha reta até o residual; frete e estoque de peças até zero). Esse valor terminal fica à parte: entra no VPL e na TIR, mas não no payback, no pior caixa nem na mensalidade mínima.`,
        'O crédito de impostos não reduz o caixa do mês da compra. Ele é liberado em parcelas mensais iguais a partir do mês seguinte e só abate débitos de PIS/COFINS.',
      ],
    },
    {
      title: 'Investimento',
      lines: [
        `Compra de um robô no preço de tabela = ${money(result.robotPrice)} + ${money(result.freight)} de frete e instalação + ${money(result.partsPerRobot)} de estoque de peças = ${money(result.unitCapex)}. Esse valor sai inteiro no mês da compra.`,
        `Desconto por volume, pela compra acumulada: ${formatFlex(result.tier1Pct)}% a partir do ${formatFlex(result.tier1From)}º robô e ${formatFlex(result.tier2Pct)}% a partir do ${formatFlex(result.tier2From)}º. Vale o maior patamar já atingido. Recolocação não conta. O crédito e o residual incidem sobre o preço do robô com desconto, sem frete nem peças.`,
        `Crédito de impostos recuperáveis = ${formatFlex(result.taxCreditPct)}% do preço do robô. Não abate o mês da compra. É liberado em ${formatFlex(result.creditMonths)} parcelas mensais iguais, começando no mês seguinte, e só abate o débito de PIS/COFINS do mês; o que sobra fica em saldo para os meses seguintes. A divisão é em centavos e as primeiras parcelas levam o centavo que sobra. A recuperação continua mesmo se o robô sair de campo. Recolocação não gera crédito novo. O estoque de peças nasce em zero e é investimento, não custo mensal.`,
        first
          ? `Mês 1: compra ${formatFlex(first.bought)} ${first.bought === 1 ? 'robô' : 'robôs'}, desembolso ${money(first.capexCents / 100)}. Robôs alugados nesse mês: ${formatFlex(first.billing)}.`
          : 'Horizonte vazio.',
      ],
    },
    {
      title: 'Receita',
      lines: [
        rentText,
        `Saving líquido da loja = ${money(result.storeSaving)} − ${money(result.rentUsed)} = ${money(result.storeNetSaving)}, no primeiro ano. O robô não entra no balanço da loja. No lucro real o aluguel é despesa dedutível. O reajuste anual aumenta o aluguel e reduz esse líquido nos anos seguintes.`,
        `Tabela do mês m = aluguel × (1 + ${formatFlex(result.annualAdjustmentPct)}%) ^ piso((m − 1) ÷ 12). A loja paga esse aluguel cheio. A manutenção terceirizada é custo nosso, não uma parcela do preço.`,
        `Receita no caixa = faturamento × (1 − ${formatFlex(result.delinquencyPct)}% de inadimplência). O PIS/COFINS de ${formatFlex(result.taxRules.pisCofinsPct)}% incide sobre o faturamento bruto; a inadimplência não reduz essa base. Antes dos créditos e do IR, sobra faturamento × ${netFactor}. A comparação com a economia da loja usa o aluguel cheio, um total só.`,
        `Taxa de setup = ${money(result.setupFee)} por instalação nova ou recolocação, no mês do evento, sem inadimplência. Entra na base do PIS/COFINS e do IR. Renovação não cobra setup.`,
        sample
          ? `Exemplo no mês ${formatFlex(sample.month)}: tabela ${money(listAt(sample.month))}, robôs alugados ${formatFlex(sample.billing)}, receita no caixa ${money(sample.salesCents / 100)}.`
          : 'Sem mês de exemplo.',
      ],
    },
    {
      title: 'Manutenção e outros custos',
      lines: [
        `Manutenção terceirizada = ${money(result.maintenancePerRobot)} por robô alugado. Outra empresa faz o serviço. O custo começa no mesmo mês do aluguel, o mês seguinte à instalação, e acompanha os robôs que estão gerando mensalidade.`,
        'No mês da instalação não há aluguel nem essa manutenção. No mês parado da recolocação também não: o robô ainda não voltou a alugar.',
        sample
          ? `Mês ${formatFlex(sample.month)}: ${formatFlex(sample.billing)} ${sample.billing === 1 ? 'robô alugado' : 'robôs alugados'}, manutenção ${money(sample.maintenanceCents / 100)}.`
          : 'Sem manutenção no horizonte.',
        `Seguro + monitoramento = (${money(result.insurancePerRobot)} + ${money(result.monitoringPerRobot)}) × robôs em campo, inclusive no mês da instalação.`,
        result.margin == null
          ? 'Não há robô-mês alugado, então não há margem por robô.'
          : `Margem média por robô/mês = (receita no caixa + setup − débito de PIS/COFINS + crédito da manutenção − manutenção − seguro − monitoramento) ÷ robôs-mês alugados = ${money(result.margin)}. Ficam de fora a compra, o crédito da compra, o IR/CSLL e o valor de livro.`,
      ],
    },
    {
      title: 'Impostos (lucro real)',
      lines: taxLines(result),
    },
    {
      title: 'Contrato de um robô',
      lines: [
        `A conta de um robô usa o mesmo aluguel da frota, ${money(result.contract.rentUsed)}, sem desconto de volume, sem renovação e sem recolocação. O horizonte desse contrato é ${formatFlex(result.contract.horizon)} meses.`,
        `A manutenção desse contrato é a mesma da frota, ${money(result.contract.maintenanceMonthly)} por robô alugado, no mesmo mês do aluguel. Meses de aluguel: ${formatFlex(result.contract.billingMonths)}.`,
        `Payback do contrato: ${result.contract.label} TIR: ${contractIrr} VPL a ${formatFlex(result.discountPct)}% ao ano: ${money(result.contract.npv)}. Lucro total depois dos impostos, com residual ou valor de saída: ${money(result.contract.profit)}. IR/CSLL do contrato: ${money(result.contract.incomeTax)}.`,
      ],
    },
    {
      title: 'Payback, captação e retorno',
      lines: [
        'O caixa do mês soma compra, receita, setup, PIS/COFINS a pagar (débito menos créditos usados), IR/CSLL, manutenção, seguro, monitoramento e sucata no fim da vida. Não entra aporte, dívida nem juros: o funding é capital próprio.',
        `Payback da frota: ${monthLabel(result)} É o primeiro mês em que o acumulado, sem o valor terminal, volta a ficar maior ou igual a zero depois de ter ficado negativo.`,
        `Valor terminal, à parte = ${money(result.terminal)}: valor de livro, no mês ${formatFlex(result.horizon)}, dos robôs que ainda não completaram a vida. Acumulado no fim = ${money(result.cumulative)}; com o valor terminal = ${money(result.cumulativeWithTerminal)}.`,
        `Pior ponto = ${money(result.worst)} no mês ${formatFlex(result.worstMonth)}. Captação = pico × (1 + ${formatFlex(result.safetyMarginPct)}%) = ${money(result.raise)}.`,
        result.twoTranches
          ? `Duas tranches, somando a captação: ${trancheText}. A primeira cobre o pico até o mês anterior à segunda, com a mesma margem. Tranches não entram na TIR nem no payback.`
          : `Uma tranche no mês 1: ${money(result.raise)}. Ela não entra na TIR nem no payback.`,
        dilutionText,
        `VPL desconta o caixa do projeto depois dos impostos, com o valor terminal no último mês, a ${formatFlex(result.discountPct)}% ao ano, taxa efetiva. A taxa mensal é (1 + taxa anual) ^ (1 ÷ 12) − 1. VPL = ${money(result.npv)}.`,
        `TIR anual: ${irrText} É a taxa efetiva ao ano que zera esse VPL. O fluxo compra robô todo mês, então pode haver mais de uma raiz; a conta fica com a raiz que a busca encontra quando o VPL troca de sinal.`,
        result.suggestedRent == null
          ? `Não há mensalidade que devolva o caixa até o mês ${formatFlex(result.targetPayback)}. Com o fator líquido da receita em ${netFactor}, aumentar o aluguel não adianta.`
          : `Mensalidade mínima sugerida = menor valor, em centavos, cujo payback, sem o valor terminal, cai até o mês ${formatFlex(result.targetPayback)}: ${money(result.suggestedRent)}. A busca é binária. Ela não escreve no campo de aluguel. No repasse, o resultado usa o percentual da economia, não esse mínimo.`,
      ],
    },
  ];
}
