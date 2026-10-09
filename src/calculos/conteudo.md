# gCalc — Como os cálculos são feitos

Documento da calculadora de ROI Gollmann (robô de armazenagem e dispensação para farmácias), a página em `/gCalc/`.

O texto descreve o motor em `src/model`: `evaluate`, `finance`, `drivers`, `normalize`, `example` e `premises`. As fórmulas seguem o mesmo critério de `docs/FINANCIAL_MODEL.md`. Os números do exemplo foram refeitos com `evaluate(exampleInputs())`. O rascunho head-to-head em `/gCalc/headtohead/` não entra aqui: ele monta uma DRE própria e só reaproveita VPL, TIR, payback e ROI. Os valores são fictícios, como o próprio app avisa.

## 1. Visão geral e fluxo de cálculo

Fonte: `src/model/calculate.ts`, função `evaluate(inputs, options)`; `src/App.tsx`.

O app roda inteiro no navegador (sem backend). A cada alteração, `App.tsx` chama `evaluate(inputs, { scenario })` e o dashboard recalcula. O horizonte é fixo em 60 meses (`HORIZON_MONTHS = 60`). Antes de calcular, `normalizeInputs` completa campos que faltam em simulações antigas com padrões neutros.

O fluxo que alimenta VPL, TIR, payback e retorno é o fluxo do projeto. Dívida, entrada e parcelas ficam num fluxo do investidor, à parte.

```
goLive        = mês de início da operação, entre 1 e 60
caixa(0) = −investimento líquido × parcela do cronograma na data zero
investimento líquido = CAPEX bruto − CAPEX evitado
operacional(m) = benefício(m) − OPEX(m) × índice de inflação
imposto(m)     = política tributária sobre (operacional − depreciação)
líquido(m)     = operacional − imposto
pontual(m)     = variação de capital de giro − rescisão − remoção
               + revenda + residual + recrutamento evitado
               + treinamento evitado + parcela posterior do CAPEX
incremental(m) = líquido(m) + pontual(m)
```

Sequência executada por `evaluate`:

- Lê o cenário (padrão "base") e seus fatores (`benefitFactor`, `opexFactor`, `capexFactor`, `salesFactor`), o tipo de loja e a taxa de desconto.
- Separa quatro capturas: dispensação (cobertura × disponibilidade), folha (reorganização; zero se a disponibilidade é zero), estoque (fração automatizada; zero se a disponibilidade é zero) e vendas (cobertura × disponibilidade × atendimento × conversão).
- Calcula CAPEX bruto, CAPEX evitado (prateleiras de loja nova, se ainda forem necessárias, mais investimento imobiliário evitado quando essa é a tese da área) e o cronograma de desembolso.
- Passa cada benefício por uma trava (`gateBenefit`): ligado/desligado, bloqueio anti-dupla-contagem e confiança comprovável/potencial.
- Aplica a curva da família (pessoas, logística, estoque, vendas) e o índice de salário, de OPEX ou de preço.
- Para cada mês 1..60, forma o resultado contábil, a base tributável, o imposto de caixa, o fluxo incremental, o acumulado e o acumulado descontado.
- Monta `cashFlows = [caixa na data zero, fluxo do mês 1, ..., fluxo do mês 60]` e calcula payback simples, payback descontado, retorno anual simples estabilizado, ROI acumulado, VPL e TIR anual efetiva.
- Gera a auditoria (o que entrou e o que ficou de fora), os avisos, o fluxo do investidor e a visão de rede.

A lógica é incremental: o modelo não projeta o custo total da loja sem robô e com robô. Ele calcula a diferença (custos evitados + margem incremental − OPEX). As colunas "custo sem robô" e "custo com robô" são uma reconstrução para exibição (seção 5). Benefício excluído soma zero no caixa. O OPEX não é reduzido pela captura.

O modo simples esconde premissas avançadas na tela. Não muda a fórmula: o que já estiver preenchido continua no cálculo.

## 2. Premissas de entrada por módulo

Fonte: `src/model/types.ts` (interface `Inputs`), `src/model/example.ts` (`EXAMPLE`). Percentuais são frações (0,32 = 32%). Os padrões abaixo são os do exemplo fictício.

Cada benefício tem `enabled` e `confidence` ("comprovavel" ou "potencial"). `assumptions.includePotential` (padrão: falso) decide se o potencial entra no caixa. `assumptions.viewMode` (padrão: "avancado") só muda a tela.

### 2.1 Perfil da farmácia (profile)

| Campo (código) | Rótulo na tela | Unidade | Padrão do exemplo | Usado no motor? |
|---|---|---|---|---|
| storeType | Tipo de loja | nova/existente | nova | Sim |
| monthlyRevenue | Faturamento mensal | R$ | 850.000 | Só em aviso |
| contributionMarginPct | Margem de contribuição | % | 32% | Sim (vendas) |
| attendancesPerDay | Atendimentos por dia | nº | 420 | Não |
| dispensationsPerDay | Dispensações por dia | nº/dia | 900 | Sim (cobertura) |
| operatingDaysPerMonth | Dias de operação no mês | dias | 26 | Não |
| roles | Cargos (cargo, pessoas, custo completo R$/pessoa/mês, escala) | lista | 4 cargos, 16 pessoas; farmacêutico R$ 8.500 (sugestão fictícia, a validar) | Sim (teto de vagas e orçamento de horas) |
| totalAreaM2 / backroomAreaM2 | Área total / Retaguarda | m² | 280 / 70 | Não |
| occupancyCostPerM2 | Aluguel ou ocupação de referência | R$/m² | 120 | Sim, só se o campo da logística for 0 |
| averageInventory | Estoque médio | R$ | 480.000 | Sim (capital de giro) |
| inventoryTurnsPerYear | Giro do estoque | x/ano | 8 | Não |
| skuCount | SKUs | nº | 6.500 | Não |
| historicalLossesMonthly | Perdas históricas | R$/mês | 18.000 | Sim |
| demandGrowthPctPerYear | Crescimento anual da demanda | %/ano | 0% | Sim |
| wageGrowthPctPerYear | Reajuste de salários | %/ano | 0% | Sim |
| opexInflationPctPerYear | Inflação de OPEX | %/ano | 0% | Sim |
| priceInflationPctPerYear | Inflação de preços | %/ano | 0% | Sim |
| moneyBasis | Base dos fluxos | nominal/real | nominal | Sim (aviso se divergir da taxa) |
| storeCount | Lojas na projeção | lojas | 1 | Sim (réplica linear, rede desligada) |

