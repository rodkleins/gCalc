import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import {
  calculate,
  coordinatorCount,
  costSeries,
  explain,
  formatBRL,
  incidenceMultiplier,
  parseBr,
  plateaus,
  simpleChargePercent,
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
  it('no default de 10 robôs fecha 100 visitas, 1 equipe e 0 coordenadores', () => {
    const result = calculate();
    assert.equal(result.robots, 10);
    assert.equal(result.preventivesPerYear, 4);
    assert.equal(result.correctivesPerYear, 6);
    assert.equal(result.visitsYear, 100);
    assert.equal(result.visitsPerTeamYear, 3.5 * 52);
    assert.equal(teamCount(100, 3.5, 52), 1);
    assert.equal(result.teams, 1);
    assert.equal(coordinatorCount(1, 4), 0);
    assert.equal(result.coordinators, 0);
    assert.equal(result.robotsPerTeam, 10);
    assert.equal(result.partsInvestment, 0);
    assert.equal(result.perDiemMonthly, 0);
    assert.equal(result.hazardOn, false);

    const memory = textOf(result);
    assert.match(memory, /100 visitas/);
    assert.match(memory, /corretivas \(premissa\)/);
    assert.match(memory, /Coordenadores = 0, porque/);
    assert.match(memory, /máximo\(1, teto\(100 ÷ 182\)\)/);
    assert.match(memory, /Não entra no custo mensal/);
    assert.match(memory, /não informado/i);
  });

  it('separa folha, benefícios, carro, fabricante e o investimento em peças', () => {
    const result = calculate();
    assert.equal(result.salarySum, 19500);
    assert.equal(result.peoplePerTeam, 19500 * 1.65);
    assert.equal(result.peopleMonthly, 32175);
    assert.equal(result.benefitsPerPerson, 1062);
    assert.equal(result.benefitsMonthly, 3186);
    assert.equal(result.encargosMultiplier, 1.65);
    const fuel = (2500 / 10.5) * 6.34;
    assert.ok(Math.abs(result.fuelPerCar - fuel) < 1e-9);
    assert.ok(Math.abs(result.carPerTeam - (2700 + fuel + 400)) < 1e-9);
    assert.equal(result.manufacturerPerRobotMonth, 650);
    assert.equal(result.manufacturerMonthly, 6500);
    assert.equal(result.coordinationMonthly, 0);
    assert.equal(cents(result.lines.car.monthly), 460952);
    assert.equal(cents(result.monthlyRounded), 4647052);
    assert.equal(cents(result.annualRounded), 55764624);
    assert.equal(cents(result.perRobotRounded), 464705);
    assert.equal(
      result.lines.people.cents +
        result.lines.benefits.cents +
        result.lines.car.cents +
        result.lines.coordination.cents +
        result.lines.manufacturer.cents +
        result.lines.perDiem.cents,
      cents(result.monthlyRounded),
    );
    assert.match(formatBRL(result.monthlyRounded), /46\.470,52/);
    assert.match(formatBRL(result.perRobotRounded), /4\.647,05/);
    assert.match(textOf(result), /Multiplicador aplicado = 1,65/);
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
    const doubled = calculate({ encargosMultiplier: 2 });
    assert.equal(doubled.peoplePerTeam, 19500 * 2);
    assert.equal(doubled.benefitsMonthly, 3186);
  });

  it('liga a periculosidade só na folha dos técnicos', () => {
    const off = calculate({ robots: 19 });
    const on = calculate({ robots: 19, hazardOn: true });
    assert.ok(Math.abs(on.peopleMonthly / off.peopleMonthly - 1.3) < 1e-9);
    assert.equal(on.benefitsMonthly, off.benefitsMonthly);
    assert.equal(on.coordinatorUnit, off.coordinatorUnit);
    assert.equal(on.coordinationMonthly, off.coordinationMonthly);
  });

  it('abre a segunda equipe e o primeiro coordenador no 19º robô', () => {
    assert.equal(calculate({ robots: 18 }).teams, 1);
    assert.equal(calculate({ robots: 18 }).coordinators, 0);
    const step = calculate({ robots: 19 });
    assert.equal(step.visitsYear, 190);
    assert.equal(step.teams, 2);
    assert.equal(step.coordinators, 1);
    assert.equal(step.peopleMonthly, 32175 * 2);
    assert.equal(step.technicianCount, 6);
    assert.equal(step.benefitsMonthly, 7 * 1062);
    assert.equal(step.coordinationMonthly, 12000 * 1.65);
    assert.ok(Math.abs(step.carMonthly - calculate().carPerTeam * 2) < 1e-6);
    assert.equal(step.manufacturerMonthly, 19 * 650);
    assert.equal(calculate({ robots: 55 }).teams, 4);
    assert.equal(calculate({ robots: 55 }).coordinators, 1);
    assert.equal(calculate({ robots: 73 }).teams, 5);
    assert.equal(calculate({ robots: 73 }).coordinators, 2);
    assert.equal(calculate({ robots: 200 }).teams, 11);
    assert.equal(calculate({ robots: 200 }).coordinators, 3);
    assert.equal(calculate({ teamsPerCoordinator: 1 }).coordinators, 0);
    assert.equal(coordinatorCount(2, 4), 1);
    assert.equal(coordinatorCount(4, 4), 1);
    assert.equal(coordinatorCount(5, 4), 2);
  });

  it('desenha degraus no custo por robô quando a equipe muda', () => {
    const series = costSeries();
    assert.equal(series.length, 200);
    assert.equal(series[0].robots, 1);
    assert.equal(series[9].teams, 1);
    assert.equal(series[9].coordinators, 0);
    assert.equal(series[199].robots, 200);
    const steps = plateaus(series);
    assert.equal(steps[0].from, 1);
    assert.equal(steps[0].to, 18);
    assert.equal(steps[0].teams, 1);
    assert.equal(steps[0].coordinators, 0);
    assert.equal(steps[1].from, 19);
    assert.equal(steps[1].teams, 2);
    assert.equal(steps[1].coordinators, 1);
    assert.ok(steps[1].perRobotAtStart > steps[0].perRobotAtEnd);
  });

  it('trata o estoque como investimento inicial e as diárias à parte', () => {
    const base = calculate();
    const stocked = calculate({ partsPerRobot: 5000, partsUnfilled: false });
    assert.equal(stocked.partsInvestment, 50000);
    assert.equal(stocked.monthlyExact, base.monthlyExact);
    assert.doesNotMatch(textOf(stocked), /não informado/i);
    assert.match(textOf(stocked), /Não entra no custo mensal/);
    const travel = calculate({ overnightShare: 0.1, peoplePerOvernight: 3, perDiem: 450 });
    assert.equal(travel.perDiemAnnual, 13500);
    assert.equal(travel.perDiemMonthly, 1125);
    assert.equal(travel.teams, base.teams);
  });

  it('usa 52 semanas na equipe e deixa 4,33 só na referência mensal', () => {
    const base = calculate();
    const month = calculate({ weeksPerMonth: 6 });
    assert.equal(month.teams, base.teams);
    assert.notEqual(month.visitsPerTeamMonth, base.visitsPerTeamMonth);
    const year = calculate({ weeksPerYear: 20, visitsPerWeek: 2 });
    assert.equal(year.visitsYear, 100);
    assert.equal(year.teams, 3);
    assert.equal(year.coordinators, 1);
    assert.equal(teamCount(0, 3.5, 52), 1);
    assert.equal(calculate({ preventivesPerYear: 0, correctivesPerYear: 0 }).teams, 1);
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
