# Quadro de RH por turno — como a versão em validação calcula

Esta página vale só para `/gCalc/rh/`. A calculadora publicada em `/gCalc/`, o rascunho `/gCalc/headtohead/` e a página `/gCalc/calculos/` não usam este quadro.

O caixa continua o mesmo motor `evaluate`. O quadro não cria uma fórmula paralela de VPL. Ele preenche vagas evitadas, custo por pessoa, rescisão, turnover e contratação futura, e desliga o que contaria a mesma hora de novo.

## 1. Turnos

A loja escolhe 2 ou 3 turnos. Três turnos significam loja 24h. Não há horário de entrada nem de saída: o turno 1, o turno 2 e, quando existe, o turno da noite.

O adicional noturno sugerido é 10%. No JSON a unidade é fração: 0,10 significa 10%. A faixa aceita é de 0% a 50%. O valor 1 significa 100%, não 10%. Ele multiplica só o turno da noite, e só quando a loja tem 3 turnos. Com 2 turnos o percentual fica guardado e não entra na conta.

## 2. Posto

Cada linha do quadro é um posto: cargo, balcão e escala. A escala é 6x1, 5x2 ou 12x36. Em cada turno a loja informa três quantidades:

- pessoas no posto, quem está trabalhando naquele turno;
- posições que o robô libera naquele turno, no máximo o que está no posto;
- contratação futura daquele turno, vaga que a loja abriria no mês 13 se não houvesse robô.

Não há um campo de vaga digitado à parte.

## 3. Folguista

O fator de cobertura transforma uma pessoa no turno em pessoas contratadas. Ele cobre a folga da escala, as férias e as faltas.

```
6x1 trabalha 6 e folga 1 → 7/6 pessoas por cadeira
5x2 trabalha 5 e folga 2 → 7/5 pessoas por cadeira
12x36 trabalha um dia e folga o outro → 2 pessoas por cadeira
fator sugerido = pessoas da escala × 365 / (365 − férias − faltas)
folguista = fator − 1
```

O posto já é a cadeira daquele turno. Um turno de 8 horas não se converte em 12/8 nem em 12/48. O 12x36 cobre o turno um dia sim e um dia não, em jornada de 12 horas. Cobrir a cadeira o ano inteiro pede 2 pessoas antes de férias e faltas.

O padrão visível é 365 dias, 30 de férias e 6 faltas. Com 329 dias disponíveis:

- 6x1 fica em 1,2943 (folguista de 0,2943 por pessoa no turno);
- 5x2 fica em 1,5532 (folguista de 0,5532);
- 12x36 fica em 2,2188 (folguista de 1,2188).

Sem férias nem faltas, os fatores ficam em 7/6, 7/5 e 2. Na tela o quadro é uma tabela: cargo, balcão, escala e custo na mesma linha, pessoas em cada turno, folguista somente leitura e as colunas do que o robô evita. O total de cada cargo e o total de cada turno são calculados. Férias, faltas, adicional noturno, contratação futura e a substituição do fator ficam recolhidos. O fator é calculado e não se digita. Se férias e faltas cobrem o ano, o fator vai a zero em vez de inverter o sinal.

O custo da linha já inclui encargos e benefícios, no mesmo critério para todos os cargos. Não há um segundo fator, como 1,3333, aplicado só ao gerente. O perfil repete o custo do quadro.

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

O equipamento dos padrões não fica abaixo de R$ 1.000.000 e não leva um fator escondido de 1,05. A instalação, comissionamento e treinamento fica em R$ 50.000 em todos os modelos desta versão. O custo mensal informado fica entre R$ 5.000 e R$ 6.000. Loja maior pode ter segundo braço, carregador automático e módulo refrigerado. Tudo é fictício, a validar.

O exemplo e a loja de R$ 1 milhão têm 2 turnos e 1 balcão. O robô libera 1 auxiliar em cada turno. A de R$ 1 milhão ainda tem 1 auxiliar futuro no turno 1.

A de R$ 2 milhões tem 2 turnos e 2 balcões, com 1 auxiliar liberado por turno em cada balcão.

A de R$ 4 milhões tem 3 turnos e 3 balcões. De dia a escala é 6x1, e o gerente fica em 5x2. À noite, farmacêutico noturno e auxiliar noturno usam 12x36, com adicional de 10%. O nome da função separa esses custos dos cargos do dia. Estoquista e gerente da noite continuam em 6x1 e 5x2. O robô libera 1 auxiliar por turno em cada balcão, inclusive à noite. O fator 2,2188 entra só nas cadeiras 12x36. Se a operação real não cobre a noite assim, mude a escala, as férias, as faltas ou a quantidade. O resultado abaixo é o que a conta dá, sem ajuste para caber em 30 meses.

A importação avisa se o arquivo vier com todos os postos liberados zerados, adicional noturno fora de 0% a 50%, dois custos para o mesmo cargo no mesmo balcão, ou perfil diferente do quadro. O quadro importado prevalece.

A tabela no fim desta página sai dos mesmos modelos, nos cenários conservador, base e otimista.