### 2.2 Pessoas / turnover (people)

| Bloco | Campos (código → rótulo) | Padrão do exemplo |
|---|---|---|
| payroll — Folha e encargos | positionsReduced → Vagas evitadas; monthlyCostPerPosition → Custo completo (R$/pessoa/mês, com encargos e benefícios); chargesPct → Encargos; benefitsPerPosition → Benefícios (R$); costConfirmedFullyLoaded; startMonth; severanceCost → Rescisão (R$, só loja existente) | ligado, comprovável; 6 vagas; R$ 9.200; encargos 0; benefícios 0; custo confirmado; mês 1; R$ 18.000 |
| journeyHoursPerMonth | Jornada mensal para o orçamento de horas | 176 h |
| reallocatedHours — Horas realocadas | hoursPerMonth; monetization (nenhuma, reducao_custo, ganho_incremental); costReductionMonthly; incrementalMarginMonthly; evidence | desligado; monetização nenhuma |
| futureHires — Contratações futuras | lista: role, month, headcount, monthlyCost. Só entra em loja existente | desligado; 1 auxiliar no mês 13, R$ 9.200 |
| recruitment — Recrutamento e seleção | costPerHire; includedInTurnoverCost | ligado, comprovável; R$ 3.500; incluso = sim |
| training — Treinamento e integração | costPerPerson (sugestão fictícia R$ 6.000 por contratação, a validar); includedInReplacementCost | ligado, comprovável; R$ 6.000; incluso = sim |
| turnover — Turnover evitado | annualRate; costMode (consolidado ou detalhado); costPerReplacement; components (recrutamento, treinamento do substituto, adaptação, desligamento, supervisão) | ligado, comprovável; 20% a.a.; consolidado; R$ 12.000; componentes 0 |
| supervision — Supervisão | hoursSavedPerMonth; costPerHour; alreadyCountedInPayroll | ligado, comprovável; 40 h; R$ 50; não |
| consultativeSales — Venda consultiva | hoursFreedPerMonth; marginPerHour; independentEvidence | ligado, potencial; 20 h; R$ 80; sem evidência |

### 2.3 Logística / infraestrutura (logistics)

| Bloco | Campos | Padrão do exemplo |
|---|---|---|
| boxes — Caixas retornáveis | cyclesAvoidedPerMonth; costPerCycle; processValidated; useDetailed e componentes (ciclos, transporte reverso, higienização, manuseio, perdas/reposição, espaço), cada um com valor e interruptor | ligado, potencial; 400 ciclos; R$ 8; processo não validado; detalhe desligado |
| shelving — Prateleiras | avoidedAcquisition; resaleValue; avoidedMaintenanceMonthly; stillRequired; removalCost | ligado, comprovável; R$ 180.000; R$ 25.000; R$ 1.500; ainda necessárias = não; remoção R$ 0 |
| space — Espaço | m2Freed; mode (ocupacao ou margem); treatment (ocupacao_evitavel, expansao_comercial, sem_monetizacao, investimento_imobiliario); contractUnchanged; occupancyCostPerM2; contributionPerM2Month; avoidedRealEstate; commercialEvidence | ligado, comprovável; 20 m²; ocupação; ocupação evitável; contrato muda; R$ 200; R$ 150; imobiliário 0; sem evidência comercial |
| movement — Movimentação | hoursSavedPerMonth; costPerHour; alreadyCountedInPayroll | ligado, comprovável; 32 h; R$ 50; não |
| inventoryCount — Inventário | hoursSavedPerMonth; costPerHour | ligado, comprovável; 20 h; R$ 50 |

### 2.4 Estoque / perdas / vendas (stock)

| Bloco | Campos | Padrão do exemplo |
|---|---|---|
| salesIndependenceConfirmed | confirma que as alavancas de venda não se sobrepõem | falso |
| losses — Perdas | projectedLossesMonthly; useDetailed; expiryMonthly, damageMonthly, missingMonthly, errorsMonthly | ligado, comprovável; R$ 8.000; detalhe desligado |
| shrinkage — Avarias, extravios e erros | avoidedMonthly | ligado, comprovável; R$ 5.000 |
| ruptures — Rupturas | additionalMonthlySales; independentEvidence | desligado, potencial; R$ 20.000 |
| serviceSpeed — Atendimento | additionalMonthlySales; independentEvidence | desligado, potencial; R$ 10.000 |
| abandonment — Abandono | additionalMonthlySales; independentEvidence | desligado, potencial; R$ 0 |
| workingCapital — Capital de giro | inventoryAfter; releaseMonth; treatment (liberacao_caixa ou custo_financeiro); costOfCapitalAnnual; reverseAtHorizon; reductionProven | desligado, comprovável; estoque depois igual ao atual (R$ 480.000); mês 3; liberação; 12% a.a.; não reverte; redução não comprovada |

