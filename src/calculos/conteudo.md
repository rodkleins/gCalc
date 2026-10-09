# gCalc — Como os cálculos são feitos (modelo atual)

Documento da calculadora de ROI Gollmann (robô de armazenagem e dispensação para farmácias), a página em `/gCalc/`.

O texto descreve o motor em `src/model`: `evaluate`, `finance`, `example`, `premises` e as telas que mostram esses resultados. As fórmulas e os números do exemplo foram conferidos com esse código. O rascunho head-to-head em `/gCalc/headtohead/` não entra aqui: ele monta uma DRE própria e só reaproveita VPL, TIR, payback e ROI. Os valores são fictícios, como o próprio app avisa.

## 1. Visão geral e fluxo de cálculo

Fonte: src/model/calculate.ts, função evaluate(inputs, options); src/App.tsx.

O app roda inteiro no navegador (sem backend). A cada alteração, App.tsx chama evaluate(inputs, { scenario }) e o dashboard recalcula. O horizonte é fixo em 60 meses (HORIZON_MONTHS = 60, em src/model/types.ts).

Sequência executada por evaluate:

- Lê o cenário (padrão "base") e seus fatores (benefitFactor, opexFactor, capexFactor, salesFactor), o tipo de loja (inputs.profile.storeType ou storeTypeOverride) e os fatores opcionais de sensibilidade (laborFactor, turnoverFactor, salesFactor, volumeFactor, capexFactor; padrão 1).
- Calcula o fator de captura do robô: capture = cobertura de capacidade × disponibilidade.
- Calcula CAPEX bruto, CAPEX evitado (prateleiras, só loja nova), investimento líquido e OPEX mensal.
- Passa cada benefício por uma "trava" (gateBenefit): ligado/desligado, bloqueio anti-dupla-contagem e confiança comprovável/potencial.
- Para cada mês 1..60, soma os benefícios recorrentes, subtrai o OPEX, aplica imposto (se ligado), soma os eventos pontuais (capital de giro, rescisão, revenda, valor residual, recrutamento/treinamento evitados) e forma o fluxo incremental, o acumulado e o acumulado descontado.
- Monta o vetor cashFlows = [caixa na data zero, fluxo do mês 1, ..., fluxo do mês 60] e calcula payback simples e descontado, ROI, VPL e TIR.
- Gera a auditoria (o que entrou e o que ficou de fora, com motivo), os avisos, a visão de financiamento (à parte) e a visão de rede (multiplicação pelo número de lojas).

A lógica é incremental: o modelo não projeta o custo total da loja sem robô e com robô. Ele calcula diretamente a diferença (custos evitados + margem incremental − OPEX). Os campos "custo sem robô" e "custo com robô" do fluxo são uma reconstrução para exibição (ver seção 5).

## 2. Premissas de entrada por módulo

Fonte: src/model/types.ts (interface Inputs), src/model/example.ts (EXAMPLE), rótulos em src/components/ProfileForm.tsx, PeopleForm.tsx, LogisticsForm.tsx, StockForm.tsx, InvestmentForm.tsx. Percentuais são guardados como fração (0,32 = 32%). Os padrões abaixo são os do exemplo fictício carregado ao abrir o app.

Cada benefício tem enabled (ligado/desligado) e confidence ("comprovavel" ou "potencial"). Há ainda a opção global assumptions.includePotential (padrão: falso).

### 2.1 Perfil da farmácia (profile)

| Campo (código) | Rótulo na tela | Unidade | Padrão do exemplo | Usado no motor? |
|---|---|---|---|---|
| storeType | Tipo de loja | nova/existente | nova | Sim |
| monthlyRevenue | Faturamento mensal | R$ | 850.000 | Só em aviso |
| contributionMarginPct | Margem de contribuição | % | 32% | Sim (vendas) |
| attendancesPerDay | Atendimentos por dia | nº | 420 | Não |
| dispensationsPerDay | Dispensações por dia | nº/dia | 900 | Sim (cobertura) |
| operatingDaysPerMonth | Dias de operação no mês | dias | 26 | Não |
| roles | Cargos (cargo, pessoas, custo completo, escala) | lista | 4 cargos | Não |
| totalAreaM2 / backroomAreaM2 | Área total / Retaguarda | m² | 280 / 70 | Não |
| occupancyCostPerM2 | Aluguel ou ocupação de referência | R$/m² | 120 | Não (o motor usa o campo da Logística) |
| averageInventory | Estoque médio | R$ | 480.000 | Sim (capital de giro) |
| inventoryTurnsPerYear | Giro do estoque | x/ano | 8 | Não |
| skuCount | SKUs | nº | 6.500 | Não |
| historicalLossesMonthly | Perdas históricas | R$/mês | 18.000 | Sim |
| demandGrowthPctPerYear | Crescimento anual da demanda | %/ano | 0% | Sim |
| storeCount | Lojas na projeção | lojas | 1 | Sim (visão de rede) |

