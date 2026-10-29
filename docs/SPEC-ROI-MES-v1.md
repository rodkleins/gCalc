# SPEC — Calculadora de ROI para MES/EBR (NEO)

Versão 1.0 · 29/10/2026 · Origem: Rodrigo Klein (T2) a partir da base técnica `BASE-ROI-MES.md` v0.1 (Soc)
Protótipo de referência (HTML único, já funcional): https://claude.ai/artifact/Wq3BzNt3MTypVF5eFojtgy

Este documento é a fonte da verdade para implementar a calculadora. Quando houver conflito entre o protótipo e esta spec, **vale a spec**.

---

## 1. Objetivo

Permitir que o gestor de uma planta farmacêutica (ou o comercial da JV junto com ele, em visita) estime o retorno de implantar MES e registro de lote eletrônico (EBR) **com os dados da própria planta**.

A lógica central é **bottom-up e mensurável**: o cliente cronometra quanto tempo o registro em papel consome hoje, campo a campo, e a calculadora compara com o mesmo registro no EBR. Os demais ganhos (desvios, perdas, limpeza, papel, ambiente, capital de giro) somam por fora.

O resultado é **estimativa da planta**, nunca promessa da T2.

---

## 2. Regras que não se negociam

1. **Entrada é sempre do usuário.** Referências de mercado aparecem só como texto de apoio ("referência relatada"), nunca como valor padrão escondido.
2. **Sem preço da T2/NEO.** Investimento e custos recorrentes são campos preenchidos pelo usuário. Presets de exemplo usam valores hipotéticos e precisam de aviso visível dizendo que não são preço do NEO.
3. **Nomes e números de clientes** (Biolab, Theraskin, Marjan) só aparecem em versões internas. A versão pública mostra referências anonimizadas e com números arredondados ou em faixa (número exato identifica cliente em mercado pequeno).
4. **Sem promessa regulatória.** Proibido: "garante conformidade", "evita warning letter", "aprova inspeção". Permitido: "reduz o risco de", "facilita a evidência de".
5. **Aviso obrigatório em todo resultado (tela e PDF):**
   > Estimativa baseada nos dados informados. Não substitui a avaliação do seu projeto nem a validação do sistema (CSV).
6. **Terminologia:**
   - "aprovação do lote" (pt) / "aprobación del lote" (es) / "batch release" (en)
   - "registro de lote eletrônico (EBR)" na primeira menção
   - "controle de mudanças"; "entrada em operação" (nunca "go-live"); POP (pt) / POE (es)
7. **"Zero erros de preenchimento" é defensável; "zero desvios" não é.** A calculadora nunca deve modelar redução de 100% em desvios de processo.

---

## 3. Conceitos

| Conceito | Definição |
|---|---|
| Ordem | Uma ordem de produção / registro de lote executado |
| Campo | Cada entrada manual do registro (valor, assinatura, checagem, cálculo) |
| Horas liberadas | Tempo de pessoas que deixa de ser gasto. **Não é caixa** automaticamente |
| Caixa direto | Ganho financeiro direto: perdas evitadas, papel, arquivo, capital de giro, ocorrências |
| Captura | % das horas liberadas que o cliente declara que vira caixa (redução de quadro, contratação evitada, horas extras) |
| Benefício considerado | `caixa_direto + valor_das_horas × captura` |
| Cenário | Fator aplicado sobre os ganhos (ver seção 6) |

---

## 4. Entradas

Todos os campos são numéricos, editáveis, aceitam vírgula ou ponto como separador decimal e recalculam em tempo real. Campo vazio = 0.

### 4.1 Dados da planta (`g`)

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `lotes` | Ordens de produção por ano | ordens | 600 |
| `cGQ` | Custo-hora carregado de quem revisa (produção e GQ) | R$/h | 120 |
| `cOp` | Custo-hora carregado do operador | R$/h | 60 |
| `captura` | Parcela das horas liberadas que vira caixa | % | 50 |
| `taxa` | Taxa de desconto anual para o VPL | % | 14 |

### 4.2 Registro de lote hoje, em papel (`hoje`)

Texto de ajuda: "Meça na sua planta: cronometre o preenchimento e a revisão de algumas ordens reais e divida pelo número de campos."

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `F` | Campos por ordem de produção (sem logbooks) | campos | 500 |
| `sf` | Tempo do operador para preencher um campo | seg | 15 |
| `sp` | Tempo da produção para revisar um campo | seg | 10 |
| `sq` | Tempo da GQ para revisar um campo | seg | 15 |
| `err` | Campos com erro que exigem correção | % | 1 |
| `mc` | Tempo por correção (corrigir, justificar, revisar de novo) | min | 5 |

