import {
  BenefitCard,
  Callout,
  CheckField,
  ExcludedReason,
  ModuleImpact,
  NumberField,
  PercentField,
  RemoveButton,
  RemoveField,
  SelectField,
  StageNote,
  TextField,
  editCard,
} from './Fields';
import { SUGGESTED_TRAINING_PER_HIRE } from '../model/example';
import { VacanciesReference } from './LaborReference';
import type { Inputs, ModelResult } from '../model/types';

const ROLE_NOTE = 'O nome do cargo identifica a linha. O caixa usa o mês, as vagas e o custo.';
const TURNOVER_HELP =
  'Substituições que deixam de ocorrer nas vagas que o robô evita. A conta é vagas expostas × taxa anual × custo por substituição. Recrutamento e treinamento marcados como já inclusos não entram de novo.';
const IN_TURNOVER_HELP =
  'Ligado, este custo já está dentro do custo por substituição e fica fora do caixa. Desligado, ele entra à parte e pode contar o mesmo real duas vezes.';

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
      <PayrollCard inputs={inputs} result={result} onChange={onChange} advanced={advanced} />
      {advanced ? (
        <>
          <FutureHiresCard inputs={inputs} result={result} onChange={onChange} />
          <TurnoverPanel inputs={inputs} result={result} onChange={onChange} />
          <SupervisionCard inputs={inputs} result={result} onChange={onChange} />
          <ConsultativeCard inputs={inputs} result={result} onChange={onChange} />
          <ReallocatedCard inputs={inputs} result={result} onChange={onChange} />
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

/** Recrutamento, treinamento e turnover. A versão de RH mostra só este bloco, debaixo do quadro. */
export function TurnoverPanel({
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
    <div className="stack" data-testid="turnover-panel">
      <BenefitCard
        title="Recrutamento e seleção"
        description="Custo pontual das vagas que deixam de ser abertas."
        enabled={people.recruitment.enabled}
        confidence={people.recruitment.confidence}
        result={result}
        auditIds={['recruitment']}
        onEnabled={(enabled) => setPeople({ ...people, recruitment: { ...people.recruitment, enabled } })}
        onConfidence={(confidence) => setPeople({ ...people, recruitment: { ...people.recruitment, confidence } })}
      >
        <NumberField
          fieldId="people.recruitment.costPerHire"
          label="Custo por contratação"
          value={people.recruitment.costPerHire}
          suffix="R$"
          help="Custo de abrir uma vaga, em R$. Entra uma vez por vaga evitada, salvo se já estiver no custo de substituição do turnover."
          noEffect={
            people.recruitment.includedInTurnoverCost
              ? 'Já incluso no turnover. Este valor não entra de novo.'
              : undefined
          }
          onChange={(costPerHire) => setPeople({ ...people, recruitment: editCard(people.recruitment, { costPerHire }) })}
        />
        <CheckField
          className="field check span-2"
          checked={people.recruitment.includedInTurnoverCost}
          onChange={(includedInTurnoverCost) =>
            setPeople({ ...people, recruitment: editCard(people.recruitment, { includedInTurnoverCost }) })
          }
          label="Este custo já está dentro do custo por substituição do turnover"
          help={IN_TURNOVER_HELP}
        />
      </BenefitCard>

      <BenefitCard
        title="Treinamento e integração"
        description="Só das vagas que não serão abertas. Em loja existente, o quadro atual já foi treinado."
        enabled={people.training.enabled}
        confidence={people.training.confidence}
        result={result}
        auditIds={['training']}
        onEnabled={(enabled) => setPeople({ ...people, training: { ...people.training, enabled } })}
        onConfidence={(confidence) => setPeople({ ...people, training: { ...people.training, confidence } })}
      >
        <NumberField
          fieldId="people.training.costPerPerson"
          label="Treinamento por contratação"
          value={people.training.costPerPerson}
          suffix="R$"
          hint={`Sugestão fictícia: R$ ${SUGGESTED_TRAINING_PER_HIRE.toLocaleString('pt-BR')} por pessoa, a validar. Não entra de novo se já estiver no custo de substituição.`}
          help="Treinamento inicial de uma vaga que deixa de ser aberta, em R$. Fica de fora se já estiver no custo por substituição."
          noEffect={
            people.training.includedInReplacementCost
              ? 'Já incluso no turnover. Este valor não entra de novo.'
              : undefined
          }
          onChange={(costPerPerson) => setPeople({ ...people, training: editCard(people.training, { costPerPerson }) })}
        />
        <CheckField
          className="field check span-2"
          checked={people.training.includedInReplacementCost}
          onChange={(includedInReplacementCost) =>
            setPeople({ ...people, training: editCard(people.training, { includedInReplacementCost }) })
          }
          label="Treinamento inicial já está no custo por substituição"
          help={IN_TURNOVER_HELP}
        />
      </BenefitCard>

      <BenefitCard
        title="Turnover evitado"
        description="Substituições que deixam de ocorrer nas vagas que não existem mais."
        enabled={people.turnover.enabled}
        confidence={people.turnover.confidence}
        result={result}
        auditIds={['turnover']}
        onEnabled={(enabled) => setPeople({ ...people, turnover: { ...people.turnover, enabled } })}
        onConfidence={(confidence) => setPeople({ ...people, turnover: { ...people.turnover, confidence } })}
      >
        <PercentField
          fieldId="people.turnover.annualRate"
          label="Taxa anual de turnover"
          value={people.turnover.annualRate}
          help={TURNOVER_HELP}
          hint="O padrão dos modelos de loja é 30% ao ano, sobre as vagas evitadas e as contratações futuras."
          onChange={(annualRate) => setPeople({ ...people, turnover: editCard(people.turnover, { annualRate }) })}
        />
        <NumberField
          label="Custo médio por substituição"
          value={people.turnover.costPerReplacement}
          suffix="R$"
          hint="Pode incluir recrutamento, exames, treinamento, supervisor, adaptação e desligamento. O padrão dos modelos é R$ 8.000."
          help="Quanto custa substituir uma pessoa, em R$. Multiplica as substituições evitadas no ano. Recrutamento e treinamento inclusos neste valor não entram de novo."
          onChange={(costPerReplacement) =>
            setPeople({ ...people, turnover: editCard(people.turnover, { costPerReplacement }) })
          }
        />
      </BenefitCard>
    </div>
  );
}

function PayrollCard({
  inputs,
  result,
  onChange,
  advanced,
}: {
  inputs: Inputs;
  result: ModelResult;
  onChange: (inputs: Inputs) => void;
  advanced: boolean;
}) {
  const people = inputs.people;
  const setPeople = (next: Inputs['people']) => onChange({ ...inputs, people: next });
  return (
    <BenefitCard
      title="Folha e encargos"
      description="Posições que deixam de existir em relação ao quadro sem robô."
      enabled={people.payroll.enabled}
      confidence={people.payroll.confidence}
      result={result}
      auditIds={['payroll', 'severance']}
      onEnabled={(enabled) => setPeople({ ...people, payroll: { ...people.payroll, enabled } })}
      onConfidence={(confidence) => setPeople({ ...people, payroll: { ...people.payroll, confidence } })}
    >
      <NumberField
        label="Vagas evitadas"
        value={people.payroll.positionsReduced}
        min={0}
        onChange={(positionsReduced) => setPeople({ ...people, payroll: editCard(people.payroll, { positionsReduced }) })}
      />
      <VacanciesReference inputs={inputs} titleTag="h3" />
      <NumberField
        fieldId="people.payroll.monthlyCostPerPosition"
        label="Custo completo por pessoa (R$/mês)"
        value={people.payroll.monthlyCostPerPosition}
        suffix="R$"
        hint="Por pessoa, por mês, já com encargos e benefícios. Não é o salário bruto."
        onChange={(monthlyCostPerPosition) =>
          setPeople({ ...people, payroll: editCard(people.payroll, { monthlyCostPerPosition }) })
        }
      />
      <NumberField
        label="Mês em que a economia começa"
        value={people.payroll.startMonth}
        min={1}
        suffix="mês"
        hint="No mês 1 para loja que já nasce sem a vaga. Mais tarde se a redução for gradual."
        onChange={(startMonth) => setPeople({ ...people, payroll: editCard(people.payroll, { startMonth }) })}
      />
      <NumberField
        label="Rescisão"
        value={people.payroll.severanceCost}
        suffix="R$"
        hint="Só loja existente. Em loja nova a vaga não chega a ser contratada, então a rescisão fica zerada."
        noEffect={
          inputs.profile.storeType === 'nova'
            ? 'Em loja nova a vaga não chega a ser contratada. A rescisão não entra no caixa.'
            : undefined
        }
        onChange={(severanceCost) => setPeople({ ...people, payroll: editCard(people.payroll, { severanceCost }) })}
      />
      <ExcludedReason result={result} id="severance" />
      {advanced ? (
        <>
          <PercentField
            label="Encargos sobre o salário"
            value={people.payroll.chargesPct}
            hint="Soma por cima do custo da vaga. Deixe em zero se o custo informado já for cheio."
            onChange={(chargesPct) => setPeople({ ...people, payroll: editCard(people.payroll, { chargesPct }) })}
          />
          <NumberField
            label="Benefícios por vaga"
            value={people.payroll.benefitsPerPosition}
            suffix="R$"
            onChange={(benefitsPerPosition) =>
              setPeople({ ...people, payroll: editCard(people.payroll, { benefitsPerPosition }) })
            }
          />
        </>
      ) : null}
    </BenefitCard>
  );
}

function FutureHiresCard({
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
  const futureBlocked = inputs.profile.storeType === 'nova';
  return (
    <BenefitCard
      title="Contratações futuras evitadas"
      description="Só loja existente. Cada vaga começa no mês em que a loja sem robô precisaria abrir."
      enabled={people.futureHires.enabled}
      confidence={people.futureHires.confidence}
      result={result}
      auditIds={['futureHires']}
      layout="plain"
      onEnabled={(enabled) => setPeople({ ...people, futureHires: { ...people.futureHires, enabled } })}
      onConfidence={(confidence) =>
        setPeople({ ...people, futureHires: { ...people.futureHires, confidence } })
      }
    >
      <ExcludedReason result={result} id="futureHires" />
      <div className="rows">
        {people.futureHires.hires.map((hire, index) => (
          <div className="row-card" key={hire.id}>
            <TextField
              label="Cargo"
              value={hire.role}
              noEffect={ROLE_NOTE}
              onChange={(role) => {
                const hires = people.futureHires.hires.slice();
                hires[index] = { ...hire, role };
                setPeople({ ...people, futureHires: editCard(people.futureHires, { hires }) });
              }}
            />
            <NumberField
              label="Mês"
              value={hire.month}
              min={1}
              noEffect={futureBlocked ? 'Contratação futura só entra em loja existente.' : undefined}
              onChange={(month) => {
                const hires = people.futureHires.hires.slice();
                hires[index] = { ...hire, month };
                setPeople({ ...people, futureHires: editCard(people.futureHires, { hires }) });
              }}
            />
            <NumberField
              label="Vagas"
              value={hire.headcount}
              min={0}
              noEffect={futureBlocked ? 'Contratação futura só entra em loja existente.' : undefined}
              onChange={(headcount) => {
                const hires = people.futureHires.hires.slice();
                hires[index] = { ...hire, headcount };
                setPeople({ ...people, futureHires: editCard(people.futureHires, { hires }) });
              }}
            />
            <NumberField
              fieldId={index === 0 ? 'people.futureHires.monthlyCost' : undefined}
              label="Custo mensal"
              value={hire.monthlyCost}
              suffix="R$"
              noEffect={futureBlocked ? 'Contratação futura só entra em loja existente.' : undefined}
              onChange={(monthlyCost) => {
                const hires = people.futureHires.hires.slice();
                hires[index] = { ...hire, monthlyCost };
                setPeople({ ...people, futureHires: editCard(people.futureHires, { hires }) });
              }}
            />
            <RemoveField>
              <RemoveButton
                testId={`remove-hire-${hire.id}`}
                onRemove={() =>
                  setPeople({
                    ...people,
                    futureHires: editCard(people.futureHires, {
                      hires: people.futureHires.hires.filter((item) => item.id !== hire.id),
                    }),
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
            futureHires: editCard(people.futureHires, {
              hires: [
                ...people.futureHires.hires,
                { id: crypto.randomUUID(), role: 'Auxiliar', month: 13, headcount: 1, monthlyCost: 0 },
              ],
            }),
          })
        }
      >
        Adicionar contratação evitada
      </button>
    </BenefitCard>
  );
}

function SupervisionCard({
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
  const counted = people.supervision.alreadyCountedInPayroll;
  const idle = counted ? 'Estas horas já foram retiradas na redução de folha. Não entram de novo.' : undefined;
  return (
    <BenefitCard
      title="Supervisão, escala e ausências"
      description="Horas de quem continua na loja. Não use horas de cargos já eliminados na folha."
      enabled={people.supervision.enabled}
      confidence={people.supervision.confidence}
      result={result}
      auditIds={['supervision']}
      onEnabled={(enabled) => setPeople({ ...people, supervision: { ...people.supervision, enabled } })}
      onConfidence={(confidence) => setPeople({ ...people, supervision: { ...people.supervision, confidence } })}
    >
      <NumberField
        fieldId="people.supervision.hoursSavedPerMonth"
        label="Horas economizadas por mês"
        value={people.supervision.hoursSavedPerMonth}
        suffix="h"
        noEffect={idle}
        onChange={(hoursSavedPerMonth) =>
          setPeople({ ...people, supervision: editCard(people.supervision, { hoursSavedPerMonth }) })
        }
      />
      <NumberField
        label="Custo da hora"
        value={people.supervision.costPerHour}
        suffix="R$"
        noEffect={idle}
        onChange={(costPerHour) => setPeople({ ...people, supervision: editCard(people.supervision, { costPerHour }) })}
      />
      <CheckField
        className="field check span-2"
        checked={people.supervision.alreadyCountedInPayroll}
        onChange={(alreadyCountedInPayroll) =>
          setPeople({ ...people, supervision: editCard(people.supervision, { alreadyCountedInPayroll }) })
        }
        label="Estas horas já foram retiradas na redução de folha"
        help="Ligado, a supervisão fica fora do fluxo para não pagar a mesma hora duas vezes."
      />
    </BenefitCard>
  );
}

function ConsultativeCard({
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
  const idle = people.consultativeSales.independentEvidence
    ? undefined
    : 'Sem evidência própria de venda, estas horas não entram no caixa.';
  return (
    <BenefitCard
      title="Venda consultiva"
      description="Horas liberadas para atendimento. Ficam de fora sem evidência própria de venda."
      enabled={people.consultativeSales.enabled}
      confidence={people.consultativeSales.confidence}
      result={result}
      auditIds={['consultative']}
      onEnabled={(enabled) => setPeople({ ...people, consultativeSales: { ...people.consultativeSales, enabled } })}
      onConfidence={(confidence) =>
        setPeople({ ...people, consultativeSales: { ...people.consultativeSales, confidence } })
      }
    >
      <NumberField
        label="Horas liberadas por mês"
        value={people.consultativeSales.hoursFreedPerMonth}
        suffix="h"
        noEffect={idle}
        onChange={(hoursFreedPerMonth) =>
          setPeople({ ...people, consultativeSales: editCard(people.consultativeSales, { hoursFreedPerMonth }) })
        }
      />
      <NumberField
        fieldId="people.consultativeSales.marginPerHour"
        label="Margem por hora"
        value={people.consultativeSales.marginPerHour}
        suffix="R$"
        noEffect={idle}
        onChange={(marginPerHour) =>
          setPeople({ ...people, consultativeSales: editCard(people.consultativeSales, { marginPerHour }) })
        }
      />
      <CheckField
        className="field check span-2"
        checked={people.consultativeSales.independentEvidence}
        onChange={(independentEvidence) =>
          setPeople({ ...people, consultativeSales: editCard(people.consultativeSales, { independentEvidence }) })
        }
        label="Há evidência independente de que estas horas geram margem adicional"
        help="Sem esta marca, a venda consultiva fica fora do fluxo. Ligado, horas vezes margem por hora podem entrar como venda."
      />
    </BenefitCard>
  );
}

function ReallocatedCard({
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
  const mode = people.reallocatedHours.monetization;
  return (
    <BenefitCard
      title="Horas realocadas"
      description="Não são economia de folha. Só entram no caixa com redução de custo ou ganho incremental demonstrável."
      enabled={people.reallocatedHours.enabled}
      confidence={people.reallocatedHours.confidence}
      result={result}
      auditIds={['reallocated']}
      onEnabled={(enabled) => setPeople({ ...people, reallocatedHours: { ...people.reallocatedHours, enabled } })}
      onConfidence={(confidence) =>
        setPeople({ ...people, reallocatedHours: { ...people.reallocatedHours, confidence } })
      }
    >
      <NumberField
        label="Horas por mês"
        value={people.reallocatedHours.hoursPerMonth}
        suffix="h"
        noEffect="As horas em si não viram caixa. O que entra é a redução de custo ou o ganho incremental."
        onChange={(hoursPerMonth) =>
          setPeople({ ...people, reallocatedHours: editCard(people.reallocatedHours, { hoursPerMonth }) })
        }
      />
      <SelectField
        label="Monetização"
        value={people.reallocatedHours.monetization}
        help="Sem monetização, a hora fica registrada e fora do caixa. Redução de custo e ganho incremental usam os valores ao lado."
        onChange={(monetization) =>
          setPeople({
            ...people,
            reallocatedHours: editCard(people.reallocatedHours, {
              monetization: monetization as Inputs['people']['reallocatedHours']['monetization'],
            }),
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
        noEffect={mode === 'reducao_custo' ? undefined : 'Só entra quando a monetização é redução real de custo.'}
        onChange={(costReductionMonthly) =>
          setPeople({ ...people, reallocatedHours: editCard(people.reallocatedHours, { costReductionMonthly }) })
        }
      />
      <NumberField
        label="Ganho incremental"
        value={people.reallocatedHours.incrementalMarginMonthly}
        suffix="R$/mês"
        noEffect={
          mode !== 'ganho_incremental'
            ? 'Só entra quando a monetização é ganho incremental.'
            : people.reallocatedHours.evidence
              ? undefined
              : 'Ganho incremental sem evidência. Este valor não entra no caixa.'
        }
        onChange={(incrementalMarginMonthly) =>
          setPeople({ ...people, reallocatedHours: editCard(people.reallocatedHours, { incrementalMarginMonthly }) })
        }
      />
      <CheckField
        className="field check span-2"
        checked={people.reallocatedHours.evidence}
        noEffect={
          mode === 'ganho_incremental'
            ? undefined
            : 'A evidência só muda o caixa quando a monetização é ganho incremental.'
        }
        onChange={(evidence) => setPeople({ ...people, reallocatedHours: editCard(people.reallocatedHours, { evidence }) })}
        label="Há evidência do ganho incremental destas horas"
        help="Sem esta marca, o ganho incremental fica fora do caixa. A redução de custo não usa esta evidência."
      />
    </BenefitCard>
  );
}
