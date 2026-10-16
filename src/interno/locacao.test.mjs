import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { calculate, toCents } from '../../public/interno/manutencao/calc.js';
import { evaluate, explain, maintenanceForFleet, paybackLabel } from '../../public/interno/locacao/calc.js';

const root = join(import.meta.dirname, '../..');

function cents(value) {
  return toCents(value);
}

describe('locação da frota', () => {
  it('compra no mês 1, aluga no mês 2 e usa a manutenção pronta', () => {
    const result = evaluate({ rent: 20000, horizon: 3, renewalPct: 100 });
    const maintained = calculate({ robots: 1 });
    assert.equal(result.months[0].bought, 1);
    assert.equal(result.months[0].billing, 0);
    assert.equal(result.months[0].capexCents, cents(1300000 * 0.75));
    assert.equal(result.months[0].maintenanceCents, cents(maintained.monthlyRounded));
    assert.equal(maintenanceForFleet(1).monthly, maintained.monthlyRounded);
    assert.equal(result.months[1].billing, 1);
    assert.equal(result.months[1].inField, 2);
    assert.equal(result.months[1].salesCents, cents(20000 * (1 - 0.02 - 0.1133)));
    assert.equal(result.months[12] ? result.months[12].listFactor : evaluate({ rent: 20000 }).months[12].listFactor, 1.04);
    assert.match(explain(result).map((block) => block.lines.join('\n')).join('\n'), /calculate\(\{ robôs em campo \}\)/);
    assert.match(readFileSync(join(root, 'public/interno/locacao/calc.js'), 'utf8'), /from '\.\.\/manutencao\/calc\.js'/);
    assert.equal(readFileSync(join(root, 'public/interno/locacao/calc.js'), 'utf8').includes('function staffPlan'), false);
  });

  it('não recupera com aluguel zero e paga antes quando o aluguel sobe', () => {
    const zero = evaluate({ rent: 0 });
    const low = evaluate({ rent: 20000 });
    const high = evaluate({ rent: 30000 });
    assert.equal(zero.payback, null);
    assert.equal(zero.wentNegative, true);
    assert.match(paybackLabel(zero), /Não recupera em 120 meses/);
    assert.equal(low.payback, 106);
    assert.equal(low.worstMonth, 57);
    assert.equal(low.worstCents, -2994168895);
    assert.equal(low.raiseCents, 3593002674);
    assert.equal(cents(low.npv), -297651297);
    assert.equal(cents(low.margin), 1943020);
    assert.equal(low.finalFleet, 120);
    assert.equal(low.months.at(-1).teams, 5);
    assert.equal(low.months.at(-1).coordinators, 2);
    assert.equal(low.months.at(-1).managers, 0);
    assert.equal(high.payback, 74);
    assert.ok(high.payback < low.payback);
    assert.equal(high.worstCents, -2011075871);
    assert.equal(high.raiseCents, 2413291045);
    assert.equal(cents(high.npv), 1643033298);
    assert.equal(cents(high.margin), 3051261);
    assert.ok(high.irr > low.irr);
    assert.ok(low.irr > 0.2 && low.irr < 0.25);
    assert.ok(high.irr > 0.38 && high.irr < 0.39);
  });

  it('acha a mensalidade mínima por busca binária e ela é monotônica', () => {
    const early = evaluate({ targetPayback: 36 });
    const later = evaluate({ targetPayback: 60 });
    assert.equal(early.suggestedCents, 6467290);
    assert.equal(later.suggestedCents, 3741087);
    assert.ok(early.suggestedRent > later.suggestedRent);
    const at = evaluate({ rent: early.suggestedRent, targetPayback: 36 });
    const under = evaluate({ rent: (early.suggestedCents - 1) / 100, targetPayback: 36 });
    assert.equal(at.payback, 36);
    assert.ok(under.payback == null || under.payback > 36);
    const empty = evaluate({});
    assert.equal(empty.usedSuggestion, true);
    assert.equal(empty.rentUsed, early.suggestedRent);
    assert.equal(empty.payback, 36);
    const paced = [10000, 20000, 30000, 50000].map((rent) => evaluate({ rent }).payback);
    for (let index = 1; index < paced.length; index += 1) {
      assert.ok(paced[index] != null && paced[index] <= paced[index - 1]);
    }
  });

  it('renova sem buraco, recoloca com um mês parado e limita a frota', () => {
    const common = {
      rent: 10000,
      horizon: 6,
      pace: 1,
      maxFleet: 1,
      contractMonths: 2,
      usefulLifeYears: 10,
      renewalPct: 0,
    };
    const returned = evaluate(common);
    assert.deepEqual(
      returned.months.map((month) => month.billing),
      [0, 1, 1, 0, 1, 1],
    );
    assert.equal(returned.months[0].capexCents > 0, true);
    assert.equal(returned.months[3].capexCents, 0);
    assert.equal(returned.months[3].redeployed, 1);
    const renewed = evaluate({ ...common, renewalPct: 100 });
    assert.equal(renewed.months[3].billing, 1);
    assert.equal(renewed.months[3].redeployed, 0);
    const capped = evaluate({ rent: 20000, horizon: 12, pace: 1, maxFleet: 10 });
    assert.equal(capped.finalFleet, 10);
    assert.equal(
      capped.months.reduce((sum, month) => sum + month.bought, 0),
      10,
    );
  });

  it('dimensiona a captação pelo pico e a diluição pelo pre-money', () => {
    const result = evaluate({ rent: 20000, preMoney: 10000000, twoTranches: true, tranche2Month: 13 });
    assert.equal(result.raiseCents, cents((-result.worstCents / 100) * 1.2));
    assert.equal(
      result.tranches.reduce((sum, tranche) => sum + tranche.cents, 0),
      result.raiseCents,
    );
    assert.equal(result.tranches[0].month, 1);
    assert.equal(result.tranches[1].month, 13);
    assert.ok(result.tranches[1].cents > 0);
    assert.ok(Math.abs(result.dilution - result.raise / (10000000 + result.raise)) < 1e-12);
    const open = evaluate({ rent: 20000, preMoney: null });
    assert.equal(open.dilution, null);
    const stocked = evaluate({ rent: 20000, horizon: 1, partsPerRobot: 1000, freight: 500 });
    assert.equal(stocked.months[0].capexCents, cents(1300000 * 0.75 + 1500));
  });
});

