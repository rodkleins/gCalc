# gCalc — calculadora de ROI Gollmann

Aplicação web para estimar a viabilidade de um robô Gollmann de armazenagem e dispensação em farmácias. Compara a operação **sem robô** e **com robô** ao longo de 60 meses, no navegador, sem backend.

Os valores iniciais são um **exemplo fictício**. Não são parâmetros oficiais da Gollmann nem resultado de uma loja real.

## Exemplo que a ferramenta reproduz

No cenário **base**, loja **nova**, com as premissas ilustrativas carregadas ao abrir:

| Indicador | Valor |
| --- | --- |
| Investimento líquido | R$ 945.000 |
| Benefício líquido | R$ 18.396 por mês |
| Benefício anual | R$ 220.752 |
| Payback simples | 51,4 meses |
| ROI anual simples | 23,4% |

O payback de 51,4 meses é a interpolação: `945.000 / 18.396`. O caixa acumulado fica positivo no mês 52. O ROI é `220.752 / 945.000` e não é a TIR.

O investimento bruto do exemplo é R$ 1.235.000, com R$ 50.000 de obras, elétrica e rede e R$ 1.000.000 de equipamento. Em loja nova, R$ 40.000 de prateleiras evitadas e R$ 250.000 de créditos recuperáveis de impostos (25% do equipamento, premissa a validar com o fiscal) reduzem o CAPEX ao líquido de R$ 945.000. O benefício bruto de R$ 25.500 menos o OPEX de R$ 7.104 produz os R$ 18.396. Esse OPEX é suporte de R$ 5.500, energia calculada de R$ 1.404 (2,5 kW × 16 h × 30 dias × R$ 1,17/kWh) e outros custos de R$ 200. Avarias ficam fora do caixa: a perda é uma linha só. Tudo continua fictício, a validar.

O equipamento dos padrões fica em R$ 1.000.000, R$ 1.350.000 e R$ 1.850.000. O suporte pago à fornecedora fica em R$ 5.500 nas três lojas, na faixa de R$ 5.000 a R$ 6.000. A energia é calculada e o custo mensal informado fica em R$ 7.104. O crédito de impostos parte de 25% do equipamento nas três lojas. No cenário base, o payback das lojas é 48,2, 29,1 e 22,4 meses. A de R$ 1 milhão continua acima de 30 meses. A tela avisa se o equipamento digitado ficar abaixo de R$ 1.000.000 ou se o suporte digitado ficar fora de R$ 5.000 a R$ 6.000.