### 2.2 Pessoas / turnover (people)

| Bloco | Campos (código → rótulo) | Padrão do exemplo |
|---|---|---|
| payroll — Folha e encargos | positionsReduced → Vagas evitadas; monthlyCostPerPosition → Custo completo por vaga (R$); startMonth → Mês em que a economia começa; severanceCost → Rescisão (R$) | ligado, comprovável; 6 vagas; R$ 9.200; mês 1; R$ 18.000 |
| futureHires — Contratações futuras | lista de vagas: role, month, headcount, monthlyCost | desligado; 1 auxiliar no mês 13, R$ 9.200 |
| recruitment — Recrutamento e seleção | costPerHire → Custo por contratação; includedInTurnoverCost (já incluso no turnover) | ligado, comprovável; R$ 3.500; incluso = sim |
| training — Treinamento e integração | costPerPerson → Custo por pessoa; includedInReplacementCost | ligado, comprovável; R$ 2.500; incluso = sim |
| turnover — Turnover evitado | annualRate → Taxa anual de turnover; costPerReplacement → Custo médio por substituição | ligado, comprovável; 20% a.a.; R$ 12.000 |
| supervision — Supervisão, escala e ausências | hoursSavedPerMonth (h); costPerHour (R$); alreadyCountedInPayroll | ligado, comprovável; 40 h; R$ 50; não |
| consultativeSales — Venda consultiva | hoursFreedPerMonth (h); marginPerHour (R$); independentEvidence | ligado, potencial; 20 h; R$ 80; sem evidência |

### 2.3 Logística / infraestrutura (logistics)

| Bloco | Campos | Padrão do exemplo |
|---|---|---|
| boxes — Caixas plásticas retornáveis | cyclesAvoidedPerMonth; costPerCycle (R$); processValidated | ligado, potencial; 400 ciclos; R$ 8; não validado |
| shelving — Prateleiras e gaveteiros | avoidedAcquisition → Aquisição evitada (R$); resaleValue → Revenda ou reaproveitamento (R$); avoidedMaintenanceMonthly → Manutenção evitada (R$/mês) | ligado, comprovável; R$ 180.000; R$ 25.000; R$ 1.500 |
| space — Espaço físico | m2Freed (m²); mode ("ocupacao" ou "margem"); occupancyCostPerM2 (R$/m²); contributionPerM2Month (R$/m²) | ligado, comprovável; 20 m²; ocupação; R$ 200; R$ 150 |
| movement — Movimentação interna | hoursSavedPerMonth; costPerHour; alreadyCountedInPayroll | ligado, comprovável; 32 h; R$ 50; não |
| inventoryCount — Inventário | hoursSavedPerMonth; costPerHour | ligado, comprovável; 20 h; R$ 50 |

### 2.4 Estoque / perdas / vendas (stock)

| Bloco | Campos | Padrão do exemplo |
|---|---|---|
| salesIndependenceConfirmed | confirmação de que as alavancas de venda são independentes | falso |
| losses — Perdas e FEFO | projectedLossesMonthly → Perdas projetadas com o robô (R$/mês); usa também profile.historicalLossesMonthly | ligado, comprovável; R$ 8.000 |
| shrinkage — Avarias, extravios e erros | avoidedMonthly (R$/mês) | ligado, comprovável; R$ 5.000 |
| ruptures — Rupturas | additionalMonthlySales (R$/mês); independentEvidence | desligado, potencial; R$ 20.000 |
| serviceSpeed — Atendimento e abandono | additionalMonthlySales (R$/mês); independentEvidence | desligado, potencial; R$ 10.000 |
| workingCapital — Capital de giro | inventoryAfter → Estoque médio com o robô (R$); releaseMonth; treatment ("liberacao_caixa" ou "custo_financeiro"); costOfCapitalAnnual; reverseAtHorizon | desligado, comprovável; R$ 350.000; mês 3; liberação de caixa; 12% a.a.; não |

### 2.5 Investimento e OPEX do robô (robot)

