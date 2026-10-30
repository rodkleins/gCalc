import { evaluate } from './calculate';
import { formatBRL, formatIrr, formatPayback, formatPercent } from './format';
import type { EvalOptions, Inputs, ModelResult, ScenarioId } from './types';

/**
 * Benefício fiscal da depreciação e valor residual da calculadora raiz (/).
 * As outras rotas não chamam estas funções; os campos novos ficam ausentes e o modelo se comporta como antes.
 */
export type TaxShieldMode = 'escudo_depreciacao' | 'incremental_simplificado';

export const TAX_SHIELD_NOTE =
  'Só vale para empresas no lucro real, com lucro tributável para absorver a despesa de depreciação, e precisa de validação da área fiscal. Fora do lucro real (Simples, presumido) não há este benefício.';

/** Liga o benefício fiscal. “Só escudo” não tributa a economia; “lucro real completo” tributa a economia e abate a depreciação. */
export function withTaxShield(inputs: Inputs, mode: TaxShieldMode = 'escudo_depreciacao'): Inputs {
  return { ...inputs, robot: { ...inputs.robot, includeTax: true, taxPolicy: mode } };
}

export function withoutTax(inputs: Inputs): Inputs {
  return { ...inputs, robot: { ...inputs.robot, includeTax: false, taxPolicy: 'sem_impostos' } };
}

export function withoutResidual(inputs: Inputs): Inputs {
  return { ...inputs, robot: { ...inputs.robot, residualMode: 'fixo', residualValue: 0 } };
}

export function withBookResidual(inputs: Inputs, pct = 0.3): Inputs {
  return { ...inputs, robot: { ...inputs.robot, residualMode: 'pct_contabil', residualPctOfBook: pct } };
}

export function taxShieldOn(inputs: Inputs): boolean {
  return inputs.robot.includeTax;
}

/** Depreciação mensal e escudo mensal (depreciação × alíquota) sobre a base depreciável do modelo. */
export function depreciationFigures(inputs: Inputs, result: ModelResult) {
  const base = result.residual?.depreciableBase ?? result.netInvestment;
  const months = result.residual?.depreciationMonths ?? Math.max(1, Math.round(inputs.robot.depreciationYears * 12));
  const monthly = base / months;
  return { base, months, monthly, shieldMonthly: monthly * inputs.robot.taxRate };
}

/** Caixa acumulado no mês 60 (última posição do fluxo). */
export function cashAt60(result: ModelResult): number {
  return result.months[result.months.length - 1]?.cumulative ?? 0;
}

function deltaPayback(a: number | null, b: number | null): string {
  if (a === null || b === null) return '';
  const diff = a - b;
  return ` (${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1).replace('.', ',')} meses)`;
}

function line(label: string, r: ModelResult): string {
  return `${label}: payback ${formatPayback(r.payback)}, VPL ${formatBRL(r.npv)}, TIR ${formatIrr(r.irrAnnual)}`;
}

