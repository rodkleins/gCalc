import { describe, expect, it } from 'vitest';
import { evaluate } from './calculate';
import { exampleInputs } from './example';
import { storePresets } from './presets';
import { rootStorePresets, withRootGuards } from './rootPresets';
import { cashAt60, fiscalSensitivityRows, withBookResidual, withTaxShield, withoutResidual } from './rootFiscal';
import { buildMonthTable } from './monthTable';
import type { Inputs } from './types';

function root2m(): Inputs {
  const preset = rootStorePresets().find((item) => item.id === 'loja-2m');
  if (!preset) throw new Error('sem 2m');
  return structuredClone(preset.inputs);
}

describe('raiz: dupla contagem', () => {
  it('com corte de folha, movimentação e inventário só contam com dono das horas e caminho de caixa', () => {
    const raw = exampleInputs();
    expect(raw.people.payroll.enabled && raw.people.payroll.positionsReduced > 0).toBe(true);
    const free = evaluate(raw);
    const guarded = withRootGuards(raw);
    const blocked = evaluate(guarded);
    expect(free.steadyNet - blocked.steadyNet).toBeCloseTo(1_200, 0);
    const move = blocked.audit.find((line) => line.id === 'movement');
    expect(move?.includedInCashFlow).toBe(false);
    expect(move?.reason).toMatch(/Dupla contagem/);

    const declared = structuredClone(guarded);
    declared.logistics.movement.hoursOwner = 'outros colaboradores que permanecem';
    declared.logistics.movement.cashPath = 'hora_extra';
    declared.logistics.inventoryCount.hoursOwner = 'outros colaboradores que permanecem';
    declared.logistics.inventoryCount.cashPath = 'terceiro';
    expect(evaluate(declared).steadyNet).toBeCloseTo(free.steadyNet, 2);

    const onlyOwner = structuredClone(guarded);
    onlyOwner.logistics.movement.hoursOwner = 'outros colaboradores';
    expect(evaluate(onlyOwner).steadyNet).toBeCloseTo(blocked.steadyNet, 2);
  });

  it('inventário respeita “já retiradas na redução de folha”', () => {
    const inputs = exampleInputs();
    inputs.logistics.inventoryCount.alreadyCountedInPayroll = true;
    const result = evaluate(inputs);
    const count = result.audit.find((line) => line.id === 'inventoryCount');
    expect(count?.includedInCashFlow).toBe(false);
    expect(evaluate(exampleInputs()).steadyNet - result.steadyNet).toBeCloseTo(400, 0);
  });

  it('presets da raiz começam com movimentação e inventário desligados; os compartilhados ficam como estavam', () => {
    for (const preset of rootStorePresets()) {
      expect(preset.inputs.logistics.requireCashPath).toBe(true);
      expect(preset.inputs.logistics.movement.enabled).toBe(false);
      expect(preset.inputs.logistics.inventoryCount.enabled).toBe(false);
    }
    for (const preset of storePresets()) {
      expect(preset.inputs.logistics.requireCashPath).toBeUndefined();
      expect(preset.inputs.robot.residualMode).toBeUndefined();
    }
  });
});

describe('raiz: benefício fiscal da depreciação', () => {
  it('é desligado no caso base; só escudo soma depreciação × alíquota sobre a base líquida dos créditos', () => {
    const inputs = root2m();
    expect(inputs.robot.includeTax).toBe(false);
    expect(inputs.robot.taxRate).toBe(0.34);
    expect(inputs.robot.depreciationYears).toBe(10);
    const base = evaluate(inputs);
    const shield = evaluate(withTaxShield(inputs));
    const depreciable = base.netInvestment;
    expect(shield.residual?.depreciableBase).toBe(depreciable);
    const monthly = (depreciable / 120) * 0.34;
    const gain = shield.months[11].incremental - base.months[11].incremental;
    expect(gain).toBeCloseTo(monthly, 0);
    expect(shield.npv).toBeGreaterThan(base.npv);
    expect(shield.payback!).toBeLessThan(base.payback!);
  });

  it('lucro real completo tributa a economia e piora o resultado', () => {
    const inputs = root2m();
    const full = evaluate(withTaxShield(inputs, 'incremental_simplificado'));
    expect(full.npv).toBeLessThan(evaluate(inputs).npv);
  });
});

describe('raiz: valor residual', () => {
  it('padrão de 30% do valor contábil no mês 60, sem mexer no payback antes do mês 60', () => {
    const inputs = root2m();
    const result = evaluate(inputs);
    const book = result.netInvestment - (result.netInvestment / 120) * 60;
    expect(result.residual?.book).toBeCloseTo(book, 0);
    expect(result.residual?.gross).toBeCloseTo(book * 0.3, 0);
    const none = evaluate(withoutResidual(inputs));
    expect(result.payback).toBeCloseTo(none.payback!, 6);
    expect(result.npv).toBeGreaterThan(none.npv);
    expect(cashAt60(result) - cashAt60(none)).toBeCloseTo(book * 0.3, 0);
    const pct50 = evaluate(withBookResidual(inputs, 0.5));
    expect(pct50.residual?.gross).toBeCloseTo(book * 0.5, 0);
  });

  it('aparece como evento do mês 60 na tabela mês a mês', () => {
    const inputs = root2m();
    const result = evaluate(inputs);
    const table = buildMonthTable(result);
    const row60 = table.rows.find((row) => row.month === 60);
    expect(row60?.residual).toBeCloseTo(result.residual!.gross, 0);
  });

  it('a sensibilidade fiscal lista os cinco casos', () => {
    const rows = fiscalSensitivityRows(root2m(), 'base');
    expect(rows.map((row) => row.id)).toEqual(['atual', 'sem', 'escudo', 'completo', 'sem-residual']);
  });
});
