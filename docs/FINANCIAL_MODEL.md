# Modelo financeiro do gCalc

Horizonte de 60 meses. O índice 0 do fluxo é a data zero e não é descontado. A taxa mensal é `(1 + taxa anual) ^ (1/12) - 1`. Valores do exemplo são fictícios.

## Fluxo do projeto

Este é o fluxo de VPL, TIR, payback e retorno. Não contém dívida.

```text
caixa(0) = -investimento líquido × parcela do cronograma na data zero
investimento líquido = CAPEX bruto - CAPEX evitado
CAPEX evitado = prateleiras de loja nova, se ainda não forem necessárias
              + investimento imobiliário evitado, se essa for a tese da área

operacional(m) = benefício(m) - OPEX(m) × índice de inflação
imposto(m)     = política tributária sobre (operacional - depreciação)
líquido(m)     = operacional - imposto
pontual(m)     = variação de capital de giro - rescisão - remoção
               + revenda + residual + recrutamento evitado
               + treinamento evitado + parcela posterior do CAPEX
incremental(m) = líquido(m) + pontual(m)
```

Benefício excluído soma zero. OPEX não é reduzido pela captura.

## Três vias de mão de obra

1. Redução efetiva, típica de loja existente: `vagas × (custo × (1 + encargos) + benefícios)`, a partir do mês de início, vezes reorganização e rampa de pessoas. A rescisão sai uma vez do caixa. As vagas não passam do quadro informado.
2. Contratação futura evitada: cada cargo entra no próprio mês.
3. Horas realocadas: não são folha. Entram só como redução de custo ou ganho incremental com evidência. Horas acima da jornada de quem ficou são cortadas.

Turnover mensal = `posições expostas × taxa anual × custo da substituição / 12`. O custo é o valor consolidado ou a soma dos componentes (recrutamento, treinamento do substituto, adaptação, desligamento, supervisão). Nunca os dois. Contratação inicial e treinamento inicial continuam eventos pontuais e saem se já estiverem nesse custo.

## Captura

| Benefício | Fator |
| --- | --- |
| Dispensação, caixas, movimentação | cobertura × disponibilidade |
| Folha, contratação, turnover, supervisão | reorganização; 0 se a disponibilidade é 0 |
| Prateleira e ocupação | configuração física, sem o fator de dispensação |
| Perdas, avarias, inventário | fração de estoque automatizado; 0 se a disponibilidade é 0 |
| Vendas | cobertura × disponibilidade × atendimento × conversão |

## Tributos

Resultado contábil, base tributável e caixa são campos separados do mês.

- Sem impostos: caixa fiscal zero.
- Incremental simplificado: imposto só sobre base positiva.
- Prejuízo com limite: a base negativa vira saldo. O uso futuro não passa da fração configurada. Não há crédito imediato.
- Benefício condicionado: o escudo só existe até a capacidade informada e com validação marcada.

A alíquota default de 34% não é adequada a qualquer regime. Depreciação linear reduz a base e não sai do caixa. Ganho de residual só é tributado se os eventos extraordinários estiverem na política.

## Capital de giro

`liberação = estoque antes - estoque depois`, somente se a redução estiver comprovada. O padrão é não presumir queda: o robô pode até aumentar o estoque. Entra no mês escolhido e pode reverter no mês 60. O custo financeiro mensal (`liberação × taxa / 12`) é alternativa, não soma. A leitura informativa permanece quando o principal já está no fluxo, porque o desconto do VPL já remunera o capital.

O OPEX mensal é manutenção, suporte e gasto recorrente. O preço do equipamento entra só no CAPEX. OPEX anual acima de 20% do CAPEX bruto gera aviso.

Contratação futura e rescisão só entram em loja existente. Em loja nova a vaga que não nasce já está na folha, sem desligamento.

## Indicadores

| Nome | Definição |
| --- | --- |
| Retorno anual simples estabilizado | `(líquido do mês 60 × 12) / investimento líquido`. Não é retorno acumulado nem TIR. |
| ROI acumulado em 60 meses | soma do operacional líquido / investimento líquido |
| Payback simples | interpolação do caixa acumulado |
| Payback descontado | a mesma interpolação no caixa descontado |
| VPL | valor presente do fluxo do projeto |
| TIR anual efetiva | `(1 + TIR mensal) ^ 12 - 1`. Se há mais de uma troca de sinal, o resultado é ambíguo e o VPL manda |
| Benefício operacional anual | benefício bruto do mês 60 × 12 |
| Economia acumulada | soma do benefício bruto no horizonte |
| Investimento líquido total | CAPEX bruto menos evitados |

Investimento zero: retorno nulo, payback imediato, TIR indefinida, VPL finito. Investimento negativo: retorno nulo. Sem recuperação em 60 meses: payback nulo.

## Financiamento

O fluxo do projeto não muda. O fluxo do investidor troca o desembolso cheio pela entrada, subtrai parcelas e balão e não trata o principal recebido como benefício. A tela mostra VPL e TIR do projeto, TIR do capital próprio quando existe, serviço da dívida, saldo devedor e custo financeiro total.

## Rede

Desligada, `N` lojas replicam investimento, líquido e VPL. Ligada, cada unidade tem tipo, data, fator de investimento, volume e mão de obra. O custo compartilhado sai uma vez por mês. O payback de cada loja é o dela.

## Rampa, preços e espaço

Depois do go-live, cada família usa a própria curva e permanece no último patamar. Salários, OPEX e preços têm índice anual. Se a base dos fluxos e a taxa de desconto não coincidem, o modelo avisa.

Ocupação e margem da mesma área não se somam. Margem de área entra na regra que impede vendas sobrepostas. Contrato inalterado bloqueia aluguel e ocupação. Área sem monetização fica só na auditoria.
