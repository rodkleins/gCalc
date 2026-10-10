import { BenefitCard, Callout, CheckField, ModuleImpact, NumberField, PercentField, SelectField, StageNote } from './Fields';
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
      <StageNote>
        Esta tela mede perda que deixa de acontecer e, se houver prova, dinheiro que sai do estoque. O robô não reduz
        estoque sozinho: em muitas drogarias ele até aumenta o estoque, porque guarda mais com menos ruptura. Sem essa
        prova, o capital de giro fica zerado.
      </StageNote>
      <ModuleImpact result={result} module="Estoque" />
      <Callout>
        O padrão não presume queda de estoque. O robô pode até aumentar o estoque. Se uma redução for comprovada, o
        dinheiro liberado entra uma vez, não como lucro todo mês.
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
          fieldId="profile.historicalLossesMonthly"
          label="Perdas históricas"
          value={inputs.profile.historicalLossesMonthly}
          suffix="R$/mês"
          hint="O valor mora no perfil da loja e é repetido aqui."
          onChange={(historicalLossesMonthly) =>
            onChange({ ...inputs, profile: { ...inputs.profile, historicalLossesMonthly } })
          }
        />
        <NumberField
          fieldId="stock.losses.projectedLossesMonthly"
          label="Perdas projetadas com o robô"
          value={stock.losses.projectedLossesMonthly}
          suffix="R$/mês"
          help="Perdas que ainda acontecem com o robô, em R$ por mês. O benefício é perdas históricas menos este valor. Tem de ser menor ou igual às perdas atuais."
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
          fieldId="stock.shrinkage.avoidedMonthly"
          label="Valor evitado"
          value={stock.shrinkage.avoidedMonthly}
          suffix="R$/mês"
          help="Avarias, extravios e erros que deixam de acontecer, em R$ por mês. Entra direto como benefício mensal quando o cartão está ligado."
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
          fieldId="stock.ruptures.additionalMonthlySales"
          label="Vendas adicionais"
          value={stock.ruptures.additionalMonthlySales}
          suffix="R$/mês"
          hint={`Margem de ${formatBRL(stock.ruptures.additionalMonthlySales * inputs.profile.contributionMarginPct)} por mês antes dos filtros.`}
          onChange={(additionalMonthlySales) =>
            setStock({ ...stock, ruptures: { ...stock.ruptures, additionalMonthlySales } })
          }
        />
        <CheckField
          className="field check span-2"
          checked={stock.ruptures.independentEvidence}
          onChange={(independentEvidence) => setStock({ ...stock, ruptures: { ...stock.ruptures, independentEvidence } })}
          label="A redução de ruptura tem evidência independente de venda"
          help="Sem evidência, a venda recuperada de ruptura fica fora do fluxo. Ligado, o valor vira margem pela margem de contribuição e pode entrar no benefício mensal."
        />
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
          fieldId="stock.serviceSpeed.additionalMonthlySales"
          label="Vendas adicionais"
          value={stock.serviceSpeed.additionalMonthlySales}
          suffix="R$/mês"
          help="Venda extra por atendimento mais rápido, em R$ por mês. Vira margem pela margem de contribuição. Só entra no fluxo com evidência própria e sem repetir outra alavanca de venda."
          onChange={(additionalMonthlySales) =>
            setStock({ ...stock, serviceSpeed: { ...stock.serviceSpeed, additionalMonthlySales } })
          }
        />
        <CheckField
          className="field check span-2"
          checked={stock.serviceSpeed.independentEvidence}
          onChange={(independentEvidence) =>
            setStock({ ...stock, serviceSpeed: { ...stock.serviceSpeed, independentEvidence } })
          }
          label="A velocidade de atendimento tem evidência independente de venda"
          help="Sem evidência, esta venda extra fica fora do fluxo. Ligado, o valor pode entrar como margem mensal, se não repetir outra alavanca de venda."
        />
      </BenefitCard>

      <section className="card">
        <CheckField
          checked={stock.salesIndependenceConfirmed}
          onChange={(salesIndependenceConfirmed) => setStock({ ...stock, salesIndependenceConfirmed })}
          label="As alavancas de venda (consultiva, ruptura e atendimento) são efeitos diferentes e podem ser somadas"
          help="Ligado, as vendas extras ativas somam no benefício. Desligado, o fluxo fica só com a maior alavanca de venda. As outras aparecem na auditoria."
        />
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
          fieldId="stock.workingCapital.inventoryAfter"
          label="Estoque médio com o robô"
          value={stock.workingCapital.inventoryAfter}
          suffix="R$"
          help="Estoque médio depois do robô, em R$. A liberação de caixa é o estoque atual menos este valor. Sem comprovação, o caixa não muda."
          onChange={(inventoryAfter) =>
            setStock({ ...stock, workingCapital: { ...stock.workingCapital, inventoryAfter } })
          }
        />
        <CheckField
          className="field check span-2"
          checked={stock.workingCapital.reductionProven}
          onChange={(reductionProven) => setStock({ ...stock, workingCapital: { ...stock.workingCapital, reductionProven } })}
          label="A redução de estoque está comprovada. Sem esta marca o caixa não muda, mesmo que o estoque “depois” seja menor. O robô pode aumentar o estoque."
          help="Ligado, a diferença de estoque pode entrar no caixa uma vez, no mês da liberação. Desligado, o capital de giro fica zerado mesmo se o estoque depois for menor."
        />
        <NumberField
          label="Mês da liberação"
          help="Mês em que o dinheiro do estoque menor volta ao caixa, contado a partir do início. É caixa uma vez, não benefício todo mês."
          value={stock.workingCapital.releaseMonth}
          min={1}
          onChange={(releaseMonth) =>
            setStock({ ...stock, workingCapital: { ...stock.workingCapital, releaseMonth } })
          }
        />
        <SelectField
          label="O que entra no fluxo"
          help="Liberação de caixa entra o principal uma vez. Custo financeiro mensal usa a taxa de capital sobre o estoque liberado e não substitui a taxa de desconto do VPL."
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
          fieldId="stock.workingCapital.costOfCapitalAnnual"
          label="Custo de capital"
          value={stock.workingCapital.costOfCapitalAnnual}
          hint="Usado na leitura do custo financeiro. Não substitui a taxa de desconto do VPL."
          onChange={(costOfCapitalAnnual) =>
            setStock({ ...stock, workingCapital: { ...stock.workingCapital, costOfCapitalAnnual } })
          }
        />
        <CheckField
          className="field check span-2"
          checked={stock.workingCapital.reverseAtHorizon}
          onChange={(reverseAtHorizon) =>
            setStock({ ...stock, workingCapital: { ...stock.workingCapital, reverseAtHorizon } })
          }
          label="Devolver o capital no mês 60 (projetos com fim definido). Desligado trata a loja como contínua."
          help="Ligado, o caixa liberado do estoque volta a sair no mês 60. Desligado, a loja segue e esse principal não é devolvido no horizonte."
        />
        <p className="hint-block span-2">
          Custo financeiro anual de leitura: {formatBRL(release * stock.workingCapital.costOfCapitalAnnual)}. Este número{' '}
          {result.informational.financialCostIncluded ? 'está' : 'não está'} no VPL.
        </p>
      </BenefitCard>
    </div>
  );
}