| Grupo | Campos (rótulo) | Padrão do exemplo |
|---|---|---|
| capex | equipment (Robô) 1.750.000; freightImportTaxes (Frete, importação e tributos) 140.000; installationTraining (Instalação, comissionamento e treinamento) 90.000; civilElectrical (Obras, elétrica e rede) 70.000; integration (Integração PDV, ERP e logística) 50.000; implementationContingency (Implantação e contingência) 80.000 | Total bruto R$ 2.180.000 |
| opexMonthly | maintenance (Manutenção e peças) 8.000; software (Software, conectividade e monitoramento) 3.200; energy (Energia e consumíveis) 1.500; downtime (Indisponibilidade e contingência) 700; insurance (Seguros) 1.100; other (Outros custos) 500 | Total R$ 15.000/mês |
| Operação | availabilityPct (Disponibilidade operacional); capacityDispensationsPerDay (Capacidade de dispensação, /dia); goLiveMonth (Mês de go-live) | 100%; 1.500/dia; mês 1 |
| Fim de horizonte | residualValue (Valor residual no mês 60); depreciationYears (Vida para depreciação) | R$ 0; 10 anos |
| Imposto | includeTax; taxRate (Alíquota) | desligado; 34% |
| Taxa | discountRateAnnual (Taxa de desconto anual efetiva) | 12% a.a. |
| Financiamento | enabled; downPaymentPct (Entrada); termMonths (Prazo); annualInterest (Juros anuais efetivos); balloon (Balão no fim do prazo) | desligado; 30%; 48 meses; 14% a.a.; R$ 0 |

### 2.6 Cenários (scenarios)

| Cenário | benefitFactor | salesFactor | opexFactor | capexFactor |
|---|---|---|---|---|
| Conservador | 0,80 | 0,60 | 1,15 | 1,08 |
| Base | 1,00 | 1,00 | 1,00 | 1,00 |
| Otimista | 1,12 | 1,20 | 0,92 | 0,97 |

## 3. Fórmulas de cada benefício

Fonte: src/model/calculate.ts, closures internas de evaluate (payrollAmount, futureHireCost, turnoverAmount, supervisionAmount, boxesAmount, maintenanceAmount, spaceAmount, movementAmount, countAmount, lossesAmount, shrinkageAmount, marginOf, consultativeMonthly, operatingBenefit, recruitmentEvents, trainingEvents, severanceAt, resaleAt, workingCapitalAt).

### 3.1 Fatores comuns

```
goLive        = clamp(round(goLiveMonth) || 1, 1, 60)
dispensações  = max(0, dispensationsPerDay × volumeFactor)
cobertura     = se capacidade ≤ 0: 0
                senão se dispensações ≤ 0: 1
                senão: min(1, capacidade / dispensações)
disponib.     = clamp(availabilityPct, 0, 1)
capture       = cobertura × disponib.
crescimento(m)= (1 + demandGrowthPctPerYear) ^ ((m − 1) / 12)
volume(m)     = volumeFactor × crescimento(m)
benefitFactor = fator de benefício do cenário
salesMultiplier = salesFactor (sensibilidade) × salesFactor (cenário)
laborFactor, turnoverFactor = fatores de sensibilidade (padrão 1)
```

Todos os benefícios recorrentes valem zero antes de goLive (m < goLive) e quando a trava os exclui. Cada valor é arredondado a centavos com round2 (src/model/round.ts; valores não finitos viram 0).

### 3.2 Pessoas

```
Folha evitada(m) = vagas × custo por vaga × laborFactor × capture × benefitFactor
                   (só a partir de m ≥ max(goLive, startMonth))

Contratações futuras(m) = Σ [vagas_h × custo_h × laborFactor] para cada vaga h com m ≥ mês_h
                          × capture × benefitFactor        (só m ≥ goLive)

Turnover evitado(m) = (abertas × taxa anual × turnoverFactor × custo por substituição × laborFactor / 12)
                      × capture × benefitFactor
   onde abertas = (vagas da folha, se a folha está incluída e m ≥ startMonth)
                  + vagas futuras já ativas no mês m

Supervisão(m) = horas economizadas × custo da hora × laborFactor × capture × benefitFactor
```

Recrutamento e treinamento evitados são eventos pontuais (recruitmentEvents / trainingEvents), positivos no caixa:

```
unidade_recrut = round2(costPerHire × laborFactor)
unidade_trein  = round2(costPerPerson × laborFactor)
Loja nova e folha incluída: evento no mês max(goLive, startMonth) = vagas × unidade
Contratações futuras incluídas (qualquer loja): evento no mês max(goLive, mês_h) = vagas_h × unidade
```

Eventos com valor zero ou depois do mês 60 são descartados. Esses eventos não são multiplicados por capture nem por benefitFactor.

Venda consultiva (alavanca de venda, ver 3.5):

```
Consultiva(m) = horas liberadas × margem por hora × crescimento(m) × capture × benefitFactor × salesMultiplier
```

### 3.3 Logística e espaço

