# gCalc — Como os cálculos são feitos

Documento da calculadora de ROI do robô de armazenagem e dispensação para farmácias. Serve para auditar a lógica e para o cliente conferir premissa, fórmula e número.

A conta roda inteira no navegador. Os valores de abertura são um exemplo fictício, não parâmetro oficial nem resultado de uma loja real. A comparação entre a loja de hoje e a loja com robô fica de fora desta página: ela monta um demonstrativo próprio e só reaproveita valor presente, taxa interna de retorno, payback e retorno.

## 1. Visão geral e fluxo de cálculo

Cada alteração na tela recalcula na hora. O horizonte é fixo em 60 meses. Simulações antigas que não trazem um campo novo recebem um padrão neutro antes da conta.

O fluxo que alimenta valor presente, taxa interna de retorno, payback e retorno é o fluxo do projeto. Dívida, entrada e parcelas ficam num fluxo do investidor, à parte.

```
mês de início da operação = mês informado, entre 1 e 60
caixa na data zero = −investimento líquido × parcela do cronograma na data zero
investimento líquido = investimento bruto − investimento evitado − crédito recuperável de impostos
resultado do mês = benefício do mês − custo mensal do robô × índice de inflação
imposto do mês = política tributária sobre (resultado − depreciação)
líquido do mês = resultado − imposto
caixa pontual = variação de capital de giro − rescisão − remoção
              + revenda + valor residual + recrutamento evitado
              + treinamento evitado + parcela posterior do investimento
fluxo do mês = líquido + caixa pontual
```

A sequência é esta:

- Lê o cenário (padrão: base) e os fatores de benefício, de custo mensal, de investimento e de vendas, o tipo de loja e a taxa de desconto.
- Separa quatro capturas: dispensação (cobertura × disponibilidade), folha (reorganização; zero se a disponibilidade é zero), estoque (fração automatizada; zero se a disponibilidade é zero) e vendas (cobertura × disponibilidade × atendimento × conversão).
- Calcula o investimento bruto, o investimento evitado (prateleiras de loja nova, se ainda forem necessárias, mais investimento imobiliário evitado quando essa é a tese da área) e o cronograma de desembolso.
- Passa cada benefício por uma trava: ligado ou desligado, bloqueio para não contar o mesmo real duas vezes, e confiança comprovável ou potencial.
- Aplica a curva da família (pessoas, logística, estoque, vendas) e o índice de salário, de custo mensal ou de preço.
- Para cada mês de 1 a 60, forma o resultado, a base tributável, o imposto de caixa, o fluxo, o acumulado e o acumulado descontado.
- O fluxo usado nos indicadores é o caixa na data zero seguido dos 60 meses. Dali saem payback simples, payback descontado, retorno anual simples estabilizado, retorno acumulado, valor presente e taxa interna de retorno anual efetiva.
- A auditoria lista o que entrou e o que ficou de fora, os avisos, o fluxo do investidor e a visão de rede.

A lógica é incremental. A conta não projeta o custo total da loja sem robô e com robô. Ela calcula a diferença: custos evitados mais margem incremental, menos o custo mensal do robô. As colunas "custo sem robô" e "custo com robô" são uma reconstrução para exibição. Benefício excluído soma zero no caixa. O custo mensal do robô não é reduzido pela captura.

O modo simples esconde premissas avançadas na tela. Não muda a fórmula: o que já estiver preenchido continua na conta.

## 2. Premissas de entrada

Percentuais na tela são frações na conta: 32% entra como 0,32. Os padrões abaixo são os do exemplo fictício. A origem de cada número é o campo correspondente da tela, salvo quando a linha diz que é calculado.

Cada benefício pode estar ligado ou desligado e ser comprovável ou potencial. A opção de incluir ganhos potenciais vem desligada: potencial não entra no caixa até alguém ligar. O modo de tela (simples ou avançado) só muda o que aparece, não a conta.

### 2.1 Perfil da farmácia

| O que se informa | Unidade | Padrão do exemplo | Entra na conta? |
|---|---|---|---|
| Tipo de loja | nova ou existente | nova | Sim |
| Faturamento mensal | R$ | 850.000 | Só em aviso |
| Margem de contribuição | % | 32% | Sim, nas vendas |
| Atendimentos por dia | número | 320 | Não |
| Dispensações por dia | número | 720 | Sim, na cobertura |
| Dias de operação no mês | dias | 26 | Não |
| Cargos: função, pessoas, custo completo e escala | lista | 4 cargos, 12 pessoas; farmacêutico R$ 8.500 e auxiliar R$ 4.200, sugestões fictícias a validar; 1 balcão e 2 turnos | Sim, no teto de vagas e no orçamento de horas |
| Área total e retaguarda | m² | 200 e 40 | Não |
| Aluguel ou ocupação de referência | R$/m² | 120 | Sim, só se o campo da logística estiver em zero |
| Estoque médio | R$ | 480.000 | Sim, no capital de giro |
| Giro do estoque | vezes por ano | 8 | Não |
| Quantidade de itens | número | 6.500 | Não |
| Perdas históricas | R$/mês | 12.000 | Sim |
| Crescimento anual da demanda | % ao ano | 0% | Sim |
| Reajuste de salários | % ao ano | 0% | Sim |
| Inflação do custo mensal do robô | % ao ano | 0% | Sim |
| Inflação de preços | % ao ano | 0% | Sim |
| Base dos fluxos | nominal ou real | nominal | Sim, aviso se divergir da taxa |
| Lojas na projeção | lojas | 1 | Sim, réplica linear quando a rede está desligada |