### 2.5 Investimento, curvas e política tributária (robot)

| Grupo | Campos | Padrão do exemplo |
|---|---|---|
| capex | equipment 1.750.000; freightImportTaxes 140.000; installationTraining 90.000; civilElectrical 70.000; integration 50.000; implementationContingency 80.000 | Bruto R$ 2.180.000 |
| opexMonthly | manutenção, suporte e demais gastos recorrentes: maintenance 8.000; software 3.200; energy 1.500; downtime 700; insurance 1.100; other 500. Não inclui o preço do equipamento | R$ 15.000/mês |
| Operação | availabilityPct; capacityDispensationsPerDay; reorganizationEffectiveness; automatedStockShare; serviceLevel; conversionFactor; goLiveMonth | 100%; 1.500/dia; reorganização 100%; estoque automatizado 100%; atendimento 100%; conversão 100%; mês 1 |
| Curvas | ramp.people, ramp.logistics, ramp.stock, ramp.sales | [1] em cada família (100% no go-live) |
| Cronograma | capexSchedule: month e share | mês 0, parcela 1 |
| Fim de horizonte | residualValue; depreciationYears | R$ 0; 10 anos |
| Imposto | includeTax; taxRate; taxPolicy; lossUtilizationLimit; taxCapacityMonthly; taxBenefitValidated; taxValidated; extraordinaryEventsTaxable | desligado; 34%; sem_impostos; limite 0; capacidade 0; benefício não validado; premissa não validada; eventos extraordinários tributáveis |
| Taxa | discountRateAnnual; discountBasis | 12% a.a.; nominal |
| Financiamento | enabled; downPaymentPct; termMonths; annualInterest; balloon | desligado; 30%; 48 meses; 14% a.a.; R$ 0 |
| Rede | network.enabled; sharedMonthlyCost; stores (nome, tipo, data, fatores de investimento, volume e mão de obra, quantidade) | desligada |

A alíquota de 34% é só um campo editável. Não é recomendação para qualquer regime.

### 2.6 Cenários (scenarios)

| Cenário | benefitFactor | salesFactor | opexFactor | capexFactor |
|---|---|---|---|---|
| Conservador | 0,80 | 0,60 | 1,15 | 1,08 |
| Base | 1,00 | 1,00 | 1,00 | 1,00 |
| Otimista | 1,12 | 1,20 | 0,92 | 0,97 |

## 3. Fórmulas de cada benefício

Fonte: closures de `evaluate` em `src/model/calculate.ts`.

### 3.1 Fatores comuns

```
goLive        = clamp(round(goLiveMonth) || 1, 1, 60)
dispensações  = max(0, dispensationsPerDay × volumeFactor)
cobertura     = se capacidade ≤ 0: 0
                senão se dispensações ≤ 0: 1
                senão: min(1, capacidade / dispensações)
disponib.     = clamp(availabilityPct, 0, 1)
captura de dispensação = cobertura × disponib.
captura de folha       = 0 se disponib. ≤ 0; senão reorganização (0 a 1)
captura de estoque     = 0 se disponib. ≤ 0; senão fração de estoque automatizado
captura de vendas      = cobertura × disponib. × atendimento × conversão
rampa(família, m) = 0 se m < goLive
                    senão o patamar do mês (m − goLive), ou o último, limitado a 0–1
índice(taxa, m)   = 1 se a taxa é 0; senão (1 + taxa) ^ ((m − 1) / 12)
crescimento(m)    = índice da demanda
volume(m)         = volumeFactor × crescimento(m)
```

Curva vazia vale 1 depois do go-live. O exemplo usa [1], então a rampa é um degrau de 100%.

Horas reivindicadas (supervisão e movimentação só se ainda não estão na folha, mais inventário, consultiva e horas realocadas) não podem passar de `(quadro − vagas) × jornada`. O excedente é cortado por `hourScale`. Sem quadro informado, não há teto.

Vagas da folha não passam do quadro quando o quadro é maior que zero. Custo completo da vaga = `custo × (1 + encargos) + benefícios`.

| Família | O que a curva multiplica |
|---|---|
| Pessoas | Folha, contratações futuras, turnover, supervisão, horas realocadas |
| Logística | Caixas, manutenção de prateleiras, ocupação, movimentação, inventário |
| Estoque | Perdas, avarias e custo financeiro do estoque |
| Vendas | Rupturas, atendimento, abandono, consultiva e margem de área |

### 3.2 Três vias de mão de obra

```
Folha(m) = min(vagas, quadro) × custo completo × laborFactor
           × captura de folha × rampa de pessoas × índice salarial × benefitFactor
           a partir de m ≥ max(goLive, startMonth)
           o teto extra é a folha do quadro, quando o quadro existe

Contratações futuras(m) = 0 em loja nova
                          em loja existente, Σ (vagas_h × custo_h × laborFactor)
                          × captura de folha × rampa de pessoas × índice salarial × benefitFactor
                          só para vagas com m ≥ mês_h e m ≥ goLive

Turnover(m) = posições expostas × taxa anual × turnoverFactor × custo da substituição × laborFactor / 12
              × captura de folha × rampa de pessoas × benefitFactor
posições expostas = vagas da folha (se a folha entrou e m ≥ startMonth) + futuras já ativas

Supervisão(m) = horas × hourScale × custo da hora × laborFactor
                × captura de folha × rampa de pessoas × índice salarial × benefitFactor
```

O turnover não recebe o índice salarial. O custo da substituição é o valor consolidado ou a soma dos componentes (recrutamento, treinamento do substituto, adaptação, desligamento, supervisão). Nunca os dois.

