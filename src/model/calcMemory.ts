import { evaluate } from './calculate';
import { formatBRL, formatIrr, formatPayback, formatPercent } from './format';
import { FOCUS_SOURCE_TEXT, hasInflation, withoutInflation } from './inflation';
import { marketReferenceText } from './laborReference';
import { rootFiscalMemory } from './rootFiscal';
import { energyMonthlyCost, informedMonthlyRobotCost } from './robotCost';
import type { AuditLine, Inputs, ModelResult } from './types';

export type MemoryId = 'investimento' | 'beneficios' | 'custo' | 'fluxo' | 'indicadores' | 'fora';

export interface MemoryRow {
  id: string;
  label: string;
  text: string;
  considered: boolean;
}

export interface MemoryBlock {
  id: MemoryId;
  title: string;
  rows: MemoryRow[];
}

function money(value: number): string {
  return formatBRL(value);
}

function filledAmount(inputs: Inputs, line: AuditLine): number {
  const shelving = inputs.logistics.shelving;
  switch (line.id) {
    case 'shelvingCapex':
      return shelving.releasedValue ?? 0;
    case 'shelvingMaintenance':
      return shelving.avoidedMaintenanceMonthly;
    case 'shelvingResale':
      return shelving.resaleValue > 0 && shelving.resaleValue !== (shelving.releasedValue ?? 0) ? shelving.resaleValue : 0;
    case 'severance':
      return inputs.people.payroll.severanceCost;
    default:
      return 0;
  }
}

function outside(inputs: Inputs, line: AuditLine): boolean {
  if (line.includedInCashFlow) return false;
  if (Math.abs(line.monthlyValue) > 0 || Math.abs(line.oneTimeValue) > 0) return true;
  return Math.abs(filledAmount(inputs, line)) > 0;
}

