import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import {
  DISCLAIMER,
  HYPOTHETICAL_PRESETS,
  evaluate,
  exampleInput,
} from '../../public/interno/roi-ebr/calc.js';

const root = join(import.meta.dirname, '../..');

function close(actual, expected, digits = 2) {
  const factor = 10 ** digits;
  assert.equal(Math.round(actual * factor) / factor, Math.round(expected * factor) / factor);
}

describe('ROI EBR novo', () => {
  it('o preset hipotético médio fecha o exemplo padrão', () => {
    const result = evaluate(exampleInput());
    const provavel = result.scenarios.provavel;
    assert.equal(HYPOTHETICAL_PRESETS.media.name.startsWith('Hipotético'), true);
    assert.equal(result.ops, 1000);
    assert.equal(result.money.total, 550000);
    assert.equal(result.money.licenca, 180000);
    assert.equal(provavel.caixa, 508946.85);
    close(provavel.horasProducao, 4350, 2);
    close(provavel.horasQualidade, 1813, 2);
    close(provavel.base, 1194146.85, 2);
    assert.equal(provavel.paybackMeses, 9);
    assert.match(provavel.blocks.arquivo.formula.join('\n'), /volume acumulado/);
    assert.notEqual(evaluate({ ...exampleInput(), opsAno: 400 }).scenarios.provavel.paybackMeses, 9);
  });
});

describe('página /interno/roi-ebr/', () => {
  const dir = 'public/interno/roi-ebr';
  const page = readFileSync(join(root, dir, 'index.html'), 'utf8');
  const app = readFileSync(join(root, dir, 'app.js'), 'utf8');
  const calc = readFileSync(join(root, dir, 'calc.js'), 'utf8');
  const css = readFileSync(join(root, dir, 'styles.css'), 'utf8');
  const spec = readFileSync(join(root, 'docs/SPEC-ROI-MES-v1.md'), 'utf8');

  it('é noindex, relativa, hipotética e segue as regras da spec', () => {
    assert.match(page, /<meta name="robots" content="noindex,nofollow"\s*\/?>/);
    assert.match(page, /src="\.\/t2-logo\.png"/);
    assert.match(page, /aria-label="NEO"/);
    assert.match(page, /Ver cálculo/);
    assert.match(page, /Preset hipotético/);
    assert.match(page, /Hipotético · planta média/);
    assert.equal(page.includes(DISCLAIMER), true);
    assert.match(page, /aprovação do lote/);
    assert.match(page, /registro de lote eletrônico \(EBR\)/);
    assert.match(page, /controle de mudanças/);
    assert.match(page, /entrada em operação/);
    assert.match(page, /POP/);
    assert.match(app, /gcalc\.roi-ebr\.v1/);
    assert.doesNotMatch(app, /gcalc\.roi-mes/);
    assert.match(spec, /Regras que não se negociam/);
    assert.match(css, /#09070D/);
    assert.match(css, /#A855F7/);
    for (const text of [page, app, calc, css]) {
      assert.equal(text.includes('gcalc.t2software.co'), false);
      assert.equal(text.includes('Biolab'), false);
      assert.equal(text.includes('Theraskin'), false);
      assert.doesNotMatch(text, /go-live|warning letter|garante conformidade/i);
      assert.doesNotMatch(text, /href="\/|src="\/|href="\.\.\//);
    }
  });

  it('não altera a calculadora anterior nem as páginas públicas', () => {
    const mes = readFileSync(join(root, 'public/interno/roi-mes/app.js'), 'utf8');
    assert.match(mes, /gcalc\.roi-mes\.v3/);
    assert.doesNotMatch(mes, /roi-ebr/);
    for (const file of ['index.html', 'src/components/PageNav.tsx', 'public/interno/roi-mes/index.html']) {
      assert.equal(readFileSync(join(root, file), 'utf8').includes('roi-ebr'), false, file);
    }
  });
});