### 2.2 Pessoas e turnover

| Bloco | O que se informa | Padrão do exemplo |
|---|---|---|
| Folha e encargos | vagas evitadas; custo completo por pessoa e por mês, já com encargos e benefícios; encargos; benefícios; se o custo está confirmado; mês de início; rescisão, só loja existente | ligado, comprovável; 3 vagas (uma por turno e uma de pico); R$ 4.200; encargos 0; benefícios 0; custo confirmado; mês 1; rescisão R$ 12.600 |
| Jornada | horas mensais para o orçamento de quem permanece | 176 h |
| Horas realocadas | horas no mês; nenhuma monetização, redução de custo ou ganho incremental; valor mensal; evidência | desligado; sem monetização |
| Contratações futuras | cargo, mês, vagas e custo mensal. Só entra em loja existente | desligado; 1 auxiliar no mês 13, R$ 4.200 |
| Recrutamento e seleção | custo por contratação; se já está incluso no turnover | ligado, comprovável; R$ 3.500; incluso = sim |
| Treinamento e integração | custo por pessoa, sugestão fictícia de R$ 6.000 a validar; se já está incluso no custo de substituição | ligado, comprovável; R$ 6.000; incluso = sim |
| Turnover evitado | taxa anual; custo consolidado ou detalhado; custo por substituição; componentes de recrutamento, treinamento do substituto, adaptação, desligamento e supervisão | ligado, comprovável; 30% ao ano; consolidado; R$ 8.000; componentes 0 |
| Supervisão | horas poupadas no mês; custo da hora; se a hora já está na folha | ligado, comprovável; 20 h; R$ 45; não |
| Venda consultiva | horas liberadas no mês; margem por hora; evidência independente | ligado, potencial; 20 h; R$ 80; sem evidência |

### 2.3 Logística e infraestrutura

| Bloco | O que se informa | Padrão do exemplo |
|---|---|---|
| Caixas retornáveis | ciclos evitados no mês; custo por ciclo; se o processo foi validado; modo detalhado e componentes (ciclos, transporte reverso, higienização, manuseio, perdas e reposição, espaço), cada um com valor e interruptor | ligado, potencial; 400 ciclos; R$ 8; processo não validado; detalhe desligado |
| Prateleiras | aquisição evitada; revenda; manutenção mensal evitada; se ainda são necessárias; custo de remoção | ligado, comprovável; R$ 40.000; R$ 8.000; R$ 400; ainda necessárias = não; remoção R$ 0 |
| Espaço | metros liberados; ocupação ou margem; tratamento (ocupação evitável, expansão comercial, sem monetização, investimento imobiliário); se o contrato muda; custo por metro; margem por metro; investimento imobiliário evitado; evidência comercial | ligado, comprovável; 16 m²; ocupação; ocupação evitável; contrato muda; R$ 200; R$ 150; imobiliário 0; sem evidência comercial |
| Movimentação | horas poupadas; custo da hora; se a hora já está na folha | ligado, comprovável; 20 h; R$ 40; não |
| Inventário | horas poupadas; custo da hora | ligado, comprovável; 10 h; R$ 40 |

### 2.4 Estoque, perdas e vendas

| Bloco | O que se informa | Padrão do exemplo |
|---|---|---|
| Independência das vendas | confirma que as alavancas de venda não se sobrepõem | falso |
| Perdas | perdas projetadas no mês; modo detalhado; vencimento, avaria, extravio e erro | ligado, comprovável; R$ 5.000; detalhe desligado |
| Avarias, extravios e erros | valor evitado no mês | desligado; R$ 0. Não soma com as perdas históricas |
| Rupturas | vendas adicionais no mês; evidência independente | desligado, potencial; R$ 20.000 |
| Atendimento | vendas adicionais no mês; evidência independente | desligado, potencial; R$ 10.000 |
| Abandono | vendas adicionais no mês; evidência independente | desligado, potencial; R$ 0 |
| Capital de giro | estoque depois; mês da liberação; liberação de caixa ou custo financeiro; custo de capital ao ano; se reverte no fim; se a redução foi comprovada | desligado, comprovável; estoque depois igual ao atual (R$ 480.000); mês 3; liberação; 12% ao ano; não reverte; redução não comprovada |

### 2.5 Investimento, curvas e tributos