**Teste de coerência (exibir como alerta suave, não bloquear):** se `F × sq / 60` (minutos de revisão da GQ por ordem) ficar fora de 60–240 min, mostrar: "A revisão da GQ está em X min por ordem. Referências do setor ficam entre 1h30 e 3h. Confira o tempo por campo."

### 4.3 Registro de lote com EBR (`ebr`)

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `auto` | Campos capturados automaticamente (balança, leitor, sistema) | % | 40 |
| `se` | Tempo para registrar um campo restante no sistema | seg | 8 |
| `exc` | Campos que geram exceção para revisão | % | 5 |
| `sxp` | Tempo da produção por exceção revisada | seg | 30 |
| `sxq` | Tempo da GQ por exceção revisada | seg | 60 |
| `fin` | Revisão final da GQ por ordem | min | 10 |
| `rerr_c` | Erros evitados pela validação na entrada (conservador) | % | 75 |
| `rerr_p` | Erros evitados pela validação na entrada (provável) | % | 90 |
| `rerr_o` | Erros evitados pela validação na entrada (otimista) | % | 100 |

> Mudança em relação ao protótipo: o protótipo tem um único `rerr` (90%) escalado pelo fator do cenário. Na v1, a redução de erros tem **valor próprio por cenário** e **não** é multiplicada pelo fator global (ver seção 6).

### 4.4 Capital de giro na quarentena (`b1`)

Texto: "Considere só os dias que dependem da revisão do registro, não do laboratório."

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `b1vl` | Valor médio de um lote | R$ | 200000 |
| `b1d` | Dias de quarentena a menos | dias | 3 |
| `b1cc` | Custo de capital anual | % | 14 |

### 4.5 Desvios de documentação (`b3`)

Escopo: erros que viram **desvio formal** (com investigação). Correções simples dentro do registro já estão em `hoje.err`; não contar duas vezes.

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `b3d` | Desvios de documentação por mês | desvios | 15 |
| `b3h` | Horas por desvio (investigação, relatório, CAPA) | h | 12 |

A redução usa `rerr_c / rerr_p / rerr_o` conforme o cenário.

### 4.6 Desvios de processo (`b3b`) — novo, opcional

Escopo: desvios que não são de preenchimento (sequência, faixa fora, material errado, tempo de espera). Redução modesta.

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `b3bd` | Desvios de processo por mês | desvios | 10 |
| `b3bh` | Horas por desvio | h | 16 |
| `b3br` | Redução esperada | % | 25 |

Validação: `b3br` máximo 50%. Acima disso, mostrar alerta: "Redução acima de 50% em desvios de processo não tem referência publicada."

### 4.7 Lotes perdidos e retrabalho evitáveis (`b4`)

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `b4n` | Lotes rejeitados ou retrabalhados por ano por causa evitável | lotes | 4 |
| `b4v` | Custo médio de cada perda | R$ | 200000 |
| `b4e` | Parcela que o sistema evitaria | % | 50 |

### 4.8 Limpeza e status de equipamento (`b5`)

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `b5l` | Limpezas por mês | limpezas | 200 |
| `b5m` | Controle manual por limpeza | min | 10 |
| `b5r` | Redução do controle manual | % | 80 |
| `b5o` | Ocorrências por ano (uso fora da validade, limpeza refeita por dúvida) | ocorr. | 6 |
| `b5c` | Custo médio por ocorrência | R$ | 15000 |

### 4.9 Logbooks (`lb`) — novo, opcional

Mesma lógica por campo do registro de lote, para logbooks de equipamento, sala e limpeza que não estão na instrução.

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `lbF` | Campos de logbook por ordem | campos | 0 |
| `lbsf` | Tempo para preencher um campo | seg | 15 |
| `lbsq` | Tempo para revisar um campo | seg | 10 |
| `lbauto` | Campos capturados ou eliminados no sistema | % | 60 |

Se `b5` e `lb` estiverem preenchidos, mostrar nota: "Não inclua no logbook os registros de limpeza já contados no bloco de limpeza."

