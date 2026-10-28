import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import {
  DISCLAIMER,
  avoidedLoss,
  breakEvenPct,
  cleaningHours,
  deviationEffect,
  evaluate,
  EXAMPLE_FIELDS,
  exampleInput,
  manualHours,
  paperCash,
  paperEnvironment,
  parseBr,
  paybackMonths,
  percentPoints,
  rampMonths,
  reviewHours,
  roiRatio,
  workingCapital,
  yearGain,
} from '../../public/interno/roi-mes/calc.js';

const root = join(import.meta.dirname, '../..');

function close(actual, expected, digits = 2) {
  const factor = 10 ** digits;
  assert.equal(Math.round(actual * factor) / factor, Math.round(expected * factor) / factor);
}

describe('fórmulas do ROI MES/EBR', () => {
  it('lê números em português e percentuais de 0 a 100', () => {
    assert.equal(parseBr('1.200'), 1200);
    assert.equal(parseBr('1.200,5'), 1200.5);
    assert.equal(parseBr('R$ 250.000'), 250000);
    assert.equal(parseBr(''), null);
    assert.equal(percentPoints('75'), 0.75);
    assert.equal(percentPoints(''), null);
  });

  it('calcula a revisão por exceção e o capital de giro', () => {
    const review = reviewHours(1000, 1.5, 1.5, 0.8, 0.25, 1);
    assert.equal(review.hHoje, 3);
    close(review.hFuturo, 0.4, 6);
    assert.equal(review.horas, 2600);
    assert.equal(review.horasProducao, 1300);
    assert.equal(review.horasQualidade, 1300);
    close(workingCapital(80000, 1000, 4, 0.15), 80000 * 1000 * 4 / 365 * 0.15);
  });

  it('calcula lançamento manual, desvios, perdas, limpeza e papel', () => {
    assert.equal(manualHours(120, 30, 1000), 1000);
    assert.deepEqual(deviationEffect(8, 6, 0.75), { desviosAno: 96, horas: 432 });
    assert.equal(avoidedLoss(3, 250000, 0.4), 300000);
    assert.equal(breakEvenPct(730000, 3, 250000), 730000 / 750000);
    assert.equal(breakEvenPct(100, 0, 250000), null);
    assert.equal(cleaningHours(40, 25), 200);
    assert.equal(paperCash(80, 0.2, 1000, 12000), 28000);
    assert.equal(paperEnvironment(80, 1000, 0.004), 320);
  });

  it('muda só a rampa entre planta dedicada e key users', () => {
    assert.deepEqual(rampMonths('dedicado', [0, 0.5, 1]), [0, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    assert.deepEqual(rampMonths('base', [0, 0.5, 1]), [0, 0, 0.5, 0.5, 1, 1, 1, 1, 1, 1, 1, 1]);
    const months = rampMonths('dedicado', [0, 0.5, 1]);
    assert.equal(yearGain(1, 1200, months), 1050);
    assert.equal(yearGain(2, 1200, months), 1200);
  });

  it('separa caixa e horas e tira B7, B8 e o ambiente do payback', () => {
    const sample = {
      scope: 'completo',
      lotesAno: 1000,
      b1HorasProd: 1.5,
      b1HorasQual: 1.5,
      b1PctSemDesvio: 0.8,
      b1TempoSem: 0.25,
      b1TempoCom: 1,
      b1ValorLote: 80000,
      b1Dias: 4,
      b1CustoCapital: 0.15,
      b2Campos: 120,
      b2Segundos: 30,
      b3DesviosMes: 8,
      b3Horas: 6,
      b3Pct: { conservador: 0.5, provavel: 0.75, otimista: 0.9 },
      b4Lotes: 3,
      b4Valor: 250000,
      b4Pct: 0.4,
      b5LimpezasMes: 40,
      b5Minutos: 25,
      b5Ocorrencias: 6,
      b5Custo: 8000,
      b6Paginas: 80,
      b6CustoPagina: 0.2,
      b6Arquivo: 12000,
      b6Co2: 0.004,
      b7Nota: 'inspeção por amostragem',
      b8Nota: 'crescer um turno',
      custoHoraProd: 95,
      custoHoraQual: 150,
      horasFte: 1760,
      incluirHoras: true,
      licenca: 180000,
      implantacao: 400000,
      validacao: 150000,
      curva: [0, 0.5, 1],
      modo: 'dedicado',
      taxa: 0.12,
    };
    const result = evaluate(sample);
    const provavel = result.scenarios.provavel;
    assert.equal(provavel.blocks.b2.horas, 1000);
    assert.equal(provavel.blocks.b3.horas, 432);
    assert.equal(provavel.blocks.b4.caixa, 300000);
    assert.equal(provavel.blocks.b6.caixa, 28000);
    assert.equal(result.ambiente, 320);
    assert.equal(provavel.caixa, result.capitalGiro + 300000 + 48000 + 28000);
    assert.ok(Math.abs(provavel.caixa - provavel.reaisHoras) > 1);
    assert.equal(provavel.base, provavel.caixa + provavel.reaisHoras);
    assert.equal(result.scenarios.conservador.blocks.b3.horas, 96 * 0.5 * 6);
    assert.equal(result.scenarios.otimista.blocks.b3.horas, 96 * 0.9 * 6);
    assert.equal(result.scenarios.conservador.blocks.b4.caixa, provavel.blocks.b4.caixa);
    assert.equal(result.scenarios.otimista.blocks.b6.caixa, provavel.blocks.b6.caixa);
    assert.equal(result.breakEven, 730000 / 750000);
    assert.equal(provavel.fteProducao, provavel.horasProducao / 1760);

    const semHoras = evaluate({ ...sample, incluirHoras: false });
    assert.equal(semHoras.scenarios.provavel.base, provavel.caixa);
    assert.equal(semHoras.scenarios.provavel.blocks.b2.total, 0);
    assert.equal(semHoras.scenarios.provavel.blocks.b3.total, 0);
    assert.equal(semHoras.scenarios.provavel.blocks.b4.total, 300000);

    const pesagem = evaluate({ ...sample, scope: 'pesagem' });
    assert.equal(pesagem.scenarios.provavel.blocks.b1.total, 0);
    assert.equal(pesagem.scenarios.provavel.blocks.b4.total, 0);
    assert.equal(pesagem.scenarios.provavel.blocks.b5.total, 0);
    assert.equal(pesagem.breakEven, null);
    assert.equal(pesagem.scenarios.provavel.blocks.b2.horas, 1000);
    assert.equal(pesagem.scenarios.provavel.blocks.b6.caixa, 28000);
    assert.equal(pesagem.ambiente, 320);

    const vazio = evaluate({ scope: 'completo', b3Pct: { conservador: null, provavel: null, otimista: null } });
    assert.equal(vazio.scenarios.provavel.base, 0);
    assert.equal(vazio.scenarios.provavel.blocks.b3.pct, 0);
    assert.equal(vazio.curve.assumed, true);
    assert.deepEqual(vazio.months.slice(0, 3), [0, 0.5, 1]);
  });

  it('recupera o investimento com a curva dos três primeiros meses', () => {
    const months = rampMonths('dedicado', [0, 0.5, 1]);
    assert.equal(paybackMonths(1000, 0, 1200, months), 12);
    assert.equal(roiRatio(1, 1200, months, 1000, 0), (1050 - 1000) / 1000);
    const result = evaluate({
      lotesAno: 10,
      b4Lotes: 2,
      b4Valor: 1000,
      b4Pct: 1,
      b6Paginas: 0,
      incluirHoras: false,
      implantacao: 1000,
      curva: [1, 1, 1],
      taxa: 0,
    });
    assert.equal(result.scenarios.provavel.caixa, 2000);
    assert.equal(result.scenarios.provavel.paybackMeses, 6);
    assert.equal(result.scenarios.provavel.roi5, (2000 * 5 - 1000) / 1000);
  });

  it('o exemplo fictício da primeira visita preenche a planta e fecha o payback', () => {
    for (const value of Object.values(EXAMPLE_FIELDS)) assert.notEqual(String(value).trim(), '');
    const result = evaluate(exampleInput());
    const provavel = result.scenarios.provavel;
    assert.equal(result.lotes, 1000);
    assert.equal(result.money.total, 550000);
    assert.equal(result.money.licenca, 180000);
    assert.equal(provavel.paybackMeses, 10);
    assert.equal(provavel.caixa, 507506.85);
    assert.equal(provavel.horasProducao + provavel.horasQualidade, 4232);
    assert.equal(provavel.reaisHoras, 497300);
    assert.equal(result.scope, 'completo');
    const weighing = evaluate({ ...exampleInput(), scope: 'pesagem' });
    assert.equal(weighing.scenarios.provavel.blocks.b2.horas, 1000);
    assert.equal(weighing.scenarios.provavel.blocks.b6.caixa, 28000);
    assert.equal(weighing.scenarios.provavel.blocks.b1.total, 0);
  });
});

describe('página interna do ROI MES', () => {
  const dir = 'public/interno/roi-mes';
  const page = readFileSync(join(root, dir, 'index.html'), 'utf8');
  const app = readFileSync(join(root, dir, 'app.js'), 'utf8');
  const calc = readFileSync(join(root, dir, 'calc.js'), 'utf8');
  const css = readFileSync(join(root, dir, 'styles.css'), 'utf8');

  it('é noindex, relativa e não cita o robô nem outras calculadoras', () => {
    assert.match(page, /<meta name="robots" content="noindex,nofollow"\s*\/?>/);
    assert.match(page, /href="\.\/styles\.css"/);
    assert.match(page, /src="\.\/app\.js"/);
    assert.match(page, /src="\.\/t2-logo\.png"/);
    assert.match(app, /from '\.\/calc\.js'/);
    assert.match(page, /registro de lote eletrônico \(EBR\)/);
    assert.match(page, /aprovação do lote/);
    assert.match(page, /controle de mudanças/);
    assert.match(page, /entrada em operação/);
    assert.match(page, /Logbook/);
    assert.match(page, /POP/);
    assert.match(page, /Só pesagem/);
    assert.match(page, /MES\/EBR completo/);
    assert.match(page, /Lotes por ano/);
    assert.match(page, /Incluir horas economizadas no payback/);
    assert.match(page, /Dados de exemplo fictícios — substitua pelos dados da sua planta/);
    assert.match(page, /Limpar dados/);
    assert.match(page, /Restaurar exemplo/);
    assert.match(app, /EXAMPLE_FIELDS/);
    assert.match(app, /if \(!raw\)/);
    assert.equal(page.includes(DISCLAIMER), true);
    assert.match(page, /[Rr]eferência relatada no painel/);
    assert.match(page, /1h30/);
    assert.match(page, /3\.000 campos/);
    assert.match(page, /365\.574 páginas/);
    assert.match(app, /gcalc\.roi-mes\.v1/);
    assert.match(css, /#09070D/);
    assert.match(css, /#A855F7/);
    assert.match(css, /Sora/);
    assert.match(css, /Manrope/);
    assert.match(css, /IBM Plex Mono/);
    assert.match(css, /@media print/);
    for (const text of [page, app, calc, css]) {
      assert.equal(text.includes('gcalc.t2software.co'), false);
      assert.equal(text.includes('interno/modelos'), false);
      assert.equal(text.includes('interno/locacao'), false);
      assert.equal(text.includes('interno/manutencao'), false);
      assert.doesNotMatch(text, /go-live|go live|warning letter|garante conformidade|evita warning/i);
      assert.doesNotMatch(text, /href="\/|src="\/|href="\.\.\//);
    }
  });

  it('não é referenciada pelas calculadoras existentes', () => {
    const untouched = [
      'index.html',
      'headtohead/index.html',
      'calculos/index.html',
      'rh/index.html',
      'rh/calculos/index.html',
      'public/interno/modelos/index.html',
      'public/interno/modelos/app.js',
      'public/interno/modelos/calc.js',
      'public/interno/manutencao/index.html',
      'public/interno/locacao/index.html',
      'src/model/sitePaths.ts',
      'src/components/PageNav.tsx',
    ];
    for (const file of untouched) {
      const text = readFileSync(join(root, file), 'utf8');
      assert.equal(text.includes('roi-mes'), false, file);
    }
  });
});
