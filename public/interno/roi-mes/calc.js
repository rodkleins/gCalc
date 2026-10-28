/**
 * ROI de MES/EBR (NEO). OP e lote são a mesma coisa.
 * Os números vêm do usuário. Referências de painel não entram na conta.
 *
 * Preenchimento: horas = OPs × campos × segundos / 3600 (Produção)
 * Pesagem: horas = OPs × pesagens × minutos / 60 × (2 se houver dupla checagem)
 * Revisão: h_futuro = %sem_desvio × t_sem + (1 − %) × t_com
 *    economia da área = OPs × (h_hoje_área − h_futuro × participação da área)
 *    capital de giro = valor_lote × OPs × dias/365 × custo_capital
 * Erros: horas = OPs × %com_erro × h_correção × %redução (Qualidade)
 * Desvios: horas = desvios/ano × h_CAPA × %redução (Qualidade)
 * Perdas: caixa = quantidade × valor × %evitável
 *    break-even = (investimento inicial + 1 ano de assinatura) ÷ (quantidade × valor)
 * Limpeza/Logbook: horas = registros/mês × 12 × minutos/60; caixa = ocorrências × custo
 * Papel: caixa = páginas × OPs × custo/página + arquivo
 *    CO₂ fica fora do ROI. Inspeção e quadro não entram no payback.
 */

export const SCENARIOS = ['conservador', 'provavel', 'otimista'];

export const SCENARIO_LABELS = {
  conservador: 'Conservador',
  provavel: 'Provável',
  otimista: 'Otimista',
};

export const DISCLAIMER =
  'Estimativa baseada nos dados informados. Não substitui a avaliação do seu projeto nem a validação do sistema (CSV).';

/** Exemplo fictício da primeira visita. O investimento inicial soma R$ 550.000 e a assinatura é R$ 180.000/ano. */
export const EXAMPLE_FIELDS = {
  opsAno: '1.000',
  b2Campos: '180',
  b2Segundos: '25',
  b2Pesagens: '6',
  b2Minutos: '8',
  b3HorasProd: '1,5',
  b3HorasQual: '1,5',
  b3PctSem: '80',
  b3TempoSem: '0,25',
  b3TempoCom: '1',
  b3Dias: '4',
  b3ValorOp: '80.000',
  b3CustoCapital: '15',
  b4PctErro: '12',
  b4HorasErro: '0,5',
  b4DesviosAno: '96',
  b4HorasDesvio: '6',
  b4PctConservador: '50',
  b4PctProvavel: '75',
  b4PctOtimista: '90',
  b5Qtd: '3',
  b5Valor: '250.000',
  b5Pct: '40',
  b6Registros: '40',
  b6Minutos: '25',
  b6Ocorrencias: '6',
  b6Custo: '8.000',
  b7Paginas: '80',
  b7CustoPagina: '0,20',
  b7Arquivo: '12.000',
  b7Co2: '0,004',
  b8Nota: 'Inspeção por amostragem no registro de lote eletrônico (EBR), em vez de revisar todo o papel.',
  b9Nota: 'Absorver um turno extra na revisão sem nova contratação.',
  custoHoraProd: '95',
  custoHoraQual: '150',
  horasFte: '1.760',
  licenca: '180.000',
  implantacao: '220.000',
  validacao: '120.000',
  integracao: '80.000',
  infraestrutura: '40.000',
  tempoInterno: '45.000',
  treinamento: '25.000',
  receitas: '20.000',
  curva1: '0',
  curva2: '50',
  curva3: '100',
  taxa: '12',
};

export const EXAMPLE_FLAGS = { b2Dupla: true, incluirHoras: true, modo: 'dedicado' };