### 4.10 Papel, impressão e arquivo (`b6`)

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `b6p` | Páginas por lote | pág. | 120 |
| `b6cp` | Custo por página (impressão e controle de cópias) | R$ | 0,60 |
| `b6a` | Custo anual de arquivo físico (sala ou guarda externa) | R$/ano | 24000 |
| `b6b` | Buscas de registros por ano (auditorias, reclamações) | buscas | 50 |
| `b6hb` | Horas por busca | h | 2 |
| `b6e` | Custo anual dos registros eletrônicos (armazenamento e backup) | R$/ano | 6000 |

### 4.11 Monitoramento ambiental (`b9`)

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `b9l` | Horas por mês em leituras manuais | h/mês | 60 |
| `b9x` | Excursões investigadas por mês | excursões | 4 |
| `b9hh` | Horas por investigação hoje | h | 8 |
| `b9hc` | Horas por investigação com correlação | h | 1 |

### 4.12 Capacidade no gargalo (`cap`) — novo, **desligado por padrão**

Liga com um toggle "Minha planta vende tudo que produz". Só considera o tempo em que o **equipamento-gargalo espera documentação em checklists** (liberação de linha, setup, conferências de início e fim). Preenchimento durante a execução **não entra**.

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `capm` | Minutos por ordem em que o gargalo espera checklist/documentação | min | 40 |
| `capr` | Redução com EBR | % | 60 |
| `caph` | Horas de gargalo por lote | h | 8 |
| `capmg` | Margem de contribuição por lote adicional (não receita) | R$ | 50000 |
| `capd` | Parcela da capacidade liberada que o mercado absorveria | % | 33 |

Aviso fixo no bloco: "Só vale para o equipamento que limita a produção da planta e se houver demanda para os lotes adicionais."

### 4.13 Investimento e custos (`c`)

| id | Label | Unidade | Exemplo |
|---|---|---|---|
| `c1` | Investimento inicial total (licença/implantação, validação CSV, integrações, dispositivos, tempo do time interno, treinamento, revisão de receitas) | R$ | 900000 |
| `c2` | Custos recorrentes por ano (assinatura, suporte, revalidações, administração) | R$/ano | 240000 |
| `c3` | Meses até a entrada em operação | meses | 6 |

---

## 5. Fórmulas

Notação: `L = lotes`, `pct(x) = x/100`. Tempos por ordem em **segundos**; anualização: `h_ano = seg_por_ordem × L / 3600`.

### 5.1 Registro de lote (por ordem, em segundos)

**Hoje:**
```
t.op = F × sf
t.pr = F × sp
t.gq = F × sq
t.co = F × pct(err) × mc × 60
```

**Com EBR** (cenário `s` define `rerr_s`):
```
e.op = F × (1 − pct(auto)) × se
e.pr = F × pct(exc) × sxp
e.gq = F × pct(exc) × sxq + fin × 60
e.co = t.co × (1 − pct(rerr_s))
```

**Anual (h/ano):** `T.k = t.k × L / 3600`, `E.k = e.k × L / 3600`, para `k ∈ {op, pr, gq, co}`.

**Economia (h/ano):** `save.k = max(0, T.k − E.k)`

**Valorização:**
```
reg_op.hv = save.op × cOp
reg_rv.hv = (save.pr + save.gq + save.co) × cGQ
```

### 5.2 Demais blocos (anual)

```
b1.cash  = b1vl × L × b1d / 365 × pct(b1cc)

b3.h     = b3d × 12 × b3h × pct(rerr_s)
b3.hv    = b3.h × cGQ

b3b.h    = b3bd × 12 × b3bh × pct(b3br)
b3b.hv   = b3b.h × cGQ

b4.cash  = b4n × b4v × pct(b4e)

b5.h     = b5l × 12 × b5m / 60 × pct(b5r)
b5.hv    = b5.h × cOp
b5.cash  = b5o × b5c × pct(b5r)

lb.h     = lbF × L × (lbsf + lbsq) / 3600 × pct(lbauto)
lb.hv    = lbF × L × (lbsf × cOp + lbsq × cGQ) / 3600 × pct(lbauto)

b6.h     = b6b × b6hb
b6.hv    = b6.h × cGQ
b6.cash  = b6p × L × b6cp + b6a − b6e        (b6e não é escalado pelo cenário)

b9.h     = b9l × 12 + b9x × 12 × max(0, b9hh − b9hc)
b9.hv    = b9.h × cGQ

cap.cash = (capm × pct(capr) × L / 60) / caph × capmg × pct(capd)   (só se toggle ligado)
```

### 5.3 Totais

```
H  = Σ horas liberadas (após cenário)
HV = Σ valor das horas (após cenário)
C  = Σ caixa direto (após cenário)
benefício_anual = C + HV × pct(captura)
```

