import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import {
  BIOLAB_PRESET,
  DISCLAIMER,
  TERMS,
  emptyInput,
  evaluate,
  exampleInput,
  formatPayback,
  parseDecimal,
  recordHours,
} from '../../public/interno/roi-ebr/calc.js';

const root = join(import.meta.dirname, '../..');

function close(actual, expected, digits = 1) {
  const factor = 10 ** digits;
  assert.equal(Math.round(actual * factor) / factor, Math.round(expected * factor) / factor);
}

describe('spec v1.0', () => {
  it('lê vírgula ou ponto como decimal', () => {
    assert.equal(parseDecimal('0,60'), 0.6);
    assert.equal(parseDecimal('0.60'), 0.6);
    assert.equal(parseDecimal(''), 0);
    assert.equal(parseDecimal('15'), 15);
  });

  it('T1 registra 500 campos sem o fator de cenário', () => {
    const input = {
      ...emptyInput(),
      lotes: 600,
      F: 500,
      sf: 15,
      sp: 10,
      sq: 30,
      err: 3,
      mc: 5,
      auto: 40,
      se: 8,
      exc: 5,
      sxp: 30,
      sxq: 60,
      fin: 10,
      rerr_p: 90,
    };
    const row = recordHours(input, 90);
    close(row.T.op, 1250);
    close(row.E.op, 400);
    close(row.T.pr, 833.3);
    close(row.E.pr, 125);
    close(row.T.gq, 2500);
    close(row.E.gq, 350);
    close(row.T.co, 750);
    close(row.E.co, 75);
    close(row.totalT, 5333.3);
    close(row.totalE, 950);
    const result = evaluate(input);
    close(result.orderMinutes.today, 533.3);
    close(result.orderMinutes.ebr, 95);
    close(result.orderMinutes.gqToday, 250);
    close(result.orderMinutes.gqEbr, 35);
  });

  it('T2 fecha o registro estimado da Biolab sem o fator de cenário', () => {
    const row = recordHours({
      lotes: 2500, F: 500, sf: 15, sp: 10, sq: 15, err: 2, mc: 5,
      auto: 30, se: 8, exc: 3, sxp: 30, sxq: 60, fin: 10,
    }, 90);
    close(row.T.op, 5208.3);
    close(row.E.op, 1944.4);
    close(row.T.pr, 3472.2);
    close(row.E.pr, 312.5);
    close(row.T.gq, 5208.3);
    close(row.E.gq, 1041.7);
    close(row.T.co, 2083.3);
    close(row.E.co, 208.3);
  });

  it('T3 devolve o investimento no mês 12', () => {
    const result = evaluate({
      ...emptyInput(),
      scenario: 'otimista',
      b4n: 6,
      b4v: 200000,
      b4e: 100,
      c1: 1000000,
      c2: 0,
      c3: 0,
    });
    assert.equal(result.benefit, 1200000);
    assert.equal(result.timeline.months[0].flow, 0);
    assert.equal(result.timeline.months[1].flow, 50000);
    assert.equal(result.timeline.months[2].flow, 100000);
    close(result.timeline.months[10].accumulated, -50000, 2);
    close(result.timeline.months[11].accumulated, 50000, 2);
    assert.equal(result.timeline.payback, 12);
  });

  it('T4 calcula o ponto de equilíbrio das perdas', () => {
    const result = evaluate({ ...emptyInput(), c1: 2000000, c2: 400000, b4n: 6, b4v: 250000 });
    close(result.breakeven, 0.533333, 4);
  });

  it('T5 limpa sem NaN e sem payback', () => {
    const result = evaluate(emptyInput());
    assert.equal(formatPayback(result), '—');
    assert.equal(result.timeline.roi5, null);
    assert.equal(result.breakeven, null);
    assert.equal(Number.isFinite(result.benefit), true);
  });

  it('T6 alerta a revisão da GQ fora de 1h30 a 3h', () => {
    assert.equal(evaluate({ ...emptyInput(), F: 500, sq: 30 }).gqAlert, true);
    assert.equal(evaluate({ ...emptyInput(), F: 500, sq: 15 }).gqAlert, false);
  });

  it('T7 zera a capacidade com o toggle desligado', () => {
    const result = evaluate({ ...exampleInput(), capOn: false });
    assert.equal(result.blocks.find((item) => item.id === 'cap').cash, 0);
    assert.ok(evaluate({ ...exampleInput(), capOn: true }).blocks.find((item) => item.id === 'cap').cash > 0);
  });

  it('não aplica o fator global sobre a correção de erros nem sobre o arquivo eletrônico', () => {
    const base = evaluate(exampleInput());
    const low = evaluate({ ...exampleInput(), scenario: 'conservador' });
    assert.equal(base.rerr, 90);
    assert.equal(low.rerr, 75);
    assert.ok(low.blocks.find((item) => item.id === 'b4').cash < base.blocks.find((item) => item.id === 'b4').cash);
    assert.equal(low.blocks.find((item) => item.id === 'b6').formula.join(' ').includes('sem o fator'), true);
  });
});