```
Caixas(m)       = ciclos evitados × custo por ciclo × volume(m) × capture × benefitFactor
Manutenção prateleiras(m) = manutenção evitada mensal × capture × benefitFactor   (só loja existente)
Espaço(m)       = m² liberados × taxa × capture × benefitFactor
                  taxa = custo de ocupação por m² (modo "ocupacao")
                       ou margem por m² ao mês (modo "margem")
Movimentação(m) = horas × custo da hora × laborFactor × volume(m) × capture × benefitFactor
Inventário(m)   = horas × custo da hora × laborFactor × capture × benefitFactor
```

### 3.4 Estoque e perdas

```
Perdas históricas(m) = historicalLossesMonthly × volume(m) × capture
Perdas projetadas(m) = projectedLossesMonthly × volume(m) × capture
Perdas evitadas(m)   = max(0, históricas(m) − projetadas(m)) × benefitFactor
Avarias(m)           = avoidedMonthly × volume(m) × capture × benefitFactor
```

### 3.5 Vendas (margem incremental)

```
marginOf(vendas, m) = vendas × margem de contribuição × volume(m) × capture × benefitFactor × salesMultiplier
Rupturas(m)    = marginOf(ruptures.additionalMonthlySales, m)
Atendimento(m) = marginOf(serviceSpeed.additionalMonthlySales, m)
Vendas(m)      = soma das alavancas incluídas (consultiva, rupturas, atendimento) após a regra de "maior alavanca"
```

### 3.6 Capital de giro

```
base de liberação  = max(0, estoque médio × volumeFactor − estoque depois × volumeFactor)
Liberação (pontual)= base, no mês max(goLive, releaseMonth)            — tratamento "liberacao_caixa"
                     se reverseAtHorizon: −base no mês 60 (se a liberação não foi no mês 60)
Custo financeiro(m)= base × costOfCapitalAnnual × benefitFactor / 12   — tratamento "custo_financeiro"
                     somado ao benefício operacional a partir de goLive
releaseMonth       = clamp(round(releaseMonth) || goLive, 1, 60)
```

### 3.7 Benefício operacional bruto do mês

```
Benefício(m) = Folha + Contratações futuras + Turnover + Supervisão + Caixas + Manutenção
             + Espaço + Movimentação + Inventário + Perdas + Avarias + Vendas
             + (Custo financeiro, se m ≥ goLive)
```

### 3.8 Eventos pontuais exclusivos de loja existente

```
Rescisão (saída)  = severanceCost, no mês max(goLive, startMonth)  — loja existente e folha incluída
Revenda (entrada) = resaleValue, no mês goLive                     — loja existente e prateleiras incluídas
```

## 4. CAPEX e OPEX

Fonte: src/model/calculate.ts (evaluate, residualAt, depreciationAt); src/components/InvestmentForm.tsx.

```
capexMultiplier = capexFactor (sensibilidade) × capexFactor (cenário)
CAPEX bruto     = round2(soma dos 6 itens de capex × capexMultiplier)
CAPEX evitado   = round2(avoidedAcquisition × capexMultiplier)  se loja nova e prateleiras incluídas; senão 0
Investimento líquido = round2(CAPEX bruto − CAPEX evitado)
Caixa na data zero   = −Investimento líquido (0 quando o líquido é 0)
OPEX mensal     = round2(soma dos 6 itens de OPEX × opexFactor do cenário)
OPEX(m)         = OPEX mensal se m ≥ goLive; senão 0
```

O OPEX não é reduzido por disponibilidade ou capacidade e não cresce com a demanda (não há inflação no modelo).

Valor residual (residualAt), só no mês 60:

```
residual = round2(residualValue × capexMultiplier)
Sem imposto: entra residual.
Com imposto: meses operados = 60 − goLive + 1
             depreciado = min(meses operados, meses de depreciação) × (investimento líquido / meses de depreciação)
             valor contábil = max(0, investimento líquido − depreciado)
             entra residual − (residual − valor contábil) × alíquota
```

Imposto (quando includeTax):

```
meses de depreciação = max(1, round(depreciationYears × 12))
Depreciação(m) = investimento líquido / meses de depreciação, do goLive até esgotar a vida
Antes do imposto(m) = Benefício(m) − OPEX(m)
Imposto(m) = (Antes do imposto(m) − Depreciação(m)) × alíquota
Operacional líquido(m) = Antes do imposto(m) − Imposto(m)
```

A depreciação não sai do caixa; ela só reduz a base do imposto (escudo fiscal). Com a política padrão, resultado tributável negativo não gera crédito automático. A alíquota de 34% é só um campo editável e não vale para qualquer regime.

Financiamento (buildFinancing) fica fora dos indicadores:

```
principal = max(0, round2(investimento líquido × (1 − entrada)))
i = taxa mensal equivalente aos juros anuais
parcela = (principal − balão / (1+i)^prazo) / [(1 − (1+i)^−prazo) / i]   (se i = 0: (principal − balão)/prazo)
total pago = investimento líquido × entrada + parcela × prazo + balão
juros totais = total pago − investimento líquido
```

