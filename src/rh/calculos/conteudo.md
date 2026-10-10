# Quadro de RH por turno — como a versão em validação calcula

Esta página vale só para `/gCalc/rh/`. A calculadora publicada em `/gCalc/`, o rascunho `/gCalc/headtohead/` e a página `/gCalc/calculos/` não usam este quadro.

O caixa continua o mesmo motor `evaluate`. O quadro não cria uma fórmula paralela de VPL. Ele preenche vagas evitadas, custo por pessoa, rescisão, turnover e contratação futura, e desliga o que contaria a mesma hora de novo.

## 1. Turnos

A loja escolhe 2 ou 3 turnos. Três turnos significam loja 24h. Não há horário de entrada nem de saída: o turno 1, o turno 2 e, quando existe, o turno da noite.

O adicional noturno sugerido é 10%. Ele multiplica só o turno da noite, e só quando a loja tem 3 turnos. Com 2 turnos o percentual fica guardado e não entra na conta.

## 2. Posto

Cada linha do quadro é um posto: cargo, balcão e escala. A escala é 6x1, 5x2 ou 12x36. Em cada turno a loja informa três quantidades:

- pessoas no posto, quem está trabalhando naquele turno;
- posições que o robô libera naquele turno, no máximo o que está no posto;
- contratação futura daquele turno, vaga que a loja abriria no mês 13 se não houvesse robô.

Não há um campo de vaga digitado à parte.

## 3. Folguista

O fator de cobertura transforma uma pessoa no turno em pessoas contratadas. Ele cobre a folga da escala, as férias e as faltas.

```
presença 6x1 = 6/7
presença 5x2 = 5/7
presença 12x36 = 12/48
dias produtivos = 365 × presença − férias − faltas
fator sugerido = 365 / dias produtivos
folguista = fator − 1
```

O padrão visível é 365 dias, 30 de férias e 6 faltas. Com esse padrão:

- 6x1 fica em 1,3184 (folguista de 0,3184 por pessoa no turno);
- 5x2 fica em 1,6243 (folguista de 0,6243);
- 12x36 fica em 6,6063 (folguista de 5,6063).

O 12x36 é alto porque a pessoa só está presente um quarto do tempo. Uma cadeira no turno da noite, todos os dias, pede várias contratações. O fator sugerido aparece em cada posto e pode ser sobrescrito. Vazio volta à sugestão. Se férias e faltas cobrem o ano, o fator vai a zero em vez de inverter o sinal.

## 4. Folha

A folha de um turno é a soma, em cada posto, de pessoas no turno × fator × custo mensal do cargo × adicional da noite. O custo do cargo já é completo, por pessoa e por mês. O adicional noturno entra por cima, só na noite.

A folha total é a soma dos turnos. O resumo da tela mostra pessoas no turno, folguistas, pessoas contratadas e a folha de cada turno.

## 5. O que o robô libera

Para cada posto e cada turno:

```
posição liberada = mínimo(pessoas no posto, posições que o robô libera)
vaga evitada = posição liberada × fator
folha evitada = vaga evitada × custo do cargo × adicional da noite
```

A rescisão é um mês dessa folha evitada, já com folguista e adicional. Ela só entra no caixa de loja existente. Em loja nova a vaga não chega a ser contratada.

A contratação futura usa a mesma conta, com a quantidade futura de cada turno, e começa no mês 13. Também só entra em loja existente.

O turnover continua 30% ao ano e R$ 8.000 por substituição, em cima das vagas evitadas mais as contratações futuras. As duas já incluem o folguista proporcional. Recrutamento e treinamento seguem marcados como inclusos nesse custo, então não entram de novo.

## 6. O que não entra de novo

Supervisão, movimentação, inventário e horas realocadas ficam desligados nesta versão. A hora dessas pessoas já está na folha do quadro. O motor também recebe a trava `alreadyCountedInPayroll` em supervisão e movimentação, para o caso de alguém religar o módulo no assistente: a vaga do quadro continua mandando na folha.

Perdas, área, prateleiras e o custo do robô seguem as premissas do modelo. Não foram inventados para encurtar o payback.

## 7. Pisos e modelos

O equipamento dos padrões não fica abaixo de R$ 1.000.000. O custo mensal informado fica entre R$ 5.000 e R$ 6.000. Loja maior pode ter segundo braço, carregador automático e módulo refrigerado. Tudo é fictício, a validar.

O exemplo e a loja de R$ 1 milhão têm 2 turnos e 1 balcão. O robô libera 1 auxiliar em cada turno. A de R$ 1 milhão ainda tem 1 auxiliar futuro no turno 1.

A de R$ 2 milhões tem 2 turnos e 2 balcões, com 1 auxiliar liberado por turno em cada balcão.

A de R$ 4 milhões tem 3 turnos e 3 balcões. De dia a escala é 6x1. À noite, farmacêutico e auxiliar usam 12x36, com adicional de 10%. O robô libera 1 auxiliar por turno em cada balcão, inclusive à noite. Esse fator 6,6063 é o que encurta o payback dessa loja. Se a operação real não cobre a noite assim, sobrescreva o fator ou a quantidade. O resultado abaixo é o que a conta dá, sem ajuste para caber em 30 meses.

A tabela no fim desta página sai dos mesmos modelos, nos cenários conservador, base e otimista.