Horas realocadas não são folha. Com monetização "nenhuma", ficam fora. "reducao_custo" usa `costReductionMonthly`. "ganho_incremental" só entra com evidência. O valor passa por `hourScale`, captura de folha, rampa de pessoas e índice salarial.

Recrutamento e treinamento iniciais são eventos pontuais, não o custo mensal de substituição:

```
unidade = round2(custo unitário × laborFactor)
Loja nova e folha incluída: no mês max(goLive, startMonth), vagas informadas × unidade
Contratações futuras incluídas, só em loja existente: no mês max(goLive, mês_h), vagas_h × unidade
```

Esses eventos não passam por captura, rampa nem `benefitFactor`. A folha mensal usa as vagas já limitadas ao quadro; o evento pontual de recrutamento e treinamento da folha usa as vagas informadas.

### 3.3 Logística, caixas, prateleiras e espaço

```
Caixas(m), modo consolidado = ciclos × custo por ciclo × volume(m)
                              × captura de dispensação × rampa de logística × benefitFactor

Caixas(m), modo detalhado = só os componentes ligados
                            a parcela de ciclos cresce com volume(m)
                            transporte, higienização, manuseio, perdas e espaço são valores mensais
                            a linha consolidada não entra junto

Manutenção de prateleiras(m) = manutenção mensal × rampa de logística × índice de OPEX × benefitFactor
                               só loja existente, e só se a prateleira deixa de ser necessária

Ocupação(m) = m² × taxa × rampa de logística × benefitFactor
              taxa = custo por m² da logística, se for > 0; senão o do perfil
              não usa a captura de dispensação

Margem de área(m) = m² × margem por m² × rampa de logística × índice de preço
                    × benefitFactor × salesFactor
                    entra como alavanca de venda, nunca somada à ocupação

Movimentação(m) = horas × hourScale × custo da hora × laborFactor × volume(m)
                  × captura de dispensação × rampa de logística × índice salarial × benefitFactor

Inventário(m) = horas × hourScale × custo da hora × laborFactor
                × captura de estoque × rampa de logística × índice salarial × benefitFactor
```

Ocupação e margem da mesma área não se somam. `mode = margem` ou `treatment = expansao_comercial` trata a área como margem. Contrato inalterado bloqueia aluguel e ocupação. "sem_monetizacao" e "investimento_imobiliario" não geram caixa mensal. O investimento imobiliário evitado, em loja nova, abate o CAPEX.

Prateleira ainda necessária (`stillRequired`) bloqueia aquisição evitada, revenda, manutenção e remoção. Remoção é saída de caixa no go-live da loja existente. Aquisição evitada só em loja nova. Revenda e manutenção só em loja existente.

Caixas exigem `processValidated`. Sem isso o benefício fica de fora, mesmo ligado: o robô não elimina a caixa do fornecedor sozinho.

### 3.4 Perdas e avarias

```
Históricas(m) = perdas históricas × volume(m) × captura de estoque × rampa de estoque
Projetadas(m) = perdas projetadas × volume(m) × captura de estoque × rampa de estoque
Perdas(m), modo simples = max(0, históricas − projetadas) × benefitFactor
Perdas(m), modo detalhado = (vencimento + avaria + extravio + erro)
                            × volume(m) × captura de estoque × rampa de estoque
                            × índice de preço × benefitFactor
Avarias(m) = evitado mensal × volume(m) × captura de estoque × rampa de estoque
             × índice de preço × benefitFactor
```

No modo detalhado a linha de avarias separada fica bloqueada, e o par histórico − projetado não entra. No modo simples as duas linhas podem conviver: o exemplo faz isso de propósito e o motor emite aviso de sobreposição.

### 3.5 Vendas

A monetização é margem de contribuição, não faturamento.

```
marginOf(vendas, m) = vendas × margem de contribuição × volume(m)
                      × captura de vendas × rampa de vendas × índice de preço
                      × benefitFactor × salesFactor
Rupturas, atendimento e abandono usam marginOf
Consultiva(m) = horas × hourScale × margem por hora × crescimento(m)
                × captura de vendas × rampa de vendas × índice de preço
                × benefitFactor × salesFactor
```

A consultiva usa `crescimento(m)`, não `volume(m)`: não reage ao fator de volume da sensibilidade.

Se mais de uma alavanca de venda passa na trava e `salesIndependenceConfirmed` é falso, só fica a de maior valor no mês 60. As candidatas são consultiva, rupturas, atendimento, abandono e margem de área.

### 3.6 Capital de giro

```
liberação = max(0, estoque antes − estoque depois), se reductionProven
            senão 0
            o padrão é reductionProven falso: não se presume queda
            o robô pode até aumentar o estoque
            não é escalada por volume nem por captura
Principal = liberação no mês max(goLive, releaseMonth)
            e −liberação no mês 60, se reverseAtHorizon e a entrada não foi no mês 60
Custo financeiro mensal = liberação × taxa anual × benefitFactor / 12
                          × rampa de estoque × índice de preço, a partir do go-live
```

Os dois tratamentos não se somam. Quando o principal entra no fluxo, a leitura de custo financeiro permanece informativa: o VPL já remunera o capital. Sem `reductionProven`, nada entra no caixa.

### 3.7 Benefício operacional do mês

```
Benefício(m) = Folha + Contratações futuras + Turnover + Supervisão + Horas realocadas
             + Caixas + Manutenção + Ocupação + Movimentação + Inventário
             + Perdas + Avarias + Vendas
             + Custo financeiro do estoque
```

Margem de área já está dentro de Vendas. Ocupação mensal não entra quando a tese é margem.

