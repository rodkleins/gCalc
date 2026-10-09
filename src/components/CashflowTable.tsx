import { formatBRL } from '../model/format';
import type { ModelResult } from '../model/types';

export function CashflowTable({ result }: { result: ModelResult }) {
  return (
    <div className="stack">
      <p className="lede">
        Mês 0 é o investimento líquido de {formatBRL(result.netInvestment)}. Do mês 1 ao 60, o fluxo é o benefício
        operacional menos o OPEX, mais liberações de capital, revenda, rescisão e residual. A visão sem robô e com robô
        compara os custos que o projeto endereça.
      </p>
      <div className="table-wrap tall">
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th className="num">Sem robô</th>
              <th className="num">Com robô</th>
              <th className="num">Margem de venda</th>
              <th className="num">Líquido operacional</th>
              <th className="num">Caixa pontual</th>
              <th className="num">Fluxo incremental</th>
              <th className="num">Acumulado</th>
              <th className="num">Acumulado descontado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>0</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">{formatBRL(-result.netInvestment)}</td>
              <td className="num">{formatBRL(-result.netInvestment)}</td>
              <td className="num">{formatBRL(-result.netInvestment)}</td>
              <td className="num">{formatBRL(-result.netInvestment)}</td>
            </tr>
            {result.months.map((month) => (
              <tr key={month.month}>
                <td>{month.month}</td>
                <td className="num">{formatBRL(month.costWithout)}</td>
                <td className="num">{formatBRL(month.costWith)}</td>
                <td className="num">{formatBRL(month.salesMargin)}</td>
                <td className="num">{formatBRL(month.netOperating)}</td>
                <td className="num">{formatBRL(month.oneTime)}</td>
                <td className="num">{formatBRL(month.incremental)}</td>
                <td className={`num ${month.cumulative >= 0 ? 'good' : 'bad'}`}>{formatBRL(month.cumulative)}</td>
                <td className="num">{formatBRL(month.cumulativeDiscounted)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
