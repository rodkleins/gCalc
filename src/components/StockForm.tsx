import { BenefitCard, Callout, ModuleImpact, NumberField, PercentField, SelectField } from './Fields';
import { formatBRL } from '../model/format';
import type { Inputs, ModelResult, WorkingCapitalTreatment } from '../model/types';

export function StockForm({
  inputs,
  result,
  onChange,
}: {
  inputs: Inputs;
  result: ModelResult;
  onChange: (inputs: Inputs) => void;
}) {
  const stock = inputs.stock;
  const setStock = (next: Inputs['stock']) => onChange({ ...inputs, stock: next });
  const release = Math.max(0, inputs.profile.averageInventory - stock.workingCapital.inventoryAfter);

  return (
    <div className="stack">
      <ModuleImpact result={result} module="Estoque" />
      <Callout>
        Capital de giro liberado é caixa, não lucro mensal. Se ele entra no fluxo, o custo financeiro do estoque fica só
        como leitura: a taxa de desconto do VPL já remunera esse capital.
      </Callout>

      <BenefitCard
        title="Perdas e FEFO"
        description="Vencimento e quebra que a automação reduz de fato."
        enabled={stock.losses.enabled}
        confidence={stock.losses.confidence}
        onEnabled={(enabled) => setStock({ ...stock, losses: { ...stock.losses, enabled } })}
        onConfidence={(confidence) => setStock({ ...stock, losses: { ...stock.losses, confidence } })}
      >
        <NumberField
          label="Perdas históricas"
          value={inputs.profile.historicalLossesMonthly}
          suffix="R$/mês"
          hint="O valor mora no perfil da loja e é repetido aqui."
          onChange={(historicalLossesMonthly) =>
            onChange({ ...inputs, profile: { ...inputs.profile, historicalLossesMonthly } })
          }
        />
        <NumberField
          label="Perdas projetadas com o robô"
          value={stock.losses.projectedLossesMonthly}
          suffix="R$/mês"
          onChange={(projectedLossesMonthly) =>
            setStock({ ...stock, losses: { ...stock.losses, projectedLossesMonthly } })
          }
        />
      </BenefitCard>

      <BenefitCard
        title="Avarias, extravios e erros"
        description="Valor mensal que deixa de se perder na separação e na guarda."
        enabled={stock.shrinkage.enabled}
        confidence={stock.shrinkage.confidence}
        onEnabled={(enabled) => setStock({ ...stock, shrinkage: { ...stock.shrinkage, enabled } })}
        onConfidence={(confidence) => setStock({ ...stock, shrinkage: { ...stock.shrinkage, confidence } })}
      >
        <NumberField
          label="Valor evitado"
          value={stock.shrinkage.avoidedMonthly}
          suffix="R$/mês"
          onChange={(avoidedMonthly) => setStock({ ...stock, shrinkage: { ...stock.shrinkage, avoidedMonthly } })}
        />
      </BenefitCard>

      <BenefitCard
        title="Rupturas"
        description="Venda recuperada por estoque mais acurado. Precisa de evidência própria."
        enabled={stock.ruptures.enabled}
        confidence={stock.ruptures.confidence}
        onEnabled={(enabled) => setStock({ ...stock, ruptures: { ...stock.ruptures, enabled } })}
        onConfidence={(confidence) => setStock({ ...stock, ruptures: { ...stock.ruptures, confidence } })}
      >
        <NumberField
          label="Vendas adicionais"
          value={stock.ruptures.additionalMonthlySales}
          suffix="R$/mês"
          hint={`Margem de ${formatBRL(stock.ruptures.additionalMonthlySales * inputs.profile.contributionMarginPct)} por mês antes dos filtros.`}
          onChange={(additionalMonthlySales) =>
            setStock({ ...stock, ruptures: { ...stock.ruptures, additionalMonthlySales } })
          }
        />
        <label className="field check span-2">
          <input
            type="checkbox"
            checked={stock.ruptures.independentEvidence}
            onChange={(event) =>
              setStock({ ...stock, ruptures: { ...stock.ruptures, independentEvidence: event.target.checked } })
            }
          />
          <span>A redução de ruptura tem evidência independente de venda</span>
        </label>
      </BenefitCard>

      <BenefitCard
        title="Atendimento e abandono"
        description="Capacidade extra e menor fila. Também exige evidência própria."
        enabled={stock.serviceSpeed.enabled}
        confidence={stock.serviceSpeed.confidence}
        onEnabled={(enabled) => setStock({ ...stock, serviceSpeed: { ...stock.serviceSpeed, enabled } })}
        onConfidence={(confidence) => setStock({ ...stock, serviceSpeed: { ...stock.serviceSpeed, confidence } })}
      >
        <NumberField
          label="Vendas adicionais"
          value={stock.serviceSpeed.additionalMonthlySales}
          suffix="R$/mês"
          onChange={(additionalMonthlySales) =>
            setStock({ ...stock, serviceSpeed: { ...stock.serviceSpeed, additionalMonthlySales } })
          }
        />
        <label className="field check span-2">
          <input
            type="checkbox"
            checked={stock.serviceSpeed.independentEvidence}
            onChange={(event) =>
              setStock({
                ...stock,
                serviceSpeed: { ...stock.serviceSpeed, independentEvidence: event.target.checked },
              })
            }
          />
          <span>A velocidade de atendimento tem evidência independente de venda</span>
        </label>
      </BenefitCard>

      <section className="card">
        <label className="field check">
          <input
            type="checkbox"
            checked={stock.salesIndependenceConfirmed}
            onChange={(event) => setStock({ ...stock, salesIndependenceConfirmed: event.target.checked })}
          />
          <span>
            As alavancas de venda (consultiva, ruptura e atendimento) são efeitos diferentes e podem ser somadas
          </span>
        </label>
        <p className="hint-block">
          Sem esta confirmação, o fluxo fica só com a maior alavanca de venda ativa. As outras aparecem na auditoria.
        </p>
      </section>

      <BenefitCard
        title="Capital de giro"
        description={`Estoque atual ${formatBRL(inputs.profile.averageInventory)}. Liberação bruta ${formatBRL(release)}.`}
        enabled={stock.workingCapital.enabled}
        confidence={stock.workingCapital.confidence}
        onEnabled={(enabled) => setStock({ ...stock, workingCapital: { ...stock.workingCapital, enabled } })}
        onConfidence={(confidence) => setStock({ ...stock, workingCapital: { ...stock.workingCapital, confidence } })}
      >
        <NumberField
          label="Estoque médio com o robô"
          value={stock.workingCapital.inventoryAfter}
          suffix="R$"
          onChange={(inventoryAfter) =>
            setStock({ ...stock, workingCapital: { ...stock.workingCapital, inventoryAfter } })
          }
        />
        <NumberField
          label="Mês da liberação"
          value={stock.workingCapital.releaseMonth}
          min={1}
          onChange={(releaseMonth) =>
            setStock({ ...stock, workingCapital: { ...stock.workingCapital, releaseMonth } })
          }
        />
        <SelectField
          label="O que entra no fluxo"
          value={stock.workingCapital.treatment}
          onChange={(treatment) =>
            setStock({
              ...stock,
              workingCapital: { ...stock.workingCapital, treatment: treatment as WorkingCapitalTreatment },
            })
          }
          options={[
            { value: 'liberacao_caixa', label: 'Liberação de caixa (principal)' },
            { value: 'custo_financeiro', label: 'Custo financeiro mensal' },
          ]}
        />
        <PercentField
          label="Custo de capital"
          value={stock.workingCapital.costOfCapitalAnnual}
          hint="Usado na leitura do custo financeiro. Não substitui a taxa de desconto do VPL."
          onChange={(costOfCapitalAnnual) =>
            setStock({ ...stock, workingCapital: { ...stock.workingCapital, costOfCapitalAnnual } })
          }
        />
        <label className="field check span-2">
          <input
            type="checkbox"
            checked={stock.workingCapital.reverseAtHorizon}
            onChange={(event) =>
              setStock({
                ...stock,
                workingCapital: { ...stock.workingCapital, reverseAtHorizon: event.target.checked },
              })
            }
          />
          <span>Devolver o capital no mês 60 (projetos com fim definido). Desligado trata a loja como contínua.</span>
        </label>
        <p className="hint-block span-2">
          Custo financeiro anual de leitura: {formatBRL(release * stock.workingCapital.costOfCapitalAnnual)}. Este número{' '}
          {result.informational.financialCostIncluded ? 'está' : 'não está'} no VPL.
        </p>
      </BenefitCard>
    </div>
  );
}
