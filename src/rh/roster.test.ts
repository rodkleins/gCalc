import { describe, expect, it } from 'vitest';
import { evaluate } from '../model/calculate';
import { blankInputs } from '../model/example';
import { round2 } from '../model/round';
import {
  applyRoster,
  coverageMemory,
  suggestedCoverageFactor,
  summarizeRoster,
  type Roster,
  type RosterPost,
} from './roster';

const CALENDAR = { yearDays: 365, vacationDays: 30, absenceDays: 6 };
const AVAILABLE = 365 - 30 - 6;

function factor61(): number {
  return (7 / 6) * (365 / AVAILABLE);
}

function factor52(): number {
  return (7 / 5) * (365 / AVAILABLE);
}

function factor1236(): number {
  return 2 * (365 / AVAILABLE);
}

function post(overrides: Partial<RosterPost> = {}): RosterPost {
  return {
    id: 'aux',
    role: 'Auxiliar de farmácia',
    counter: 'Balcão 1',
    scale: '6x1',
    monthlyCost: 4_200,
    onDuty: [2, 2, 0],
    freed: [1, 1, 0],
    future: [1, 0, 0],
    coverageOverride: null,
    ...overrides,
  };
}

function roster(overrides: Partial<Roster> = {}, posts: RosterPost[] = [post()]): Roster {
  return {
    shiftCount: 2,
    nightPremiumPct: 0.1,
    ...CALENDAR,
    posts,
    ...overrides,
  };
}

describe('folguista por escala', () => {
  it('calcula 6x1, 5x2 e 12x36 à mão com 365 dias, 30 de férias e 6 faltas', () => {
    expect(suggestedCoverageFactor('6x1', CALENDAR)).toBeCloseTo(2555 / 1974, 12);
    expect(suggestedCoverageFactor('5x2', CALENDAR)).toBeCloseTo(2555 / 1645, 12);
    expect(suggestedCoverageFactor('12x36', CALENDAR)).toBeCloseTo(730 / 329, 12);
    expect(factor61()).toBeCloseTo(1.294326241, 8);
    expect(factor52()).toBeCloseTo(1.553191489, 8);
    expect(factor1236()).toBeCloseTo(2.218844985, 8);
    expect(factor1236()).not.toBeCloseTo(365 / (365 * (12 / 48) - 36), 1);
  });

  it('sem férias nem faltas o 6x1 fica em 7/6, o 5x2 em 7/5 e o 12x36 em 2', () => {
    const clear = { yearDays: 365, vacationDays: 0, absenceDays: 0 };
    expect(suggestedCoverageFactor('6x1', clear)).toBeCloseTo(7 / 6, 12);
    expect(suggestedCoverageFactor('5x2', clear)).toBeCloseTo(7 / 5, 12);
    expect(suggestedCoverageFactor('12x36', clear)).toBe(2);
    expect(suggestedCoverageFactor('12x36', clear)).not.toBeCloseTo(12 / 8, 5);
    expect(suggestedCoverageFactor('12x36', clear)).not.toBeCloseTo(48 / 12, 5);
  });

  it('mostra a memória: pessoas da escala vezes 365/(365−30−6)', () => {
    const memory = coverageMemory('12x36', CALENDAR);
    expect(memory.peoplePerSeat).toBe(2);
    expect(memory.peoplePerSeatLabel).toBe('2');
    expect(memory.availableDays).toBe(329);
    expect(memory.calendarFactor).toBeCloseTo(365 / 329, 12);
    expect(memory.suggested).toBeCloseTo(2 * (365 / 329), 12);
    expect(memory.folguista).toBeCloseTo(memory.suggested - 1, 12);
    expect(memory.scaleMeaning).toContain('um dia');
    expect(memory.scaleMeaning).toContain('12/48');
    expect(coverageMemory('6x1', CALENDAR).peoplePerSeatLabel).toBe('7/6');
    expect(coverageMemory('5x2', CALENDAR).peoplePerSeat).toBeCloseTo(7 / 5, 12);
  });

  it('zera o fator quando férias e faltas cobrem o ano', () => {
    expect(suggestedCoverageFactor('6x1', { yearDays: 365, vacationDays: 400, absenceDays: 0 })).toBe(0);
    expect(suggestedCoverageFactor('12x36', { yearDays: 365, vacationDays: 300, absenceDays: 65 })).toBe(0);
  });
});

