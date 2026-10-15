import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import {
  appliedMultiplier,
  calculate,
  coordinatorCount,
  headcountLabel,
  managerCount,
  FLEET_MAX,
  costSeries,
  explain,
  formatBRL,
  incidenceMultiplier,
  parseBr,
  plateaus,
  restoreCorrectivesPerYear,
  severanceFraction,
  simpleChargePercent,
  staffSummary,
  teamCount,
} from '../../public/interno/manutencao/calc.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function cents(value) {
  return Math.round(value * 100);
}

function textOf(result) {
  return explain(result)
    .flatMap((block) => block.lines)
    .join('\n');
}

describe('custo de manutenção dos robôs', () => {
  it('no default de 10 robôs fecha 60 visitas, 1 equipe de sênior e pleno e 0 coordenadores', () => {
    const result = calculate();
    assert.equal(result.robots, 10);
    assert.equal(result.preventivesPerYear, 4);
    assert.equal(result.correctivesPerYear, 2);
    assert.equal(result.visitsYear, 60);
    assert.equal(result.peopleOnTeam, 2);
    assert.equal(result.compositionLabel, 'Sênior + Pleno');
    assert.equal(result.visitsPerTeamYear, 3.5 * 52);
    assert.equal(teamCount(60, 3.5, 52), 1);
    assert.equal(result.teams, 1);
    assert.equal(coordinatorCount(1, 4), 0);
    assert.equal(result.coordinators, 0);
    assert.equal(result.robotsPerTeam, 10);
    assert.equal(result.partsInvestment, 0);
    assert.equal(result.perDiemMonthly, 0);
    assert.equal(result.hazardOn, false);

    const memory = textOf(result);
    assert.match(memory, /60 visitas/);
    assert.match(memory, /corretivas \(premissa\)/);
    assert.match(memory, /Coordenadores = 0, porque/);
    assert.match(memory, /máximo\(1, teto\(60 ÷ 182\)\)/);
    assert.match(memory, /1 equipe · Sênior \+ Pleno · 10 robôs por equipe · 0 coordenador/);
    assert.match(memory, /Pelas visitas: 60 de 182 por equipe → 1 equipe/);
    assert.equal(headcountLabel(result), '1 Sênior · 1 Pleno');
    assert.match(memory, /pessoas ÷ 2/);
    assert.doesNotMatch(memory, /por equipe de dois/);
    assert.match(memory, /Não entra no custo mensal/);
    assert.match(memory, /não informado/i);
    assert.doesNotMatch(memory, /júnior/i);
  });

  it('escala 5 robôs com só o sênior e 20 robôs ainda numa equipe de dois', () => {
    const five = calculate({ robots: 5 });
    assert.equal(five.visitsYear, 30);
    assert.equal(five.teams, 1);
    assert.equal(five.peopleOnTeam, 1);
    assert.equal(five.compositionLabel, 'Sênior');
    assert.equal(five.coordinators, 0);
    assert.equal(five.salarySum, 10000);
    assert.equal(five.technicianCount, 1);
    assert.equal(cents(five.monthlyRounded), 2655273);
    assert.match(textOf(five), /só sênior/);
    assert.match(textOf(five), /máximo\(1, teto\(30 ÷ 91\)\)/);
    assert.equal(headcountLabel(five), '1 Sênior');
    assert.match(textOf(five), /pessoas ÷ 2/);

    assert.equal(staffSummary(calculate({ robots: 1 })).resultLine, '1 equipe · Sênior · 1 robô por equipe · 0 coordenador');

    const six = calculate({ robots: 6 });
    assert.equal(six.teams, 1);
    assert.equal(six.peopleOnTeam, 2);
    assert.equal(six.compositionLabel, 'Sênior + Pleno');
    assert.equal(six.coordinators, 0);
    assert.equal(cents(six.monthlyRounded), 3884346);

    const twenty = calculate({ robots: 20 });
    assert.equal(twenty.visitsYear, 120);
    assert.equal(twenty.teams, 1);
    assert.equal(twenty.peopleOnTeam, 2);
    assert.equal(twenty.coordinators, 0);
    assert.equal(twenty.managers, 0);
    assert.equal(twenty.technicianCount, 2);
    assert.equal(headcountLabel(twenty), '1 Sênior · 1 Pleno');
    assert.equal(cents(twenty.monthlyRounded), 4794346);
    assert.equal(cents(twenty.perRobotRounded), 239717);

    const low = calculate({ robots: 16, preventivesPerYear: 1, correctivesPerYear: 0 });
    assert.equal(low.visitsYear, 16);
    assert.equal(low.teams, 1);
    assert.equal(low.peopleOnTeam, 2);
    assert.equal(low.coordinators, 0);

    const heavy = calculate({ robots: 5, preventivesPerYear: 12, correctivesPerYear: 12 });
    assert.equal(heavy.visitsYear, 120);
    assert.equal(heavy.peopleOnTeam, 2);
    assert.equal(heavy.teams, 1);
    assert.ok(heavy.peopleOnTeam <= 2);
  });

  it('separa folha, benefícios, carro, fabricante e o investimento em peças', () => {
    const result = calculate();
    assert.equal(result.salarySum, 16000);
    assert.equal(result.severanceOn, true);
    assert.equal(result.severanceRate, 8.33);
    assert.ok(Math.abs(result.appliedMultiplier - (1.65 + 0.0833 * 1.358)) < 1e-9);
    assert.equal(result.peoplePerTeam, 16000 * result.appliedMultiplier);
    assert.equal(result.peopleMonthly, 16000 * result.appliedMultiplier);
    assert.equal(result.benefitsPerPerson, 1062);
    assert.equal(result.benefitsMonthly, 2124);
    assert.equal(result.encargosMultiplier, 1.65);
    const fuel = (2500 / 10.5) * 6.34;
    assert.ok(Math.abs(result.fuelPerCar - fuel) < 1e-9);
    assert.ok(Math.abs(result.carPerTeam - (2700 + fuel + 400)) < 1e-9);
    assert.equal(result.manufacturerPerRobotMonth, 650);
    assert.equal(result.manufacturerMonthly, 6500);
    assert.equal(result.coordinationMonthly, 0);
    assert.equal(cents(result.lines.car.monthly), 460952);
    assert.equal(cents(result.monthlyRounded), 4144346);
    assert.equal(cents(result.annualRounded), 49732152);
    assert.equal(cents(result.perRobotRounded), 414435);
    assert.equal(
      result.lines.people.cents +
        result.lines.benefits.cents +
        result.lines.car.cents +
        result.lines.coordination.cents +
        result.lines.management.cents +
        result.lines.manufacturer.cents +
        result.lines.perDiem.cents,
      cents(result.monthlyRounded),
    );
    assert.match(formatBRL(result.monthlyRounded), /41\.443,46/);
    assert.match(formatBRL(result.perRobotRounded), /4\.144,35/);
    assert.match(textOf(result), /Multiplicador efetivo = 1,65 \+ 0,113 = 1,763/);
    assert.match(textOf(result), /aviso prévio indenizado/i);
    assert.match(textOf(result), /não é somada de novo/);
    assert.match(textOf(result), /não o aviso prévio/);
    assert.match(textOf(result), /INSS patronal: 20%/);
    assert.match(textOf(result), /Terceiros \(Sistema S\): 5,8%/);
    assert.match(textOf(result), /13º salário: 8,33%/);
    assert.match(textOf(result), /Férias \+ 1\/3: 11,11%/);
    assert.match(textOf(result), /3,2%/);
  });

  it('não mistura a referência de incidência com o multiplicador de 1,65', () => {
    const reference = incidenceMultiplier();
    assert.ok(reference > 1.65 && reference < 1.66);
    assert.ok(Math.abs(simpleChargePercent() - 58.44) < 1e-9);
    const plain = calculate({ encargosMultiplier: 2, severanceOn: false });
    assert.equal(plain.peoplePerTeam, 16000 * 2);
    assert.equal(plain.appliedMultiplier, 2);
    assert.equal(plain.benefitsMonthly, 2124);
    const withNotice = calculate({ encargosMultiplier: 2 });
    assert.equal(withNotice.peoplePerTeam, 16000 * (2 + severanceFraction(withNotice)));
    assert.equal(withNotice.benefitsMonthly, 2124);
    const off = calculate({ severanceOn: false });
    assert.equal(off.peoplePerTeam, 16000 * 1.65);
    assert.equal(cents(off.monthlyRounded), 3963352);
    assert.match(textOf(off), /Provisão de rescisão desligada/);
  });

  it('liga a periculosidade só na folha dos técnicos', () => {
    const off = calculate({ robots: 19 });
    const on = calculate({ robots: 19, hazardOn: true });
    assert.ok(Math.abs(on.peopleMonthly / off.peopleMonthly - 1.3) < 1e-9);
    assert.equal(on.benefitsMonthly, off.benefitsMonthly);
    assert.equal(on.coordinatorUnit, off.coordinatorUnit);
    assert.equal(on.coordinationMonthly, off.coordinationMonthly);
  });

  it('mantém 16 robôs numa equipe e abre a segunda só quando as visitas estouram', () => {
    const sixteen = calculate({ robots: 16 });
    assert.equal(sixteen.visitsYear, 96);
    assert.equal(sixteen.teams, 1);
    assert.equal(sixteen.coordinators, 0);
    assert.equal(sixteen.peopleOnTeam, 2);
    assert.equal(sixteen.peopleMonthly, 16000 * appliedMultiplier());
    assert.equal(sixteen.technicianCount, 2);
    assert.equal(sixteen.benefitsMonthly, 2 * 1062);
    assert.equal(sixteen.coordinationMonthly, 0);
    assert.equal(sixteen.manufacturerMonthly, 16 * 650);
    assert.equal(cents(sixteen.monthlyRounded), 4534346);
    assert.equal(staffSummary(sixteen).resultLine, '1 equipe · Sênior + Pleno · 16 robôs por equipe · 0 coordenador');
    assert.match(staffSummary(sixteen).reasonLine, /96 de 182 por equipe → 1 equipe/);
    assert.equal(calculate({ robots: 16, pairMaxRobots: 10 }).teams, 1);

    assert.equal(calculate({ robots: 30 }).teams, 1);
    assert.equal(calculate({ robots: 30 }).coordinators, 0);
    const step = calculate({ robots: 31 });
    assert.equal(step.visitsYear, 186);
    assert.equal(step.teams, 2);
    assert.equal(step.coordinators, 1);
    assert.equal(step.peopleOnTeam, 2);
    assert.equal(step.peopleMonthly, 16000 * appliedMultiplier() * 2);
    assert.equal(step.technicianCount, 4);
    assert.equal(step.benefitsMonthly, 5 * 1062);
    assert.equal(step.coordinationMonthly, 12000 * appliedMultiplier());
    assert.ok(Math.abs(step.carMonthly - calculate().carPerTeam * 2) < 1e-6);

    const soloOverflow = calculate({ robots: 8, soloMaxRobots: 20, preventivesPerYear: 12, correctivesPerYear: 6 });
    assert.equal(soloOverflow.visitsYear, 144);
    assert.equal(soloOverflow.peopleOnTeam, 2);
    assert.equal(soloOverflow.teams, 1);
    assert.match(textOf(soloOverflow), /sem abrir outra equipe só de sênior/);

    assert.equal(calculate({ robots: 55 }).teams, 2);
    assert.equal(calculate({ robots: 55 }).coordinators, 1);
    assert.equal(calculate({ robots: 73 }).teams, 3);
    assert.equal(calculate({ robots: 73 }).coordinators, 1);
    assert.equal(calculate({ robots: 200 }).teams, 7);
    assert.equal(calculate({ robots: 200 }).coordinators, 2);
    assert.equal(calculate({ robots: 200 }).managers, 0);
    assert.equal(calculate({ teamsPerCoordinator: 1 }).coordinators, 0);
    assert.equal(coordinatorCount(2, 4), 1);
    assert.equal(coordinatorCount(4, 4), 1);
    assert.equal(coordinatorCount(5, 4), 2);
  });

  it('desenha degraus no custo por robô quando a equipe muda', () => {
    const series = costSeries();
    assert.equal(FLEET_MAX, 1000);
    assert.equal(series.length, 1000);
    assert.equal(series[0].robots, 1);
    assert.equal(series[4].teams, 1);
    assert.equal(series[4].peopleOnTeam, 1);
    assert.equal(series[5].teams, 1);
    assert.equal(series[5].peopleOnTeam, 2);
    assert.equal(series[15].teams, 1);
    assert.equal(series[15].coordinators, 0);
    assert.equal(series[199].robots, 200);
    assert.equal(series[199].teams, 7);
    assert.equal(series[199].coordinators, 2);
    assert.equal(series[199].managers, 0);
    assert.equal(series[999].robots, 1000);
    assert.equal(series[999].teams, 33);
    assert.equal(series[999].coordinators, 9);
    assert.equal(series[999].managers, 3);
    const steps = plateaus(series);
    assert.equal(steps[0].from, 1);
    assert.equal(steps[0].to, 5);
    assert.equal(steps[0].teams, 1);
    assert.equal(steps[0].peopleOnTeam, 1);
    assert.equal(steps[0].coordinators, 0);
    assert.equal(steps[1].from, 6);
    assert.equal(steps[1].to, 30);
    assert.equal(steps[1].peopleOnTeam, 2);
    assert.equal(steps[1].coordinators, 0);
    assert.equal(steps[2].from, 31);
    assert.equal(steps[2].teams, 2);
    assert.equal(steps[2].coordinators, 1);
    assert.ok(steps[1].perRobotAtStart > steps[0].perRobotAtEnd);
  });

  it('trata o estoque como investimento inicial e as diárias à parte', () => {
    const base = calculate();
    const stocked = calculate({ partsPerRobot: 5000, partsUnfilled: false });
    assert.equal(stocked.partsInvestment, 50000);
    assert.equal(stocked.monthlyExact, base.monthlyExact);
    assert.doesNotMatch(textOf(stocked), /não informado/i);
    assert.match(textOf(stocked), /Não entra no custo mensal/);
    const travel = calculate({ overnightShare: 0.1, overnightFollow: false, peoplePerOvernight: 2, perDiem: 450 });
    assert.equal(travel.perDiemAnnual, 5400);
    assert.equal(travel.perDiemMonthly, 450);
    assert.equal(travel.teams, base.teams);
    const followed = calculate({ overnightShare: 0.1, robots: 5 });
    assert.equal(followed.overnightPeople, 1);
    assert.equal(followed.perDiemAnnual, 30 * 0.1 * 1 * 450);
  });

  it('usa 52 semanas na equipe e deixa 4,33 só na referência mensal', () => {
    const base = calculate();
    const month = calculate({ weeksPerMonth: 6 });
    assert.equal(month.teams, base.teams);
    assert.notEqual(month.visitsPerTeamMonth, base.visitsPerTeamMonth);
    const year = calculate({ weeksPerYear: 20, visitsPerWeek: 2 });
    assert.equal(year.visitsYear, 60);
    assert.equal(year.peopleOnTeam, 2);
    assert.equal(year.teams, 2);
    assert.equal(year.coordinators, 1);
    const manualDefault = calculate({ autoScale: false, includePleno: false });
    assert.equal(manualDefault.visitsYear, 60);
    assert.equal(manualDefault.teams, 1);
    assert.equal(manualDefault.coordinators, 0);
    assert.match(textOf(manualDefault), /teto\(60 ÷ 91\)/);
    const manual = calculate({ autoScale: false, includePleno: false, includeSenior: false, soloMaxRobots: 9, correctivesPerYear: 6 });
    assert.equal(manual.peopleOnTeam, 1);
    assert.equal(manual.teams, 2);
    assert.equal(manual.coordinators, 1);
    assert.equal(manual.visitsYear, 100);
    assert.equal(manual.teamCap, 91);
    const manualText = textOf(manual);
    assert.match(manualText, /Modo manual/);
    assert.match(manualText, /pleno está desligado e vale para todas as equipes/);
    assert.match(manualText, /limite de só sênior está desligado/);
    assert.match(manualText, /máximo\(1, teto\(100 ÷ 91\)\) = máximo\(1, teto\(1,0989\)\) = 2/);
    assert.doesNotMatch(manualText, /teto\(100 ÷ 182\)/);
    assert.equal(staffSummary(manual).resultLine, '2 equipes · Sênior · 5 robôs por equipe · 1 coordenador');
    assert.equal(manual.seniorOnTeam, true);
    assert.equal(teamCount(0, 3.5, 52), 1);
    assert.equal(calculate({ preventivesPerYear: 0, correctivesPerYear: 0 }).teams, 1);
  });

  it('abre gerente a partir de 3 coordenadores e preserva corretiva editada', () => {
    assert.equal(managerCount(2, 3), 0);
    assert.equal(managerCount(3, 3), 1);
    assert.equal(managerCount(4, 3), 2);
    assert.equal(managerCount(6, 3), 2);
    const fleet = calculate({ robots: 200 });
    assert.equal(fleet.managers, 0);
    assert.equal(headcountLabel(fleet), '7 Sênior · 7 Pleno · 2 coordenadores');
    assert.match(textOf(fleet), /Gerentes = 0, porque 2 coordenadores ficam abaixo de 3/);
    const beforeManager = calculate({ robots: 242 });
    const firstManager = calculate({ robots: 243 });
    assert.equal(beforeManager.teams, 8);
    assert.equal(beforeManager.coordinators, 2);
    assert.equal(beforeManager.managers, 0);
    assert.equal(firstManager.teams, 9);
    assert.equal(firstManager.coordinators, 3);
    assert.equal(firstManager.managers, 1);
    assert.equal(headcountLabel(firstManager), '9 Sênior · 9 Pleno · 3 coordenadores · 1 gerente');
    assert.equal(calculate({ robots: 364 }).managers, 1);
    assert.equal(calculate({ robots: 365 }).managers, 2);
    assert.equal(calculate({ robots: 728 }).managers, 2);
    assert.equal(calculate({ robots: 729 }).managers, 3);
    const fiveHundred = calculate({ robots: 500 });
    assert.equal(fiveHundred.visitsYear, 3000);
    assert.equal(fiveHundred.teams, 17);
    assert.equal(fiveHundred.coordinators, 5);
    assert.equal(fiveHundred.managers, 2);
    assert.equal(headcountLabel(fiveHundred), '17 Sênior · 17 Pleno · 5 coordenadores · 2 gerentes');
    assert.equal(cents(fiveHundred.monthlyRounded), 109573257);
    assert.equal(cents(fiveHundred.annualRounded), 1314879084);
    assert.equal(cents(fiveHundred.perRobotRounded), 219147);
    const thousand = calculate({ robots: 1000 });
    assert.equal(thousand.visitsYear, 6000);
    assert.equal(thousand.teams, 33);
    assert.equal(thousand.coordinators, 9);
    assert.equal(thousand.managers, 3);
    assert.equal(headcountLabel(thousand), '33 Sênior · 33 Pleno · 9 coordenadores · 3 gerentes');
    assert.equal(cents(thousand.monthlyRounded), 210150406);
    assert.equal(cents(thousand.annualRounded), 2521804872);
    assert.equal(cents(thousand.perRobotRounded), 210150);
    const stepsToThousand = plateaus(costSeries());
    const managerStep = stepsToThousand.find((row) => row.managers === 1);
    assert.equal(managerStep.from, 243);
    assert.equal(managerStep.coordinators, 3);
    const withManagers = calculate({ robots: 200, teamsPerCoordinator: 1 });
    assert.equal(withManagers.teams, 7);
    assert.equal(withManagers.coordinators, 7);
    assert.equal(withManagers.managers, 3);
    assert.equal(headcountLabel(withManagers), '7 Sênior · 7 Pleno · 7 coordenadores · 3 gerentes');
    const factor = appliedMultiplier();
    assert.equal(withManagers.managerUnit, 18000 * factor);
    assert.equal(withManagers.managementMonthly, 3 * 18000 * factor);
    assert.equal(withManagers.coordinatorUnit, 12000 * factor);
    assert.equal(withManagers.benefitsMonthly, (14 + 7 + 3) * 1062);
    const hazard = calculate({ robots: 200, teamsPerCoordinator: 1, hazardOn: true });
    assert.equal(hazard.managerUnit, withManagers.managerUnit);
    assert.equal(hazard.managementMonthly, withManagers.managementMonthly);
    assert.match(textOf(withManagers), /Gerentes = teto\(7 ÷ 3\)/);
    assert.match(textOf(withManagers), /18\.000,00 × 1,763/);
    assert.match(textOf(withManagers), /Gerência no mês = 3 ×/);
    assert.equal(
      headcountLabel({ teams: 24, pleno: true, coordinators: 6, managers: 2 }),
      '24 Sênior · 24 Pleno · 6 coordenadores · 2 gerentes',
    );
    assert.equal(
      headcountLabel({ teams: 2, pleno: true, coordinators: 1, managers: 0 }),
      '2 Sênior · 2 Pleno · 1 coordenador',
    );
    assert.equal(restoreCorrectivesPerYear(6, false), 2);
    assert.equal(restoreCorrectivesPerYear(6, true), 6);
    assert.equal(restoreCorrectivesPerYear(4, false), 4);
    assert.equal(restoreCorrectivesPerYear(0, false), 0);
    assert.equal(restoreCorrectivesPerYear(12, false), 12);
  });

  it('lê número em pt-BR', () => {
    assert.equal(parseBr('10.000'), 10000);
    assert.equal(parseBr('1.300.000'), 1300000);
    assert.equal(parseBr('6,34'), 6.34);
    assert.equal(parseBr('1,65'), 1.65);
    assert.equal(parseBr('10,5'), 10.5);
    assert.equal(parseBr('3,5'), 3.5);
    assert.equal(parseBr('0,6'), 0.6);
    assert.equal(parseBr('8,33'), 8.33);
    assert.equal(parseBr('R$ 4.609,52'), 4609.52);
    assert.equal(parseBr(''), null);
    assert.equal(parseBr('abc'), null);
  });
});

