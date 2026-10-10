# Quadro de RH por turno (versão em validação)

Endereço: [https://rodkleins.github.io/gCalc/rh/](https://rodkleins.github.io/gCalc/rh/).

Os cálculos desta versão: [https://rodkleins.github.io/gCalc/rh/calculos/](https://rodkleins.github.io/gCalc/rh/calculos/).

A calculadora em `/gCalc/`, o rascunho `/gCalc/headtohead/` e a página `/gCalc/calculos/` não usam este quadro. A sessão fica em `gcalc.rh.library.v1` e não mexe em `gcalc.library.v2`, `gcalc.inputs.v1` nem `gcalc.headtohead.v1`.

## Conta do folguista

O posto já é uma cadeira daquele turno. A escala diz quantas pessoas contratadas mantêm uma pessoa presente cada vez que o turno acontece. Um turno de 8 horas e uma escala de 12 horas não se multiplicam: 12x36 não é 12/48 nem 12/8.

Padrão visível: 365 dias, 30 de férias e 6 faltas. Esses dias continuam editáveis e recalculam o fator. Cada posto mostra o fator calculado, somente leitura, e a memória da conta. A substituição manual fica recolhida em “Substituir o fator calculado”: preenchida, troca o fator só naquele posto.

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

Sem férias nem faltas, os fatores ficam em 7/6, 7/5 e 2. Duas posições de auxiliar liberadas em 6x1, a R$ 4.200, viram 2,5887 vagas e R$ 10.872 de folha evitada. Uma cadeira noturna em 12x36, com adicional de 10%, vira R$ 10.251.

A rescisão é um mês da folha evitada agora. A contratação futura, no mês 13, usa a mesma conta. O turnover de 30% e R$ 8.000 incide sobre essas vagas, já com o folguista. Supervisão, movimentação, inventário e horas realocadas ficam de fora.

O adicional noturno sugerido é 10% e só vale no terceiro turno.

## O que cada modelo assume

Tudo é fictício, a validar. Equipamento de R$ 1.000.000, R$ 1.350.000 e R$ 1.850.000. Custo mensal informado de R$ 5.000, R$ 5.500 e R$ 6.000. O cenário otimista ainda multiplica esse custo por 0,92, então o número exibido pode ficar abaixo de R$ 5.000. O aviso da tela olha o valor digitado.

O robô libera 1 auxiliar por turno em cada balcão. Farmacêutico, estoquista e gerente continuam no quadro e não entram como vaga evitada.

| Modelo | Turnos | Pessoas no turno | Folha do mês |
| --- | --- | --- | --- |
| Exemplo e loja de R$ 1 milhão | 2, 1 balcão | 5 + 3 | R$ 41.030 + R$ 21.874 = R$ 62.904 |
| Loja de R$ 2 milhões | 2, 2 balcões | 8 + 8 | R$ 62.904 em cada turno; no mês, R$ 125.809 |
| Loja de R$ 4 milhões | 3 (24h), 3 balcões | 11 + 11 + 10 | R$ 84.778 + R$ 84.778 + R$ 124.070; no mês, R$ 293.627 |

A noite da loja de R$ 4 milhões usa 12x36 no farmacêutico e no auxiliar (duas pessoas presentes por balcão, em três balcões) e mantém estoquista em 6x1 e gerente em 5x2. O fator 2,2188, com adicional de 10%, leva a folha da noite a R$ 124.070. Os turnos do dia, com 11 pessoas, ficam em R$ 84.778 cada. A noite fica acima do dia porque a escala pede cerca de 2,2 pessoas por cadeira e o adicional é 10%. A folha evitada do modelo é R$ 63.370. Se a operação real não cobre a noite assim, mude a escala, as férias, as faltas ou a quantidade. A substituição do fator fica recolhida no posto. O payback abaixo é o resultado dessa premissa, sem ajuste para caber em 30 meses.

A loja de R$ 1 milhão tem, além das duas posições liberadas, 1 auxiliar futuro no turno 1. A de R$ 2 milhões tem 1 futuro em cada balcão. A de R$ 4 milhões tem futuro nos dois primeiros balcões, de dia. O exemplo é loja nova: a rescisão e o futuro não entram no caixa.

## Resultado

Custo mensal da tabela é o OPEX do robô já com o fator do cenário. ROI acumulado é o do horizonte de 60 meses.

| Modelo | Cenário | Investimento líquido | Custo mensal | Benefício líquido | Payback | ROI acumulado | VPL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Exemplo fictício (nova) | Conservador | R$ 1.290.600 | R$ 5.750 | R$ 11.522 | Não recupera em 60 meses | 53,6% | -R$ 765.335 |
| Exemplo fictício (nova) | Base | R$ 1.195.000 | R$ 5.000 | R$ 16.590 | Não recupera em 60 meses | 83,3% | -R$ 438.695 |
| Exemplo fictício (nova) | Otimista | R$ 1.159.150 | R$ 4.600 | R$ 19.581 | 59,2 meses | 101,4% | -R$ 266.501 |
| Loja de R$ 1 milhão | Conservador | R$ 1.333.800 | R$ 5.750 | R$ 14.798 | Não recupera em 60 meses | 62,5% | -R$ 721.402 |
| Loja de R$ 1 milhão | Base | R$ 1.235.000 | R$ 5.000 | R$ 20.685 | Não recupera em 60 meses | 95% | -R$ 367.087 |
| Loja de R$ 1 milhão | Otimista | R$ 1.197.950 | R$ 4.600 | R$ 24.167 | 53,2 meses | 114,7% | -R$ 179.008 |
| Loja de R$ 2 milhões | Conservador | R$ 1.782.000 | R$ 6.325 | R$ 34.611 | 55,3 meses | 110,4% | -R$ 328.583 |
| Loja de R$ 2 milhões | Base | R$ 1.650.000 | R$ 5.500 | R$ 45.670 | 39,6 meses | 157,8% | R$ 281.853 |
| Loja de R$ 2 milhões | Otimista | R$ 1.600.500 | R$ 5.060 | R$ 52.251 | 34,0 meses | 186,3% | R$ 615.906 |
| Loja de R$ 4 milhões | Conservador | R$ 2.413.800 | R$ 6.900 | R$ 82.256 | 31,4 meses | 199,9% | R$ 1.170.398 |
| Loja de R$ 4 milhões | Base | R$ 2.235.000 | R$ 6.000 | R$ 105.445 | 23,1 meses | 277% | R$ 2.380.609 |
| Loja de R$ 4 milhões | Otimista | R$ 2.167.950 | R$ 5.520 | R$ 119.298 | 20,0 meses | 323,1% | R$ 3.063.771 |

O exemplo e a loja de R$ 1 milhão não recuperam o investimento em 60 meses no cenário base. A de R$ 2 milhões fica em 39,6 meses. A de R$ 4 milhões fica em 23,1 meses no base e em 31,4 meses no conservador. Nenhuma dessas três foi puxada para 30 meses.