Por bloco, o "ganho anual" exibido = `cash + hv × pct(captura)`.

---

## 6. Cenários

| Cenário | Fator global `S` | Redução de erros `rerr_s` |
|---|---|---|
| Conservador | 0,50 | `rerr_c` (75%) |
| Provável (padrão) | 0,75 | `rerr_p` (90%) |
| Otimista | 1,00 | `rerr_o` (100%) |

Regras:
- `S` multiplica **todas as economias** (horas, valor das horas e caixa), **exceto**: a redução de erros (que já é específica por cenário: aplica-se em `e.co` e em `b3`) e `b6e` (custo, não ganho).
- Em `reg`, `S` multiplica `save.k` após o cálculo de `T − E`.
- A tabela "hoje × EBR" exibida na tela mostra `T` e `E` **sem** `S` (é o modelo da planta), com nota: "Os cenários aplicam 50%, 75% ou 100% sobre essa economia."
- Os cenários são fixos e iguais para todos os clientes, para permitir comparação.

---

## 7. Linha do tempo (60 meses)

```
mês 0: fluxo = −c1
para m = 1..60:
  k = m − c3                                  // meses desde a entrada em operação
  fator = 0     se k ≤ 1
          0,5   se k = 2
          1     se k ≥ 3                      // curva de aprendizado 0% → 50% → 100% (editável no futuro)
  benefício_m = benefício_anual / 12 × fator
  custo_m     = c2 / 12                       // recorrente começa no mês 1
  fluxo_m     = benefício_m − custo_m
  acumulado  += fluxo_m
  payback     = primeiro m com acumulado ≥ 0
  VPL        += fluxo_m / (1 + i_m)^m,  com i_m = (1 + pct(taxa))^(1/12) − 1
```

- `ROI_3a = (Σ benefício_m[1..36] − (c1 + Σ custo_m[1..36])) / (c1 + Σ custo_m[1..36])`
- `ROI_5a` idem para 1..60.
- Se não houver payback em 60 meses: exibir "mais de 5 anos".
- Se `c1 = 0` e `c2 = 0`: exibir "—" para payback e ROI.

### 7.1 Ponto de equilíbrio do bloco de perdas

```
custo_anual_equivalente = c1 / 5 + c2
perdas_atuais           = b4n × b4v
breakeven               = custo_anual_equivalente / perdas_atuais
```

Texto: "Mesmo sem nenhum outro ganho, o projeto se paga em 5 anos se evitar **X%** das perdas de lote que vocês têm hoje (R$ Y por ano)."
Se `breakeven > 100%`: acrescentar "Isso é mais do que as perdas atuais: o projeto depende dos outros blocos."
Sem dados: "Preencha o bloco de lotes perdidos e o investimento para ver quanto das perdas atuais o projeto precisa evitar para se pagar."

---

## 8. Saídas (tela)

Painel de resultados fixo (sticky no desktop, abaixo dos blocos no mobile), atualizado em tempo real:

1. **Retorno do investimento** em meses (número grande).
2. KPIs: ROI 3 anos, ROI 5 anos, VPL 5 anos, benefício anual considerado.
3. Linhas: capacidade liberada (h/ano), valor dessas horas (R$), ganho direto em caixa (R$).
4. **Tabela "Registro de lote: hoje × EBR"** (h/ano): Preenchimento, Revisão da produção, Revisão da GQ, Correções, Total; colunas Hoje, EBR, Economia.
   Nota abaixo: minutos por ordem hoje e com EBR, minutos de revisão da GQ hoje e com EBR, equivalente em pessoas (economia total ÷ 1.800 h/ano).
5. Barras horizontais: ganho anual por bloco.
6. Tabela de cenários: retorno e ROI 5 anos para os três cenários.
7. Ponto de equilíbrio do bloco de perdas.
8. Aviso obrigatório (regra 2.5).

Cada bloco de entrada é um acordeão com o título e o ganho anual do bloco no cabeçalho.

---

## 9. Presets

Botões no topo: **Carregar exemplo**, **Limpar todos os campos** (mantém `captura = 50` e `taxa = 14`), e presets internos.

### 9.1 Exemplo (planta fictícia de médio porte)

Valores da coluna "Exemplo" da seção 4. Aviso: "Os campos estão preenchidos com uma planta fictícia de médio porte, apenas para demonstração. Os valores de investimento são hipotéticos e não representam o preço do NEO."

