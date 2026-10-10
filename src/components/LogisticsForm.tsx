import { BenefitCard, Callout, CheckField, ModuleImpact, NumberField, SelectField, StageNote } from './Fields';
import type { Inputs, ModelResult, SpaceMode } from '../model/types';

export function LogisticsForm({
  inputs,
  result,
  onChange,
}: {
  inputs: Inputs;
  result: ModelResult;
  onChange: (inputs: Inputs) => void;
}) {
  const logistics = inputs.logistics;
  const setLogistics = (next: Inputs['logistics']) => onChange({ ...inputs, logistics: next });

  return (
    <div className="stack">
      <StageNote>
        Esta tela pergunta o que a loja deixa de gastar com espaço, prateleira e movimento. O mesmo metro não vale
        aluguel e venda ao mesmo tempo. Em loja nova, prateleira evitada reduz o investimento. Em loja existente, vira
        revenda ou manutenção, e só se a prateleira realmente sair.
      </StageNote>
      <ModuleImpact result={result} module="Logística" />
      <Callout>
        O robô não elimina sozinho a caixa do fornecedor. Ocupação e margem comercial da mesma área não entram juntas.
        Em loja nova, prateleira reduz CAPEX. Em loja existente, vira revenda e manutenção evitada.
      </Callout>

      <BenefitCard
        title="Caixas plásticas retornáveis"
        description="Ciclos, aluguel, higienização, perdas e transporte reverso que o processo validado deixa de ter."
        enabled={logistics.boxes.enabled}
        confidence={logistics.boxes.confidence}
        onEnabled={(enabled) => setLogistics({ ...logistics, boxes: { ...logistics.boxes, enabled } })}
        onConfidence={(confidence) => setLogistics({ ...logistics, boxes: { ...logistics.boxes, confidence } })}
      >
        <NumberField
          fieldId="logistics.boxes.cyclesAvoidedPerMonth"
          label="Ciclos evitados por mês"
          help="Quantidade de ciclos de caixa que o robô deixa de gerar por mês. O benefício mensal é este número vezes o custo por ciclo, se o processo estiver validado."
          value={logistics.boxes.cyclesAvoidedPerMonth}
          onChange={(cyclesAvoidedPerMonth) =>
            setLogistics({ ...logistics, boxes: { ...logistics.boxes, cyclesAvoidedPerMonth } })
          }
        />
        <NumberField
          label="Custo por ciclo"
          value={logistics.boxes.costPerCycle}
          suffix="R$"
          help="Custo de um ciclo de caixa, em R$. Multiplica os ciclos evitados e entra como benefício mensal quando o processo está validado."
          onChange={(costPerCycle) => setLogistics({ ...logistics, boxes: { ...logistics.boxes, costPerCycle } })}
        />
        <CheckField
          className="field check span-2"
          checked={logistics.boxes.processValidated}
          onChange={(processValidated) =>
            setLogistics({ ...logistics, boxes: { ...logistics.boxes, processValidated } })
          }
          label="O processo logístico foi validado: o robô realmente elimina estes ciclos"
          help="Sem esta marca, os ciclos evitados ficam fora do fluxo. Ligado, ciclos vezes custo por ciclo entram como benefício mensal."
        />
      </BenefitCard>

      <BenefitCard
        title="Prateleiras e gaveteiros"
        description="CAPEX evitado na loja nova, ou revenda e manutenção na loja existente."
        enabled={logistics.shelving.enabled}
        confidence={logistics.shelving.confidence}
        onEnabled={(enabled) => setLogistics({ ...logistics, shelving: { ...logistics.shelving, enabled } })}
        onConfidence={(confidence) => setLogistics({ ...logistics, shelving: { ...logistics.shelving, confidence } })}
      >
        <NumberField
          fieldId="logistics.shelving.avoidedAcquisition"
          label="Aquisição evitada"
          value={logistics.shelving.avoidedAcquisition}
          suffix="R$"
          hint="Só reduz o investimento em loja nova."
          onChange={(avoidedAcquisition) =>
            setLogistics({ ...logistics, shelving: { ...logistics.shelving, avoidedAcquisition } })
          }
        />
        <CheckField
          className="field check span-2"
          checked={logistics.shelving.stillRequired}
          onChange={(stillRequired) => setLogistics({ ...logistics, shelving: { ...logistics.shelving, stillRequired } })}
          label="Estas prateleiras ainda são necessárias e não podem ser evitadas nem revendidas"
          help="Ligado, a aquisição evitada e a revenda desta prateleira ficam fora do caixa. O robô não abate um móvel que a loja continua precisando."
        />
        <NumberField
          fieldId="logistics.shelving.resaleValue"
          label="Revenda ou reaproveitamento"
          value={logistics.shelving.resaleValue}
          suffix="R$"
          hint="Caixa único, só em loja existente."
          onChange={(resaleValue) => setLogistics({ ...logistics, shelving: { ...logistics.shelving, resaleValue } })}
        />
        <NumberField
          fieldId="logistics.shelving.avoidedMaintenanceMonthly"
          label="Manutenção evitada"
          value={logistics.shelving.avoidedMaintenanceMonthly}
          suffix="R$/mês"
          hint="OPEX recorrente, só em loja existente."
          onChange={(avoidedMaintenanceMonthly) =>
            setLogistics({ ...logistics, shelving: { ...logistics.shelving, avoidedMaintenanceMonthly } })
          }
        />
      </BenefitCard>

      <BenefitCard
        title="Espaço físico"
        description="Escolha um destino econômico para os m² liberados."
        enabled={logistics.space.enabled}
        confidence={logistics.space.confidence}
        onEnabled={(enabled) => setLogistics({ ...logistics, space: { ...logistics.space, enabled } })}
        onConfidence={(confidence) => setLogistics({ ...logistics, space: { ...logistics.space, confidence } })}
      >
        <NumberField
          label="m² liberados"
          value={logistics.space.m2Freed}
          suffix="m²"
          help="Área que o robô libera, em metros quadrados. O benefício mensal é esta área vezes o custo de ocupação ou a margem por m², conforme a valorização escolhida. Os dois não entram juntos."
          onChange={(m2Freed) => setLogistics({ ...logistics, space: { ...logistics.space, m2Freed } })}
        />
        <SelectField
          label="Como valorizar a área"
          help="Escolhe a unidade do m² liberado. Ocupação usa R$ por m² de aluguel evitado. Margem usa R$ por m² de venda. Só um dos dois entra no benefício mensal."
          value={logistics.space.mode}
          onChange={(mode) => setLogistics({ ...logistics, space: { ...logistics.space, mode: mode as SpaceMode } })}
          options={[
            { value: 'ocupacao', label: 'Custo de ocupação evitado' },
            { value: 'margem', label: 'Margem de área comercial' },
          ]}
        />
        <NumberField
          fieldId="logistics.space.occupancyCostPerM2"
          label="Custo de ocupação"
          value={logistics.space.occupancyCostPerM2}
          suffix="R$/m²"
          help="Aluguel ou ocupação por metro quadrado, em R$/m² ao mês. Multiplica os m² liberados quando a valorização é ocupação e o contrato muda. Também atualiza a referência do perfil."
          onChange={(occupancyCostPerM2) =>
            onChange({
              ...inputs,
              profile: { ...inputs.profile, occupancyCostPerM2 },
              logistics: { ...logistics, space: { ...logistics.space, occupancyCostPerM2 } },
            })
          }
        />
        <NumberField
          fieldId="logistics.space.contributionPerM2Month"
          label="Margem por m²"
          value={logistics.space.contributionPerM2Month}
          suffix="R$/m²"
          help="Margem comercial por metro quadrado, em R$/m² ao mês. Multiplica os m² liberados quando a valorização é margem. Não entra junto com o custo de ocupação."
          onChange={(contributionPerM2Month) =>
            setLogistics({ ...logistics, space: { ...logistics.space, contributionPerM2Month } })
          }
        />
        <CheckField
          className="field check span-2"
          checked={logistics.space.contractUnchanged}
          onChange={(contractUnchanged) =>
            setLogistics({ ...logistics, space: { ...logistics.space, contractUnchanged } })
          }
          label="O contrato de aluguel não muda. Nesse caso o custo de ocupação não entra no caixa."
          help="Ligado, o aluguel do m² liberado fica fora do fluxo, porque o contrato não diminui. A margem da área, se for o modo escolhido, continua podendo entrar."
        />
      </BenefitCard>

      <BenefitCard
        title="Movimentação interna"
        description="Deslocamento, reposição e guarda de quem permanece na operação."
        enabled={logistics.movement.enabled}
        confidence={logistics.movement.confidence}
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
            setLogistics({ ...logistics, movement: { ...logistics.movement, hoursSavedPerMonth } })
          }
        />
        <NumberField
          label="Custo da hora"
          value={logistics.movement.costPerHour}
          suffix="R$"
          help="Custo de uma hora de movimentação, em R$. Multiplica as horas evitadas e entra como benefício mensal, salvo se a hora já foi contada na folha."
          onChange={(costPerHour) => setLogistics({ ...logistics, movement: { ...logistics.movement, costPerHour } })}
        />
        <CheckField
          className="field check span-2"
          checked={logistics.movement.alreadyCountedInPayroll}
          onChange={(alreadyCountedInPayroll) =>
            setLogistics({ ...logistics, movement: { ...logistics.movement, alreadyCountedInPayroll } })
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
        onEnabled={(enabled) => setLogistics({ ...logistics, inventoryCount: { ...logistics.inventoryCount, enabled } })}
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
            setLogistics({ ...logistics, inventoryCount: { ...logistics.inventoryCount, hoursSavedPerMonth } })
          }
        />
        <NumberField
          label="Custo da hora"
          value={logistics.inventoryCount.costPerHour}
          suffix="R$"
          help="Custo de uma hora de inventário, em R$. Multiplica as horas evitadas e entra como benefício mensal quando o módulo está ligado."
          onChange={(costPerHour) =>
            setLogistics({ ...logistics, inventoryCount: { ...logistics.inventoryCount, costPerHour } })
          }
        />
      </BenefitCard>
    </div>
  );
}
