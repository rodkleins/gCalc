/**
 * ROI de MES/EBR (NEO) para plantas farmacêuticas.
 * Os números vêm do usuário. Referências de painel não entram na conta.
 *
 * B1 horas_econ = lotes × (h_hoje − h_futuro)
 *    h_futuro = %sem_desvio × t_exceção + (1 − %sem_desvio) × t_com_desvio
 *    capital de giro = valor_lote × lotes × dias/365 × custo_capital
 * B2 horas = campos × segundos/3600 × lotes (Produção)
 * B3 custo = desvios/ano × %redução × horas × custo-hora (Qualidade)
 * B4 custo evitado = lotes rejeitados × valor × %evitável
 *    break-even = investimento inicial ÷ (lotes rejeitados × valor)
 * B5 horas = limpezas/mês × 12 × minutos/60; caixa = ocorrências × custo
 * B6 caixa = páginas × lotes × custo/página + arquivo anual
 *    indicador ambiental fica fora do ROI
 * B7 e B8 não entram no payback
 */

export const SCENARIOS = ['conservador', 'provavel', 'otimista'];

export const SCENARIO_LABELS = {
  conservador: 'Conservador',
  provavel: 'Provável',
  otimista: 'Otimista',
};

export const DISCLAIMER =
  'Estimativa baseada nos dados informados. Não substitui a avaliação do seu projeto nem a validação do sistema (CSV).';

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

export function deviationEffect(desviosMes, horasPorDesvio, pctReducao) {
  const desviosAno = n(desviosMes) * 12;
  const horas = desviosAno * clamp(n(pctReducao), 0, 1) * n(horasPorDesvio);
  return { desviosAno, horas };
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
  const raw = input.b3Pct?.[name];
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

export function evaluate(input = {}) {
  const scope = input.scope === 'pesagem' ? 'pesagem' : 'completo';
  const completo = scope === 'completo';
  const lotes = n(input.lotesAno);
  const custoProd = n(input.custoHoraProd);
  const custoQual = n(input.custoHoraQual);
  const fte = fteOf(input);
  const incluirHoras = input.incluirHoras !== false;
  const curve = curveOf(input);
  const modo = input.modo === 'base' ? 'base' : 'dedicado';
  const months = rampMonths(modo, curve.values);
  const money = capexOf(input);
  const taxa = input.taxa == null || input.taxa === '' ? null : clamp(n(input.taxa), 0, 1);

  const b1 = completo
    ? reviewHours(lotes, input.b1HorasProd, input.b1HorasQual, input.b1PctSemDesvio, input.b1TempoSem, input.b1TempoCom)
    : { hHoje: 0, hFuturo: 0, horas: 0, horasProducao: 0, horasQualidade: 0 };
  const capitalGiro = completo
    ? workingCapital(input.b1ValorLote, lotes, input.b1Dias, input.b1CustoCapital)
    : 0;
  const b2Horas = manualHours(input.b2Campos, input.b2Segundos, lotes);
  const b4 = completo ? avoidedLoss(input.b4Lotes, input.b4Valor, input.b4Pct) : 0;
  const b5Horas = completo ? cleaningHours(input.b5LimpezasMes, input.b5Minutos) : 0;
  const b5Caixa = completo ? n(input.b5Ocorrencias) * n(input.b5Custo) : 0;
  const b6 = paperCash(input.b6Paginas, input.b6CustoPagina, lotes, input.b6Arquivo);
  const ambiente = paperEnvironment(input.b6Paginas, lotes, input.b6Co2);

  const caixaFixo = capitalGiro + b4 + b5Caixa + b6;
  const horasProdFixas = b1.horasProducao + b2Horas + b5Horas;
  const horasQualFixas = b1.horasQualidade;

  const investimentoBreakEven = money.total + money.licenca;
  const breakEven = completo ? breakEvenPct(investimentoBreakEven, input.b4Lotes, input.b4Valor) : null;

  const scenarios = {};
  for (const name of SCENARIOS) {
    const rate = scenarioRate(input, name);
    const b3 = deviationEffect(input.b3DesviosMes, input.b3Horas, rate.value);
    const horasProd = horasProdFixas;
    const horasQual = horasQualFixas + b3.horas;
    const reaisProd = roundMoney(horasProd * custoProd);
    const reaisQual = roundMoney(horasQual * custoQual);
    const reaisHoras = roundMoney(reaisProd + reaisQual);
    const caixa = roundMoney(caixaFixo);
    const base = roundMoney(caixa + (incluirHoras ? reaisHoras : 0));
    const blocks = {
      b1: {
        horas: b1.horas,
        horasProducao: b1.horasProducao,
        horasQualidade: b1.horasQualidade,
        reaisHoras: b1.horasProducao * custoProd + b1.horasQualidade * custoQual,
        caixa: capitalGiro,
        total: (incluirHoras ? b1.horasProducao * custoProd + b1.horasQualidade * custoQual : 0) + capitalGiro,
      },
      b2: {
        horas: b2Horas,
        reaisHoras: b2Horas * custoProd,
        caixa: 0,
        total: incluirHoras ? b2Horas * custoProd : 0,
      },
      b3: {
        horas: b3.horas,
        desviosAno: b3.desviosAno,
        pct: rate.value,
        reaisHoras: b3.horas * custoQual,
        caixa: 0,
        total: incluirHoras ? b3.horas * custoQual : 0,
      },
      b4: { horas: 0, reaisHoras: 0, caixa: b4, total: b4 },
      b5: {
        horas: b5Horas,
        reaisHoras: b5Horas * custoProd,
        caixa: b5Caixa,
        total: b5Caixa + (incluirHoras ? b5Horas * custoProd : 0),
      },
      b6: { horas: 0, reaisHoras: 0, caixa: b6, total: b6 },
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
    scope,
    lotes,
    incluirHoras,
    fte,
    curve,
    modo,
    months,
    money,
    taxa,
    b1,
    capitalGiro: roundMoney(capitalGiro),
    ambiente,
    breakEven,
    perdaAnual: completo ? n(input.b4Lotes) * n(input.b4Valor) : 0,
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
