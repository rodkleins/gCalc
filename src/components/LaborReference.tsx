import { formatNumber } from '../model/format';
import { laborReference } from '../model/laborReference';
import type { Inputs } from '../model/types';

export function LaborReferenceNote({ inputs }: { inputs: Inputs }) {
  const reference = laborReference(inputs);
  const hoursDigits = Math.abs(reference.hoursPerMonth - Math.round(reference.hoursPerMonth)) < 0.05 ? 0 : 1;
  return (
    <p className="span-2 labor-reference" data-testid="labor-reference">
      Referência de mão de obra, fora do caixa. 1 minuto por unidade para receber, conferir, guardar e buscar para
      despachar. {formatNumber(reference.dispensationsPerDay)} dispensações por dia × 30 × 1 min ={' '}
      {formatNumber(reference.hoursPerMonth, hoursDigits)} horas/mês. Na jornada de{' '}
      {formatNumber(reference.journeyHoursPerMonth)} horas por pessoa, isso equivale a{' '}
      {formatNumber(reference.people, 2)} pessoas. Com a cobertura de folguista da escala 6x1 (fator{' '}
      {formatNumber(reference.coverageFactor, 4)}), {formatNumber(reference.peopleWithCoverage, 2)} pessoas. Não soma às
      vagas evitadas.
    </p>
  );
}
