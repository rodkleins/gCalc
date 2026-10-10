# Quadro de RH por turno (versão em validação)

Endereço: [https://rodkleins.github.io/gCalc/rh/](https://rodkleins.github.io/gCalc/rh/).

Os cálculos desta versão: [https://rodkleins.github.io/gCalc/rh/calculos/](https://rodkleins.github.io/gCalc/rh/calculos/).

A calculadora em `/gCalc/`, o rascunho `/gCalc/headtohead/` e a página `/gCalc/calculos/` não usam este quadro. A sessão fica em `gcalc.rh.library.v1` e não mexe em `gcalc.library.v2`, `gcalc.inputs.v1` nem `gcalc.headtohead.v1`.

## Conta do folguista

Padrão visível: 365 dias, 30 de férias e 6 faltas. Cada posto pode sobrescrever o fator.

```
presença 6x1 = 6/7
presença 5x2 = 5/7
presença 12x36 = 12/48
fator = 365 / (365 × presença − 30 − 6)
```

Referência calculada à mão:

| Escala | Fator | Folguista por pessoa no turno |
| --- | --- | --- |
| 6x1 | 1,3184 | 0,3184 |
| 5x2 | 1,6243 | 0,6243 |
| 12x36 | 6,6063 | 5,6063 |

Duas posições de auxiliar liberadas em 6x1, a R$ 4.200, viram `2 × 1,3184 = 2,6367` vagas e `2,6367 × 4.200 = R$ 11.074,30` de folha evitada. Uma cadeira noturna em 12x36, com adicional de 10%, vira `6,6063 × 4.200 × 1,10 = R$ 30.521,27`.

A rescisão é um mês da folha evitada agora. A contratação futura, no mês 13, usa a mesma conta. O turnover de 30% e R$ 8.000 incide sobre essas vagas, já com o folguista. Supervisão, movimentação, inventário e horas realocadas ficam de fora.

O adicional noturno sugerido é 10% e só vale no terceiro turno.

## O que cada modelo assume

Tudo é fictício, a validar. Equipamento de R$ 1.000.000, R$ 1.350.000 e R$ 1.850.000. Custo mensal informado de R$ 5.000, R$ 5.500 e R$ 6.000. O cenário otimista ainda multiplica esse custo por 0,92, então o número exibido pode ficar abaixo de R$ 5.000. O aviso da tela olha o valor digitado.

O robô libera 1 auxiliar por turno em cada balcão. Farmacêutico, estoquista e gerente continuam no quadro e não entram como vaga evitada.

| Modelo | Turnos | Pessoas no turno | Folha do mês |
| --- | --- | --- | --- |
| Exemplo e loja de R$ 1 milhão | 2, 1 balcão | 5 + 3 | R$ 42.194 + R$ 22.280 = R$ 64.474 |
| Loja de R$ 2 milhões | 2, 2 balcões | 8 + 8 | R$ 64.474 + R$ 64.474 = R$ 128.948 |
| Loja de R$ 4 milhões | 3 (24h), 3 balcões | 11 + 11 + 10 | R$ 86.754 + R$ 86.754 + R$ 328.571 = R$ 502.080 |

A noite da loja de R$ 4 milhões usa 12x36. Duas pessoas presentes por balcão, em três balcões, pedem o fator 6,6063. É isso que leva a folha da noite a R$ 328.571 e a folha evitada do modelo a R$ 124.787. Se a operação real não cobre a noite assim, o fator do posto pode ser sobrescrito. O payback abaixo é o resultado dessa premissa, sem ajuste para caber em 30 meses.

A loja de R$ 1 milhão tem, além das duas posições liberadas, 1 auxiliar futuro no turno 1. A de R$ 2 milhões tem 1 futuro em cada balcão. A de R$ 4 milhões tem futuro nos dois primeiros balcões, de dia. O exemplo é loja nova: a rescisão e o futuro não entram no caixa.

## Resultado

Custo mensal da tabela é o OPEX do robô já com o fator do cenário. ROI acumulado é o do horizonte de 60 meses.

| Modelo | Cenário | Investimento líquido | Custo mensal | Benefício líquido | Payback | ROI acumulado | VPL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Exemplo fictício (nova) | Conservador | R$ 1.290.600 | R$ 5.750 | R$ 11.691 | Não recupera em 60 meses | 54,4% | −R$ 757.619 |
| Exemplo fictício (nova) | Base | R$ 1.195.000 | R$ 5.000 | R$ 16.802 | Não recupera em 60 meses | 84,4% | −R$ 429.050 |
| Exemplo fictício (nova) | Otimista | R$ 1.159.150 | R$ 4.600 | R$ 19.818 | 58,5 meses | 102,6% | −R$ 255.698 |
| Loja de R$ 1 milhão | Conservador | R$ 1.333.800 | R$ 5.750 | R$ 15.052 | Não recupera em 60 meses | 63,5% | −R$ 710.984 |
| Loja de R$ 1 milhão | Base | R$ 1.235.000 | R$ 5.000 | R$ 21.002 | Não recupera em 60 meses | 96,4% | −R$ 354.014 |
| Loja de R$ 1 milhão | Otimista | R$ 1.197.950 | R$ 4.600 | R$ 24.523 | 52,5 meses | 116,3% | −R$ 164.341 |
| Loja de R$ 2 milhões | Conservador | R$ 1.782.000 | R$ 6.325 | R$ 35.119 | 54,5 meses | 112% | −R$ 307.745 |
| Loja de R$ 2 milhões | Base | R$ 1.650.000 | R$ 5.500 | R$ 46.305 | 39,1 meses | 159,9% | R$ 308.000 |
| Loja de R$ 2 milhões | Otimista | R$ 1.600.500 | R$ 5.060 | R$ 52.962 | 33,6 meses | 188,8% | R$ 645.240 |
| Loja de R$ 4 milhões | Conservador | R$ 2.413.800 | R$ 6.900 | R$ 133.687 | 19,8 meses | 327,7% | R$ 3.452.298 |
| Loja de R$ 4 milhões | Base | R$ 2.235.000 | R$ 6.000 | R$ 169.734 | 14,7 meses | 449,4% | R$ 5.248.194 |
| Loja de R$ 4 milhões | Otimista | R$ 2.167.950 | R$ 5.520 | R$ 191.302 | 12,8 meses | 522,3% | R$ 6.282.767 |

O exemplo e a loja de R$ 1 milhão não recuperam o investimento em 60 meses no cenário base. A de R$ 2 milhões fica em 39,1 meses. A de R$ 4 milhões fica em 14,7 meses por causa do 12x36 na noite. Nenhuma dessas três foi puxada para 30 meses.
