import { storePresets, type StorePreset } from './presets';
import { withDefaultInflation } from './inflation';
import type { Inputs } from './types';

/**
 * Portes da calculadora raiz (/). Partem dos modelos compartilhados e trocam só o que é da raiz:
 * inflação do Focus em base nominal e, na loja de R$ 2 milhões, perdas no nível da simulação DPSP.
 * /rh/, /dpsp/ e /calculos/ continuam usando storePresets() sem estas mudanças.
 */
export const ROOT_LOSSES_2M = { historical: 6_600, projected: 2_000 } as const;

const ROOT_NOTE =
  ' Inflação: IPCA e OPEX em 4,34% ao ano (Boletim Focus do Banco Central, mediana de 2027, pesquisa de 23/10/2026) e salários em 5,34% (IPCA + 1 p.p., premissa).';

const LOSSES_NOTE =
  ' Perdas: R$ 6.600/mês hoje e R$ 2.000/mês com o robô, nível da simulação DPSP (o valor anterior, R$ 28.000, estava alto para a loja).';

/** Valor residual padrão da raiz: 30% do valor contábil no mês 60. */
export const ROOT_RESIDUAL_PCT_OF_BOOK = 0.3;

const GUARD_NOTE =
  ' Movimentação e inventário começam desligados: com o corte de folha, as horas podem ser das mesmas vagas (dupla contagem).';

const RESIDUAL_NOTE =
  ' Valor residual no mês 60: 30% do valor contábil (investimento líquido dos créditos menos a depreciação acumulada).';

/**
 * Trava de dupla contagem da raiz. Vale para tudo o que a raiz calcula (presets, rascunho, simulações
 * salvas e importadas). Não muda nada além de logistics.requireCashPath.
 */
export function withRootGuards(inputs: Inputs): Inputs {
  if (inputs.logistics.requireCashPath) return inputs;
  return { ...inputs, logistics: { ...inputs.logistics, requireCashPath: true } };
}

/** Padrões fiscais e de residual dos portes da raiz. Benefício fiscal desligado no caso base. */
export function withRootDefaults(source: Inputs): Inputs {
  const inputs = withRootGuards(structuredClone(source));
  const payrollCut = inputs.people.payroll.enabled && inputs.people.payroll.positionsReduced > 0;
  if (payrollCut) {
    inputs.logistics.movement = { ...inputs.logistics.movement, enabled: false };
    inputs.logistics.inventoryCount = { ...inputs.logistics.inventoryCount, enabled: false };
  }
  inputs.robot = {
    ...inputs.robot,
    residualMode: 'pct_contabil',
    residualPctOfBook: ROOT_RESIDUAL_PCT_OF_BOOK,
    includeTax: false,
    taxPolicy: 'sem_impostos',
    taxRate: 0.34,
    depreciationYears: 10,
  };
  inputs.meta = { ...inputs.meta, notes: inputs.meta.notes + (payrollCut ? GUARD_NOTE : '') + RESIDUAL_NOTE };
  return inputs;
}

export function rootStorePresets(): StorePreset[] {
  return storePresets().map((preset) => {
    const inputs = withRootDefaults(withDefaultInflation(preset.inputs));
    inputs.meta = { ...inputs.meta, notes: inputs.meta.notes + ROOT_NOTE };
    if (preset.id === 'loja-2m') {
      inputs.profile = { ...inputs.profile, historicalLossesMonthly: ROOT_LOSSES_2M.historical };
      inputs.stock = {
        ...inputs.stock,
        losses: { ...inputs.stock.losses, projectedLossesMonthly: ROOT_LOSSES_2M.projected },
      };
      inputs.meta = { ...inputs.meta, notes: inputs.meta.notes + LOSSES_NOTE };
    }
    return { ...preset, inputs };
  });
}

/** Porte que a calculadora raiz abre quando não há simulação salva neste navegador. */
export function rootDefaultStorePreset(): StorePreset {
  const preset = rootStorePresets().find((item) => item.id === 'loja-2m');
  if (!preset) throw new Error('Loja de R$ 2 milhões ausente.');
  return preset;
}
