import { evaluate } from '../model/calculate';
import { exampleInputs } from '../model/example';
import { storePresets, type StorePreset } from '../model/presets';
import type { Inputs, ScenarioId } from '../model/types';
import { applyRoster, summarizeRoster, type Roster, type RosterPost, type ShiftCount } from './roster';

const RH_SENTENCE =
  'Versão em validação com quadro de RH por turno. O folguista sai da escala (6x1, 5x2 ou 12x36), com 30 dias de férias e 6 faltas em 365 dias. O adicional noturno sugerido é 10% e só vale no terceiro turno. Vagas evitadas, rescisão, turnover e contratação futura saem das posições que o robô libera, já com o folguista proporcional. Supervisão, movimentação, inventário e horas realocadas não entram de novo. Premissas fictícias, a validar.';

export interface RhPreset {
  id: 'exemplo' | StorePreset['id'];
  name: string;
  revenue: number;
  inputs: Inputs;
  roster: Roster;
}

function post(fields: Omit<RosterPost, 'coverageOverride' | 'future' | 'freed'> & Partial<Pick<RosterPost, 'coverageOverride' | 'future' | 'freed'>>): RosterPost {
  return {
    coverageOverride: null,
    future: [0, 0, 0],
    freed: [0, 0, 0],
    ...fields,
  };
}

function calendar(shiftCount: ShiftCount, posts: RosterPost[]): Roster {
  return {
    shiftCount,
    nightPremiumPct: 0.1,
    yearDays: 365,
    vacationDays: 30,
    absenceDays: 6,
    posts,
  };
}

/** Exemplo ilustrativo: 2 turnos, 1 balcão. O robô libera 1 auxiliar em cada turno. */
export function exampleRoster(): Roster {
  return calendar(2, [
    post({ id: 'farm', role: 'Farmacêutico', counter: 'Balcão 1', scale: '6x1', monthlyCost: 8_500, onDuty: [1, 1, 0] }),
    post({
      id: 'aux',
      role: 'Auxiliar de farmácia',
      counter: 'Balcão 1',
      scale: '6x1',
      monthlyCost: 4_200,
      onDuty: [2, 2, 0],
      freed: [1, 1, 0],
    }),
    post({ id: 'est', role: 'Estoquista', counter: 'Retaguarda', scale: '6x1', monthlyCost: 3_400, onDuty: [1, 0, 0] }),
    post({ id: 'ger', role: 'Gerente de loja', counter: 'Loja', scale: '5x2', monthlyCost: 9_500, onDuty: [1, 0, 0] }),
  ]);
}

function storeRoster(id: StorePreset['id']): Roster {
  if (id === 'loja-1m') {
    return calendar(2, [
      post({ id: 'farm', role: 'Farmacêutico', counter: 'Balcão 1', scale: '6x1', monthlyCost: 8_500, onDuty: [1, 1, 0] }),
      post({
        id: 'aux',
        role: 'Auxiliar de farmácia',
        counter: 'Balcão 1',
        scale: '6x1',
        monthlyCost: 4_200,
        onDuty: [2, 2, 0],
        freed: [1, 1, 0],
        future: [1, 0, 0],
      }),
      post({ id: 'est', role: 'Estoquista', counter: 'Retaguarda', scale: '6x1', monthlyCost: 3_400, onDuty: [1, 0, 0] }),
      post({ id: 'ger', role: 'Gerente de loja', counter: 'Loja', scale: '5x2', monthlyCost: 9_500, onDuty: [1, 0, 0] }),
    ]);
  }
  if (id === 'loja-2m') {
    return calendar(2, [
      post({ id: 'farm-1', role: 'Farmacêutico', counter: 'Balcão 1', scale: '6x1', monthlyCost: 8_500, onDuty: [1, 1, 0] }),
      post({ id: 'farm-2', role: 'Farmacêutico', counter: 'Balcão 2', scale: '6x1', monthlyCost: 8_500, onDuty: [1, 1, 0] }),
      post({
        id: 'aux-1',
        role: 'Auxiliar de farmácia',
        counter: 'Balcão 1',
        scale: '6x1',
        monthlyCost: 4_200,
        onDuty: [2, 2, 0],
        freed: [1, 1, 0],
        future: [1, 0, 0],
      }),
      post({
        id: 'aux-2',
        role: 'Auxiliar de farmácia',
        counter: 'Balcão 2',
        scale: '6x1',
        monthlyCost: 4_200,
        onDuty: [2, 2, 0],
        freed: [1, 1, 0],
        future: [0, 1, 0],
      }),
      post({ id: 'est', role: 'Estoquista', counter: 'Retaguarda', scale: '6x1', monthlyCost: 3_400, onDuty: [1, 1, 0] }),
      post({ id: 'ger', role: 'Gerente de loja', counter: 'Loja', scale: '5x2', monthlyCost: 9_500, onDuty: [1, 1, 0] }),
    ]);
  }
  return calendar(3, [
    post({ id: 'farm-1', role: 'Farmacêutico', counter: 'Balcão 1', scale: '6x1', monthlyCost: 8_500, onDuty: [1, 1, 0] }),
    post({ id: 'farm-2', role: 'Farmacêutico', counter: 'Balcão 2', scale: '6x1', monthlyCost: 8_500, onDuty: [1, 1, 0] }),
    post({ id: 'farm-3', role: 'Farmacêutico', counter: 'Balcão 3', scale: '6x1', monthlyCost: 8_500, onDuty: [1, 1, 0] }),
    post({ id: 'farm-noite', role: 'Farmacêutico', counter: 'Noite', scale: '12x36', monthlyCost: 8_500, onDuty: [0, 0, 2] }),
    post({
      id: 'aux-1',
      role: 'Auxiliar de farmácia',
      counter: 'Balcão 1',
      scale: '6x1',
      monthlyCost: 4_200,
      onDuty: [2, 2, 0],
      freed: [1, 1, 0],
      future: [1, 0, 0],
    }),
    post({
      id: 'aux-2',
      role: 'Auxiliar de farmácia',
      counter: 'Balcão 2',
      scale: '6x1',
      monthlyCost: 4_200,
      onDuty: [2, 2, 0],
      freed: [1, 1, 0],
      future: [0, 1, 0],
    }),
    post({
      id: 'aux-3',
      role: 'Auxiliar de farmácia',
      counter: 'Balcão 3',
      scale: '6x1',
      monthlyCost: 4_200,
      onDuty: [2, 2, 0],
      freed: [1, 1, 0],
      future: [0, 0, 0],
    }),
    post({
      id: 'aux-noite-1',
      role: 'Auxiliar de farmácia',
      counter: 'Balcão 1',
      scale: '12x36',
      monthlyCost: 4_200,
      onDuty: [0, 0, 2],
      freed: [0, 0, 1],
    }),
    post({
      id: 'aux-noite-2',
      role: 'Auxiliar de farmácia',
      counter: 'Balcão 2',
      scale: '12x36',
      monthlyCost: 4_200,
      onDuty: [0, 0, 2],
      freed: [0, 0, 1],
    }),
    post({
      id: 'aux-noite-3',
      role: 'Auxiliar de farmácia',
      counter: 'Balcão 3',
      scale: '12x36',
      monthlyCost: 4_200,
      onDuty: [0, 0, 2],
      freed: [0, 0, 1],
    }),
    post({ id: 'est', role: 'Estoquista', counter: 'Retaguarda', scale: '6x1', monthlyCost: 3_400, onDuty: [1, 1, 1] }),
    post({ id: 'ger', role: 'Gerente de loja', counter: 'Loja', scale: '5x2', monthlyCost: 9_500, onDuty: [1, 1, 1] }),
  ]);
}