describe('página /interno/roi-ebr/', () => {
  const dir = 'public/interno/roi-ebr';
  const page = readFileSync(join(root, dir, 'index.html'), 'utf8');
  const app = readFileSync(join(root, dir, 'app.js'), 'utf8');
  const css = readFileSync(join(root, dir, 'styles.css'), 'utf8');
  const spec = readFileSync(join(root, 'docs/SPEC-ROI-MES-v1.md'), 'utf8');

  it('é noindex, traz os logos, o aviso e o Ver cálculo', () => {
    assert.match(spec, /Versão 1\.0/);
    assert.match(spec, /bottom-up/);
    assert.match(page, /<meta name="robots" content="noindex,nofollow"\s*\/?>/);
    assert.match(page, /src="\.\/t2-logo\.png"/);
    assert.match(page, /aria-label="NEO"/);
    assert.match(page, /Ver cálculo/);
    assert.match(page, /aria-live="polite"/);
    assert.equal(page.includes(DISCLAIMER), true);
    assert.match(app, /neo-roi:v1:current/);
    assert.match(css, /#09070D|#09070d/i);
    assert.match(css, /#A855F7|#a855f7/i);
    assert.match(css, /@media print/);
    assert.equal(TERMS.pt.batchRelease, 'aprovação do lote');
    assert.equal(TERMS.es.batchRelease, 'aprobación del lote');
    assert.equal(TERMS.en.batchRelease, 'batch release');
    assert.equal(TERMS.es.sop, 'POE');
    for (const text of [page, app, css]) {
      assert.equal(text.includes('gcalc.t2software.co'), false);
      assert.doesNotMatch(text, /go-live|warning letter|garante conformidade/i);
      assert.doesNotMatch(text, /href="\/|src="\/|href="\.\.\//);
    }
    const mes = readFileSync(join(root, 'public/interno/roi-mes/calc.js'), 'utf8');
    assert.equal(mes.includes('neo-roi:v1:current'), false);
  });
});

describe('divisão Produção × Garantia da Qualidade', () => {
  for (const [name, input] of [['exemplo', exampleInput()], ['biolab', { ...BIOLAB_PRESET, capOn: false }]]) {
    it(`soma exatamente os totais (${name})`, () => {
      const r = evaluate(input);
      const { prod, qa } = r.areas;
      close(prod.hours + qa.hours, r.H, 6);
      close(prod.hv + qa.hv, r.HV, 6);
      close(prod.savingValue + qa.savingValue, r.HV * r.captura, 6);
      close(prod.capacityHours + qa.capacityHours, r.H * (1 - r.captura), 6);
      assert.ok(prod.hours > 0 && qa.hours > 0);
    });
  }
  it('não muda payback nem ROI', () => {
    const r = evaluate(exampleInput());
    assert.equal(formatPayback(r), '30 meses');
  });
});
