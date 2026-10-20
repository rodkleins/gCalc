import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { evaluate as storeEvaluate } from '../../src/model/calculate.ts';
import { defaultStorePreset } from '../../src/model/presets.ts';
import {
  LUCRO_REAL,
  STORE_COST_WITH,
  STORE_COST_WITHOUT,
  STORE_SAVING_DEFAULT,
  evaluate,
  explain,
  parseBr,
  paybackLabel,
  sanitize,
  taxNote,
  toCents,
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
  it('compra no mês 1, aluga no mês 2 e cobra a manutenção no mesmo mês', () => {
    const result = evaluate({ rent: 20000, horizon: 3, renewalPct: 100, passThroughOn: false });
    const calc = readFileSync(join(root, 'public/interno/locacao/calc.js'), 'utf8');
    assert.equal(result.months[0].bought, 1);
    assert.equal(result.months[0].billing, 0);
    assert.equal(result.months[0].inField, 1);
    assert.equal(result.months[0].maintenanceCents, 0);
    assert.equal(result.months[0].capexCents, cents(1300000));
    assert.equal(result.months[0].creditCents, 0);
    assert.equal(result.months[1].billing, 1);
    assert.equal(result.months[1].inField, 2);
    assert.equal(result.months[1].maintenanceCents, cents(3500));
    assert.equal(result.months[1].grossCents, cents(20000));
    assert.equal(result.months[1].salesCents, cents(20000 * 0.98));
    assert.equal(result.months[1].debitCents, cents(20000 * 0.0925));
    assert.equal(result.months[1].pisCofinsCents, 0);
    assert.equal(result.months[12] ? result.months[12].listFactor : evaluate({ ...legacy, rent: 20000 }).months[12].listFactor, 1.04);
    const text = explain(result).map((block) => block.lines.join('\n')).join('\n');
    assert.match(text, /mês seguinte à instalação/);
    assert.doesNotMatch(text, /calculate\(/);
    assert.equal(calc.includes('manutencao/calc'), false);
    assert.equal(calc.includes('function staffPlan'), false);
  });

  it('não recupera com aluguel zero e paga antes quando o aluguel sobe', () => {
    const zero = evaluate({ ...legacy, rent: 0 });
    const low = evaluate({ ...legacy, rent: 30000 });
    const high = evaluate({ ...legacy, rent: 50000 });
    assert.equal(zero.payback, null);
    assert.equal(zero.wentNegative, true);
    assert.match(paybackLabel(zero), /Não recupera em 120 meses/);
    assert.ok(high.payback != null && high.payback < low.payback);
    assert.ok(high.worstCents > low.worstCents);
    assert.ok(high.irr > low.irr);
    assert.equal(low.raiseCents, cents((-low.worstCents / 100) * 1.2));
    assert.equal(low.finalFleet, 120);
  });

  it('acha a mensalidade mínima por busca binária e ela é monotônica', () => {
    const early = evaluate({ ...legacy, targetPayback: 36 });
    const later = evaluate({ ...legacy, targetPayback: 60 });
    assert.ok(early.suggestedCents > later.suggestedCents);
    const at = evaluate({ ...legacy, rent: early.suggestedRent, targetPayback: 36 });
    const under = evaluate({ ...legacy, rent: (early.suggestedCents - 1) / 100, targetPayback: 36 });
    assert.equal(at.payback, 36);
    assert.ok(under.payback == null || under.payback > 36);
    const empty = evaluate(legacy);
    assert.equal(empty.usedSuggestion, true);
    assert.equal(empty.rentUsed, early.suggestedRent);
    assert.equal(empty.payback, 36);
    const paced = [30000, 50000, 70000, 100000].map((rent) => evaluate({ ...legacy, rent }).payback);
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
    assert.equal(returned.months[3].maintenanceCents, 0);
    assert.equal(returned.months[1].maintenanceCents, cents(3500));
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
    assert.equal(stocked.months[0].capexCents, cents(1300000 + 1500));
    assert.equal(stocked.months[0].creditCents, 0);
  });
});