### 9.2 Biolab (estimado) — **somente versão interna**

Só `F = 500` foi informado pela Biolab (instrução com ~500 campos, sem logbooks). Todo o resto é premissa a validar.

```json
{
  "lotes": 2500, "cGQ": 130, "cOp": 65, "captura": 50, "taxa": 14,
  "F": 500, "sf": 15, "sp": 10, "sq": 15, "err": 2, "mc": 5,
  "auto": 30, "se": 8, "exc": 3, "sxp": 30, "sxq": 60, "fin": 10,
  "rerr_c": 75, "rerr_p": 90, "rerr_o": 100,
  "b1vl": 250000, "b1d": 3, "b1cc": 14,
  "b3d": 20, "b3h": 10,
  "b3bd": 0, "b3bh": 0, "b3br": 25,
  "b4n": 6, "b4v": 250000, "b4e": 40,
  "b5l": 600, "b5m": 10, "b5r": 80, "b5o": 10, "b5c": 15000,
  "lbF": 0, "lbsf": 15, "lbsq": 10, "lbauto": 60,
  "b6p": 150, "b6cp": 0.6, "b6a": 120000, "b6b": 150, "b6hb": 2, "b6e": 20000,
  "b9l": 0, "b9x": 0, "b9hh": 0, "b9hc": 0,
  "capm": 0, "capr": 60, "caph": 8, "capmg": 0, "capd": 33,
  "c1": 2000000, "c2": 400000, "c3": 6
}
```

Aviso do preset: "Simulação interna da Biolab com dados estimados. Só o número de campos por instrução (500) foi informado; todo o resto é premissa a validar com a Biolab. O investimento é hipotético e não é o valor do contrato. Não divulgar sem autorização do cliente."

Dados a confirmar com a Biolab, em ordem de impacto: ordens por ano; desvios de documentação por mês; tempo cronometrado de revisão de 2 ou 3 ordens; valor médio de lote; dias de quarentena atribuíveis à revisão do registro.

Mecanismo de build: presets internos ficam atrás de uma flag (`INTERNAL_BUILD=true`) e **não** podem ir para a versão pública.

---

## 10. Persistência

- **v1:** salvar a simulação atual no navegador (localStorage, chave `neo-roi:v1:current`), com try/catch; se o armazenamento falhar ou estiver vazio, carregar o exemplo.
- **v1.1:** simulações nomeadas por cliente (salvar, renomear, duplicar, excluir, comparar duas lado a lado).

---

## 11. Casos de teste

Todos com tolerância de ±0,5 na última casa exibida.

### T1 — Registro de lote, exemplo de 500 campos
Entradas: `L=600, F=500, sf=15, sp=10, sq=30, err=3, mc=5, auto=40, se=8, exc=5, sxp=30, sxq=60, fin=10, rerr_s=90`
Esperado (h/ano, sem cenário):

| k | T (hoje) | E (EBR) |
|---|---|---|
| op | 1.250,0 | 400,0 |
| pr | 833,3 | 125,0 |
| gq | 2.500,0 | 350,0 |
| co | 750,0 | 75,0 |
| total | 5.333,3 | 950,0 |

Por ordem: hoje 533,3 min; EBR 95 min; revisão da GQ 250 → 35 min.

### T2 — Registro de lote, preset Biolab (cenário provável)
Entradas do preset 9.2 (`rerr_p = 90`). Esperado (h/ano, sem cenário):

| k | T | E |
|---|---|---|
| op | 5.208,3 | 1.944,4 |
| pr | 3.472,2 | 312,5 |
| gq | 5.208,3 | 1.041,7 |
| co | 2.083,3 | 208,3 |

### T3 — Linha do tempo
Entradas: `benefício_anual = 1.200.000`, `c1 = 1.000.000`, `c2 = 0`, `c3 = 0`.
Fluxo: m1 = 0; m2 = 50.000; m3+ = 100.000. Acumulado: m11 = −50.000; m12 = +50.000.
Esperado: **payback = 12 meses**.

### T4 — Ponto de equilíbrio
Entradas: `c1 = 2.000.000`, `c2 = 400.000`, `b4n = 6`, `b4v = 250.000`.
Esperado: `(400.000 + 400.000) / 1.500.000 = 53,3%`.

### T5 — Campos vazios
"Limpar todos os campos" → nenhum NaN na tela; payback e ROI exibem "—"; ponto de equilíbrio exibe o texto de dados faltantes.