## Como rodar

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm test
npm run dev
```

Abra [http://localhost:5173/](http://localhost:5173/). Os caminhos do build são relativos, os mesmos do domínio publicado.

O rascunho de comparação head-to-head fica em [http://localhost:5173/headtohead/](http://localhost:5173/headtohead/). Ele não substitui a calculadora atual. No ar, o endereço é [https://gcalc.t2software.co/headtohead/](https://gcalc.t2software.co/headtohead/).

A versão em validação, com quadro de RH por turno, fica em [http://localhost:5173/rh/](http://localhost:5173/rh/) e no ar em [https://gcalc.t2software.co/rh/](https://gcalc.t2software.co/rh/). Ela não altera a calculadora desta raiz. Os cálculos dela estão em [https://gcalc.t2software.co/rh/calculos/](https://gcalc.t2software.co/rh/calculos/).

```bash
npm run build
npm run preview
```

O preview local também abre na raiz do servidor.

## Como usar numa visita

1. A aplicação abre no exemplo fictício. O aviso âmbar deixa isso explícito.
2. Percorra os módulos: perfil, pessoas, logística, estoque e investimento. Cada benefício pode ser ligado ou desligado.
3. Troque o cenário (conservador, base, otimista) e o tipo de loja (nova ou existente) no topo. O dashboard recalcula na hora.
4. Use **Resultados**, o último item do menu, para payback, ROI, VPL, TIR, gráficos e a comparação entre os dois tipos de loja. Os gráficos abrem a página, antes das tabelas e do texto. Cada premissa exibida — investimento, OPEX, taxa de desconto e cada benefício que entrou no caixa — abre o campo correspondente, já focado. O painel **Ajuste rápido** varia investimento do robô, OPEX, salários, turnover, volume, vendas e taxa de desconto. O cabeçalho recolhe e expande as premissas, e o navegador lembra essa escolha. O slider e os botões vão de −100% a +30% do valor original; o número aceita zero e qualquer valor acima disso. O chip verde mostra a variação de payback, ROI, VPL e TIR, e **Desfazer ajuste** volta ao original. Investimento zero deixa a TIR indefinida e o payback imediato. O ajuste fica neste navegador.
5. Use **Sensibilidade** para variar investimento, mão de obra, turnover, vendas e volume.
6. Use **Fluxo** para os 60 meses e **Auditoria** para ver o que entrou no caixa e o que ficou de fora.
7. **Nova simulação** abre o assistente: tipo de loja e cenário, depois uma tela curta por tema, com valores sugeridos, validação e resumo antes do dashboard. **Pular** segue sem validar. **Ir para o modo completo** abre os módulos. **Assistente** volta ao preenchimento guiado. **Restaurar exemplo** volta ao caso do escopo. **Limpar dados salvos** apaga o rascunho e as simulações nomeadas deste navegador.
8. Tudo que você edita — premissas, cenário, tipo de loja, benefícios ligados ou desligados, o módulo aberto e o passo do assistente — é gravado automaticamente. Os dados ficam só neste navegador.
9. Em **Simulações**, dê um nome para guardar cliente, loja e cenário. Dá para listar, carregar, duplicar, renomear, excluir e comparar duas simulações pelos indicadores principais. A mesma tela exporta e importa JSON. O seletor de porte (R$ 1, 2 e 4 milhões) fica no topo em qualquer tela. Carregar um modelo pede confirmação e oferece salvar a simulação atual antes de substituir.

Quando os dados forem de uma loja real, desmarque **Marcar esta simulação como dados fictícios** no perfil.

## Simulações neste navegador

As chaves não mudaram com o domínio novo:

- `gcalc.library.v2` — simulações nomeadas da calculadora
- `gcalc.inputs.v1` — rascunho da calculadora
- `gcalc.headtohead.v1` — rascunho da comparação
- `gcalc.rh.library.v1` — sessão da versão com quadro de RH, separada da calculadora

As preferências de tela (`gcalc.ui.railCollapsed`, `gcalc.ui.quickDockOpen`, `gcalc.ui.quickAdjustOpen`, e as equivalentes `gcalc.rh.ui.railCollapsed`, `gcalc.rh.ui.quickDockOpen`, `gcalc.rh.ui.quickAdjustOpen`) também continuam as mesmas.

O navegador guarda cada chave por endereço. Uma simulação salva em [https://rodkleins.github.io/gCalc/](https://rodkleins.github.io/gCalc/) não aparece em [https://gcalc.t2software.co/](https://gcalc.t2software.co/). No endereço antigo, exporte o JSON em **Simulações** e importe o mesmo arquivo no endereço novo. O mesmo vale para a comparação e para a versão de RH.

## Metodologia

Há dois fluxos mensais por 60 meses. A diferença de custos e de margem, menos o OPEX do robô, mais CAPEX, capital de giro e outros caixas pontuais, forma o fluxo incremental.

- Benefício operacional bruto = custos evitados + margem incremental que passou nas regras.
- Benefício operacional líquido = benefício bruto − OPEX do robô.
- VPL desconta esse fluxo pela taxa anual efetiva, convertida à taxa mensal equivalente `(1 + i) ^ (1/12) − 1`.
- TIR é a taxa que zera esse VPL, exibida também em base anual efetiva.
- Payback simples é o mês interpolado em que o caixa acumulado cruza zero. O payback descontado faz o mesmo com os fluxos trazidos a valor presente.
- ROI anual simples = benefício líquido do mês 60 × 12 / investimento líquido. Não confundir com a TIR.

Regras para não contar o mesmo real duas vezes:

- Treinamento ou recrutamento marcado como já incluso no custo de substituição não entra de novo.
- Venda consultiva, ruptura e atendimento só entram com evidência independente. Sem a confirmação de que são efeitos distintos, fica apenas a maior alavanca.
- Caixas retornáveis só entram com o processo logístico validado.
- A mesma área vale ou custo de ocupação, ou margem comercial.
- Liberação de capital de giro e custo financeiro do estoque são alternativas. A taxa de desconto do VPL já remunera o capital.
- Contratação futura só começa no mês em que a vaga existiria sem o robô.
- Rescisão e revenda de prateleiras só entram em loja existente. CAPEX evitado de prateleira só entra em loja nova.
- Disponibilidade e capacidade do robô reduzem benefícios. O OPEX não é reduzido.
- Financiamento (entrada, prazo, juros e balão) aparece à parte e não altera VPL, TIR, ROI nem payback econômico.
- Ganho marcado como potencial fica de fora até a opção **Incluir ganhos potenciais** ser ligada. As travas de dupla contagem continuam valendo.

O imposto, quando ligado, aplica a alíquota sobre o resultado operacional menos a depreciação linear e devolve o escudo fiscal ao caixa. A depreciação em si não é saída de caixa.

## Testes

```bash
npm test
```

A suíte cobre VPL, TIR, payback simples e descontado, o exemplo de R$ 945.000 / R$ 18.396 / 51,4 meses / 23,4%, as regras de dupla contagem e a presença desses números na tela.

## Publicar no GitHub Pages

O build usa caminhos relativos e gera as páginas no mesmo `dist`: a calculadora atual (`index.html`), o rascunho head-to-head (`headtohead/index.html`), a documentação dos cálculos (`calculos/index.html`) e a versão em validação (`rh/index.html` e `rh/calculos/index.html`). O workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) roda testes, gera `dist`, confere que o artefato não traz o prefixo antigo nem host absoluto, grava o arquivo `CNAME` com `gcalc.t2software.co` e publica no Pages a cada push na branch `main`. A raiz continua sem a pasta de prévia.

A página de cálculos fica em [https://gcalc.t2software.co/calculos/](https://gcalc.t2software.co/calculos/) e descreve a lógica da calculadora atual em linguagem de negócio.

O site publicado é [https://gcalc.t2software.co/](https://gcalc.t2software.co/). Para o Pages continuar respondendo nesse domínio:

1. No repositório, abra **Settings > Pages**.
2. Em **Build and deployment**, fonte **Source: GitHub Actions**.
3. Faça um push na `main` (ou rode o workflow **Publicar no GitHub Pages** em Actions).
4. O primeiro deploy pode pedir que o environment `github-pages` seja criado. A URL pública aparece ao fim do job.

## Stack

Vite, React e TypeScript. Gráficos com Recharts. Testes com Vitest. Não há servidor de aplicação: o cálculo inteiro roda no browser. O build estático usa caminhos relativos, então serve na raiz de um domínio e também numa subpasta, no GitHub Pages, na Vercel ou na Netlify.

## Versão em validação — quadro de RH

[https://gcalc.t2software.co/rh/](https://gcalc.t2software.co/rh/) é uma cópia da calculadora com quadro de gente por turno. A raiz, `/headtohead/` e `/calculos/` seguem iguais até essa versão ser promovida.

A sessão fica em `gcalc.rh.library.v1`. Ela não lê nem grava `gcalc.library.v2`. A tela avisa “Versão em validação” e aponta de volta para a calculadora atual. O detalhe das fórmulas e a tabela dos modelos estão em [docs/RH_QUADRO.md](docs/RH_QUADRO.md) e em [https://gcalc.t2software.co/rh/calculos/](https://gcalc.t2software.co/rh/calculos/).

## Rascunho head-to-head

A página [https://gcalc.t2software.co/headtohead/](https://gcalc.t2software.co/headtohead/) é um rascunho para discutir com a rede, não uma substituição da calculadora. A tabela coloca a loja **Hoje** ao lado da mesma loja **Com robô** e termina na linha **Resultado que sobra**, com a diferença de cada linha.

O exemplo fictício é uma loja de R$ 1 milhão de receita por mês. Dá para editar receita, CMV, pessoal por função, ocupação, logística, perdas, outras despesas e o custo do robô, criar indicadores de produtividade e acrescentar linhas da rede. Embaixo, payback, ROI, VPL e TIR usam a diferença mensal de resultado e o investimento, na mesma convenção de 60 meses da calculadora atual. O rascunho fica na chave `gcalc.headtohead.v1`, separada da sessão da versão atual.

## Fora deste MVP

Persistência com usuários, CRM, PDF e planilha de memória de cálculo ficam para uma etapa com backend. O JSON local cobre o transporte da simulação enquanto isso.
