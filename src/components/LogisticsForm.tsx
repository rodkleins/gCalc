import { BenefitCard, Callout, ModuleImpact, NumberField, SelectField } from './Fields';
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
          value={logistics.boxes.cyclesAvoidedPerMonth}
          onChange={(cyclesAvoidedPerMonth) =>
            setLogistics({ ...logistics, boxes: { ...logistics.boxes, cyclesAvoidedPerMonth } })
          }
        />
        <NumberField
          label="Custo por ciclo"
          value={logistics.boxes.costPerCycle}
          suffix="R$"
          onChange={(costPerCycle) => setLogistics({ ...logistics, boxes: { ...logistics.boxes, costPerCycle } })}
        />
        <label className="field check span-2">
          <input
            type="checkbox"
            checked={logistics.boxes.processValidated}
            onChange={(event) =>
              setLogistics({ ...logistics, boxes: { ...logistics.boxes, processValidated: event.target.checked } })
            }
          />
          <span>O processo logístico foi validado: o robô realmente elimina estes ciclos</span>
        </label>
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
        <label className="field check span-2">
          <input
            type="checkbox"
            checked={logistics.shelving.stillRequired}
            onChange={(event) =>
              setLogistics({ ...logistics, shelving: { ...logistics.shelving, stillRequired: event.target.checked } })
            }
          />
          <span>Estas prateleiras ainda são necessárias e não podem ser evitadas nem revendidas</span>
        </label>
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
          onChange={(m2Freed) => setLogistics({ ...logistics, space: { ...logistics.space, m2Freed } })}
        />
        <SelectField
          label="Como valorizar a área"
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
          onChange={(contributionPerM2Month) =>
            setLogistics({ ...logistics, space: { ...logistics.space, contributionPerM2Month } })
          }
        />
        <label className="field check span-2">
          <input
            type="checkbox"
            checked={logistics.space.contractUnchanged}
            onChange={(event) =>
              setLogistics({
                ...logistics,
                space: { ...logistics.space, contractUnchanged: event.target.checked },
              })
            }
          />
          <span>O contrato de aluguel não muda. Nesse caso o custo de ocupação não entra no caixa.</span>
        </label>
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
          onChange={(hoursSavedPerMonth) =>
            setLogistics({ ...logistics, movement: { ...logistics.movement, hoursSavedPerMonth } })
          }
        />
        <NumberField
          label="Custo da hora"
          value={logistics.movement.costPerHour}
          suffix="R$"
          onChange={(costPerHour) => setLogistics({ ...logistics, movement: { ...logistics.movement, costPerHour } })}
        />
        <label className="field check span-2">
          <input
            type="checkbox"
            checked={logistics.movement.alreadyCountedInPayroll}
            onChange={(event) =>
              setLogistics({
                ...logistics,
                movement: { ...logistics.movement, alreadyCountedInPayroll: event.target.checked },
              })
            }
          />
          <span>Estas horas já foram retiradas na redução de folha</span>
        </label>
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
          onChange={(hoursSavedPerMonth) =>
            setLogistics({ ...logistics, inventoryCount: { ...logistics.inventoryCount, hoursSavedPerMonth } })
          }
        />
        <NumberField
          label="Custo da hora"
          value={logistics.inventoryCount.costPerHour}
          suffix="R$"
          onChange={(costPerHour) =>
            setLogistics({ ...logistics, inventoryCount: { ...logistics.inventoryCount, costPerHour } })
          }
        />
      </BenefitCard>
    </div>
  );
}
