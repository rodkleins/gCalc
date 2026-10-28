import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import {
  DISCLAIMER,
  avoidedLoss,
  breakEvenPct,
  cleaningHours,
  deviationHours,
  evaluate,
  fillErrorHours,
  weighingHours,
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

  it('calcula preenchimento, pesagem, erros, desvios, perdas, limpeza e papel', () => {
    assert.equal(manualHours(180, 25, 1000), 1250);
    assert.equal(weighingHours(1000, 6, 8, true), 1600);
    assert.equal(weighingHours(1000, 6, 8, false), 800);
    assert.deepEqual(fillErrorHours(1000, 0.12, 0.5, 0.75), { erros: 120, horas: 45 });
    assert.deepEqual(deviationHours(96, 6, 0.75), { desviosAno: 96, horas: 432 });
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

  it('separa caixa e horas e deixa inspeção, quadro e CO₂ fora do payback', () => {
    const sample = exampleInput();
    const result = evaluate(sample);
    const provavel = result.scenarios.provavel;
    assert.equal(provavel.blocks.preenchimento.horas, 1250);
    assert.equal(provavel.blocks.pesagem.horas, 1600);
    assert.equal(provavel.blocks.revisao.horas, 2600);
    assert.equal(provavel.blocks.erros.horas, 45);
    assert.equal(provavel.blocks.desvios.horas, 432);
    assert.equal(provavel.blocks.perdas.caixa, 300000);
    assert.equal(provavel.blocks.papel.caixa, 28000);
    assert.equal(result.ambiente, 320);
    assert.equal(provavel.caixa, result.capitalGiro + 300000 + 48000 + 28000);
    assert.equal(provavel.base, provavel.caixa + provavel.reaisHoras);
    assert.match(provavel.blocks.preenchimento.formula.join('\n'), /÷ 3\.600/);
    assert.match(provavel.blocks.pesagem.formula.join('\n'), /× 2/);
    assert.equal(result.scenarios.conservador.blocks.desvios.horas, 96 * 0.5 * 6);
    assert.equal(result.scenarios.otimista.blocks.erros.horas, 120 * 0.5 * 0.9);
    assert.equal(result.scenarios.conservador.blocks.perdas.caixa, provavel.blocks.perdas.caixa);
    assert.equal(result.scenarios.otimista.blocks.papel.caixa, provavel.blocks.papel.caixa);
    assert.equal(result.breakEven, 730000 / 750000);
    close(provavel.horasProducao, 1250 + 1600 + 1300 + 200, 4);
    close(provavel.horasQualidade, 1300 + 45 + 432, 4);

    const semHoras = evaluate({ ...sample, incluirHoras: false });
    assert.equal(semHoras.scenarios.provavel.base, provavel.caixa);
    assert.equal(semHoras.scenarios.provavel.blocks.preenchimento.total, 0);
    assert.equal(semHoras.scenarios.provavel.blocks.erros.total, 0);
    assert.equal(semHoras.scenarios.provavel.blocks.perdas.total, 300000);

    const semDupla = evaluate({ ...sample, b2Dupla: false });
    assert.equal(semDupla.scenarios.provavel.blocks.pesagem.horas, 800);

    const vazio = evaluate({});
    assert.equal(vazio.scenarios.provavel.base, 0);
    assert.equal(vazio.scenarios.provavel.pct, 0);
    assert.equal(vazio.curve.assumed, true);
  });

  it('recupera o investimento com a curva dos três primeiros meses', () => {
    const months = rampMonths('dedicado', [0, 0.5, 1]);
    assert.equal(paybackMonths(1000, 0, 1200, months), 12);
    assert.equal(roiRatio(1, 1200, months, 1000, 0), (1050 - 1000) / 1000);
    const result = evaluate({
      opsAno: 10,
      b5Qtd: 2,
      b5Valor: 1000,
      b5Pct: 1,
      b7Paginas: 0,
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
    assert.equal(result.ops, 1000);
    assert.equal(result.money.total, 550000);
    assert.equal(result.money.licenca, 180000);
    assert.equal(provavel.caixa, 507506.85);
    close(provavel.horasProducao + provavel.horasQualidade, 4350 + 1777, 2);
    close(provavel.reaisHoras, 4350 * 95 + 1777 * 150, 2);
    assert.equal(provavel.paybackMeses, 9);
    assert.ok(provavel.blocks.preenchimento.formula.length >= 2);
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
    assert.doesNotMatch(page, /Só pesagem/);
    assert.doesNotMatch(app, /Só pesagem/);
    assert.match(page, /OPs \(lotes\) por ano/);
    assert.match(page, /Ver cálculo/);
    assert.match(page, /Dupla checagem/);
    assert.match(page, /Garantia da Qualidade/);
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
    assert.match(app, /gcalc\.roi-mes\.v2/);
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