### T6 — Coerência da revisão
`F=500, sq=30` → alerta "250 min por ordem" visível. `F=500, sq=15` → sem alerta.

### T7 — Capacidade desligada
Com o toggle desligado, `cap.cash = 0` mesmo com campos preenchidos.

---

## 12. Referências (texto de apoio, nunca valor padrão)

Exibir como "referência relatada", com fonte, em letra menor no bloco correspondente.

| Tema | Referência | Uso |
|---|---|---|
| Revisão do lote | Painel "Maturidade Digital em Life Sciences", 1º Summit Organex (07/10/2026): revisão caindo de 1h30–3h para 15–20 min por lote; lote sem desvio revisado em 5–10 min. Números relatados, não auditados | Bloco `ebr` e teste de coerência |
| Campos manuais | Mesmo painel: cerca de 3.000 campos manuais por lote eliminados na pesagem | Bloco `ebr` |
| Erros de preenchimento | Mesmo painel: erros zerados nos módulos em uso (fluxo de produção, pesagem, limpeza, logbook); EBR completo ainda não implantado nesse cliente | Cenário otimista |
| Erros de preenchimento | Caso Körber/Ferring (Kiel, Alemanha): eliminação dos erros típicos de documentação, até 25% menos desvios de lote, revisão 60% mais rápida, 25–40% menos tempo de documentação. Material do fornecedor | Cenário otimista; `b3b` (25%) |
| Erros humanos | Estudo citado pelo Pharmaceutical Online (2021): queda de 75% em erros humanos no registro eletrônico vs. papel | Cenário conservador |
| Taxa de erro no papel | Pharmaceutical Technology: cerca de 1 erro a cada 100 entradas manuais | Valor sugerido de `err` (1%) |
| Volume de desvios | Pharmaceutical Online (2017): plantas geram em média pouco mais de 1.000 desvios por ano, variando com porte e complexidade | Texto de ajuda do bloco `b3` |
| Custo de desvio | CAI / Bioprocess Online: custo médio de US$ 25–55 mil por desvio, podendo passar de US$ 1 mi com perda de produto | Texto de ajuda (não converter para R$ automaticamente) |

Faixas práticas de horas por desvio (estimativa T2, exibir como "faixa típica, a confirmar"): menor 4–8 h (~70%), maior 16–40 h (~25%), crítico 40–100+ h (~5%); média ponderada ~12–20 h.

---

## 13. Requisitos de interface

- Página única, responsiva, idioma pt-BR (preparar chaves para es e en).
- Números com formatação pt-BR (R$, milhar com ponto, decimal com vírgula); valores grandes abreviados no painel ("R$ 1,3 mi", "R$ 540 mil").
- Tema claro e escuro.
- Acessibilidade: labels associados aos campos, foco visível, `aria-live="polite"` no painel de resultados.
- Nenhum logo de cliente. Logo T2/NEO apenas.

---

## 14. Fora do escopo da v1 (backlog)

1. **Integração com o diagnóstico de maturidade** (12 dimensões): a linha de base da visita alimenta os campos automaticamente; o roteiro de fases (Sensor → Pesagem → EBR → Integrações) é gerado a partir dos blocos com maior ganho.
2. **Exportar PDF** com premissas marcadas pelo usuário, resultados, cenários e **plano de medição** (linha de base antes da entrada em operação; medições em 12 e 24 meses).
3. **Curva de aprendizado editável** (hoje fixa em 0% / 50% / 100%).
4. **Seletor de estratégia de implantação** (planta a planta com time dedicado / por base com key users e fases), que muda o cronograma de entrada dos blocos.
5. **Bloco "crescer sem aumentar o quadro"** (B8 da base técnica): tratar como cenário, exige autorização do cliente para qualquer referência pública.
6. **Indicadores ambientais** (papel, CO₂): opcional, com fatores e fonte explícitos, nunca somado ao ROI financeiro.
7. Versão pública no site como captura de lead (formulário simplificado).

---

## 15. Pontos em aberto

1. Autorização escrita de Biolab e Theraskin para citar nome e números (bloqueia qualquer versão pública com nomes).
2. Formato final: ferramenta do comercial (prioridade) e, depois, página no site.
3. Valores sugeridos de custo-hora e custo por página: manter em branco na versão pública, com faixas de mercado e fonte ao lado.
4. Revisão GxP do Soc em cada versão do texto antes de publicar.
5. Calibrar `sq` (tempo de revisão da GQ por campo) com cronometragem real na Biolab.
