import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import {
  DEFAULTS,
  DISCLAIMER,
  JIRA_WARNING,
  PRIORITIES,
  evaluate,
  formatBRL,
  formatHours,
  parseBr,
  planLabel,
} from '../../public/interno/suporte-24x7/calc.js';

const root = join(import.meta.dirname, '../..');

function close(actual, expected, digits = 2) {
  const factor = 10 ** digits;
  assert.equal(Math.round(actual * factor) / factor, Math.round(expected * factor) / factor);
}

describe('leitura de números e frações', () => {
  it('lê milhar brasileiro, fração 1/3 e campo vazio', () => {
    assert.equal(parseBr('10.000'), 10000);
    assert.equal(parseBr('R$ 10.000,00'), 10000);
    assert.equal(parseBr('8,5'), 8.5);
    close(parseBr('1/3'), 1 / 3, 10);
    assert.equal(parseBr(''), null);
    assert.equal(parseBr('2'), 2);
  });
});

describe('padrões do Suporte 24x7', () => {
  const result = evaluate();

  it('monta o expediente 22 × 8,5 = 187 h e 720 − 187 = 533 h', () => {
    assert.equal(DEFAULTS.salary, 10000);
    assert.equal(DEFAULTS.charges, 2);
    assert.equal(DEFAULTS.hourDivisor, 220);
    assert.equal(DEFAULTS.monthHours, 720);
    assert.equal(DEFAULTS.workdays, 22);
    assert.equal(DEFAULTS.hoursPerDay, 8.5);
    close(DEFAULTS.standbyFraction, 1 / 3, 10);
    assert.equal(DEFAULTS.weekdayHours, 10);
    assert.equal(DEFAULTS.sundayHours, 0);
    assert.equal(DEFAULTS.nightHours, 0);
    assert.equal(DEFAULTS.marginPct, null);
    assert.equal(DEFAULTS.includedHours, null);
    assert.equal(DEFAULTS.extraHourPrice, null);
    assert.equal(DEFAULTS.toolsCost, 0);
    assert.equal(result.commercialHours, 187);
    assert.equal(result.offHours, 533);
    close(result.paidStandbyHours, 533 / 3, 6);
  });

  it('chega na hora de R$ 45,45 e no sobreaviso ≈ R$ 8.080 / R$ 16.160', () => {
    close(result.hourValue, 45.45);
    assert.equal(formatBRL(result.hourValue), 'R$\u00a045,45');
    close(result.standbyCostGross, 8075.76);
    close(result.standbyCost, 16151.52);
    assert.ok(result.standbyCostGross > 8000 && result.standbyCostGross < 8160);
    assert.ok(result.standbyCost > 16000 && result.standbyCost < 16320);
  });

  it('calcula acionamento de dia útil, domingo e 10 h no intervalo de referência', () => {
    close(result.weekdayRate, 68.18);
    close(result.weekdayRateCharged, 136.36);
    close(result.sundayRate, 90.91);
    close(result.sundayRateCharged, 181.82);
    close(result.activationCost, 1363.64);
    assert.ok(result.activationCost > 1300 && result.activationCost < 1800);
    assert.equal(formatBRL(result.weekdayRate), 'R$\u00a068,18');
    assert.equal(formatBRL(result.sundayRate), 'R$\u00a090,91');
  });

  it('fecha o custo de RH entre R$ 17.500 e R$ 18.000, sem preço enquanto a margem está vazia', () => {
    close(result.rhCost, 17515.16);
    assert.ok(result.rhCost >= 17500 && result.rhCost <= 18000);
    assert.equal(result.toolsCost, 0);
    assert.equal(result.totalCost, result.rhCost);
    assert.equal(result.price, null);
    assert.equal(result.suggestedExtraHour, null);
    assert.equal(result.planLabel, 'P1+P2');
  });

  it('aplica +20% no noturno sobre a base escolhida', () => {
    const weekdayNight = evaluate({ weekdayHours: 0, sundayHours: 0, nightHours: 1, nightBase: 'weekday' });
    close(weekdayNight.nightRate, 68.1818181818 * 1.2, 4);
    close(weekdayNight.activationCost, weekdayNight.nightRateCharged);
    const sundayNight = evaluate({ weekdayHours: 0, sundayHours: 0, nightHours: 1, nightBase: 'sunday' });
    close(sundayNight.nightRate, 90.909090909 * 1.2, 4);
    close(sundayNight.nightRateCharged, sundayNight.nightRate * 2, 2);
  });

  it('não muda o custo de RH com 1 a 4 pessoas; só reparte horas e custo', () => {
    const one = evaluate({ people: 1 });
    for (const n of [2, 3, 4]) {
      const split = evaluate({ people: n });
      assert.equal(split.rhCost, one.rhCost);
      close(split.perPerson.rhCost, one.rhCost / n, 4);
      close(split.perPerson.offHours, one.offHours / n, 6);
      close(split.perPerson.activationHours, one.activationHours / n, 6);
    }
  });

  it('soma ferramentas antes da margem e sugere a hora excedente sem preenchê-la', () => {
    const priced = evaluate({ marginPct: 30, toolsCost: 500 });
    close(priced.totalCost, 17515.16 + 500);
    close(priced.price, priced.totalCost * 1.3);
    close(priced.suggestedExtraHour, priced.weekdayRateCharged * 1.3);
    assert.equal(priced.extraHourPrice, null);
    assert.equal(priced.extraHour, priced.suggestedExtraHour);
    const typed = evaluate({ marginPct: 30, extraHourPrice: 200 });
    assert.equal(typed.extraHourPrice, 200);
    assert.equal(typed.extraHour, 200);
    assert.notEqual(typed.extraHour, typed.suggestedExtraHour);
  });

  it('troca o rótulo do plano sem alterar números', () => {
    const a = evaluate({ plan: 'p1' });
    const b = evaluate({ plan: 'p1p2' });
    assert.equal(a.rhCost, b.rhCost);
    assert.equal(planLabel('p1'), 'Só P1');
    assert.equal(a.planLabel, 'Só P1');
    assert.equal(b.planLabel, 'P1+P2');
  });

  it('mostra 10 h de domingo na faixa alta da referência de acionamento', () => {
    const sunday = evaluate({ weekdayHours: 0, sundayHours: 10, nightHours: 0 });
    close(sunday.activationCost, 1818.18);
    assert.ok(sunday.activationCost >= 1400 && sunday.activationCost <= 1850);
  });
});