| Grupo | O que se informa | Padrão do exemplo |
|---|---|---|
| Investimento | equipamento 1.000.000; frete e impostos de importação 60.000; instalação e treinamento 40.000; obras, elétrica e rede 50.000; integração 25.000; contingência de implantação 60.000 | Bruto R$ 1.235.000. O equipamento não entra abaixo de R$ 1.000.000 |
| Custo mensal e energia | suporte pago à fornecedora de 5.500, faixa de 5.000 a 6.000, e outros custos de 200. Energia calculada: 2,5 quilowatts, 16 horas por dia, 30 dias, R$ 1,17 por quilowatt-hora. Consumo de 1.200 quilowatts-hora e custo de R$ 1.404, somente leitura. Software, indisponibilidade e seguros saíram. Não inclui o preço do equipamento | R$ 7.104 por mês antes do cenário. A energia acompanha a inflação do custo mensal |
| Operação | disponibilidade; capacidade em dispensações por dia; efetividade da reorganização; fração de estoque automatizado; nível de atendimento; conversão; mês de início da operação | 100%; 1.200 por dia; reorganização 100%; estoque automatizado 100%; atendimento 100%; conversão 100%; mês 1 |
| Curvas | pessoas, logística, estoque e vendas | 100% desde o início em cada família |
| Cronograma | mês e parcela do desembolso | mês 0, parcela de 100% |
| Fim de horizonte | valor residual; anos de depreciação | R$ 0; 10 anos |
| Imposto | se entra; alíquota; política; limite de uso do prejuízo; capacidade mensal; se o benefício foi validado; se a premissa foi validada; se eventos extraordinários são tributáveis | desligado; 34%; sem impostos; limite 0; capacidade 0; benefício não validado; premissa não validada; eventos extraordinários tributáveis |
| Taxa | taxa de desconto ao ano; base nominal ou real | 12% ao ano; nominal |
| Financiamento | se entra; entrada; prazo em meses; juros ao ano; balão | desligado; 30%; 48 meses; 14% ao ano; R$ 0 |
| Rede | se entra; custo mensal compartilhado; lojas com nome, tipo, data e fatores de investimento, volume e mão de obra, e quantidade | desligada |

A alíquota de 34% é só um campo editável. Não é recomendação para qualquer regime.

### 2.6 Cenários

| Cenário | Fator de benefício | Fator de vendas | Fator do custo mensal | Fator do investimento |
|---|---|---|---|---|
| Conservador | 0,80 | 0,60 | 1,15 | 1,08 |
| Base | 1,00 | 1,00 | 1,00 | 1,00 |
| Otimista | 1,12 | 1,20 | 0,92 | 0,97 |

## 3. Fórmulas de cada benefício

### 3.1 Fatores comuns

```
mês de início = o mês informado, limitado de 1 a 60
dispensações = máximo entre zero e dispensações por dia × fator de volume
cobertura = zero se a capacidade é zero ou negativa
            1 se não há dispensações informadas
            senão o menor entre 1 e capacidade / dispensações
disponibilidade = percentual limitado de 0 a 1
captura de dispensação = cobertura × disponibilidade
captura de folha = zero se a disponibilidade é zero; senão a reorganização, de 0 a 1
captura de estoque = zero se a disponibilidade é zero; senão a fração de estoque automatizado
captura de vendas = cobertura × disponibilidade × atendimento × conversão
rampa da família no mês = zero antes do início da operação
                          depois, o patamar daquele mês da curva, ou o último, limitado de 0 a 1
índice de uma taxa no mês = 1 se a taxa é zero; senão (1 + taxa) elevado a (mês − 1) / 12
crescimento do mês = índice da demanda
volume do mês = fator de volume × crescimento do mês
```

Curva vazia vale 100% depois do início da operação. O exemplo usa esse degrau.

Horas reivindicadas (supervisão e movimentação só se ainda não estão na folha, mais inventário, venda consultiva e horas realocadas) não podem passar de (pessoas do quadro − vagas evitadas) × jornada. O excedente é cortado na proporção. Sem quadro informado, não há teto.

Vagas da folha não passam do quadro quando o quadro é maior que zero. Custo completo da vaga = custo × (1 + encargos) + benefícios.

| Família | O que a curva multiplica |
|---|---|
| Pessoas | Folha, contratações futuras, turnover, supervisão, horas realocadas |
| Logística | Caixas, manutenção de prateleiras, ocupação, movimentação, inventário |
| Estoque | Perdas, avarias e custo financeiro do estoque |
| Vendas | Rupturas, atendimento, abandono, venda consultiva e margem de área |

### 3.2 Três vias de mão de obra

```
Folha do mês = mínimo entre vagas e quadro × custo completo × fator de mão de obra
               × captura de folha × rampa de pessoas × índice salarial × fator de benefício
               a partir do maior entre o início da operação e o mês de início da folha
               o teto extra é a folha do quadro, quando o quadro existe

Contratações futuras = zero em loja nova
                       em loja existente, a soma de vagas × custo × fator de mão de obra
                       × captura de folha × rampa de pessoas × índice salarial × fator de benefício
                       só para vagas cujo mês já chegou e que não são anteriores ao início da operação

Turnover do mês = posições expostas × taxa anual × fator de turnover × custo da substituição
                  × fator de mão de obra / 12
                  × captura de folha × rampa de pessoas × fator de benefício
posições expostas = vagas da folha, se a folha entrou e o mês já começou, mais as futuras já ativas

Supervisão do mês = horas × corte de horas × custo da hora × fator de mão de obra
                    × captura de folha × rampa de pessoas × índice salarial × fator de benefício
```

O turnover não recebe o índice salarial. O custo da substituição é o valor consolidado ou a soma dos componentes (recrutamento, treinamento do substituto, adaptação, desligamento, supervisão). Nunca os dois.