## 5. Construção dos fluxos de 60 meses

Fonte: src/model/calculate.ts, laço "for (let month = 1; month <= HORIZON_MONTHS; ...)" em evaluate; src/components/CashflowTable.tsx e Dashboard.tsx.

Para cada mês m de 1 a 60:

```
vendas        = Vendas(m)
benefício     = Benefício(m)
opex          = OPEX(m)
antesImposto  = benefício − opex
imposto       = (antesImposto − Depreciação(m)) × alíquota   (ou 0)
operacional   = antesImposto − imposto
pontual       = capital de giro − rescisão + revenda + residual + recrutamento evitado + treinamento evitado
incremental   = operacional + pontual
acumulado     = acumulado anterior + incremental        (começa no caixa da data zero)
descontado    = incremental / (1 + taxa mensal)^m
acum. descont.= acumulado descontado anterior + descontado
```

Colunas "sem robô" e "com robô" (exibição):

```
perdas hist. exib.  = perdas históricas(m) × benefitFactor       (se perdas incluídas e m ≥ goLive)
perdas proj. exib.  = min(projetadas(m), históricas(m)) × benefitFactor
custo sem robô      = (benefício − vendas) − perdas evitadas + perdas hist. exib.
custo com robô      = perdas proj. exib. + opex
```

Assim, custo sem robô − custo com robô + margem de vendas = benefício − OPEX. Não é o custo total da loja; é o conjunto de custos relevantes afetados pelo robô.

Cronograma / rampa — o que o código faz:

- go-live (goLiveMonth): antes dele não há benefício nem OPEX.
- Folha: começa em max(goLive, startMonth). Contratações futuras: cada vaga entra no seu mês.
- Não existe curva de rampa gradual: a partir do mês de início, o benefício entra em 100% do valor (degrau). A única variação mês a mês vem do crescimento de demanda (crescimento(m)), aplicado a caixas, movimentação, perdas, avarias, vendas e venda consultiva.
- Benefícios sem crescimento: folha, contratações futuras, turnover, supervisão, inventário, espaço, manutenção de prateleiras e custo financeiro do estoque.

Taxa de desconto e convenções:

- Taxa anual efetiva convertida em mensal equivalente: i_m = (1 + i_a)^(1/12) − 1 (finance.ts, monthlyRateFromAnnual). Com 12% a.a., i_m ≈ 0,9489% a.m.
- Índice 0 = data zero, não descontado. O fluxo do mês m é descontado por (1 + i_m)^m (fim de mês).
- O investimento sai integralmente na data zero, mesmo com go-live posterior.
- Valores arredondados a centavos em cada etapa (round2).

## 6. Indicadores

Fonte: src/model/finance.ts (npv, irr, simplePayback, firstNonNegativeMonth, discountedPayback, firstNonNegativeDiscountedMonth, simpleAnnualRoi, monthlyRateFromAnnual, annualizeMonthlyRate) e o trecho final de evaluate em calculate.ts.

```
cashFlows = [caixa na data zero, incremental mês 1, …, incremental mês 60]
VPL = Σ_{t=0..60} cashFlows[t] / (1 + i_m)^t
TIR mensal = taxa que zera o VPL; TIR anual = (1 + TIR mensal)^12 − 1
Payback simples = primeiro mês t em que o acumulado ≥ 0, interpolado:
                  (t − 1) + (−acumulado anterior / fluxo do mês t)
Payback descontado = mesma regra aplicada aos fluxos descontados
Retorno anual simples estabilizado = (operacional líquido do mês 60 × 12) / investimento líquido
```

Detalhes e casos extremos (como o código trata):

- Payback: se o caixa da data zero já é ≥ 0 (investimento líquido zero ou negativo), devolve 0, exibido como "Imediato". Se o acumulado não cruza zero em 60 meses, devolve null ("Não recupera em 60 meses"). Tolerância de 1e-9. Também é informado o primeiro mês inteiro com acumulado não negativo (firstPositiveMonth).
- ROI: devolve null quando o investimento líquido não é > 0 ou o benefício não é finito ("Não se aplica sem investimento positivo"). Usa o run-rate do mês 60 (com crescimento, usa o mês 60 e não a média). Não inclui eventos pontuais. Não é a TIR.
- TIR: null se não há ao menos um fluxo positivo e um negativo (ex.: investimento zero) — exibida como "Indefinida". Método: Newton-Raphson a partir de 1% a.m. (até 60 iterações); se não convergir, bisseção em [−0,9; 1], ampliando o limite superior até 1.000 (até 30 dobras), até 100 iterações. Se não há troca de sinal no intervalo, null.
- VPL: com taxa ≤ −100% a taxa mensal vira NaN e o VPL não é calculado (exibido como "—"); o payback descontado também fica null.
- Investimento líquido negativo (CAPEX evitado maior que o bruto): gera aviso, o caixa da data zero fica positivo, payback "Imediato", ROI null.
- Teste existente (calculate.test.ts, "investimento zero"): VPL finito, TIR indefinida e payback imediato.

