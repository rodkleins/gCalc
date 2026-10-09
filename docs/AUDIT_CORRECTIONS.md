# Auditoria do motor financeiro

Base comparada: commit `c1bfa48` (auditoria original) e o estado publicado anterior a este branch (`577800a`, que conserva o mesmo motor do exemplo). O exemplo fictício continua em investimento líquido R$ 2.000.000, benefício líquido R$ 65.000/mês, payback 30,8 meses e retorno anual simples estabilizado de 39%.

## Plano técnico

O motor continua em `evaluate` (`src/model/calculate.ts`), com a aritmética de VPL, TIR e payback em `finance.ts`. As correções entram como política em cima dos mesmos fluxos de 60 meses:

- `normalize.ts` completa simulações antigas (`gcalc.library.v2`) com premissas neutras.
- `drivers.ts` é a única definição de investimento, OPEX, mão de obra, turnover, volume, vendas, desconto, disponibilidade e cobertura. Sensibilidade e ajuste rápido chamam a mesma função.
- Cada benefício segue com portão de inclusão. Linha excluída não entra no caixa. A auditoria passa a guardar unidade, origem, condição, acumulado, fator e conflitos.

## Matriz

| Problema | Arquivo | Correção | Teste |
| --- | --- | --- | --- |
| P0.1 Folha superestimada | `calculate.ts`, `PeopleForm.tsx` | Três modalidades: redução efetiva, contratação futura e horas realocadas. Horas sem monetização ficam fora. Folha limitada ao quadro. Encargos e benefícios explícitos. | `reference.test.ts` (vaga zero, horas, disponibilidade) |
| P0.2 Turnover | `calculate.ts` | Custo consolidado ou detalhado, nunca os dois. Recrutamento e treinamento já inclusos não entram de novo. Substituição segue a exposição. | `calculate.test.ts`, `reference.test.ts` |
| P0.3 Tributação | `calculate.ts`, `InvestmentForm.tsx` | Políticas: sem imposto, incremental, prejuízo com limite, benefício condicionado. Sem crédito automático. Alíquota não é recomendação. | `reference.test.ts` prejuízo sem crédito; teste antigo do escudo positivo |
| P0.4 Capital de giro | `calculate.ts`, `StockForm.tsx` | Só entra com redução comprovada. Variação e reversão no fluxo. Custo financeiro não soma com o principal. | `calculate.test.ts`, `reference.test.ts` |
| P0.5 Indicadores | `types.ts`, `Dashboard.tsx` | O antigo ROI passa a se chamar retorno anual simples estabilizado. Entram ROI acumulado, paybacks, VPL, TIR, caixas acumulados, benefício anual, economia acumulada e investimento líquido. TIR ambígua aponta para o VPL. | `reference.test.ts`, dashboard |
| P1.1 Rampa e desembolso | `calculate.ts` | Curvas separadas de pessoas, logística, estoque e vendas. CAPEX por cronograma. | `reference.test.ts` rampa e go-live |
| P1.2 Captura | `calculate.ts` | Dispensação: cobertura × disponibilidade. Folha: reorganização, e zero se o robô está indisponível. Prateleira e ocupação: físico. Estoque: fração automatizada. Vendas: capacidade, atendimento e conversão. | `reference.test.ts` capacidade |
| P1.3 Espaço | `LogisticsForm.tsx`, `calculate.ts` | Aluguel, ocupação, expansão, área sem monetização e investimento imobiliário. Contrato inalterado não gera aluguel. Um único custo de ocupação. Margem entra na regra de vendas sobrepostas. | `calculate.test.ts` ocupação versus margem |
| P1.4 Inflação | `calculate.ts` | Índices de salário, OPEX e preço. Aviso se a demanda cresce e os custos correlatos ficam parados, ou se nominal e real se misturam. | `reference.test.ts` |
| P1.5 Drivers | `drivers.ts`, `premises.ts` | 15% é o mesmo número nas duas telas. | `reference.test.ts` equivalência |
| P1.6 Financiamento | `calculate.ts`, `InvestmentForm.tsx` | Fluxo do projeto intacto. Fluxo do investidor, TIR do capital próprio, serviço da dívida, saldo e custo financeiro. Financiamento não é benefício. | `calculate.test.ts`, `reference.test.ts` |
| P2.1 Caixas | `calculate.ts` | Componentes habilitáveis. Sem processo validado, fica fora e não é comprovável. | `calculate.test.ts`, `reference.test.ts` |
| P2.2 Prateleiras | `calculate.ts` | Nova: aquisição evitada. Existente: revenda, manutenção e remoção. Prateleira ainda necessária não entra. | `calculate.test.ts`, `reference.test.ts` |
| P2.3 Perdas e vendas | `calculate.ts` | Detalhe separa vencimento, avaria, extravio e erro e desliga a linha duplicada. Vendas só por margem. Sobreposição continua bloqueada. | `calculate.test.ts`, `reference.test.ts` |
| P2.4 Rede | `calculate.ts`, `ProfileForm.tsx` | Lojas com data, fator de investimento e volume. Paybacks individuais e VPL consolidado. Réplica linear permanece quando a rede escalonada está desligada. | `reference.test.ts` |
| Rastreio | `types.ts`, `AuditPanel.tsx` | Cada linha tem fórmula, origem, condição, acumulado e inclusão. | `premises.test.ts`, auditoria |
| Compatibilidade | `normalize.ts`, `storage.ts` | Versão 2 do navegador é lida e completada. Simulações não são apagadas. | `storage.test.ts` |