Horas realocadas não são folha. Sem monetização, ficam de fora. Redução de custo usa o valor mensal informado. Ganho incremental só entra com evidência. O valor passa pelo corte de horas, pela captura de folha, pela rampa de pessoas e pelo índice salarial.

Recrutamento e treinamento iniciais são eventos pontuais, não o custo mensal de substituição:

```
unidade = custo unitário × fator de mão de obra, arredondado em centavos
Loja nova e folha incluída: no maior entre o início da operação e o mês da folha,
  vagas informadas × unidade
Contratações futuras incluídas, só em loja existente: no maior entre o início da operação e o mês da vaga,
  vagas daquele evento × unidade
```

Esses eventos não passam por captura, rampa nem fator de benefício do cenário. A folha mensal usa as vagas já limitadas ao quadro. O evento pontual de recrutamento e treinamento da folha usa as vagas informadas.

### 3.3 Logística, caixas, prateleiras e espaço

```
Caixas, modo consolidado = ciclos × custo por ciclo × volume do mês
                           × captura de dispensação × rampa de logística × fator de benefício

Caixas, modo detalhado = só os componentes ligados
                         a parcela de ciclos cresce com o volume do mês
                         transporte, higienização, manuseio, perdas e espaço são valores mensais
                         a linha consolidada não entra junto

Manutenção de prateleiras = manutenção mensal × rampa de logística × índice do custo mensal × fator de benefício
                            só loja existente, e só se a prateleira deixa de ser necessária

Ocupação = metros × taxa × rampa de logística × fator de benefício
           taxa = custo por metro da logística, se for maior que zero; senão o do perfil
           não usa a captura de dispensação

Margem de área = metros × margem por metro × rampa de logística × índice de preço
                 × fator de benefício × fator de vendas
                 entra como alavanca de venda, nunca somada à ocupação

Movimentação = horas × corte de horas × custo da hora × fator de mão de obra × volume do mês
               × captura de dispensação × rampa de logística × índice salarial × fator de benefício

Inventário = horas × corte de horas × custo da hora × fator de mão de obra
             × captura de estoque × rampa de logística × índice salarial × fator de benefício
```

Ocupação e margem da mesma área não se somam. Tratar a área como margem, ou escolher expansão comercial, usa a margem. Contrato inalterado bloqueia aluguel e ocupação. Sem monetização, e investimento imobiliário, não geram caixa mensal. O investimento imobiliário evitado, em loja nova, abate o investimento.

Prateleira ainda necessária bloqueia aquisição evitada, revenda, manutenção e remoção. Remoção é saída de caixa no início da operação da loja existente. Aquisição evitada só em loja nova. Revenda e manutenção só em loja existente.

Caixas exigem processo validado. Sem isso o benefício fica de fora, mesmo ligado: o robô não elimina a caixa do fornecedor sozinho.

### 3.4 Perdas e avarias

```
Históricas do mês = perdas históricas × volume do mês × captura de estoque × rampa de estoque
Projetadas do mês = perdas projetadas × volume do mês × captura de estoque × rampa de estoque
Perdas, modo simples = máximo entre zero e históricas − projetadas, vezes o fator de benefício
Perdas, modo detalhado = (vencimento + avaria + extravio + erro)
                         × volume do mês × captura de estoque × rampa de estoque
                         × índice de preço × fator de benefício
Avarias = valor evitado no mês × volume do mês × captura de estoque × rampa de estoque
          × índice de preço × fator de benefício
```

No modo detalhado a linha de avarias separada fica bloqueada, e o par histórico menos projetado não entra. No modo simples as duas linhas podem conviver: o exemplo faz isso de propósito e a tela avisa sobreposição.

### 3.5 Vendas

A monetização é margem de contribuição, não faturamento.

```
margem das vendas no mês = vendas × margem de contribuição × volume do mês
                           × captura de vendas × rampa de vendas × índice de preço
                           × fator de benefício × fator de vendas
Rupturas, atendimento e abandono usam essa margem
Venda consultiva = horas × corte de horas × margem por hora × crescimento do mês
                   × captura de vendas × rampa de vendas × índice de preço
                   × fator de benefício × fator de vendas
```

A venda consultiva usa o crescimento da demanda, não o fator de volume da sensibilidade.

Se mais de uma alavanca de venda passa na trava e a independência não foi confirmada, só fica a de maior valor no mês 60. As candidatas são venda consultiva, rupturas, atendimento, abandono e margem de área.

### 3.6 Capital de giro

```
liberação = máximo entre zero e estoque antes − estoque depois, se a redução foi comprovada
            senão zero
            o padrão é não presumir queda
            o robô pode até aumentar o estoque
            não é escalada por volume nem por captura
Principal = liberação no maior entre o início da operação e o mês informado
            e o estorno dessa liberação no mês 60, se a reversão estiver ligada e a entrada não foi no mês 60
Custo financeiro mensal = liberação × taxa anual × fator de benefício / 12
                          × rampa de estoque × índice de preço, a partir do início da operação
```

Os dois tratamentos não se somam. Quando o principal entra no fluxo, a leitura de custo financeiro permanece informativa: o valor presente já remunera o capital. Sem redução comprovada, nada entra no caixa.

### 3.7 Benefício operacional do mês

