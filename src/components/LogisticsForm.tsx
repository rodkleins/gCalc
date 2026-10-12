import { BenefitCard, Callout, CheckField, ModuleImpact, NumberField, SelectField, StageNote, editCard } from './Fields';
import type { Inputs, ModelResult, SpaceMode, SpaceTreatment, StoreType } from '../model/types';

const SPACE_TREATMENTS: Array<{ value: SpaceTreatment; label: string }> = [
  { value: 'aluguel_evitado', label: 'Aluguel evitado' },
  { value: 'ocupacao_evitavel', label: 'Ocupação evitável' },
  { value: 'expansao_comercial', label: 'Expansão comercial' },
  { value: 'sem_monetizacao', label: 'Sem monetização' },
  { value: 'investimento_imobiliario', label: 'Investimento imobiliário evitado' },
];

const SPACE_HELP =
  'Define se o metro liberado vira aluguel, ocupação, venda, imóvel evitado ou fica só registrado. Sem monetização, o cartão pode estar ligado e comprovável e mesmo assim não entra no caixa.';

function spaceNote(
  space: Inputs['logistics']['space'],
  kind: 'meters' | 'occupancy' | 'margin' | 'evidence' | 'realEstate',
  storeType: StoreType,
): string | undefined {
  if (space.treatment === 'sem_monetizacao') {
    return 'Sem monetização: este valor fica registrado e não entra no caixa.';
  }
  if (kind === 'evidence') {
    return space.treatment === 'expansao_comercial'
      ? undefined
      : 'A evidência comercial só muda o caixa quando a monetização é expansão comercial.';
  }
  if (kind === 'realEstate') {
    if (space.treatment !== 'investimento_imobiliario') {
      return 'O imóvel evitado só entra com a monetização de investimento imobiliário.';
    }
    if (storeType !== 'nova') return 'O imóvel evitado só abate o investimento em loja nova.';
    return undefined;
  }
  const asMargin = space.mode === 'margem' || space.treatment === 'expansao_comercial';
  if (kind === 'margin') {
    return asMargin ? undefined : 'A margem por m² só entra quando a área vira venda ou expansão comercial.';
  }
  const asOccupancy =
    (space.treatment === 'aluguel_evitado' || space.treatment === 'ocupacao_evitavel') && space.mode !== 'margem';
  if (kind === 'meters' && asMargin) return undefined;
  if (!asOccupancy) return 'Este valor não entra com a monetização escolhida.';
  if (space.contractUnchanged) {
    return 'O contrato de ocupação não muda. Este valor fica registrado e não entra no caixa.';
  }
  return undefined;
}

