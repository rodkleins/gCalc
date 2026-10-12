import { formatBRL } from './format';
import type { ModelResult } from './types';

/** Linha de status do cartão, com o motivo que a auditoria já calculou. */
export function benefitStatus(result: ModelResult, ids: string[]): { enters: boolean; text: string } {
  const lines = ids
    .map((id) => result.audit.find((line) => line.id === id))
    .filter((line): line is NonNullable<typeof line> => Boolean(line));
  if (lines.length === 0) return { enters: false, text: 'Não entra: esta linha não está na auditoria.' };
  const included = lines.filter((line) => line.includedInCashFlow);
  const monthly = included.reduce((sum, line) => sum + line.monthlyValue, 0);
  const oneTime = included.reduce((sum, line) => sum + line.oneTimeValue, 0);
  if (included.length > 0 && monthly !== 0) return { enters: true, text: `Entra: ${formatBRL(monthly)}/mês` };
  if (included.length > 0 && oneTime !== 0) return { enters: true, text: `Entra: ${formatBRL(oneTime)} no caixa pontual` };
  const reason = lines.find((line) => !line.includedInCashFlow)?.reason ?? 'Fora da conta.';
  return { enters: false, text: `Não entra: ${reason}` };
}

/** Caixas, movimentação ou venda que a disponibilidade parcial realmente corta. */
export function partialAvailabilityMatters(result: ModelResult): boolean {
  return ['boxes', 'movement', 'ruptures', 'service', 'abandonment', 'consultative', 'spaceMargin'].some((id) => {
    const line = result.audit.find((item) => item.id === id);
    return Boolean(line?.includedInCashFlow && line.monthlyValue !== 0);
  });
}

export const PARTIAL_AVAILABILITY_IDLE =
  'Não altera este modelo: a folha não cai enquanto a disponibilidade for maior que zero, e não há caixas, movimentação nem vendas no fluxo.';

/** Margem de contribuição só vira caixa quando alguma venda extra entra no fluxo. */
export function salesMarginMatters(result: ModelResult): boolean {
  return ['ruptures', 'service', 'abandonment', 'consultative'].some((id) => {
    const line = result.audit.find((item) => item.id === id);
    return Boolean(line?.includedInCashFlow && line.monthlyValue !== 0);
  });
}

/** Assinatura do resultado usada para saber se um campo mexeu na conta. */
export function resultStamp(result: ModelResult): string {
  const audit = result.audit
    .map((line) => `${line.id}:${line.includedInCashFlow ? 1 : 0}:${line.monthlyValue}:${line.oneTimeValue}:${line.reason}`)
    .join('|');
  const finance = result.financing
    ? `${result.financing.debtServiceMonthly}:${result.financing.financedAmount}:${result.financing.totalFinancialCost}`
    : '0';
  return [
    result.netInvestment,
    result.steadyNet,
    result.payback ?? '',
    result.npv,
    result.roi ?? '',
    result.irrAnnual ?? '',
    result.monthlyOpex,
    finance,
    result.network.npv,
    result.network.investment,
    result.network.mode,
    audit,
  ].join('~');
}