## 4. CAPEX, OPEX, tributos e financiamento

Fonte: `evaluate`, `residualAt`, `buildFinancing`.

```
capexMultiplier = capexFactor da sensibilidade × capexFactor do cenário
CAPEX bruto     = round2(soma dos 6 itens × capexMultiplier)
CAPEX evitado   = prateleiras (loja nova, incluídas, ainda não necessárias)
                + investimento imobiliário (loja nova, tratamento correspondente, incluído)
Investimento líquido = round2(CAPEX bruto − CAPEX evitado)
Parcelas do cronograma são normalizadas para somar 1
Caixa na data zero = 0 se o líquido é 0
                     senão −líquido × parcela do mês 0
OPEX base = round2(soma dos 6 itens × opexFactor do cenário)
OPEX(m)   = 0 antes do go-live
            senão OPEX base × índice de inflação de OPEX
```

O OPEX é manutenção, suporte e o que se repete todo mês. O preço do equipamento está só no CAPEX. Se o OPEX anual passa de 20% do CAPEX bruto, ou se há OPEX sem CAPEX, o motor avisa: o preço do robô pode ter sido lançado no lugar errado.

Parcelas posteriores ao mês 0 saem em `pontual(m)`, não na data zero. O exemplo desembolsa 100% na data zero.

Depreciação linear, só quando o imposto está ligado:

```
meses de depreciação = max(1, round(depreciationYears × 12))
Depreciação(m) = investimento líquido / meses, do go-live até esgotar a vida
```

A depreciação reduz a base e não sai do caixa. Resultado contábil, base tributável e imposto de caixa são campos separados do mês.

Política efetiva: imposto desligado força "sem impostos". Imposto ligado com política "sem impostos" vira "incremental simplificado".

```
base = operacional − depreciação

sem impostos
  imposto de caixa = 0

incremental simplificado
  imposto = max(0, base) × alíquota

prejuízo com limite
  base negativa aumenta o saldo de prejuízo e o imposto de caixa é 0
  base positiva usa min(saldo, base × limite) e tributa o que sobra

benefício condicionado
  imposto positivo = base × alíquota
  imposto negativo só se o benefício foi validado, e no máximo a capacidade mensal
```

Valor residual no mês 60 entra cheio se não há imposto, se os eventos extraordinários não são tributáveis, ou se o residual é zero. Caso contrário entra `residual − (residual − valor contábil) × alíquota`.

Financiamento não altera o fluxo do projeto. Por isso VPL, TIR, payback e retorno do projeto ficam iguais com ou sem dívida.

```
principal = max(0, investimento líquido) × (1 − entrada)
parcela   = Price com balão; se o juro mensal é 0, (principal − balão) / prazo
fluxo do investidor na data zero = fluxo do projeto + principal recebido
nos meses do prazo, subtrai a parcela; no fim do prazo, subtrai o balão
custo financeiro total = entrada + parcelas + balão − investimento líquido
TIR do capital próprio = TIR anual do fluxo do investidor, quando existe
```

O principal recebido não é benefício operacional. A tela mostra VPL e TIR do projeto, TIR do capital próprio, serviço da dívida, saldo devedor e custo financeiro total.

## 5. Construção dos fluxos de 60 meses

Para cada mês m de 1 a 60:

```
benefício     = Benefício(m)
opex          = OPEX(m)
antesImposto  = benefício − opex          (resultado contábil)
imposto       = política da seção 4
operacional   = antesImposto − imposto
pontual       = capital de giro − rescisão − remoção + revenda
              + residual + recrutamento + treinamento + parcela de CAPEX
incremental   = operacional + pontual
acumulado     = acumulado anterior + incremental
descontado    = incremental / (1 + taxa mensal) ^ m
```

A taxa mensal é `(1 + taxa anual) ^ (1/12) − 1`. Com 12% a.a., cerca de 0,9489% a.m. O índice 0 não é descontado. O mês m é descontado a fim de mês. Cada etapa usa `round2`.

Colunas de exibição:

```
perdas hist. exib. = históricas(m) × benefitFactor, se as perdas entraram e m ≥ goLive
perdas proj. exib. = min(projetadas, históricas) × benefitFactor
custo sem robô     = (benefício − vendas) − perdas evitadas + perdas hist. exib.
custo com robô     = perdas proj. exib. + opex
```

Assim, custo sem robô − custo com robô + margem de vendas = benefício − OPEX. Não é o custo total da loja.

## 6. Indicadores

Fonte: `src/model/finance.ts` e o bloco `indicators` de `evaluate`. O campo antigo `roi` continua igual ao retorno estabilizado.

```
VPL = Σ fluxo(t) / (1 + i_m) ^ t, t de 0 a 60
TIR anual efetiva = (1 + TIR mensal) ^ 12 − 1
Payback simples = (t − 1) + (−acumulado anterior / fluxo do mês t)
Payback descontado = a mesma interpolação no caixa descontado
Retorno anual simples estabilizado = (líquido do mês 60 × 12) / investimento líquido
ROI acumulado em 60 meses = soma do operacional líquido / investimento líquido
Benefício operacional anual = benefício bruto do mês 60 × 12
Economia acumulada = soma do benefício bruto no horizonte
Caixa acumulado = acumulado do mês 60, já com a data zero
Investimento líquido total = CAPEX bruto − CAPEX evitado
```