## Antes e depois

| Tema | Antes | Depois |
| --- | --- | --- |
| Exemplo base | 2.000.000 / 65.000 / 30,8 meses / 39% | Igual |
| Folha com disponibilidade 80% | Caía 20% junto com a dispensação | Permanece, se a reorganização está efetiva. Zera só com disponibilidade 0 |
| Imposto negativo | Crédito integral automático | Não. Só com política e capacidade explícitas |
| ROI na tela | "ROI anual simples" | "Retorno anual simples estabilizado", mais o ROI acumulado |
| Ajuste de salário | Só o custo da vaga | O mesmo pacote de mão de obra da sensibilidade |
| Ajuste de investimento | Só CAPEX bruto | CAPEX bruto e prateleira evitada. Zerar o robô não apaga a prateleira |
| Rede | Réplica linear | Réplica ou cronograma |

## O que muda o retorno

Não muda o exemplo fictício. Muda um caso real salvo se:

- a disponibilidade ou a cobertura eram menores que 100% (folha e espaço deixam de ser cortados pelo mesmo fator da dispensação);
- o imposto estava ligado e havia prejuízo fiscal (o crédito some);
- o ajuste rápido de investimento ou de mão de obra for reaplicado (a base do percentual ficou única);
- horas liberadas excedem a jornada de quem ficou;
- vagas evitadas excedem o quadro informado;
- a área comercial passa a concorrer com outra alavanca de venda;
- encargos, rampa, inflação, cronograma, rede ou detalhe de perdas forem preenchidos.

## Premissas para validar com o cliente

- Custo da vaga já inclui encargos e benefícios, ou os percentuais precisam ser informados.
- Vagas evitadas cabem no quadro e as horas liberadas cabem em quem permanece.
- Redução de estoque é operacional, não automática.
- Contrato de aluguel realmente muda antes de contar ocupação.
- Processo das caixas retornáveis foi validado com a logística.
- Prateleiras evitadas não são as que a loja ainda precisa.
- Cada ganho de venda tem evidência que não repete a mesma margem.
- Alíquota, prejuízo fiscal e depreciação foram vistos pela área fiscal.
- Taxa de desconto está na mesma base (nominal ou real) dos fluxos.
- Cronograma de rede, fatores de escala e custo compartilhado vieram de um plano de implantação.

## Limitações que permanecem

- Não é um modelo fiscal por regime (Lucro Real, Presumido ou Simples). A política é incremental e precisa de validação.
- A TIR continua uma raiz numérica. Com mais de uma troca de sinal ela é sinalizada, não enumerada.
- O exemplo fictício ainda soma perdas históricas e avarias, com aviso de possível sobreposição, para manter o checkpoint de 39%. O detalhamento é o caminho sem dupla contagem.
- A rede escalonada reutiliza a premissa da loja modelo e aplica fatores. Não é um orçamento loja a loja completo.
- Head-to-head continua com a DRE própria e só reaproveita VPL, TIR, payback e ROI.

## Como executar

```bash
npm install
npm test
npm run build
```

O build gera `dist/index.html`, `dist/headtohead/index.html` e `dist/calculos/index.html`. Este branch não deve ser mesclado nem publicado até a revisão.

## Testes

A suíte anterior (79) segue verde. `src/model/reference.test.ts` acrescenta os casos de referência com números calculados à mão: investimento zero e negativo, benefício negativo, payback fora de 60 meses, turnover zero e alto, vaga nenhuma, contratação no meio do horizonte, treinamento e recrutamento já inclusos, horas sem folha, disponibilidade zero, capacidade insuficiente, go-live, rampa, capital de giro revertido, prejuízo sem crédito, loja nova e existente, financiamento com e sem juros, vendas sobrepostas, caixas sem validação, equivalência de 15%, inflação e rede escalonada.
