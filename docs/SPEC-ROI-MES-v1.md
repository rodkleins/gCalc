# Base técnica — Calculadora de ROI para implantação de MES/EBR (NEO)
Versão 0.1 · 28/10/2026 · Autor: Soc (Gerência Técnica T2) · Status: RASCUNHO para Will (texto/UX) e Dev (implementação)

Fonte dos ganhos de referência: white paper do painel "Maturidade Digital em Life Sciences", 1º Summit Organex, 07/10/2026
(`/workspace/organex_painel/whitepaper/whitepaper_conteudo-pt-br.md`). Números apresentados pelas empresas no palco, **não auditados**.

---

## 1. Objetivo
Permitir que o gestor de uma planta farmacêutica estime, com os **dados da própria planta**, o retorno de implantar um MES/registro de lote eletrônico (EBR), seguindo a lógica que os dois clientes descreveram no painel:
- **Biolab:** "custo de não fazer nada". O caso foi montado sobre premissas (se o sistema evitar X% do que hoje se perde, o projeto se paga) e a diferença real seria medida depois de dois anos.
- **Theraskin:** "a qualidade não entra em negociação". A conta inclui a redução do risco de desvios de documentação.

A calculadora organiza a conta; o resultado é **estimativa da planta**, não promessa da T2.

## 2. Regras que não se negociam
1. **Entrada é sempre do usuário.** Os ganhos de Biolab/Theraskin aparecem só como *referência relatada no painel*, nunca como valor padrão escondido nem como garantia.
2. **Uso de nomes e números de cliente** depende da autorização por escrito da Biolab e da Theraskin (ainda pendente, ver POST-30). Até lá, a versão pública mostra as referências **sem nome** ("planta de softgel de grande porte", "planta de dermocosméticos/farmacêutica com pesagem eletrônica").
3. **Sem custos da T2.** A calculadora não mostra preço do NEO nem de cliente. O investimento é um campo que o usuário preenche.
4. **Sem promessa regulatória.** Não escrever que o MES "garante conformidade", "evita warning letter" ou "aprova inspeção". Usar "reduz o risco de", "facilita a evidência de".
5. Termos: "aprovação do lote" (pt) / "aprobación del lote" (es) / "batch release" (en); "registro de lote eletrônico (EBR)" na 1ª menção; "controle de mudanças"; "entrada em operação" (nunca go-live); POP (pt) / POE (es).
6. Todo resultado traz o aviso: *"Estimativa baseada nos dados informados. Não substitui a avaliação do seu projeto nem a validação do sistema (CSV)."*

## 3. Blocos de ganho (o que a calculadora mede)
Cada bloco = um ganho que apareceu no painel, uma fórmula e as entradas da planta.

### B1. Tempo de revisão e aprovação do lote (revisão por exceção)
- Referência relatada: Softgel de 1h30 para ~15 min; Injetáveis de 3h para 15–20 min; lote sem desvio revisado em 5–10 min.
- Entradas: lotes/ano; horas de revisão por lote hoje (produção + Garantia da Qualidade); % de lotes sem desvio; custo-hora da GQ.
- Fórmula: `horas_economizadas = lotes × (h_hoje − h_futuro)`, com `h_futuro = %sem_desvio × t_exceção + (1 − %sem_desvio) × t_com_desvio`.
- Ganho secundário (opcional): dias a menos de estoque em quarentena → capital de giro (`valor_lote × lotes × dias_reduzidos / 365 × custo_capital`).

### B2. Eliminação de lançamento manual (pesagem e registros)
- Referência relatada: ~3.000 campos manuais por lote → 0 na pesagem.
- Entradas: campos manuais por lote; segundos por campo; lotes/ano; custo-hora do operador.
- Fórmula: `horas = campos × seg/3600 × lotes`.

### B3. Erros de preenchimento e desvios de documentação
- Referência relatada: erros de preenchimento zerados nos módulos em uso (fluxo de produção, pesagem, limpeza, Logbook). Receita/EBR ainda não implantada nesse cliente; não extrapolar para o EBR completo.
- Entradas: desvios/não conformidades de documentação por mês; horas de investigação e encerramento por desvio (incluindo CAPA quando houver); % de redução esperada (o usuário escolhe; sugerir cenários 50/75/90%).
- Fórmula: `custo_evitado = desvios/ano × %redução × h_por_desvio × custo-hora`.

### B4. Lotes perdidos, retrabalho e reprocesso ("custo de não fazer nada")
- Lógica Biolab: quanto a planta perde hoje e que fração o sistema precisa evitar para se pagar.
- Entradas: lotes rejeitados/retrabalhados por ano por causa evitável por controle no momento da execução (faixa fora, sequência, tempo de espera calculado à mão, material errado); valor médio do lote; % evitável estimado.
- Saída-chave: **% de perdas que o projeto precisa evitar para se pagar** (ponto de equilíbrio). Mostrar sempre, porque é o argumento mais honesto.