| Nome na tela | O que é | O que não é |
|---|---|---|
| Retorno anual simples estabilizado | Run-rate do mês 60, anualizado, sobre o investimento líquido | Retorno acumulado, TIR ou média do período |
| ROI acumulado em 60 meses | Soma dos operacionais líquidos dividida pelo investimento | Payback nem VPL |
| Payback simples | Meses até o caixa acumulado cruzar zero | Não desconta |
| Payback descontado | A mesma conta no caixa descontado | Não é o VPL |
| VPL | Valor presente do fluxo do projeto | Não inclui a dívida |
| TIR anual efetiva | Taxa anual equivalente que zera o VPL do projeto | Ambígua se o fluxo troca de sinal mais de uma vez |

Casos extremos, como o código trata:

- Investimento líquido zero: retorno nulo, payback "Imediato", TIR "Indefinida", VPL finito.
- Investimento líquido negativo: retorno nulo, payback "Imediato", aviso de CAPEX evitado maior que o bruto.
- Sem recuperação em 60 meses: payback nulo, texto "Não recupera em 60 meses".
- TIR inexistente (sem fluxo positivo e negativo, ou sem raiz): "Indefinida". Newton-Raphson a partir de 1% a.m.; se falhar, bisseção.
- Mais de uma troca de sinal (`signChanges > 1`): `irrAmbiguous`. A decisão usa o VPL.
- Taxa anual ≤ −100%: taxa mensal indefinida, VPL e payback descontado não são calculados.

## 7. Cenários, loja e rede

| Item | Loja nova | Loja existente |
|---|---|---|
| Prateleiras — aquisição evitada | Abate o CAPEX, se ainda não forem necessárias | Não entra |
| Prateleiras — revenda | Não entra | Entrada no go-live |
| Prateleiras — manutenção evitada | Não entra | Benefício recorrente |
| Prateleiras — remoção | Não entra | Saída no go-live |
| Rescisão | Não entra | Saída em max(goLive, startMonth) |
| Recrutamento e treinamento das vagas da folha | Entram, se não bloqueados | Não entram |
| Recrutamento e treinamento de contratações futuras | Entram | Entram |
| Investimento imobiliário evitado | Abate o CAPEX, se essa for a tese | Não entra |

`benefitFactor` multiplica os benefícios recorrentes. `salesFactor` multiplica só as alavancas de venda, além do `benefitFactor`. No conservador a venda fica com 0,80 × 0,60 = 0,48 do valor base. `opexFactor` multiplica o OPEX. `capexFactor` multiplica CAPEX bruto, CAPEX evitado e valor residual.

Não recebem fator de cenário: rescisão, remoção, revenda, recrutamento, treinamento e o principal do capital de giro.

Rede desligada: `storeCount` replica investimento, líquido mensal e VPL. Payback e retorno ficam os da loja. Rede ligada, com ao menos uma unidade: cada loja é avaliada com o próprio tipo, data, fator de investimento, volume e mão de obra. O custo compartilhado sai uma vez por mês, nos meses 1 a 60. O payback de cada loja é o dela, então unidades com investimentos diferentes podem ter paybacks diferentes. O painel principal continua mostrando a loja corrente; o cartão de rede mostra a visão escalonada.

## 8. Regras anti-dupla-contagem e travas

Ordem da trava: (1) desligado; (2) bloqueio específico; (3) potencial com `includePotential` falso; (4) entra.

| Regra | O que o código faz |
|---|---|
| Recrutamento já no turnover | `includedInTurnoverCost`, ou modo detalhado com componente de recrutamento > 0, bloqueia o evento |
| Treinamento já no custo de substituição | `includedInReplacementCost`, ou modo detalhado com treinamento do substituto > 0, bloqueia o evento |
| Custo de turnover | Consolidado usa `costPerReplacement` e ignora componentes; detalhado soma componentes e ignora o consolidado |
| Supervisão ou movimentação já na folha | `alreadyCountedInPayroll` bloqueia a linha |
| Horas acima da jornada de quem ficou | `hourScale` < 1 corta o excedente; aviso |
| Vagas acima do quadro | A folha mensal fica no quadro; aviso |
| Horas realocadas | Não viram folha. Sem monetização, ou sem evidência no ganho incremental, ficam fora |
| Vendas sobrepostas | Sem independência confirmada, só a maior no mês 60 |
| Caixas | Exigem processo validado. No detalhe, só componentes ligados |
| Prateleira ainda necessária | Não gera CAPEX evitado, revenda, manutenção nem remoção |
| Espaço | Ocupação ou margem, nunca os dois. Contrato inalterado bloqueia aluguel. Sem monetização fica só na auditoria |
| Perdas detalhadas | Substituem histórico − projetado e bloqueiam a linha de avarias |
| Capital de giro | Principal ou custo financeiro. Sem redução comprovada, os dois ficam de fora |
| Disponibilidade zero | Zera folha, estoque, dispensação e vendas. OPEX continua |
| Disponibilidade parcial | Não corta a folha se a reorganização continua. Corta dispensação, logística de volume e vendas |
| Financiamento | Não muda VPL, TIR, retorno nem payback do projeto |
| Ganhos potenciais | Ficam de fora até `includePotential` |

No exemplo, ficam fora: venda consultiva (potencial e sem evidência), caixas (potencial e processo não validado), recrutamento e treinamento (já inclusos), rupturas, atendimento, abandono e capital de giro (desligados) e contratações futuras (desligadas). Perdas e avarias entram juntas, com aviso de possível sobreposição.

A auditoria de cada linha guarda identificador, nome, fórmula, premissas, unidade, origem, classificação, condição, valor mensal, valor acumulado, mês de início, fator de captura, inclusão ou exclusão com justificativa, dependências e conflitos. Linha excluída não altera o fluxo. O valor mensal pode aparecer mesmo assim, com `includedInCashFlow` falso.