```
Benefício do mês = Folha + Contratações futuras + Turnover + Supervisão + Horas realocadas
                 + Caixas + Manutenção + Ocupação + Movimentação + Inventário
                 + Perdas + Avarias + Vendas
                 + Custo financeiro do estoque
```

Margem de área já está dentro de vendas. Ocupação mensal não entra quando a tese é margem.

## 4. Investimento, custo mensal, tributos e financiamento

```
multiplicador do investimento = fator da sensibilidade × fator do cenário
investimento bruto = soma dos seis itens × multiplicador, arredondada em centavos
investimento evitado = prateleiras, em loja nova, se entram e ainda não são necessárias
                     + investimento imobiliário, em loja nova, se essa for a tese e o valor entrar
crédito de impostos = equipamento × percentual × multiplicador, arredondado em centavos
                      percentual padrão de 25%, editável de 0% a 100%, sobre o preço de compra do equipamento
                      premissa a validar com o fiscal: depende do regime (IBS/CBS ou ICMS)
investimento líquido = bruto − evitado − crédito, arredondado em centavos
as parcelas do cronograma são ajustadas para somar 100%
caixa na data zero = zero se o líquido é zero
                     senão −líquido × parcela do mês 0
custo mensal base = (suporte + outros custos + energia calculada) × fator do cenário, arredondado em centavos
custo mensal do mês = zero antes do início da operação
                      senão a base × índice de inflação do custo mensal
```

O custo mensal é o que se repete: suporte pago à fornecedora, energia calculada e outros custos. O preço do equipamento está só no investimento. Se o custo mensal anual passa de 20% do investimento bruto, ou se há custo mensal sem investimento, a tela avisa: o preço do robô pode ter sido lançado no lugar errado.

Parcelas posteriores ao mês 0 saem no caixa pontual daquele mês, não na data zero. O exemplo desembolsa 100% na data zero.

Depreciação linear, só quando o imposto está ligado:

```
meses de depreciação = o maior entre 1 e os anos informados × 12, arredondados
depreciação do mês = investimento líquido / meses, do início da operação até esgotar a vida
```

A depreciação reduz a base tributável e não sai do caixa. Resultado, base tributável e imposto de caixa são leituras separadas do mês.

Política efetiva: imposto desligado força "sem impostos". Imposto ligado com política "sem impostos" passa a tratar o resultado incremental de forma simplificada.

```
base tributável = resultado operacional − depreciação

sem impostos
  imposto de caixa = zero

resultado incremental simplificado
  imposto = máximo entre zero e a base, vezes a alíquota

prejuízo com limite
  base negativa aumenta o saldo de prejuízo e o imposto de caixa é zero
  base positiva usa o menor entre o saldo e a base × limite, e tributa o que sobra

benefício condicionado
  imposto positivo = base × alíquota
  imposto negativo só se o benefício foi validado, e no máximo a capacidade mensal
```

Valor residual no mês 60 entra cheio se não há imposto, se os eventos extraordinários não são tributáveis, ou se o residual é zero. Caso contrário entra residual menos (residual − valor contábil) × alíquota.

Financiamento não altera o fluxo do projeto. Por isso valor presente, taxa interna de retorno, payback e retorno do projeto ficam iguais com ou sem dívida.

```
principal financiado = máximo entre zero e o investimento líquido, vezes (1 − entrada)
parcela = tabela Price com balão; se o juro mensal é zero, (principal − balão) / prazo
fluxo do investidor na data zero = fluxo do projeto + principal recebido
nos meses do prazo, subtrai a parcela; no fim do prazo, subtrai o balão
custo financeiro total = entrada + parcelas + balão − investimento líquido
taxa do capital próprio = taxa interna de retorno anual do fluxo do investidor, quando existe
```

O principal recebido não é benefício operacional. A tela mostra valor presente e taxa do projeto, taxa do capital próprio, serviço da dívida, saldo devedor e custo financeiro total.

## 5. Construção dos 60 meses

Para cada mês de 1 a 60:

```
benefício = benefício daquele mês
custo do robô = custo mensal daquele mês
antes do imposto = benefício − custo do robô
imposto = política da seção anterior
operacional = antes do imposto − imposto
caixa pontual = capital de giro − rescisão − remoção + revenda
              + residual + recrutamento + treinamento + parcela do investimento
fluxo = operacional + caixa pontual
acumulado = acumulado anterior + fluxo
descontado = fluxo / (1 + taxa mensal) elevado ao mês
```

A taxa mensal é (1 + taxa anual) elevado a 1/12, menos 1. Com 12% ao ano, cerca de 0,9489% ao mês. A data zero não é descontada. O mês é descontado a fim de mês. Cada etapa arredonda em centavos.

Colunas de exibição:

```
perdas históricas exibidas = históricas do mês × fator de benefício, se as perdas entraram e o mês já começou
perdas projetadas exibidas = o menor entre projetadas e históricas, vezes o fator de benefício
custo sem robô = (benefício − vendas) − perdas evitadas + perdas históricas exibidas
custo com robô = perdas projetadas exibidas + custo mensal do robô
```

Assim, custo sem robô menos custo com robô mais margem de vendas = benefício menos custo mensal do robô. Não é o custo total da loja.

## 6. Indicadores

O retorno antigo, quando ainda aparece numa simulação salva, continua igual ao retorno estabilizado.

