import { suggestedCoverageFactor } from '../rh/roster';
import type { Inputs } from './types';

/** Minuto fixo por unidade: receber, conferir, guardar e buscar para despachar. Não é campo. */
export const MINUTES_PER_UNIT = 1;

export interface LaborReference {
  minutesPerUnit: number;
  dispensationsPerDay: number;
  hoursPerMonth: number;
  journeyHoursPerMonth: number;
  people: number;
  coverageFactor: number;
  peopleWithCoverage: number;
}

/** Horas e pessoas de referência. Não entra no benefício e não altera o payback. */
export function laborReference(inputs: Inputs): LaborReference {
  const dispensationsPerDay = Math.max(0, inputs.profile.dispensationsPerDay);
  const hoursPerMonth = (dispensationsPerDay * 30 * MINUTES_PER_UNIT) / 60;
  const journeyHoursPerMonth = Math.max(1, inputs.people.journeyHoursPerMonth || 176);
  const coverageFactor = suggestedCoverageFactor('6x1', {
    yearDays: 365,
    vacationDays: 30,
    absenceDays: 6,
  });
  const people = hoursPerMonth / journeyHoursPerMonth;
  return {
    minutesPerUnit: MINUTES_PER_UNIT,
    dispensationsPerDay,
    hoursPerMonth,
    journeyHoursPerMonth,
    people,
    coverageFactor,
    peopleWithCoverage: people * coverageFactor,
  };
}
