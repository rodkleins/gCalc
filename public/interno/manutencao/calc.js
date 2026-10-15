/** Conta pura da manutenção interna. Sem DOM. */

export const TECHNICIANS_PER_TEAM = 3;

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
  salaryJunior: 3500,
  encargosMultiplier: 1.65,
  inss: 20,
  rat: 2,
  terceiros: 5.8,
  fgts: 8,
  decimo: 8.33,
  ferias: 11.11,
  multaFgts: 3.2,
  hazardOn: false,
  hazardRate: 0.3,
  mealVoucher: 612,
  healthPlan: 450,
  carRental: 2700,
  kmPerMonth: 2500,
  kmPerLiter: 10.5,
  fuelPrice: 6.34,
  tolls: 400,
  visitsPerWeek: 3.5,
  weeksPerMonth: 4.33,
  weeksPerYear: 52,
  preventivesPerYear: 4,
  correctivesPerYear: 6,
  coordinatorSalary: 12000,
  teamsPerCoordinator: 4,
  robotValue: 1300000,
  manufacturerFeeRate: 0.006,
  partsPerRobot: 0,
  partsUnfilled: true,
  overnightShare: 0,
  peoplePerOvernight: 3,
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

/** Referência informativa: encargos + 13º + férias + multa + incidência sobre 13º e férias. */
export function incidenceMultiplier(input = DEFAULTS) {
  const pct = (key, fallback) => num(input[key], fallback) / 100;
  const direct = pct('inss', 20) + pct('rat', 2) + pct('terceiros', 5.8) + pct('fgts', 8);
  const provisions = pct('decimo', 8.33) + pct('ferias', 11.11);
  const fine = pct('multaFgts', 3.2);
  return 1 + direct + provisions + fine + direct * provisions;
}

function ceilStable(ratio) {
  if (!(ratio > 0)) return 0;
  const nearest = Math.round(ratio);
  const snapped = Math.abs(ratio - nearest) < 1e-9 ? nearest : ratio;
  return Math.ceil(snapped - 1e-12);
}

export function teamCount(visitsYear, visitsPerWeek, weeksPerYear) {
  const capacity = visitsPerWeek * weeksPerYear;
  if (!(capacity > 0)) return 1;
  return Math.max(1, ceilStable(visitsYear / capacity));
}

export function coordinatorCount(teams, teamsPerCoordinator) {
  if (!(teams > 1)) return 0;
  const limit = teamsPerCoordinator > 0 ? teamsPerCoordinator : 1;
  return ceilStable(teams / limit);
}

function moneyPair(exact) {
  const cents = toCents(exact);
  return { monthly: cents / 100, annual: (cents * 12) / 100, cents };
}

export function calculate(raw = {}) {
  const input = sanitize(raw);
  const robots = input.robots;
  const visitsPerRobot = input.preventivesPerYear + input.correctivesPerYear;
  const visitsYear = robots * visitsPerRobot;
  const visitsPerTeamYear = input.visitsPerWeek * input.weeksPerYear;
  const visitsPerTeamMonth = input.visitsPerWeek * input.weeksPerMonth;
  const teams = teamCount(visitsYear, input.visitsPerWeek, input.weeksPerYear);
  const coordinators = coordinatorCount(teams, input.teamsPerCoordinator);
  const robotsPerTeam = teams > 0 ? robots / teams : null;
  const hazardFactor = input.hazardOn ? 1 + input.hazardRate : 1;
  const salarySum = input.salarySenior + input.salaryPleno + input.salaryJunior;
  const peoplePerTeam = salarySum * hazardFactor * input.encargosMultiplier;
  const peopleMonthly = peoplePerTeam * teams;
  const technicianCount = TECHNICIANS_PER_TEAM * teams;
  const benefitsPerPerson = input.mealVoucher + input.healthPlan;
  const benefitsMonthly = (technicianCount + coordinators) * benefitsPerPerson;
  const litersPerMonth = input.kmPerLiter > 0 ? input.kmPerMonth / input.kmPerLiter : 0;
  const fuelPerCar = litersPerMonth * input.fuelPrice;
  const carPerTeam = input.carRental + fuelPerCar + input.tolls;
  const carMonthly = carPerTeam * teams;
  const coordinatorUnit = input.coordinatorSalary * input.encargosMultiplier;
  const coordinationMonthly = coordinators * coordinatorUnit;
  const manufacturerAnnualPerRobot = input.robotValue * input.manufacturerFeeRate;
  const manufacturerPerRobotMonth = manufacturerAnnualPerRobot / 12;
  const manufacturerMonthly = robots * manufacturerPerRobotMonth;
  const perDiemAnnual = visitsYear * input.overnightShare * input.peoplePerOvernight * input.perDiem;
  const perDiemMonthly = perDiemAnnual / 12;
  const partsInvestment = input.partsPerRobot * robots;
  const lines = {
    people: moneyPair(peopleMonthly),
    benefits: moneyPair(benefitsMonthly),
    car: moneyPair(carMonthly),
    coordination: moneyPair(coordinationMonthly),
    manufacturer: moneyPair(manufacturerMonthly),
    perDiem: moneyPair(perDiemMonthly),
  };
  const monthlyCents = Object.values(lines).reduce((sum, line) => sum + line.cents, 0);
  const monthlyExact =
    peopleMonthly + benefitsMonthly + carMonthly + coordinationMonthly + manufacturerMonthly + perDiemMonthly;
  const monthlyRounded = monthlyCents / 100;
  const annualRounded = (monthlyCents * 12) / 100;
  const perRobotMonth = robots > 0 ? monthlyExact / robots : null;
  const perRobotRounded = robots > 0 ? toCents(monthlyRounded / robots) / 100 : null;

  return {
    ...input,
    visitsPerRobot,
    visitsYear,
    visitsPerTeamYear,
    visitsPerTeamMonth,
    teams,
    coordinators,
    robotsPerTeam,
    hazardFactor,
    salarySum,
    peoplePerTeam,
    peopleMonthly,
    technicianCount,
    benefitsPerPerson,
    benefitsMonthly,
    litersPerMonth,
    fuelPerCar,
    carPerTeam,
    carMonthly,
    coordinatorUnit,
    coordinationMonthly,
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

export function costSeries(raw = {}, from = 1, to = 200) {
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
    });
  }
  return points;
}

