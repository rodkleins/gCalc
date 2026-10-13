import { formatNumber } from '../model/format';
import { marketReferenceText } from '../model/laborReference';
import type { Inputs } from '../model/types';

export function VacanciesReference({ inputs, titleTag = 'h2' }: { inputs: Inputs; titleTag?: 'h2' | 'h3' }) {
  const Title = titleTag;
  const positions = formatNumber(inputs.people.payroll.positionsReduced, 2);
  return (
    <div className="span-2 vacancies-block" data-testid="vacancies-reference">
      <Title>Vagas evitadas: {positions} pessoas</Title>
      <p className="lede">Este é o número usado no cálculo da economia com folha.</p>
      <h4>Referência de mercado</h4>
      <p data-testid="labor-reference">{marketReferenceText(inputs)}</p>
    </div>
  );
}
