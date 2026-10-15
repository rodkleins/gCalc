/** Conta pura da manutenção interna. Sem DOM. */

export const MAX_PEOPLE_PER_TEAM = 2;
export const FLEET_MAX = 1000;

export const CHARGE_LINES = [
  { key: 'inss', label: 'INSS patronal', percent: 20 },
  { key: 'rat', label: 'RAT', percent: 2 },
  { key: 'terceiros', label: 'Terceiros (Sistema S)', percent: 5.8 },
  { key: 'fgts', label: 'FGTS', percent: 8 },
  { key: 'decimo', label: '13º salário', percent: 8.33 },
  { key: 'ferias', label: 'Férias + 1/3', percent: 11.11 },
  { key: 'multaFgts', label: 'Provisão da multa do FGTS (40% × 8%)', percent: 3.2 },
];

export const DEFAULTS = {
  robots: 10,
  salarySenior: 10000,
  salaryPleno: 6000,
  autoScale: true,
  includeSenior: true,
  includePleno: true,
  soloMaxRobots: 5,
  encargosMultiplier: 1.65,
  inss: 20,
  rat: 2,
  terceiros: 5.8,
  fgts: 8,
  decimo: 8.33,
  ferias: 11.11,
  multaFgts: 3.2,
  severanceOn: true,
  severanceRate: 8.33,
  hazardOn: false,
  hazardRate: 0.3,
  mealVoucher: 1020,
  healthPlan: 850,
  carRental: 2900,
  kmPerMonth: 2500,
  kmPerLiter: 12.4,
  fuelPrice: 6.34,
  tolls: 400,
  visitsPerWeek: 3.5,
  weeksPerMonth: 4.33,
  weeksPerYear: 52,
  preventivesPerYear: 4,
  correctivesPerYear: 2,
  absenteeismOn: true,
  absenteeismRate: 3,
  vacationCoverOn: true,
  vacationCoverRate: 8.33,
  turnoverRate: 25,
  replacementFactor: 1.25,
  coordinatorSalary: 12000,
  teamsPerCoordinator: 4,
  managerSalary: 18000,
  coordinatorsPerManager: 3,
  robotValue: 1300000,
  manufacturerFeeRate: 0.006,
  partsPerRobot: 0,
  partsUnfilled: true,
  overnightShare: 0,
  overnightFollow: true,
  peoplePerOvernight: 2,
  perDiem: 450,
};

export function parseBr(raw) {
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
    if (/^\d+$/.test(head) && /^\d{3}$/.test(tail)) normalized = head + tail;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function toCents(value) {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(value) * 100 + 0.5 + 1e-6);
}

