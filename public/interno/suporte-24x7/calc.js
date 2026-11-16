/**
 * Custo e preço do Suporte 24x7 (sobreaviso). Uso interno.
 * Quem fica de plantão já está na folha: este cálculo não soma o salário inteiro.
 */

export const MONTH_HOURS = 720;
export const WEEKDAY_MULTIPLIER = 1.5;
export const SUNDAY_MULTIPLIER = 2;
export const NIGHT_BONUS = 0.2;
export const NIGHT_WINDOW = '22h–5h';

export const PLANS = {
  p1: 'Só P1',
  p1p2: 'P1+P2',
};

export const PRIORITIES = [
  { id: 'P1', level: 'crítico', text: 'produção parada ou liberação de lote bloqueada, sem contorno' },
  { id: 'P2', level: 'alto', text: 'impacto sério, com contorno' },
  { id: 'P3', level: 'médio', text: 'espera o próximo dia útil' },
  { id: 'P4', level: 'baixo', text: 'espera o próximo dia útil' },
];

export const DEFAULTS = {
  salary: 10000,
  charges: 2,
  hourDivisor: 220,
  monthHours: MONTH_HOURS,
  workdays: 22,
  hoursPerDay: 8.5,
  standbyFraction: 1 / 3,
  weekdayHours: 10,
  sundayHours: 0,
  nightHours: 0,
  nightBase: 'weekday',
  people: 1,
  marginPct: null,
  includedHours: null,
  extraHourPrice: null,
  toolsCost: 0,
  plan: 'p1p2',
};

export const DISCLAIMER =
  'O cálculo assume que quem fica de plantão já está na folha da T2 (uma contratação dedicada somaria o salário inteiro). Ferramentas e outros custos ficam fora do RH, no campo opcional. Não há dados de acionamento no Jira: as 10 h padrão são uma suposição.';

export const JIRA_WARNING = '10 h é suposição, ainda sem dados do Jira';