## 7. Cenários e loja nova vs. existente

Fonte: evaluate (factors, capexMultiplier, salesMultiplier), src/components/ScenarioPanel.tsx, src/components/Dashboard.tsx.

Como os fatores do cenário entram:

- benefitFactor multiplica todos os benefícios recorrentes (inclusive vendas e custo financeiro do estoque).
- salesFactor multiplica só as alavancas de venda, além do benefitFactor. No conservador, a venda fica com 0,80 × 0,60 = 0,48 do valor base.
- opexFactor multiplica o OPEX mensal.
- capexFactor multiplica o CAPEX bruto, o CAPEX evitado de prateleiras e o valor residual.
- Não são afetados pelos fatores do cenário: rescisão, revenda de prateleiras, recrutamento/treinamento evitados e o principal do capital de giro.

Os fatores são editáveis na tela Cenários. O dashboard mostra os três cenários lado a lado (payback, ROI, VPL, líquido).

Loja nova vs. existente:

| Item | Loja nova | Loja existente |
|---|---|---|
| Prateleiras — aquisição evitada | Abate o CAPEX (data zero) | Não entra |
| Prateleiras — revenda | Não entra | Entrada pontual no go-live |
| Prateleiras — manutenção evitada | Não entra | Benefício recorrente |
| Rescisão | Não entra | Saída pontual em max(goLive, startMonth) |
| Recrutamento/treinamento das vagas da folha | Entram (se não bloqueados) | Não entram |
| Recrutamento/treinamento de contratações futuras | Entram | Entram |

O dashboard calcula as duas versões sobre as mesmas premissas (storeTypeOverride) e mostra investimento líquido, benefício líquido mensal, payback, ROI e VPL.

## 8. Regras anti-dupla-contagem e toggles

Fonte: gateBenefit, salesCandidates/droppedSales, cálculo de capital de giro e avoidedCapex em calculate.ts; testes em calculate.test.ts ("regras anti-dupla-contagem").

Ordem da trava (gateBenefit): (1) desligado → fora; (2) bloqueio específico → fora, com motivo; (3) confiança "potencial" e includePotential falso → fora; (4) caso contrário, entra.

| Regra | Implementação |
|---|---|
| Recrutamento já incluso no turnover | includedInTurnoverCost = verdadeiro bloqueia recrutamento |
| Treinamento já incluso no custo de substituição | includedInReplacementCost = verdadeiro bloqueia treinamento |
| Supervisão já contada na folha | alreadyCountedInPayroll bloqueia supervisão |
| Movimentação já contada na folha | alreadyCountedInPayroll bloqueia movimentação |
| Venda consultiva, rupturas, atendimento | Cada uma exige independentEvidence. Se mais de uma passar e salesIndependenceConfirmed for falso, só fica a de maior valor no mês 60 |
| Caixas retornáveis | Exigem processValidated |
| Espaço | Um único modo: ocupação ou margem, nunca os dois |
| Capital de giro | Ou liberação do principal, ou custo financeiro mensal; nunca os dois |
| Contratação futura | Entra só a partir do mês em que a vaga existiria |
| Prateleiras | CAPEX evitado só em loja nova; revenda e manutenção só em loja existente |
| Rescisão | Só em loja existente |
| Disponibilidade e capacidade | Reduzem os benefícios (capture); OPEX não é reduzido |
| Financiamento | Não altera VPL, TIR, ROI nem payback |
| Ganhos potenciais | Ficam de fora até includePotential; as travas de dupla contagem continuam valendo |

No exemplo, ficam fora: venda consultiva (potencial e sem evidência), caixas (potencial e processo não validado), recrutamento e treinamento (já inclusos), rupturas e atendimento (desligados), capital de giro (desligado) e contratações futuras (desligado).

Avisos gerados (warnings): cobertura de capacidade < 100%; disponibilidade < 100%; perdas projetadas maiores que as históricas; benefício bruto maior que o faturamento; investimento líquido negativo; financiamento ativo; imposto ligado; potenciais incluídos; loja existente; crescimento de demanda ≠ 0.

## 9. Ajuste rápido e sensibilidade

### 9.1 Ajuste rápido (Dashboard)

