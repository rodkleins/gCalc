import { BenefitCard, Callout, ModuleImpact, NumberField, PercentField, SelectField, Switch, TextField } from './Fields';
import type { Inputs, ModelResult } from '../model/types';

export function PeopleForm({
  inputs,
  result,
  onChange,
}: {
  inputs: Inputs;
  result: ModelResult;
  onChange: (inputs: Inputs) => void;
}) {
  const people = inputs.people;
  const setPeople = (next: Inputs['people']) => onChange({ ...inputs, people: next });

  return (
    <div className="stack">
      <ModuleImpact result={result} module="Pessoas" />
      <Callout>
        A vaga só economiza a partir do mês em que existiria sem o robô. Treinamento e recrutamento não entram de novo
        quando já estão no custo de substituição. Hora liberada só vira venda com evidência independente.
      </Callout>

      <BenefitCard
        title="Folha e encargos"
        description="Posições que deixam de existir em relação ao quadro sem robô."
        enabled={people.payroll.enabled}
        confidence={people.payroll.confidence}
        onEnabled={(enabled) => setPeople({ ...people, payroll: { ...people.payroll, enabled } })}
        onConfidence={(confidence) => setPeople({ ...people, payroll: { ...people.payroll, confidence } })}
      >
        <NumberField
          label="Vagas evitadas"
          value={people.payroll.positionsReduced}
          min={0}
          onChange={(positionsReduced) => setPeople({ ...people, payroll: { ...people.payroll, positionsReduced } })}
        />
        <NumberField
          label="Custo completo por vaga"
          value={people.payroll.monthlyCostPerPosition}
          suffix="R$"
          onChange={(monthlyCostPerPosition) =>
            setPeople({ ...people, payroll: { ...people.payroll, monthlyCostPerPosition } })
          }
        />
        <NumberField
          label="Mês em que a economia começa"
          value={people.payroll.startMonth}
          min={1}
          suffix="mês"
          hint="No mês 1 para loja que já nasce sem a vaga. Mais tarde se a redução for gradual."
          onChange={(startMonth) => setPeople({ ...people, payroll: { ...people.payroll, startMonth } })}
        />
        <NumberField
          label="Rescisão"
          value={people.payroll.severanceCost}
          suffix="R$"
          hint="Entra uma vez, e somente em loja existente."
          onChange={(severanceCost) => setPeople({ ...people, payroll: { ...people.payroll, severanceCost } })}
        />
      </BenefitCard>

      <section className={`card benefit ${people.futureHires.enabled ? '' : 'is-off'}`}>
        <header className="benefit-head">
          <div>
            <h3>Contratações futuras evitadas</h3>
            <p>Cada vaga começa no mês em que a loja sem robô precisaria abrir.</p>
          </div>
          <Switch
            checked={people.futureHires.enabled}
            onChange={(enabled) => setPeople({ ...people, futureHires: { ...people.futureHires, enabled } })}
            label={people.futureHires.enabled ? 'Ativo' : 'Inativo'}
          />
        </header>
        <SelectField
          label="Confiança"
          value={people.futureHires.confidence}
          onChange={(confidence) =>
            setPeople({
              ...people,
              futureHires: { ...people.futureHires, confidence: confidence as Inputs['people']['futureHires']['confidence'] },
            })
          }
          options={[
            { value: 'comprovavel', label: 'Comprovável' },
            { value: 'potencial', label: 'Potencial' },
          ]}
        />
        <div className="rows">
          {people.futureHires.hires.map((hire, index) => (
            <div className="row-card" key={hire.id}>
              <TextField
                label="Cargo"
                value={hire.role}
                onChange={(role) => {
                  const hires = people.futureHires.hires.slice();
                  hires[index] = { ...hire, role };
                  setPeople({ ...people, futureHires: { ...people.futureHires, hires } });
                }}
              />
              <NumberField
                label="Mês"
                value={hire.month}
                min={1}
                onChange={(month) => {
                  const hires = people.futureHires.hires.slice();
                  hires[index] = { ...hire, month };
                  setPeople({ ...people, futureHires: { ...people.futureHires, hires } });
                }}
              />
              <NumberField
                label="Vagas"
                value={hire.headcount}
                min={0}
                onChange={(headcount) => {
                  const hires = people.futureHires.hires.slice();
                  hires[index] = { ...hire, headcount };
                  setPeople({ ...people, futureHires: { ...people.futureHires, hires } });
                }}
              />
              <NumberField
                label="Custo mensal"
                value={hire.monthlyCost}
                suffix="R$"
                onChange={(monthlyCost) => {
                  const hires = people.futureHires.hires.slice();
                  hires[index] = { ...hire, monthlyCost };
                  setPeople({ ...people, futureHires: { ...people.futureHires, hires } });
                }}
              />
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  setPeople({
                    ...people,
                    futureHires: {
                      ...people.futureHires,
                      hires: people.futureHires.hires.filter((item) => item.id !== hire.id),
                    },
                  })
                }
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn"
          onClick={() =>
            setPeople({
              ...people,
              futureHires: {
                ...people.futureHires,
                hires: [
                  ...people.futureHires.hires,
                  { id: crypto.randomUUID(), role: 'Auxiliar', month: 13, headcount: 1, monthlyCost: 0 },
                ],
              },
            })
          }
        >
          Adicionar contratação evitada
        </button>
      </section>

      <BenefitCard
        title="Recrutamento e seleção"
        description="Custo pontual das vagas que deixam de ser abertas."
        enabled={people.recruitment.enabled}
        confidence={people.recruitment.confidence}
        onEnabled={(enabled) => setPeople({ ...people, recruitment: { ...people.recruitment, enabled } })}
        onConfidence={(confidence) => setPeople({ ...people, recruitment: { ...people.recruitment, confidence } })}
      >
        <NumberField
          label="Custo por contratação"
          value={people.recruitment.costPerHire}
          suffix="R$"
          onChange={(costPerHire) => setPeople({ ...people, recruitment: { ...people.recruitment, costPerHire } })}
        />
        <label className="field check span-2">
          <input
            type="checkbox"
            checked={people.recruitment.includedInTurnoverCost}
            onChange={(event) =>
              setPeople({
                ...people,
                recruitment: { ...people.recruitment, includedInTurnoverCost: event.target.checked },
              })
            }
          />
          <span>Este custo já está dentro do custo por substituição do turnover</span>
        </label>
      </BenefitCard>

      <BenefitCard
        title="Treinamento e integração"
        description="Só das vagas que não serão abertas. Em loja existente, o quadro atual já foi treinado."
        enabled={people.training.enabled}
        confidence={people.training.confidence}
        onEnabled={(enabled) => setPeople({ ...people, training: { ...people.training, enabled } })}
        onConfidence={(confidence) => setPeople({ ...people, training: { ...people.training, confidence } })}
      >
        <NumberField
          label="Custo por pessoa"
          value={people.training.costPerPerson}
          suffix="R$"
          onChange={(costPerPerson) => setPeople({ ...people, training: { ...people.training, costPerPerson } })}
        />
        <label className="field check span-2">
          <input
            type="checkbox"
            checked={people.training.includedInReplacementCost}
            onChange={(event) =>
              setPeople({
                ...people,
                training: { ...people.training, includedInReplacementCost: event.target.checked },
              })
            }
          />
          <span>Treinamento inicial já está no custo por substituição</span>
        </label>
      </BenefitCard>

      <BenefitCard
        title="Turnover evitado"
        description="Substituições que deixam de ocorrer nas vagas que não existem mais."
        enabled={people.turnover.enabled}
        confidence={people.turnover.confidence}
        onEnabled={(enabled) => setPeople({ ...people, turnover: { ...people.turnover, enabled } })}
        onConfidence={(confidence) => setPeople({ ...people, turnover: { ...people.turnover, confidence } })}
      >
        <PercentField
          label="Taxa anual de turnover"
          value={people.turnover.annualRate}
          onChange={(annualRate) => setPeople({ ...people, turnover: { ...people.turnover, annualRate } })}
        />
        <NumberField
          label="Custo médio por substituição"
          value={people.turnover.costPerReplacement}
          suffix="R$"
          hint="Pode incluir recrutamento, exames, treinamento, supervisor, adaptação e desligamento."
          onChange={(costPerReplacement) =>
            setPeople({ ...people, turnover: { ...people.turnover, costPerReplacement } })
          }
        />
      </BenefitCard>

      <BenefitCard
        title="Supervisão, escala e ausências"
        description="Horas de quem continua na loja. Não use horas de cargos já eliminados na folha."
        enabled={people.supervision.enabled}
        confidence={people.supervision.confidence}
        onEnabled={(enabled) => setPeople({ ...people, supervision: { ...people.supervision, enabled } })}
        onConfidence={(confidence) => setPeople({ ...people, supervision: { ...people.supervision, confidence } })}
      >
        <NumberField
          label="Horas economizadas por mês"
          value={people.supervision.hoursSavedPerMonth}
          suffix="h"
          onChange={(hoursSavedPerMonth) =>
            setPeople({ ...people, supervision: { ...people.supervision, hoursSavedPerMonth } })
          }
        />
        <NumberField
          label="Custo da hora"
          value={people.supervision.costPerHour}
          suffix="R$"
          onChange={(costPerHour) => setPeople({ ...people, supervision: { ...people.supervision, costPerHour } })}
        />
        <label className="field check span-2">
          <input
            type="checkbox"
            checked={people.supervision.alreadyCountedInPayroll}
            onChange={(event) =>
              setPeople({
                ...people,
                supervision: { ...people.supervision, alreadyCountedInPayroll: event.target.checked },
              })
            }
          />
          <span>Estas horas já foram retiradas na redução de folha</span>
        </label>
      </BenefitCard>

      <BenefitCard
        title="Venda consultiva"
        description="Horas liberadas para atendimento. Ficam de fora sem evidência própria de venda."
        enabled={people.consultativeSales.enabled}
        confidence={people.consultativeSales.confidence}
        onEnabled={(enabled) => setPeople({ ...people, consultativeSales: { ...people.consultativeSales, enabled } })}
        onConfidence={(confidence) =>
          setPeople({ ...people, consultativeSales: { ...people.consultativeSales, confidence } })
        }
      >
        <NumberField
          label="Horas liberadas por mês"
          value={people.consultativeSales.hoursFreedPerMonth}
          suffix="h"
          onChange={(hoursFreedPerMonth) =>
            setPeople({ ...people, consultativeSales: { ...people.consultativeSales, hoursFreedPerMonth } })
          }
        />
        <NumberField
          label="Margem por hora"
          value={people.consultativeSales.marginPerHour}
          suffix="R$"
          onChange={(marginPerHour) =>
            setPeople({ ...people, consultativeSales: { ...people.consultativeSales, marginPerHour } })
          }
        />
        <label className="field check span-2">
          <input
            type="checkbox"
            checked={people.consultativeSales.independentEvidence}
            onChange={(event) =>
              setPeople({
                ...people,
                consultativeSales: { ...people.consultativeSales, independentEvidence: event.target.checked },
              })
            }
          />
          <span>Há evidência independente de que estas horas geram margem adicional</span>
        </label>
      </BenefitCard>
    </div>
  );
}
