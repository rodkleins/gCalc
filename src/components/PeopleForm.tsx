import {
  BenefitCard,
  Callout,
  ExcludedReason,
  ModuleImpact,
  NumberField,
  PercentField,
  RemoveButton,
  RemoveField,
  SelectField,
  StageNote,
  Switch,
  TextField,
} from './Fields';
import { SUGGESTED_TRAINING_PER_HIRE } from '../model/example';
import type { Inputs, ModelResult } from '../model/types';

export function PeopleForm({
  inputs,
  result,
  onChange,
  advanced = true,
}: {
  inputs: Inputs;
  result: ModelResult;
  onChange: (inputs: Inputs) => void;
  advanced?: boolean;
}) {
  const people = inputs.people;
  const setPeople = (next: Inputs['people']) => onChange({ ...inputs, people: next });

  return (
    <div className="stack">
      <StageNote>
        Esta tela mede quanto de gente a loja deixa de pagar com o robô. O custo completo é R$ por pessoa por mês, com
        encargos e benefícios. Rescisão e contratação futura só valem em loja existente. Hora liberada não é economia de
        folha.
      </StageNote>
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
          fieldId="people.payroll.monthlyCostPerPosition"
          label="Custo completo por pessoa (R$/mês)"
          value={people.payroll.monthlyCostPerPosition}
          suffix="R$"
          hint="Por pessoa, por mês, já com encargos e benefícios. Não é o salário bruto."
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
          hint="Só loja existente. Em loja nova a vaga não chega a ser contratada, então a rescisão fica zerada."
          onChange={(severanceCost) => setPeople({ ...people, payroll: { ...people.payroll, severanceCost } })}
        />
        <ExcludedReason result={result} id="severance" />
        {advanced ? (
          <>
            <PercentField
              label="Encargos sobre o salário"
              value={people.payroll.chargesPct}
              hint="Some só se o custo da vaga ainda não for cheio."
              onChange={(chargesPct) => setPeople({ ...people, payroll: { ...people.payroll, chargesPct } })}
            />
            <NumberField
              label="Benefícios por vaga"
              value={people.payroll.benefitsPerPosition}
              suffix="R$"
              onChange={(benefitsPerPosition) =>
                setPeople({ ...people, payroll: { ...people.payroll, benefitsPerPosition } })
              }
            />
          </>
        ) : null}
      </BenefitCard>

      {advanced ? (
      <>
      <section className={`card benefit ${people.futureHires.enabled ? '' : 'is-off'}`}>
        <header className="benefit-head">
          <div>
            <h3>Contratações futuras evitadas</h3>
            <p>Só loja existente. Cada vaga começa no mês em que a loja sem robô precisaria abrir.</p>
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
        <ExcludedReason result={result} id="futureHires" />
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
                fieldId={index === 0 ? 'people.futureHires.monthlyCost' : undefined}
                label="Custo mensal"
                value={hire.monthlyCost}
                suffix="R$"
                onChange={(monthlyCost) => {
                  const hires = people.futureHires.hires.slice();
                  hires[index] = { ...hire, monthlyCost };
                  setPeople({ ...people, futureHires: { ...people.futureHires, hires } });
                }}
              />
              <RemoveField>
                <RemoveButton
                  testId={`remove-hire-${hire.id}`}
                  onRemove={() =>
                    setPeople({
                      ...people,
                      futureHires: {
                        ...people.futureHires,
                        hires: people.futureHires.hires.filter((item) => item.id !== hire.id),
                      },
                    })
                  }
                />
              </RemoveField>
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
          fieldId="people.recruitment.costPerHire"
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
          fieldId="people.training.costPerPerson"
          label="Treinamento por contratação"
          value={people.training.costPerPerson}
          suffix="R$"
          hint={`Sugestão fictícia: R$ ${SUGGESTED_TRAINING_PER_HIRE.toLocaleString('pt-BR')} por pessoa, a validar. Não entra de novo se já estiver no custo de substituição.`}
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
          fieldId="people.turnover.annualRate"
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
          fieldId="people.supervision.hoursSavedPerMonth"
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
          fieldId="people.consultativeSales.marginPerHour"
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
      <BenefitCard
        title="Horas realocadas"
        description="Não são economia de folha. Só entram no caixa com redução de custo ou ganho incremental demonstrável."
        enabled={people.reallocatedHours.enabled}
        confidence={people.reallocatedHours.confidence}
        onEnabled={(enabled) => setPeople({ ...people, reallocatedHours: { ...people.reallocatedHours, enabled } })}
        onConfidence={(confidence) =>
          setPeople({ ...people, reallocatedHours: { ...people.reallocatedHours, confidence } })
        }
      >
        <NumberField
          label="Horas por mês"
          value={people.reallocatedHours.hoursPerMonth}
          suffix="h"
          onChange={(hoursPerMonth) =>
            setPeople({ ...people, reallocatedHours: { ...people.reallocatedHours, hoursPerMonth } })
          }
        />
        <SelectField
          label="Monetização"
          value={people.reallocatedHours.monetization}
          onChange={(monetization) =>
            setPeople({
              ...people,
              reallocatedHours: {
                ...people.reallocatedHours,
                monetization: monetization as Inputs['people']['reallocatedHours']['monetization'],
              },
            })
          }
          options={[
            { value: 'nenhuma', label: 'Não monetizar' },
            { value: 'reducao_custo', label: 'Redução real de custo' },
            { value: 'ganho_incremental', label: 'Ganho incremental' },
          ]}
        />
        <NumberField
          label="Redução de custo"
          value={people.reallocatedHours.costReductionMonthly}
          suffix="R$/mês"
          onChange={(costReductionMonthly) =>
            setPeople({ ...people, reallocatedHours: { ...people.reallocatedHours, costReductionMonthly } })
          }
        />
        <NumberField
          label="Ganho incremental"
          value={people.reallocatedHours.incrementalMarginMonthly}
          suffix="R$/mês"
          onChange={(incrementalMarginMonthly) =>
            setPeople({ ...people, reallocatedHours: { ...people.reallocatedHours, incrementalMarginMonthly } })
          }
        />
      </BenefitCard>
      </>
      ) : (
        <Callout>
          Modo simples: a folha usa o custo informado. Contratações futuras, turnover detalhado e horas ficam no modo
          avançado e continuam valendo se já estavam preenchidos.
        </Callout>
      )}
    </div>
  );
}
