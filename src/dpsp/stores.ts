import { SUGGESTED_PHARMACIST_MONTHLY_COST } from '../model/example';
import { formatBRL, formatNumber } from '../model/format';
import { defaultStorePreset } from '../model/presets';
import { round2 } from '../model/round';
import type { EmployeeRole, Inputs } from '../model/types';

export const DPSP_BANNER = 'Dados DPSP (planilha de 29/10/2026) + premissas do modelo a validar';
export const DPSP_SHEET_DATE = '2026-10-29';

/** O mesmo aviso do relatório impresso da calculadora publicada. */
export const MODEL_DISCLAIMER = 'Premissas a validar. Não é parâmetro oficial nem resultado de uma loja real.';

export interface DpspFact {
  id: 'dpsp-327' | 'dpsp-267' | 'dpsp-27';
  code: number;
  name: string;
  skus: number;
  /** QTDE_VOLUME da planilha. Contexto da loja; não entra no payback. */
  volume: number;
  headcount: number;
  balconistas: number;
  /** Perdas mensais como vieram na planilha, antes do arredondamento em centavos. */
  lossesMonthly: number;
  /** Fração, não pontos. 0,196% ≈ 0,00196. */
  lossPct: number;
}

export interface DpspPreset {
  id: DpspFact['id'];
  name: string;
  revenue: number;
  fact: DpspFact;
  inputs: Inputs;
}

const FACTS: DpspFact[] = [
  {
    id: 'dpsp-327',
    code: 327,
    name: '327 DSP Fradique Coutinho',
    skus: 11_055,
    volume: 20_800,
    headcount: 31,
    balconistas: 9,
    lossesMonthly: 4445.92086666667,
    lossPct: 1.9550570870926526e-3,
  },
  {
    id: 'dpsp-267',
    code: 267,
    name: '267 DSP João Cachoeira',
    skus: 10_689,
    volume: 20_387,
    headcount: 23,
    balconistas: 6,
    lossesMonthly: 6973.548899999997,
    lossPct: 2.4366069151564211e-3,
  },
  {
    id: 'dpsp-27',
    code: 27,
    name: '27 DSP Paulista',
    skus: 11_655,
    volume: 20_962,
    headcount: 32,
    balconistas: 8,
    lossesMonthly: 4776.1412888888844,
    lossPct: 2.0385192724916164e-3,
  },
];

function roleOf(inputs: Inputs, id: string): EmployeeRole {
  const role = inputs.profile.roles.find((item) => item.id === id);
  if (!role) throw new Error(`Cargo ${id} ausente no modelo de R$ 2 milhões.`);
  return structuredClone(role);
}

function sheetNotes(fact: DpspFact, losses: number, revenue: number): string {
  const pct = formatNumber(fact.lossPct * 100, 3);
  return [
    `Planilha DPSP de 29/10/2026: faturamento = perdas ÷ % de perda (${formatBRL(losses, 2)} ÷ ${pct}% = ${formatBRL(revenue, 2)}).`,
    `Também da planilha: ${formatNumber(fact.skus)} SKUs, HC ${fact.headcount} (dos quais ${fact.balconistas} balconistas) e volume ${formatNumber(fact.volume)}. O volume não entra no payback.`,
    'O restante é a loja de R$ 2 milhões do modelo, a validar: CAPEX, salários, 6 vagas de balconista reduzidas, horas de supervisão, movimentação e inventário (entram no payback), perdas projetadas e dispensações por dia.',
    'O HC que não é balconista nem farmacêutico, estoquista ou gerente do modelo fica em Demais colaboradores, no custo do auxiliar.',
    'As perdas projetadas do modelo superam as da planilha, então a economia de perdas começa zerada até esse número ser ajustado.',
  ].join(' ');
}

function withSheet(fact: DpspFact): DpspPreset {
  const inputs = structuredClone(defaultStorePreset().inputs);
  const losses = round2(fact.lossesMonthly);
  const revenue = round2(fact.lossesMonthly / fact.lossPct);
  const pharmacist = roleOf(inputs, 'farm');
  const stock = roleOf(inputs, 'est');
  const manager = roleOf(inputs, 'ger');
  const auxiliary = roleOf(inputs, 'aux');
  const named = pharmacist.headcount + stock.headcount + manager.headcount;
  const demais = fact.headcount - fact.balconistas - named;
  if (demais < 0) throw new Error(`HC de ${fact.name} não cobre balconistas e os cargos do modelo.`);
  pharmacist.monthlyCost = SUGGESTED_PHARMACIST_MONTHLY_COST;
  inputs.fictional = false;
  inputs.meta = {
    clientName: 'DPSP',
    storeName: fact.name,
    preparedBy: 'Planilha DPSP',
    premiseDate: DPSP_SHEET_DATE,
    source: 'Planilha de lojas de 29/10/2026. O restante é a loja de R$ 2 milhões do modelo, a validar.',
    owner: 'A validar',
    notes: sheetNotes(fact, losses, revenue),
  };
  inputs.profile.monthlyRevenue = revenue;
  inputs.profile.skuCount = fact.skus;
  inputs.profile.historicalLossesMonthly = losses;
  inputs.profile.roles = [
    {
      id: 'balconista',
      role: 'Balconista',
      headcount: fact.balconistas,
      monthlyCost: auxiliary.monthlyCost,
      shift: auxiliary.shift,
    },
    pharmacist,
    stock,
    manager,
    {
      id: 'demais',
      role: 'Demais colaboradores',
      headcount: demais,
      monthlyCost: auxiliary.monthlyCost,
      shift: 'Quadro da planilha sem cargo informado',
    },
  ];
  inputs.people.futureHires.hires = inputs.people.futureHires.hires.map((hire) => ({
    ...hire,
    role: 'Balconista',
  }));
  return { id: fact.id, name: fact.name, revenue, fact, inputs };
}

export function dpspPresets(): DpspPreset[] {
  return FACTS.map(withSheet);
}

export function defaultDpspPreset(): DpspPreset {
  const preset = dpspPresets().find((item) => item.id === 'dpsp-327');
  if (!preset) throw new Error('Loja 327 DSP Fradique Coutinho ausente.');
  return preset;
}

export function dpspPresetByName(name: string): DpspPreset | null {
  return dpspPresets().find((item) => item.name === name) ?? null;
}
