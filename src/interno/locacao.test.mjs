import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { calculate, toCents } from '../../public/interno/manutencao/calc.js';
import { evaluate as storeEvaluate } from '../../src/model/calculate.ts';
import { defaultStorePreset } from '../../src/model/presets.ts';
import {
  STORE_COST_WITH,
  STORE_COST_WITHOUT,
  STORE_SAVING_DEFAULT,
  evaluate,
  explain,
  maintenanceForFleet,
  paybackLabel,
  volumeDiscountPct,
} from '../../public/interno/locacao/calc.js';

const root = join(import.meta.dirname, '../..');

function cents(value) {
  return toCents(value);
}

const legacy = {
  passThroughOn: false,
  horizon: 120,
  contractMonths: 60,
  tier1Pct: 0,
  tier2Pct: 0,
};

describe('locação da frota', () => {
  it('compra no mês 1, aluga no mês 2 e usa a manutenção pronta', () => {
    const result = evaluate({ rent: 20000, horizon: 3, renewalPct: 100, passThroughOn: false });
    const maintained = calculate({ robots: 1 });
    assert.equal(result.months[0].bought, 1);
    assert.equal(result.months[0].billing, 0);
    assert.equal(result.months[0].capexCents, cents(1300000 * 0.75));
    assert.equal(result.months[0].maintenanceCents, cents(maintained.monthlyRounded));
    assert.equal(maintenanceForFleet(1).monthly, maintained.monthlyRounded);
    assert.equal(result.months[1].billing, 1);
    assert.equal(result.months[1].inField, 2);
    assert.equal(result.months[1].salesCents, cents(20000 * (1 - 0.02 - 0.1133)));
    assert.equal(result.months[12] ? result.months[12].listFactor : evaluate({ ...legacy, rent: 20000 }).months[12].listFactor, 1.04);
    assert.match(explain(result).map((block) => block.lines.join('\n')).join('\n'), /calculate\(\{ robôs em campo \}\)/);
    assert.match(readFileSync(join(root, 'public/interno/locacao/calc.js'), 'utf8'), /from '\.\.\/manutencao\/calc\.js'/);
    assert.equal(readFileSync(join(root, 'public/interno/locacao/calc.js'), 'utf8').includes('function staffPlan'), false);
  });

  it('não recupera com aluguel zero e paga antes quando o aluguel sobe', () => {
    const zero = evaluate({ ...legacy, rent: 0 });
    const low = evaluate({ ...legacy, rent: 20000 });
    const high = evaluate({ ...legacy, rent: 30000 });
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
    const early = evaluate({ ...legacy, targetPayback: 36 });
    const later = evaluate({ ...legacy, targetPayback: 60 });
    assert.equal(early.suggestedCents, 6467290);
    assert.equal(later.suggestedCents, 3741087);
    assert.ok(early.suggestedRent > later.suggestedRent);
    const at = evaluate({ ...legacy, rent: early.suggestedRent, targetPayback: 36 });
    const under = evaluate({ ...legacy, rent: (early.suggestedCents - 1) / 100, targetPayback: 36 });
    assert.equal(at.payback, 36);
    assert.ok(under.payback == null || under.payback > 36);
    const empty = evaluate(legacy);
    assert.equal(empty.usedSuggestion, true);
    assert.equal(empty.rentUsed, early.suggestedRent);
    assert.equal(empty.payback, 36);
    const paced = [10000, 20000, 30000, 50000].map((rent) => evaluate({ ...legacy, rent }).payback);
    for (let index = 1; index < paced.length; index += 1) {
      assert.ok(paced[index] != null && paced[index] <= paced[index - 1]);
    }
  });

  it('renova sem buraco, recoloca com um mês parado e limita a frota', () => {
    const common = {
      passThroughOn: false,
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
    const capped = evaluate({ passThroughOn: false, rent: 20000, horizon: 12, pace: 1, maxFleet: 10 });
    assert.equal(capped.finalFleet, 10);
    assert.equal(
      capped.months.reduce((sum, month) => sum + month.bought, 0),
      10,
    );
  });

  it('dimensiona a captação pelo pico e a diluição pelo pre-money', () => {
    const result = evaluate({ ...legacy, rent: 20000, preMoney: 10000000, twoTranches: true, tranche2Month: 13 });
    assert.equal(result.raiseCents, cents((-result.worstCents / 100) * 1.2));
    assert.equal(
      result.tranches.reduce((sum, tranche) => sum + tranche.cents, 0),
      result.raiseCents,
    );
    assert.equal(result.tranches[0].month, 1);
    assert.equal(result.tranches[1].month, 13);
    assert.ok(result.tranches[1].cents > 0);
    assert.ok(Math.abs(result.dilution - result.raise / (10000000 + result.raise)) < 1e-12);
    const open = evaluate({ ...legacy, rent: 20000, preMoney: null });
    assert.equal(open.dilution, null);
    const stocked = evaluate({ passThroughOn: false, rent: 20000, horizon: 1, partsPerRobot: 1000, freight: 500 });
    assert.equal(stocked.months[0].capexCents, cents(1300000 * 0.75 + 1500));
  });
});

describe('repasse, markup e desconto de volume', () => {
  const tiers = [
    { from: 10, pct: 0.05 },
    { from: 50, pct: 0.1 },
  ];

  it('trava a economia da loja de R$ 2 milhões no mês 60', () => {
    const preset = defaultStorePreset();
    const store = storeEvaluate(preset.inputs, { scenario: 'base' });
    const month = store.months.find((item) => item.month === 60);
    assert.equal(month.costWithout, STORE_COST_WITHOUT);
    assert.equal(month.costWith, STORE_COST_WITH);
    assert.equal(month.costWithout - month.costWith, STORE_SAVING_DEFAULT);
    assert.equal(STORE_SAVING_DEFAULT, 49616);
  });

  it('aplica o repasse sobre a economia e mostra o saving líquido', () => {
    const base = evaluate({});
    assert.equal(base.contractMonths, 120);
    assert.equal(base.horizon, 180);
    assert.equal(base.passThroughOn, true);
    assert.equal(base.passThroughPct, 60);
    assert.equal(base.storeSaving, 49616);
    assert.equal(base.rentUsed, 29769.6);
    assert.equal(base.storeNetSaving, 19846.4);
    assert.equal(base.usedSuggestion, false);
    assert.equal(evaluate({ passThroughPct: 50 }).rentUsed, 24808);
    assert.equal(evaluate({ passThroughPct: 70 }).rentUsed, 34731.2);
    assert.equal(evaluate({ passThroughPct: 70 }).storeNetSaving, 14884.8);
    const manual = evaluate({ passThroughOn: false, rent: 20000 });
    assert.equal(manual.rentUsed, 20000);
    assert.equal(manual.storeNetSaving, 49616 - 20000);
    const zero = evaluate({ passThroughOn: false, rent: 0 });
    assert.equal(zero.payback, null);
    assert.match(paybackLabel(zero), /Não recupera em 180 meses/);
  });

  it('separa a manutenção com markup sem mudar o aluguel total', () => {
    const result = evaluate({ horizon: 4, pace: 1 });
    const billed = result.months.filter((month) => month.billing > 0);
    assert.ok(billed.length > 0);
    for (const month of billed) {
      assert.equal(month.maintBilledCents, cents(month.maintenanceReais * 1.3));
      const gross = month.billing * result.rentUsed * month.listFactor;
      assert.ok(Math.abs(month.maintGross + month.robotGross - gross) < 1e-6);
    }
    assert.equal(result.months[0].billing, 0);
    assert.equal(result.months[0].maintBilledCents, 0);
    assert.equal(result.months[0].maintMarginCents, -result.months[0].maintenanceCents);
    const low = evaluate({ passThroughOn: false, rent: 29769.6, maintenanceMarkupPct: 30, horizon: 24 });
    const high = evaluate({ passThroughOn: false, rent: 29769.6, maintenanceMarkupPct: 80, horizon: 24 });
    assert.equal(low.cumulative, high.cumulative);
    assert.ok(high.maintenanceMarginCents > low.maintenanceMarginCents);
    assert.equal(result.coverage, null);
    const covered = evaluate({
      passThroughOn: false,
      rent: 30000,
      horizon: 6,
      freight: 1000,
      insurancePerRobot: 10,
    });
    assert.equal(covered.implantCents + covered.operationCents > 0, true);
    assert.equal(covered.coverage, covered.maintenanceMarginCents / (covered.implantCents + covered.operationCents));
  });

  it('dá desconto pela compra acumulada e não pela recolocação', () => {
    assert.equal(volumeDiscountPct(9, tiers), 0);
    assert.equal(volumeDiscountPct(10, tiers), 0.05);
    assert.equal(volumeDiscountPct(49, tiers), 0.05);
    assert.equal(volumeDiscountPct(50, tiers), 0.1);
    const fleet = evaluate({ passThroughOn: false, rent: 1, horizon: 50, pace: 1 });
    assert.equal(fleet.months[0].capexCents, cents(1300000 * 0.75));
    assert.equal(fleet.months[8].capexCents, cents(1300000 * 0.75));
    assert.equal(fleet.months[9].capexCents, cents(1300000 * 0.95 * 0.75));
    assert.equal(fleet.months[49].capexCents, cents(1300000 * 0.9 * 0.75));
    const batch = evaluate({ passThroughOn: false, rent: 1, horizon: 1, pace: 12 });
    assert.equal(batch.months[0].capexCents, cents(9 * 1300000 * 0.75 + 3 * 1300000 * 0.95 * 0.75));
    const renewed = evaluate({
      passThroughOn: false,
      rent: 1,
      horizon: 6,
      pace: 1,
      maxFleet: 1,
      contractMonths: 2,
      renewalPct: 0,
    });
    assert.equal(renewed.months[0].capexCents, cents(1300000 * 0.75));
    assert.equal(renewed.months[3].capexCents, 0);
    assert.equal(renewed.months[3].redeployed, 1);
  });

  it('mede o contrato de um robô com a manutenção média da frota', () => {
    const result = evaluate({});
    assert.equal(result.contract.billingMonths, 119);
    assert.equal(result.contract.horizon, 121);
    assert.equal(result.contract.rentUsed, result.rentUsed);
    assert.ok(result.contract.maintenanceMonthly > 0);
    assert.ok(result.contract.maintenanceMonthly < maintenanceForFleet(1).monthly);
    assert.equal(result.contract.wentNegative, true);
    const text = explain(result).map((block) => block.lines.join('\n')).join('\n');
    assert.match(text, /Repasse/);
    assert.match(text, /119/);
    assert.match(text, /Desconto por volume/);
    assert.match(text, /markup/i);
    const priced = [50, 60, 70].map((passThroughPct) => evaluate({ passThroughPct }));
    assert.deepEqual(
      priced.map((item) => item.payback),
      [83, 71, 62],
    );
    assert.deepEqual(
      priced.map((item) => item.worstCents),
      [-2249482201, -1887232512, -1618235322],
    );
    assert.deepEqual(
      priced.map((item) => item.raiseCents),
      [2699378641, 2264679014, 1941882386],
    );
    assert.deepEqual(
      priced.map((item) => cents(item.npv)),
      [1397396081, 2671769699, 3946143320],
    );
    assert.deepEqual(
      priced.map((item) => item.contract.payback),
      [50, 41, 36],
    );
    assert.deepEqual(
      priced.map((item) => cents(item.contract.npv)),
      [10466456, 32984225, 55501998],
    );
    assert.deepEqual(
      priced.map((item) => cents(item.contract.profit)),
      [235910671, 297435317, 358959951],
    );
    assert.equal(priced[1].suggestedCents, 6239698);
    assert.equal(cents(priced[1].maintenanceMargin), 479406768);
    assert.equal(cents(priced[1].rentMaintenance), 346231);
    const suggested = evaluate({ passThroughOn: false });
    const at = evaluate({ passThroughOn: false, rent: suggested.suggestedRent });
    const under = evaluate({ passThroughOn: false, rent: (suggested.suggestedCents - 1) / 100 });
    assert.equal(at.payback, 36);
    assert.ok(under.payback == null || under.payback > 36);
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
    assert.match(app, /gcalc\.locacao\.interno\.v2/);
    assert.match(page, /Repasse da economia da loja/);
    assert.match(page, /120 meses/);
    assert.match(page, /180 meses/);
    assert.match(app, /Saving líquido da loja/);
    assert.equal(page.includes('gcalc.t2software.co'), false);
    assert.equal(app.includes('gcalc.t2software.co'), false);
    assert.equal(calc.includes('gcalc.t2software.co'), false);
    assert.equal(page.includes('src="/'), false);
    assert.equal(existsSync(join(root, 'public/sitemap.xml')), false);
    assert.match(readFileSync(join(root, 'public/robots.txt'), 'utf8'), /Disallow:\s*\/interno\//);
  });
});
