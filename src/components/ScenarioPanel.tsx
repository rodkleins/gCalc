import { evaluate } from '../model/calculate';
import { formatBRL, formatPayback, formatPercent, scenarioLabel } from '../model/format';
import type { Inputs, ScenarioId } from '../model/types';
import { PercentField, StageNote } from './Fields';

const ORDER: ScenarioId[] = ['conservador', 'base', 'otimista'];

export function ScenarioPanel({
  inputs,
  scenario,
  onScenario,
  onChange,
}: {
  inputs: Inputs;
  scenario: ScenarioId;
  onScenario: (scenario: ScenarioId) => void;
  onChange: (inputs: Inputs) => void;
}) {
  return (
    <div className="stack">
      <StageNote>
        Esta tela mostra o mesmo caso com premissas mais duras ou mais favoráveis. O cenário base é o número que você
        defendeu. Conservador e otimista só mudam os fatores, para ver se o payback ainda se sustenta.
      </StageNote>
      <p className="lede">
        O fator de benefício multiplica ganhos operacionais. Vendas têm um fator extra. CAPEX e OPEX têm fatores próprios.
        O exemplo do escopo corresponde ao cenário base, com todos os fatores em 100%.
      </p>
      <div className="scenario-grid">
        {ORDER.map((id) => {
          const factors = inputs.scenarios[id];
          const result = evaluate(inputs, { scenario: id });
          const update = (partial: Partial<typeof factors>) =>
            onChange({ ...inputs, scenarios: { ...inputs.scenarios, [id]: { ...factors, ...partial } } });
          return (
            <section key={id} className={`card ${id === scenario ? 'is-active' : ''}`}>
              <header className="benefit-head">
                <h2>{scenarioLabel(id)}</h2>
                <button type="button" className="btn" onClick={() => onScenario(id)}>
                  {id === scenario ? 'Em uso' : 'Usar'}
                </button>
              </header>
              <div className="stack tight">
                <PercentField label="Benefícios" help="Percentual aplicado aos ganhos operacionais deste cenário. 100% é o caso base. Não altera o que foi digitado nos módulos." value={factors.benefitFactor} onChange={(benefitFactor) => update({ benefitFactor })} />
                <PercentField label="Vendas" help="Percentual extra sobre as margens de venda deste cenário. 100% repete a venda digitada. Multiplica só a margem incremental." value={factors.salesFactor} onChange={(salesFactor) => update({ salesFactor })} />
                <PercentField label="OPEX" help="Percentual do custo mensal do robô neste cenário. 100% usa o OPEX digitado. O otimista pode exibir um valor abaixo do piso digitado." value={factors.opexFactor} onChange={(opexFactor) => update({ opexFactor })} />
                <PercentField label="CAPEX" help="Percentual do investimento neste cenário. 100% usa o CAPEX digitado, inclusive prateleira evitada. Entra no investimento líquido do cenário." value={factors.capexFactor} onChange={(capexFactor) => update({ capexFactor })} />
              </div>
              <dl className="mini-metrics">
                <div>
                  <dt>Líquido</dt>
                  <dd>{formatBRL(result.steadyNet)}/mês</dd>
                </div>
                <div>
                  <dt>Payback</dt>
                  <dd>{formatPayback(result.payback)}</dd>
                </div>
                <div>
                  <dt>ROI</dt>
                  <dd>{formatPercent(result.roi)}</dd>
                </div>
                <div>
                  <dt>VPL</dt>
                  <dd>{formatBRL(result.npv)}</dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
