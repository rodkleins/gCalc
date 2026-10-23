import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import {
  CLASSES,
  CONFIGURATIONS,
  DEFAULTS,
  HEIGHTS,
  LENGTH_INCLUDED,
  OPTIONS,
  PRESETS,
  PRICE_BUILD_UP,
  PRICE_TABLES,
  SAM_PROTRUSION_M,
  VOLUME_TIERS,
  WIDTHS,
  bonusLedger,
  brazilCost,
  classPriceRange,
  classesAt,
  distributeRobots,
  evaluate,
  explain,
  findSpace,
  fitsRoom,
  getConfig,
  maxHeightOf,
  milestoneTable,
  parseBr,
  quoteRobot,
  resolveSelection,
  rollout,
  sanitize,
  toCents,
  volumeBonusPct,
  widthsAt,
  yearMultipliers,
} from '../../public/interno/modelos/calc.js';

const root = join(import.meta.dirname, '../..');

function cell(heightM, widthSam, classId) {
  const config = getConfig(heightM, widthSam, classId);
  assert.ok(config, `${heightM} × ${widthSam} × ${classId}`);
  return config;
}

function close(actual, expected, digits = 6) {
  assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} ≠ ${expected}`);
}

describe('tabelas da proposta (slides 4, 8 e 14 a 23)', () => {
  it('tem 10 alturas, 7 larguras e 7 classes com os serviços do slide 8', () => {
    assert.deepEqual(HEIGHTS, [2.2, 2.35, 2.5, 2.65, 2.8, 2.95, 3.1, 3.25, 3.4, 3.55]);
    assert.deepEqual(
      WIDTHS.map((width) => [width.sam, width.compact, width.direct]),
      [
        [1.89, 1.69, 2.2],
        [2.4, 2.2, 2.6],
        [2.8, 2.6, 3.0],
        [3.2, 3.0, 3.4],
        [3.75, 3.55, 3.95],
        [4.15, 3.95, 4.35],
        [4.55, 4.35, 4.75],
      ],
    );
    for (const width of WIDTHS) close(width.sam - width.compact, SAM_PROTRUSION_M);
    assert.deepEqual(
      CLASSES.map((cls) => [cls.id, cls.approxPacks, cls.fromEur, cls.servicesEur]),
      [
        ['S', 10000, 89000, 18000],
        ['M', 15000, 98000, 19500],
        ['L', 20000, 103000, 21000],
        ['XL', 25000, 109000, 22500],
        ['XXL', 30000, 114000, 24000],
        ['3XL', 35000, 119000, 25500],
        ['4XL', 40000, 123000, 27000],
      ],
    );
  });

  it('tem 286 células válidas, com as somas travadas', () => {
    assert.equal(CONFIGURATIONS.length, 286);
    assert.equal(new Set(CONFIGURATIONS.map((config) => config.id)).size, 286);
    assert.equal(CONFIGURATIONS.reduce((sum, config) => sum + config.priceEur, 0), 32790000);
    assert.equal(CONFIGURATIONS.reduce((sum, config) => sum + Math.round(config.lengthM * 100), 0), 136476);
    assert.equal(CONFIGURATIONS.reduce((sum, config) => sum + config.capacityPacks, 0), 6408000);
    const perHeight = HEIGHTS.map((heightM) => CONFIGURATIONS.filter((config) => config.heightM === heightM).length);
    assert.deepEqual(perHeight, [34, 34, 38, 31, 27, 28, 22, 24, 24, 24]);
    const perClass = CLASSES.map((cls) => CONFIGURATIONS.filter((config) => config.classId === cls.id).length);
    assert.deepEqual(perClass, [53, 53, 49, 43, 36, 30, 22]);
  });

  it('limita as larguras maiores pela altura', () => {
    assert.equal(maxHeightOf(3.75), 2.95);
    assert.equal(maxHeightOf(4.15), 2.65);
    assert.equal(maxHeightOf(4.55), 2.5);
    for (const width of WIDTHS.slice(0, 4)) assert.equal(maxHeightOf(width.sam), 3.55);
    assert.deepEqual(
      HEIGHTS.map((heightM) => widthsAt(heightM).length),
      [7, 7, 7, 6, 5, 5, 4, 4, 4, 4],
    );
    assert.equal(getConfig(3.1, 3.75, 'S'), null);
    assert.equal(getConfig(2.2, 1.89, 'L'), null);
    // Lacuna real do slide 23: 3,55 m × 3,20 m não tem XL, mas tem XXL.
    assert.equal(getConfig(3.55, 3.2, 'XL'), null);
    assert.ok(getConfig(3.55, 3.2, 'XXL'));
    assert.deepEqual(classesAt(2.2, 1.89), ['S', 'M']);
  });

  it('confere o mínimo e o máximo de cada classe com o slide 4', () => {
    const expected = {
      S: [89000, 103000],
      M: [98000, 117000],
      L: [103000, 125000],
      XL: [109000, 130000],
      XXL: [114000, 137000],
      '3XL': [119000, 142000],
      '4XL': [123000, 146000],
    };
    for (const cls of CLASSES) {
      const range = classPriceRange(cls.id);
      assert.deepEqual([range.min, range.max], expected[cls.id], cls.id);
      assert.equal(range.min, cls.fromEur, cls.id);
    }
  });

  it('confere células avulsas contra os slides', () => {
    assert.deepEqual(PRICE_TABLES['2.20'].S['1.89'], { priceEur: 103000, lengthM: 5.63, capacityPacks: 10000 });
    assert.deepEqual(PRICE_TABLES['2.65'].S['4.15'], { priceEur: 89000, lengthM: 2.45, capacityPacks: 9000 });
    assert.deepEqual(PRICE_TABLES['3.55']['4XL']['2.40'], { priceEur: 146000, lengthM: 6.89, capacityPacks: 38500 });
    assert.deepEqual(PRICE_TABLES['3.55']['4XL']['3.20'], { priceEur: 123000, lengthM: 5.34, capacityPacks: 39500 });
    assert.deepEqual(PRICE_TABLES['3.25']['3XL']['2.40'], { priceEur: 142000, lengthM: 6.89, capacityPacks: 34500 });
    assert.deepEqual(PRICE_TABLES['3.10'].XXL['2.40'], { priceEur: 137000, lengthM: 6.55, capacityPacks: 30500 });
    assert.equal(PRICE_TABLES['2.50'].XL['2.40'].priceEur, 130000);
    assert.equal(PRICE_TABLES['2.20'].L['1.89'], null);
  });
});

describe('composição do preço e exemplos dos slides 7 e 8', () => {
  it('robô base = tabela − 25.000 em todas as 286 células', () => {
    assert.deepEqual(PRICE_BUILD_UP, { autoLoadingEur: 22000, samEur: 3000, bundledEur: 25000 });
    for (const config of CONFIGURATIONS) {
      const quote = quoteRobot(config, { includeServices: false });
      assert.equal(quote.baseRobotEur, config.priceEur - 25000);
      assert.equal(quote.baseRobotEur + 22000 + 3000, quote.tablePriceEur);
      assert.equal(quote.robotPriceEur, config.priceEur);
      assert.equal(quote.orderEur, config.priceEur);
      close(quote.coreLengthM + LENGTH_INCLUDED.manualLoadingM + LENGTH_INCLUDED.speedOptionM, config.lengthM, 9);
    }
  });

  it('reproduz os quatro exemplos na altura de 2,95 m', () => {
    const table = [
      ['ex1', 'S', 2.8, 3.08, 10500, 70000, 95000, 18000, 113000],
      ['ex2', 'L', 3.2, 4.0, 20500, 83000, 108000, 21000, 129000],
      ['ex3', 'XXL', 3.75, 4.71, 31000, 90000, 115000, 24000, 139000],
      ['ex4', '4XL', 3.75, 5.63, 40500, 103000, 128000, 27000, 155000],
    ];
    assert.equal(PRESETS.length, 4);
    for (const [id, classId, widthSam, lengthM, packs, robot, total, services, withServices] of table) {
      const preset = PRESETS.find((item) => item.id === id);
      assert.equal(preset.heightM, 2.95);
      assert.equal(preset.widthSam, widthSam);
      assert.equal(preset.classId, classId);
      const result = evaluate({ heightM: preset.heightM, widthSam: preset.widthSam, classId: preset.classId });
      const { quote } = result;
      assert.equal(result.selection.changed.length, 0);
      assert.equal(quote.tableLengthM, lengthM);
      assert.equal(quote.capacityPacks, packs);
      assert.equal(quote.baseRobotEur, robot);
      assert.equal(quote.tablePriceEur, total);
      assert.equal(quote.servicesEur, services);
      assert.equal(quote.orderEur, withServices);
      assert.deepEqual(preset.expected, {
        lengthM,
        capacityPacks: packs,
        robotEur: robot,
        totalEur: total,
        servicesEur: services,
        withServicesEur: withServices,
      });
    }
    assert.match(PRESETS[1].label, /Padrão/);
  });

  it('nasce no exemplo 2, Robô L', () => {
    assert.equal(DEFAULTS.heightM, 2.95);
    assert.equal(DEFAULTS.widthSam, 3.2);
    assert.equal(DEFAULTS.classId, 'L');
    const base = evaluate({});
    assert.equal(base.quote.tablePriceEur, 108000);
    assert.equal(base.quote.orderEur, 129000);
    assert.equal(base.quote.footprintM2, 12.8);
    assert.equal(base.quote.volumeM3, 37.76);
  });
});

describe('opcionais e serviços (slide 6)', () => {
  const config = cell(2.95, 3.2, 'L');

  it('soma 14.000 e 0,68 m com o 2º braço, e a área cresce junto', () => {
    const plain = quoteRobot(config, {});
    const grip = quoteRobot(config, { secondGripper: true });
    assert.equal(OPTIONS.secondGripperEur, 14000);
    assert.equal(OPTIONS.secondGripperLengthM, 0.68);
    assert.equal(grip.secondGripperEur, 14000);
    assert.equal(grip.orderEur - plain.orderEur, 14000);
    assert.equal(grip.totalLengthM, 4.68);
    assert.equal(grip.tableLengthM, 4.0);
    assert.equal(grip.extraLengthM, 0.68);
    close(grip.footprintM2 - plain.footprintM2, 3.2 * 0.68);
    assert.equal(grip.footprintM2, 14.976);
    close(grip.volumeM3, 14.976 * 2.95, 4);
    const ex1 = quoteRobot(cell(2.95, 2.8, 'S'), { secondGripper: true });
    assert.equal(ex1.totalLengthM, 3.76);
  });

  it('soma 8.000 da refrigeração e o valor digitado das esteiras', () => {
    const cooled = quoteRobot(config, { coolingModule: true });
    assert.equal(cooled.coolingEur, 8000);
    assert.equal(cooled.orderEur, 129000 + 8000);
    const belts = quoteRobot(config, { conveyorEur: 12345.67 });
    assert.equal(belts.conveyorEur, 12345.67);
    assert.equal(belts.orderEur, 129000 + 12345.67);
    const all = quoteRobot(config, { secondGripper: true, coolingModule: true, conveyorEur: 5000 });
    assert.equal(all.equipmentEur, 108000 + 14000 + 8000 + 5000);
    assert.equal(all.orderEur, all.equipmentEur + 21000);
    assert.equal(quoteRobot(config, { conveyorEur: -10 }).conveyorEur, 0);
  });

  it('cobra os serviços pela classe e permite deixá-los de fora', () => {
    const expected = { S: 18000, M: 19500, L: 21000, XL: 22500, XXL: 24000, '3XL': 25500, '4XL': 27000 };
    for (const cls of CLASSES) {
      const sample = CONFIGURATIONS.find((item) => item.classId === cls.id);
      const quote = quoteRobot(sample, {});
      assert.equal(quote.servicesEur, expected[cls.id]);
      assert.equal(quote.orderEur, sample.priceEur + expected[cls.id]);
      const without = quoteRobot(sample, { includeServices: false });
      assert.equal(without.servicesEur, 0);
      assert.equal(without.classServicesEur, expected[cls.id]);
    }
  });
});

describe('busca por espaço da loja', () => {
  it('filtra por altura, largura em cada referência, comprimento e capacidade', () => {
    const room = { roomFilterOn: true, roomHeightM: 3, roomWidthM: 3.5, roomLengthM: 5, minCapacity: 20000 };
    const space = findSpace(room);
    assert.equal(space.active, true);
    assert.equal(space.total, 286);
    assert.equal(space.count, 10);
    for (const quote of space.matches) {
      assert.ok(quote.heightM <= 3);
      assert.ok(quote.widthSam <= 3.5);
      assert.ok(quote.totalLengthM <= 5);
      assert.ok(quote.capacityPacks >= 20000);
    }
    const brute = CONFIGURATIONS.filter(
      (config) => config.heightM <= 3 && config.widthSam <= 3.5 && config.lengthM <= 5 && config.capacityPacks >= 20000,
    );
    assert.deepEqual(space.matches.map((quote) => quote.config.id).sort(), brute.map((config) => config.id).sort());

    const compact = findSpace({ ...room, roomWidthRef: 'compact', roomWidthM: 3.0 });
    assert.ok(compact.matches.every((quote) => quote.widthCompact <= 3.0));
    assert.ok(compact.matches.some((quote) => quote.widthSam === 3.2));
    const direct = findSpace({ ...room, roomWidthRef: 'direct', roomWidthM: 3.0 });
    assert.ok(direct.matches.every((quote) => quote.widthDirect <= 3.0));
    assert.ok(direct.matches.every((quote) => quote.widthSam <= 2.8));
  });

  it('soma 0,68 m do 2º braço ao comprimento', () => {
    const room = { roomFilterOn: true, roomHeightM: null, roomWidthM: null, roomLengthM: 4.0, minCapacity: null };
    const plain = findSpace(room);
    const grip = findSpace({ ...room, secondGripper: true });
    assert.equal(plain.count, CONFIGURATIONS.filter((config) => config.lengthM <= 4.0).length);
    assert.equal(grip.count, CONFIGURATIONS.filter((config) => config.lengthM + 0.68 <= 4.0 + 1e-9).length);
    assert.ok(grip.count < plain.count);
    const ex2 = cell(2.95, 3.2, 'L');
    assert.equal(fitsRoom(ex2, room).fits, true);
    const tight = fitsRoom(ex2, { ...room, secondGripper: true });
    assert.equal(tight.fits, false);
    assert.equal(tight.lengthM, 4.68);
    assert.equal(tight.checks[2].status, 'over');
    assert.equal(tight.checks[2].marginM, -0.68);
  });

  it('acha o mais barato, a menor área e a maior capacidade', () => {
    const space = findSpace({ roomFilterOn: true, roomHeightM: 3, roomWidthM: 3.5, roomLengthM: 5, minCapacity: 20000 });
    assert.equal(space.cheapest.config.id, '2.95|3.20|L');
    assert.equal(space.cheapest.orderEur, 129000);
    assert.equal(space.smallest.footprintM2, Math.min(...space.matches.map((quote) => quote.footprintM2)));
    assert.equal(space.largest.capacityPacks, Math.max(...space.matches.map((quote) => quote.capacityPacks)));
    assert.equal(space.largest.config.id, '2.95|3.20|XL');
    const everything = findSpace({ roomFilterOn: true, roomHeightM: null, roomWidthM: null, roomLengthM: null, minCapacity: null });
    assert.equal(everything.count, 286);
    assert.equal(everything.cheapest.tablePriceEur, 89000);
    assert.equal(everything.largest.capacityPacks, 41500);
    const none = findSpace({ roomFilterOn: true, roomHeightM: 2.0 });
    assert.equal(none.count, 0);
    assert.equal(none.cheapest, null);
  });

  it('marca folga apertada abaixo de 10 cm', () => {
    const check = fitsRoom(cell(2.95, 3.2, 'L'), { roomHeightM: 3.0, roomWidthM: 3.5, roomLengthM: 5 });
    assert.equal(check.checks[0].status, 'tight');
    assert.equal(check.checks[0].marginM, 0.05);
    assert.equal(check.checks[1].status, 'ok');
  });
});

describe('seleção sempre numa célula da tabela', () => {
  it('mantém o campo mexido e ajusta o resto', () => {
    const height = resolveSelection({ heightM: 3.55, widthSam: 3.75, classId: '4XL' }, 'height');
    assert.equal(height.config.id, '3.55|3.20|4XL');
    assert.deepEqual(height.changed, ['widthSam']);
    const width = resolveSelection({ heightM: 3.55, widthSam: 4.55, classId: 'S' }, 'width');
    assert.equal(width.widthSam, 4.55);
    assert.equal(width.heightM, 2.5);
    const cls = resolveSelection({ heightM: 2.2, widthSam: 1.89, classId: 'L' }, 'class');
    assert.equal(cls.classId, 'L');
    assert.equal(cls.config.id, '2.20|2.40|L');
    const valid = resolveSelection({ heightM: 2.95, widthSam: 3.2, classId: 'L' }, 'class');
    assert.deepEqual(valid.changed, []);
    for (const config of CONFIGURATIONS) {
      assert.equal(resolveSelection(config).config.id, config.id);
    }
    assert.equal(sanitize({ heightM: 2.97, widthSam: 3.3, classId: 'XXXL' }).heightM, 2.95);
    assert.equal(sanitize({ widthSam: 3.3 }).widthSam, 3.2);
    assert.equal(sanitize({ classId: 'XXXL' }).classId, 'L');
  });
});

describe('acordo-quadro: VPI, faixas e notas de crédito (slides 10 a 12)', () => {
  it('usa as faixas pela contagem acumulada', () => {
    assert.deepEqual(VOLUME_TIERS.map((tier) => [tier.from, tier.pct]), [[1, 0], [10, 2], [25, 4], [50, 6], [100, 8]]);
    const cases = [[0, 0], [1, 0], [9, 0], [10, 2], [24, 2], [25, 4], [49, 4], [50, 6], [99, 6], [100, 8], [500, 8]];
    for (const [count, pct] of cases) assert.equal(volumeBonusPct(count), pct, String(count));
  });

  it('repete o slide 12 com € 100.000 por robô', () => {
    const ledger = bonusLedger(Array.from({ length: 120 }, () => 100000));
    assert.deepEqual(
      ledger.milestones.map((item) => [item.robot, item.fromPct, item.toPct, item.bandInvoiceBonusCents, item.creditNoteCents, item.cumulativeCents, item.bonusToDateCents]),
      [
        [10, 0, 2, 0, toCents(20000), toCents(1000000), toCents(20000)],
        [25, 2, 4, toCents(30000), toCents(50000), toCents(2500000), toCents(100000)],
        [50, 4, 6, toCents(100000), toCents(100000), toCents(5000000), toCents(300000)],
        [100, 6, 8, toCents(300000), toCents(200000), toCents(10000000), toCents(800000)],
      ],
    );
    assert.equal(ledger.robots[0].invoicePct, 0);
    assert.equal(ledger.robots[9].invoicePct, 0);
    assert.equal(ledger.robots[10].invoicePct, 2);
    assert.equal(ledger.robots[24].invoicePct, 2);
    assert.equal(ledger.robots[25].invoicePct, 4);
    assert.equal(ledger.robots[99].invoicePct, 6);
    assert.equal(ledger.robots[100].invoicePct, 8);
    assert.equal(ledger.robots[100].invoiceBonusCents, toCents(8000));
    assert.equal(ledger.robots[100].creditNoteCents, 0);
    assert.equal(ledger.bonusCents, toCents(800000 + 20 * 8000));
    const rows = milestoneTable(ledger);
    assert.deepEqual(
      rows.map((row) => [row.from, row.to, row.invoicePct, row.levelPct, row.reached]),
      [[1, 10, 0, 2, true], [11, 25, 2, 4, true], [26, 50, 4, 6, true], [51, 100, 6, 8, true], [101, null, 8, 8, true]],
    );
    assert.deepEqual(rows.slice(0, 4).map((row) => row.effectivePct), [2, 4, 6, 8]);
    assert.equal(rows[4].robots, 20);
  });

  it('marca a faixa que falta quando a frota não chega', () => {
    const rows = milestoneTable(bonusLedger(Array.from({ length: 30 }, () => 100000)));
    assert.equal(rows[1].reached, true);
    assert.equal(rows[2].reached, false);
    assert.equal(rows[2].missing, 20);
    assert.equal(rows[3].missing, 70);
    assert.equal(bonusLedger([]).bonusCents, 0);
    assert.equal(bonusLedger([100000]).bonusCents, 0);
  });

  it('fixa os anos 1 e 2 e aplica o VPI composto nos anos 3 a 5', () => {
    const factors = yearMultipliers(2);
    assert.equal(factors[0], 1);
    assert.equal(factors[1], 1);
    close(factors[2], 1.02, 12);
    close(factors[3], 1.0404, 12);
    close(factors[4], 1.061208, 12);
    assert.deepEqual(yearMultipliers(0), [1, 1, 1, 1, 1]);
  });

  it('roda o rollout com VPI e notas retroativas ano a ano', () => {
    const plan = rollout(
      { year1Robots: 5, year2Robots: 5, year3Robots: 5, year4Robots: 5, year5Robots: 5, germanInflationPct: 2, fxRate: 6.2 },
      100000,
    );
    assert.deepEqual(plan.unitByYear, [100000, 100000, 102000, 104040, 106120.8]);
    const y3 = 5 * toCents(102000 * 0.02);
    const y4 = 5 * toCents(104040 * 0.02);
    const y5 = 5 * toCents(106120.8 * 0.02);
    const cumulative = toCents(1000000 + 510000 + 520200 + 530604);
    const credit25 = Math.round(cumulative * 0.04) - (toCents(20000) + y3 + y4 + y5);
    assert.deepEqual(plan.years.map((year) => year.robots), [5, 5, 5, 5, 5]);
    assert.deepEqual(plan.years.map((year) => year.cumulative), [5, 10, 15, 20, 25]);
    assert.deepEqual(plan.years.map((year) => year.creditNoteCents), [0, toCents(20000), 0, 0, credit25]);
    assert.deepEqual(plan.years.map((year) => year.invoiceBonusCents), [0, 0, y3, y4, y5]);
    assert.deepEqual(plan.years.map((year) => year.tierPct), [0, 2, 2, 2, 4]);
    assert.deepEqual(plan.years[4].milestones, [25]);
    assert.equal(toCents(plan.bonus), Math.round(cumulative * 0.04));
    assert.equal(plan.finalTierPct, 4);
    for (const year of plan.years) {
      assert.equal(year.bonusCents, year.invoiceBonusCents + year.creditNoteCents);
      assert.equal(year.netCents, year.grossCents - year.bonusCents);
      close(year.netBrl, toCents((year.netCents / 100) * 6.2) / 100, 2);
    }
    assert.equal(plan.next.from, 50);
  });

  it('padrão: 5, 10, 15, 10 e 10 robôs fecham em 6%', () => {
    const result = evaluate({});
    const plan = result.rollout;
    assert.equal(plan.totalRobots, 50);
    assert.equal(plan.finalTierPct, 6);
    assert.deepEqual(plan.milestones.filter((row) => row.reached).map((row) => row.to), [10, 25, 50]);
    close(plan.bonus, plan.gross * 0.06, 1);
    close(plan.avgNetEur, plan.net / 50, 6);
    assert.equal(rollout({ ...DEFAULTS, germanInflationPct: 0 }, 100000).bonus, 300000);
    assert.deepEqual(distributeRobots(1), [1, 0, 0, 0, 0]);
    assert.deepEqual(distributeRobots(10), [2, 2, 2, 2, 2]);
    assert.deepEqual(distributeRobots(27), [6, 6, 5, 5, 5]);
    assert.equal(rollout({ ...DEFAULTS, year1Robots: 0, year2Robots: 0, year3Robots: 0, year4Robots: 0, year5Robots: 0 }, 1).avgNetEur, null);
  });
});

describe('câmbio e custo Brasil', () => {
  it('converte, nacionaliza e desconta o crédito', () => {
    const pure = brazilCost(129000, { fxRate: 6.2, importCostPct: 0, taxCreditPct: 25 });
    assert.equal(pure.grossBrl, 799800);
    assert.equal(pure.importBrl, 0);
    assert.equal(pure.creditBrl, 199950);
    assert.equal(pure.netBrl, 599850);
    const landed = brazilCost(129000, { fxRate: 6.2, importCostPct: 35, taxCreditPct: 25 });
    assert.equal(landed.importBrl, 279930);
    assert.equal(landed.landedBrl, 1079730);
    assert.equal(landed.creditBrl, 269932.5);
    assert.equal(landed.netBrl, 809797.5);
    const heavy = brazilCost(100000, { fxRate: 5.5, importCostPct: 60, taxCreditPct: 0 });
    assert.equal(heavy.netBrl, 880000);
    assert.equal(DEFAULTS.fxRate, 6.2);
    assert.equal(DEFAULTS.importCostPct, 0);
    assert.equal(DEFAULTS.taxCreditPct, 25);
  });

  it('leva o custo Brasil para o resultado e para a memória de cálculo', () => {
    const result = evaluate({ importCostPct: 35 });
    assert.equal(result.brazil.netBrl, 809797.5);
    assert.equal(result.brl.tablePrice, 108000 * 6.2);
    close(result.brlPerPack, 809797.5 / 20500, 9);
    const text = explain(result).map((block) => `${block.title}\n${block.lines.join('\n')}`).join('\n');
    for (const pattern of [/Custo Brasil/, /Robô base/, /nota de crédito/, /VPI|1 \+ 2%/, /Filtro da sala desligado/]) {
      assert.match(text, pattern);
    }
    assert.equal(parseBr('6.20', { decimalDot: true }), 6.2);
    assert.equal(parseBr('6,20'), 6.2);
    assert.equal(parseBr('129.000'), 129000);
    assert.equal(parseBr('€ 14.000'), 14000);
  });
});

describe('página de modelos isolada', () => {
  const dir = 'public/interno/modelos';
  const page = readFileSync(join(root, dir, 'index.html'), 'utf8');
  const app = readFileSync(join(root, dir, 'app.js'), 'utf8');
  const calc = readFileSync(join(root, dir, 'calc.js'), 'utf8');
  const css = readFileSync(join(root, dir, 'styles.css'), 'utf8');

  it('é noindex, relativa e sem links para outras calculadoras', () => {
    assert.match(page, /<meta name="robots" content="noindex,nofollow"\s*\/?>/);
    assert.match(page, /href="\.\/styles\.css"/);
    assert.match(page, /src="\.\/app\.js"/);
    assert.match(app, /from '\.\/calc\.js'/);
    for (const text of [page, app, calc, css]) {
      for (const banned of ['locacao', 'manutencao', 'gcalc.t2software.co', 'href="/', 'src="/', 'href="../', "from '../"]) {
        assert.equal(text.includes(banned), false, banned);
      }
      assert.doesNotMatch(text, /payback/i);
      assert.doesNotMatch(text, /fetch\(/);
    }
    const links = [...page.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    for (const link of links) {
      assert.ok(
        link.startsWith('./') || link.startsWith('#') || link.startsWith('data:') || link.startsWith('https://fonts.'),
        link,
      );
    }
    assert.equal(existsSync(join(root, 'public/sitemap.xml')), false);
    assert.match(readFileSync(join(root, 'public/robots.txt'), 'utf8'), /Disallow:\s*\/interno\//);
  });

  it('tem os blocos pedidos', () => {
    for (const id of ['form', 'resultados', 'hero-kpis', 'viewer-card', 'space-results', 'price-breakdown', 'matrix-section', 'rollout-section', 'memoria', 'ver-calculo', 'fontes']) {
      assert.match(page, new RegExp(`id="${id}"`), id);
    }
    assert.match(page, /Uso interno · não indexar/);
    assert.match(page, /Simulador de Modelos e Acordo Comercial Gollmann/);
    assert.match(page, /Imprimir em A4/);
    assert.match(page, /Restaurar premissas/);
    for (const label of ['Ex. 1 · Robô S', 'Ex. 2 · Robô L (Padrão)', 'Ex. 3 · Robô XXL', 'Ex. 4 · Robô 4XL', 'Isométrica', 'Frontal', 'Corte / Interna', 'Planta (Topo)', 'Vista Interna / Raios-X']) {
      assert.ok(page.includes(label), label);
    }
    assert.match(page, /class="dock/);
    assert.match(page, /<canvas id="viewer"/);
    for (const color of ['#009bb4', '#8ab81a', '#b5124b', '#23272b']) assert.ok(app.includes(color), color);
    assert.match(app, /gcalc\.modelos\.interno\.v1/);
    assert.match(app, /Filtrar por medidas da sala/);
    assert.match(app, /Inflação alemã VPI/);
    assert.match(app, /1,70 m/);
    assert.match(css, /@media print/);
  });

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
      'public/interno/locacao/index.html',
      'public/interno/locacao/app.js',
      'public/interno/locacao/calc.js',
    ];
    for (const file of untouched) {
      const text = readFileSync(join(root, file), 'utf8');
      assert.equal(text.includes('interno/modelos'), false, file);
    }
  });
});