describe('página /interno/suporte-24x7/', () => {
  const dir = 'public/interno/suporte-24x7';
  const page = readFileSync(join(root, dir, 'index.html'), 'utf8');
  const app = readFileSync(join(root, dir, 'app.js'), 'utf8');
  const calc = readFileSync(join(root, dir, 'calc.js'), 'utf8');
  const css = readFileSync(join(root, dir, 'styles.css'), 'utf8');

  it('é noindex, relativa, com logo da T2 e o mesmo padrão visual do ROI interno', () => {
    assert.match(page, /<meta name="robots" content="noindex,nofollow"\s*\/?>/);
    assert.match(page, /href="\.\/styles\.css"/);
    assert.match(page, /src="\.\/app\.js"/);
    assert.match(page, /src="\.\/t2-logo\.png"/);
    assert.match(page, /alt="T2 Software"/);
    assert.match(app, /from '\.\/calc\.js'/);
    assert.doesNotMatch(page, /logo-neo|aria-label="NEO"|NEO/);
    assert.match(page, /lang="pt-BR"/);
    assert.match(page, /Uso interno · não indexar/);
    assert.match(page, /Custo e preço do Suporte 24x7/);
    assert.match(page, /P1 crítico/);
    assert.match(page, /produção parada ou liberação de lote bloqueada, sem contorno/);
    assert.match(page, /P2 alto/);
    assert.match(page, /impacto sério, com contorno/);
    assert.match(page, /P3 médio/);
    assert.match(page, /P4 baixo/);
    assert.match(page, /próximo dia útil/);
    assert.match(page, /Só P1/);
    assert.match(page, /P1\+P2/);
    assert.equal(page.includes(JIRA_WARNING), true);
    assert.match(page, /Use o recurso mais caro/);
    assert.match(page, /já está na folha da T2/);
    assert.match(page, /Memória de cálculo/);
    assert.equal(page.includes(DISCLAIMER) || app.includes('DISCLAIMER'), true);
    assert.match(css, /#09070D/i);
    assert.match(css, /#A855F7/i);
    assert.match(css, /Sora/);
    assert.match(css, /Manrope/);
    assert.match(css, /IBM Plex Mono/);
    assert.match(css, /@media print/);
    assert.match(app, /gcalc\.suporte-24x7\.v1/);
    assert.equal(PRIORITIES.length, 4);
    assert.match(calc, /720/);
    for (const text of [page, app, calc, css]) {
      assert.equal(text.includes('gcalc.t2software.co'), false);
      assert.equal(text.includes('interno/modelos'), false);
      assert.equal(text.includes('interno/locacao'), false);
      assert.equal(text.includes('interno/manutencao'), false);
      assert.equal(text.includes('roi-mes'), false);
      assert.equal(text.includes('roi-ebr'), false);
      assert.doesNotMatch(text, /href="\/|src="\/|href="\.\.\//);
    }
  });

  it('não escreve nome de cliente e não é ligada pelas outras rotas', () => {
    const re = new RegExp('bio' + 'lab', 'i');
    const folder = join(root, dir);
    for (const file of readdirSync(folder)) {
      if (file.endsWith('.png')) continue;
      const text = readFileSync(join(folder, file), 'utf8');
      assert.equal(re.test(text), false, file);
    }
    const untouched = [
      'index.html',
      'headtohead/index.html',
      'calculos/index.html',
      'rh/index.html',
      'rh/calculos/index.html',
      'public/interno/modelos/index.html',
      'public/interno/manutencao/index.html',
      'public/interno/locacao/index.html',
      'public/interno/roi-mes/index.html',
      'public/interno/roi-ebr/index.html',
      'src/model/sitePaths.ts',
      'src/components/PageNav.tsx',
      'public/robots.txt',
    ];
    for (const file of untouched) {
      const text = readFileSync(join(root, file), 'utf8');
      assert.equal(text.includes('suporte-24x7'), false, file);
    }
    assert.match(readFileSync(join(root, 'public/robots.txt'), 'utf8'), /Disallow:\s*\/interno\//);
  });

  it('traz os padrões na ficha e formata as horas do expediente', () => {
    assert.match(page, /value="10\.000"/);
    assert.match(page, /value="8,5"/);
    assert.match(page, /value="1\/3"/);
    assert.match(page, /value="220"/);
    assert.match(page, /value="720"/);
    assert.match(page, /value="22"/);
    assert.equal(formatHours(187), '187 h');
    assert.equal(formatHours(8.5), '8,5 h');
    assert.equal(formatHours(533 / 3), '177,67 h');
  });
});