```
valor presente = soma de cada fluxo dividido por (1 + taxa mensal) elevado à data, da data zero ao mês 60
taxa anual efetiva = (1 + taxa mensal interna) elevado a 12, menos 1
payback simples = (mês − 1) + (−acumulado anterior / fluxo daquele mês)
payback descontado = a mesma interpolação no caixa descontado
retorno anual simples estabilizado = (líquido do mês 60 × 12) / investimento líquido
retorno acumulado em 60 meses = soma do operacional líquido / investimento líquido
benefício operacional anual = benefício bruto do mês 60 × 12
economia acumulada = soma do benefício bruto no horizonte
caixa acumulado = acumulado do mês 60, já com a data zero
investimento líquido = investimento bruto − investimento evitado − crédito de impostos
```

| Nome na tela | O que é | O que não é |
|---|---|---|
| Retorno anual simples estabilizado | Ritmo do mês 60, anualizado, sobre o investimento líquido | Retorno acumulado, taxa interna ou média do período |
| Retorno acumulado em 60 meses | Soma dos operacionais líquidos dividida pelo investimento | Payback nem valor presente |
| Payback simples | Meses até o caixa acumulado cruzar zero | Não desconta |
| Payback descontado | A mesma conta no caixa descontado | Não é o valor presente |
| Valor presente | Valor de hoje do fluxo do projeto | Não inclui a dívida |
| Taxa interna de retorno anual efetiva | Taxa anual equivalente que zera o valor presente do projeto | Ambígua se o fluxo troca de sinal mais de uma vez |

Casos extremos:

- Investimento líquido zero: retorno nulo, payback imediato, taxa indefinida, valor presente finito.
- Investimento líquido negativo: retorno nulo, payback imediato, aviso de investimento evitado maior que o bruto.
- Sem recuperação em 60 meses: payback vazio, texto "Não recupera em 60 meses".
- Taxa inexistente, quando não há fluxo positivo e negativo ou não há raiz: "Indefinida". A busca começa em 1% ao mês e, se falhar, estreita o intervalo.
- Mais de uma troca de sinal: a taxa fica marcada como ambígua. A decisão usa o valor presente.
- Taxa anual de −100% ou pior: a taxa mensal fica indefinida, e valor presente e payback descontado não são calculados.

## 7. Cenários, loja e rede

| Item | Loja nova | Loja existente |
|---|---|---|
| Prateleiras — aquisição evitada | Abate o investimento, se ainda não forem necessárias | Não entra |
| Prateleiras — revenda | Não entra | Entrada no início da operação |
| Prateleiras — manutenção evitada | Não entra | Benefício recorrente |
| Prateleiras — remoção | Não entra | Saída no início da operação |
| Rescisão | Não entra | Saída no maior entre o início da operação e o mês da folha |
| Recrutamento e treinamento das vagas da folha | Entram, se não bloqueados | Não entram |
| Recrutamento e treinamento de contratações futuras | Entram | Entram |
| Investimento imobiliário evitado | Abate o investimento, se essa for a tese | Não entra |
| Créditos recuperáveis (IBS/CBS ou ICMS) | Abatem o investimento no mês 0. Premissa a validar | Abatem o investimento no mês 0. Premissa a validar |

O fator de benefício multiplica os benefícios recorrentes. O fator de vendas multiplica só as alavancas de venda, além do fator de benefício. No conservador a venda fica com 0,80 × 0,60 = 0,48 do valor base. O fator do custo mensal multiplica suporte, outros custos e a energia calculada. O fator do investimento multiplica o bruto, o evitado, o crédito sobre o equipamento e o valor residual. O percentual do crédito não muda com o cenário; o valor em reais acompanha o equipamento.

Não recebem fator de cenário: rescisão, remoção, revenda, recrutamento, treinamento e o principal do capital de giro.

Rede desligada: a quantidade de lojas replica investimento, líquido mensal e valor presente. Payback e retorno ficam os da loja. Rede ligada, com ao menos uma unidade: cada loja é avaliada com o próprio tipo, data, fator de investimento, volume e mão de obra. O custo compartilhado sai uma vez por mês, nos meses 1 a 60. O payback de cada loja é o dela, então unidades com investimentos diferentes podem ter paybacks diferentes. O painel principal continua mostrando a loja corrente; o cartão de rede mostra a visão escalonada.

## 8. Regras para não contar o mesmo real duas vezes

A trava segue esta ordem: desligado; bloqueio específico; potencial com a opção de incluir ganhos potenciais desligada; entra.