/** Linhas do “Ver cálculo” da raiz: dupla contagem, benefício fiscal e valor residual. */
export function rootFiscalMemory(inputs: Inputs, result: ModelResult) {
  if (!inputs.logistics.requireCashPath) return [];
  const opts: EvalOptions = { scenario: result.scenario };
  const rows: Array<{ id: string; label: string; text: string; considered: boolean }> = [];

  const payroll = inputs.people.payroll;
  if (payroll.enabled && payroll.positionsReduced > 0) {
    const status = (id: 'movement' | 'inventoryCount', name: string) => {
      const audit = result.audit.find((item) => item.id === id);
      if (!audit) return '';
      return audit.includedInCashFlow
        ? `${name} entra (${formatBRL(audit.monthlyValue)}/mês), com horas de “${(inputs.logistics[id].hoursOwner ?? '').trim() || '—'}” virando ${inputs.logistics[id].cashPath === 'terceiro' ? 'terceiro evitado' : 'hora extra evitada'}.`
        : `${name} fora do caixa.`;
    };
    rows.push({
      id: 'double-count',
      label: 'Dupla contagem',
      text:
        `O corte de ${payroll.positionsReduced} vagas já conta a folha. Movimentação e inventário só entram se as horas forem de quem permanece e virarem caixa (hora extra ou terceiro evitado); sem isso, ficam fora. ` +
        `${status('movement', 'Movimentação')} ${status('inventoryCount', 'Inventário')}`,
      considered: true,
    });
  }

  const dep = depreciationFigures(inputs, result);
  const creditText =
    result.avoidedCapex !== 0
      ? `CAPEX bruto ${formatBRL(result.grossCapex)} − créditos recuperáveis ${formatBRL(result.recoverableTaxCredit)} − CAPEX evitado ${formatBRL(result.avoidedCapex)}`
      : `CAPEX bruto ${formatBRL(result.grossCapex)} − créditos recuperáveis ${formatBRL(result.recoverableTaxCredit)}`;
  const off = evaluate(withoutTax(inputs), opts);
  const shield = evaluate(withTaxShield(inputs, 'escudo_depreciacao'), opts);
  const full = evaluate(withTaxShield(inputs, 'incremental_simplificado'), opts);
  const on = taxShieldOn(inputs);
  rows.push({
    id: 'tax-shield',
    label: 'Benefício fiscal da depreciação',
    text:
      `${on ? (inputs.robot.taxPolicy === 'escudo_depreciacao' ? 'Ligado (só escudo).' : 'Ligado (lucro real completo).') : 'Desligado no caso base.'} ` +
      `Base depreciável = ${creditText} = ${formatBRL(dep.base)} (o crédito já recuperado não deprecia de novo). ` +
      `${formatBRL(dep.base)} ÷ ${dep.months} meses = ${formatBRL(dep.monthly)}/mês × ${formatPercent(inputs.robot.taxRate)} = escudo de ${formatBRL(dep.shieldMonthly)}/mês. ` +
      `${line('Sem benefício', off)}. ${line('Só escudo', shield)}${deltaPayback(shield.payback, off.payback)}. ` +
      `${line('Lucro real completo (tributa também a economia)', full)}${deltaPayback(full.payback, off.payback)}. ${TAX_SHIELD_NOTE}`,
    considered: on,
  });

  const residual = result.residual;
  if (residual) {
    const month60 = result.months[result.months.length - 1]?.residual ?? 0;
    const noResidual = evaluate(withoutResidual(inputs), opts);
    const how =
      residual.mode === 'pct_contabil'
        ? `Valor contábil no mês 60 = ${formatBRL(residual.depreciableBase)} − ${Math.min(Math.max(0, 61 - Math.max(1, Math.round(inputs.robot.goLiveMonth))), residual.depreciationMonths)} ÷ ${residual.depreciationMonths} da base = ${formatBRL(residual.book)}. Residual = ${formatPercent(inputs.robot.residualPctOfBook ?? 0)} × ${formatBRL(residual.book)} = ${formatBRL(residual.gross)}.`
        : `Valor fixo informado: ${formatBRL(residual.gross)}.`;
    rows.push({
      id: 'residual',
      label: 'Valor residual no mês 60',
      text:
        `${how} Entra como caixa no mês 60${month60 !== residual.gross ? ` (${formatBRL(month60)} depois do imposto sobre ganho ou perda de capital)` : ''}. ` +
        `Payback só muda se acontecer no mês 60; VPL e TIR mudam. ${line('Sem residual', noResidual)}. ${line('Com residual', result)}.`,
      considered: residual.gross !== 0,
    });
  }
  return rows;
}

/** Linhas de sensibilidade da raiz para benefício fiscal e valor residual. */
export function fiscalSensitivityRows(inputs: Inputs, scenario: ScenarioId) {
  const opts: EvalOptions = { scenario, skipNetwork: true };
  const cases: Array<{ id: string; label: string; inputs: Inputs }> = [
    { id: 'atual', label: 'Premissas atuais', inputs },
    { id: 'sem', label: 'Sem benefício fiscal e sem residual', inputs: withoutResidual(withoutTax(inputs)) },
    { id: 'escudo', label: 'Benefício fiscal: só escudo da depreciação', inputs: withTaxShield(inputs, 'escudo_depreciacao') },
    { id: 'completo', label: 'Lucro real completo (tributa também a economia)', inputs: withTaxShield(inputs, 'incremental_simplificado') },
    { id: 'sem-residual', label: 'Sem valor residual', inputs: withoutResidual(inputs) },
  ];
  return cases.map((item) => {
    const r = evaluate(item.inputs, opts);
    return { id: item.id, label: item.label, payback: r.payback, npv: r.npv, irr: r.irrAnnual, cash60: cashAt60(r) };
  });
}
