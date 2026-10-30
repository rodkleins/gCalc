import { formatBRL, formatIrr, formatPayback, formatPercent } from '../model/format';
import {
  TAX_SHIELD_NOTE,
  depreciationFigures,
  fiscalSensitivityRows,
  withTaxShield,
  withoutTax,
  type TaxShieldMode,
} from '../model/rootFiscal';
import { evaluate } from '../model/calculate';
import type { Inputs, ModelResult, ResidualMode, ScenarioId } from '../model/types';
import { Callout, NumberField, PercentField, ReadOnlyField, Switch } from './Fields';

/** Bloco “Benefício fiscal da depreciação (lucro real)” e “Valor residual no mês 60” da calculadora raiz. */
export function RootFiscalPanel({
  inputs,
  result,
  onChange,
}: {
  inputs: Inputs;
  result: ModelResult;
  onChange: (inputs: Inputs) => void;
}) {
  const robot = inputs.robot;
  const setRobot = (partial: Partial<Inputs['robot']>) => onChange({ ...inputs, robot: { ...robot, ...partial } });
  const on = robot.includeTax;
  const mode: TaxShieldMode = robot.taxPolicy === 'escudo_depreciacao' ? 'escudo_depreciacao' : 'incremental_simplificado';
  const dep = depreciationFigures(inputs, result);
  const residualMode: ResidualMode = robot.residualMode ?? 'fixo';
  const residual = result.residual;
  const month60 = result.months[result.months.length - 1]?.residual ?? 0;
  const off = on ? evaluate(withoutTax(inputs), { scenario: result.scenario, skipNetwork: true }) : result;
  const shield = on
    ? result
    : evaluate(withTaxShield(inputs, 'escudo_depreciacao'), { scenario: result.scenario, skipNetwork: true });

  return (
    <>
      <section className="card" data-testid="tax-shield-panel">
        <header className="benefit-head">
          <div>
            <h2>Benefício fiscal da depreciação (lucro real)</h2>
            <p>A depreciação do robô reduz IR e CSLL de quem apura lucro real. Desligado no caso base.</p>
          </div>
          <Switch
            checked={on}
            onChange={(checked) =>
              setRobot(
                checked
                  ? { includeTax: true, taxPolicy: robot.taxPolicy === 'sem_impostos' ? 'escudo_depreciacao' : robot.taxPolicy }
                  : { includeTax: false, taxPolicy: 'sem_impostos' },
              )
            }
            label={on ? 'Ligado' : 'Desligado'}
            help="Liga o escudo fiscal da depreciação no fluxo de caixa."
          />
        </header>
        <div className="seg" role="group" aria-label="Modo do benefício fiscal" data-testid="tax-shield-mode">
          {(
            [
              ['escudo_depreciacao', 'Só escudo da depreciação'],
              ['incremental_simplificado', 'Lucro real completo (tributa também a economia)'],
            ] as Array<[TaxShieldMode, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-testid={`tax-shield-mode-${id}`}
              aria-pressed={on && mode === id}
              className={on && mode === id ? 'is-active' : ''}
              disabled={!on}
              onClick={() => setRobot({ includeTax: true, taxPolicy: id })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <PercentField
            testId="tax-shield-rate"
            label="Alíquota IR + CSLL"
            value={robot.taxRate}
            hint="Padrão 34% (IRPJ 25% + CSLL 9%)."
            noEffect={on ? undefined : 'Só muda o caixa com o benefício ligado.'}
            onChange={(taxRate) => setRobot({ taxRate })}
          />
          <NumberField
            testId="tax-shield-years"
            label="Vida para depreciação"
            value={robot.depreciationYears}
            suffix="anos"
            min={1}
            hint="Padrão 10 anos. Também define o valor contábil do residual."
            noEffect={
              on || residualMode === 'pct_contabil'
                ? undefined
                : 'Com o benefício fiscal desligado e residual em valor fixo, o prazo não muda o caixa.'
            }
            onChange={(depreciationYears) => setRobot({ depreciationYears })}
          />
          <ReadOnlyField
            testId="tax-shield-base"
            label="Base depreciável"
            value={formatBRL(dep.base)}
            hint="Investimento líquido: CAPEX menos créditos de impostos recuperáveis (e CAPEX evitado). O crédito não deprecia de novo."
          />
          <ReadOnlyField
            testId="tax-shield-monthly"
            label="Escudo por mês"
            value={formatBRL(dep.shieldMonthly)}
            hint={`${formatBRL(dep.monthly)} de depreciação por mês × ${formatPercent(robot.taxRate)}.`}
          />
        </div>
        <p className="hint-block" data-testid="tax-shield-effect">
          Sem benefício: payback {formatPayback(off.payback)}, VPL {formatBRL(off.npv)}, TIR {formatIrr(off.irrAnnual)}. Só
          escudo: payback {formatPayback(shield.payback)}, VPL {formatBRL(shield.npv)}, TIR {formatIrr(shield.irrAnnual)}.
          {on && mode === 'incremental_simplificado'
            ? ` Lucro real completo (atual): payback ${formatPayback(result.payback)}, VPL ${formatBRL(result.npv)}. Este modo também tributa a economia do robô.`
            : ''}
        </p>
        <div data-testid="tax-shield-note">
          <Callout tone="warn">{TAX_SHIELD_NOTE}</Callout>
        </div>
      </section>

      <section className="card" data-testid="residual-panel">
        <h2>Valor residual no mês 60</h2>
        <p className="lede">
          O que o robô ainda vale no fim do horizonte. Entra como caixa no mês 60. O payback só muda se acontecer no mês
          60; VPL e TIR mudam.
        </p>
        <div className="seg" role="group" aria-label="Modo do valor residual" data-testid="residual-mode">
          {(
            [
              ['pct_contabil', '% do valor contábil'],
              ['fixo', 'Valor fixo'],
            ] as Array<[ResidualMode, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-testid={`residual-mode-${id}`}
              aria-pressed={residualMode === id}
              className={residualMode === id ? 'is-active' : ''}
              onClick={() =>
                setRobot(
                  id === 'pct_contabil'
                    ? { residualMode: id, residualPctOfBook: robot.residualPctOfBook ?? 0.3 }
                    : { residualMode: id },
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          {residualMode === 'pct_contabil' ? (
            <PercentField
              testId="residual-pct"
              label="% do valor contábil"
              value={robot.residualPctOfBook ?? 0}
              hint="Padrão 30%: desconto conservador sobre o valor contábil."
              onChange={(residualPctOfBook) => setRobot({ residualPctOfBook })}
            />
          ) : (
            <NumberField
              testId="residual-fixed"
              label="Valor residual no mês 60"
              value={robot.residualValue}
              suffix="R$"
              onChange={(residualValue) => setRobot({ residualValue })}
            />
          )}
          <ReadOnlyField
            testId="residual-book"
            label="Valor contábil no mês 60"
            value={formatBRL(residual?.book ?? 0)}
            hint={`Base depreciável menos a depreciação de ${robot.depreciationYears} anos acumulada até o mês 60.`}
          />
          <ReadOnlyField
            testId="residual-value"
            label="Valor residual no mês 60"
            value={formatBRL(residual?.gross ?? 0)}
            hint={month60 !== (residual?.gross ?? 0) ? `No caixa: ${formatBRL(month60)}, depois do imposto sobre ganho ou perda.` : undefined}
          />
        </div>
      </section>
    </>
  );
}

/** Linhas de sensibilidade de benefício fiscal e valor residual (raiz). */
export function FiscalSensitivity({ inputs, scenario }: { inputs: Inputs; scenario: ScenarioId }) {
  const rows = fiscalSensitivityRows(inputs, scenario);
  return (
    <section className="card" data-testid="fiscal-sensitivity">
      <h2>Benefício fiscal e valor residual</h2>
      <p className="lede">
        O benefício fiscal só vale no lucro real e precisa de validação fiscal. O valor residual entra no mês 60.
      </p>
      <div className="table-wrap short">
        <table>
          <thead>
            <tr>
              <th>Caso</th>
              <th className="num">Payback</th>
              <th className="num">VPL</th>
              <th className="num">TIR</th>
              <th className="num">Caixa no mês 60</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-testid={`fiscal-row-${row.id}`}>
                <td>{row.label}</td>
                <td className="num">{formatPayback(row.payback)}</td>
                <td className="num">{formatBRL(row.npv)}</td>
                <td className="num">{formatIrr(row.irr)}</td>
                <td className="num">{formatBRL(row.cash60)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