export function parseBr(text) {
  if (text == null) return null;
  let raw = String(text).trim().replace(/\s/g, '').replace('%', '').replace('R$', '');
  if (!raw || raw === '-' || raw === ',' || raw === '.') return null;
  const fraction = raw.match(/^(-?\d+(?:[.,]\d+)?)\/(-?\d+(?:[.,]\d+)?)$/);
  if (fraction) {
    const num = parseBr(fraction[1]);
    const den = parseBr(fraction[2]);
    if (num == null || den == null || den === 0) return null;
    return num / den;
  }
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    raw = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (comma >= 0) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (dot >= 0) {
    const parts = raw.split('.');
    if (parts.length > 1 && parts.slice(1).every((part) => part.length === 3)) raw = parts.join('');
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function clampPeople(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULTS.people;
  return Math.min(4, Math.max(1, n));
}

function num(value, fallback = 0) {
  return value == null || !Number.isFinite(value) ? fallback : value;
}

function nonNeg(value, fallback = 0) {
  const n = num(value, fallback);
  return n < 0 ? 0 : n;
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatNumber(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatHours(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 100) / 100;
  const digits = Number.isInteger(rounded) ? 0 : Math.round(rounded * 10) === rounded * 10 ? 1 : 2;
  return `${formatNumber(rounded, digits)} h`;
}

export function formatBRL(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(roundMoney(value));
}

export function formatPct(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatFraction(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value - 1 / 3) < 1e-9) return '1/3';
  return formatNumber(value, 4);
}

export function planLabel(plan) {
  return PLANS[plan] ?? PLANS.p1p2;
}

export function defaultsInput() {
  return { ...DEFAULTS };
}

export function evaluate(input = {}) {
  const src = { ...DEFAULTS, ...input };
  const salary = nonNeg(src.salary, DEFAULTS.salary);
  const charges = nonNeg(src.charges, DEFAULTS.charges);
  const hourDivisor = src.hourDivisor == null || !Number.isFinite(src.hourDivisor) || src.hourDivisor === 0
    ? DEFAULTS.hourDivisor
    : src.hourDivisor;
  const monthHours = nonNeg(src.monthHours, DEFAULTS.monthHours);
  const workdays = nonNeg(src.workdays, DEFAULTS.workdays);
  const hoursPerDay = nonNeg(src.hoursPerDay, DEFAULTS.hoursPerDay);
  const standbyFraction = nonNeg(src.standbyFraction, DEFAULTS.standbyFraction);
  const weekdayHours = nonNeg(src.weekdayHours, 0);
  const sundayHours = nonNeg(src.sundayHours, 0);
  const nightHours = nonNeg(src.nightHours, 0);
  const nightBase = src.nightBase === 'sunday' ? 'sunday' : 'weekday';
  const people = clampPeople(src.people);
  const marginPct = src.marginPct == null || !Number.isFinite(src.marginPct) ? null : src.marginPct;
  const includedHours = src.includedHours == null || !Number.isFinite(src.includedHours) ? null : Math.max(0, src.includedHours);
  const extraHourPrice = src.extraHourPrice == null || !Number.isFinite(src.extraHourPrice) ? null : Math.max(0, src.extraHourPrice);
  const toolsCost = nonNeg(src.toolsCost, 0);
  const plan = src.plan === 'p1' ? 'p1' : 'p1p2';

  const commercialHours = workdays * hoursPerDay;
  const offHours = monthHours - commercialHours;
  const hourValue = hourDivisor === 0 ? 0 : salary / hourDivisor;
  const paidStandbyHours = offHours * standbyFraction;
  const standbyCostGross = roundMoney(hourValue * paidStandbyHours);
  const standbyCost = roundMoney(standbyCostGross * charges);

  const weekdayRate = hourValue * WEEKDAY_MULTIPLIER;
  const sundayRate = hourValue * SUNDAY_MULTIPLIER;
  const nightBaseRate = nightBase === 'sunday' ? sundayRate : weekdayRate;
  const nightRate = nightBaseRate * (1 + NIGHT_BONUS);

  const weekdayCostGross = roundMoney(weekdayHours * weekdayRate);
  const sundayCostGross = roundMoney(sundayHours * sundayRate);
  const nightCostGross = roundMoney(nightHours * nightRate);
  const activationHours = weekdayHours + sundayHours + nightHours;
  const activationCostGross = roundMoney(weekdayCostGross + sundayCostGross + nightCostGross);
  const weekdayCost = roundMoney(weekdayCostGross * charges);
  const sundayCost = roundMoney(sundayCostGross * charges);
  const nightCost = roundMoney(nightCostGross * charges);
  const activationCost = roundMoney(weekdayCost + sundayCost + nightCost);

  const weekdayRateCharged = roundMoney(weekdayRate * charges);
  const sundayRateCharged = roundMoney(sundayRate * charges);
  const nightRateCharged = roundMoney(nightRate * charges);

  const rhCost = roundMoney(standbyCost + activationCost);
  const totalCost = roundMoney(rhCost + toolsCost);
  const margin = marginPct == null ? null : marginPct / 100;
  const price = margin == null ? null : roundMoney(totalCost * (1 + margin));
  const suggestedExtraHour = margin == null ? null : roundMoney(weekdayRateCharged * (1 + margin));
  const extraHour = extraHourPrice ?? suggestedExtraHour;

  const perPerson = {
    people,
    offHours: offHours / people,
    paidStandbyHours: paidStandbyHours / people,
    activationHours: activationHours / people,
    rhCost: rhCost / people,
  };

  const commercialLine = `${formatNumber(workdays, 0)} dias úteis × ${formatHours(hoursPerDay)} = ${formatHours(commercialHours)} comerciais`;
  const offLine = `${formatHours(monthHours)} − ${formatHours(commercialHours)} = ${formatHours(offHours)} fora do expediente`;
  const paidLine = `${formatHours(offHours)} × ${formatFraction(standbyFraction)} = ${formatHours(paidStandbyHours)} pagas de sobreaviso`;

  const memory = [
    {
      title: 'Valor da hora',
      lines: [
        `Salário ${formatBRL(salary)} ÷ divisor CLT ${formatNumber(hourDivisor, 0)} = ${formatBRL(hourValue)}.`,
      ],
    },
    {
      title: 'Expediente e sobreaviso',
      lines: [
        commercialLine + '.',
        offLine + '.',
        paidLine + '.',
        `Custo sem encargos: ${formatBRL(hourValue)} × ${formatHours(paidStandbyHours)} = ${formatBRL(standbyCostGross)}.`,
        `Custo com encargos (× ${formatNumber(charges, 2)}): ${formatBRL(standbyCost)}.`,
      ],
    },
    {
      title: 'Acionamentos',
      lines: [
        `Dia útil: hora × ${formatNumber(WEEKDAY_MULTIPLIER, 1)} = ${formatBRL(weekdayRate)}/h (com encargos ${formatBRL(weekdayRateCharged)}/h). ${formatHours(weekdayHours)} → ${formatBRL(weekdayCostGross)} sem encargos, ${formatBRL(weekdayCost)} com encargos.`,
        `Domingo ou feriado: hora × ${formatNumber(SUNDAY_MULTIPLIER, 1)} = ${formatBRL(sundayRate)}/h (com encargos ${formatBRL(sundayRateCharged)}/h). ${formatHours(sundayHours)} → ${formatBRL(sundayCostGross)} sem encargos, ${formatBRL(sundayCost)} com encargos.`,
        `Noturno (${NIGHT_WINDOW}): +${formatPct(NIGHT_BONUS)} sobre a hora de acionamento em ${nightBase === 'sunday' ? 'domingo ou feriado' : 'dia útil'} = ${formatBRL(nightRate)}/h (com encargos ${formatBRL(nightRateCharged)}/h). ${formatHours(nightHours)} → ${formatBRL(nightCostGross)} sem encargos, ${formatBRL(nightCost)} com encargos.`,
        `Total dos acionamentos: ${formatHours(activationHours)} = ${formatBRL(activationCostGross)} sem encargos, ${formatBRL(activationCost)} com encargos. ${JIRA_WARNING}.`,
      ],
    },
    {
      title: 'Custo de RH e preço',
      lines: [
        `RH/mês = sobreaviso ${formatBRL(standbyCost)} + acionamentos ${formatBRL(activationCost)} = ${formatBRL(rhCost)}.`,
        `Ferramentas e outros custos (fora do RH): ${formatBRL(toolsCost)}.`,
        `Custo total = ${formatBRL(rhCost)} + ${formatBRL(toolsCost)} = ${formatBRL(totalCost)}.`,
        margin == null
          ? 'A margem está em branco: o preço depende da margem.'
          : `Preço (mensalidade) = ${formatBRL(totalCost)} × (1 + ${formatPct(margin)}) = ${formatBRL(price)}.`,
        suggestedExtraHour == null
          ? 'Sugestão da hora excedente: custo da hora de acionamento em dia útil com encargos × (1 + margem), quando a margem for informada.'
          : `Sugestão da hora excedente: ${formatBRL(weekdayRateCharged)} × (1 + ${formatPct(margin)}) = ${formatBRL(suggestedExtraHour)} (custo da hora de acionamento em dia útil com encargos, mais a margem).`,
        extraHourPrice == null
          ? 'O preço da hora excedente não foi preenchido.'
          : `Hora excedente informada: ${formatBRL(extraHourPrice)}.`,
        includedHours == null
          ? 'As horas incluídas na mensalidade não foram definidas.'
          : `Horas incluídas na mensalidade: ${formatHours(includedHours)}.`,
        `Plano desta proposta: ${planLabel(plan)}. Os planos só mudam o rótulo; as horas de acionamento são as que você digitou.`,
        people === 1
          ? 'Escala de 1 pessoa: o custo de RH não se divide.'
          : `Escala de ${formatNumber(people, 0)} pessoas: o custo de RH não muda (${formatBRL(rhCost)}); por pessoa, ${formatHours(perPerson.offHours)} fora do expediente, ${formatHours(perPerson.paidStandbyHours)} pagas de sobreaviso, ${formatHours(perPerson.activationHours)} de acionamento e ${formatBRL(perPerson.rhCost)}.`,
      ],
    },
  ];

  return {
    salary,
    charges,
    hourDivisor,
    monthHours,
    workdays,
    hoursPerDay,
    standbyFraction,
    weekdayHours,
    sundayHours,
    nightHours,
    nightBase,
    people,
    marginPct,
    margin,
    includedHours,
    extraHourPrice,
    toolsCost,
    plan,
    planLabel: planLabel(plan),
    commercialHours,
    offHours,
    hourValue,
    paidStandbyHours,
    standbyCostGross,
    standbyCost,
    weekdayRate,
    sundayRate,
    nightRate,
    weekdayRateCharged,
    sundayRateCharged,
    nightRateCharged,
    weekdayCostGross,
    sundayCostGross,
    nightCostGross,
    weekdayCost,
    sundayCost,
    nightCost,
    activationHours,
    activationCostGross,
    activationCost,
    rhCost,
    totalCost,
    price,
    suggestedExtraHour,
    extraHour,
    perPerson,
    commercialLine,
    offLine,
    paidLine,
    memory,
    disclaimer: DISCLAIMER,
    jiraWarning: JIRA_WARNING,
  };
}