export function calculationMemory(inputs: Inputs, result: ModelResult): MemoryBlock[] {
  const capex = inputs.robot.capex;
  const pieces = [
    ['equipamento', capex.equipment],
    ['frete e impostos', capex.freightImportTaxes],
    ['instalação e treinamento', capex.installationTraining],
    ['obras e elétrica', capex.civilElectrical],
    ['integração', capex.integration],
    ['contingência', capex.implementationContingency],
  ].filter((piece): piece is [string, number] => typeof piece[1] === 'number' && piece[1] !== 0);
  const shelf = result.audit.find((line) => line.id === 'shelvingCapex');
  const shelfValue = inputs.logistics.shelving.releasedValue ?? 0;
  const shelfCounts = Boolean(shelf?.includedInCashFlow) && shelfValue > 0;
  const grossText =
    pieces.length > 0
      ? `${pieces.map(([label, value]) => `${label} ${money(value)}`).join(' + ')} = ${money(result.grossCapex)}`
      : `Investimento bruto ${money(result.grossCapex)}`;
  const creditText = `${money(Math.max(0, capex.equipment))} × ${formatPercent(inputs.robot.recoverableTaxCreditPct)} = ${money(result.recoverableTaxCredit)}. Entra no mês 0. É comprovável e não fica entre os ganhos potenciais.`;
  const laborText = marketReferenceText(inputs);
  const shelfText = shelfCounts
    ? `${money(shelfValue)} abate o investimento no mês 0.`
    : shelfValue > 0
      ? `${money(shelfValue)} — não considerado. ${shelf?.reason ?? 'Fora da conta.'}`
      : 'Nenhum valor informado.';
  const netText = `${money(result.grossCapex)} − ${money(shelfCounts ? (shelf?.oneTimeValue ?? 0) : 0)} − ${money(result.recoverableTaxCredit)} = ${money(result.netInvestment)}`;

  const benefits = result.audit
    .filter((line) => line.includedInCashFlow && line.kind === 'recorrente' && line.monthlyValue !== 0)
    .map((line) => ({
      id: line.id,
      label: line.label,
      text: `${money(line.monthlyValue)} por mês. ${line.formula}`,
      considered: true,
    }));
  const ignored = result.audit.filter((line) => outside(inputs, line)).map((line) => ({
    id: line.id,
    label: line.label,
    text: `não considerado. ${line.reason}`,
    considered: false,
  }));
  if (inputs.logistics.shelving.removalCost > 0 && inputs.profile.storeType !== 'existente') {
    ignored.push({
      id: 'removal',
      label: 'Remoção de prateleiras',
      text: `não considerado. ${money(inputs.logistics.shelving.removalCost)} só sai do caixa em loja existente, no início da operação.`,
      considered: false,
    });
  }
  if (inputs.logistics.shelving.removalCost > 0 && inputs.logistics.shelving.stillRequired) {
    ignored.push({
      id: 'removal-blocked',
      label: 'Remoção de prateleiras',
      text: 'não considerado. As prateleiras ainda são necessárias, então a remoção não entra.',
      considered: false,
    });
  }

  const energy = energyMonthlyCost(inputs.robot.energy);
  const informed = informedMonthlyRobotCost(inputs.robot);
  const factor = inputs.scenarios[result.scenario].opexFactor;
  const steadyBenefit = result.steadyBenefit;
  const paybackText =
    result.payback === null
      ? `A sobra de ${money(result.steadyNet)} por mês não devolve ${money(result.netInvestment)} em 60 meses.`
      : result.netInvestment <= 0
        ? 'Sem desembolso a recuperar, o payback é imediato.'
        : `${money(result.netInvestment)} ÷ ${money(result.steadyNet)} por mês = ${formatPayback(result.payback)}. A conta interpola o caixa acumulado e não usa a taxa de desconto.`;

  const inflationRows = inflationMemory(inputs, result);

  return [
    {
      id: 'investimento',
      title: 'Investimento líquido',
      rows: [
        { id: 'gross', label: 'Investimento bruto', text: grossText, considered: true },
        { id: 'credit', label: 'Créditos de impostos', text: creditText, considered: result.recoverableTaxCredit !== 0 },
        {
          id: 'shelves',
          label: 'Prateleiras evitadas ou liberadas',
          text: shelfText,
          considered: shelfCounts,
        },
        { id: 'net', label: 'Investimento líquido', text: netText, considered: true },
      ],
    },
    {
      id: 'beneficios',
      title: 'Benefícios mensais',
      rows: [
        ...(benefits.length > 0
          ? benefits
          : [{ id: 'none', label: 'Benefícios', text: 'Nenhum benefício mensal entrou neste cenário.', considered: true }]),
        {
          id: 'labor-reference',
          label: 'Referência de mercado',
          text: laborText,
          considered: false,
        },
      ],
    },
    {
      id: 'custo',
      title: 'Custo mensal do robô',
      rows: [
        {
          id: 'opex',
          label: 'Custo mensal',
          text: `Suporte ${money(inputs.robot.opexMonthly.maintenance)} + energia ${money(energy)} + outros ${money(inputs.robot.opexMonthly.other)} = ${money(informed)}. Com o fator do cenário (${factor}), o custo na conta é ${money(result.monthlyOpex)}. O preço do equipamento não entra aqui.`,
          considered: true,
        },
        {
          id: 'steady',
          label: 'Sobra do mês 60',
          text: `${money(steadyBenefit)} − ${money(result.monthlyOpex)} = ${money(result.steadyNet)}.`,
          considered: true,
        },
      ],
    },
    {
      id: 'fluxo',
      title: 'Fluxo e payback',
      rows: [
        {
          id: 'open',
          label: 'Mês 0',
          text: `Caixa na data zero = −${money(result.netInvestment)}.`,
          considered: true,
        },
        {
          id: 'month',
          label: 'Mês de operação',
          text: 'Cada mês soma o benefício, tira o custo mensal do robô e aplica o caixa pontual (rescisão, remoção, capital de giro, valor residual).',
          considered: true,
        },
        { id: 'payback', label: 'Payback simples', text: paybackText, considered: true },
        ...inflationRows,
        ...rootFiscalMemory(inputs, result),
      ],
    },
    {
      id: 'indicadores',
      title: 'ROI, VPL e TIR',
      rows: [
        {
          id: 'roi',
          label: 'ROI anual simples',
          text:
            result.roi === null
              ? 'Não se aplica sem investimento positivo.'
              : `${money(result.annualSteadyNet)} ÷ ${money(result.netInvestment)} = ${formatPercent(result.roi)}. É a sobra de um ano estável, não a soma dos 60 meses.`,
          considered: result.roi !== null,
        },
        {
          id: 'npv',
          label: 'VPL',
          text: `Caixa descontado a ${formatPercent(result.discountRateAnnual)} ao ano = ${money(result.npv)}.`,
          considered: true,
        },
        {
          id: 'irr',
          label: 'TIR',
          text: result.indicators.irrAmbiguous
            ? 'Mais de uma troca de sinal. A TIR não é única; use o VPL.'
            : `TIR anual efetiva ${formatIrr(result.irrAnnual)}.`,
          considered: result.irrAnnual !== null && !result.indicators.irrAmbiguous,
        },
        {
          id: 'discounted',
          label: 'Payback descontado',
          text: formatPayback(result.discountedPayback),
          considered: result.discountedPayback !== null,
        },
      ],
    },
    {
      id: 'fora',
      title: 'Preenchido e fora da conta',
      rows:
        ignored.length > 0
          ? ignored
          : [{ id: 'none', label: 'Fora da conta', text: 'Nenhum campo preenchido ficou de fora neste cenário.', considered: true }],
    },
  ];
}

