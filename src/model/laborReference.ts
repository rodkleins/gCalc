import { suggestedCoverageFactor } from '../rh/roster';
import { formatNumber } from './format';
import type { Inputs } from './types';

/** Minuto fixo por unidade: receber, conferir, guardar e separar. Não é campo. */
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

function looseDigits(value: number): number {
  if (Math.abs(value - Math.round(value)) < 0.05) return 0;
  if (Math.abs(value * 10 - Math.round(value * 10)) < 0.05) return 1;
  return 2;
}

/** Texto da referência de mercado. Não cita o fator nem o nome da escala. */
export function marketReferenceText(inputs: Inputs): string {
  const reference = laborReference(inputs);
  return `Receber, conferir, guardar e separar cada unidade leva cerca de 1 minuto. Com ${formatNumber(reference.dispensationsPerDay, looseDigits(reference.dispensationsPerDay))} unidades por dia, são ${formatNumber(reference.hoursPerMonth, looseDigits(reference.hoursPerMonth))} horas de trabalho por mês: ${formatNumber(reference.people, 2)} pessoas na jornada de ${formatNumber(reference.journeyHoursPerMonth, looseDigits(reference.journeyHoursPerMonth))} horas, ou ${formatNumber(reference.peopleWithCoverage, 2)} pessoas contando folgas e férias. A referência ajuda a validar as vagas evitadas, mas não soma ao resultado.`;
}