describe('página de locação isolada', () => {
  const page = readFileSync(join(root, 'public/interno/locacao/index.html'), 'utf8');
  const app = readFileSync(join(root, 'public/interno/locacao/app.js'), 'utf8');
  const calc = readFileSync(join(root, 'public/interno/locacao/calc.js'), 'utf8');

  it('não é referenciada pelas calculadoras existentes', () => {
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
      'public/interno/manutencao/index.html',
      'public/interno/manutencao/app.js',
      'public/interno/manutencao/calc.js',
    ];
    for (const file of untouched) {
      const text = readFileSync(join(root, file), 'utf8');
      assert.equal(text.includes('interno/locacao'), false, file);
    }
  });

  it('é noindex, relativa e explica a conta', () => {
    assert.match(page, /<meta name="robots" content="noindex,nofollow"\s*\/?>/);
    assert.match(page, /href="\.\/styles\.css"/);
    assert.match(page, /src="\.\/app\.js"/);
    assert.match(page, /Ver cálculo/);
    assert.match(page, /IBS/);
    assert.match(page, /href="\.\.\/manutencao\/"/);
    assert.match(app, /from '\.\/calc\.js'/);
    assert.match(app, /Mensalidade mínima/);
    assert.match(calc, /maintenanceCalculate\(\{ robots: key \}\)/);
    assert.match(app, /gcalc\.locacao\.interno\.v1/);
    assert.equal(page.includes('gcalc.t2software.co'), false);
    assert.equal(app.includes('gcalc.t2software.co'), false);
    assert.equal(calc.includes('gcalc.t2software.co'), false);
    assert.equal(page.includes('src="/'), false);
    assert.equal(existsSync(join(root, 'public/sitemap.xml')), false);
    assert.match(readFileSync(join(root, 'public/robots.txt'), 'utf8'), /Disallow:\s*\/interno\//);
  });
});
