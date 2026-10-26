import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import {
  AVERAGE_SERVICES_EUR,
  CLASSES,
  CONFIGURATIONS,
  DEFAULTS,
  HEIGHTS,
  LENGTH_INCLUDED,
  NCM_INFO,
  OPTIONS,
  PRESETS,
  PRICE_BUILD_UP,
  PRICE_TABLES,
  SAM_PROTRUSION_M,
  VOLUME_TIERS,
  WIDTHS,
  bonusLedger,
  brazilCost,
  classOf,
  classPriceRange,
  classesAt,
  distributeRobots,
  evaluate,
  explain,
  findSpace,
  formatBRL,
  formatEUR,
  fitsRoom,
  getConfig,
  maxHeightOf,
  milestoneTable,
  ncmTaxReference,
  parseBr,
  quoteRobot,
  resolveSelection,
  rollout,
  physicalWidthM,
  sanitize,
  toCents,
  volumeBonusPct,
  volumeTiersTable,
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
      // Os slides usam o transporte e instalação da classe; o simulador nasce na média e aceita o valor da classe.
      const result = evaluate({
        heightM: preset.heightM,
        widthSam: preset.widthSam,
        classId: preset.classId,
        servicesEur: classOf(classId).servicesEur,
      });
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

  it('nasce no exemplo 2, Robô L, com a média de transporte e instalação', () => {
    assert.equal(DEFAULTS.heightM, 2.95);
    assert.equal(DEFAULTS.widthSam, 3.2);
    assert.equal(DEFAULTS.classId, 'L');
    assert.equal(AVERAGE_SERVICES_EUR, 22500);
    assert.equal(DEFAULTS.servicesEur, 22500);
    assert.equal(DEFAULTS.localServicesBrl, 0);
    assert.equal(DEFAULTS.fleetRobots, 1);
    const base = evaluate({});
    assert.equal(base.quote.tablePriceEur, 108000);
    assert.equal(base.quote.servicesEur, 22500);
    assert.equal(base.quote.orderEur, 130500);
    assert.equal(base.quote.discountPct, 0);
    assert.equal(base.quote.netOrderEur, 130500);
    assert.equal(base.quote.footprintM2, 12.8);
    assert.equal(base.quote.volumeM3, 37.76);
    assert.equal(base.modelLine, 'compact');
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
    assert.equal(cooled.optionsEur, 8000);
    assert.equal(cooled.orderEur, 130500 + 8000);
    const belts = quoteRobot(config, { conveyorEur: 12345.67 });
    assert.equal(belts.conveyorEur, 12345.67);
    assert.equal(belts.orderEur, 130500 + 12345.67);
    const all = quoteRobot(config, { secondGripper: true, coolingModule: true, conveyorEur: 5000 });
    assert.equal(all.optionsEur, 14000 + 8000 + 5000);
    assert.equal(all.equipmentEur, 108000 + all.optionsEur);
    assert.equal(all.servicesEur, 22500);
    assert.equal(all.orderEur, all.equipmentEur + 22500);
    assert.equal(quoteRobot(config, { conveyorEur: -10 }).conveyorEur, 0);
  });

  it('separa opcionais, transporte e instalação editável e serviços locais em R$', () => {
    const expected = { S: 18000, M: 19500, L: 21000, XL: 22500, XXL: 24000, '3XL': 25500, '4XL': 27000 };
    for (const cls of CLASSES) {
      const sample = CONFIGURATIONS.find((item) => item.classId === cls.id);
      const quote = quoteRobot(sample, {});
      assert.equal(quote.servicesEur, 22500);
      assert.equal(quote.classServicesEur, expected[cls.id]);
      assert.equal(quote.optionsEur, 0);
      assert.equal(quote.orderEur, sample.priceEur + 22500);
      const byClass = quoteRobot(sample, { servicesEur: cls.servicesEur });
      assert.equal(byClass.servicesEur, expected[cls.id]);
      assert.equal(byClass.orderEur, sample.priceEur + expected[cls.id]);
      const without = quoteRobot(sample, { includeServices: false });
      assert.equal(without.servicesEur, 0);
      assert.equal(without.includeServices, false);
      assert.equal(without.classServicesEur, expected[cls.id]);
    }
    const custom = quoteRobot(config, { servicesEur: 30000.5, localServicesBrl: 62000, fxRate: 6.2 });
    assert.equal(custom.servicesEur, 30000.5);
    assert.equal(custom.orderEur, 108000 + 30000.5);
    assert.equal(custom.localServicesBrl, 62000);
    assert.equal(custom.localServicesEurApprox, 10000);
    assert.equal(quoteRobot(config, { servicesEur: 0 }).includeServices, false);
    assert.equal(quoteRobot(config, { servicesEur: -5, localServicesBrl: -1 }).servicesEur, 0);
    assert.equal(sanitize({ localServicesBrl: -1 }).localServicesBrl, 0);
    assert.equal(sanitize({ fleetRobots: 0 }).fleetRobots, 1);
    assert.equal(sanitize({ fleetRobots: 12.6 }).fleetRobots, 13);
  });

  it('aplica o desconto por volume ao pedido Gollmann e não aos serviços locais', () => {
    const quote = quoteRobot(config, { fleetRobots: 25, coolingModule: true, localServicesBrl: 50000 });
    assert.equal(quote.orderEur, 108000 + 8000 + 22500);
    assert.equal(quote.discountPct, 4);
    assert.equal(quote.discountEur, 5540);
    assert.equal(quote.netOrderEur, 138500 - 5540);
    assert.equal(quote.localServicesBrl, 50000);
    for (const [fleetRobots, pct] of [[1, 0], [9, 0], [10, 2], [24, 2], [25, 4], [50, 6], [99, 6], [100, 8], [250, 8]]) {
      const item = quoteRobot(config, { fleetRobots });
      assert.equal(item.discountPct, pct, String(fleetRobots));
      assert.equal(item.discountEur, toCents(130500 * (pct / 100)) / 100);
      assert.equal(item.netOrderEur, 130500 - item.discountEur);
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
    assert.equal(space.cheapest.orderEur, 130500);
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
    const plan = rollout({}, 129000);
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

describe('importação da NCM 8479.89.99 e créditos', () => {
  it('traz as alíquotas da NCM e os padrões fiscais', () => {
    assert.deepEqual(NCM_INFO, {
      code: '8479.89.99',
      description: 'Outras máquinas e aparelhos mecânicos com função própria (Bem de Capital — BK)',
      iiTecPct: 12.6,
      iiGecex2026Pct: 20,
      ipiPct: 0,
      pisPct: 2.1,
      cofinsBasePct: 9.65,
      cofinsAddPct: 0.6,
      cofinsTotalPct: 10.25,
      icmsConvenio5291Pct: 8.8,
      icmsFullSpPct: 18,
    });
    assert.equal(DEFAULTS.fxRate, 6.2);
    assert.equal(DEFAULTS.exTarifario, true);
    assert.equal(DEFAULTS.iiRatePct, 12.6);
    assert.equal(DEFAULTS.ipiRatePct, 0);
    assert.equal(DEFAULTS.pisRatePct, 2.1);
    assert.equal(DEFAULTS.cofinsBaseRatePct, 9.65);
    assert.equal(DEFAULTS.cofinsAddRatePct, 0.6);
    assert.equal(DEFAULTS.customsExpensesPct, 0);
    assert.equal(DEFAULTS.convenioIcms5291, true);
    assert.equal(DEFAULTS.icmsRatePct, 8.8);
    assert.equal(DEFAULTS.creditPisCofins, true);
    assert.equal(DEFAULTS.creditIcms, true);
    assert.equal(DEFAULTS.icmsCreditFactorPct, 100);
    assert.equal('importCostPct' in DEFAULTS, false);
    assert.equal('taxCreditPct' in DEFAULTS, false);
  });

  it('calcula a cascata padrão: Ex-Tarifário, Convênio 52/91 e créditos ligados', () => {
    const b = brazilCost(100000, {});
    assert.equal(b.vaBrl, 620000);
    assert.equal(b.grossBrl, 620000);
    assert.equal(b.effectiveIiPct, 0);
    assert.equal(b.iiBrl, 0);
    assert.equal(b.ipiBaseBrl, 620000);
    assert.equal(b.ipiBrl, 0);
    assert.equal(b.pisBrl, 13020);
    assert.equal(b.cofinsBaseBrl, 59830);
    assert.equal(b.cofinsAddBrl, 3720);
    assert.equal(b.cofinsRatePct, 10.25);
    assert.equal(b.cofinsBrl, 63550);
    assert.equal(b.customsExpensesBrl, 0);
    assert.equal(b.icmsNumeratorBrl, 696570);
    assert.equal(b.icmsBaseBrl, toCents((620000 + 13020 + 63550) / (1 - 0.088)) / 100);
    assert.equal(b.icmsBaseBrl, 763782.89);
    assert.equal(b.icmsBrl, toCents(763782.89 * 0.088) / 100);
    assert.equal(b.icmsBrl, 67212.89);
    assert.equal(b.importBrl, 143782.89);
    close(b.effectiveImportPct, 23.1908, 4);
    assert.equal(b.importCostPct, b.effectiveImportPct);
    assert.equal(b.landedBrl, 763782.89);
    assert.equal(b.creditPisBrl, 13020);
    assert.equal(b.creditCofinsBrl, 59830);
    assert.equal(b.creditPisCofinsBrl, 72850);
    close(b.creditPisCofinsBrl / b.vaBrl, 0.1175, 12);
    assert.equal(b.creditIcmsBrl, 67212.89);
    assert.equal(b.creditBrl, 140062.89);
    // Só o adicional de 0,60% da COFINS fica como custo.
    assert.equal(b.nonRecoverableBrl, 3720);
    close(b.effectiveNetTaxPct, 0.6, 9);
    assert.equal(b.netBrl, 623720);
    close(b.effectiveCreditOnVaPct, (140062.89 / 620000) * 100, 9);
    close(b.effectiveCreditOnLandedPct, (140062.89 / 763782.89) * 100, 9);
    assert.equal(b.taxCreditPct, b.effectiveCreditOnLandedPct);
  });

  it('cobra o II sem Ex-Tarifário e nunca o credita', () => {
    const base = brazilCost(100000, {});
    for (const iiRatePct of [12.6, 20]) {
      const off = brazilCost(100000, { exTarifario: false, iiRatePct });
      assert.equal(off.effectiveIiPct, iiRatePct);
      assert.equal(off.iiBrl, toCents(620000 * (iiRatePct / 100)) / 100);
      assert.ok(off.iiBrl > 0);
      assert.equal(off.ipiBaseBrl, 620000 + off.iiBrl);
      assert.equal(off.pisBrl, base.pisBrl);
      assert.equal(off.cofinsBrl, base.cofinsBrl);
      assert.ok(off.icmsBaseBrl > base.icmsBaseBrl);
      assert.equal(off.icmsBaseBrl, toCents((696570 + off.iiBrl) / 0.912) / 100);
      assert.ok(off.importBrl > base.importBrl);
      assert.equal(off.creditPisCofinsBrl, base.creditPisCofinsBrl);
      assert.equal(off.creditIcmsBrl, off.icmsBrl);
      assert.equal(off.nonRecoverableBrl, toCents(off.iiBrl + off.cofinsAddBrl) / 100);
      assert.equal(off.netBrl, toCents(620000 + off.iiBrl + off.cofinsAddBrl) / 100);
    }
    const tec = brazilCost(100000, { exTarifario: false });
    assert.equal(tec.iiBrl, 78120);
    assert.equal(tec.icmsBaseBrl, 849440.79);
    assert.equal(tec.importBrl, 229440.79);
    // A alíquota do II fica guardada, mas só vale sem Ex-Tarifário.
    assert.equal(brazilCost(100000, { exTarifario: true, iiRatePct: 20 }).iiBrl, 0);
  });

  it('liga e desliga o Convênio ICMS 52/91', () => {
    const base = brazilCost(100000, {});
    const full = brazilCost(100000, { icmsRatePct: 18 });
    assert.equal(full.convenioIcms5291, false);
    assert.equal(full.icmsBaseBrl, toCents(696570 / 0.82) / 100);
    assert.ok(full.icmsBrl > base.icmsBrl);
    assert.ok(full.importBrl > base.importBrl);
    assert.equal(full.nonRecoverableBrl, 3720);
    const both = brazilCost(100000, { exTarifario: false, icmsRatePct: 18 });
    assert.equal(both.icmsBaseBrl, 944743.9);
    assert.equal(both.importBrl, 324743.9);
    assert.equal(both.nonRecoverableBrl, 78120 + 3720);
    assert.equal(sanitize({ convenioIcms5291: false }).icmsRatePct, 18);
    assert.equal(sanitize({ convenioIcms5291: true }).icmsRatePct, 8.8);
    assert.equal(sanitize({ icmsRatePct: 8.8, convenioIcms5291: false }).convenioIcms5291, true);
    assert.equal(sanitize({ icmsRatePct: 12 }).convenioIcms5291, false);
    assert.equal(sanitize({ icmsRatePct: 99 }).icmsRatePct, 40);
  });

  it('atualiza créditos e líquido com cada chave de crédito', () => {
    const noPisCofins = brazilCost(100000, { creditPisCofins: false });
    assert.equal(noPisCofins.creditPisCofinsBrl, 0);
    assert.equal(noPisCofins.creditBrl, 67212.89);
    assert.equal(noPisCofins.netBrl, 763782.89 - 67212.89);
    assert.equal(noPisCofins.nonRecoverableBrl, 13020 + 63550);
    const noIcms = brazilCost(100000, { creditIcms: false });
    assert.equal(noIcms.creditIcmsBrl, 0);
    assert.equal(noIcms.creditBrl, 72850);
    assert.equal(noIcms.netBrl, toCents(763782.89 - 72850) / 100);
    const half = brazilCost(100000, { icmsCreditFactorPct: 50 });
    assert.equal(half.creditIcmsBrl, toCents(67212.89 * 0.5) / 100);
    assert.equal(half.creditBrl, toCents(72850 + half.creditIcmsBrl) / 100);
    assert.equal(half.netBrl, toCents(763782.89 - half.creditBrl) / 100);
    const none = brazilCost(100000, { creditPisCofins: false, creditIcms: false });
    assert.equal(none.creditBrl, 0);
    assert.equal(none.netBrl, none.landedBrl);
    assert.equal(none.nonRecoverableBrl, none.importBrl);
    const customs = brazilCost(100000, { customsExpensesPct: 2.5 });
    assert.equal(customs.customsExpensesBrl, 15500);
    assert.equal(customs.icmsNumeratorBrl, 696570 + 15500);
    assert.equal(customs.nonRecoverableBrl, 3720 + 15500);
    assert.equal(brazilCost(129000, { fxRate: 5.5 }).vaBrl, 709500);
  });

  it('monta a tabela de referência dos tributos', () => {
    const b = brazilCost(100000, {});
    assert.deepEqual(b.taxLines, ncmTaxReference(b));
    assert.deepEqual(b.taxLines.map((line) => line.key), ['ii', 'ipi', 'pis', 'cofins', 'cofinsAdd', 'icms']);
    assert.deepEqual(b.taxLines.map((line) => line.creditable), [false, false, true, true, false, true]);
    assert.deepEqual(b.taxLines.map((line) => line.amountBrl), [0, 0, 13020, 59830, 3720, 67212.89]);
    assert.equal(toCents(b.taxLines.reduce((sum, line) => sum + line.amountBrl, 0)), toCents(b.importBrl));
    assert.equal(toCents(b.taxLines.reduce((sum, line) => sum + line.creditBrl, 0)), toCents(b.creditBrl));
    assert.equal(toCents(b.taxLines.reduce((sum, line) => sum + line.netCostBrl, 0)), toCents(b.nonRecoverableBrl));
    assert.match(b.taxLines[4].creditRule, /art\. 15, § 1º-A/);
    assert.match(b.taxLines[5].legalBasis, /Convênio ICMS 52\/91/);
    assert.equal(b.taxLines[5].rateLabel, '8,8%');
    const off = brazilCost(100000, { exTarifario: false, creditIcms: false, customsExpensesPct: 2.5 });
    assert.equal(off.taxLines[0].amountBrl, 78120);
    assert.equal(off.taxLines[0].netCostBrl, 78120);
    assert.equal(off.taxLines.find((line) => line.key === 'icms').creditable, false);
    assert.ok(off.taxLines.some((line) => line.key === 'customs'));
    assert.equal(toCents(off.taxLines.reduce((sum, line) => sum + line.amountBrl, 0)), toCents(off.importBrl));
  });

  it('leva o custo Brasil para o resultado e para a memória de cálculo', () => {
    const result = evaluate({ exTarifario: false, servicesEur: 21000 });
    const expected = brazilCost(129000, { exTarifario: false });
    assert.equal(result.brazil.vaBrl, 799800);
    assert.equal(result.brazil.netBrl, expected.netBrl);
    assert.equal(result.totalNetBrl, expected.netBrl);
    assert.equal(result.totalGrossBrl, expected.landedBrl);
    assert.equal(result.brl.tablePrice, 108000 * 6.2);
    close(result.brlPerPack, expected.netBrl / 20500, 9);
    const text = explain(result).map((block) => `${block.title}\n${block.lines.join('\n')}`).join('\n');
    assert.deepEqual(
      explain(result).map((block) => block.title),
      ['Modelo e dimensões', 'Preço do robô (tabela)', 'Opcionais e serviços (separados)', 'Desconto por volume', 'Custo Brasil (NCM 8479.89.99) e Preço Total', 'Espaço da loja'],
    );
    for (const pattern of [/Valor Aduaneiro \(VA\)/, /Ex-Tarifário desligado/, /por dentro/, /0,6%/, /art\. 15, § 1º-A/, /Investimento Líquido Pós-Créditos/, /Robô base/, /nota de crédito/, /Subtotal de opcionais/, /média padrão €\s22\.500/, /Serviços locais/, /0% de 1 a 9, 2% de 10 a 24/, /Filtro da sala desligado/]) {
      assert.match(text, pattern);
    }
    assert.match(explain(evaluate({})).map((block) => block.lines.join('\n')).join('\n'), /Ex-Tarifário ligado: II = 0%/);
    assert.equal(parseBr('6.20', { decimalDot: true }), 6.2);
    assert.equal(parseBr('6,20'), 6.2);
    assert.equal(parseBr('129.000'), 129000);
    assert.equal(parseBr('€ 14.000'), 14000);
  });
});

describe('Preço Total e faixas de desconto por volume', () => {
  it('soma a parte importada com desconto e os serviços locais em R$', () => {
    const result = evaluate({ fleetRobots: 25, localServicesBrl: 50000 });
    const { quote, brazil } = result;
    assert.equal(quote.orderEur, 130500);
    assert.equal(quote.discountEur, 5220);
    assert.equal(quote.netOrderEur, 125280);
    assert.equal(result.brazilGrossOrder.grossBrl, 809100);
    assert.equal(brazil.grossBrl, 776736);
    assert.equal(brazil.vaBrl, 776736);
    assert.deepEqual(brazil, brazilCost(125280, {}));
    assert.equal(result.totalGrossBrl, toCents(brazil.landedBrl + 50000) / 100);
    assert.equal(result.totalNetBrl, toCents(brazil.netBrl + 50000) / 100);
    // Com tudo creditado, o líquido é o VA + o adicional de 0,60% da COFINS.
    assert.equal(brazil.netBrl, toCents(776736 + brazil.cofinsAddBrl) / 100);
    assert.equal(result.totalEurApprox, toCents(result.totalGrossBrl / 6.2) / 100);
    assert.equal(result.brl.options, 0);
    assert.equal(result.brl.services, 22500 * 6.2);
    assert.equal(result.brl.order, 809100);
    assert.equal(result.brl.discount, 5220 * 6.2);
    assert.equal(result.brl.netOrder, 776736);
    assert.equal(result.brl.localServices, 50000);
    assert.equal(result.brl.totalGross, result.totalGrossBrl);
    assert.equal(result.brl.totalNet, result.totalNetBrl);
    close(result.brlPerPack, result.totalNetBrl / 20500, 9);
    assert.equal(result.rollout, undefined);

    const landed = evaluate({ exTarifario: false, icmsRatePct: 18, localServicesBrl: 10000 });
    const expected = brazilCost(130500, { exTarifario: false, icmsRatePct: 18 });
    assert.equal(landed.brazil.landedBrl, expected.landedBrl);
    assert.equal(landed.totalGrossBrl, toCents(expected.landedBrl + 10000) / 100);
    assert.equal(landed.totalNetBrl, toCents(expected.netBrl + 10000) / 100);
    assert.equal(landed.convenioIcms5291, false);
  });

  it('monta as 5 faixas com preço unitário, total no Brasil e notas de crédito retroativas', () => {
    const table = volumeTiersTable(130500, { fxRate: 6.2, localServicesBrl: 50000, fleetRobots: 30 });
    assert.deepEqual(
      table.tiers.map((tier) => [tier.from, tier.to, tier.rangeLabel, tier.pct, tier.active]),
      [
        [1, 9, '1 a 9 robôs', 0, false],
        [10, 24, '10 a 24 robôs', 2, false],
        [25, 49, '25 a 49 robôs', 4, true],
        [50, 99, '50 a 99 robôs', 6, false],
        [100, null, '100+ robôs', 8, false],
      ],
    );
    assert.deepEqual(table.tiers.map((tier) => tier.unitDiscountEur), [0, 2610, 5220, 7830, 10440]);
    assert.deepEqual(table.tiers.map((tier) => tier.unitNetEur), [130500, 127890, 125280, 122670, 120060]);
    assert.deepEqual(table.tiers.map((tier) => tier.creditNoteEur), [0, 26100, 65250, 130500, 261000]);
    assert.deepEqual(table.tiers.map((tier) => tier.bonusToDateEur), [0, 26100, 130500, 391500, 1044000]);
    for (const tier of table.tiers) {
      assert.equal(tier.unitGrossEur, 130500);
      assert.equal(tier.unitNetBrl, toCents(tier.unitNetEur * 6.2) / 100);
      assert.equal(tier.unitDiscountBrl, toCents(tier.unitDiscountEur * 6.2) / 100);
      assert.equal(tier.unitLandedBrl, brazilCost(tier.unitNetEur, { fxRate: 6.2 }).landedBrl);
      assert.ok(tier.unitLandedBrl > tier.unitNetBrl);
      assert.equal(tier.unitTotalGrossBrl, toCents(tier.unitLandedBrl + 50000) / 100);
      assert.equal(tier.unitTotalNetBrl, toCents(brazilCost(tier.unitNetEur, { fxRate: 6.2 }).netBrl + 50000) / 100);
      assert.equal(tier.creditNoteBrl, toCents(tier.creditNoteEur * 6.2) / 100);
    }
    assert.equal(table.count, 30);
    assert.equal(table.pct, 4);
    assert.equal(table.next.from, 50);
    assert.equal(table.unitNetEur, 125280);
    assert.equal(table.fleetGrossEur, 130500 * 30);
    assert.equal(table.fleetDiscountEur, 5220 * 30);
    assert.equal(table.fleetNetEur, 125280 * 30);
    assert.equal(table.fleetTotalGrossBrl, toCents(table.unitTotalGrossBrl * 30) / 100);
    assert.equal(table.fleetTotalNetBrl, toCents(table.unitTotalNetBrl * 30) / 100);
    assert.equal(volumeTiersTable(130500, { fleetRobots: 150 }).next, null);
    // Com € 100.000 por robô as notas repetem o slide 12.
    assert.deepEqual(volumeTiersTable(100000, {}).tiers.map((tier) => tier.bonusToDateEur), [0, 20000, 100000, 300000, 800000]);
  });

  it('leva a tabela de faixas para o resultado', () => {
    const result = evaluate({ fleetRobots: 100, secondGripper: true });
    assert.equal(result.volume.pct, 8);
    assert.equal(result.volume.unitGrossEur, result.quote.orderEur);
    assert.equal(result.volume.unitNetEur, result.quote.netOrderEur);
    assert.equal(result.volume.unitTotalGrossBrl, result.totalGrossBrl);
    assert.equal(result.volume.unitTotalNetBrl, result.totalNetBrl);
    assert.equal(result.volume.tiers.filter((tier) => tier.active).length, 1);
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
    assert.match(page, /<h1[^>]*>Modelos Gollmann<\/h1>/);
    assert.match(page, /286 configurações do GO\.compact/);
    assert.ok(page.indexOf('id="viewer-card"') < page.indexOf('id="hero-kpis"'));
    assert.match(page, /id="toggle-params"/);
    assert.match(page, /id="workspace"/);
    assert.match(page, /id="params"/);
    assert.match(app, /gcalc\.modelos\.interno\.params/);
    assert.match(app, /params-collapsed/);
    assert.match(app, /params-drawer/);
    assert.match(css, /\.workspace\.params-collapsed/);
    assert.match(css, /\.params \{[^}]*position: sticky;/);
    assert.match(page, /Imprimir em A4/);
    assert.match(page, /Restaurar premissas/);
    for (const label of ['Ex. 1 · Robô S', 'Ex. 2 · Robô L (Padrão)', 'Ex. 3 · Robô XXL', 'Ex. 4 · Robô 4XL', 'Isométrica', 'Frontal', 'Corte / Interna', 'Planta (Topo)', 'Vista Interna / Raios-X']) {
      assert.ok(page.includes(label), label);
    }
    assert.match(page, /class="dock/);
    assert.match(page, /<canvas id="viewer"/);
    for (const color of ['#009bb4', '#8ab81a', '#b5124b', '#23272b']) assert.ok(app.includes(color), color);
    assert.match(app, /gcalc\.modelos\.interno\.v3/);
    assert.doesNotMatch(app, /gcalc\.modelos\.interno\.v2/);
    assert.match(app, /Filtrar por medidas da sala/);
    assert.doesNotMatch(app, /Inflação alemã VPI/);
    assert.doesNotMatch(page, /rollout-years/);
    assert.match(app, /1,70 m/);
    assert.match(css, /@media print/);
  });

  it('abre as premissas num modal e separa preço, opcionais, serviços e serviços locais', () => {
    assert.match(page, /<dialog id="premissas-modal" class="modal" aria-labelledby="premissas-title">/);
    assert.match(page, /<button type="button" id="open-premissas" aria-haspopup="dialog" aria-controls="premissas-modal"[^>]*>Premissas<\/button>/);
    assert.match(page, /id="close-premissas"/);
    const dialog = page.slice(page.indexOf('<dialog'), page.indexOf('</dialog>'));
    assert.match(dialog, /id="fontes"/);
    assert.match(dialog, /média de € 22\.500/);
    assert.match(dialog, /Serviços locais \(R\$\)/);
    assert.match(dialog, /0% de 1 a 9 robôs, 2% de 10 a 24, 4% de 25 a 49, 6% de 50 a 99 e 8% a partir de 100 robôs/);
    const main = page.slice(page.indexOf('<main'), page.indexOf('</main>'));
    assert.doesNotMatch(main, /id="fontes"/);
    for (const id of ['dock-price', 'dock-order', 'dock-net', 'dock-bonus']) assert.match(page, new RegExp(`id="${id}"`), id);
    assert.match(page, /Preço Total \(R\$\)/);
    for (const text of ["'open-premissas'", "'close-premissas'", "'premissas-modal'", "key: 'servicesEur'", "key: 'localServicesBrl'", "key: 'fleetRobots'", "value: 'class'", "'1. Preço Total (1 Robô)'", "'2. Opcionais (Separado)'", "'2. Transporte e Instalação'", "'3. Serviços Locais (Brasil)'"]) {
      assert.ok(app.includes(text), text);
    }
    assert.doesNotMatch(app, /key: 'includeServices'/);
    assert.match(css, /dialog\.modal/);
    assert.match(css, /\.modal::backdrop/);
    assert.match(css, /\.kpis-hero \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
    assert.match(css, /#rollout-milestones tbody tr \{ cursor: pointer; \}/);
  });

  it('tem o botão do Ex-Tarifário, os créditos e a tabela da NCM 8479.89.99', () => {
    for (const id of ['ex-tarifario-bar', 'toggle-ex-tarifario', 'toggle-convenio-icms', 'ex-tarifario-summary', 'ncm-tax-table', 'price-table']) {
      assert.match(page, new RegExp(`id="${id}"`), id);
    }
    assert.match(page, /<button type="button" id="toggle-ex-tarifario"[^>]*aria-pressed="true"/);
    assert.ok(page.includes('NCM 8479.89.99 · Bem de Capital (BK)'));
    assert.ok(page.includes('Composição do preço, impostos da NCM 8479.89.99 e créditos recuperáveis'));
    for (const text of ['toggle-ex-tarifario', 'toggle-convenio-icms', 'ncm-tax-table', '8479.89.99', "key: 'exTarifario'", "key: 'iiRatePct'", "key: 'icmsRatePct'", "key: 'customsExpensesPct'", "key: 'creditPisCofins'", "key: 'creditIcms'", "key: 'icmsCreditFactorPct'", "lockedByNot: 'exTarifario'", 'state.exTarifario = !state.exTarifario', 'state.convenioIcms5291 = !state.convenioIcms5291', 'Ex-Tarifário: LIGADO (II = 0%)', 'Ex-Tarifário: DESLIGADO', 'Sim · Creditável', 'Não · Custo definitivo', "'4. Câmbio, Importação (NCM 8479.89.99) e Créditos'"]) {
      assert.ok(app.includes(text), text);
    }
    assert.doesNotMatch(app, /key: 'importCostPct'|key: 'taxCreditPct'/);
    assert.match(css, /\.fiscal-toggle\.is-on/);
    assert.match(css, /\.tax-pill\.is-yes/);
  });

  it('traduz a interface com PT | EN sem mudar a conta', () => {
    assert.match(page, /id="lang-pt"/);
    assert.match(page, /id="lang-en"/);
    assert.match(page, /data-i18n="title"/);
    assert.match(page, /data-i18n="premissas.lede"/);
    assert.match(app, /gcalc\.modelos\.interno\.lang/);
    assert.match(app, /documentElement\.lang/);
    assert.match(app, /en-US/);
    assert.match(app, /from '\.\/i18n\.js'/);
    assert.match(readFileSync(join(root, dir, 'i18n.js'), 'utf8'), /Gollmann models/);
    assert.match(formatBRL(1234.5), /1\.234,50/);
    assert.match(formatBRL(1234.5, 'en-US'), /R\$/);
    assert.match(formatBRL(1234.5, 'en-US'), /1,234\.50/);
    assert.match(formatEUR(22500), /22\.500/);
    assert.match(formatEUR(22500, 'en-US'), /€/);
    assert.match(formatEUR(22500, 'en-US'), /22,500/);
    const pt = explain(evaluate({})).map((block) => block.lines.join('\n')).join('\n');
    const en = explain(evaluate({}), 'en-US').map((block) => `${block.title}\n${block.lines.join('\n')}`).join('\n');
    assert.match(pt, /Filtro da sala desligado/);
    assert.match(en, /Ex-Tarifário/);
    assert.match(en, /NCM 8479\.89\.99/);
    assert.match(en, /Convênio ICMS 52\/91/);
    assert.match(en, /PIS/);
    assert.match(en, /COFINS/);
    assert.match(en, /CIAP/);
    assert.doesNotMatch(en, /Filtro da sala desligado/);
    assert.equal(evaluate({}).totalGrossBrl, evaluate({ fxRate: 6.2 }).totalGrossBrl);
  });

  it('escolhe GO.compact ou GO.direct sem mudar o preço da classe', () => {
    assert.equal(DEFAULTS.modelLine, 'compact');
    assert.equal(sanitize({ modelLine: 'direct' }).modelLine, 'direct');
    assert.equal(sanitize({ modelLine: 'nope' }).modelLine, 'compact');
    assert.deepEqual(
      WIDTHS.map((width) => [width.sam, physicalWidthM(width.sam, 'compact'), physicalWidthM(width.sam, 'direct')]),
      [
        [1.89, 1.69, 2.2],
        [2.4, 2.2, 2.6],
        [2.8, 2.6, 3],
        [3.2, 3, 3.4],
        [3.75, 3.55, 3.95],
        [4.15, 3.95, 4.35],
        [4.55, 4.35, 4.75],
      ],
    );
    const compact = evaluate({});
    const direct = evaluate({ modelLine: 'direct' });
    assert.equal(direct.totalGrossBrl, compact.totalGrossBrl);
    assert.equal(direct.quote.tablePriceEur, compact.quote.tablePriceEur);
    assert.equal(direct.quote.netOrderEur, compact.quote.netOrderEur);
    assert.equal(compact.quote.footprintM2, 12.8);
    assert.equal(direct.quote.footprintM2, 12.8);
    assert.equal(direct.quote.volumeM3, 37.76);
    assert.equal(physicalWidthM(3.2, 'compact'), 3);
    assert.equal(physicalWidthM(2.8, 'direct'), 3);
    assert.equal(Math.round(physicalWidthM(3.2, 'direct') * direct.quote.totalLengthM * 10000) / 10000, 13.6);
    const narrow = explain(evaluate({ widthSam: 2.8, classId: 'S', modelLine: 'direct' }))
      .map((block) => block.lines.join('\n'))
      .join('\n');
    assert.match(narrow, /Linha selecionada: GO\.direct/);
    assert.match(narrow, /Classe|classe 2,80 m|da classe 2,80 m/);
    assert.match(narrow, /3,00 m/);
    assert.match(narrow, /O preço permanece o da classe/);
    const en = explain(evaluate({ modelLine: 'direct' }), 'en-US')
      .map((block) => block.lines.join('\n'))
      .join('\n');
    assert.match(en, /Selected line: GO\.direct/);
    assert.match(en, /physical width 3\.40 m/);
    assert.match(page, /id="model-class-line"/);
    assert.match(page, /Classe 2,80 m · GO\.direct 3,00 m/);
    assert.match(app, /key: 'modelLine'/);
    assert.match(app, /gcalc\.modelos\.interno\.v3/);
    assert.match(calc, /modelLine: 'compact'/);
    assert.match(readFileSync(join(root, dir, 'i18n.js'), 'utf8'), /field\.modelLine\.label/);
    assert.match(readFileSync(join(root, dir, 'i18n.js'), 'utf8'), /Class \{cls\}/);
  });

  it('desenha estantes transversais, guia verde longitudinal e refrigerado no fundo', () => {
    assert.match(app, /const shelfX0 = x0 \+ 0\.08;/);
    assert.match(app, /const shelfX1 = x1 - 0\.34;/);
    assert.match(app, /front: \{ lines: rowLines\(r0\)/);
    assert.match(app, /back: \{ lines: rowLines\(r1\)/);
    assert.match(app, /const gap = 0\.045;/);
    assert.match(app, /const rowDepth = 0\.32;/);
    assert.match(app, /const aisleW = 0\.62;/);
    assert.match(app, /const RACK_LETTERS = 'BCDEFGHIJKLMNOPQRSTUVWXYZ';/);
    assert.match(app, /const CYCLE = 8\.6;/);
    assert.match(app, /const gripperCycle = \(phase, zone0, zone1\)/);
    assert.match(app, /feixe de laser/);
    assert.match(app, /esteira preta/);
    assert.match(app, /esteira porta-cabos/i);
    assert.match(app, /fill: '#e2312d'/);
    assert.match(app, /phase: CYCLE \/ 2/);
    assert.match(app, /left: \{ lines: levels\(shelfX0\)/);
    assert.match(app, /right: \{ lines: levels\(shelfX1\)/);
    assert.doesNotMatch(app, /\[P\(x, rackTop, r0\), P\(x, rackTop, r1\)\]/);
    assert.match(app, /box\(x1 - 0\.22, x1 - 0\.06, railY0, railY1, 0\.1, L - 0\.08/);
    assert.match(app, /fill: '#3f8f3a'/);
    assert.match(app, /const dCool0 = Math\.max\(dStart \+ 0\.6, L - 0\.92\);/);
    assert.match(app, /rack\(dCool0, dCool0 \+ coolDepth, COLORS\.cool/);
    assert.match(app, /rack\(dCool1 - coolDepth, dCool1, COLORS\.cool/);
    assert.match(app, /box\(Math\.min\(headX1, carX0\), Math\.max\(headX1, carX0\), gy - 0\.03, gy \+ 0\.02/);
    assert.doesNotMatch(app, /const hd = 0\.25;/);
    assert.doesNotMatch(app, /aisles = \(hasExt \? \[0\.25, 0\.75\] : \[0\.5\]\)/);
    assert.doesNotMatch(app, /box\(x0 \+ 0\.08, x1 - 0\.08, top - 0\.08, top/);
    assert.match(app, /project\(P\(-d\.Wc \/ 2 \+ 0\.25, d\.H - fh \/ 2, d\.L - 0\.35\)\)/);
    assert.match(app, /if \(cam\.pitch > 1\.05\) dimension\(P\(d\.Wc \/ 2 \+ 0\.48, 0, 0\), P\(d\.Wc \/ 2 \+ 0\.48, 0, d\.L\), model\.labels\.L/);
    assert.match(app, /else dimension\(P\(xs - 0\.55, 0, 0\), P\(xs - 0\.55, 0, d\.L\), model\.labels\.L/);
    assert.match(app, /project\(P\(xs - 0\.55, 0, dims\.L \/ 2\)\)/);
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