describe('repasse, manutenção terceirizada e desconto de volume', () => {
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

  it('cobra a manutenção terceirizada por robô alugado sem mudar o aluguel', () => {
    const result = evaluate({ horizon: 4, pace: 1 });
    assert.equal(result.maintenancePerRobot, 3500);
    for (const month of result.months) {
      assert.equal(month.maintenanceCents, cents(month.billing * 3500));
    }
    const dearer = evaluate({ horizon: 4, pace: 1, maintenancePerRobot: 7000 });
    assert.equal(dearer.rentUsed, result.rentUsed);
    assert.ok(dearer.cumulative < result.cumulative);
    assert.equal(result.months[0].maintenanceCents, 0);
  });

  it('dá desconto pela compra acumulada e não pela recolocação', () => {
    assert.equal(volumeDiscountPct(9, tiers), 0);
    assert.equal(volumeDiscountPct(10, tiers), 0.05);
    assert.equal(volumeDiscountPct(49, tiers), 0.05);
    assert.equal(volumeDiscountPct(50, tiers), 0.1);
    const fleet = evaluate({ passThroughOn: false, rent: 1, horizon: 50, pace: 1 });
    assert.equal(fleet.months[0].capexCents, cents(1300000));
    assert.equal(fleet.months[8].capexCents, cents(1300000));
    assert.equal(fleet.months[9].capexCents, cents(1300000 * 0.95));
    assert.equal(fleet.months[49].capexCents, cents(1300000 * 0.9));
    const batch = evaluate({ passThroughOn: false, rent: 1, horizon: 1, pace: 12 });
    assert.equal(batch.months[0].capexCents, cents(9 * 1300000 + 3 * 1300000 * 0.95));
    const renewed = evaluate({
      passThroughOn: false,
      rent: 1,
      horizon: 6,
      pace: 1,
      maxFleet: 1,
      contractMonths: 2,
      renewalPct: 0,
    });
    assert.equal(renewed.months[0].capexCents, cents(1300000));
    assert.equal(renewed.months[3].capexCents, 0);
    assert.equal(renewed.months[3].redeployed, 1);
  });

  it('mede o contrato de um robô com a mesma manutenção terceirizada', () => {
    const result = evaluate({});
    assert.equal(result.contract.billingMonths, 119);
    assert.equal(result.contract.horizon, 121);
    assert.equal(result.contract.rentUsed, result.rentUsed);
    assert.equal(result.contract.maintenanceMonthly, 3500);
    assert.equal(result.contract.wentNegative, true);
    const text = explain(result).map((block) => block.lines.join('\n')).join('\n');
    assert.match(text, /Repasse/);
    assert.match(text, /119/);
    assert.match(text, /Desconto por volume/);
    assert.match(text, /Manutenção terceirizada/);
    assert.match(text, /parcelas mensais iguais/);
    assert.match(text, /48/);
    assert.doesNotMatch(text, /markup/i);
    assert.doesNotMatch(text, /abate no próprio mês/);
    assert.doesNotMatch(text, /já reduziu o caixa/);
    const priced = [50, 60, 70].map((passThroughPct) => evaluate({ passThroughPct }));
    assert.deepEqual(
      priced.map((item) => item.payback),
      [117, 101, 89],
    );
    assert.deepEqual(
      priced.map((item) => item.worstMonth),
      [60, 51, 48],
    );
    assert.deepEqual(
      priced.map((item) => item.worstCents),
      [-4128058541, -3557594415, -3128358318],
    );
    assert.deepEqual(
      priced.map((item) => item.raiseCents),
      [4953670249, 4269113298, 3754029982],
    );
    assert.deepEqual(
      priced.map((item) => cents(item.npv)),
      [-994810242, -22251754, 913771814],
    );
    assert.deepEqual(
      priced.map((item) => item.contract.payback),
      [68, 57, 50],
    );
    assert.deepEqual(
      priced.map((item) => cents(item.contract.npv)),
      [-31179141, -12259763, 4897248],
    );
    assert.deepEqual(
      priced.map((item) => cents(item.contract.profit)),
      [152433443, 200524369, 242686490],
    );
    assert.equal(priced[1].suggestedCents, 10448155);
    assert.equal(priced[1].terminalCents, 8353800000);
    assert.equal(priced[1].creditMonths, 48);
    const suggested = evaluate({ passThroughOn: false });
    const at = evaluate({ passThroughOn: false, rent: suggested.suggestedRent });
    const under = evaluate({ passThroughOn: false, rent: (suggested.suggestedCents - 1) / 100 });
    assert.equal(at.payback, 36);
    assert.ok(under.payback == null || under.payback > 36);
  });

  it('recupera o crédito em parcelas iguais a partir do mês seguinte', () => {
    const total = cents(1300000 * 0.25);
    const single = evaluate({
      passThroughOn: false,
      rent: 1,
      horizon: 49,
      pace: 1,
      maxFleet: 1,
      creditMonths: 48,
      tier1Pct: 0,
      tier2Pct: 0,
    });
    assert.equal(single.months[0].creditCents, 0);
    assert.equal(single.months[0].capexCents, cents(1300000));
    const paid = single.months.slice(1).reduce((sum, month) => sum + month.creditCents, 0);
    assert.equal(paid, total);
    const base = Math.floor(total / 48);
    const extra = total % 48;
    assert.equal(single.months[1].creditCents, base + 1);
    assert.equal(single.months[1 + extra].creditCents, base);
    const redeployed = evaluate({
      passThroughOn: false,
      rent: 1,
      horizon: 6,
      pace: 1,
      maxFleet: 1,
      contractMonths: 2,
      renewalPct: 0,
      creditMonths: 4,
      tier1Pct: 0,
      tier2Pct: 0,
    });
    assert.equal(redeployed.months[3].redeployed, 1);
    assert.equal(redeployed.months[3].capexCents, 0);
    assert.equal(
      redeployed.months.reduce((sum, month) => sum + month.creditCents, 0),
      total,
    );
    assert.equal(redeployed.months[3].creditCents, Math.floor(total / 4));
  });
});