export function plateaus(points) {
  const rows = [];
  for (const point of points) {
    const last = rows[rows.length - 1];
    if (!last || last.teams !== point.teams || last.coordinators !== point.coordinators) {
      rows.push({
        from: point.robots,
        to: point.robots,
        teams: point.teams,
        coordinators: point.coordinators,
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

export function explain(result) {
  const capacity = result.visitsPerTeamYear;
  const teamRatio = capacity > 0 ? result.visitsYear / capacity : null;
  const teamLine =
    teamRatio == null
      ? `Equipes = 1 (capacidade anual inválida; o mínimo é 1).`
      : `Equipes = máximo(1, teto(${formatFlex(result.visitsYear)} ÷ ${formatFlex(capacity)})) = máximo(1, teto(${formatFixed(teamRatio, 4)})) = ${formatFlex(result.teams)}.`;
  const coordinatorLine =
    result.teams <= 1
      ? 'Coordenadores = 0, porque a coordenação só existe quando há mais de uma equipe.'
      : `Coordenadores = teto(${formatFlex(result.teams)} ÷ ${formatFlex(result.teamsPerCoordinator)}) = teto(${formatFixed(result.teams / result.teamsPerCoordinator, 4)}) = ${formatFlex(result.coordinators)}.`;
  const hazardLine = result.hazardOn
    ? `Periculosidade ligada: ${formatFlex(result.hazardRate * 100)}% sobre o salário-base dos três técnicos (fator ${formatFlex(result.hazardFactor, 3)}). Não incide sobre o coordenador nem sobre VR e plano.`
    : 'Periculosidade desligada. O fator sobre o salário-base é 1.';
  const peopleLine = result.hazardOn
    ? `Pessoas por equipe = ${brl(result.salarySum)} × ${formatFlex(result.hazardFactor, 3)} × ${formatFlex(result.encargosMultiplier, 3)} = ${brl(result.peoplePerTeam)}.`
    : `Pessoas por equipe = ${brl(result.salarySum)} × ${formatFlex(result.encargosMultiplier, 3)} = ${brl(result.peoplePerTeam)}, sem periculosidade.`;
  const partsLine = result.partsUnfilled
    ? `Estoque de peças por robô não informado (campo em branco). Investimento inicial no mês 0 = ${brl(0)}. Não entra no custo mensal.`
    : `Investimento inicial em peças (mês 0) = ${brl(result.partsPerRobot)} × ${formatFlex(result.robots)} robôs = ${brl(result.partsInvestment)}. Não entra no custo mensal.`;

  return [
    {
      title: 'Visitas e equipes',
      lines: [
        `Visitas no ano = ${formatFlex(result.robots)} robôs × (${formatFlex(result.preventivesPerYear)} preventivas + ${formatFlex(result.correctivesPerYear)} corretivas (premissa)) = ${formatFlex(result.visitsYear)} visitas.`,
        `Capacidade anual da equipe = ${formatFlex(result.visitsPerWeek)} visitas/semana × ${formatFlex(result.weeksPerYear)} semanas = ${formatFlex(capacity)} visitas/ano.`,
        `Referência mensal = ${formatFlex(result.visitsPerWeek)} × ${formatFlex(result.weeksPerMonth)} semanas/mês = ${formatFlex(result.visitsPerTeamMonth)} visitas/mês. Este fator mensal não entra na divisão de equipes.`,
        teamLine,
        coordinatorLine,
        `Robôs por equipe = ${formatFlex(result.robots)} ÷ ${formatFlex(result.teams)} = ${formatFlex(result.robotsPerTeam)}.`,
      ],
    },
    {
      title: 'Pessoas e encargos',
      lines: [
        `Salários da equipe = ${brl(result.salarySenior)} (sênior) + ${brl(result.salaryPleno)} (pleno) + ${brl(result.salaryJunior)} (júnior) = ${brl(result.salarySum)}.`,
        hazardLine,
        peopleLine,
        `Pessoas no mês = ${brl(result.peoplePerTeam)} × ${formatFlex(result.teams)} ${result.teams === 1 ? 'equipe' : 'equipes'} = ${brl(result.lines.people.monthly)}.`,
        ...CHARGE_LINES.map(
          (line) => `${line.label}: ${formatFlex(result[line.key])}% sobre o salário-base (composição exibida; não substitui o multiplicador).`,
        ),
        `Multiplicador aplicado = ${formatFlex(result.encargosMultiplier, 3)}. Soma simples das alíquotas = ${formatFlex(result.simpleChargePercent)}%. Referência com incidência dos encargos sobre 13º e férias = ${formatFixed(result.incidenceMultiplier, 3)}. O custo usa o multiplicador, não essa referência.`,
      ],
    },
    {
      title: 'Benefícios',
      lines: [
        `Benefício por pessoa = ${brl(result.mealVoucher)} de VR + ${brl(result.healthPlan)} de plano = ${brl(result.benefitsPerPerson)}. Sem encargos em cima do benefício.`,
        `Benefícios no mês = (${formatFlex(result.technicianCount)} técnicos + ${formatFlex(result.coordinators)} coordenadores) × ${brl(result.benefitsPerPerson)} = ${brl(result.lines.benefits.monthly)}.`,
      ],
    },
    {
      title: 'Carro',
      lines: [
        `Combustível de um carro = (${formatFlex(result.kmPerMonth)} km ÷ ${formatFlex(result.kmPerLiter)} km/L) × ${brl(result.fuelPrice)} = ${brl(result.fuelPerCar)}.`,
        `Carro por equipe = ${brl(result.carRental)} de locação + ${brl(result.fuelPerCar)} de combustível + ${brl(result.tolls)} de pedágio e estacionamento = ${brl(result.carPerTeam)}.`,
        `Carro no mês = ${brl(result.carPerTeam)} × ${formatFlex(result.teams)} = ${brl(result.lines.car.monthly)}.`,
      ],
    },
    {
      title: 'Coordenação',
      lines: [
        `Cada coordenador = ${brl(result.coordinatorSalary)} × ${formatFlex(result.encargosMultiplier, 3)} = ${brl(result.coordinatorUnit)}. Os benefícios dele estão na linha de benefícios. Sem periculosidade.`,
        `Coordenação no mês = ${formatFlex(result.coordinators)} × ${brl(result.coordinatorUnit)} = ${brl(result.lines.coordination.monthly)}.`,
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
        `Diárias no ano = ${formatFlex(result.visitsYear)} visitas × ${formatFlex(result.overnightShare * 100)}% × ${formatFlex(result.peoplePerOvernight)} pessoas × ${brl(result.perDiem)} = ${brl(result.perDiemAnnual)}.`,
        `Diárias no mês = ${brl(result.perDiemAnnual)} ÷ 12 = ${brl(result.lines.perDiem.monthly)}.`,
      ],
    },
    {
      title: 'Totais',
      lines: [
        `Custo mensal = ${brl(result.lines.people.monthly)} + ${brl(result.lines.benefits.monthly)} + ${brl(result.lines.car.monthly)} + ${brl(result.lines.coordination.monthly)} + ${brl(result.lines.manufacturer.monthly)} + ${brl(result.lines.perDiem.monthly)} = ${brl(result.monthlyRounded)}. Cada linha entra arredondada no centavo.`,
        `Custo anual = ${brl(result.monthlyRounded)} × 12 = ${brl(result.annualRounded)}.`,
        `Custo por robô/mês = ${brl(result.monthlyRounded)} ÷ ${formatFlex(result.robots)} = ${brl(result.perRobotRounded)}.`,
        partsLine,
      ],
    },
  ];
}
