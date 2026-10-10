import { formatBRL, formatNumber, formatPayback, formatPercent, scenarioLabel } from '../../model/format';
import { renderMarkdown } from '../../calculos/render';
import { RhPageNav, RhValidationNotice } from '../RhPageNav';
import { rhScorecard } from '../presets';
import conteudo from './conteudo.md?raw';

const { html, toc } = renderMarkdown(conteudo);

function people(value: number): string {
  return formatNumber(value, Math.abs(value - Math.round(value)) < 0.05 ? 0 : 1);
}

export function RhCalculosPage() {
  const rows = rhScorecard();
  return (
    <div className="doc">
      <nav className="doc-toc" aria-label="Índice">
        <p>Índice</p>
        {toc.map((item) => (
          <a key={item.id} className={item.level === 3 ? 'lvl3' : 'lvl2'} href={`#${item.id}`}>
            {item.text}
          </a>
        ))}
        <a className="lvl2" href="#resultados-dos-modelos">
          Resultados dos modelos
        </a>
      </nav>
      <article className="doc-body">
        <RhValidationNotice />
        <RhPageNav current="calculos" />
        <div data-testid="doc-content" dangerouslySetInnerHTML={{ __html: html }} />
        <h2 id="resultados-dos-modelos">Resultados dos modelos</h2>
        <p>
          Investimento líquido e VPL saem do cenário. O custo mensal desta tabela é o OPEX do robô já com o fator do
          cenário. A folha é a do quadro, antes do cenário. O payback não foi forçado.
        </p>
        <div className="table-wrap" data-testid="rh-scorecard">
          <table>
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Cenário</th>
                <th className="num">Investimento líquido</th>
                <th className="num">Custo mensal</th>
                <th className="num">Benefício líquido</th>
                <th className="num">Payback</th>
                <th className="num">ROI acumulado</th>
                <th className="num">VPL</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((row) =>
                row.cells.map((cell) => (
                  <tr key={`${row.id}-${cell.scenario}`} data-testid={`score-${row.id}-${cell.scenario}`}>
                    <td>{row.name}</td>
                    <td>{scenarioLabel(cell.scenario)}</td>
                    <td className="num">{formatBRL(cell.netInvestment)}</td>
                    <td className="num">{formatBRL(cell.monthlyOpex)}</td>
                    <td className="num">{formatBRL(cell.steadyNet)}</td>
                    <td className="num">{formatPayback(cell.payback)}</td>
                    <td className="num">{formatPercent(cell.cumulativeRoi)}</td>
                    <td className="num">{formatBRL(cell.npv)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <div className="table-wrap" data-testid="rh-people-card">
          <table>
            <thead>
              <tr>
                <th>Modelo</th>
                <th className="num">Turnos</th>
                <th className="num">Pessoas no turno</th>
                <th className="num">Contratadas</th>
                <th className="num">Folha</th>
                <th className="num">Vagas evitadas</th>
                <th className="num">Folha evitada</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td className="num">{row.shiftCount === 3 ? '3 (24h)' : '2'}</td>
                  <td className="num">{people(row.present)}</td>
                  <td className="num">{people(row.hired)}</td>
                  <td className="num">{formatBRL(row.payroll)}</td>
                  <td className="num">{people(row.avoidedHired)}</td>
                  <td className="num">{formatBRL(row.avoidedPayroll)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