function withNote(inputs: Inputs): Inputs {
  const next = structuredClone(inputs);
  next.fictional = true;
  next.meta.notes = `${next.meta.notes} ${RH_SENTENCE}`;
  next.meta.source = 'Quadro de RH em validação. Não é a calculadora publicada.';
  return next;
}

export function rhExample(): RhPreset {
  const roster = exampleRoster();
  return {
    id: 'exemplo',
    name: 'Exemplo fictício',
    revenue: exampleInputs().profile.monthlyRevenue,
    inputs: withNote(applyRoster(exampleInputs(), roster)),
    roster,
  };
}

export function rhStorePresets(): RhPreset[] {
  return storePresets().map((preset) => {
    const roster = storeRoster(preset.id);
    return {
      id: preset.id,
      name: preset.name,
      revenue: preset.revenue,
      inputs: withNote(applyRoster(preset.inputs, roster)),
      roster,
    };
  });
}

export function rhModels(): RhPreset[] {
  return [rhExample(), ...rhStorePresets()];
}

export interface RhScoreCell {
  scenario: ScenarioId;
  netInvestment: number;
  monthlyOpex: number;
  steadyNet: number;
  payback: number | null;
  cumulativeRoi: number | null;
  npv: number;
}

export interface RhScoreRow {
  id: RhPreset['id'];
  name: string;
  storeType: Inputs['profile']['storeType'];
  shiftCount: ShiftCount;
  present: number;
  hired: number;
  payroll: number;
  avoidedHired: number;
  avoidedPayroll: number;
  equipment: number;
  informedMonthlyCost: number;
  cells: RhScoreCell[];
}

export function rhScorecard(): RhScoreRow[] {
  const scenarios: ScenarioId[] = ['conservador', 'base', 'otimista'];
  return rhModels().map((model) => {
    const summary = summarizeRoster(model.roster);
    return {
      id: model.id,
      name: model.name,
      storeType: model.inputs.profile.storeType,
      shiftCount: model.roster.shiftCount,
      present: summary.present,
      hired: summary.hired,
      payroll: summary.payroll,
      avoidedHired: summary.avoidedHired,
      avoidedPayroll: summary.avoidedPayroll,
      equipment: model.inputs.robot.capex.equipment,
      informedMonthlyCost: Object.values(model.inputs.robot.opexMonthly).reduce((total, value) => total + value, 0),
      cells: scenarios.map((scenario) => {
        const result = evaluate(model.inputs, { scenario });
        return {
          scenario,
          netInvestment: result.netInvestment,
          monthlyOpex: result.monthlyOpex,
          steadyNet: result.steadyNet,
          payback: result.payback,
          cumulativeRoi: result.indicators.cumulativeRoi,
          npv: result.npv,
        };
      }),
    };
  });
}