export function roundMoney(value) {
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

function num(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function sanitize(raw) {
  const input = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return input;
  for (const key of Object.keys(DEFAULTS)) {
    if (raw[key] === undefined) continue;
    if (typeof DEFAULTS[key] === 'boolean') {
      if (typeof raw[key] === 'boolean') input[key] = raw[key];
      continue;
    }
    input[key] = num(raw[key], DEFAULTS[key]);
  }
  return input;
}

export function simpleChargePercent(input = DEFAULTS) {
  return CHARGE_LINES.reduce((sum, line) => sum + num(input[line.key], line.percent), 0);
}

function chargePct(input, key, fallback) {
  return num(input[key], fallback) / 100;
}

/** INSS + RAT + terceiros + FGTS, como fração do salário. */
export function directChargeRate(input = DEFAULTS) {
  return chargePct(input, 'inss', 20) + chargePct(input, 'rat', 2) + chargePct(input, 'terceiros', 5.8) + chargePct(input, 'fgts', 8);
}

/** Aviso prévio indenizado mais INSS, RAT, terceiros e FGTS sobre esse aviso. Zero se a provisão estiver desligada. */
export function severanceFraction(input = DEFAULTS) {
  if (!input.severanceOn) return 0;
  const notice = Math.max(0, num(input.severanceRate, DEFAULTS.severanceRate)) / 100;
  return notice * (1 + directChargeRate(input));
}

/** Fator que o custo aplica. O 1,65 já inclui a multa do FGTS; a rescisão soma por cima. */
export function appliedMultiplier(input = DEFAULTS) {
  return num(input.encargosMultiplier, DEFAULTS.encargosMultiplier) + severanceFraction(input);
}

/** Referência informativa: encargos + 13º + férias + multa + incidência sobre 13º e férias. Não inclui aviso prévio. */
export function incidenceMultiplier(input = DEFAULTS) {
  const direct = directChargeRate(input);
  const provisions = chargePct(input, 'decimo', 8.33) + chargePct(input, 'ferias', 11.11);
  const fine = chargePct(input, 'multaFgts', 3.2);
  return 1 + direct + provisions + fine + direct * provisions;
}

export function chargeNote(result) {
  const base = formatFlex(result.encargosMultiplier, 3);
  const fine = formatFlex(result.multaFgts);
  if (!result.severanceOn) {
    return `Provisão de rescisão desligada. O custo usa o multiplicador ${base}. A multa do FGTS (${fine}%) continua nesse fator e não cobre aviso prévio.`;
  }
  const direct = formatFlex(result.directChargeRate * 100);
  return `Multiplicador efetivo ${formatFixed(result.appliedMultiplier, 3)} = ${base} + aviso prévio ${formatFlex(result.severanceRate)}% × (1 + ${direct}% de INSS, RAT, terceiros e FGTS). A multa do FGTS (${fine}%) já está no ${base} e não entra de novo.`;
}

function ceilStable(ratio) {
  if (!(ratio > 0)) return 0;
  const nearest = Math.round(ratio);
  const snapped = Math.abs(ratio - nearest) < 1e-9 ? nearest : ratio;
  return Math.ceil(snapped - 1e-12);
}

function clampPercent(value, fallback) {
  return Math.min(100, Math.max(0, num(value, fallback)));
}

/** Fração da capacidade que sobra depois de absenteísmo e da cobertura de férias. Cada um vale 1 se estiver desligado. */
export function availabilityFactor(raw = {}) {
  const input = sanitize(raw);
  const absence = input.absenteeismOn ? clampPercent(input.absenteeismRate, DEFAULTS.absenteeismRate) / 100 : 0;
  const vacation = input.vacationCoverOn ? clampPercent(input.vacationCoverRate, DEFAULTS.vacationCoverRate) / 100 : 0;
  return (1 - absence) * (1 - vacation);
}

export function annualCapacity(visitsPerWeek, weeksPerYear, people, availability = 1) {
  const headcount = Math.min(MAX_PEOPLE_PER_TEAM, Math.max(0, people));
  const ready = Number.isFinite(availability) ? Math.max(0, availability) : 1;
  return visitsPerWeek * (headcount / MAX_PEOPLE_PER_TEAM) * weeksPerYear * ready;
}

export function teamCount(visitsYear, visitsPerWeek, weeksPerYear, people = MAX_PEOPLE_PER_TEAM, availability = 1) {
  const capacity = annualCapacity(visitsPerWeek, weeksPerYear, people, availability);
  if (!(capacity > 0)) return 1;
  return Math.max(1, ceilStable(visitsYear / capacity));
}

/** Custo mensal de substituição de um papel: pessoas × turnover × salário-base × fator ÷ 12. */
export function roleTurnoverMonthly(count, salary, turnoverPercent, replacementFactor) {
  const people = Math.max(0, count);
  const pay = Math.max(0, salary);
  const rate = clampPercent(turnoverPercent, 0) / 100;
  const factor = Math.max(0, num(replacementFactor, 0));
  return (people * pay * rate * factor) / 12;
}

function fits(visits, capacity) {
  return capacity > 0 && visits <= capacity + 1e-9;
}

/**
 * Composição e quantidade. A equipe sempre tem sênior e no máximo um pleno.
 * No automático, outra equipe só abre quando as visitas passam da capacidade da dupla.
 * Não há cota de robôs por equipe de dois.
 */
export function staffPlan(raw) {
  const input = sanitize(raw);
  const robots = input.robots;
  const visitsPerRobot = input.preventivesPerYear + input.correctivesPerYear;
  const visitsYear = robots * visitsPerRobot;
  const soloMax = Math.max(0, input.soloMaxRobots);
  const availability = availabilityFactor(input);
  const soloCap = annualCapacity(input.visitsPerWeek, input.weeksPerYear, 1, availability);
  const pairCap = annualCapacity(input.visitsPerWeek, input.weeksPerYear, 2, availability);
  let pleno = false;
  let teams = 1;
  let byVisits = 1;
  let reason = 'solo';

  if (!input.autoScale) {
    pleno = Boolean(input.includePleno);
    const people = 1 + (pleno ? 1 : 0);
    const cap = annualCapacity(input.visitsPerWeek, input.weeksPerYear, people, availability);
    byVisits = teamCount(visitsYear, input.visitsPerWeek, input.weeksPerYear, people, availability);
    if (!(cap > 0)) byVisits = 1;
    teams = byVisits;
    reason = 'manual';
  } else if (robots <= soloMax && fits(visitsYear, soloCap)) {
    byVisits = 1;
    teams = 1;
    reason = 'solo';
  } else {
    pleno = true;
    byVisits = pairCap > 0 ? teamCount(visitsYear, input.visitsPerWeek, input.weeksPerYear, 2, availability) : 1;
    teams = byVisits;
    reason = robots <= soloMax ? 'upgrade' : 'pair';
  }

  const peopleOnTeam = 1 + (pleno ? 1 : 0);
  return {
    robots,
    visitsPerRobot,
    visitsYear,
    soloMax,
    soloCap,
    pairCap,
    availability,
    teamCap: annualCapacity(input.visitsPerWeek, input.weeksPerYear, peopleOnTeam, availability),
    seniorOnTeam: true,
    pleno,
    teams,
    byVisits,
    reason,
    peopleOnTeam,
    compositionLabel: pleno ? 'Sênior + Pleno' : 'Sênior',
  };
}

function countPhrase(count, singular, plural) {
  const n = formatFlex(count);
  if (count === 1) return `1 ${singular}`;
  if (!(count > 1)) return `${n} ${singular}`;
  return `${n} ${plural}`;
}

/** Duas frases da faixa: o resultado e o motivo que decidiu a conta. */
export function staffSummary(result) {
  const robotWord = result.robotsPerTeam === 1 ? 'robô' : 'robôs';
  const resultLine = [
    countPhrase(result.teams, 'equipe', 'equipes'),
    result.compositionLabel,
    `${formatFlex(result.robotsPerTeam)} ${robotWord} por equipe`,
    countPhrase(result.coordinators, 'coordenador', 'coordenadores'),
  ].join(' · ');
  const dest = countPhrase(result.teams, 'equipe', 'equipes');
  const visits = `Pelas visitas: ${formatFlex(result.visitsYear)} de ${formatFlex(result.teamCap)} por equipe → ${dest}`;
  let reasonLine;
  if (result.reason === 'manual') {
    const pleno = result.pleno ? 'ligado' : 'desligado';
    reasonLine = `Modo manual. O pleno está ${pleno} e vale para todas as equipes. O limite de só sênior está desligado. ${visits}.`;
  } else if (result.reason === 'solo') {
    reasonLine = `Até ${formatFlex(result.soloMax)} robôs a equipe é só sênior. ${visits}.`;
  } else if (result.reason === 'upgrade') {
    reasonLine = `Até ${formatFlex(result.soloMax)} robôs, mas as visitas passam de ${formatFlex(result.soloCap)} do sênior sozinho: entra o pleno, sem abrir outra equipe só de sênior. ${visits}.`;
  } else {
    reasonLine = `A partir de ${formatFlex(result.soloMax + 1)} robôs entra o pleno. ${visits}.`;
  }
  return { resultLine, reasonLine };
}

export function coordinatorCount(teams, teamsPerCoordinator) {
  if (!(teams > 1)) return 0;
  const limit = teamsPerCoordinator > 0 ? teamsPerCoordinator : 1;
  return ceilStable(teams / limit);
}

/** Um gerente só existe a partir do limite de coordenadores. Abaixo disso, zero. */
export function managerCount(coordinators, coordinatorsPerManager) {
  const limit = coordinatorsPerManager > 0 ? coordinatorsPerManager : 1;
  if (!(coordinators >= limit)) return 0;
  return ceilStable(coordinators / limit);
}

const PREVIOUS_CORRECTIVES_DEFAULT = 6;

const PREVIOUS_PREMISE_DEFAULTS = {
  carRental: 2700,
  kmPerLiter: 10.5,
  mealVoucher: 612,
  healthPlan: 450,
};

/** Troca só o valor que ainda era o default antigo. Edição do usuário, ou o default antigo depois da migração, fica. */
export function restorePremiseDefaults(stored, alreadyMigrated) {
  const next = { ...stored };
  if (alreadyMigrated) return next;
  for (const [key, previous] of Object.entries(PREVIOUS_PREMISE_DEFAULTS)) {
    if (next[key] === previous) next[key] = DEFAULTS[key];
  }
  return next;
}

/** O 6 gravado sozinho era o default antigo. Edição do usuário (qualquer outro número, ou 6 depois da migração) fica. */
export function restoreCorrectivesPerYear(stored, alreadyMigrated) {
  if (alreadyMigrated) return stored;
  if (stored === PREVIOUS_CORRECTIVES_DEFAULT) return DEFAULTS.correctivesPerYear;
  return stored;
}

export function headcountLabel(result) {
  const parts = [`${formatFlex(result.teams)} Sênior`];
  if (result.pleno && result.teams > 0) parts.push(`${formatFlex(result.teams)} Pleno`);
  if (result.coordinators > 0) {
    parts.push(`${formatFlex(result.coordinators)} ${result.coordinators === 1 ? 'coordenador' : 'coordenadores'}`);
  }
  if (result.managers > 0) {
    parts.push(`${formatFlex(result.managers)} ${result.managers === 1 ? 'gerente' : 'gerentes'}`);
  }
  return parts.join(' · ');
}

function moneyPair(exact) {
  const cents = toCents(exact);
  return { monthly: cents / 100, annual: (cents * 12) / 100, cents };
}

export function calculate(raw = {}) {
  const input = sanitize(raw);
  const plan = staffPlan(input);
  const robots = input.robots;
  const { visitsPerRobot, visitsYear, teams, peopleOnTeam } = plan;
  const visitsPerTeamYear = plan.teamCap;
  const visitsPerFullTeamYear = plan.pairCap;
  const visitsPerTeamMonth = input.visitsPerWeek * (peopleOnTeam / MAX_PEOPLE_PER_TEAM) * input.weeksPerMonth;
  const coordinators = coordinatorCount(teams, input.teamsPerCoordinator);
  const managers = managerCount(coordinators, input.coordinatorsPerManager);
  const robotsPerTeam = teams > 0 ? robots / teams : null;
  const hazardFactor = input.hazardOn ? 1 + input.hazardRate : 1;
  const salarySum = input.salarySenior + (plan.pleno ? input.salaryPleno : 0);
  const directRate = directChargeRate(input);
  const severanceLoad = severanceFraction(input);
  const payrollFactor = appliedMultiplier(input);
  const peoplePerTeam = salarySum * hazardFactor * payrollFactor;
  const peopleMonthly = peoplePerTeam * teams;
  const technicianCount = peopleOnTeam * teams;
  const benefitsPerPerson = input.mealVoucher + input.healthPlan;
  const benefitsMonthly = (technicianCount + coordinators + managers) * benefitsPerPerson;
  const litersPerMonth = input.kmPerLiter > 0 ? input.kmPerMonth / input.kmPerLiter : 0;
  const fuelPerCar = litersPerMonth * input.fuelPrice;
  const carPerTeam = input.carRental + fuelPerCar + input.tolls;
  const carMonthly = carPerTeam * teams;
  const coordinatorUnit = input.coordinatorSalary * payrollFactor;
  const coordinationMonthly = coordinators * coordinatorUnit;
  const managerUnit = input.managerSalary * payrollFactor;
  const managementMonthly = managers * managerUnit;
  const manufacturerAnnualPerRobot = input.robotValue * input.manufacturerFeeRate;
  const manufacturerPerRobotMonth = manufacturerAnnualPerRobot / 12;
  const manufacturerMonthly = robots * manufacturerPerRobotMonth;
  const overnightPeople = input.overnightFollow ? peopleOnTeam : input.peoplePerOvernight;
  const perDiemAnnual = visitsYear * input.overnightShare * overnightPeople * input.perDiem;
  const perDiemMonthly = perDiemAnnual / 12;
  const partsInvestment = input.partsPerRobot * robots;
  const seniorCount = teams;
  const plenoCount = plan.pleno ? teams : 0;
  const seniorTurnover = roleTurnoverMonthly(seniorCount, input.salarySenior, input.turnoverRate, input.replacementFactor);
  const plenoTurnover = roleTurnoverMonthly(plenoCount, input.salaryPleno, input.turnoverRate, input.replacementFactor);
  const coordinatorTurnover = roleTurnoverMonthly(coordinators, input.coordinatorSalary, input.turnoverRate, input.replacementFactor);
  const managerTurnover = roleTurnoverMonthly(managers, input.managerSalary, input.turnoverRate, input.replacementFactor);
  const turnoverParts = [seniorTurnover, plenoTurnover, coordinatorTurnover, managerTurnover].map(moneyPair);
  const turnoverCents = turnoverParts.reduce((sum, line) => sum + line.cents, 0);
  const turnoverMonthly = turnoverCents / 100;
  const lines = {
    people: moneyPair(peopleMonthly),
    benefits: moneyPair(benefitsMonthly),
    car: moneyPair(carMonthly),
    coordination: moneyPair(coordinationMonthly),
    management: moneyPair(managementMonthly),
    turnover: { monthly: turnoverMonthly, annual: (turnoverCents * 12) / 100, cents: turnoverCents },
    manufacturer: moneyPair(manufacturerMonthly),
    perDiem: moneyPair(perDiemMonthly),
  };
  const monthlyCents = Object.values(lines).reduce((sum, line) => sum + line.cents, 0);
  const monthlyExact =
    peopleMonthly +
    benefitsMonthly +
    carMonthly +
    coordinationMonthly +
    managementMonthly +
    seniorTurnover +
    plenoTurnover +
    coordinatorTurnover +
    managerTurnover +
    manufacturerMonthly +
    perDiemMonthly;
  const monthlyRounded = monthlyCents / 100;
  const annualRounded = (monthlyCents * 12) / 100;
  const perRobotMonth = robots > 0 ? monthlyExact / robots : null;
  const perRobotRounded = robots > 0 ? toCents(monthlyRounded / robots) / 100 : null;

  return {
    ...input,
    ...plan,
    visitsPerTeamYear,
    visitsPerFullTeamYear,
    visitsPerTeamMonth,
    coordinators,
    managers,
    robotsPerTeam,
    hazardFactor,
    directChargeRate: directRate,
    severanceFraction: severanceLoad,
    appliedMultiplier: payrollFactor,
    salarySum,
    peoplePerTeam,
    peopleMonthly,
    technicianCount,
    overnightPeople,
    benefitsPerPerson,
    benefitsMonthly,
    litersPerMonth,
    fuelPerCar,
    carPerTeam,
    carMonthly,
    coordinatorUnit,
    coordinationMonthly,
    managerUnit,
    managementMonthly,
    seniorCount,
    plenoCount,
    seniorTurnover,
    plenoTurnover,
    coordinatorTurnover,
    managerTurnover,
    turnoverMonthly,
    manufacturerAnnualPerRobot,
    manufacturerPerRobotMonth,
    manufacturerMonthly,
    perDiemAnnual,
    perDiemMonthly,
    partsInvestment,
    lines,
    monthlyExact,
    monthlyRounded,
    annualRounded,
    perRobotMonth,
    perRobotRounded,
    simpleChargePercent: simpleChargePercent(input),
    incidenceMultiplier: incidenceMultiplier(input),
  };
}

export function costSeries(raw = {}, from = 1, to = FLEET_MAX) {
  const points = [];
  for (let robots = Math.ceil(from); robots <= Math.floor(to); robots += 1) {
    const result = calculate({ ...raw, robots });
    points.push({
      robots,
      perRobotMonth: result.perRobotMonth,
      perRobotRounded: result.perRobotRounded,
      monthlyRounded: result.monthlyRounded,
      teams: result.teams,
      coordinators: result.coordinators,
      managers: result.managers,
      peopleOnTeam: result.peopleOnTeam,
      compositionLabel: result.compositionLabel,
    });
  }
  return points;
}

export function plateaus(points) {
  const rows = [];
  for (const point of points) {
    const last = rows[rows.length - 1];
    if (
      !last ||
      last.teams !== point.teams ||
      last.coordinators !== point.coordinators ||
      last.managers !== point.managers ||
      last.peopleOnTeam !== point.peopleOnTeam
    ) {
      rows.push({
        from: point.robots,
        to: point.robots,
        teams: point.teams,
        coordinators: point.coordinators,
        managers: point.managers,
        peopleOnTeam: point.peopleOnTeam,
        compositionLabel: point.compositionLabel,
        perRobotAtStart: point.perRobotRounded,
        perRobotAtEnd: point.perRobotRounded,
      });
    } else {
      last.to = point.robots;
      last.perRobotAtEnd = point.perRobotRounded;
    }
  }
  return rows;
}

function brl(value) {
  return formatBRL(value);
}

function visitEquation(visitsYear, capacity, teams) {
  if (!(capacity > 0)) return '1, porque a capacidade anual desta equipe não está definida';
  const ratio = formatFixed(visitsYear / capacity, 4);
  return `máximo(1, teto(${formatFlex(visitsYear)} ÷ ${formatFlex(capacity)})) = máximo(1, teto(${ratio})) = ${formatFlex(teams)}`;
}

function availabilityClause(result) {
  const absence = result.absenteeismOn ? result.absenteeismRate : 0;
  const vacation = result.vacationCoverOn ? result.vacationCoverRate : 0;
  return `(1 − ${formatFlex(absence)}%) × (1 − ${formatFlex(vacation)}%)`;
}

function teamSentence(result) {
  const summary = staffSummary(result);
  const people = result.peopleOnTeam;
  const cap = formatFlex(result.teamCap);
  const sized = `A capacidade desta equipe é ${formatFlex(result.visitsPerWeek)} × (${formatFlex(people)} ÷ 2) × ${formatFlex(result.weeksPerYear)} × ${availabilityClause(result)} = ${cap} visitas/ano.`;
  return `${summary.resultLine}. ${summary.reasonLine} ${sized} Equipes = ${visitEquation(result.visitsYear, result.teamCap, result.teams)}.`;
}

function turnoverRoleLine(result, label, count, salary, amount) {
  return `${label} = ${formatFlex(count)} × ${formatFlex(result.turnoverRate)}% × ${brl(salary)} × ${formatFlex(result.replacementFactor)} ÷ 12 = ${brl(amount)}.`;
}

export function explain(result) {
  const coordinatorLine =
    result.teams <= 1
      ? 'Coordenadores = 0, porque a coordenação só existe quando há mais de uma equipe.'
      : `Coordenadores = teto(${formatFlex(result.teams)} ÷ ${formatFlex(result.teamsPerCoordinator)}) = teto(${formatFixed(result.teams / result.teamsPerCoordinator, 4)}) = ${formatFlex(result.coordinators)}.`;
  const hazardLine = result.hazardOn
    ? `Periculosidade ligada: ${formatFlex(result.hazardRate * 100)}% sobre o salário-base de quem está na equipe (fator ${formatFlex(result.hazardFactor, 3)}). Não incide sobre o coordenador nem sobre VR e plano.`
    : 'Periculosidade desligada. O fator sobre o salário-base é 1.';
  const factor = formatFixed(result.appliedMultiplier, 3);
  const peopleLine = result.hazardOn
    ? `Folha de uma equipe = ${brl(result.salarySum)} × ${formatFlex(result.hazardFactor, 3)} × ${factor} = ${brl(result.peoplePerTeam)}.`
    : `Folha de uma equipe = ${brl(result.salarySum)} × ${factor} = ${brl(result.peoplePerTeam)}, sem periculosidade.`;
  const directPct = result.directChargeRate * 100;
  const reflectionPct = result.severanceRate * result.directChargeRate;
  const severanceLines = result.severanceOn
    ? [
        `Provisão da multa do FGTS: ${formatFlex(result.multaFgts)}% do salário (40% × 8% de FGTS). Já está dentro do multiplicador ${formatFlex(result.encargosMultiplier, 3)}. Cobre só essa multa, não o aviso prévio indenizado.`,
        `Provisão de rescisão ligada. Aviso prévio indenizado = ${formatFlex(result.severanceRate)}% do salário. Reflexos de INSS, RAT, terceiros e FGTS = ${formatFlex(result.severanceRate)}% × ${formatFlex(directPct)}% = ${formatFlex(reflectionPct)}%.`,
        `Parcela da rescisão = ${formatFlex(result.severanceRate)}% × (1 + ${formatFlex(directPct)}%) = ${formatFlex(result.severanceFraction * 100)}% do salário (${formatFixed(result.severanceFraction, 3)} no multiplicador).`,
        `Multiplicador efetivo = ${formatFlex(result.encargosMultiplier, 3)} + ${formatFixed(result.severanceFraction, 3)} = ${factor}. Vale para técnicos e coordenador. A multa de 40% do FGTS não é somada de novo.`,
      ]
    : [
        `Provisão da multa do FGTS: ${formatFlex(result.multaFgts)}% do salário (40% × 8% de FGTS). Já está dentro do multiplicador ${formatFlex(result.encargosMultiplier, 3)}. Cobre só essa multa, não o aviso prévio indenizado.`,
        `Provisão de rescisão desligada. O aviso prévio indenizado não entra. Multiplicador efetivo = ${factor}.`,
      ];
  const salaryLine = result.pleno
    ? `Salários de uma equipe = ${brl(result.salarySenior)} (sênior) + ${brl(result.salaryPleno)} (pleno) = ${brl(result.salarySum)}.`
    : `Salários de uma equipe = ${brl(result.salarySenior)} (sênior). O pleno não entra. Total = ${brl(result.salarySum)}.`;
  const partsLine = result.partsUnfilled
    ? `Estoque de peças por robô não informado (campo em branco). Investimento inicial no mês 0 = ${brl(0)}. Não entra no custo mensal.`
    : `Investimento inicial em peças (mês 0) = ${brl(result.partsPerRobot)} × ${formatFlex(result.robots)} robôs = ${brl(result.partsInvestment)}. Não entra no custo mensal.`;
  const overnightLine = result.overnightFollow
    ? `Pessoas por pernoite = ${formatFlex(result.overnightPeople)}, o tamanho da equipe que visita.`
    : `Pessoas por pernoite = ${formatFlex(result.overnightPeople)}, valor fixado no campo.`;

  return [
    {
      title: 'Visitas e equipes',
      lines: [
        `Visitas no ano = ${formatFlex(result.robots)} robôs × (${formatFlex(result.preventivesPerYear)} preventivas + ${formatFlex(result.correctivesPerYear)} corretivas (premissa)) = ${formatFlex(result.visitsYear)} visitas.`,
        `O campo de visitas por semana vale para a equipe cheia de 2 pessoas. Quem viaja sozinho faz a metade: visitas/semana × (pessoas ÷ 2).`,
        `Disponibilidade = ${availabilityClause(result)} = ${formatFixed(result.availability, 3)}. Absenteísmo e cobertura de férias só reduzem visitas; o salário dessas ausências não é somado de novo.`,
        `Capacidade anual da dupla = ${formatFlex(result.visitsPerWeek)} × (2 ÷ 2) × ${formatFlex(result.weeksPerYear)} × ${availabilityClause(result)} = ${formatFlex(result.pairCap)} visitas/ano.`,
        `Capacidade anual de uma pessoa = metade da dupla = ${formatFlex(result.soloCap)} visitas/ano.`,
        `Referência mensal desta equipe = ${formatFlex(result.visitsPerWeek)} × (${formatFlex(result.peopleOnTeam)} ÷ 2) × ${formatFlex(result.weeksPerMonth)} semanas/mês = ${formatFlex(result.visitsPerTeamMonth)} visitas/mês. Este fator mensal não entra na divisão de equipes.`,
        teamSentence(result),
        coordinatorLine,
        `Robôs por equipe = ${formatFlex(result.robots)} ÷ ${formatFlex(result.teams)} = ${formatFlex(result.robotsPerTeam)}.`,
      ],
    },
    {
      title: 'Pessoas e encargos',
      lines: [
        salaryLine,
        hazardLine,
        peopleLine,
        `Folha no mês = ${brl(result.peoplePerTeam)} × ${formatFlex(result.teams)} ${result.teams === 1 ? 'equipe' : 'equipes'} = ${brl(result.lines.people.monthly)}.`,
        ...CHARGE_LINES.map(
          (line) => `${line.label}: ${formatFlex(result[line.key])}% sobre o salário-base (composição exibida; não substitui o multiplicador).`,
        ),
        ...severanceLines,
        `Multiplicador base de encargos = ${formatFlex(result.encargosMultiplier, 3)}. Soma simples das alíquotas desse fator = ${formatFlex(result.simpleChargePercent)}%. Referência com incidência sobre 13º e férias = ${formatFixed(result.incidenceMultiplier, 3)}. O custo usa o multiplicador efetivo ${factor}.`,
      ],
    },
    {
      title: 'Benefícios',
      lines: [
        `Benefício por pessoa = ${brl(result.mealVoucher)} de VR + ${brl(result.healthPlan)} de plano = ${brl(result.benefitsPerPerson)}. Sem encargos em cima do benefício.`,
        `Benefícios no mês = (${formatFlex(result.technicianCount)} pessoas nas equipes + ${formatFlex(result.coordinators)} coordenadores + ${formatFlex(result.managers)} gerentes) × ${brl(result.benefitsPerPerson)} = ${brl(result.lines.benefits.monthly)}. Cada pessoa real entra uma vez.`,
      ],
    },
    {
      title: 'Carro',
      lines: [
        `Combustível de um carro = (${formatFlex(result.kmPerMonth)} km ÷ ${formatFlex(result.kmPerLiter)} km/L) × ${brl(result.fuelPrice)} = ${brl(result.fuelPerCar)}.`,
        `Carro por equipe = ${brl(result.carRental)} de locação + ${brl(result.fuelPerCar)} de combustível + ${brl(result.tolls)} de pedágio e estacionamento = ${brl(result.carPerTeam)}.`,
        `Carro no mês = ${brl(result.carPerTeam)} × ${formatFlex(result.teams)} = ${brl(result.lines.car.monthly)}. A cabine da Fiorino leva 2 pessoas, então cada equipe tem o próprio furgão.`,
      ],
    },
    {
      title: 'Coordenação',
      lines: [
        `Cada coordenador = ${brl(result.coordinatorSalary)} × ${formatFixed(result.appliedMultiplier, 3)} = ${brl(result.coordinatorUnit)}. O mesmo multiplicador efetivo dos técnicos, inclusive a provisão de rescisão quando está ligada. Os benefícios dele estão na linha de benefícios. Sem periculosidade.`,
        `Coordenação no mês = ${formatFlex(result.coordinators)} × ${brl(result.coordinatorUnit)} = ${brl(result.lines.coordination.monthly)}.`,
      ],
    },
    {
      title: 'Gerência',
      lines: [
        result.managers > 0
          ? `Gerentes = teto(${formatFlex(result.coordinators)} ÷ ${formatFlex(result.coordinatorsPerManager)}) = teto(${formatFixed(result.coordinators / result.coordinatorsPerManager, 4)}) = ${formatFlex(result.managers)}, porque há pelo menos ${formatFlex(result.coordinatorsPerManager)} coordenadores.`
          : `Gerentes = 0, porque ${formatFlex(result.coordinators)} coordenadores ficam abaixo de ${formatFlex(result.coordinatorsPerManager)}.`,
        `Cada gerente = ${brl(result.managerSalary)} × ${formatFixed(result.appliedMultiplier, 3)} = ${brl(result.managerUnit)}. Os mesmos encargos dos técnicos, inclusive a provisão de rescisão quando está ligada. Sem periculosidade. Os benefícios entram na linha de benefícios.`,
        `Gerência no mês = ${formatFlex(result.managers)} × ${brl(result.managerUnit)} = ${brl(result.lines.management.monthly)}.`,
      ],
    },
    {
      title: 'Turnover',
      lines: [
        `Turnover = ${formatFlex(result.turnoverRate)}% ao ano. Cada substituição custa ${formatFlex(result.replacementFactor)} salário-base mensal do papel e cobre rescisão não provisionada, recrutamento, treinamento e curva de aprendizado. Não multiplica encargos nem periculosidade. O salário de férias continua só nos encargos.`,
        turnoverRoleLine(result, 'Sênior', result.seniorCount, result.salarySenior, result.seniorTurnover),
        turnoverRoleLine(result, 'Pleno', result.plenoCount, result.salaryPleno, result.plenoTurnover),
        turnoverRoleLine(result, 'Coordenadores', result.coordinators, result.coordinatorSalary, result.coordinatorTurnover),
        turnoverRoleLine(result, 'Gerentes', result.managers, result.managerSalary, result.managerTurnover),
        `Turnover no mês = ${brl(result.lines.turnover.monthly)}. A soma dos papéis entra arredondada por papel.`,
      ],
    },
    {
      title: 'Fabricante',
      lines: [
        `Taxa por robô no ano = ${brl(result.robotValue)} × ${formatFlex(result.manufacturerFeeRate * 100)}% = ${brl(result.manufacturerAnnualPerRobot)}.`,
        `Fabricante no mês = ${formatFlex(result.robots)} × ${brl(result.manufacturerAnnualPerRobot)} ÷ 12 = ${brl(result.lines.manufacturer.monthly)}.`,
      ],
    },
    {
      title: 'Diárias',
      lines: [
        overnightLine,
        `Diárias no ano = ${formatFlex(result.visitsYear)} visitas × ${formatFlex(result.overnightShare * 100)}% × ${formatFlex(result.overnightPeople)} pessoas × ${brl(result.perDiem)} = ${brl(result.perDiemAnnual)}.`,
        `Diárias no mês = ${brl(result.perDiemAnnual)} ÷ 12 = ${brl(result.lines.perDiem.monthly)}.`,
      ],
    },
    {
      title: 'Totais',
      lines: [
        `Custo mensal = ${brl(result.lines.people.monthly)} + ${brl(result.lines.benefits.monthly)} + ${brl(result.lines.car.monthly)} + ${brl(result.lines.coordination.monthly)} + ${brl(result.lines.management.monthly)} + ${brl(result.lines.turnover.monthly)} + ${brl(result.lines.manufacturer.monthly)} + ${brl(result.lines.perDiem.monthly)} = ${brl(result.monthlyRounded)}. Cada linha entra arredondada no centavo.`,
        `Custo anual = ${brl(result.monthlyRounded)} × 12 = ${brl(result.annualRounded)}.`,
        `Custo por robô/mês = ${brl(result.monthlyRounded)} ÷ ${formatFlex(result.robots)} = ${brl(result.perRobotRounded)}.`,
        partsLine,
      ],
    },
  ];
}