| Regra | O que acontece |
|---|---|
| Recrutamento já no turnover | Se estiver marcado como incluso, ou se o modo detalhado tiver componente de recrutamento maior que zero, o evento fica de fora |
| Treinamento já no custo de substituição | Se estiver marcado como incluso, ou se o modo detalhado tiver treinamento do substituto maior que zero, o evento fica de fora |
| Custo de turnover | O modo consolidado usa o custo por substituição e ignora os componentes. O detalhado soma os componentes e ignora o consolidado |
| Supervisão ou movimentação já na folha | A marcação de hora já contada bloqueia a linha |
| Horas acima da jornada de quem ficou | O excedente é cortado na proporção e a tela avisa |
| Vagas acima do quadro | A folha mensal fica no quadro e a tela avisa |
| Horas realocadas | Não viram folha. Sem monetização, ou sem evidência no ganho incremental, ficam de fora |
| Vendas sobrepostas | Sem independência confirmada, só a maior no mês 60 |
| Caixas | Exigem processo validado. No detalhe, só os componentes ligados |
| Prateleira ainda necessária | Não gera investimento evitado, revenda, manutenção nem remoção |
| Espaço | Ocupação ou margem, nunca os dois. Contrato inalterado bloqueia aluguel. Sem monetização fica só na auditoria |
| Perdas detalhadas | Substituem histórico menos projetado e bloqueiam a linha de avarias |
| Capital de giro | Principal ou custo financeiro. Sem redução comprovada, os dois ficam de fora |
| Disponibilidade zero | Zera folha, estoque, dispensação e vendas. O custo mensal do robô continua |
| Disponibilidade parcial | Não corta a folha se a reorganização continua. Corta dispensação, logística de volume e vendas |
| Financiamento | Não muda valor presente, taxa, retorno nem payback do projeto |
| Ganhos potenciais | Ficam de fora até a opção de incluí-los ser ligada |

No exemplo, ficam de fora: venda consultiva (potencial e sem evidência), caixas (potencial e processo não validado), recrutamento e treinamento (já inclusos), rupturas, atendimento, abandono e capital de giro (desligados) e contratações futuras (desligadas). Perdas e avarias entram juntas, com aviso de possível sobreposição.

A auditoria de cada linha guarda nome, fórmula, premissas, unidade, origem, classificação, condição, valor mensal, valor acumulado, mês de início, fator de captura, inclusão ou exclusão com justificativa, dependências e conflitos. Linha excluída não altera o fluxo. O valor mensal pode aparecer mesmo assim, marcado como fora do caixa.

## 9. Ajuste rápido e sensibilidade

As duas telas aplicam o mesmo percentual sobre a mesma premissa. Quinze por cento é o mesmo percentual nas duas. A sensibilidade recalcula o exemplo em cinco pontos: −30%, −15%, zero, +15% e +30%.

### 9.1 Ajuste rápido

O controle vai de −100% a +30%, em passos de 5%. O campo numérico aceita zero e valores acima de +30%. Sem base positiva, o controle fica desativado. O rótulo da alavanca de salários na tela é "Mão de obra".

| Alavanca | O que muda |
|---|---|
| Investimento do robô | Os seis itens do investimento. Com fator maior que zero, a aquisição evitada de prateleiras escala junto. Com fator zero, o investimento do robô zera e a prateleira evitada permanece |
| Custo mensal do robô | Suporte, outros custos e a tarifa de energia. Potência, horas e dias não mudam |
| Mão de obra | Custo da vaga, benefícios, custo das futuras, custo de turnover e componentes, horas de supervisão, movimentação e inventário, recrutamento, treinamento e valores monetizados das horas realocadas |
| Turnover | Só a taxa anual |
| Volume | Dispensações, perdas históricas e projetadas, componentes detalhados de perda, avarias, ciclos de caixa e horas de movimentação. Não escala o estoque do capital de giro |
| Vendas | Rupturas, atendimento, abandono, margem por hora da venda consultiva e, se o modo é margem, a margem por metro |
| Taxa de desconto | Só a taxa anual. Não muda o retorno estabilizado nem o payback simples |
| Disponibilidade | O percentual, limitado de 0 a 1 |
| Cobertura do estoque | A fração automatizada, limitada de 0 a 1 |

### 9.2 Sensibilidade do exemplo

Cenário base, loja nova. Payback simples. A tabela numérica no fim desta página é recalculada na publicação, com o exemplo fictício de abertura, nos cinco pontos −30%, −15%, zero, +15% e +30%.

Vendas não movem o exemplo porque nenhuma margem de venda entra no fluxo. Desconto não move o payback simples; move valor presente e payback descontado. Disponibilidade e cobertura já estão em 100% no exemplo, então os aumentos batem no teto e o payback fica no centro. A queda de disponibilidade quase não muda o payback porque a folha não é cortada enquanto a disponibilidade é maior que zero. A cobertura corta perdas e inventário. Avarias estão desligadas no exemplo, então não entram nessa curva.

## 10. Exemplo numérico ilustrativo

Cenário base, loja nova, dados fictícios. Curvas em 100%, sem inflação, sem imposto sobre o resultado, rede desligada, capturas em 1, encargos e benefícios zero. Obras, elétrica e rede continuam R$ 50.000. O equipamento da configuração base é R$ 1.000.000. O suporte pago à fornecedora é R$ 5.500. A energia é calculada (2,5 quilowatts, 16 horas por dia, 30 dias, R$ 1,17 por quilowatt-hora) e os outros custos são R$ 200. O crédito recuperável de impostos parte de 25% do equipamento e é premissa a validar com o fiscal. Avarias ficam fora do caixa. O piso do equipamento não foi compensado com benefício novo.

Quadro de 12 pessoas, 3 vagas evitadas, jornada de 176 horas. Horas reivindicadas no exemplo somam 70 (supervisão 20, movimentação 20, inventário 10 e venda consultiva 20, esta última fora do caixa), abaixo das 1.584 horas de quem permanece, então as horas entram inteiras.