export function exampleInput() {
  const field = EXAMPLE_FIELDS;
  return {
    modo: EXAMPLE_FLAGS.modo,
    incluirHoras: EXAMPLE_FLAGS.incluirHoras,
    opsAno: parseBr(field.opsAno),
    b2Campos: parseBr(field.b2Campos),
    b2Segundos: parseBr(field.b2Segundos),
    b2Pesagens: parseBr(field.b2Pesagens),
    b2Minutos: parseBr(field.b2Minutos),
    b2Dupla: EXAMPLE_FLAGS.b2Dupla,
    b3HorasProd: parseBr(field.b3HorasProd),
    b3HorasQual: parseBr(field.b3HorasQual),
    b3PctSem: percentPoints(field.b3PctSem),
    b3TempoSem: parseBr(field.b3TempoSem),
    b3TempoCom: parseBr(field.b3TempoCom),
    b3Dias: parseBr(field.b3Dias),
    b3ValorOp: parseBr(field.b3ValorOp),
    b3CustoCapital: percentPoints(field.b3CustoCapital),
    b4PctErro: percentPoints(field.b4PctErro),
    b4HorasErro: parseBr(field.b4HorasErro),
    b4DesviosAno: parseBr(field.b4DesviosAno),
    b4HorasDesvio: parseBr(field.b4HorasDesvio),
    b4Pct: {
      conservador: percentPoints(field.b4PctConservador),
      provavel: percentPoints(field.b4PctProvavel),
      otimista: percentPoints(field.b4PctOtimista),
    },
    b5Qtd: parseBr(field.b5Qtd),
    b5Valor: parseBr(field.b5Valor),
    b5Pct: percentPoints(field.b5Pct),
    b6Registros: parseBr(field.b6Registros),
    b6Minutos: parseBr(field.b6Minutos),
    b6Ocorrencias: parseBr(field.b6Ocorrencias),
    b6Custo: parseBr(field.b6Custo),
    b7Paginas: parseBr(field.b7Paginas),
    b7CustoPagina: parseBr(field.b7CustoPagina),
    b7Arquivo: parseBr(field.b7Arquivo),
    b7Co2: parseBr(field.b7Co2),
    b8Nota: field.b8Nota,
    b9Nota: field.b9Nota,
    custoHoraProd: parseBr(field.custoHoraProd),
    custoHoraQual: parseBr(field.custoHoraQual),
    horasFte: parseBr(field.horasFte),
    licenca: parseBr(field.licenca),
    implantacao: parseBr(field.implantacao),
    validacao: parseBr(field.validacao),
    integracao: parseBr(field.integracao),
    infraestrutura: parseBr(field.infraestrutura),
    tempoInterno: parseBr(field.tempoInterno),
    treinamento: parseBr(field.treinamento),
    receitas: parseBr(field.receitas),
    curva: [percentPoints(field.curva1), percentPoints(field.curva2), percentPoints(field.curva3)],
    taxa: percentPoints(field.taxa),
  };
}