export function LogisticsForm({
  inputs,
  result,
  onChange,
  rosterLocked = false,
}: {
  inputs: Inputs;
  result: ModelResult;
  onChange: (inputs: Inputs) => void;
  /** Na versão de RH, movimentação e inventário vêm do quadro e não aceitam número. */
  rosterLocked?: boolean;
}) {
  const logistics = inputs.logistics;
  const setLogistics = (next: Inputs['logistics']) => onChange({ ...inputs, logistics: next });
  const space = logistics.space;

  return (
    <div className="stack">
      <StageNote>
        Esta tela pergunta o que a loja deixa de gastar com espaço, prateleira e movimento. O mesmo metro não vale
        aluguel e venda ao mesmo tempo. O valor das prateleiras evitadas ou liberadas abate o investimento no mês 0, em
        loja nova ou existente. A manutenção evitada entra todo mês. Se a prateleira ainda é necessária, os dois ficam
        de fora.
      </StageNote>
      <ModuleImpact result={result} module="Logística" />
      <Callout>
        O robô não elimina sozinho a caixa do fornecedor. Ocupação e margem comercial da mesma área não entram juntas.
        O valor das prateleiras abate o investimento no mês 0. A manutenção evitada é benefício mensal. Os dois valem
        para loja nova e para loja existente, desde que a prateleira deixe de ser necessária.
      </Callout>

      <BenefitCard
        title="Caixas plásticas retornáveis"
        description="Ciclos, aluguel, higienização, perdas e transporte reverso que o processo validado deixa de ter."
        enabled={logistics.boxes.enabled}
        confidence={logistics.boxes.confidence}
        result={result}
        auditIds={['boxes']}
        onEnabled={(enabled) => setLogistics({ ...logistics, boxes: { ...logistics.boxes, enabled } })}
        onConfidence={(confidence) => setLogistics({ ...logistics, boxes: { ...logistics.boxes, confidence } })}
      >
        <NumberField
          fieldId="logistics.boxes.cyclesAvoidedPerMonth"
          label="Ciclos evitados por mês"
          help="Quantidade de ciclos de caixa que o robô deixa de gerar por mês. O benefício mensal é este número vezes o custo por ciclo, se o processo estiver validado."
          value={logistics.boxes.cyclesAvoidedPerMonth}
          noEffect={
            logistics.boxes.processValidated
              ? undefined
              : 'Sem o processo validado, estes ciclos ficam registrados e não entram no caixa.'
          }
          onChange={(cyclesAvoidedPerMonth) =>
            setLogistics({ ...logistics, boxes: editCard(logistics.boxes, { cyclesAvoidedPerMonth }) })
          }
        />
        <NumberField
          label="Custo por ciclo"
          value={logistics.boxes.costPerCycle}
          suffix="R$"
          help="Custo de um ciclo de caixa, em R$. Multiplica os ciclos evitados e entra como benefício mensal quando o processo está validado."
          noEffect={
            logistics.boxes.processValidated
              ? undefined
              : 'Sem o processo validado, este custo fica registrado e não entra no caixa.'
          }
          onChange={(costPerCycle) => setLogistics({ ...logistics, boxes: editCard(logistics.boxes, { costPerCycle }) })}
        />
        <CheckField
          className="field check span-2"
          checked={logistics.boxes.processValidated}
          onChange={(processValidated) =>
            setLogistics({ ...logistics, boxes: editCard(logistics.boxes, { processValidated }) })
          }
          label="O processo logístico foi validado: o robô realmente elimina estes ciclos"
          help="Sem esta marca, os ciclos evitados ficam fora do fluxo. Ligado, ciclos vezes custo por ciclo entram como benefício mensal."
        />
      </BenefitCard>

      <BenefitCard
        title="Prateleiras e gaveteiros"
        description="Valor que abate o investimento no mês 0, mais a manutenção mensal que deixa de existir."
        enabled={logistics.shelving.enabled}
        confidence={logistics.shelving.confidence}
        result={result}
        auditIds={['shelvingCapex', 'shelvingMaintenance', 'shelvingResale']}
        onEnabled={(enabled) => setLogistics({ ...logistics, shelving: { ...logistics.shelving, enabled } })}
        onConfidence={(confidence) => setLogistics({ ...logistics, shelving: { ...logistics.shelving, confidence } })}
      >
        <NumberField
          fieldId="logistics.shelving.releasedValue"
          label="Valor das prateleiras evitadas ou liberadas"
          value={logistics.shelving.releasedValue ?? 0}
          suffix="R$"
          hint="Abate o investimento líquido no mês 0, em loja nova ou existente."
          help="Valor das prateleiras evitadas ou liberadas, em R$. Abate o investimento líquido no mês 0. Em loja nova é a compra que deixa de acontecer. Em loja existente é a revenda ou o reaproveitamento. Não entra de novo como benefício mensal."
          onChange={(releasedValue) =>
            setLogistics({ ...logistics, shelving: editCard(logistics.shelving, { releasedValue }) })
          }
        />
        <CheckField
          className="field check span-2"
          checked={logistics.shelving.stillRequired}
          onChange={(stillRequired) =>
            setLogistics({ ...logistics, shelving: editCard(logistics.shelving, { stillRequired }) })
          }
          label="Estas prateleiras ainda são necessárias e não podem ser evitadas nem liberadas"
          help="Ligado, o valor das prateleiras e a manutenção evitada ficam fora da conta. O robô não abate um móvel que a loja continua precisando."
        />
        <NumberField
          fieldId="logistics.shelving.avoidedMaintenanceMonthly"
          label="Manutenção evitada"
          value={logistics.shelving.avoidedMaintenanceMonthly}
          suffix="R$/mês"
          hint="Benefício mensal, em loja nova ou existente."
          help="Manutenção de prateleira que deixa de existir, em R$ por mês. Entra no benefício recorrente em loja nova e em loja existente, se as prateleiras saem da operação."
          onChange={(avoidedMaintenanceMonthly) =>
            setLogistics({ ...logistics, shelving: editCard(logistics.shelving, { avoidedMaintenanceMonthly }) })
          }
        />
      </BenefitCard>

      <BenefitCard
        title="Espaço físico"
        description="Escolha um destino econômico para os m² liberados."
        enabled={space.enabled}
        confidence={space.confidence}
        result={result}
        auditIds={['spaceOccupancy', 'spaceMargin']}
        onEnabled={(enabled) => setLogistics({ ...logistics, space: { ...space, enabled } })}
        onConfidence={(confidence) => setLogistics({ ...logistics, space: { ...space, confidence } })}
      >
        <SelectField
          label="Monetização da área"
          help={SPACE_HELP}
          hint={SPACE_HELP}
          value={space.treatment}
          onChange={(treatment) =>
            setLogistics({ ...logistics, space: editCard(space, { treatment: treatment as SpaceTreatment }) })
          }
          options={SPACE_TREATMENTS}
        />
        <NumberField
          label="m² liberados"
          value={space.m2Freed}
          suffix="m²"
          help="Área que o robô libera, em metros quadrados. O benefício mensal é esta área vezes o custo de ocupação ou a margem por m², conforme a valorização escolhida. Os dois não entram juntos."
          noEffect={spaceNote(space, 'meters', inputs.profile.storeType)}
          onChange={(m2Freed) => setLogistics({ ...logistics, space: editCard(space, { m2Freed }) })}
        />
        <SelectField
          label="Como valorizar a área"
          help="Escolhe a unidade do m² liberado. Ocupação usa R$ por m² de aluguel evitado. Margem usa R$ por m² de venda. Só um dos dois entra no benefício mensal. A monetização da área pode bloquear os dois."
          value={space.mode}
          onChange={(mode) => setLogistics({ ...logistics, space: editCard(space, { mode: mode as SpaceMode }) })}
          options={[
            { value: 'ocupacao', label: 'Custo de ocupação evitado' },
            { value: 'margem', label: 'Margem de área comercial' },
          ]}
        />
        <NumberField
          fieldId="logistics.space.occupancyCostPerM2"
          label="Custo de ocupação"
          value={space.occupancyCostPerM2}
          suffix="R$/m²"
          help="Aluguel ou ocupação por metro quadrado, em R$/m² ao mês. Multiplica os m² liberados quando a valorização é ocupação e o contrato muda. Também atualiza a referência do perfil."
          noEffect={spaceNote(space, 'occupancy', inputs.profile.storeType)}
          onChange={(occupancyCostPerM2) =>
            onChange({
              ...inputs,
              profile: { ...inputs.profile, occupancyCostPerM2 },
              logistics: { ...logistics, space: editCard(space, { occupancyCostPerM2 }) },
            })
          }
        />
        <NumberField
          fieldId="logistics.space.contributionPerM2Month"
          label="Margem por m²"
          value={space.contributionPerM2Month}
          suffix="R$/m²"
          help="Margem comercial por metro quadrado, em R$/m² ao mês. Multiplica os m² liberados quando a valorização é margem. Não entra junto com o custo de ocupação."
          noEffect={spaceNote(space, 'margin', inputs.profile.storeType)}
          onChange={(contributionPerM2Month) =>
            setLogistics({ ...logistics, space: editCard(space, { contributionPerM2Month }) })
          }
        />
        <NumberField
          label="Investimento imobiliário evitado"
          value={space.avoidedRealEstate}
          suffix="R$"
          help="Compra de imóvel que a loja nova deixa de fazer porque a área liberada cabe na planta. Abate o investimento no mês 0. Não é aluguel mensal."
          noEffect={spaceNote(space, 'realEstate', inputs.profile.storeType)}
          onChange={(avoidedRealEstate) => setLogistics({ ...logistics, space: editCard(space, { avoidedRealEstate }) })}
        />
        <CheckField
          className="field check span-2"
          checked={space.contractUnchanged}
          onChange={(contractUnchanged) => setLogistics({ ...logistics, space: editCard(space, { contractUnchanged }) })}
          label="O contrato de aluguel não muda. Nesse caso o custo de ocupação não entra no caixa."
          help="Ligado, o aluguel do m² liberado fica fora do fluxo, porque o contrato não diminui. A margem da área, se for o modo escolhido, continua podendo entrar."
        />
        <CheckField
          className="field check span-2"
          checked={space.commercialEvidence}
          noEffect={spaceNote(space, 'evidence', inputs.profile.storeType)}
          onChange={(commercialEvidence) =>
            setLogistics({ ...logistics, space: editCard(space, { commercialEvidence }) })
          }
          label="Há evidência de margem incremental nesta expansão comercial"
          help="Sem esta marca, a expansão comercial fica fora do caixa, salvo quando a valorização já é margem. Ligado, a margem da área pode entrar."
        />
      </BenefitCard>

      <BenefitCard
        title="Movimentação interna"
        description="Deslocamento, reposição e guarda de quem permanece na operação."
        enabled={logistics.movement.enabled}
        confidence={logistics.movement.confidence}
        result={result}
        auditIds={['movement']}
        locked={rosterLocked}
        onEnabled={(enabled) => setLogistics({ ...logistics, movement: { ...logistics.movement, enabled } })}
        onConfidence={(confidence) => setLogistics({ ...logistics, movement: { ...logistics.movement, confidence } })}
      >
        <NumberField
          fieldId="logistics.movement.hoursSavedPerMonth"
          label="Horas por mês"
          value={logistics.movement.hoursSavedPerMonth}
          suffix="h"
          help="Horas de movimentação que o robô evita por mês. O benefício é horas vezes o custo da hora, se estas horas ainda não estiverem na redução de folha."
          onChange={(hoursSavedPerMonth) =>
            setLogistics({ ...logistics, movement: editCard(logistics.movement, { hoursSavedPerMonth }) })
          }
        />
        <NumberField
          label="Custo da hora"
          value={logistics.movement.costPerHour}
          suffix="R$"
          help="Custo de uma hora de movimentação, em R$. Multiplica as horas evitadas e entra como benefício mensal, salvo se a hora já foi contada na folha."
          onChange={(costPerHour) =>
            setLogistics({ ...logistics, movement: editCard(logistics.movement, { costPerHour }) })
          }
        />
        <CheckField
          className="field check span-2"
          checked={logistics.movement.alreadyCountedInPayroll}
          onChange={(alreadyCountedInPayroll) =>
            setLogistics({ ...logistics, movement: editCard(logistics.movement, { alreadyCountedInPayroll }) })
          }
          label="Estas horas já foram retiradas na redução de folha"
          help="Ligado, a movimentação fica fora do fluxo para não pagar a mesma hora duas vezes. Na versão de RH o quadro já trava esta conta."
        />
      </BenefitCard>

      <BenefitCard
        title="Inventário"
        description="Contagem, conciliação e tratamento de divergências."
        enabled={logistics.inventoryCount.enabled}
        confidence={logistics.inventoryCount.confidence}
        result={result}
        auditIds={['inventoryCount']}
        locked={rosterLocked}
        onEnabled={(enabled) =>
          setLogistics({ ...logistics, inventoryCount: { ...logistics.inventoryCount, enabled } })
        }
        onConfidence={(confidence) =>
          setLogistics({ ...logistics, inventoryCount: { ...logistics.inventoryCount, confidence } })
        }
      >
        <NumberField
          fieldId="logistics.inventoryCount.hoursSavedPerMonth"
          label="Horas por mês"
          value={logistics.inventoryCount.hoursSavedPerMonth}
          suffix="h"
          help="Horas de inventário evitadas por mês. O benefício mensal é horas vezes o custo da hora. Na versão de RH esta linha fica desligada, porque a hora já está no quadro."
          onChange={(hoursSavedPerMonth) =>
            setLogistics({
              ...logistics,
              inventoryCount: editCard(logistics.inventoryCount, { hoursSavedPerMonth }),
            })
          }
        />
        <NumberField
          label="Custo da hora"
          value={logistics.inventoryCount.costPerHour}
          suffix="R$"
          help="Custo de uma hora de inventário, em R$. Multiplica as horas evitadas e entra como benefício mensal quando o módulo está ligado."
          onChange={(costPerHour) =>
            setLogistics({ ...logistics, inventoryCount: editCard(logistics.inventoryCount, { costPerHour }) })
          }
        />
      </BenefitCard>
    </div>
  );
}