describe('lucro real, um robô, valor terminal e correções', () => {
  const one = {
    passThroughOn: false,
    rent: 29769.6,
    pace: 1,
    maxFleet: 1,
    horizon: 121,
    renewalPct: 0,
    tier1Pct: 0,
    tier2Pct: 0,
  };

  it('fixa o regime em lucro real com as alíquotas da constante', () => {
    assert.deepEqual(LUCRO_REAL, {
      pisCofinsPct: 9.25,
      maintenanceCreditPct: 9.25,
      irpjPct: 15,
      irpjSurchargePct: 10,
      irpjSurchargeThreshold: 20000,
      csllPct: 9,
      lossOffsetCapPct: 30,
    });
    const result = evaluate({});
    assert.equal('revenueTaxPct' in result, false);
    assert.equal(sanitize({ revenueTaxPct: 5 }).revenueTaxPct, undefined);
    const note = taxNote(result);
    assert.match(note, /Lucro real/);
    assert.match(note, /9,25%/);
    assert.match(note, /34%/);
    assert.match(note, /30%/);
    const text = explain(result).map((block) => block.lines.join('\n')).join('\n');
    assert.match(text, /LUCRO_REAL/);
    assert.match(text, /Lucro tributável/);
  });

  it('limita os créditos ao débito de PIS/COFINS e carrega o saldo', () => {
    const result = evaluate(one);
    const total = cents(1300000 * 0.25);
    let pool = 0;
    for (const month of result.months) {
      assert.equal(month.debitCents, Math.round((month.grossCents + month.setupCents) * 0.0925));
      assert.equal(month.maintenanceCreditCents, Math.round(month.maintenanceCents * 0.0925));
      pool += month.creditCents + month.maintenanceCreditCents;
      const used = Math.min(pool, month.debitCents);
      pool -= used;
      assert.equal(month.creditUsedCents, used);
      assert.ok(month.creditUsedCents <= month.debitCents);
      assert.equal(month.pisCofinsCents, month.debitCents - used);
      assert.equal(month.creditBalanceCents, pool);
    }
    const second = result.months[1];
    assert.equal(second.creditCents, Math.ceil(total / 48));
    assert.equal(second.creditUsedCents, second.debitCents);
    assert.equal(second.creditBalanceCents, second.creditCents + second.maintenanceCreditCents - second.debitCents);
    assert.equal(second.pisCofinsCents, 0);
    assert.ok(result.months[48].creditBalanceCents > 0);
    // O saldo acaba antes do fim da vida e, daí em diante, o PIS/COFINS volta a ser pago.
    const firstPaid = result.months.findIndex((month) => month.pisCofinsCents > 0);
    assert.equal(result.months[firstPaid].month, 112);
    assert.equal(result.months[firstPaid].creditBalanceCents, 0);
    assert.ok(result.months.slice(1, firstPaid).every((month) => month.pisCofinsCents === 0));
    assert.ok(result.months.slice(firstPaid, 120).every((month) => month.pisCofinsCents > 0));
    // Sem débito (aluguel quase zero), o crédito não vira caixa.
    const idle = evaluate({ ...one, rent: 1 });
    assert.ok(idle.creditBalance > 300000);
    assert.equal(
      idle.months.reduce((sum, month) => sum + month.creditUsedCents, 0),
      idle.months.reduce((sum, month) => sum + month.debitCents, 0),
    );
  });

  it('calcula o IR/CSLL sobre o lucro com depreciação e compensa no máximo 30%', () => {
    const result = evaluate(one);
    const depreciation = cents((1300000 * (1 - 0.25 - 0.2)) / 120);
    const first = result.months[0];
    assert.equal(first.depreciationCents, depreciation);
    assert.equal(first.taxableCents, -depreciation);
    assert.equal(first.incomeTaxCents, 0);
    assert.equal(first.lossCarryCents, depreciation);
    const second = result.months[1];
    const expectedTaxable =
      second.grossCents -
      second.debitCents -
      second.lossCents -
      (second.maintenanceCents - second.maintenanceCreditCents) -
      depreciation;
    assert.equal(second.taxableCents, expectedTaxable);
    assert.equal(second.lossOffsetCents, Math.floor(expectedTaxable * 0.3));
    assert.equal(second.lossCarryCents, depreciation - second.lossOffsetCents);
    assert.equal(second.incomeTaxCents, Math.round((expectedTaxable - second.lossOffsetCents) * 0.24));
    const third = result.months[2];
    assert.equal(third.lossOffsetCents, second.lossCarryCents);
    assert.equal(third.lossCarryCents, 0);
    // Adicional de 10% acima de R$ 20 mil de base no mês.
    const rich = evaluate({ ...one, rent: 200000, horizon: 3 }).months[2];
    const base = rich.taxableCents - rich.lossOffsetCents;
    assert.ok(base > cents(20000));
    assert.equal(rich.incomeTaxCents, Math.round(base * 0.24 + (base - cents(20000)) * 0.1));
    // O caixa do mês fecha com receita, setup, impostos e custos.
    for (const month of result.months) {
      assert.equal(
        month.operatingCents,
        month.salesCents +
          month.setupCents -
          month.pisCofinsCents -
          month.incomeTaxCents -
          month.capexCents -
          month.maintenanceCents -
          month.otherCents +
          month.scrapCents +
          month.releaseCents,
      );
    }
  });

  it('não compra um segundo robô na visão de um contrato (C2)', () => {
    const base = evaluate({});
    assert.equal(base.contract.horizon, 121);
    assert.equal(base.contract.billingMonths, 119);
    const short = evaluate({ contractMonths: 60 });
    assert.equal(short.contract.billingMonths, 60);
    assert.ok(short.contract.profit < base.contract.profit);
    const shortest = evaluate({ contractMonths: 24 });
    assert.equal(shortest.contract.billingMonths, 24);
  });

  it('calcula payback e mínima sem o valor terminal e o mostra à parte (C3)', () => {
    const base = evaluate({});
    const last = base.months[base.months.length - 1];
    assert.equal(base.terminalCents, last.terminalCents);
    assert.ok(base.terminalCents > 0);
    assert.equal(last.cumulativeCents, Math.round(base.cumulative * 100));
    assert.equal(last.netCents, last.operatingCents + last.terminalCents);
    assert.equal(cents(base.cumulativeWithTerminal), cents(base.cumulative) + base.terminalCents);
    // Antes, o valor de livro do mês 180 virava "Payback mês 180" com aluguel de R$ 10.000.
    const low = evaluate({ passThroughOn: false, rent: 10000 });
    assert.equal(low.payback, null);
    assert.ok(low.cumulative + low.terminal > 0);
    const late = evaluate({ passThroughOn: false, targetPayback: 180 });
    const at = evaluate({ passThroughOn: false, rent: late.suggestedRent });
    assert.ok(at.months[178].cumulativeCents < 0);
    assert.ok(at.months[179].cumulativeCents >= 0);
    assert.equal(at.payback, 180);
    const text = explain(base).map((block) => block.lines.join('\n')).join('\n');
    assert.match(text, /Valor terminal, à parte/);
  });

  it('exige a 2ª faixa depois da 1ª e lê percentuais com ponto decimal', () => {
    assert.equal(sanitize({ tier1From: 60, tier2From: 50 }).tier2From, 61);
    assert.equal(sanitize({ tier1From: 10, tier2From: 50 }).tier2From, 50);
    const inverted = evaluate({ passThroughOn: false, rent: 1, horizon: 66, tier1From: 60, tier2From: 50 });
    assert.equal(inverted.months[54].capexCents, cents(1300000));
    assert.equal(inverted.months[59].capexCents, cents(1300000 * 0.95));
    assert.equal(inverted.months[60].capexCents, cents(1300000 * 0.9));
    assert.equal(parseBr('0.250'), 0.25);
    assert.equal(parseBr('1.500'), 1500);
    assert.equal(parseBr('1.300.000'), 1300000);
    assert.equal(parseBr('2,5'), 2.5);
    assert.equal(parseBr('2.500', { decimalDot: true }), 2.5);
    assert.equal(parseBr('9.250', { decimalDot: true }), 9.25);
    const calc = readFileSync(join(root, 'public/interno/locacao/calc.js'), 'utf8');
    assert.equal(calc.includes('implantCents'), false);
  });

  it('não sobrescreve o payback alvo nem a 2ª tranche ao mudar o horizonte (A2)', () => {
    const app = readFileSync(join(root, 'public/interno/locacao/app.js'), 'utf8');
    const commit = app.slice(app.indexOf('function commit()'), app.indexOf('function bindChrome()'));
    assert.doesNotMatch(commit, /state\.targetPayback\s*=/);
    assert.doesNotMatch(commit, /state\.tranche2Month\s*=/);
    assert.doesNotMatch(app, /state\.(targetPayback|tranche2Month)\s*=[^=]/);
    // O calc limita os dois só na conta.
    const clamped = sanitize({ horizon: 12, targetPayback: 36, tranche2Month: 13 });
    assert.equal(clamped.targetPayback, 12);
    assert.equal(clamped.tranche2Month, 12);
    assert.equal(sanitize({ horizon: 180, targetPayback: 36, tranche2Month: 13 }).targetPayback, 36);
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
    assert.equal(page.includes('manutencao'), false);
    assert.equal(app.includes('manutencao'), false);
    assert.equal(calc.includes('manutencao'), false);
    assert.match(app, /from '\.\/calc\.js'/);
    assert.match(app, /Mensalidade mínima/);
    assert.match(app, /Manutenção terceirizada/);
    assert.match(page, /Manutenção terceirizada/);
    assert.match(app, /gcalc\.locacao\.interno\.v3/);
    assert.match(page, /Repasse da economia da loja/);
    assert.match(page, /120 meses/);
    assert.match(page, /180 meses/);
    assert.match(app, /Saving líquido da loja/);
    assert.match(app, /Meses para recuperar o crédito/);
    assert.match(page, /Informe o valuation pre-money/);
    assert.match(page, /48 parcelas mensais iguais/);
    assert.match(page, /id="hero-kpis"/);
    assert.doesNotMatch(page, /abate no mês da compra/);
    assert.equal(page.includes('gcalc.t2software.co'), false);
    assert.equal(app.includes('gcalc.t2software.co'), false);
    assert.equal(calc.includes('gcalc.t2software.co'), false);
    assert.equal(page.includes('src="/'), false);
    assert.equal(existsSync(join(root, 'public/sitemap.xml')), false);
    assert.match(readFileSync(join(root, 'public/robots.txt'), 'utf8'), /Disallow:\s*\/interno\//);
  });
});