export function parseBr(text) {
  if (text == null) return null;
  let raw = String(text).trim().replace(/\s/g, '').replace('%', '').replace('R$', '');
  if (!raw || raw === '-' || raw === ',' || raw === '.') return null;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    raw = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (comma >= 0) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (dot >= 0) {
    const parts = raw.split('.');
    if (parts.length > 1 && parts.slice(1).every((part) => part.length === 3)) raw = parts.join('');
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function percentPoints(text) {
  const value = parseBr(text);
  if (value == null) return null;
  return clamp(value / 100, 0, 1);
}

function n(value) {
  if (value == null || value === '') return 0;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function reviewHours(lotes, horasProd, horasQual, pctSemDesvio, tempoSem, tempoCom) {
  const hHoje = n(horasProd) + n(horasQual);
  const pct = clamp(n(pctSemDesvio), 0, 1);
  const hFuturo = pct * n(tempoSem) + (1 - pct) * n(tempoCom);
  const porLote = Math.max(0, hHoje - hFuturo);
  const horas = n(lotes) * porLote;
  const shareProd = hHoje > 0 ? n(horasProd) / hHoje : 0;
  return {
    hHoje,
    hFuturo,
    horas,
    horasProducao: horas * shareProd,
    horasQualidade: horas * (1 - shareProd),
  };
}

export function workingCapital(valorLote, lotes, dias, custoCapital) {
  return n(valorLote) * n(lotes) * (n(dias) / 365) * clamp(n(custoCapital), 0, 1);
}

export function manualHours(campos, segundos, lotes) {
  return (n(campos) * n(segundos) / 3600) * n(lotes);
}

export function weighingHours(ops, pesagens, minutos, dupla) {
  return n(ops) * n(pesagens) * n(minutos) / 60 * (dupla ? 2 : 1);
}

export function fillErrorHours(ops, pctErro, horasPorErro, pctReducao) {
  const erros = n(ops) * clamp(n(pctErro), 0, 1);
  const horas = erros * n(horasPorErro) * clamp(n(pctReducao), 0, 1);
  return { erros, horas };
}

export function deviationHours(desviosAno, horasPorDesvio, pctReducao) {
  const horas = n(desviosAno) * n(horasPorDesvio) * clamp(n(pctReducao), 0, 1);
  return { desviosAno: n(desviosAno), horas };
}

export function avoidedLoss(lotesRejeitados, valorMedio, pctEvitavel) {
  return n(lotesRejeitados) * n(valorMedio) * clamp(n(pctEvitavel), 0, 1);
}

export function breakEvenPct(investimento, lotesRejeitados, valorMedio) {
  const base = n(lotesRejeitados) * n(valorMedio);
  if (base <= 0) return null;
  return n(investimento) / base;
}

export function cleaningHours(limpezasMes, minutos) {
  return n(limpezasMes) * 12 * n(minutos) / 60;
}

export function paperCash(paginas, custoPagina, lotes, arquivoAnual) {
  return n(paginas) * n(lotes) * n(custoPagina) + n(arquivoAnual);
}

export function paperEnvironment(paginas, lotes, co2PorPagina) {
  return n(paginas) * n(lotes) * n(co2PorPagina);
}

export function rampMonths(modo, curva) {
  const [a, b, c] = curva.map((item) => clamp(n(item), 0, 1));
  if (modo === 'base') return [a, a, b, b, c, c, 1, 1, 1, 1, 1, 1];
  return [a, b, c, 1, 1, 1, 1, 1, 1, 1, 1, 1];
}

export function yearGain(year, annual, months) {
  if (year <= 1) return annual * months.reduce((sum, item) => sum + item, 0) / 12;
  return annual;
}

export function paybackMonths(capex, licenseAnnual, annualGain, months) {
  if (n(capex) <= 0) return annualGain > 0 || licenseAnnual <= 0 ? 0 : null;
  let cum = -n(capex);
  for (let month = 1; month <= 120; month += 1) {
    const factor = month <= 12 ? months[month - 1] : 1;
    cum += (annualGain * factor - n(licenseAnnual)) / 12;
    if (cum >= -0.005) return month;
  }
  return null;
}

export function roiRatio(years, annual, months, capex, license) {
  let gains = 0;
  for (let year = 1; year <= years; year += 1) gains += yearGain(year, annual, months);
  const costs = n(capex) + n(license) * years;
  if (costs <= 0) return null;
  return (gains - costs) / costs;
}

export function npv(years, rate, annual, months, capex, license) {
  if (rate == null || !Number.isFinite(rate)) return null;
  let value = -n(capex);
  for (let year = 1; year <= years; year += 1) {
    const net = yearGain(year, annual, months) - n(license);
    value += net / (1 + rate) ** year;
  }
  return value;
}

function scenarioRate(input, name) {
  const raw = input.b4Pct?.[name];
  if (raw == null || raw === '') return { value: 0, assumed: false };
  return { value: clamp(n(raw), 0, 1), assumed: false };
}

function curveOf(input) {
  const raw = Array.isArray(input.curva) ? input.curva : [null, null, null];
  const spec = [0, 0.5, 1];
  const assumed = raw.some((item) => item == null || item === '');
  const values = [0, 1, 2].map((index) => (raw[index] == null || raw[index] === '' ? spec[index] : clamp(n(raw[index]), 0, 1)));
  return { values, assumed };
}

function fteOf(input) {
  const raw = input.horasFte;
  if (raw == null || raw === '' || n(raw) <= 0) return { horas: 1760, assumed: true };
  return { horas: n(raw), assumed: false };
}

function capexOf(input) {
  const parts = {
    implantacao: n(input.implantacao),
    validacao: n(input.validacao),
    integracao: n(input.integracao),
    infraestrutura: n(input.infraestrutura),
    tempoInterno: n(input.tempoInterno),
    treinamento: n(input.treinamento),
    receitas: n(input.receitas),
  };
  const total = Object.values(parts).reduce((sum, item) => sum + item, 0);
  return { ...parts, total: roundMoney(total), licenca: n(input.licenca) };
}

function blockResult({ label, horasProd = 0, horasQual = 0, custoProd, custoQual, caixa = 0, incluirHoras, formula }) {
  const reaisHoras = roundMoney(horasProd * custoProd + horasQual * custoQual);
  const caixaR = roundMoney(caixa);
  return {
    label,
    horas: horasProd + horasQual,
    horasProducao: horasProd,
    horasQualidade: horasQual,
    reaisHoras,
    caixa: caixaR,
    total: roundMoney(caixaR + (incluirHoras ? reaisHoras : 0)),
    formula,
  };
}

export function evaluate(input = {}) {
  const ops = n(input.opsAno);
  const custoProd = n(input.custoHoraProd);
  const custoQual = n(input.custoHoraQual);
  const fte = fteOf(input);
  const incluirHoras = input.incluirHoras !== false;
  const curve = curveOf(input);
  const modo = input.modo === 'base' ? 'base' : 'dedicado';
  const months = rampMonths(modo, curve.values);
  const money = capexOf(input);
  const taxa = input.taxa == null || input.taxa === '' ? null : clamp(n(input.taxa), 0, 1);
  const dupla = input.b2Dupla === true;

  const preenchHoras = manualHours(input.b2Campos, input.b2Segundos, ops);
  const pesagemHoras = weighingHours(ops, input.b2Pesagens, input.b2Minutos, dupla);
  const revisao = reviewHours(ops, input.b3HorasProd, input.b3HorasQual, input.b3PctSem, input.b3TempoSem, input.b3TempoCom);
  const capitalGiro = workingCapital(input.b3ValorOp, ops, input.b3Dias, input.b3CustoCapital);
  const perdas = avoidedLoss(input.b5Qtd, input.b5Valor, input.b5Pct);
  const limpezaHoras = cleaningHours(input.b6Registros, input.b6Minutos);
  const limpezaCaixa = n(input.b6Ocorrencias) * n(input.b6Custo);
  const papel = paperCash(input.b7Paginas, input.b7CustoPagina, ops, input.b7Arquivo);
  const ambiente = paperEnvironment(input.b7Paginas, ops, input.b7Co2);

  const caixaFixo = capitalGiro + perdas + limpezaCaixa + papel;
  const horasProdFixas = preenchHoras + pesagemHoras + revisao.horasProducao + limpezaHoras;
  const horasQualFixas = revisao.horasQualidade;
  const breakEven = breakEvenPct(money.total + money.licenca, input.b5Qtd, input.b5Valor);

  const scenarios = {};
  for (const name of SCENARIOS) {
    const rate = scenarioRate(input, name);
    const erros = fillErrorHours(ops, input.b4PctErro, input.b4HorasErro, rate.value);
    const desvios = deviationHours(input.b4DesviosAno, input.b4HorasDesvio, rate.value);
    const horasProd = horasProdFixas;
    const horasQual = horasQualFixas + erros.horas + desvios.horas;
    const reaisProd = roundMoney(horasProd * custoProd);
    const reaisQual = roundMoney(horasQual * custoQual);
    const reaisHoras = roundMoney(reaisProd + reaisQual);
    const caixa = roundMoney(caixaFixo);
    const base = roundMoney(caixa + (incluirHoras ? reaisHoras : 0));
    const blocks = {
      preenchimento: blockResult({
        label: 'Preenchimento da OP',
        horasProd: preenchHoras,
        custoProd,
        custoQual,
        incluirHoras,
        formula: [
          `horas/ano = ${formatNumber(ops, 0)} OPs × ${formatNumber(n(input.b2Campos), 2)} campos × ${formatNumber(n(input.b2Segundos), 2)} s ÷ 3.600 = ${formatNumber(preenchHoras, 2)} h`,
          `R$ = ${formatNumber(preenchHoras, 2)} h × ${formatBRL(custoProd)} = ${formatBRL(preenchHoras * custoProd)}`,
        ],
      }),
      pesagem: blockResult({
        label: 'Pesagem na OP',
        horasProd: pesagemHoras,
        custoProd,
        custoQual,
        incluirHoras,
        formula: [
          `horas/ano = ${formatNumber(ops, 0)} OPs × ${formatNumber(n(input.b2Pesagens), 2)} pesagens × ${formatNumber(n(input.b2Minutos), 2)} min ÷ 60 × ${dupla ? 2 : 1} = ${formatNumber(pesagemHoras, 2)} h`,
          dupla ? 'A dupla checagem do segundo operador dobra as horas.' : 'Dupla checagem desligada: o fator do segundo operador é 1.',
          `R$ = ${formatNumber(pesagemHoras, 2)} h × ${formatBRL(custoProd)} = ${formatBRL(pesagemHoras * custoProd)}`,
        ],
      }),
      revisao: blockResult({
        label: 'Revisão da OP',
        horasProd: revisao.horasProducao,
        horasQual: revisao.horasQualidade,
        custoProd,
        custoQual,
        caixa: capitalGiro,
        incluirHoras,
        formula: [
          `h futuras = ${formatPct(n(input.b3PctSem))} × ${formatNumber(n(input.b3TempoSem), 2)} h + ${formatPct(1 - n(input.b3PctSem))} × ${formatNumber(n(input.b3TempoCom), 2)} h = ${formatNumber(revisao.hFuturo, 2)} h`,
          `supervisor = ${formatNumber(ops, 0)} × (${formatNumber(n(input.b3HorasProd), 2)} − ${formatNumber(revisao.hFuturo, 2)} × participação) = ${formatNumber(revisao.horasProducao, 2)} h × ${formatBRL(custoProd)}`,
          `Garantia da Qualidade = ${formatNumber(revisao.horasQualidade, 2)} h × ${formatBRL(custoQual)}`,
          `capital de giro = ${formatBRL(n(input.b3ValorOp))} × ${formatNumber(ops, 0)} × ${formatNumber(n(input.b3Dias), 2)} ÷ 365 × ${formatPct(n(input.b3CustoCapital))} = ${formatBRL(capitalGiro)}`,
        ],
      }),
      erros: blockResult({
        label: 'Erros de preenchimento',
        horasQual: erros.horas,
        custoProd,
        custoQual,
        incluirHoras,
        formula: [
          `erros/ano = ${formatNumber(ops, 0)} × ${formatPct(n(input.b4PctErro))} = ${formatNumber(erros.erros, 2)}`,
          `horas = ${formatNumber(erros.erros, 2)} × ${formatNumber(n(input.b4HorasErro), 2)} h × ${formatPct(rate.value)} = ${formatNumber(erros.horas, 2)} h`,
          `R$ = ${formatNumber(erros.horas, 2)} h × ${formatBRL(custoQual)} = ${formatBRL(erros.horas * custoQual)}`,
        ],
      }),
      desvios: blockResult({
        label: 'Desvios de documentação',
        horasQual: desvios.horas,
        custoProd,
        custoQual,
        incluirHoras,
        formula: [
          `horas = ${formatNumber(desvios.desviosAno, 2)} desvios/ano × ${formatNumber(n(input.b4HorasDesvio), 2)} h × ${formatPct(rate.value)} = ${formatNumber(desvios.horas, 2)} h`,
          `R$ = ${formatNumber(desvios.horas, 2)} h × ${formatBRL(custoQual)} = ${formatBRL(desvios.horas * custoQual)}`,
        ],
      }),
      perdas: blockResult({
        label: 'Lotes perdidos ou retrabalhados',
        custoProd,
        custoQual,
        caixa: perdas,
        incluirHoras,
        formula: [
          `caixa = ${formatNumber(n(input.b5Qtd), 2)} × ${formatBRL(n(input.b5Valor))} × ${formatPct(n(input.b5Pct))} = ${formatBRL(perdas)}`,
        ],
      }),
      limpeza: blockResult({
        label: 'Limpeza e Logbook',
        horasProd: limpezaHoras,
        custoProd,
        custoQual,
        caixa: limpezaCaixa,
        incluirHoras,
        formula: [
          `horas = ${formatNumber(n(input.b6Registros), 2)} registros/mês × 12 × ${formatNumber(n(input.b6Minutos), 2)} min ÷ 60 = ${formatNumber(limpezaHoras, 2)} h`,
          `R$ das horas = ${formatNumber(limpezaHoras, 2)} h × ${formatBRL(custoProd)} = ${formatBRL(limpezaHoras * custoProd)}`,
          `caixa = ${formatNumber(n(input.b6Ocorrencias), 2)} × ${formatBRL(n(input.b6Custo))} = ${formatBRL(limpezaCaixa)}`,
        ],
      }),
      papel: blockResult({
        label: 'Papel, impressão e arquivo',
        custoProd,
        custoQual,
        caixa: papel,
        incluirHoras,
        formula: [
          `caixa = ${formatNumber(n(input.b7Paginas), 2)} páginas × ${formatNumber(ops, 0)} OPs × ${formatBRL(n(input.b7CustoPagina))} + ${formatBRL(n(input.b7Arquivo))} = ${formatBRL(papel)}`,
          `CO₂ = ${formatNumber(ambiente, 2)} kg/ano, fora do ROI`,
        ],
      }),
    };
    scenarios[name] = {
      pct: rate.value,
      horasProducao: horasProd,
      horasQualidade: horasQual,
      fteProducao: horasProd / fte.horas,
      fteQualidade: horasQual / fte.horas,
      reaisProducao: reaisProd,
      reaisQualidade: reaisQual,
      caixa,
      reaisHoras,
      base,
      blocks,
      ano1: yearGain(1, base, months),
      paybackMeses: paybackMonths(money.total, money.licenca, base, months),
      roi3: roiRatio(3, base, months, money.total, money.licenca),
      roi5: roiRatio(5, base, months, money.total, money.licenca),
      npv3: taxa == null ? null : npv(3, taxa, base, months, money.total, money.licenca),
      npv5: taxa == null ? null : npv(5, taxa, base, months, money.total, money.licenca),
    };
  }

  return {
    ops,
    incluirHoras,
    fte,
    curve,
    modo,
    months,
    money,
    taxa,
    dupla,
    revisao,
    capitalGiro: roundMoney(capitalGiro),
    ambiente,
    breakEven,
    perdaAnual: n(input.b5Qtd) * n(input.b5Valor),
    scenarios,
    disclaimer: DISCLAIMER,
  };
}

export function formatNumber(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatBRL(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(roundMoney(value));
}

export function formatPct(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatMonths(value) {
  if (value == null) return 'Não se paga em 10 anos';
  if (value === 0) return 'Imediato';
  const rounded = Math.round(value * 10) / 10;
  return `${formatNumber(rounded, Number.isInteger(rounded) ? 0 : 1)} meses`;
}
