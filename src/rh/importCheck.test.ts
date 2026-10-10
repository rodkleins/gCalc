import { describe, expect, it } from 'vitest';
import { storePresets } from '../model/presets';
import { RH_KIND, RH_STORAGE_VERSION, importRhPayload } from './storage';
import { rhModels } from './presets';
import { summarizeRoster } from './roster';

function payload(model: ReturnType<typeof rhModels>[number]) {
  return {
    kind: RH_KIND,
    version: RH_STORAGE_VERSION,
    simulations: [
      {
        id: model.id,
        name: model.name,
        savedAt: '2026-10-10T00:00:00.000Z',
        inputs: model.inputs,
        roster: model.roster,
        scenario: 'base' as const,
        section: 'pessoas' as const,
      },
    ],
  };
}

describe('JSON do quadro de RH', () => {
  it('exporta a loja de R$ 4 milhões com postos liberados, adicional de 10% e instalação de R$ 50.000', () => {
    const model = rhModels().find((item) => item.id === 'loja-4m');
    if (!model) throw new Error('loja-4m');
    const root = storePresets().find((item) => item.id === 'loja-4m');
    if (!root) throw new Error('raiz');
    expect(model.roster.posts.every((post) => post.freed.every((value) => value === 0))).toBe(false);
    expect(model.roster.nightPremiumPct).toBe(0.1);
    expect(model.inputs.robot.capex.installationTraining).toBe(50_000);
    expect(model.inputs.robot.capex.civilElectrical).toBe(50_000);
    expect(model.inputs.robot.capex.equipment).toBe(root.inputs.robot.capex.equipment);
    expect(model.inputs.robot.capex.equipment).toBe(1_850_000);
    expect(model.inputs.people.payroll.chargesPct).toBe(0);
    expect(model.inputs.people.payroll.positionsReduced).toBeCloseTo(summarizeRoster(model.roster).avoidedHired, 8);
    expect(model.inputs.people.payroll.positionsReduced).toBeGreaterThan(0);
    const imported = importRhPayload(payload(model));
    expect(imported?.warnings).toEqual([]);
    const night = imported?.simulations[0]?.roster.posts.find((post) => post.id === 'aux-noite-1');
    expect(night?.freed).toEqual([0, 0, 1]);
    expect(night?.role).toBe('Auxiliar noturno');
    expect(imported?.simulations[0]?.inputs.people.payroll.positionsReduced).toBeGreaterThan(0);
    expect(imported?.simulations[0]?.roster.nightPremiumPct).toBe(0.1);
  });

  it('alerta posto liberado zero, adicional 1 e perfil sem o mesmo fator de encargos', () => {
    const model = rhModels().find((item) => item.id === 'loja-4m');
    if (!model) throw new Error('loja-4m');
    const roster = structuredClone(model.roster);
    roster.nightPremiumPct = 1;
    for (const post of roster.posts) post.freed = [0, 0, 0];
    const day = roster.posts.find((post) => post.id === 'aux-1');
    if (!day) throw new Error('aux');
    day.monthlyCost = 6_200;
    roster.posts.push({ ...day, id: 'aux-1b', monthlyCost: 4_200 });
    const gerente = roster.posts.find((post) => post.id === 'ger');
    if (!gerente) throw new Error('ger');
    gerente.monthlyCost = 15_200;
    const inputs = structuredClone(model.inputs);
    inputs.people.payroll.positionsReduced = 0;
    inputs.people.payroll.chargesPct = 0;
    inputs.profile.roles = [
      { id: 'aux', role: 'Auxiliar de farmácia', headcount: 12, monthlyCost: 4_200 * 1.3333, shift: '6x1' },
      { id: 'ger', role: 'Gerente de loja', headcount: 3, monthlyCost: 15_200, shift: '5x2' },
    ];
    const imported = importRhPayload({
      kind: RH_KIND,
      version: RH_STORAGE_VERSION,
      simulations: [
        {
          id: 'loja-4m',
          name: 'Loja de R$ 4 milhões/mês',
          savedAt: '2026-10-10T00:00:00.000Z',
          inputs,
          roster,
          scenario: 'base',
          section: 'pessoas',
        },
      ],
    });
    const warnings = imported?.warnings.join('\n') ?? '';
    expect(warnings).toContain('Nenhum posto liberado');
    expect(warnings).toContain('100%');
    expect(warnings).toContain('0,10');
    expect(warnings).toContain('1,3333');
    expect(warnings).toContain('Perfil e quadro divergem');
    expect(warnings).toContain('Há mais de um custo');
    expect(imported?.simulations[0]?.roster.posts.find((post) => post.id === 'aux-noite-1')?.freed).toEqual([0, 0, 0]);
  });

  it('deixa a instalação em R$ 50.000 em todos os modelos, sem fator de 1,05 no equipamento', () => {
    for (const model of rhModels()) {
      expect(model.inputs.robot.capex.installationTraining).toBe(50_000);
      expect(model.inputs.robot.capex.civilElectrical).toBe(50_000);
      expect(model.roster.nightPremiumPct).toBe(0.1);
      expect(model.inputs.robot.capex.equipment % 1_000).toBe(0);
    }
    expect(rhModels().map((model) => model.inputs.robot.capex.equipment)).toEqual([1_000_000, 1_000_000, 1_350_000, 1_850_000]);
  });
});
