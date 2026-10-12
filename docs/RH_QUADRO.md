# Quadro de RH por turno (versão em validação)

Endereço: [https://gcalc.t2software.co/rh/](https://gcalc.t2software.co/rh/).

Os cálculos desta versão: [https://gcalc.t2software.co/rh/calculos/](https://gcalc.t2software.co/rh/calculos/).

A calculadora em [https://gcalc.t2software.co/](https://gcalc.t2software.co/), a comparação em [/headtohead/](https://gcalc.t2software.co/headtohead/) e a página [/calculos/](https://gcalc.t2software.co/calculos/) não usam este quadro. A sessão fica em `gcalc.rh.library.v1` e não mexe em `gcalc.library.v2`, `gcalc.inputs.v1` nem `gcalc.headtohead.v1`. Sem simulação salva, esta versão abre na loja de R$ 2 milhões (2 turnos e 2 balcões). O exemplo de 2 turnos e 1 balcão continua na página de cálculos, como referência.

## Conta do folguista

O posto já é uma cadeira daquele turno. A escala diz quantas pessoas contratadas mantêm uma pessoa presente cada vez que o turno acontece. Um turno de 8 horas e uma escala de 12 horas não se multiplicam: 12x36 não é 12/48 nem 12/8.

Padrão visível: 365 dias, 30 de férias e 6 faltas. Esses dias continuam editáveis e recalculam o fator. Cada posto mostra o fator calculado, somente leitura, e a memória da conta. Não há campo para substituir o fator.

```
6x1 trabalha 6 e folga 1 → 7/6 pessoas por cadeira
5x2 trabalha 5 e folga 2 → 7/5 pessoas por cadeira
12x36 trabalha um dia e folga o outro, turno de 12 horas → 2 pessoas por cadeira
fator = pessoas da escala × 365 / (365 − 30 − 6)
folguista = fator − 1
```

Referência calculada à mão, com 329 dias disponíveis (365 − 30 − 6):

| Escala | Conta | Fator | Folguista por pessoa no turno |
| --- | --- | --- | --- |
| 6x1 | (7/6) × 365/329 = 2555/1974 | 1,2943 | 0,2943 |
| 5x2 | (7/5) × 365/329 = 2555/1645 | 1,5532 | 0,5532 |
| 12x36 | 2 × 365/329 = 730/329 | 2,2188 | 1,2188 |

Sem férias nem faltas, os fatores ficam em 7/6, 7/5 e 2. Duas posições de auxiliar liberadas em 6x1, a R$ 4.200, viram 2,5887 vagas e R$ 10.872 de folha evitada. Uma cadeira noturna em 12x36, com adicional de 100%, vira R$ 18.638. Meia posição liberada leva metade do folguista.

A rescisão é um mês da folha evitada agora. A contratação futura, no mês 13, usa a mesma conta. O turnover de 30% e R$ 8.000 incide sobre essas vagas, já com o folguista. Supervisão, movimentação, inventário e horas realocadas ficam de fora.

O adicional noturno padrão é 100%. No JSON a unidade é fração: 100% = 1,0. O valor não fica abaixo de 100%. Só vale no terceiro turno.

## O que cada modelo assume

Tudo é fictício, a validar. Equipamento de R$ 1.000.000, R$ 1.350.000 e R$ 1.850.000, sem fator escondido: 1,05 não multiplica o preço digitado. A instalação, comissionamento e treinamento fica em R$ 50.000 em todos os modelos desta versão. Obras, elétrica e rede continuam R$ 50.000. O suporte pago à fornecedora é R$ 5.500, na faixa de R$ 5.000 a R$ 6.000. A energia é calculada (2,5 kW, 16 h/dia, 30 dias, R$ 1,17/kWh) e, com os outros custos de R$ 200, o custo mensal informado fica em R$ 7.104. O cenário otimista ainda multiplica o CAPEX por 0,97 e o custo mensal por 0,92, inclusive a tarifa. O aviso da tela olha o suporte digitado. O ajuste rápido de investimento, se o usuário mexer no slider, escala todas as linhas de CAPEX de uma vez; isso não está embutido no modelo.

O custo de cada linha do quadro já inclui encargos e benefícios, no mesmo critério para todos os cargos. Não há um fator 1,3333 aplicado só a alguns. O adicional noturno no JSON é fração: 100% = 1,0. Abaixo de 100% a importação avisa e o quadro passa a usar 100%.

O robô libera 1 auxiliar por turno em cada balcão. Farmacêutico, estoquista e gerente continuam no quadro e não entram como vaga evitada.

| Modelo | Turnos | Pessoas no turno | Folha do mês |
| --- | --- | --- | --- |
| Exemplo e loja de R$ 1 milhão | 2, 1 balcão | 5 + 3 | R$ 41.030 + R$ 21.874 = R$ 62.904 |
| Loja de R$ 2 milhões | 2, 2 balcões | 8 + 8 | R$ 62.904 em cada turno; no mês, R$ 125.809 |
| Loja de R$ 4 milhões | 3 (24h), 3 balcões | 11 + 11 + 10 | R$ 84.778 + R$ 84.778 + R$ 225.583; no mês, R$ 395.139 |

A noite da loja de R$ 4 milhões usa 12x36 no farmacêutico noturno e no auxiliar noturno (duas pessoas presentes por balcão, em três balcões) e mantém estoquista em 6x1 e gerente em 5x2. O nome da função separa o custo da noite do custo do dia. O fator 2,2188, com adicional de 100%, leva a folha da noite a R$ 225.583. Os turnos do dia, com 11 pessoas, ficam em R$ 84.778 cada. A noite fica acima do dia porque a escala pede cerca de 2,2 pessoas por cadeira e o adicional dobra o custo da noite. A folha evitada do modelo é R$ 88.532. O robô libera 1 auxiliar por turno em cada balcão, inclusive à noite. A tela é uma tabela só: cargo, balcão, escala e custo na mesma linha, pessoas por turno, folguista somente leitura e as colunas do que o robô evita. Uma linha nova começa sem nome de balcão e com 1 pessoa em cada turno. Férias, faltas, adicional e a contratação futura ficam recolhidos. O payback abaixo é o resultado dessa premissa, sem ajuste para caber em 30 meses.

A loja de R$ 1 milhão tem, além das duas posições liberadas, 1 auxiliar futuro no turno 1. A de R$ 2 milhões tem 1 futuro em cada balcão. A de R$ 4 milhões tem futuro nos dois primeiros balcões, de dia. O exemplo é loja nova: a rescisão e o futuro não entram no caixa.

## Resultado

Custo mensal da tabela é o OPEX do robô já com o fator do cenário. ROI acumulado é o do horizonte de 60 meses.

| Modelo | Cenário | Investimento líquido | Custo mensal | Benefício líquido | Payback | ROI acumulado | VPL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Exemplo fictício (nova) | Conservador | R$ 1.031.400 | R$ 8.170 | R$ 9.422 | Não recupera em 60 meses | 54,8% | -R$ 601.851 |
| Exemplo fictício (nova) | Base | R$ 955.000 | R$ 7.104 | R$ 14.886 | Não recupera em 60 meses | 93,5% | -R$ 276.377 |
| Exemplo fictício (nova) | Otimista | R$ 926.350 | R$ 6.536 | R$ 18.093 | 51,2 meses | 117,2% | -R$ 101.521 |
| Loja de R$ 1 milhão | Conservador | R$ 1.074.600 | R$ 8.170 | R$ 12.378 | Não recupera em 60 meses | 64% | -R$ 572.507 |
| Loja de R$ 1 milhão | Base | R$ 995.000 | R$ 7.104 | R$ 18.581 | 57,8 meses | 105,2% | -R$ 223.004 |
| Loja de R$ 1 milhão | Otimista | R$ 965.150 | R$ 6.536 | R$ 22.232 | 47,3 meses | 130,3% | -R$ 34.451 |
| Loja de R$ 2 milhões | Conservador | R$ 1.412.100 | R$ 8.170 | R$ 32.767 | 47,1 meses | 131,5% | -R$ 42.774 |
| Loja de R$ 2 milhões | Base | R$ 1.307.500 | R$ 7.104 | R$ 44.066 | 33,3 meses | 191,8% | R$ 551.230 |
| Loja de R$ 2 milhões | Otimista | R$ 1.268.275 | R$ 6.536 | R$ 50.775 | 28,4 meses | 228,1% | R$ 880.858 |
| Loja de R$ 4 milhões | Conservador | R$ 1.887.300 | R$ 8.170 | R$ 101.116 | 20,6 meses | 315,7% | R$ 2.531.748 |
| Loja de R$ 4 milhões | Base | R$ 1.747.500 | R$ 7.104 | R$ 129.502 | 15,2 meses | 436,8% | R$ 3.939.922 |
| Loja de R$ 4 milhões | Otimista | R$ 1.695.075 | R$ 6.536 | R$ 146.464 | 13,2 meses | 509,4% | R$ 4.750.132 |

O investimento já desconta 25% do preço do equipamento como crédito recuperável de impostos (IBS/CBS ou ICMS). É premissa a validar com o fiscal. O exemplo no base não recupera em 60 meses. A loja de R$ 1 milhão recupera em 57,8 meses no base e não recupera no conservador. A de R$ 2 milhões fica em 33,3 meses. A de R$ 4 milhões fica em 15,2 meses no base e em 20,6 meses no conservador. Nenhuma dessas três foi puxada para 30 meses com benefício inventado. A importação avisa se o JSON vier com posto liberado zerado, adicional noturno abaixo de 100%, dois custos no mesmo cargo e balcão, equipamento abaixo de R$ 1.000.000 ou com cara de fator 1,05, instalação diferente de R$ 50.000, suporte fora de R$ 5.000 a R$ 6.000, campos removidos do custo mensal, energia antiga em reais, ou perfil divergente do quadro. Um arquivo antigo sem o percentual do crédito passa a usar 25%. A energia antiga em reais é trocada por 2,5 kW, 16 h/dia, 30 dias e R$ 1,17/kWh.