describe('vagas evitadas a partir do quadro', () => {
  it('referencia à mão o 6x1: duas posições liberadas, folguista proporcional e futuro no turno 1', () => {
    const summary = summarizeRoster(roster());
    const factor = factor61();
    expect(summary.shifts).toHaveLength(2);
    expect(summary.shifts[0].present).toBe(2);
    expect(summary.shifts[0].freedPresent).toBe(1);
    expect(summary.shifts[0].folguista).toBeCloseTo(2 * (factor - 1), 8);
    expect(summary.avoidedHired).toBeCloseTo(2 * factor, 8);
    expect(summary.avoidedPayroll).toBeCloseTo(2 * factor * 4_200, 6);
    expect(summary.futureHired).toBeCloseTo(factor, 8);
    expect(summary.futurePayroll).toBeCloseTo(factor * 4_200, 6);
    expect(summary.severance).toBeCloseTo(summary.avoidedPayroll, 8);
    expect(summary.payroll).toBeCloseTo(4 * factor * 4_200, 6);
  });

  it('ignora o turno da noite e o adicional quando a loja tem 2 turnos', () => {
    const summary = summarizeRoster(
      roster({ shiftCount: 2, nightPremiumPct: 0.5 }, [post({ onDuty: [1, 0, 4], freed: [1, 0, 4], future: [0, 0, 3] })]),
    );
    expect(summary.shifts).toHaveLength(2);
    expect(summary.avoidedHired).toBeCloseTo(factor61(), 8);
    expect(summary.avoidedPayroll).toBeCloseTo(factor61() * 4_200, 6);
    expect(summary.futureHired).toBe(0);
  });

  it('aplica o adicional noturno só no terceiro turno e o fator 12x36', () => {
    const summary = summarizeRoster(
      roster({ shiftCount: 3, nightPremiumPct: 0.1 }, [
        post({
          scale: '12x36',
          onDuty: [0, 0, 1],
          freed: [0, 0, 1],
          future: [0, 0, 1],
        }),
      ]),
    );
    const factor = factor1236();
    expect(summary.shifts[2].present).toBe(1);
    expect(summary.avoidedHired).toBeCloseTo(factor, 8);
    expect(summary.avoidedPayroll).toBeCloseTo(factor * 4_200 * 1.1, 6);
    expect(summary.futurePayroll).toBeCloseTo(factor * 4_200 * 1.1, 6);
    expect(summary.severance).toBeCloseTo(summary.avoidedPayroll, 8);
    expect(summary.shifts[0].payroll).toBe(0);
  });

  it('o 5x2 de um gerente sem vaga liberada entra na folha e não na rescisão', () => {
    const summary = summarizeRoster(
      roster({}, [post({ scale: '5x2', monthlyCost: 9_500, onDuty: [1, 0, 0], freed: [0, 0, 0], future: [0, 0, 0] })]),
    );
    expect(summary.payroll).toBeCloseTo(factor52() * 9_500, 6);
    expect(summary.folguista).toBeCloseTo(factor52() - 1, 8);
    expect(summary.avoidedPayroll).toBe(0);
    expect(summary.severance).toBe(0);
  });

  it('a sobrescrita troca o fator sugerido e não deixa liberar mais gente do que está no turno', () => {
    const summary = summarizeRoster(
      roster({}, [post({ onDuty: [1, 0, 0], freed: [3, 0, 0], future: [0, 0, 0], coverageOverride: 1.5 })]),
    );
    expect(summary.shifts[0].freedPresent).toBe(1);
    expect(summary.avoidedHired).toBeCloseTo(1.5, 8);
    expect(summary.avoidedPayroll).toBeCloseTo(1.5 * 4_200, 6);
    expect(summary.hired).toBeCloseTo(1.5, 8);
  });
});

describe('projeção no motor', () => {
  it('folha, rescisão, turnover e contratação futura batem com a conta manual', () => {
    const factor = factor61();
    const avoidedHired = 2 * factor;
    const avoidedPayroll = avoidedHired * 4_200;
    const futureHired = factor;
    const futurePayroll = futureHired * 4_200;
    const opened = avoidedHired + futureHired;
    const turnover = (opened * 0.3 * 8_000) / 12;
    const inputs = blankInputs();
    inputs.profile.storeType = 'existente';
    inputs.people.payroll.enabled = true;
    inputs.people.turnover.enabled = true;
    inputs.people.turnover.annualRate = 0.3;
    inputs.people.turnover.costPerReplacement = 8_000;
    inputs.people.supervision.enabled = true;
    inputs.people.supervision.hoursSavedPerMonth = 20;
    inputs.logistics.movement.enabled = true;
    inputs.logistics.movement.hoursSavedPerMonth = 20;
    inputs.logistics.inventoryCount.enabled = true;
    inputs.logistics.inventoryCount.hoursSavedPerMonth = 10;
    inputs.people.reallocatedHours.enabled = true;
    inputs.people.reallocatedHours.hoursPerMonth = 15;
    inputs.people.reallocatedHours.monetization = 'reducao_custo';
    inputs.people.reallocatedHours.costReductionMonthly = 500;
    const applied = applyRoster(inputs, roster());
    const result = evaluate(applied, { scenario: 'base' });
    const line = (id: string) => result.audit.find((item) => item.id === id);

    expect(applied.people.payroll.positionsReduced).toBeCloseTo(avoidedHired, 8);
    expect(applied.people.payroll.severanceCost).toBeCloseTo(avoidedPayroll, 6);
    expect(applied.people.supervision.enabled).toBe(false);
    expect(applied.people.supervision.alreadyCountedInPayroll).toBe(true);
    expect(applied.logistics.movement.enabled).toBe(false);
    expect(applied.logistics.movement.alreadyCountedInPayroll).toBe(true);
    expect(applied.logistics.inventoryCount.enabled).toBe(false);
    expect(applied.logistics.inventoryCount.hoursSavedPerMonth).toBe(0);
    expect(applied.people.reallocatedHours.enabled).toBe(false);
    expect(applied.people.reallocatedHours.hoursPerMonth).toBe(0);
    expect(line('payroll')?.monthlyValue).toBeCloseTo(round2(avoidedPayroll), 2);
    expect(line('futureHires')?.monthlyValue).toBeCloseTo(round2(futurePayroll), 2);
    expect(line('turnover')?.monthlyValue).toBeCloseTo(round2(turnover), 2);
    expect(line('severance')?.oneTimeValue).toBeCloseTo(avoidedPayroll, 2);
    expect(line('supervision')?.includedInCashFlow).toBe(false);
    expect(line('movement')?.includedInCashFlow).toBe(false);
    expect(line('inventoryCount')?.includedInCashFlow).toBe(false);
    expect(line('supervision')?.monthlyValue).toBe(0);
    expect(line('movement')?.monthlyValue).toBe(0);
    expect(line('inventoryCount')?.monthlyValue).toBe(0);
  });
});
