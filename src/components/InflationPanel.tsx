import { evaluate } from '../model/calculate';
import { formatBRL, formatPayback, formatPercent } from '../model/format';
import {
  DEFAULT_INFLATION,
  FOCUS_IPCA,
  FOCUS_SOURCE_TEXT,
  HIGH_INFLATION_SHOCK,
  OPEX_SOURCE_TEXT,
  WAGE_SOURCE_TEXT,
  inflationWarning,
  switchMoneyBasis,
  withInflationShock,
} from '../model/inflation';
import type { Inputs, MoneyBasis, ScenarioId } from '../model/types';
import { Callout, PercentField } from './Fields';

function SourceLine({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <p className="hint-block inflation-source" data-testid={testId}>
      {children}
    </p>
  );
}

/** Bloco “Inflação” da calculadora raiz. Aparece nos modos simples e avançado. */
export function InflationPanel({ inputs, onChange }: { inputs: Inputs; onChange: (inputs: Inputs) => void }) {
  const profile = inputs.profile;
  const basis = profile.moneyBasis;
  const isReal = basis === 'real';
  const setProfile = (partial: Partial<Inputs['profile']>) => onChange({ ...inputs, profile: { ...profile, ...partial } });
  const warning = inflationWarning(inputs);

  return (
    <section className="card inflation-card" data-testid="inflation-panel">
      <h2>Inflação</h2>
      <p className="lede">
        Reajustes anuais aplicados mês a mês ao fluxo. Salários corrigem folha, turnover e horas. O IPCA corrige perdas,
        margens e custo financeiro. O reajuste de OPEX corrige o custo mensal do robô e a manutenção evitada.
      </p>
      <div className="seg" role="group" aria-label="Base monetária" data-testid="money-basis">
        {(
          [
            ['nominal', 'Nominal (com inflação)'],
            ['real', 'Real (moeda constante)'],
          ] as Array<[MoneyBasis, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-testid={`money-basis-${id}`}
            aria-pressed={basis === id}
            className={basis === id ? 'is-active' : ''}
            onClick={() => onChange(switchMoneyBasis(inputs, id))}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="hint-block" data-testid="inflation-discount-note">
        {isReal
          ? `Base real: reajustes zerados e taxa de desconto real de ${formatPercent(inputs.robot.discountRateAnnual, 2)} ao ano, convertida pela equação de Fisher: (1 + nominal) ÷ (1 + IPCA) − 1.`
          : `Base nominal: os reajustes abaixo entram no fluxo e o VPL usa a taxa nominal de ${formatPercent(inputs.robot.discountRateAnnual)} ao ano.`}
      </p>
      <div className="form-grid">
        <div>
          <PercentField
            fieldId="profile.priceInflationPctPerYear"
            testId="inflation-ipca"
            label="IPCA (preços)"
            value={profile.priceInflationPctPerYear}
            onChange={(priceInflationPctPerYear) => setProfile({ priceInflationPctPerYear })}
            help="Inflação anual de preços. Corrige perdas, margens de venda e custo financeiro do estoque."
          />
          <SourceLine testId="inflation-ipca-source">
            Padrão {formatPercent(DEFAULT_INFLATION.priceInflationPctPerYear, 2)}. Fonte: {FOCUS_SOURCE_TEXT}{' '}
            <a href={FOCUS_IPCA.reportUrl} target="_blank" rel="noreferrer">
              Relatório Focus
            </a>
          </SourceLine>
        </div>
        <div>
          <PercentField
            fieldId="profile.wageGrowthPctPerYear"
            testId="inflation-wage"
            label="Reajuste salarial"
            value={profile.wageGrowthPctPerYear}
            onChange={(wageGrowthPctPerYear) => setProfile({ wageGrowthPctPerYear })}
            help="Reajuste anual da folha. Corrige a economia de vagas, contratações futuras, turnover e horas."
          />
          <SourceLine testId="inflation-wage-source">
            Padrão {formatPercent(DEFAULT_INFLATION.wageGrowthPctPerYear, 2)}. {WAGE_SOURCE_TEXT}
          </SourceLine>
        </div>
        <div>
          <PercentField
            fieldId="profile.opexInflationPctPerYear"
            testId="inflation-opex"
            label="Reajuste de OPEX"
            value={profile.opexInflationPctPerYear}
            onChange={(opexInflationPctPerYear) => setProfile({ opexInflationPctPerYear })}
            help="Reajuste anual do custo mensal do robô (suporte, energia, outros) e da manutenção de prateleira evitada."
          />
          <SourceLine testId="inflation-opex-source">
            Padrão {formatPercent(DEFAULT_INFLATION.opexInflationPctPerYear, 2)}. {OPEX_SOURCE_TEXT}
          </SourceLine>
        </div>
      </div>
      {warning ? (
        <div data-testid="inflation-warning">
          <Callout tone="warn">{warning}</Callout>
        </div>
      ) : null}
    </section>
  );
}

/** Linha de estresse “Inflação alta (IPCA +3 p.p.)” para a tela de sensibilidade da raiz. */
export function InflationStress({ inputs, scenario }: { inputs: Inputs; scenario: ScenarioId }) {
  const current = evaluate(inputs, { scenario, skipNetwork: true });
  const stressed = evaluate(withInflationShock(inputs), { scenario, skipNetwork: true });
  const points = Math.round(HIGH_INFLATION_SHOCK * 100);
  return (
    <section className="card" data-testid="inflation-stress">
      <h2>Inflação alta (IPCA +{points} p.p.)</h2>
      <p className="lede">
        IPCA, reajuste salarial e reajuste de OPEX sobem {points} pontos ao ano. A taxa de desconto fica como está.
      </p>
      <div className="table-wrap short">
        <table>
          <thead>
            <tr>
              <th>Caso</th>
              <th className="num">IPCA</th>
              <th className="num">Payback</th>
              <th className="num">VPL</th>
              <th className="num">Líquido no mês 60</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Premissas atuais</td>
              <td className="num">{formatPercent(inputs.profile.priceInflationPctPerYear, 2)}</td>
              <td className="num">{formatPayback(current.payback)}</td>
              <td className="num">{formatBRL(current.npv)}</td>
              <td className="num">{formatBRL(current.steadyNet)}</td>
            </tr>
            <tr data-testid="inflation-stress-row">
              <td>Inflação alta (IPCA +{points} p.p.)</td>
              <td className="num">{formatPercent(inputs.profile.priceInflationPctPerYear + HIGH_INFLATION_SHOCK, 2)}</td>
              <td className="num">{formatPayback(stressed.payback)}</td>
              <td className="num">{formatBRL(stressed.npv)}</td>
              <td className="num">{formatBRL(stressed.steadyNet)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