/**
 * Efeito da inflação no fluxo. Só aparece quando há reajuste ou base real,
 * então simulações sem inflação (as de /rh/ e /dpsp/) não mudam.
 */
function inflationMemory(inputs: Inputs, result: ModelResult): MemoryRow[] {
  const profile = inputs.profile;
  if (!hasInflation(inputs) && profile.moneyBasis !== 'real') return [];
  if (profile.moneyBasis === 'real' && !hasInflation(inputs)) {
    return [
      {
        id: 'inflation',
        label: 'Inflação',
        text: `Base real: fluxos em moeda constante, sem reajuste, descontados à taxa real de ${formatPercent(result.discountRateAnnual, 2)} ao ano.`,
        considered: true,
      },
    ];
  }
  const flat = evaluate(withoutInflation(inputs), { scenario: result.scenario });
  const year5 = (rate: number) => formatPercent(Math.pow(1 + rate, 59 / 12) - 1, 1);
  const delta = (a: number | null, b: number | null) =>
    a === null || b === null ? '' : ` (${a - b >= 0 ? '+' : '−'}${Math.abs(a - b).toFixed(1).replace('.', ',')} meses)`;
  return [
    {
      id: 'inflation',
      label: 'Inflação',
      text:
        `Salários +${formatPercent(profile.wageGrowthPctPerYear, 2)} ao ano, OPEX +${formatPercent(profile.opexInflationPctPerYear, 2)} e IPCA +${formatPercent(profile.priceInflationPctPerYear, 2)}, ` +
        `compostos mês a mês: fator do mês = (1 + taxa)^((mês − 1) ÷ 12). No mês 60 a folha vale ${year5(profile.wageGrowthPctPerYear)} a mais, ` +
        `o OPEX ${year5(profile.opexInflationPctPerYear)} e perdas e margens ${year5(profile.priceInflationPctPerYear)}. Fonte do IPCA padrão: ${FOCUS_SOURCE_TEXT}`,
      considered: true,
    },
    {
      id: 'inflation-effect',
      label: 'Efeito da inflação',
      text:
        `Sem reajuste: payback ${formatPayback(flat.payback)}, VPL ${money(flat.npv)}, líquido do mês 60 ${money(flat.steadyNet)}. ` +
        `Com reajuste: payback ${formatPayback(result.payback)}${delta(result.payback, flat.payback)}, VPL ${money(result.npv)}, líquido do mês 60 ${money(result.steadyNet)}. ` +
        `A taxa de desconto de ${formatPercent(result.discountRateAnnual, 2)} é nominal e não muda.`,
      considered: true,
    },
  ];
}