describe('página interna isolada', () => {
  const page = readFileSync(join(root, 'public/interno/manutencao/index.html'), 'utf8');
  const app = readFileSync(join(root, 'public/interno/manutencao/app.js'), 'utf8');
  const calc = readFileSync(join(root, 'public/interno/manutencao/calc.js'), 'utf8');

  it('não é referenciada pelas calculadoras existentes nem pelo build delas', () => {
    const untouched = [
      'index.html',
      'headtohead/index.html',
      'calculos/index.html',
      'rh/index.html',
      'rh/calculos/index.html',
      'src/model/sitePaths.ts',
      'src/components/PageNav.tsx',
      'src/rh/RhPageNav.tsx',
      'vite.config.ts',
      '.github/workflows/pages.yml',
    ];
    for (const file of untouched) {
      const text = readFileSync(join(root, file), 'utf8');
      assert.equal(text.includes('interno/manutencao'), false, file);
      assert.equal(text.includes('manutencao'), false, file);
    }
  });

  it('é noindex, relativa e fica fora de sitemap', () => {
    assert.match(page, /<meta name="robots" content="noindex,nofollow"\s*\/?>/);
    assert.match(page, /Premissas e fontes/);
    assert.match(page, /href="\.\/styles\.css"/);
    assert.match(page, /src="\.\/app\.js"/);
    assert.match(app, /from '\.\/calc\.js'/);
    assert.match(app, /Corretivas por ano por robô \(premissa\)/);
    assert.match(app, /Escalonamento automático/);
    assert.match(app, /Provisão de rescisão/);
    assert.match(app, /Coordenadores por gerente/);
    assert.match(app, /dock-crew/);
    assert.match(app, /max: FLEET_MAX/);
    assert.match(app, /step: 1/);
    assert.match(app, /costSeries\(input, 1, FLEET_MAX\)/);
    assert.match(calc, /export const FLEET_MAX = 1000/);
    assert.match(page, /De 1 a 1\.000 robôs/);
    assert.match(app, /restoreCorrectivesPerYear/);
    assert.match(calc, /managerCount/);
    assert.match(page, /id="dock-crew"/);
    assert.match(page, /aviso prévio indenizado/);
    assert.match(page, /não entra de novo/);
    assert.match(calc, /severanceOn/);
    assert.match(app, /gcalc\.manutencao\.interno\.v3/);
    assert.match(app, /gcalc\.manutencao\.interno\.v2/);
    assert.match(app, /pairMaxRobots/);
    assert.equal(app.includes('Robôs por equipe Sênior + Pleno'), false);
    assert.equal(calc.includes('pairMaxRobots'), false);
    assert.equal(page.includes('até 15 robôs'), false);
    assert.match(page, /cabine da Fiat Strada/);
    assert.equal(calc.includes('salaryJunior'), false);
    assert.equal(app.includes('salaryJunior'), false);
    assert.equal(page.includes('salaryJunior'), false);
    assert.match(app, /Valor médio de estoque de peças por robô/);
    assert.match(page, /Ver cálculo/);
    assert.equal(page.includes('gcalc.t2software.co'), false);
    assert.equal(app.includes('gcalc.t2software.co'), false);
    assert.equal(calc.includes('gcalc.t2software.co'), false);
    assert.equal(page.includes('src="/'), false);
    assert.equal(page.includes("src='/"), false);
    assert.match(page, /https:\/\/www\.salario\.com\.br\//);
    assert.equal(existsSync(join(root, 'public/sitemap.xml')), false);
    assert.equal(existsSync(join(root, 'sitemap.xml')), false);
    assert.match(readFileSync(join(root, 'public/robots.txt'), 'utf8'), /Disallow:\s*\/interno\//);
  });
});
