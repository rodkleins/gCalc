import { round2 } from './round';
import { HORIZON_MONTHS, type ModelResult } from './types';

/** Uma linha da tabela mês a mês dos Resultados. Valores em R$, com sinal de caixa. */
export interface MonthTableRow {
  month: number;
  /** Investimento líquido dos créditos de impostos recuperáveis (negativo). Mês 0 e eventuais parcelas. */
  investment: number;
  /** Economia de mão de obra: folha, contratações evitadas, turnover, supervisão e horas realocadas. */
  laborSavings: number;
  /** Redução de perdas: perdas de estoque e quebra/furto evitados. */
  lossReduction: number;
  /** Demais ganhos operacionais (logística, área, caixas, contagem, margem de venda, custo financeiro). */
  otherBenefits: number;
  /** Custos mensais do robô (suporte, energia e outros), com sinal negativo. */
  robotCosts: number;
  /** Imposto sobre o resultado incremental (negativo quando pago). */
  taxes: number;
  /** Eventos pontuais fora o investimento e o residual: rescisão, capital de giro, recrutamento e treinamento evitados. */
  oneTimeEvents: number;
  /** Valor residual do robô (evento do mês 60), já com o imposto sobre ganho ou perda quando houver. */
  residual: number;
  /** Fluxo líquido do mês = soma das colunas acima. */
  netFlow: number;
  /** Saldo acumulado, igual à coluna Acumulado da aba Fluxo. */
  cumulative: number;
  /** Linha em que o saldo acumulado vira positivo (payback). */
  isPayback: boolean;
}

export interface MonthTable {
  rows: MonthTableRow[];
  paybackMonth: number | null;
  /** Colunas extras que só aparecem quando têm valor em algum mês. */
  hasOtherBenefits: boolean;
  hasTaxes: boolean;
  hasOneTimeEvents: boolean;
  hasResidual: boolean;
}

/**
 * Monta a tabela mês a mês a partir de result.months, sem refazer o cálculo.
 * Vai do mês 0 até o maior entre o payback e o horizonte do modelo, limitado a 60 meses.
 */
export function buildMonthTable(result: ModelResult): MonthTable {
  const opening = result.cashFlows[0] ?? -result.netInvestment;
  const payback = result.payback;
  const lastMonth = Math.min(
    HORIZON_MONTHS,
    Math.max(result.months.length, payback === null ? 0 : Math.ceil(payback)),
  );

  const rows: MonthTableRow[] = [
    {
      month: 0,
      investment: opening,
      laborSavings: 0,
      lossReduction: 0,
      otherBenefits: 0,
      robotCosts: 0,
      taxes: 0,
      oneTimeEvents: 0,
      residual: 0,
      netFlow: opening,
      cumulative: opening,
      isPayback: false,
    },
  ];

  for (const month of result.months.slice(0, lastMonth)) {
    const otherBenefits = round2(month.benefit - month.laborSavings - month.lossReduction);
    const residual = round2(month.residual ?? 0);
    const oneTimeEvents = round2(month.oneTime - month.capexTranche - residual);
    rows.push({
      month: month.month,
      investment: month.capexTranche,
      laborSavings: month.laborSavings,
      lossReduction: month.lossReduction,
      otherBenefits,
      robotCosts: round2(-month.opex),
      taxes: round2(-month.tax),
      oneTimeEvents,
      residual,
      netFlow: month.incremental,
      cumulative: month.cumulative,
      isPayback: false,
    });
  }

  let paybackMonth: number | null = null;
  if (rows[0].cumulative >= 0) {
    paybackMonth = result.netInvestment > 0 ? 0 : null;
  } else {
    for (let index = 1; index < rows.length; index += 1) {
      if (rows[index].cumulative >= 0 && rows[index - 1].cumulative < 0) {
        paybackMonth = rows[index].month;
        break;
      }
    }
  }
  if (paybackMonth !== null) rows[paybackMonth].isPayback = true;

  const any = (pick: (row: MonthTableRow) => number) => rows.some((row) => Math.abs(pick(row)) >= 0.005);
  return {
    rows,
    paybackMonth,
    hasOtherBenefits: any((row) => row.otherBenefits),
    hasTaxes: any((row) => row.taxes),
    hasOneTimeEvents: any((row) => row.oneTimeEvents),
    hasResidual: any((row) => row.residual),
  };
}
