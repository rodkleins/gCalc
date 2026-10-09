# Casos de validação

Os valores abaixo foram fechados fora do exemplo de R$ 65.000. A implementação está em `src/model/reference.test.ts`. Rode `npm test`.

| Caso | Entrada essencial | Resultado esperado |
| --- | --- | --- |
| Investimento zero | 1 vaga × R$ 1.000, CAPEX 0 | Líquido R$ 1.000, payback imediato, TIR nula, VPL finito |
| Investimento negativo | prateleira evitada R$ 5.000 e CAPEX 0 | Caixa inicial +R$ 5.000, retorno nulo |
| Benefício negativo | OPEX R$ 2.000, CAPEX R$ 60.000 | Líquido −R$ 2.000, payback nulo, VPL negativo |
| Sem recuperação | R$ 120.000 / R$ 1.000 por mês | 60 × 1.000 < 120.000, payback nulo |
| Turnover zero | taxa 0 | Folha R$ 2.000 e substituição R$ 0 |
| Turnover alto | 1 posição, taxa 100%, custo R$ 12.000 | R$ 1.000/mês. Detalhe com os mesmos R$ 12.000 não soma o consolidado |
| Nenhuma vaga | 0 × R$ 8.000 | R$ 0 |
| Contratação no mês 6 | R$ 3.000 | Meses 1–5 zerados, mês 6 em R$ 3.000 |
| Treinamento e recrutamento inclusos | 2 vagas, R$ 500 e R$ 700 | Evento só aparece quando a flag de "já incluso" está desligada: +R$ 2.400 no mês 1 |
| Horas sem folha | 80 h e monetização nenhuma | R$ 0. Com redução de R$ 5.000, o líquido vai a R$ 5.000 |
| Disponibilidade zero | folha de R$ 1.000 | R$ 0 |
| Capacidade pela metade | venda de R$ 10.000 × margem 50% × cobertura 50%, folha R$ 1.000 | Venda R$ 2.500, folha intacta, líquido R$ 3.500 |
| Go-live no mês 4 | folha de R$ 1.000 | Meses 1–3 zerados |
| Rampa 50% depois 100% | folha de R$ 1.000 | Mês 1 R$ 500, mês 2 R$ 1.000 |
| Capital de giro | estoque 10.000 para 4.000, reversão no mês 60, CAPEX R$ 1.000 | +R$ 6.000 no mês 2, −R$ 6.000 no mês 60, TIR ambígua, custo financeiro fora |
| Loja de R$ 1 milhão (modelo fictício, existente) | folha 2 × 4.200, futura 1 × 4.200, turnover 30% × 8.000 / 12 sobre 3 vagas, supervisão 16 × 45, movimento 20 × 40, inventário 8 × 40, perdas 6.000, manutenção 800, OPEX 8.500, CAPEX 1.600.000 | Benefício R$ 21.840, líquido R$ 13.340. Em loja nova a futura sai e o turnover fica em 2 vagas |
| Prejuízo fiscal | OPEX R$ 10.000, limite de aproveitamento 0, alíquota 34% | Imposto de caixa R$ 0, líquido −R$ 10.000 |
| Loja nova × existente | CAPEX 10.000, prateleira 1.000, revenda 400, rescisão 250, folha 100 | Nova: investimento 9.000. Existente: 10.000 e caixa do mês 1 = 250 |
| Financiamento | 12.000, entrada 25%, 12 meses | VPL do projeto igual com juros 0 ou 12%. Sem juros a parcela é R$ 750 e a entrada é R$ 3.000 |
| Vendas sobrepostas | R$ 10.000 e R$ 2.000 de venda, margem 50% | Só R$ 5.000 até confirmar independência; depois R$ 6.000 |
| Caixas | 10 × R$ 5 | R$ 0 sem validação; R$ 50 com validação |
| Driver de 15% | mão de obra no ajuste e na sensibilidade | Mesmo líquido, payback e VPL |
| Inflação de 12% | folha 1.000 e OPEX 100 | Mês 1 líquido R$ 900; mês 13 ≈ R$ 1.008 |
| Rede | uma loja com CAPEX 12.000 e outra com o dobro, benefício 1.000 | Paybacks de 12 e 24 meses |

O exemplo ilustrativo da calculadora não é um desses casos. Ele continua reproduzindo R$ 2.000.000, R$ 65.000, 30,8 meses e 39% e deve ser apresentado como dado fictício.
