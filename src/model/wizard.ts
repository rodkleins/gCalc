import { exampleInputs } from './example';
import type { Inputs } from './types';

export const WIZARD_STEPS = [
  {
    id: 'inicio',
    title: 'A loja',
    kicker: 'Quem é o caso',
    help: 'Loja nova ainda não comprou prateleiras: esse gasto pode sair do investimento. Loja existente já tem equipe e móveis: a rescisão e a revenda entram no caixa.',
  },
  {
    id: 'farmacia',
    title: 'Movimento',
    kicker: 'O tamanho da operação',
    help: 'O faturamento situa a loja. A margem transforma venda extra em resultado. As dispensações dizem se o robô dá conta do volume.',
  },
  {
    id: 'pessoas',
    title: 'Pessoas',
    kicker: 'Quem deixa de ser contratado',
    help: 'Conte só as vagas que deixam de existir com o robô, pelo custo completo. Turnover, recrutamento e treinamento não entram de novo se já estiverem nesse custo.',
  },
  {
    id: 'logistica',
    title: 'Espaço',
    kicker: 'O que a área liberada vale',
    help: 'O mesmo metro quadrado vale o aluguel que deixa de ser pago ou a margem de uma área de venda. Não os dois. Caixa do fornecedor só entra se o processo foi validado, no modo completo.',
  },
  {
    id: 'estoque',
    title: 'Estoque',
    kicker: 'Perdas e capital parado',
    help: 'Perda evitada é o que vencia ou quebrava menos o que ainda vence com o robô. A queda do estoque é caixa uma vez, não lucro todo mês.',
  },
  {
    id: 'investimento',
    title: 'O robô',
    kicker: 'Quanto custa ter e manter',
    help: 'O investimento líquido é o que se paga para instalar, menos prateleira evitada em loja nova. O custo mensal do robô sai do benefício. A taxa de desconto serve ao VPL, não ao ROI.',
  },
  {
    id: 'resumo',
    title: 'Resumo',
    kicker: 'Antes do dashboard',
    help: 'Estes números usam o cenário escolhido e as respostas desta conversa. O modo completo abre premissas que ficaram de fora, como financiamento, imposto e vendas sem evidência.',
  },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id'];

export function normalizeWizardStep(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return 0;
  if (value < 0 || value >= WIZARD_STEPS.length) return 0;
  return value;
}

export function wizardSeed(): Inputs {
  const inputs = exampleInputs();
  inputs.fictional = true;
  inputs.meta.clientName = '';
  inputs.meta.storeName = '';
  inputs.meta.preparedBy = '';
  inputs.meta.owner = '';
  inputs.meta.source = 'Sugestões editáveis do assistente. Não são parâmetros oficiais.';
  inputs.meta.notes = 'Números sugeridos a partir do exemplo fictício do escopo. Troque pelos dados da loja.';
  return inputs;
}

export function otherCapex(inputs: Inputs): number {
  const { equipment: _equipment, ...rest } = inputs.robot.capex;
  return Object.values(rest).reduce((total, value) => total + value, 0);
}

export function withOtherCapex(inputs: Inputs, value: number): Inputs {
  return {
    ...inputs,
    robot: {
      ...inputs.robot,
      capex: {
        equipment: inputs.robot.capex.equipment,
        freightImportTaxes: 0,
        installationTraining: 0,
        civilElectrical: 0,
        integration: 0,
        implementationContingency: value,
      },
    },
  };
}

export function totalOpex(inputs: Inputs): number {
  return Object.values(inputs.robot.opexMonthly).reduce((total, value) => total + value, 0);
}

export function withTotalOpex(inputs: Inputs, value: number): Inputs {
  return {
    ...inputs,
    robot: {
      ...inputs.robot,
      opexMonthly: {
        maintenance: value,
        software: 0,
        energy: 0,
        downtime: 0,
        insurance: 0,
        other: 0,
      },
    },
  };
}

export function validateWizardStep(step: number, inputs: Inputs): string | null {
  const id = WIZARD_STEPS[step]?.id;
  if (id === 'inicio') {
    if (!inputs.meta.storeName.trim()) return 'Dê um nome para a loja. Pode ser o da unidade.';
    return null;
  }
  if (id === 'farmacia') {
    if (!(inputs.profile.monthlyRevenue > 0)) return 'Informe o faturamento mensal. A sugestão pode ser editada.';
    if (inputs.profile.contributionMarginPct < 0 || inputs.profile.contributionMarginPct > 1) {
      return 'A margem de contribuição fica entre 0% e 100%.';
    }
    if (inputs.profile.dispensationsPerDay < 0) return 'Dispensações por dia não pode ser negativo.';
    return null;
  }
  if (id === 'pessoas') {
    if (inputs.people.payroll.enabled) {
      if (!(inputs.people.payroll.positionsReduced > 0)) return 'Informe quantas vagas o robô evita, ou desligue a economia de folha.';
      if (!(inputs.people.payroll.monthlyCostPerPosition > 0)) return 'Informe o custo completo mensal da vaga.';
    }
    if (inputs.people.turnover.annualRate < 0 || inputs.people.turnover.annualRate > 1) {
      return 'A taxa de turnover fica entre 0% e 100% ao ano.';
    }
    return null;
  }
  if (id === 'logistica') {
    if (inputs.logistics.space.enabled && !(inputs.logistics.space.m2Freed > 0)) {
      return 'Informe os m² liberados ou desligue o ganho de espaço.';
    }
    return null;
  }
  if (id === 'estoque') {
    if (inputs.profile.historicalLossesMonthly < 0 || inputs.stock.losses.projectedLossesMonthly < 0) {
      return 'Perdas não podem ser negativas.';
    }
    if (
      inputs.stock.losses.enabled &&
      inputs.stock.losses.projectedLossesMonthly > inputs.profile.historicalLossesMonthly
    ) {
      return 'As perdas com o robô estão maiores do que as atuais. Ajuste os dois números ou desligue esta economia.';
    }
    return null;
  }
  if (id === 'investimento') {
    const capex = inputs.robot.capex.equipment + otherCapex(inputs);
    if (capex < 0) return 'O investimento do robô não pode ser negativo.';
    if (totalOpex(inputs) < 0) return 'O custo mensal do robô não pode ser negativo.';
    if (inputs.robot.discountRateAnnual < 0 || inputs.robot.discountRateAnnual > 1) {
      return 'A taxa de desconto fica entre 0% e 100% ao ano.';
    }
    return null;
  }
  return null;
}