Fonte: src/model/premises.ts (QUICK_LEVERS, leverValue, withLeverValue, nudgeLever, applyScale, applyVolume, applySales, reanchor) e src/components/QuickAdjust.tsx.

O ajuste rápido altera as premissas de verdade (não usa os fatores de sensibilidade do motor) e compara com uma "âncora" (o valor original). Slider e botões vão de −100% a +30% (ADJUST_MIN = −1, ADJUST_MAX = 0,3, passo 5%). O campo numérico aceita zero e qualquer valor acima (valores negativos viram 0). Sem valor-base positivo, slider e botões ficam desativados. "Desfazer ajuste" volta à âncora.

| Alavanca | Valor de referência | O que muda |
|---|---|---|
| Investimento do robô | Soma do CAPEX bruto | Escala os 6 itens; o maior absorve o arredondamento. CAPEX evitado não muda |
| OPEX | Soma do OPEX | Escala os 6 itens (mesma lógica) |
| Salários | Custo completo por vaga | Só monthlyCostPerPosition |
| Turnover | Taxa anual | Só annualRate |
| Volume | Dispensações/dia | Mesmo percentual em dispensações, perdas históricas, perdas projetadas, avarias, ciclos de caixa e horas de movimentação |
| Vendas | Rupturas + atendimento + horas consultivas × margem/hora | Escala as duas vendas adicionais e a margem por hora |
| Taxa de desconto | Taxa anual | Só discountRateAnnual (não afeta ROI) |

O painel mostra payback, ROI, VPL e TIR atuais e a diferença versus a âncora. Quando outra tela altera uma premissa, reanchor atualiza a âncora das alavancas não ajustadas.

### 9.2 Sensibilidade

Fonte: calculate.ts, função sensitivity e SENSITIVITY_DELTAS = [−0,30; −0,15; 0; +0,15; +0,30]; src/components/SensitivityPanel.tsx.

Para cada driver, roda evaluate com um único fator = 1 + delta, mantendo o cenário atual:

| Driver | Fator no motor | Efeito |
|---|---|---|
| Investimento | capexFactor | CAPEX bruto, CAPEX evitado e valor residual |
| Mão de obra | laborFactor | Folha, contratações futuras, custo de substituição do turnover, supervisão, movimentação, inventário e unidades de recrutamento/treinamento |
| Turnover | turnoverFactor | Taxa anual de turnover |
| Vendas | salesFactor | Margem das alavancas de venda que entraram no fluxo |
| Volume | volumeFactor | Dispensações (cobertura), caixas, movimentação, perdas, avarias, margem de rupturas/atendimento e base de capital de giro |

Resultados do exemplo (cenário base, loja nova), calculados com o código:

| Driver | −30% | −15% | 0 | +15% | +30% |
|---|---|---|---|---|---|
| Investimento (payback) | 21,5 m | 26,2 m | 30,8 m | 35,4 m | 40,0 m |
| Mão de obra (payback) | 42,8 m | 35,8 m | 30,8 m | 27,0 m | 24,0 m |
| Turnover (payback) | 30,9 m | 30,9 m | 30,8 m | 30,7 m | 30,6 m |
| Vendas (payback) | 30,8 m | 30,8 m | 30,8 m | 30,8 m | 30,8 m |
| Volume (payback) | 33,3 m | 32,0 m | 30,8 m | 29,6 m | 28,6 m |

A linha de vendas fica estável porque nenhuma margem de venda entra no fluxo do exemplo (o painel mostra esse aviso).

## 10. Exemplo numérico ilustrativo

Fonte: src/model/example.ts (EXAMPLE, matchesIllustrativeExample), README.md e calculate.test.ts. Cenário base, loja nova. Dados fictícios. Os números abaixo foram conferidos rodando o motor do commit c1bfa48.

Captura: capacidade 1.500/dia ≥ 900 dispensações/dia → cobertura 1; disponibilidade 100% → capture = 1.

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
| Benefício anual | 65.000 × 12 | R$ 780.000 |
| Payback simples | 2.000.000 / 65.000 | 30,8 meses (acumulado positivo no mês 31) |
| ROI anual simples | 780.000 / 2.000.000 | 39% |
| Payback descontado (12% a.a.) | interpolação dos fluxos descontados | 36,6 meses (positivo no mês 37) |
| VPL (12% a.a.) | Σ fluxos descontados | R$ 963.206,66 |
| TIR | mensal 2,52% | anual ≈ 34,8% |

Fora do fluxo no exemplo (aparecem na auditoria): venda consultiva (R$ 1.600/mês potencial), rupturas (R$ 6.400/mês = 20.000 × 32%) e atendimento (R$ 3.200/mês), caixas, recrutamento, treinamento, capital de giro.