### B5. Limpeza e status de equipamento
- Referência relatada: validade de limpeza (ex.: 125 h) calculada pelo sistema; status no QR code do equipamento. O status de limpeza continua exigido; só saiu da etiqueta de papel.
- Entradas: limpezas/mês; minutos de controle manual por limpeza (etiqueta, conferência, Logbook em papel); ocorrências/ano de uso fora da validade ou limpeza refeita por dúvida.
- Fórmula: horas economizadas + custo de ocorrências evitadas.

### B6. Papel, impressão e arquivo
- Referência relatada: 365.574 páginas de instruções de fabricação/embalagem (IF/IE) eliminadas; 89% menos documentos devolvidos; indicadores ambientais (5,3 t CO₂ etc.) são estimativas do próprio cliente.
- Entradas: páginas por lote; lotes/ano; custo por página (impressão + emissão/numeração/reconciliação controlada de cópias).
- **Armazenamento (pedido do Rodrigo, 29/10):** arquivo físico (m² de sala própria ou contrato de guarda externa, custo por caixa ou m²) × anos de retenção (no mínimo 1 ano após a validade do lote; usar a política do cliente se for maior); proteção da sala (controle de acesso, umidade, incêndio); horas e custo de busca/retirada por solicitação (auditoria, reclamação, recall) × solicitações/ano; destruição controlada ao fim da retenção. Volume acumulado = lotes/ano × páginas/lote × anos de retenção.
- Contrapartida obrigatória: custo de manter os registros eletrônicos (armazenamento, backup e arquivo legível pelo mesmo prazo de retenção).
- Ambiental: opcional, com fatores e fonte explícitos; nunca misturar com o ROI financeiro.

### B7. Inspeção e auditoria
- Referência relatada: inspeções sem papel que "correram bem", segundo o relato (não dizer que a Anvisa aprovou).
- Entradas: dias/ano de preparação para inspeção e auditoria de cliente; pessoas envolvidas; horas para localizar registros.
- Tratar como **ganho qualitativo ou de horas**, nunca como risco regulatório convertido em multa evitada.

### B8. Crescer sem aumentar o quadro
- Referência relatada: crescimento de dois dígitos ao ano com quadro estável (~4.500). **Exige autorização do cliente antes de qualquer uso público** (item já sensível no POST-30).
- Entradas: crescimento de volume previsto; contratações que seriam necessárias em documentação/GQ.
- Tratar como cenário, não como ganho certo.

## 4. Custos e investimento (lado esquerdo da conta)
Campos preenchidos pelo usuário: licença/assinatura; serviços de implantação; validação (CSV/GAMP 5: URS, avaliação de risco, IQ/OQ/PQ, matriz de rastreabilidade); integração com ERP e equipamentos; infraestrutura e dispositivos (tablets, leitores, balanças integráveis); tempo do time interno (time dedicado ou key users); treinamento; revisão de receitas (definição de faixas com P&D, frequência de controles em processo).
- **Curva de aprendizado:** os primeiros lotes levam mais tempo; normaliza em cerca de três meses (relato do painel). Aplicar fator de ganho reduzido nos meses 1–3 (ex.: 0% → 50% → 100%, editável).
- **Estratégia de implantação** (seletor): planta a planta com time dedicado / pela base com key users e fases. Muda o cronograma de entrada dos blocos de ganho, não o ganho final.

## 5. Saídas
- Ganho anual por bloco e total (cenários conservador / provável / otimista).
- Payback (meses), ROI em 3 e 5 anos, VPL com taxa informada pelo usuário.
- Ponto de equilíbrio do B4 (% de perdas evitadas para pagar o projeto).
- Lista de premissas que o usuário marcou e **plano de medição**: o que medir antes da entrada em operação (linha de base) e depois de 12 e 24 meses, como fez a Biolab.
- Exportar PDF com logo T2/NEO apenas (sem logos de cliente).

## 6. Linha de base: o que pedir ao usuário antes de calcular
Mesmo checklist do white paper (seção 6), em forma de perguntas:
- Quanto custa hoje um lote perdido?
- Quantos desvios de preenchimento vocês abrem por mês?
- Que controle crítico ainda depende de cálculo manual (tempo de espera, validade de limpeza, rendimento)?
- Quantas instruções da receita não têm faixa definida?
- Quantas horas a GQ gasta revisando cada registro de lote?

## 7. Pontos em aberto
1. Autorização escrita de Biolab e Theraskin para citar nome e números (bloqueia a versão com nomes).
2. Formato: página no site (lead com diagnóstico de prontidão) ou planilha para o comercial? Afeta UX e captura de lead.
3. Valores sugeridos de custo-hora e custo por página: usar só faixas de mercado com fonte, ou deixar em branco.
4. Revisão GxP do Soc em cada versão do texto da calculadora antes de publicar.
