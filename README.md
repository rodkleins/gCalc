# gCalc — calculadora de ROI Gollmann

Aplicação web para estimar a viabilidade de um robô Gollmann de armazenagem e dispensação em farmácias. Compara a operação **sem robô** e **com robô** ao longo de 60 meses, no navegador, sem backend.

Os valores iniciais são um **exemplo fictício**. Não são parâmetros oficiais da Gollmann nem resultado de uma loja real.

## Exemplo que a ferramenta reproduz

No cenário **base**, loja **nova**, com as premissas ilustrativas carregadas ao abrir:

| Indicador | Valor |
| --- | --- |
| Investimento líquido | R$ 2.000.000 |
| Benefício líquido | R$ 65.000 por mês |
| Benefício anual | R$ 780.000 |
| Payback simples | 30,8 meses |
| ROI anual simples | 39% |

O payback de 30,8 meses é a interpolação: `2.000.000 / 65.000`. O caixa acumulado fica positivo no mês 31. O ROI é `780.000 / 2.000.000` e não é a TIR.

O investimento bruto do exemplo é R$ 2.180.000. Em loja nova, R$ 180.000 de prateleiras evitadas reduzem o CAPEX ao líquido de R$ 2.000.000. O benefício bruto de R$ 80.000 menos o OPEX de R$ 15.000 produz os R$ 65.000.

## Como rodar

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm test
npm run dev
```

Abra [http://localhost:5173/gCalc/](http://localhost:5173/gCalc/). O `base` do Vite é `/gCalc/`, o mesmo caminho usado no GitHub Pages.

```bash
npm run build
npm run preview
```

O preview também fica em `/gCalc/`.

## Como usar numa visita

1. A aplicação abre no exemplo fictício. O aviso âmbar deixa isso explícito.
2. Percorra os módulos: perfil, pessoas, logística, estoque e investimento. Cada benefício pode ser ligado ou desligado.
3. Troque o cenário (conservador, base, otimista) e o tipo de loja (nova ou existente) no topo. O dashboard recalcula na hora.
4. Use **Resultados** para payback, ROI, VPL, TIR, gráficos e a comparação entre os dois tipos de loja.
5. Use **Sensibilidade** para variar investimento, mão de obra, turnover, vendas e volume.
6. Use **Fluxo** para os 60 meses e **Auditoria** para ver o que entrou no caixa e o que ficou de fora.
7. **Restaurar exemplo fictício** volta ao caso do escopo. **Nova simulação** zera os valores. Dá para baixar e recarregar o JSON. A simulação atual também fica no navegador.

Quando os dados forem de uma loja real, desmarque **Marcar esta simulação como dados fictícios** no perfil.

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

A suíte cobre VPL, TIR, payback simples e descontado, o exemplo de R$ 2.000.000 / R$ 65.000 / 30,8 meses / 39%, as regras de dupla contagem e a presença desses números na tela.

## Publicar no GitHub Pages

O build usa o caminho base `/gCalc/`. O workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) roda testes, gera `dist` e publica no Pages a cada push na branch `main`.

Para o endereço [https://rodkleins.github.io/gCalc/](https://rodkleins.github.io/gCalc/) passar a responder:

1. No repositório, abra **Settings > Pages**.
2. Em **Build and deployment**, fonte **Source: GitHub Actions**.
3. Faça um push na `main` (ou rode o workflow **Publicar no GitHub Pages** em Actions).
4. O primeiro deploy pode pedir que o environment `github-pages` seja criado. A URL pública aparece ao fim do job.

## Stack

Vite, React e TypeScript. Gráficos com Recharts. Testes com Vitest. Não há servidor de aplicação: o cálculo inteiro roda no browser. O build estático serve no GitHub Pages, na Vercel ou na Netlify, desde que o caminho base `/gCalc/` seja respeitado. Num host na raiz do domínio, altere `base` em `vite.config.ts`.

## Fora deste MVP

Persistência com usuários, CRM, PDF e planilha de memória de cálculo ficam para uma etapa com backend. O JSON local cobre o transporte da simulação enquanto isso.
