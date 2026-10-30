import { storePresets, type StorePreset } from './presets';
import { withDefaultInflation } from './inflation';

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

export function rootStorePresets(): StorePreset[] {
  return storePresets().map((preset) => {
    const inputs = withDefaultInflation(preset.inputs);
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