## 9. Ajuste rápido e sensibilidade

As duas telas chamam o mesmo par `projectDriver` / `applyDriver` (`src/model/drivers.ts`). Quinze por cento é o mesmo percentual nas duas. A sensibilidade faz `evaluate(applyDriver(normalize(inputs), driver, 1 + delta), { scenario, skipNetwork: true })` com `SENSITIVITY_DELTAS = [−0,30; −0,15; 0; +0,15; +0,30]`.

### 9.1 Ajuste rápido

O slider vai de −100% a +30% (`ADJUST_MIN = −1`, `ADJUST_MAX = 0,3`, passo 5%). O campo numérico aceita zero e valores acima de +30%. Sem base positiva, slider e botões ficam desativados. A alavanca da tela continua com o id `salarios`; o rótulo é "Mão de obra" e o driver é `maoDeObra`.

| Alavanca | Driver | O que muda |
|---|---|---|
| Investimento do robô | investimento | Os 6 itens de CAPEX. Com fator > 0, a aquisição evitada de prateleiras escala junto. Com fator 0, o CAPEX do robô zera e a prateleira evitada permanece |
| OPEX | opex | Os 6 itens de OPEX |
| Mão de obra | maoDeObra | Custo da vaga, benefícios, custo das futuras, custo de turnover e componentes, horas de supervisão, movimentação e inventário, recrutamento, treinamento e valores monetizados das horas realocadas |
| Turnover | turnover | Só a taxa anual |
| Volume | volume | Dispensações, perdas históricas e projetadas, componentes detalhados de perda, avarias, ciclos de caixa e horas de movimentação. Não escala o estoque do capital de giro |
| Vendas | vendas | Rupturas, atendimento, abandono, margem por hora da consultiva e, se o modo é margem, a margem por m² |
| Taxa de desconto | desconto | Só `discountRateAnnual`. Não muda o retorno estabilizado nem o payback simples |
| Disponibilidade | disponibilidade | `availabilityPct`, limitado a 0–1 |
| Cobertura do estoque | cobertura | `automatedStockShare`, limitado a 0–1 |

### 9.2 Sensibilidade do exemplo

Cenário base, loja nova. Payback simples. Conferido com `sensitivity(exampleInputs(), 'base')`.

| Driver | −30% | −15% | 0 | +15% | +30% |
|---|---|---|---|---|---|
| Investimento | 21,5 m | 26,2 m | 30,8 m | 35,4 m | 40,0 m |
| OPEX | 28,8 m | 29,7 m | 30,8 m | 31,9 m | 33,1 m |
| Mão de obra | 42,8 m | 35,8 m | 30,8 m | 27,0 m | 24,0 m |
| Turnover | 30,9 m | 30,9 m | 30,8 m | 30,7 m | 30,6 m |
| Volume | 33,3 m | 32,0 m | 30,8 m | 29,6 m | 28,6 m |
| Vendas | 30,8 m | 30,8 m | 30,8 m | 30,8 m | 30,8 m |
| Desconto | 30,8 m | 30,8 m | 30,8 m | 30,8 m | 30,8 m |
| Disponibilidade | 31,0 m | 30,9 m | 30,8 m | 30,8 m | 30,8 m |
| Cobertura do estoque | 33,2 m | 31,9 m | 30,8 m | 30,8 m | 30,8 m |

Vendas não movem o exemplo porque nenhuma margem de venda entra no fluxo. Desconto não move o payback simples; move VPL e payback descontado. Disponibilidade e cobertura já estão em 100% no exemplo, então +15% e +30% batem no teto e o payback fica no centro. A queda de disponibilidade quase não muda o payback porque a folha não é cortada enquanto a disponibilidade é maior que zero. A cobertura corta perdas, avarias e inventário.

## 10. Exemplo numérico ilustrativo

Fonte: `src/model/example.ts` e `calculate.test.ts`. Cenário base, loja nova, dados fictícios. Curvas em 100%, sem inflação, sem imposto, rede desligada, capturas em 1, encargos e benefícios zero. Por isso os indicadores clássicos continuam os mesmos de antes da auditoria.

Quadro de 16 pessoas, 6 vagas evitadas, jornada 176 h. Horas reivindicadas no exemplo somam 112, abaixo das 1.760 h de quem permanece, então `hourScale = 1`.

| Benefício (mês 1 a 60) | Fórmula | R$/mês |
|---|---|---|
| Folha e encargos | 6 × 9.200 | 55.200 |
| Turnover | 6 × 20% × 12.000 / 12 | 1.200 |
| Supervisão | 40 h × 50 | 2.000 |
| Espaço (ocupação) | 20 m² × 200 | 4.000 |
| Movimentação | 32 h × 50 | 1.600 |
| Inventário | 20 h × 50 | 1.000 |
| Perdas evitadas | 18.000 − 8.000 | 10.000 |
| Avarias | 5.000 | 5.000 |
| Benefício bruto | soma | 80.000 |
| OPEX do robô | 8.000 + 3.200 + 1.500 + 700 + 1.100 + 500 | −15.000 |
| Benefício líquido | 80.000 − 15.000 | 65.000 |