Mesmo exemplo nos outros cenários e na loja existente (calculado com o código):

| Cenário / loja | Inv. líquido | Líquido/mês | Payback | ROI | VPL | TIR a.a. |
|---|---|---|---|---|---|---|
| Conservador / nova | 2.160.000 | 46.750 | 46,2 m | 26,0% | −28.771 | 11,4% |
| Base / nova | 2.000.000 | 65.000 | 30,8 m | 39,0% | 963.207 | 34,8% |
| Otimista / nova | 1.940.000 | 75.800 | 25,6 m | 46,9% | 1.515.555 | 48,9% |
| Conservador / existente | 2.354.400 | 47.950 | 49,0 m | 24,4% | −161.531 | 8,6% |
| Base / existente | 2.180.000 | 66.500 | 32,7 m | 36,6% | 858.523 | 30,7% |
| Otimista / existente | 2.114.600 | 77.480 | 27,2 m | 44,0% | 1.424.477 | 43,9% |

Na loja existente base: sem CAPEX evitado (investimento R$ 2.180.000), manutenção de prateleiras +R$ 1.500/mês (líquido R$ 66.500) e, no mês 1, revenda de R$ 25.000 menos rescisão de R$ 18.000 (+R$ 7.000 pontual).

## 11. Limitações e pontos de atenção observados no código

Apenas o que o código mostra (commit c1bfa48):

- Sem rampa de adoção: o benefício entra em 100% no go-live (ou no mês de início), sem curva de estabilização.
- Sem inflação ou reajuste: OPEX, salários e custos são constantes nominais; só há crescimento de demanda, e apenas em parte dos benefícios (caixas, movimentação, perdas, avarias, vendas e consultiva).
- O investimento sai inteiro na data zero, mesmo com go-live posterior; o OPEX só começa no go-live.
- ROI anual simples usa o mês 60. Com crescimento de demanda, o ROI reflete o fim do horizonte, não a média (o app avisa).
- Campos do perfil coletados mas não usados no cálculo: atendimentos/dia, dias de operação, cargos (roles), área total, retaguarda, giro, SKUs e o custo de ocupação do perfil. O faturamento só gera aviso.
- Há dois campos de custo de ocupação: profile.occupancyCostPerM2 (R$ 120 no exemplo, não usado) e logistics.space.occupancyCostPerM2 (R$ 200, usado). O código não sincroniza os dois.
- Fatores de cenário não se aplicam a eventos pontuais (rescisão, revenda, recrutamento/treinamento, principal do capital de giro). A liberação de capital de giro também não é reduzida por capture. O custo financeiro do estoque usa benefitFactor, mas não capture.
- Vendas recebem benefitFactor e salesFactor ao mesmo tempo (no conservador, 0,48 do base).
- A venda consultiva usa crescimento(m), não volume(m): não reage ao driver "Volume" da sensibilidade e não recebe laborFactor.
- Volume, mão de obra, investimento, OPEX, vendas, desconto, disponibilidade e cobertura de estoque usam o mesmo driver no ajuste rápido e na sensibilidade. Quinze por cento é o mesmo percentual nas duas telas. Investimento escala CAPEX bruto e prateleira evitada.
- Com capacidade do robô ≤ 0, a cobertura de dispensação é 0. A folha depende da reorganização efetiva e só zera se a disponibilidade chega a zero. O OPEX continua.
- Imposto: prejuízo fiscal não vira crédito sozinho. A política é configurável. A depreciação usa o investimento líquido e não sai do caixa.
- TIR: mais de uma troca de sinal marca o indicador como ambíguo. A decisão usa o VPL.
- A coluna "descontado" da tabela é arredondada mês a mês, enquanto VPL e payback descontado usam os fluxos sem arredondar; pode haver diferença de centavos.
- A auditoria mostra o valor mensal também dos itens que ficaram fora do fluxo (ex.: consultiva R$ 1.600/mês), marcados como não incluídos (includedInCashFlow = falso). Quem lê precisa olhar essa marcação, não só o valor.
- A visão de rede multiplica investimento, líquido e VPL pelo número de lojas (réplica linear); payback e ROI ficam os da loja.
- Quando o usuário edita o CAPEX "outros" ou o OPEX total no assistente (Wizard.tsx → withOtherCapex / withTotalOpex, em wizard.ts), o CAPEX além do robô é consolidado em "Implantação e contingência" e o OPEX em "Manutenção". Isso não muda os totais, mas muda a distribuição que o ajuste rápido escala.
- As validações de faixa (percentuais entre 0 e 100%, perdas projetadas não maiores que as históricas etc.) ficam no assistente (validateWizardStep). O motor (evaluate) não valida entradas: perdas projetadas acima das históricas apenas zeram a economia e geram aviso.
