import { formatBRL, formatNumber, formatPercent } from '../model/format';
import { coverageFactor, shiftName, summarizeRoster, type Roster } from './roster';

function people(value: number): string {
  return formatNumber(value, Number.isInteger(value) ? 0 : 2);
}

export function RosterPrint({ roster }: { roster: Roster }) {
  const summary = summarizeRoster(roster);
  const shifts = Array.from({ length: roster.shiftCount }, (_, index) => index);
  return (
    <section className="print-chapter" data-testid="print-roster">
      <h2>Quadro por turno</h2>
      <p className="print-note">
        Cada linha é um cargo. O fator do folguista é calculado pela escala, pelas férias e pelas faltas. A posição que o robô
        libera aceita fração e o folguista sai proporcional. Adicional noturno {formatPercent(roster.nightPremiumPct)} ={' '}
        {formatNumber(roster.nightPremiumPct, 1).replace('.', ',')} no JSON. Ele só multiplica o turno da noite, e só com 3
        turnos.
      </p>
      <table className="print-table">
        <thead>
          <tr>
            <th>Cargo</th>
            <th>Balcão</th>
            <th>Escala</th>
            <th className="num">R$/mês</th>
            {shifts.map((index) => (
              <th key={`p-${index}`} className="num">
                {shiftName(index, roster.shiftCount)}
              </th>
            ))}
            <th className="num">Fator</th>
            <th className="num">Folguista</th>
            {shifts.map((index) => (
              <th key={`f-${index}`} className="num">
                Evita {shiftName(index, roster.shiftCount).replace('Turno ', '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roster.posts.map((post) => {
            const factor = coverageFactor(post, roster);
            let present = 0;
            let hired = 0;
            for (const index of shifts) {
              const seats = Math.max(0, post.onDuty[index] ?? 0);
              present += seats;
              hired += seats * factor;
            }
            return (
              <tr key={post.id}>
                <td>{post.role || 'Cargo'}</td>
                <td>{post.counter}</td>
                <td>{post.scale}</td>
                <td className="num">{formatNumber(post.monthlyCost)}</td>
                {shifts.map((index) => (
                  <td key={`p-${index}`} className="num">
                    {people(post.onDuty[index] ?? 0)}
                  </td>
                ))}
                <td className="num">{formatNumber(factor, 4)}</td>
                <td className="num">{people(Math.max(0, hired - present))}</td>
                {shifts.map((index) => (
                  <td key={`f-${index}`} className="num">
                    {people(Math.min(Math.max(0, post.freed[index] ?? 0), Math.max(0, post.onDuty[index] ?? 0)))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td />
            <td />
            <td />
            {summary.shifts.map((shift, index) => (
              <td key={`t-${index}`} className="num">
                {people(shift.present)}
              </td>
            ))}
            <td />
            <td className="num">{people(summary.folguista)}</td>
            {summary.shifts.map((shift, index) => (
              <td key={`e-${index}`} className="num">
                {people(shift.freedPresent)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <p className="print-note">
        Pessoas no turno {people(summary.present)}. Contratadas {people(summary.hired)}. Folha {formatBRL(summary.payroll)}.
        Folha evitada {formatBRL(summary.avoidedPayroll)} por mês.
      </p>
    </section>
  );
}