| Indicador | Cálculo | Resultado |
|---|---|---|
| CAPEX bruto | soma dos 6 itens | R$ 2.180.000 |
| CAPEX evitado (prateleiras, loja nova) | 180.000 | R$ 180.000 |
| Investimento líquido | 2.180.000 − 180.000 | R$ 2.000.000 |
| Benefício operacional anual | 80.000 × 12 | R$ 960.000 |
| Economia acumulada em 60 meses | 80.000 × 60 | R$ 4.800.000 |
| Operacional líquido anual (mês 60 × 12) | 65.000 × 12 | R$ 780.000 |
| Retorno anual simples estabilizado | 780.000 / 2.000.000 | 39% |
| ROI acumulado em 60 meses | (65.000 × 60) / 2.000.000 | 195% |
| Caixa acumulado | −2.000.000 + 65.000 × 60 | R$ 1.900.000 |
| Payback simples | 2.000.000 / 65.000 | 30,8 meses (acumulado positivo no mês 31) |
| Payback descontado (12% a.a.) | interpolação dos fluxos descontados | 36,6 meses (positivo no mês 37) |
| VPL (12% a.a.) | Σ fluxos descontados | R$ 963.206,66 |
| Caixa descontado acumulado | mesma soma, neste exemplo plano | R$ 963.206,66 |
| TIR | mensal ≈ 2,52% | anual 34,8% |

O retorno de 39% é o run-rate estabilizado. Não é o retorno acumulado. O acumulado do exemplo é 195% porque sessenta meses de R$ 65.000 cobrem o investimento 1,95 vez. Nenhum dos dois é a TIR.

Fora do fluxo no exemplo (aparecem na auditoria): venda consultiva (R$ 1.600/mês potencial), rupturas (R$ 6.400/mês = 20.000 × 32%) e atendimento (R$ 3.200/mês), caixas, recrutamento, treinamento, capital de giro e horas realocadas.

| Cenário / loja | Inv. líquido | Líquido/mês | Payback | Retorno estabilizado | VPL | TIR a.a. |
|---|---|---|---|---|---|---|
| Conservador / nova | 2.160.000 | 46.750 | 46,2 m | 26,0% | −28.771 | 11,4% |
| Base / nova | 2.000.000 | 65.000 | 30,8 m | 39,0% | 963.207 | 34,8% |
| Otimista / nova | 1.940.000 | 75.800 | 25,6 m | 46,9% | 1.515.555 | 48,9% |
| Conservador / existente | 2.354.400 | 47.950 | 49,0 m | 24,4% | −161.531 | 8,6% |
| Base / existente | 2.180.000 | 66.500 | 32,7 m | 36,6% | 858.523 | 30,7% |
| Otimista / existente | 2.114.600 | 77.480 | 27,2 m | 44,0% | 1.424.477 | 43,9% |

Na loja existente base: sem CAPEX evitado (investimento R$ 2.180.000), manutenção de prateleiras +R$ 1.500/mês (líquido R$ 66.500) e, no mês 1, revenda de R$ 25.000 menos rescisão de R$ 18.000 (+R$ 7.000 pontual).

## 11. Limitações e pontos de atenção

O que o código ainda faz, e o que deixou de fazer:

- Há curvas por família e cronograma de CAPEX. O exemplo usa degrau de 100% e desembolso inteiro na data zero. Um go-live posterior continua sem benefício e sem OPEX antes dele; o CAPEX segue o cronograma, não o go-live.
- Há índices de salário, de OPEX e de preço. No exemplo estão em zero. Se a demanda cresce e salários e OPEX ficam parados numa base nominal, o motor avisa. Se a base dos fluxos e a base da taxa de desconto divergem, o motor avisa.
- O retorno estabilizado usa o mês 60. Com crescimento, não é a média do período.
- Continuam fora do cálculo: atendimentos por dia, dias de operação, área total, retaguarda, giro e SKUs. O faturamento só gera aviso. Os cargos entram no teto de vagas e no orçamento de horas.
- A ocupação usa o R$/m² da logística quando ele é maior que zero (R$ 200 no exemplo). O do perfil (R$ 120) é reserva. O formulário de logística grava os dois com o mesmo número.
- Fatores de cenário não se aplicam a rescisão, remoção, revenda, recrutamento, treinamento nem ao principal do capital de giro. A liberação de giro também não passa por captura nem por volume.
- Vendas recebem `benefitFactor` e `salesFactor` ao mesmo tempo.
- A consultiva não recebe o driver de volume.
- O exemplo soma perdas (R$ 10.000) e avarias (R$ 5.000). Há aviso. O caminho sem essa soma é o detalhamento de perdas.
- Imposto: prejuízo não vira crédito sozinho. A política é configurável e pede validação fiscal. 34% não é premissa de regime.
- A TIR com mais de uma troca de sinal fica marcada como ambígua. A decisão usa o VPL.
- A coluna descontada da tabela é arredondada mês a mês. VPL e payback descontado usam os fluxos e só arredondam o resultado. Pode haver diferença de centavos. No exemplo plano os dois fecham em R$ 963.206,66.
- A auditoria mostra valor mensal também do que ficou de fora. A marcação de inclusão é que decide o caixa.
- Rede desligada replica a loja em linha reta. Rede ligada desloca cada unidade para a data dela e pode produzir paybacks diferentes.
- No assistente, CAPEX além do robô vai para "Implantação e contingência" e o OPEX total vai para "Manutenção". Os totais não mudam; a distribuição que o ajuste rápido escala muda.
- O assistente valida faixas. O motor não recusa entrada: perdas projetadas acima das históricas zeram a economia de perdas e geram aviso.
- Simulações salvas na versão 2 da biblioteca são mantidas. Campos novos recebem padrão neutro (curva 100%, imposto como estava). Se a simulação antiga não diz se a queda de estoque foi comprovada, o padrão agora é não presumir redução.
- Há três modelos fictícios de loja (R$ 1, 2 e 4 milhões de faturamento mensal) para carregar com um clique. Não são dados do DPSP.
- Cada módulo e o assistente têm um texto recolhível, “O que esta tela calcula”, para quem não vai ler esta página.