O retorno estabilizado é o ritmo do mês 60. Não é o retorno acumulado e não é a taxa interna. A energia entra no custo mensal e acompanha a inflação desse custo. O crédito entra só no investimento, no mês 0.

Na loja existente do mesmo exemplo não há investimento evitado de prateleira. Entram a manutenção evitada das prateleiras e, no mês 1, a revenda menos a rescisão. O cenário otimista reduz o investimento informado em 3% e o custo mensal informado em 8%. O preço digitado do equipamento não muda, o percentual do crédito não muda e o suporte digitado não muda. A energia calculada entra no fator do custo mensal. No conservador o equipamento entra 8% maior, então o crédito em reais sobe junto.

### 10.1 Lojas de R$ 1, 2 e 4 milhões

Loja existente, dados fictícios a validar com a operação. Obras, elétrica e rede permanecem R$ 50.000. O equipamento é R$ 1.000.000, R$ 1.350.000 (segundo braço) e R$ 1.850.000 (segundo braço, carregador automático e módulo refrigerado). Frete, instalação, integração e contingência ficam em torno de 6%, 4%, 2,5% e 5% do conjunto. O suporte pago à fornecedora é R$ 5.500 nas três lojas. A energia calculada e os outros custos entram no custo mensal. A ocupação da área liberada não entra no caixa. Perdas entram uma vez, na taxa de 1,4% para 0,6% do faturamento; avarias ficam desligadas. Contratações futuras começam no mês 13, então o payback simples não é o investimento dividido pelo líquido do mês 60.

O quadro do fim da página mostra investimento, custo mensal, líquido, payback, retorno acumulado e valor presente em cada cenário. A loja de R$ 1 milhão não ganhou benefício novo para encurtar o prazo. As vagas evitadas são 3, 6 e 9: uma por turno e uma de pico em cada balcão na loja de um balcão e na de dois; na de três balcões, um posto por turno, inclusive a noite. A folha completa sugerida, que não entra inteira no caixa, cresce com o quadro (12, 24 e 47 pessoas).

## 11. Limitações e pontos de atenção

- Há curvas por família e cronograma de desembolso. O exemplo usa degrau de 100% e desembolso inteiro na data zero. Um início posterior continua sem benefício e sem custo mensal do robô antes dele; o investimento segue o cronograma, não o mês de início da operação.
- Há índices de salário, de custo mensal e de preço. No exemplo estão em zero. Se a demanda cresce e salários e custo mensal ficam parados numa base nominal, a tela avisa. Se a base dos fluxos e a base da taxa de desconto divergem, a tela avisa.
- O retorno estabilizado usa o mês 60. Com crescimento, não é a média do período.
- Continuam fora da conta: atendimentos por dia, dias de operação, área total, retaguarda, giro e quantidade de itens. O faturamento só gera aviso. Os cargos entram no teto de vagas e no orçamento de horas.
- A ocupação usa o valor por metro da logística quando ele é maior que zero (R$ 200 no exemplo). O do perfil (R$ 120) é reserva. A tela de logística grava os dois com o mesmo número.
- Fatores de cenário não se aplicam a rescisão, remoção, revenda, recrutamento, treinamento nem ao principal do capital de giro. A liberação de giro também não passa por captura nem por volume.
- Vendas recebem o fator de benefício e o fator de vendas ao mesmo tempo.
- A venda consultiva não recebe a alavanca de volume.
- Avarias do exemplo ficam desligadas. Perdas entram uma vez, pelo histórico menos o projetado.
- Imposto: prejuízo não vira crédito sozinho. A política é configurável e pede validação fiscal. 34% não é premissa de regime.
- A taxa interna com mais de uma troca de sinal fica marcada como ambígua. A decisão usa o valor presente.
- A coluna descontada da tabela é arredondada mês a mês. Valor presente e payback descontado usam os fluxos e só arredondam o resultado. Pode haver diferença de centavos. No exemplo plano, sem variação mês a mês, os dois fecham no mesmo valor. O quadro calculado no fim da página mostra esse valor.
- A auditoria mostra valor mensal também do que ficou de fora. A marcação de inclusão é que decide o caixa.
- Rede desligada replica a loja em linha reta. Rede ligada desloca cada unidade para a data dela e pode produzir paybacks diferentes.
- No assistente, investimento além do robô vai para implantação e contingência, e o custo mensal total vai para manutenção. Os totais não mudam; muda a distribuição que o ajuste rápido escala.
- O assistente valida faixas. A conta não recusa entrada: perdas projetadas acima das históricas zeram a economia de perdas e geram aviso.
- Simulações salvas na biblioteca atual são mantidas. Campos novos recebem padrão neutro (curva de 100%, imposto como estava), exceto o crédito recuperável de impostos: simulação antiga sem o campo passa a 25% do equipamento. Um percentual gravado fora de 0% a 100% é trazido para essa faixa. Se a simulação antiga não diz se a queda de estoque foi comprovada, o padrão agora é não presumir redução.
- Há três modelos fictícios de loja (R$ 1, 2 e 4 milhões de faturamento mensal) para carregar com um clique. Não são dados de uma rede real.
- Cada módulo e o assistente têm um texto recolhível, “O que esta tela calcula”, para quem não vai ler esta página.
