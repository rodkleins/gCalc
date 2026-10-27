/**
 * Modelos GO.compact e acordo-quadro Gollmann × DPSP. Dados da apresentação de 21.10.2026:
 * slides 4 e 8 (classes e serviços), 5 a 7 (composição do preço e opcionais), 11 e 12 (faixas de desconto
 * por volume e notas de crédito) e 14 a 23 (uma tabela por altura). Tudo fica embutido aqui: a página não busca nada em tempo de execução.
 */

/**
 * Lê número no formato brasileiro. Com um ponto só e três dígitos depois, o ponto é milhar ("1.500"),
 * exceto se a parte inteira começa com zero ("0.250" = 0,25). Com decimalDot, um ponto só é sempre
 * decimal: é o caso dos campos de percentual, de metros e do câmbio.
 */
export function parseBr(raw, options = {}) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw == null) return null;
  const text = String(raw)
    .trim()
    .replace(/[\s ]/g, '')
    .replace(/R\$|€|EUR/gi, '')
    .replace(/%/g, '')
    .replace(/m$/i, '');
  if (!text || text === '-' || text === ',' || text === '.') return null;
  const hasComma = text.includes(',');
  const dots = text.match(/\./g)?.length ?? 0;
  let normalized = text;
  if (hasComma) normalized = text.replace(/\./g, '').replace(',', '.');
  else if (dots > 1) normalized = text.replace(/\./g, '');
  else if (dots === 1) {
    const [head, tail] = text.split('.');
    if (!options.decimalDot && /^-?[1-9]\d{0,2}$/.test(head) && /^\d{3}$/.test(tail)) normalized = head + tail;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function toCents(value) {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(value) * 100 + 0.5 + 1e-6);
}

function roundMoney(value) {
  return toCents(value) / 100;
}

/** Metros com duas casas, sem o erro do ponto flutuante (3,08 + 0,68 = 3,76). */
function roundM(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** pt-BR é o padrão. en, de e es só mudam a pontuação; a moeda continua R$ ou €. */
function intlLocale(locale) {
  if (locale === 'en' || locale === 'en-US') return 'en-US';
  if (locale === 'de' || locale === 'de-DE') return 'de-DE';
  if (locale === 'es' || locale === 'es-ES') return 'es-ES';
  return 'pt-BR';
}

/** es-ES formata BRL como "BRL"; o símbolo do app continua R$, e o euro continua €. */
function formatCurrency(value, currency, digits, locale) {
  const loc = intlLocale(locale);
  if (loc === 'es-ES') {
    const num = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      useGrouping: true,
    }).format(value);
    return currency === 'BRL' ? `R$\u00a0${num}` : `${num}\u00a0€`;
  }
  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatFixed(value, digits, locale = 'pt-BR') {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  }).format(value);
}

export function formatFlex(value, maxDigits = 2, locale = 'pt-BR') {
  if (value == null || !Number.isFinite(value)) return '—';
  const factor = 10 ** maxDigits;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
    useGrouping: true,
  }).format(rounded);
}

export function formatBRL(value, locale = 'pt-BR') {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatCurrency(roundMoney(value), 'BRL', 2, locale);
}

/** Euro no padrão brasileiro: "€ 108.000". Centavos só aparecem quando existem (desconto por volume). */
export function formatEUR(value, locale = 'pt-BR') {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = roundMoney(value);
  const digits = Number.isInteger(rounded) ? 0 : 2;
  return formatCurrency(rounded, 'EUR', digits, locale);
}

export function formatMeters(value, locale = 'pt-BR') {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${formatFixed(value, 2, locale)} m`;
}

export function formatPacks(value, locale = 'pt-BR') {
  if (value == null || !Number.isFinite(value)) return '—';
  const word = { 'en-US': 'packages', 'de-DE': 'Packungen', 'es-ES': 'paquetes' }[intlLocale(locale)] ?? 'pacotes';
  return `${formatFlex(value, 0, locale)} ${word}`;
}

/** Os 10 pés-direitos de robô (slides 14 a 23). */
export const HEIGHTS = [2.2, 2.35, 2.5, 2.65, 2.8, 2.95, 3.1, 3.25, 3.4, 3.55];

/**
 * As 7 larguras das tabelas. A chave é a classe (GO.compact com o SAM), que é a coluna dos slides e do preço.
 * A largura física muda com a linha: GO.compact = classe − 0,20 m, salvo a leitura da tabela; GO.direct é a
 * outra linha (na classe 1,89 m o direct é 2,20 m, não 2,09 m). O slide 3 fala em 8 larguras, mas as tabelas
 * trazem 7: valem as tabelas.
 */
export const WIDTHS = [
  { key: '1.89', sam: 1.89, compact: 1.69, direct: 2.2 },
  { key: '2.40', sam: 2.4, compact: 2.2, direct: 2.6 },
  { key: '2.80', sam: 2.8, compact: 2.6, direct: 3.0 },
  { key: '3.20', sam: 3.2, compact: 3.0, direct: 3.4 },
  { key: '3.75', sam: 3.75, compact: 3.55, direct: 3.95 },
  { key: '4.15', sam: 4.15, compact: 3.95, direct: 4.35 },
  { key: '4.55', sam: 4.55, compact: 4.35, direct: 4.75 },
];

/** Linha do corpo. O preço não muda: continua a célula da classe (coluna com SAM). */
export function physicalWidthM(widthSam, modelLine = 'compact') {
  const row = WIDTHS.find((width) => Math.abs(width.sam - Number(widthSam)) < 1e-9);
  if (!row) return Number(widthSam);
  return modelLine === 'direct' ? row.direct : row.compact;
}

export const SAM_PROTRUSION_M = 0.2;

/** Slide 4 (capacidade e "a partir de") e slide 8 (serviços de transporte e instalação). */
export const CLASSES = [
  { id: 'S', approxPacks: 10000, fromEur: 89000, servicesEur: 18000 },
  { id: 'M', approxPacks: 15000, fromEur: 98000, servicesEur: 19500 },
  { id: 'L', approxPacks: 20000, fromEur: 103000, servicesEur: 21000 },
  { id: 'XL', approxPacks: 25000, fromEur: 109000, servicesEur: 22500 },
  { id: 'XXL', approxPacks: 30000, fromEur: 114000, servicesEur: 24000 },
  { id: '3XL', approxPacks: 35000, fromEur: 119000, servicesEur: 25500 },
  { id: '4XL', approxPacks: 40000, fromEur: 123000, servicesEur: 27000 },
];

/** Média dos serviços de transporte e instalação das 7 classes do slide 8: padrão do campo editável. */
export const AVERAGE_SERVICES_EUR = CLASSES.reduce((sum, cls) => sum + cls.servicesEur, 0) / CLASSES.length;

/** Slide 5: todo preço de tabela já traz a carga automática com OCR e o SAM com 4 saídas. */
export const PRICE_BUILD_UP = {
  autoLoadingEur: 22000,
  samEur: 3000,
  bundledEur: 25000,
};

/** Slide 5: o comprimento da tabela já soma a carga manual e a opção speed, gratuita. */
export const LENGTH_INCLUDED = {
  manualLoadingM: 0.15,
  speedOptionM: 0.17,
};

/** Slide 6. A esteira é "sob consulta": o valor é digitado. */
export const OPTIONS = {
  secondGripperEur: 14000,
  secondGripperLengthM: 0.68,
  coolingEur: 8000,
};

/** Slide 11: faixa pela contagem acumulada dos 5 anos, todas as farmácias DPSP juntas. */
export const VOLUME_TIERS = [
  { from: 1, pct: 0 },
  { from: 10, pct: 2 },
  { from: 25, pct: 4 },
  { from: 50, pct: 6 },
  { from: 100, pct: 8 },
];

/** Slide 10: 5 anos; anos 1 e 2 com preço fixo, a partir do 3º no máximo o VPI alemão do ano anterior. */
export const AGREEMENT = {
  years: 5,
  fixedYears: 2,
};

/**
 * Slides 14 a 23, linha por classe, coluna por largura c/ SAM (1,89 · 2,40 · 2,80 · 3,20 · 3,75 · 4,15 · 4,55).
 * Cada célula: [preço total do robô em €, comprimento em m, capacidade garantida em pacotes]. null = "–".
 * A tabela só tem as colunas que existem naquela altura.
 */
const RAW_TABLES = {
  '2.20': {
    S: [[103000, 5.63, 10000], [101000, 4.37, 10000], [99000, 3.71, 9500], [97000, 3.37, 9500], [95000, 3.08, 9500], [93000, 3.08, 11000], [92000, 2.74, 10500]],
    M: [[117000, 6.89, 13500], [114000, 5.63, 14500], [112000, 5.00, 15000], [109000, 4.37, 15000], [106000, 4.00, 16000], [104000, 3.71, 15500], [101000, 3.37, 15500]],
    L: [null, [125000, 6.89, 19500], [121000, 5.92, 19500], [118000, 5.34, 20000], [115000, 4.71, 20000], [112000, 4.37, 20500], [109000, 4.00, 20500]],
    XL: [null, null, [127000, 6.89, 24000], [125000, 6.26, 25000], [122000, 5.63, 26000], [120000, 5.00, 25000], [118000, 4.71, 25500]],
    XXL: [null, null, null, [128000, 6.89, 28500], [127000, 6.26, 30500], [126000, 5.63, 30000], [125000, 5.34, 30500]],
    '3XL': [null, null, null, null, [134000, 6.89, 34500], [133000, 6.26, 34500], [132000, 5.92, 36000]],
    '4XL': [null, null, null, null, null, [141000, 6.89, 39000], [140000, 6.55, 41000]],
  },
  '2.35': {
    S: [[103000, 5.34, 10000], [101000, 4.00, 9500], [99000, 3.71, 10500], [97000, 3.37, 11000], [96000, 3.08, 11000], [94000, 2.74, 10000], [92000, 2.74, 11500]],
    M: [[117000, 6.89, 15000], [114000, 5.34, 15000], [111000, 4.71, 15000], [108000, 4.00, 14500], [105000, 3.71, 15500], [102000, 3.37, 15000], [98000, 3.08, 14000]],
    L: [null, [124000, 6.55, 20500], [120000, 5.63, 20000], [117000, 5.00, 20500], [114000, 4.37, 20000], [110000, 4.00, 20500], [107000, 3.71, 19500]],
    XL: [null, null, [125000, 6.55, 25000], [122000, 5.92, 26000], [120000, 5.00, 24500], [118000, 4.71, 25000], [115000, 4.37, 25500]],
    XXL: [null, null, null, [126000, 6.55, 30000], [125000, 5.63, 29000], [124000, 5.34, 30000], [123000, 5.00, 31000]],
    '3XL': [null, null, null, null, [134000, 6.55, 36000], [131000, 5.92, 35500], [129000, 5.34, 34000]],
    '4XL': [null, null, null, null, null, [139000, 6.55, 40500], [136000, 5.92, 40000]],
  },
  '2.50': {
    S: [[103000, 5.00, 10500], [101000, 4.00, 10500], [98000, 3.37, 10000], [96000, 3.08, 9500], [94000, 2.74, 10000], [92000, 2.74, 11000], [90000, 2.45, 9500]],
    M: [[116000, 6.55, 15500], [113000, 5.00, 15000], [110000, 4.37, 15000], [107000, 4.00, 16000], [105000, 3.37, 14500], [102000, 3.37, 16500], [99000, 3.08, 15500]],
    L: [null, [122000, 5.92, 19500], [118000, 5.34, 20500], [115000, 4.71, 20000], [111000, 4.00, 19500], [108000, 3.71, 19500], [104000, 3.37, 19000]],
    XL: [null, [130000, 6.89, 23500], [126000, 6.26, 26000], [122000, 5.34, 24500], [118000, 4.71, 24500], [114000, 4.37, 25000], [111000, 4.00, 25000]],
    XXL: [null, null, [130000, 6.89, 29000], [127000, 6.26, 30500], [125000, 5.34, 29500], [122000, 5.00, 30500], [120000, 4.71, 31000]],
    '3XL': [null, null, null, [130000, 6.89, 34500], [129000, 5.92, 34500], [128000, 5.63, 36000], [126000, 5.00, 34000]],
    '4XL': [null, null, null, null, [134000, 6.55, 39500], [133000, 5.92, 39000], [132000, 5.63, 40500]],
  },
  '2.65': {
    S: [[102000, 4.71, 10000], [100000, 3.71, 10000], [97000, 3.37, 11000], [95000, 3.08, 10500], [92000, 2.74, 11000], [89000, 2.45, 9000]],
    M: [[114000, 5.92, 15000], [111000, 4.71, 14500], [108000, 4.00, 14500], [105000, 3.71, 15000], [102000, 3.37, 16000], [99000, 3.08, 15000]],
    L: [null, [120000, 5.63, 19500], [117000, 5.00, 20500], [114000, 4.37, 20000], [110000, 4.00, 21500], [107000, 3.71, 21000]],
    XL: [null, [129000, 6.55, 24500], [124000, 5.63, 24500], [119000, 5.00, 24500], [114000, 4.37, 24000], [109000, 4.00, 24500]],
    XXL: [null, null, [129000, 6.55, 30000], [125000, 5.63, 29000], [121000, 5.00, 29500], [117000, 4.71, 30000]],
    '3XL': [null, null, null, [129000, 6.55, 36000], [128000, 5.63, 35000], [127000, 5.34, 36000]],
    '4XL': [null, null, null, null, [133000, 6.26, 40000], [131000, 5.63, 39500]],
  },
  '2.80': {
    S: [[99000, 4.37, 10000], [97000, 3.37, 9500], [95000, 3.08, 9500], [93000, 2.74, 9500], [92000, 2.74, 11500]],
    M: [[113000, 5.63, 15000], [110000, 4.37, 14500], [106000, 4.00, 16000], [102000, 3.37, 14500], [98000, 3.08, 14000]],
    L: [[125000, 6.89, 19500], [120000, 5.34, 19500], [115000, 4.71, 20000], [110000, 4.00, 19000], [105000, 3.71, 20000]],
    XL: [null, [128000, 6.26, 24500], [122000, 5.34, 24000], [117000, 4.71, 24000], [111000, 4.37, 26000]],
    XXL: [null, null, [128000, 6.26, 30500], [122000, 5.63, 31500], [116000, 4.71, 29000]],
    '3XL': [null, null, [135000, 6.89, 34500], [129000, 6.26, 36000], [123000, 5.34, 34500]],
    '4XL': [null, null, null, [133000, 6.89, 41000], [130000, 5.92, 40500]],
  },
  '2.95': {
    S: [[99000, 4.00, 9500], [97000, 3.37, 10500], [95000, 3.08, 10500], [92000, 2.74, 10500], [90000, 2.45, 9500]],
    M: [[112000, 5.34, 14500], [109000, 4.37, 15500], [105000, 3.71, 15000], [102000, 3.37, 15500], [99000, 3.08, 15500]],
    L: [[122000, 6.55, 20000], [118000, 5.00, 19500], [113000, 4.37, 19500], [108000, 4.00, 20500], [103000, 3.37, 19000]],
    XL: [null, [127000, 5.92, 25000], [121000, 5.00, 24000], [115000, 4.71, 25500], [109000, 4.00, 25000]],
    XXL: [null, [136000, 6.89, 30000], [129000, 5.92, 30500], [122000, 5.34, 31000], [115000, 4.71, 31000]],
    '3XL': [null, null, [132000, 6.55, 35000], [126000, 5.92, 36500], [120000, 5.00, 34500]],
    '4XL': [null, null, null, [129000, 6.26, 39000], [128000, 5.63, 40500]],
  },
  '3.10': {
    S: [[100000, 4.00, 10500], [97000, 3.37, 11000], [95000, 2.74, 9500], [92000, 2.74, 11000]],
    M: [[112000, 5.34, 15500], [109000, 4.00, 15000], [105000, 3.71, 16000], [102000, 3.37, 16500]],
    L: [[123000, 6.26, 20000], [118000, 5.00, 21000], [112000, 4.37, 21000], [107000, 3.71, 19000]],
    XL: [null, [127000, 5.63, 24500], [119000, 5.00, 25500], [112000, 4.37, 25000]],
    XXL: [null, [137000, 6.55, 30500], [127000, 5.63, 30500], [117000, 5.00, 30500]],
    '3XL': [null, null, [132000, 6.26, 35000], [124000, 5.63, 36000]],
    '4XL': [null, null, [139000, 6.89, 39500], [127000, 5.92, 39000]],
  },
  '3.25': {
    S: [[98000, 3.71, 9500], [95000, 3.08, 9500], [93000, 2.74, 10000], [90000, 2.45, 9000]],
    M: [[112000, 5.00, 15500], [108000, 4.00, 16000], [104000, 3.37, 15000], [100000, 3.08, 14500]],
    L: [[121000, 5.92, 20000], [116000, 4.71, 20000], [111000, 4.00, 20000], [106000, 3.71, 20500]],
    XL: [[129000, 6.89, 24500], [123000, 5.34, 24000], [117000, 4.71, 24500], [111000, 4.00, 24000]],
    XXL: [null, [136000, 6.26, 30500], [126000, 5.34, 29500], [116000, 4.71, 29500]],
    '3XL': [null, [142000, 6.89, 34500], [132000, 5.92, 35000], [122000, 5.34, 35000]],
    '4XL': [null, null, [137000, 6.55, 40000], [129000, 5.92, 41500]],
  },
  '3.40': {
    S: [[99000, 3.71, 10000], [96000, 3.08, 10500], [94000, 2.74, 10500], [91000, 2.45, 9500]],
    M: [[109000, 4.71, 15000], [106000, 3.71, 14500], [103000, 3.37, 16000], [100000, 3.08, 15500]],
    L: [[120000, 5.63, 19500], [115000, 4.71, 21000], [111000, 4.00, 21000], [106000, 3.37, 19000]],
    XL: [[129000, 6.55, 24500], [123000, 5.34, 25500], [118000, 4.71, 26000], [112000, 4.00, 25500]],
    XXL: [null, [132000, 5.92, 30500], [124000, 5.00, 29000], [116000, 4.71, 31000]],
    '3XL': [null, [140000, 6.55, 34500], [130000, 5.63, 34500], [119000, 5.00, 34500]],
    '4XL': [null, null, [136000, 6.26, 39500], [126000, 5.63, 40500]],
  },
  '3.55': {
    S: [[97000, 3.37, 9500], [95000, 3.08, 11000], [94000, 2.74, 11500], [93000, 2.45, 10000]],
    M: [[109000, 4.71, 15500], [106000, 3.71, 15500], [103000, 3.08, 13500], [100000, 3.08, 16500]],
    L: [[119000, 5.63, 21000], [114000, 4.37, 20500], [109000, 3.71, 19500], [105000, 3.37, 20000]],
    XL: [[127000, 6.55, 26000], [122000, 5.00, 25000], [116000, 4.37, 25500], null],
    XXL: [null, [131000, 5.63, 29500], [122000, 5.00, 31000], [114000, 4.37, 30000]],
    '3XL': [null, [138000, 6.26, 34000], [129000, 5.63, 36500], [120000, 5.00, 36500]],
    '4XL': [null, [146000, 6.89, 38500], [134000, 5.92, 39500], [123000, 5.34, 39500]],
  },
};

function heightKey(heightM) {
  return Number(heightM).toFixed(2);
}

function widthKey(widthSam) {
  return Number(widthSam).toFixed(2);
}

/** Tabelas por altura → classe → largura c/ SAM, com null onde o slide mostra "–". */
export const PRICE_TABLES = Object.fromEntries(
  HEIGHTS.map((heightM) => {
    const raw = RAW_TABLES[heightKey(heightM)];
    const byClass = Object.fromEntries(
      CLASSES.map((cls) => {
        const row = raw[cls.id];
        const cells = Object.fromEntries(
          row.map((cell, index) => [
            WIDTHS[index].key,
            cell ? { priceEur: cell[0], lengthM: cell[1], capacityPacks: cell[2] } : null,
          ]),
        );
        return [cls.id, cells];
      }),
    );
    return [heightKey(heightM), byClass];
  }),
);

/** As 286 configurações válidas, em ordem de altura, largura e classe. */
export const CONFIGURATIONS = HEIGHTS.flatMap((heightM, heightIndex) =>
  WIDTHS.flatMap((width, widthIndex) =>
    CLASSES.flatMap((cls, classIndex) => {
      const cell = PRICE_TABLES[heightKey(heightM)][cls.id][width.key];
      if (!cell) return [];
      return [
        {
          id: `${heightKey(heightM)}|${width.key}|${cls.id}`,
          heightM,
          heightIndex,
          widthSam: width.sam,
          widthCompact: width.compact,
          widthDirect: width.direct,
          widthIndex,
          classId: cls.id,
          classIndex,
          ...cell,
        },
      ];
    }),
  ),
);

/** Larguras que existem na tabela de uma altura (as colunas do slide). */
export function widthsAt(heightM) {
  const table = PRICE_TABLES[heightKey(heightM)];
  if (!table) return [];
  return WIDTHS.filter((width) => CLASSES.some((cls) => table[cls.id][width.key] !== undefined));
}

/** Maior altura em que a largura aparece. */
export function maxHeightOf(widthSam) {
  const key = widthKey(widthSam);
  let max = null;
  for (const config of CONFIGURATIONS) {
    if (widthKey(config.widthSam) === key) max = max == null ? config.heightM : Math.max(max, config.heightM);
  }
  return max;
}

export function getConfig(heightM, widthSam, classId) {
  return CONFIGURATIONS.find(
    (config) =>
      heightKey(config.heightM) === heightKey(heightM) &&
      widthKey(config.widthSam) === widthKey(widthSam) &&
      config.classId === classId,
  ) ?? null;
}

export function classesAt(heightM, widthSam) {
  return CLASSES.filter((cls) => getConfig(heightM, widthSam, cls.id)).map((cls) => cls.id);
}

export function classOf(classId) {
  return CLASSES.find((cls) => cls.id === classId) ?? null;
}

/** Menor e maior preço de tabela por classe, nas 10 alturas e 7 larguras. */
export function classPriceRange(classId) {
  const prices = CONFIGURATIONS.filter((config) => config.classId === classId).map((config) => config.priceEur);
  return { min: Math.min(...prices), max: Math.max(...prices), count: prices.length };
}

/** Exemplos dos slides 7 e 8, todos na altura 2,95 m. */
export const PRESETS = [
  {
    id: 'ex1',
    label: 'Ex. 1 · Robô S',
    heightM: 2.95,
    widthSam: 2.8,
    classId: 'S',
    expected: { lengthM: 3.08, capacityPacks: 10500, robotEur: 70000, totalEur: 95000, servicesEur: 18000, withServicesEur: 113000 },
  },
  {
    id: 'ex2',
    label: 'Ex. 2 · Robô L (Padrão)',
    heightM: 2.95,
    widthSam: 3.2,
    classId: 'L',
    expected: { lengthM: 4.0, capacityPacks: 20500, robotEur: 83000, totalEur: 108000, servicesEur: 21000, withServicesEur: 129000 },
  },
  {
    id: 'ex3',
    label: 'Ex. 3 · Robô XXL',
    heightM: 2.95,
    widthSam: 3.75,
    classId: 'XXL',
    expected: { lengthM: 4.71, capacityPacks: 31000, robotEur: 90000, totalEur: 115000, servicesEur: 24000, withServicesEur: 139000 },
  },
  {
    id: 'ex4',
    label: 'Ex. 4 · Robô 4XL',
    heightM: 2.95,
    widthSam: 3.75,
    classId: '4XL',
    expected: { lengthM: 5.63, capacityPacks: 40500, robotEur: 103000, totalEur: 128000, servicesEur: 27000, withServicesEur: 155000 },
  },
];

export const WIDTH_REFS = ['sam', 'compact', 'direct'];

export const WIDTH_REF_LABELS = {
  sam: 'GO.compact c/ SAM',
  compact: 'GO.compact',
  direct: 'GO.direct',
};

/**
 * NCM 8479.89.99, "outras máquinas e aparelhos mecânicos com função própria", Bem de Capital (BK). II da TEC
 * Mercosul e da Res. GECEX 852/2026, IPI da TIPI, PIS/COFINS-Importação da Lei 10.865/2004 com o adicional de
 * 2026 da Lei 14.973/2024 e ICMS-Importação de SP com e sem o Convênio ICMS 52/91.
 */
export const NCM_INFO = {
  code: '8479.89.99',
  description: 'Outras máquinas e aparelhos mecânicos com função própria (Bem de Capital — BK)',
  iiTecPct: 12.6,
  iiGecex2026Pct: 20,
  ipiPct: 0,
  pisPct: 2.1,
  cofinsBasePct: 9.65,
  cofinsAddPct: 0.6,
  cofinsTotalPct: 10.25,
  icmsConvenio5291Pct: 8.8,
  icmsFullSpPct: 18,
};

export const DEFAULTS = {
  heightM: 2.95,
  widthSam: 3.2,
  classId: 'L',
  modelLine: 'compact',
  secondGripper: false,
  coolingModule: false,
  conveyorEur: 0,
  servicesEur: AVERAGE_SERVICES_EUR,
  localServicesBrl: 250000,
  includeServices: true,
  roomFilterOn: false,
  roomHeightM: 3,
  roomWidthM: 3.5,
  roomWidthRef: 'sam',
  roomLengthM: 5,
  minCapacity: 20000,
  fxRate: 6.2,
  // NCM 8479.89.99: Ex-Tarifário liga/desliga o II; alíquotas e créditos editáveis.
  exTarifario: true,
  iiRatePct: NCM_INFO.iiTecPct,
  ipiRatePct: NCM_INFO.ipiPct,
  pisRatePct: NCM_INFO.pisPct,
  cofinsBaseRatePct: NCM_INFO.cofinsBasePct,
  cofinsAddRatePct: NCM_INFO.cofinsAddPct,
  customsExpensesPct: 0,
  convenioIcms5291: true,
  icmsRatePct: NCM_INFO.icmsConvenio5291Pct,
  creditPisCofins: true,
  creditIcms: true,
  icmsCreditFactorPct: 100,
  fleetRobots: 1,
  year1Robots: 5,
  year2Robots: 10,
  year3Robots: 15,
  year4Robots: 10,
  year5Robots: 10,
  germanInflationPct: 2,
};

export const YEAR_KEYS = ['year1Robots', 'year2Robots', 'year3Robots', 'year4Robots', 'year5Robots'];

function num(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nearest(list, value) {
  let best = list[0];
  for (const item of list) {
    if (Math.abs(item - value) < Math.abs(best - value)) best = item;
  }
  return best;
}

function optionalMeters(value, fallback) {
  if (value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return clamp(value, 0.5, 30);
  return fallback;
}

export function sanitize(raw = {}) {
  const input = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return input;
  input.heightM = nearest(HEIGHTS, num(raw.heightM, DEFAULTS.heightM));
  input.widthSam = nearest(
    WIDTHS.map((width) => width.sam),
    num(raw.widthSam, DEFAULTS.widthSam),
  );
  input.classId = classOf(raw.classId) ? raw.classId : DEFAULTS.classId;
  input.modelLine = raw.modelLine === 'direct' ? 'direct' : 'compact';
  for (const key of ['secondGripper', 'coolingModule', 'includeServices', 'roomFilterOn', 'exTarifario', 'convenioIcms5291', 'creditPisCofins', 'creditIcms']) {
    if (typeof raw[key] === 'boolean') input[key] = raw[key];
  }
  input.conveyorEur = Math.max(0, num(raw.conveyorEur, DEFAULTS.conveyorEur));
  // Transporte e instalação agora é um valor digitado. includeServices: false sem valor é o "fora" antigo.
  if (raw.includeServices === false && raw.servicesEur === undefined) {
    input.servicesEur = 0;
    input.includeServices = false;
  } else {
    input.servicesEur = roundMoney(Math.max(0, num(raw.servicesEur, DEFAULTS.servicesEur)));
    input.includeServices = input.servicesEur > 0;
  }
  input.localServicesBrl = roundMoney(Math.max(0, num(raw.localServicesBrl, DEFAULTS.localServicesBrl)));
  input.roomHeightM = optionalMeters(raw.roomHeightM, DEFAULTS.roomHeightM);
  input.roomWidthM = optionalMeters(raw.roomWidthM, DEFAULTS.roomWidthM);
  input.roomLengthM = optionalMeters(raw.roomLengthM, DEFAULTS.roomLengthM);
  input.roomWidthRef = WIDTH_REFS.includes(raw.roomWidthRef) ? raw.roomWidthRef : DEFAULTS.roomWidthRef;
  if (raw.minCapacity === null || raw.minCapacity === '') input.minCapacity = null;
  else input.minCapacity = Math.max(0, Math.round(num(raw.minCapacity, DEFAULTS.minCapacity)));
  input.fxRate = clamp(num(raw.fxRate, DEFAULTS.fxRate), 0.01, 100);
  input.iiRatePct = clamp(num(raw.iiRatePct, DEFAULTS.iiRatePct), 0, 100);
  input.ipiRatePct = clamp(num(raw.ipiRatePct, DEFAULTS.ipiRatePct), 0, 100);
  input.pisRatePct = clamp(num(raw.pisRatePct, DEFAULTS.pisRatePct), 0, 50);
  input.cofinsBaseRatePct = clamp(num(raw.cofinsBaseRatePct, DEFAULTS.cofinsBaseRatePct), 0, 50);
  input.cofinsAddRatePct = clamp(num(raw.cofinsAddRatePct, DEFAULTS.cofinsAddRatePct), 0, 20);
  input.customsExpensesPct = clamp(num(raw.customsExpensesPct, DEFAULTS.customsExpensesPct), 0, 100);
  // A alíquota digitada manda: o convênio fica ligado só quando ela é a do Convênio ICMS 52/91.
  if (raw.icmsRatePct !== undefined) {
    input.icmsRatePct = clamp(num(raw.icmsRatePct, DEFAULTS.icmsRatePct), 0, 40);
    input.convenioIcms5291 = Math.abs(input.icmsRatePct - NCM_INFO.icmsConvenio5291Pct) < 1e-6;
  } else if (typeof raw.convenioIcms5291 === 'boolean') {
    input.icmsRatePct = raw.convenioIcms5291 ? NCM_INFO.icmsConvenio5291Pct : NCM_INFO.icmsFullSpPct;
  }
  input.icmsCreditFactorPct = clamp(num(raw.icmsCreditFactorPct, DEFAULTS.icmsCreditFactorPct), 0, 100);
  input.fleetRobots = Math.round(clamp(num(raw.fleetRobots, DEFAULTS.fleetRobots), 1, 5000));
  for (const key of YEAR_KEYS) input[key] = Math.round(clamp(num(raw[key], DEFAULTS[key]), 0, 1000));
  input.germanInflationPct = clamp(num(raw.germanInflationPct, DEFAULTS.germanInflationPct), 0, 50);
  return input;
}

/** Peso de mudar cada eixo quando a combinação pedida não existe: o pé-direito pesa mais, depois a capacidade. */
const RESOLVE_WEIGHTS = { height: 3, class: 2, width: 1 };

/**
 * Garante uma célula da tabela. Se a combinação pedida não existe, mantém o campo que o usuário acabou de
 * mudar (keep = 'height' | 'width' | 'class') e procura a célula mais próxima pelos índices das listas.
 * Empate fica com o menor preço.
 */
export function resolveSelection(raw = {}, keep = null) {
  const input = sanitize(raw);
  const requested = { heightM: input.heightM, widthSam: input.widthSam, classId: input.classId };
  const direct = getConfig(requested.heightM, requested.widthSam, requested.classId);
  if (direct) return { ...requested, config: direct, requested, changed: [] };
  const hIndex = HEIGHTS.indexOf(requested.heightM);
  const wIndex = WIDTHS.findIndex((width) => width.sam === requested.widthSam);
  const cIndex = CLASSES.findIndex((cls) => cls.id === requested.classId);
  let pool = CONFIGURATIONS;
  if (keep === 'height') pool = pool.filter((config) => config.heightIndex === hIndex);
  if (keep === 'width') pool = pool.filter((config) => config.widthIndex === wIndex);
  if (keep === 'class') pool = pool.filter((config) => config.classIndex === cIndex);
  if (!pool.length) pool = CONFIGURATIONS;
  const cost = (config) =>
    Math.abs(config.heightIndex - hIndex) * RESOLVE_WEIGHTS.height +
    Math.abs(config.widthIndex - wIndex) * RESOLVE_WEIGHTS.width +
    Math.abs(config.classIndex - cIndex) * RESOLVE_WEIGHTS.class;
  const best = [...pool].sort((a, b) => cost(a) - cost(b) || a.priceEur - b.priceEur)[0];
  const changed = [];
  if (best.heightM !== requested.heightM) changed.push('heightM');
  if (best.widthSam !== requested.widthSam) changed.push('widthSam');
  if (best.classId !== requested.classId) changed.push('classId');
  return { heightM: best.heightM, widthSam: best.widthSam, classId: best.classId, config: best, requested, changed };
}

/**
 * Composição do preço de um robô (slides 5 a 8) e as medidas que dela decorrem. Opcionais e transporte e
 * instalação ficam separados; o desconto por volume (slide 11) incide sobre o pedido Gollmann inteiro. Os
 * serviços locais são faturados em reais no Brasil e ficam fora do pedido em euro.
 */
export function quoteRobot(config, raw = {}) {
  const options = sanitize({ ...raw, heightM: config.heightM, widthSam: config.widthSam, classId: config.classId });
  const cls = classOf(config.classId);
  const tablePriceEur = config.priceEur;
  const baseRobotEur = tablePriceEur - PRICE_BUILD_UP.bundledEur;
  const autoLoadingEur = PRICE_BUILD_UP.autoLoadingEur;
  const samEur = PRICE_BUILD_UP.samEur;
  const secondGripperEur = options.secondGripper ? OPTIONS.secondGripperEur : 0;
  const coolingEur = options.coolingModule ? OPTIONS.coolingEur : 0;
  const conveyorEur = roundMoney(options.conveyorEur);
  const optionsEur = roundMoney(secondGripperEur + coolingEur + conveyorEur);
  const servicesEur = roundMoney(options.servicesEur);
  const equipmentEur = roundMoney(tablePriceEur + optionsEur);
  const orderEur = roundMoney(equipmentEur + servicesEur);
  const discountPct = volumeBonusPct(options.fleetRobots);
  const discountEur = roundMoney(orderEur * (discountPct / 100));
  const netOrderEur = roundMoney(orderEur - discountEur);
  const localServicesBrl = roundMoney(options.localServicesBrl);
  const extraLengthM = options.secondGripper ? OPTIONS.secondGripperLengthM : 0;
  const tableLengthM = config.lengthM;
  const totalLengthM = roundM(tableLengthM + extraLengthM);
  const coreLengthM = roundM(tableLengthM - LENGTH_INCLUDED.manualLoadingM - LENGTH_INCLUDED.speedOptionM);
  const footprintM2 = Math.round(config.widthSam * totalLengthM * 10000) / 10000;
  return {
    config,
    classId: config.classId,
    heightM: config.heightM,
    widthSam: config.widthSam,
    widthCompact: config.widthCompact,
    widthDirect: config.widthDirect,
    capacityPacks: config.capacityPacks,
    approxPacks: cls.approxPacks,
    tablePriceEur,
    baseRobotEur,
    autoLoadingEur,
    samEur,
    robotPriceEur: baseRobotEur + autoLoadingEur + samEur,
    secondGripper: options.secondGripper,
    coolingModule: options.coolingModule,
    includeServices: options.includeServices,
    secondGripperEur,
    coolingEur,
    conveyorEur,
    optionsEur,
    servicesEur,
    classServicesEur: cls.servicesEur,
    equipmentEur,
    orderEur,
    fleetRobots: options.fleetRobots,
    discountPct,
    discountEur,
    netOrderEur,
    localServicesBrl,
    localServicesEurApprox: roundMoney(localServicesBrl / options.fxRate),
    tableLengthM,
    coreLengthM,
    extraLengthM,
    totalLengthM,
    footprintM2,
    compactAreaM2: Math.round(config.widthCompact * totalLengthM * 10000) / 10000,
    directAreaM2: Math.round(config.widthDirect * totalLengthM * 10000) / 10000,
    volumeM3: Math.round(footprintM2 * config.heightM * 10000) / 10000,
    eurPerPack: netOrderEur / config.capacityPacks,
  };
}

/**
 * Custo Brasil de um valor em euro na NCM 8479.89.99, em cascata sobre o Valor Aduaneiro (VA = euro × câmbio):
 * II (zero com Ex-Tarifário), IPI sobre VA + II, PIS e COFINS (base + adicional de 2026) sobre o VA, despesas
 * aduaneiras e ICMS "por dentro". Depois, os créditos escolhidos: PIS + COFINS base e ICMS. O II e o adicional
 * de 0,60% da COFINS nunca geram crédito. Retorna reais com centavos.
 */
export function brazilCost(eur, raw = {}) {
  const input = sanitize(raw);
  const {
    fxRate,
    exTarifario,
    iiRatePct,
    ipiRatePct,
    pisRatePct,
    cofinsBaseRatePct,
    cofinsAddRatePct,
    customsExpensesPct,
    convenioIcms5291,
    icmsRatePct,
    creditPisCofins,
    creditIcms,
    icmsCreditFactorPct,
  } = input;
  const vaBrl = roundMoney(eur * fxRate);
  const effectiveIiPct = exTarifario ? 0 : iiRatePct;
  const iiBrl = roundMoney(vaBrl * (effectiveIiPct / 100));
  const ipiBaseBrl = roundMoney(vaBrl + iiBrl);
  const ipiBrl = roundMoney(ipiBaseBrl * (ipiRatePct / 100));
  // PIS e COFINS-Importação: base é só o VA (STF Tema 01; Lei 10.865/2004, art. 7º, I).
  const pisBrl = roundMoney(vaBrl * (pisRatePct / 100));
  const cofinsBaseBrl = roundMoney(vaBrl * (cofinsBaseRatePct / 100));
  const cofinsAddBrl = roundMoney(vaBrl * (cofinsAddRatePct / 100));
  const cofinsRatePct = roundMoney(cofinsBaseRatePct + cofinsAddRatePct);
  const cofinsBrl = roundMoney(cofinsBaseBrl + cofinsAddBrl);
  const customsExpensesBrl = roundMoney(vaBrl * (customsExpensesPct / 100));
  // ICMS-Importação "por dentro" (RICMS/SP, arts. 37, IV e 49): o imposto integra a própria base.
  const icmsNumeratorBrl = roundMoney(vaBrl + iiBrl + ipiBrl + pisBrl + cofinsBrl + customsExpensesBrl);
  const icmsBaseBrl = icmsRatePct >= 100 ? icmsNumeratorBrl : roundMoney(icmsNumeratorBrl / (1 - icmsRatePct / 100));
  const icmsBrl = roundMoney(icmsBaseBrl * (icmsRatePct / 100));
  const importBrl = roundMoney(iiBrl + ipiBrl + pisBrl + cofinsBrl + customsExpensesBrl + icmsBrl);
  const landedBrl = roundMoney(vaBrl + importBrl);
  const creditPisBrl = creditPisCofins ? pisBrl : 0;
  // O adicional de 0,60% da COFINS não entra no crédito (Lei 10.865/2004, art. 15, § 1º-A).
  const creditCofinsBrl = creditPisCofins ? cofinsBaseBrl : 0;
  const creditPisCofinsBrl = roundMoney(creditPisBrl + creditCofinsBrl);
  const creditIcmsBrl = creditIcms ? roundMoney(icmsBrl * (icmsCreditFactorPct / 100)) : 0;
  const creditBrl = roundMoney(creditPisCofinsBrl + creditIcmsBrl);
  const nonRecoverableBrl = roundMoney(importBrl - creditBrl);
  const netBrl = roundMoney(landedBrl - creditBrl);
  const effectiveImportPct = vaBrl > 0 ? (importBrl / vaBrl) * 100 : 0;
  const effectiveCreditOnVaPct = vaBrl > 0 ? (creditBrl / vaBrl) * 100 : 0;
  const effectiveCreditOnLandedPct = landedBrl > 0 ? (creditBrl / landedBrl) * 100 : 0;
  const effectiveNetTaxPct = vaBrl > 0 ? (nonRecoverableBrl / vaBrl) * 100 : 0;
  const brazil = {
    eur,
    fxRate,
    ncm: NCM_INFO.code,
    exTarifario,
    iiRatePct,
    effectiveIiPct,
    ipiRatePct,
    pisRatePct,
    cofinsBaseRatePct,
    cofinsAddRatePct,
    cofinsRatePct,
    customsExpensesPct,
    convenioIcms5291,
    icmsRatePct,
    creditPisCofins,
    creditIcms,
    icmsCreditFactorPct,
    vaBrl,
    grossBrl: vaBrl,
    iiBrl,
    ipiBaseBrl,
    ipiBrl,
    pisBrl,
    cofinsBaseBrl,
    cofinsAddBrl,
    cofinsBrl,
    customsExpensesBrl,
    icmsNumeratorBrl,
    icmsBaseBrl,
    icmsBrl,
    importBrl,
    landedBrl,
    creditPisBrl,
    creditCofinsBrl,
    creditPisCofinsBrl,
    creditIcmsBrl,
    creditBrl,
    nonRecoverableBrl,
    netBrl,
    effectiveImportPct,
    effectiveCreditOnVaPct,
    effectiveCreditOnLandedPct,
    effectiveNetTaxPct,
    importCostPct: effectiveImportPct,
    taxCreditPct: effectiveCreditOnLandedPct,
  };
  brazil.taxLines = ncmTaxReference(brazil);
  return brazil;
}

/**
 * Tabela de referência da NCM 8479.89.99: cada tributo com alíquota, base, valor pago, se gera crédito, o
 * crédito usado na conta e o custo líquido. As despesas aduaneiras só aparecem quando existem.
 */
export function ncmTaxReference(brazil) {
  const lines = [
    {
      key: 'ii',
      label: 'II (Imposto de Importação)',
      ratePct: brazil.effectiveIiPct,
      rateLabel: brazil.exTarifario
        ? '0% c/ Ex-Tarifário'
        : `${pct(brazil.effectiveIiPct)} s/ Ex-Tarifário (TEC ${pct(NCM_INFO.iiTecPct)} / GECEX ${pct(NCM_INFO.iiGecex2026Pct)})`,
      baseLabel: 'VA',
      amountBrl: brazil.iiBrl,
      creditable: false,
      creditBrl: 0,
      netCostBrl: brazil.iiBrl,
      legalBasis: 'TEC Mercosul / Res. GECEX 852/2026 · Ex-Tarifário BK zera p/ 0%',
      creditRule: 'Não creditável (custo definitivo em qualquer regime)',
    },
    {
      key: 'ipi',
      label: 'IPI (Imposto s/ Prod. Industrializados)',
      ratePct: brazil.ipiRatePct,
      rateLabel: pct(brazil.ipiRatePct),
      baseLabel: 'VA + II',
      amountBrl: brazil.ipiBrl,
      creditable: false,
      creditBrl: 0,
      netCostBrl: brazil.ipiBrl,
      legalBasis: 'TIPI Decreto 11.158/2022 — NCM 8479.89.99 tem alíquota 0%',
      creditRule: 'Alíquota 0% na NCM 8479.89.99 (e não creditável p/ farmácia ou locadora)',
    },
    {
      key: 'pis',
      label: 'PIS-Importação',
      ratePct: brazil.pisRatePct,
      rateLabel: pct(brazil.pisRatePct),
      baseLabel: 'VA',
      amountBrl: brazil.pisBrl,
      creditable: brazil.creditPisCofins,
      creditBrl: brazil.creditPisBrl,
      netCostBrl: roundMoney(brazil.pisBrl - brazil.creditPisBrl),
      legalBasis: 'Lei 10.865/2004, art. 7º, I e art. 8º, I (STF Tema 01: base = VA)',
      creditRule: 'Creditável no Lucro Real em 48x sobre Ativo Imobilizado (Lei 10.865/04 art. 15, V e Lei 10.833/03 art. 3º, VI) ou integral via CBS (LC 214/2025)',
    },
    {
      key: 'cofins',
      label: 'COFINS-Importação (Base)',
      ratePct: brazil.cofinsBaseRatePct,
      rateLabel: pct(brazil.cofinsBaseRatePct),
      baseLabel: 'VA',
      amountBrl: brazil.cofinsBaseBrl,
      creditable: brazil.creditPisCofins,
      creditBrl: brazil.creditCofinsBrl,
      netCostBrl: roundMoney(brazil.cofinsBaseBrl - brazil.creditCofinsBrl),
      legalBasis: 'Lei 10.865/2004, art. 8º, II (alíquota modal sobre o VA)',
      creditRule: 'Creditável junto com o PIS (total 11,75% s/ VA) no Lucro Real em 48x ou integral via CBS',
    },
    {
      key: 'cofinsAdd',
      label: 'Adicional COFINS-Importação (2026)',
      ratePct: brazil.cofinsAddRatePct,
      rateLabel: pct(brazil.cofinsAddRatePct),
      baseLabel: 'VA',
      amountBrl: brazil.cofinsAddBrl,
      creditable: false,
      creditBrl: 0,
      netCostBrl: brazil.cofinsAddBrl,
      legalBasis: 'Lei 10.865/2004, art. 8º, § 21 c/c Anexo I da Lei 12.546/2011 e Lei 14.973/2024 (cronograma 2026: 0,60%)',
      creditRule: 'NÃO creditável por vedação expressa do art. 15, § 1º-A da Lei 10.865/2004 (custo definitivo)',
    },
  ];
  if (brazil.customsExpensesBrl > 0) {
    lines.push({
      key: 'customs',
      label: 'Despesas aduaneiras / Siscomex / AFRMM',
      ratePct: brazil.customsExpensesPct,
      rateLabel: pct(brazil.customsExpensesPct),
      baseLabel: 'VA',
      amountBrl: brazil.customsExpensesBrl,
      creditable: false,
      creditBrl: 0,
      netCostBrl: brazil.customsExpensesBrl,
      legalBasis: 'Premissa de despacho: taxa Siscomex, AFRMM, armazenagem e despachante (entram na base do ICMS)',
      creditRule: 'Não creditável neste cálculo (custo de aquisição)',
    });
  }
  lines.push({
    key: 'icms',
    label: 'ICMS-Importação ("por dentro")',
    ratePct: brazil.icmsRatePct,
    rateLabel: `${formatFlex(brazil.icmsRatePct, 2)}%`,
    baseLabel: '(VA + II + IPI + PIS + COFINS + Desp.) ÷ (1 − ICMS)',
    amountBrl: brazil.icmsBrl,
    creditable: brazil.creditIcms && brazil.icmsCreditFactorPct > 0,
    creditBrl: brazil.creditIcmsBrl,
    netCostBrl: roundMoney(brazil.icmsBrl - brazil.creditIcmsBrl),
    legalBasis: 'RICMS/SP arts. 37, IV e 49 · Convênio ICMS 52/91, Anexo I, Subitem 62.7 (NCM 8479.89.99 BK = 8,80% em SP; sem convênio = 18%)',
    creditRule: 'Creditável em 48x no CIAP (LC 87/96, art. 20, § 5º) na proporção das saídas tributadas da farmácia, ou 100% via IBS; 0% p/ locadora pura (Súmula Vinculante 31)',
  });
  return lines;
}

function widthFor(config, ref) {
  if (ref === 'compact') return config.widthCompact;
  if (ref === 'direct') return config.widthDirect;
  return config.widthSam;
}

/** Folga abaixo da qual a medida aparece como apertada (âmbar). */
export const TIGHT_MARGIN_M = 0.1;

/**
 * Confere uma configuração contra a sala. Medida vazia não restringe. O comprimento soma o 2º braço quando
 * ele está marcado. status: 'ok' | 'tight' | 'over' | 'free'.
 */
export function fitsRoom(config, raw = {}) {
  const input = sanitize({ ...raw, heightM: config.heightM, widthSam: config.widthSam, classId: config.classId });
  const lengthM = roundM(config.lengthM + (input.secondGripper ? OPTIONS.secondGripperLengthM : 0));
  const check = (dim, need, limit) => {
    if (limit == null) return { dim, need, limit, marginM: null, ok: true, status: 'free' };
    const marginM = roundM(limit - need);
    const ok = marginM >= 0;
    return { dim, need, limit, marginM, ok, status: !ok ? 'over' : marginM < TIGHT_MARGIN_M ? 'tight' : 'ok' };
  };
  const checks = [
    check('height', config.heightM, input.roomHeightM),
    check('width', widthFor(config, input.roomWidthRef), input.roomWidthM),
    check('length', lengthM, input.roomLengthM),
  ];
  const capacityOk = input.minCapacity == null || config.capacityPacks >= input.minCapacity;
  const roomOk = checks.every((item) => item.ok);
  return { fits: roomOk && capacityOk, roomOk, capacityOk, checks, lengthM, widthRef: input.roomWidthRef };
}

/**
 * Filtro reverso: das 286 configurações, quais cabem na sala e entregam a capacidade mínima. Com os mesmos
 * opcionais para todas, o mais barato é o de menor preço de tabela. Empates: menor área, depois maior capacidade.
 */
export function findSpace(raw = {}) {
  const input = sanitize(raw);
  const matches = CONFIGURATIONS.filter((config) => fitsRoom(config, input).fits).map((config) => quoteRobot(config, input));
  const pick = (compare) => (matches.length ? [...matches].sort(compare)[0] : null);
  const byPrice = (a, b) => a.orderEur - b.orderEur || a.footprintM2 - b.footprintM2 || b.capacityPacks - a.capacityPacks;
  return {
    active: input.roomFilterOn,
    total: CONFIGURATIONS.length,
    count: matches.length,
    matches,
    matchIds: new Set(matches.map((quote) => quote.config.id)),
    cheapest: pick(byPrice),
    smallest: pick((a, b) => a.footprintM2 - b.footprintM2 || byPrice(a, b)),
    largest: pick((a, b) => b.capacityPacks - a.capacityPacks || byPrice(a, b)),
  };
}

/** Faixa do bônus para uma contagem acumulada de robôs pedidos. */
export function volumeBonusPct(count) {
  let pct = 0;
  for (const tier of VOLUME_TIERS) {
    if (count >= tier.from) pct = tier.pct;
  }
  return pct;
}

/** Robô a partir do qual vale a próxima faixa, ou null na faixa máxima. */
export function nextTier(count) {
  return VOLUME_TIERS.find((tier) => tier.from > count && tier.pct > volumeBonusPct(count)) ?? null;
}

/**
 * Bônus robô a robô (slides 11 e 12). Cada robô é faturado com a faixa vigente no pedido, a dos robôs já
 * pedidos antes dele. Quando o robô r alcança uma faixa nova, a nota de crédito leva todos os robôs até r à
 * faixa nova: crédito = faixa nova × volume acumulado − bônus já concedido (faturas + notas anteriores).
 * Entrada: lista de pedidos { eur, year } ou números. Tudo em centavos.
 */
export function bonusLedger(orders = []) {
  const robots = [];
  const milestones = [];
  let cumulativeCents = 0;
  let bonusToDateCents = 0;
  let bandInvoiceCents = 0;
  orders.forEach((order, index) => {
    const robot = index + 1;
    const eur = typeof order === 'number' ? order : order.eur;
    const year = typeof order === 'number' ? null : order.year ?? null;
    const grossCents = toCents(eur);
    const invoicePct = volumeBonusPct(robot - 1);
    const invoiceBonusCents = Math.round((grossCents * invoicePct) / 100);
    cumulativeCents += grossCents;
    bonusToDateCents += invoiceBonusCents;
    bandInvoiceCents += invoiceBonusCents;
    const levelPct = volumeBonusPct(robot);
    let creditNoteCents = 0;
    if (levelPct > invoicePct) {
      creditNoteCents = Math.round((cumulativeCents * levelPct) / 100) - bonusToDateCents;
      bonusToDateCents += creditNoteCents;
      milestones.push({
        robot,
        year,
        fromPct: invoicePct,
        toPct: levelPct,
        bandInvoiceBonusCents: bandInvoiceCents,
        creditNoteCents,
        cumulativeCents,
        bonusToDateCents,
      });
      bandInvoiceCents = 0;
    }
    robots.push({
      robot,
      year,
      grossCents,
      invoicePct,
      invoiceBonusCents,
      invoiceNetCents: grossCents - invoiceBonusCents,
      levelPct,
      creditNoteCents,
      cumulativeCents,
      bonusToDateCents,
    });
  });
  return {
    robots,
    milestones,
    count: robots.length,
    grossCents: cumulativeCents,
    bonusCents: bonusToDateCents,
    netCents: cumulativeCents - bonusToDateCents,
    finalPct: volumeBonusPct(robots.length),
  };
}

/**
 * Linhas no formato do slide 12, uma por faixa. Cada faixa vai do robô seguinte ao marco anterior até o
 * próprio marco; a última ("101 e mais") fatura 8% direto. Faixa não alcançada fica com reached = false.
 */
export function milestoneTable(ledger) {
  const marks = VOLUME_TIERS.filter((tier) => tier.pct > 0);
  const rows = marks.map((tier, index) => {
    const from = index === 0 ? 1 : marks[index - 1].from + 1;
    const hit = ledger.milestones.find((item) => item.robot === tier.from) ?? null;
    return {
      from,
      to: tier.from,
      invoicePct: index === 0 ? 0 : marks[index - 1].pct,
      levelPct: tier.pct,
      reached: hit != null,
      missing: Math.max(0, tier.from - ledger.count),
      year: hit?.year ?? null,
      bandInvoiceBonusCents: hit?.bandInvoiceBonusCents ?? null,
      creditNoteCents: hit?.creditNoteCents ?? null,
      cumulativeCents: hit?.cumulativeCents ?? null,
      bonusToDateCents: hit?.bonusToDateCents ?? null,
      effectivePct: hit ? (hit.bonusToDateCents / hit.cumulativeCents) * 100 : null,
    };
  });
  const top = marks[marks.length - 1];
  const beyond = ledger.robots.filter((robot) => robot.robot > top.from);
  rows.push({
    from: top.from + 1,
    to: null,
    invoicePct: top.pct,
    levelPct: top.pct,
    reached: beyond.length > 0,
    missing: Math.max(0, top.from + 1 - ledger.count),
    robots: beyond.length,
    bandInvoiceBonusCents: beyond.reduce((sum, robot) => sum + robot.invoiceBonusCents, 0),
    creditNoteCents: 0,
  });
  return rows;
}

/** Fator de preço por ano do contrato: anos 1 e 2 fixos, depois o VPI composto. */
export function yearMultipliers(inflationPct) {
  const rate = num(inflationPct, DEFAULTS.germanInflationPct) / 100;
  return Array.from({ length: AGREEMENT.years }, (_, index) =>
    index < AGREEMENT.fixedYears ? 1 : (1 + rate) ** (index + 1 - AGREEMENT.fixedYears),
  );
}

/** Divide um total de robôs pelos 5 anos, o resto nos primeiros anos. */
export function distributeRobots(total) {
  const count = Math.max(0, Math.round(num(total, 0)));
  const base = Math.floor(count / AGREEMENT.years);
  const extra = count % AGREEMENT.years;
  return Array.from({ length: AGREEMENT.years }, (_, index) => base + (index < extra ? 1 : 0));
}

/**
 * Rollout de 5 anos. Todo robô do ano y custa o pedido por robô × fator do ano y (VPI a partir do 3º).
 * Os pedidos são sequenciais, ano a ano. A nota de crédito entra no ano em que a faixa é alcançada.
 */
export function rollout(raw = {}, unitOrderEur) {
  const input = sanitize(raw);
  const multipliers = yearMultipliers(input.germanInflationPct);
  const counts = YEAR_KEYS.map((key) => input[key]);
  const orders = [];
  const unitByYear = multipliers.map((factor) => roundMoney(unitOrderEur * factor));
  counts.forEach((robots, index) => {
    for (let item = 0; item < robots; item += 1) orders.push({ eur: unitByYear[index], year: index + 1 });
  });
  const ledger = bonusLedger(orders);
  let cumulative = 0;
  const years = counts.map((robots, index) => {
    const year = index + 1;
    const rows = ledger.robots.filter((robot) => robot.year === year);
    cumulative += robots;
    const grossCents = rows.reduce((sum, robot) => sum + robot.grossCents, 0);
    const invoiceBonusCents = rows.reduce((sum, robot) => sum + robot.invoiceBonusCents, 0);
    const creditNoteCents = rows.reduce((sum, robot) => sum + robot.creditNoteCents, 0);
    const bonusCents = invoiceBonusCents + creditNoteCents;
    const netCents = grossCents - bonusCents;
    const net = netCents / 100;
    return {
      year,
      robots,
      cumulative,
      multiplier: multipliers[index],
      unitGrossEur: unitByYear[index],
      grossCents,
      invoiceBonusCents,
      creditNoteCents,
      bonusCents,
      netCents,
      bonusToDateCents: rows.length ? rows[rows.length - 1].bonusToDateCents : null,
      tierPct: volumeBonusPct(cumulative),
      grossBrl: roundMoney((grossCents / 100) * input.fxRate),
      netBrl: roundMoney(net * input.fxRate),
      netLandedBrl: brazilCost(net, input).netBrl,
      milestones: ledger.milestones.filter((item) => item.year === year).map((item) => item.robot),
    };
  });
  const totalRobots = ledger.count;
  const bonus = ledger.bonusCents / 100;
  const net = ledger.netCents / 100;
  return {
    multipliers,
    unitByYear,
    years,
    ledger,
    milestones: milestoneTable(ledger),
    totalRobots,
    finalTierPct: ledger.finalPct,
    next: nextTier(totalRobots),
    gross: ledger.grossCents / 100,
    bonus,
    net,
    bonusBrl: roundMoney(bonus * input.fxRate),
    netBrl: roundMoney(net * input.fxRate),
    netLandedBrl: brazilCost(net, input).netBrl,
    effectivePct: ledger.grossCents > 0 ? (ledger.bonusCents / ledger.grossCents) * 100 : 0,
    avgGrossEur: totalRobots ? ledger.grossCents / 100 / totalRobots : null,
    avgNetEur: totalRobots ? net / totalRobots : null,
  };
}

const TIER_LABELS = ['1 a 9 robôs', '10 a 24 robôs', '25 a 49 robôs', '50 a 99 robôs', '100+ robôs'];

/**
 * Tabela das faixas de desconto por volume para um pedido Gollmann bruto por robô (equipamento, opcionais e
 * transporte e instalação). Cada faixa traz o preço unitário com o desconto, o total no Brasil com os serviços
 * locais e a nota de crédito retroativa do marco (slide 12). O resumo é o da quantidade escolhida.
 */
export function volumeTiersTable(unitOrderEur, raw = {}) {
  const input = sanitize(raw);
  const ledger = bonusLedger(Array.from({ length: 100 }, () => unitOrderEur));
  const tiers = VOLUME_TIERS.map((tier, index) => {
    const next = VOLUME_TIERS[index + 1];
    const milestone = ledger.milestones.find((item) => item.robot === tier.from);
    const unitDiscountEur = roundMoney(unitOrderEur * (tier.pct / 100));
    const unitNetEur = roundMoney(unitOrderEur - unitDiscountEur);
    const brazil = brazilCost(unitNetEur, input);
    const creditNoteEur = tier.pct === 0 || !milestone ? 0 : milestone.creditNoteCents / 100;
    return {
      from: tier.from,
      to: next ? next.from - 1 : null,
      rangeLabel: TIER_LABELS[index],
      pct: tier.pct,
      active: tier.pct === volumeBonusPct(input.fleetRobots),
      unitGrossEur: unitOrderEur,
      unitDiscountEur,
      unitDiscountBrl: roundMoney(unitDiscountEur * input.fxRate),
      unitNetEur,
      unitNetBrl: roundMoney(unitNetEur * input.fxRate),
      unitLandedBrl: brazil.landedBrl,
      unitTotalGrossBrl: roundMoney(brazil.landedBrl + input.localServicesBrl),
      unitTotalNetBrl: roundMoney(brazil.netBrl + input.localServicesBrl),
      creditNoteEur,
      creditNoteBrl: roundMoney(creditNoteEur * input.fxRate),
      bonusToDateEur: tier.pct === 0 || !milestone ? 0 : milestone.bonusToDateCents / 100,
    };
  });
  const count = input.fleetRobots;
  const pct = volumeBonusPct(count);
  const row = tiers.find((tier) => tier.pct === pct);
  return {
    count,
    pct,
    next: nextTier(count),
    unitGrossEur: row.unitGrossEur,
    unitDiscountEur: row.unitDiscountEur,
    unitDiscountBrl: row.unitDiscountBrl,
    unitNetEur: row.unitNetEur,
    unitNetBrl: row.unitNetBrl,
    unitTotalGrossBrl: row.unitTotalGrossBrl,
    unitTotalNetBrl: row.unitTotalNetBrl,
    fleetGrossEur: roundMoney(row.unitGrossEur * count),
    fleetDiscountEur: roundMoney(row.unitDiscountEur * count),
    fleetDiscountBrl: roundMoney(row.unitDiscountBrl * count),
    fleetNetEur: roundMoney(row.unitNetEur * count),
    fleetTotalGrossBrl: roundMoney(row.unitTotalGrossBrl * count),
    fleetTotalNetBrl: roundMoney(row.unitTotalNetBrl * count),
    tiers,
  };
}

/** Rótulo de uma configuração: "2,95 m × 3,20 m · Robô L". O idioma só troca a palavra e a pontuação. */
export function configLabel(config, locale = 'pt-BR') {
  const loc = intlLocale(locale);
  const robot = { 'en-US': 'Robot', 'de-DE': 'Roboter', 'es-ES': 'Robot' }[loc] ?? 'Robô';
  return `${formatMeters(config.heightM, loc)} × ${formatMeters(config.widthSam, loc)} · ${robot} ${config.classId}`;
}

/**
 * Conta inteira. keep diz qual seletor o usuário mexeu por último, para a troca automática preservar esse
 * campo quando a combinação não existe na tabela.
 */
export function evaluate(raw = {}, keep = null) {
  const input = sanitize(raw);
  const selection = resolveSelection(input, keep);
  const chosen = { ...input, heightM: selection.heightM, widthSam: selection.widthSam, classId: selection.classId };
  const quote = quoteRobot(selection.config, chosen);
  const fx = (eur) => roundMoney(eur * chosen.fxRate);
  const brazilGrossOrder = brazilCost(quote.orderEur, chosen);
  const brazil = brazilCost(quote.netOrderEur, chosen);
  const totalGrossBrl = roundMoney(brazil.landedBrl + quote.localServicesBrl);
  const totalNetBrl = roundMoney(brazil.netBrl + quote.localServicesBrl);
  // Equivalente em euro do Preço Total Bruto, já com os impostos de importação.
  const totalEurApprox = roundMoney(totalGrossBrl / chosen.fxRate);
  return {
    ...chosen,
    selection,
    quote,
    brazilGrossOrder,
    brazil,
    brl: {
      baseRobot: fx(quote.baseRobotEur),
      autoLoading: fx(quote.autoLoadingEur),
      sam: fx(quote.samEur),
      tablePrice: fx(quote.tablePriceEur),
      secondGripper: fx(quote.secondGripperEur),
      cooling: fx(quote.coolingEur),
      conveyor: fx(quote.conveyorEur),
      options: fx(quote.optionsEur),
      equipment: fx(quote.equipmentEur),
      services: fx(quote.servicesEur),
      order: fx(quote.orderEur),
      discount: fx(quote.discountEur),
      netOrder: brazil.grossBrl,
      localServices: quote.localServicesBrl,
      totalGross: totalGrossBrl,
      totalNet: totalNetBrl,
    },
    totalGrossBrl,
    totalNetBrl,
    totalEurApprox,
    brlPerPack: totalNetBrl / quote.capacityPacks,
    room: fitsRoom(selection.config, chosen),
    space: findSpace(chosen),
    volume: volumeTiersTable(quote.orderEur, chosen),
  };
}

function eur(value) {
  return formatEUR(value);
}

function brl(value) {
  return formatBRL(value);
}

function pct(value) {
  return `${formatFlex(value, 2)}%`;
}

const DIM_LABELS = { height: 'Pé-direito', width: 'Largura', length: 'Comprimento' };

/** Sem locale, a memória continua em português. en, de e es traduzem o texto e a pontuação. */
export function explain(result, locale = 'pt-BR') {
  const loc = intlLocale(locale);
  if (loc === 'en-US') return explainEn(result);
  if (loc === 'de-DE') return explainDe(result);
  if (loc === 'es-ES') return explainEs(result);
  return explainPt(result);
}

function explainPt(result) {
  const { quote, brazil, selection, volume, room, space } = result;
  const cls = classOf(quote.classId);
  const range = classPriceRange(quote.classId);
  const changedText = selection.changed.length
    ? `A combinação pedida (${formatMeters(selection.requested.heightM)} × ${formatMeters(selection.requested.widthSam)} · Robô ${selection.requested.classId}) não existe na tabela. A conta usa a célula válida mais próxima: ${configLabel(selection.config)}.`
    : `A combinação ${configLabel(selection.config)} existe na tabela de ${formatMeters(quote.heightM)}.`;
  const roomLines = result.roomFilterOn
    ? [
        `Sala: pé-direito ${result.roomHeightM == null ? 'livre' : formatMeters(result.roomHeightM)}, largura ${result.roomWidthM == null ? 'livre' : formatMeters(result.roomWidthM)} medida como ${WIDTH_REF_LABELS[result.roomWidthRef]}, comprimento ${result.roomLengthM == null ? 'livre' : formatMeters(result.roomLengthM)}${quote.secondGripper ? ' (já com +0,68 m do 2º braço)' : ''}, capacidade mínima ${result.minCapacity == null ? 'livre' : formatPacks(result.minCapacity)}.`,
        `Cabem ${formatFlex(space.count)} de ${formatFlex(space.total)} configurações.${space.cheapest ? ` Mais barata: ${configLabel(space.cheapest.config)}, ${eur(space.cheapest.orderEur)}.` : ''}${space.smallest ? ` Menor área: ${configLabel(space.smallest.config)}, ${formatFixed(space.smallest.footprintM2, 2)} m².` : ''}${space.largest ? ` Maior capacidade: ${configLabel(space.largest.config)}, ${formatPacks(space.largest.capacityPacks)}.` : ''}`,
        ...room.checks.map((item) =>
          item.limit == null
            ? `${DIM_LABELS[item.dim]}: sem limite.`
            : `${DIM_LABELS[item.dim]}: robô ${formatMeters(item.need)} na sala de ${formatMeters(item.limit)}, folga ${formatMeters(item.marginM)}${item.ok ? '' : ' — não cabe'}.`,
        ),
      ]
    : ['Filtro da sala desligado. Ligue para ver quantas das 286 configurações cabem nas medidas da loja.'];
  const robots = (count) => `${formatFlex(count)} ${count === 1 ? 'robô' : 'robôs'}`;
  const servicesText =
    quote.servicesEur === AVERAGE_SERVICES_EUR
      ? `${eur(quote.servicesEur)}, a média padrão das 7 classes`
      : `${eur(quote.servicesEur)}, valor editado (média padrão ${eur(AVERAGE_SERVICES_EUR)})`;
  const creditLines = volume.tiers
    .filter((tier) => tier.pct > 0)
    .map(
      (tier) =>
        `Marco do ${formatFlex(tier.from)}º robô: faixa ${pct(tier.pct)}, nota de crédito retroativa de ${eur(tier.creditNoteEur)} (${brl(tier.creditNoteBrl)}); desconto acumulado até ali ${eur(tier.bonusToDateEur)}.`,
    );
  return [
    {
      title: 'Modelo e dimensões',
      lines: [
        changedText,
        `Largura c/ SAM ${formatMeters(quote.widthSam)} = GO.compact ${formatMeters(quote.widthCompact)} + SAM ${formatMeters(SAM_PROTRUSION_M)}. GO.direct de referência: ${formatMeters(quote.widthDirect)}.`,
        `Linha selecionada: ${result.modelLine === 'direct' ? 'GO.direct' : 'GO.compact'}, largura física ${formatMeters(physicalWidthM(quote.widthSam, result.modelLine))}. O preço permanece o da classe ${formatMeters(quote.widthSam)} (coluna com SAM). A área e o volume exibidos usam a largura física.`,
        `Comprimento da tabela ${formatMeters(quote.tableLengthM)} = núcleo de armazenagem ${formatMeters(quote.coreLengthM)} + ${formatMeters(LENGTH_INCLUDED.manualLoadingM)} da carga manual + ${formatMeters(LENGTH_INCLUDED.speedOptionM)} da opção speed.${quote.secondGripper ? ` Com o 2º braço: + ${formatMeters(OPTIONS.secondGripperLengthM)} = ${formatMeters(quote.totalLengthM)}.` : ''}`,
        `Área = ${formatMeters(quote.widthSam)} × ${formatMeters(quote.totalLengthM)} = ${formatFixed(quote.footprintM2, 2)} m². Volume = área × ${formatMeters(quote.heightM)} = ${formatFixed(quote.volumeM3, 2)} m³. Capacidade garantida: ${formatPacks(quote.capacityPacks)} (classe ${cls.id}, aprox. ${formatPacks(cls.approxPacks)}).`,
      ],
    },
    {
      title: 'Preço do robô (tabela)',
      lines: [
        `Preço de tabela ${eur(quote.tablePriceEur)}. Na classe ${cls.id} a tabela vai de ${eur(range.min)} a ${eur(range.max)} em ${formatFlex(range.count)} células; o slide 4 diz "a partir de ${eur(cls.fromEur)}".`,
        `Robô base = ${eur(quote.tablePriceEur)} − ${eur(PRICE_BUILD_UP.bundledEur)} = ${eur(quote.baseRobotEur)}. + Carga automática com OCR e carga manual ${eur(quote.autoLoadingEur)} + SAM com 4 saídas ${eur(quote.samEur)} = ${eur(quote.robotPriceEur)}.`,
      ],
    },
    {
      title: 'Opcionais e serviços (separados)',
      lines: [
        `Opcionais: 2º braço com 2º SAM ${quote.secondGripper ? eur(quote.secondGripperEur) : 'não'}, refrigeração ${quote.coolingModule ? eur(quote.coolingEur) : 'não'}, esteiras ${eur(quote.conveyorEur)}. Subtotal de opcionais ${eur(quote.optionsEur)}; robô + opcionais = ${eur(quote.equipmentEur)}.`,
        `Transporte e instalação: ${servicesText}. Na tabela do slide 8 a classe ${cls.id} custa ${eur(quote.classServicesEur)} (de ${eur(18000)} no S a ${eur(27000)} no 4XL).`,
        `Pedido Gollmann bruto por robô = ${eur(quote.equipmentEur)} + ${eur(quote.servicesEur)} = ${eur(quote.orderEur)}. É a base do desconto por volume.`,
        `Serviços locais faturados no Brasil: ${brl(quote.localServicesBrl)} (≈ ${eur(quote.localServicesEurApprox)} pelo câmbio). Ficam fora do pedido em euro, da nacionalização e do crédito.`,
      ],
    },
    {
      title: 'Desconto por volume',
      lines: [
        `Faixas do acordo pela quantidade de robôs: 0% de 1 a 9, 2% de 10 a 24, 4% de 25 a 49, 6% de 50 a 99 e 8% a partir de 100.`,
        `Com ${robots(volume.count)}: faixa de ${pct(quote.discountPct)}. Desconto = ${pct(quote.discountPct)} × ${eur(quote.orderEur)} = ${eur(quote.discountEur)} por robô. Pedido Gollmann líquido ${eur(quote.netOrderEur)}.${volume.next ? ` Faltam ${robots(volume.next.from - volume.count)} para ${pct(volume.next.pct)}.` : ' Faixa máxima.'}`,
        `Frota de ${robots(volume.count)}: bruto ${eur(volume.fleetGrossEur)}, desconto ${eur(volume.fleetDiscountEur)}, líquido ${eur(volume.fleetNetEur)}; Preço Total no Brasil ${brl(volume.fleetTotalGrossBrl)}.`,
        `Cada robô sai com a faixa vigente no pedido. Ao alcançar 10, 25, 50 e 100 robôs, a nota de crédito leva todos os robôs pedidos até ali à faixa nova:`,
        ...creditLines,
      ],
    },
    {
      title: `Custo Brasil (NCM ${NCM_INFO.code}) e Preço Total`,
      lines: [
        `Valor Aduaneiro (VA) = pedido Gollmann líquido ${eur(quote.netOrderEur)} × câmbio ${formatFlex(brazil.fxRate, 4)} = ${brl(brazil.vaBrl)}.`,
        brazil.exTarifario
          ? `Ex-Tarifário ligado: II = 0% sobre o VA = ${brl(brazil.iiBrl)} (sem ele seriam ${pct(brazil.iiRatePct)}).`
          : `Ex-Tarifário desligado: II = ${pct(brazil.effectiveIiPct)} × ${brl(brazil.vaBrl)} = ${brl(brazil.iiBrl)}, custo definitivo sem crédito.`,
        `IPI = ${pct(brazil.ipiRatePct)} × (VA + II) ${brl(brazil.ipiBaseBrl)} = ${brl(brazil.ipiBrl)}. PIS-Importação = ${pct(brazil.pisRatePct)} × VA = ${brl(brazil.pisBrl)}. COFINS-Importação = base ${pct(brazil.cofinsBaseRatePct)} (${brl(brazil.cofinsBaseBrl)}) + adicional de 2026 ${pct(brazil.cofinsAddRatePct)} (${brl(brazil.cofinsAddBrl)}) = ${pct(brazil.cofinsRatePct)}, ${brl(brazil.cofinsBrl)}.`,
        `Despesas aduaneiras / Siscomex / AFRMM = ${pct(brazil.customsExpensesPct)} × VA = ${brl(brazil.customsExpensesBrl)}.`,
        `ICMS-Importação por dentro (${pct(brazil.icmsRatePct)}${brazil.convenioIcms5291 ? ', Convênio ICMS 52/91' : ', alíquota cheia de SP'}): base = ${brl(brazil.icmsNumeratorBrl)} ÷ (1 − ${pct(brazil.icmsRatePct)}) = ${brl(brazil.icmsBaseBrl)}; ICMS = ${brl(brazil.icmsBrl)}.`,
        `Total de impostos de importação ${brl(brazil.importBrl)} (${pct(brazil.effectiveImportPct)} efetivo sobre o VA). Custo nacionalizado = VA + impostos = ${brl(brazil.landedBrl)}.`,
        `Preço Total Bruto = ${brl(brazil.landedBrl)} + serviços locais ${brl(quote.localServicesBrl)} = ${brl(result.totalGrossBrl)} (≈ ${eur(result.totalEurApprox)}).`,
        brazil.creditPisCofins
          ? `Crédito PIS + COFINS base = ${pct(brazil.pisRatePct + brazil.cofinsBaseRatePct)} sobre o VA = ${brl(brazil.creditPisCofinsBrl)}. O adicional de ${pct(brazil.cofinsAddRatePct)} da COFINS (${brl(brazil.cofinsAddBrl)}) não gera crédito (Lei 10.865/2004, art. 15, § 1º-A).`
          : `Crédito de PIS + COFINS desligado. O adicional de ${pct(brazil.cofinsAddRatePct)} da COFINS (${brl(brazil.cofinsAddBrl)}) nunca gera crédito.`,
        brazil.creditIcms
          ? `Crédito de ICMS = ${pct(brazil.icmsCreditFactorPct)} × ${brl(brazil.icmsBrl)} = ${brl(brazil.creditIcmsBrl)}.`
          : 'Crédito de ICMS desligado.',
        `Créditos ${brl(brazil.creditBrl)}; custo tributário não recuperável ${brl(brazil.nonRecoverableBrl)} (${pct(brazil.effectiveNetTaxPct)} do VA). Investimento Líquido Pós-Créditos = ${brl(result.totalGrossBrl)} − ${brl(brazil.creditBrl)} = ${brl(result.totalNetBrl)}, ou ${brl(result.brlPerPack)} por pacote de capacidade.`,
      ],
    },
    { title: 'Espaço da loja', lines: roomLines },
  ];
}

function explainEn(result) {
  const loc = 'en-US';
  const eur = (value) => formatEUR(value, loc);
  const brl = (value) => formatBRL(value, loc);
  const pct = (value) => `${formatFlex(value, 2, loc)}%`;
  const meters = (value) => formatMeters(value, loc);
  const packs = (value) => formatPacks(value, loc);
  const flex = (value, digits = 2) => formatFlex(value, digits, loc);
  const cfg = (config) => configLabel(config, loc);
  const any = 'any';
  const { quote, brazil, selection, volume, room, space } = result;
  const cls = classOf(quote.classId);
  const range = classPriceRange(quote.classId);
  const widthName = { sam: 'GO.compact w/ SAM', compact: 'GO.compact', direct: 'GO.direct' }[result.roomWidthRef];
  const dims = { height: 'Ceiling height', width: 'Width', length: 'Length' };
  const changedText = selection.changed.length
    ? `The requested combination (${meters(selection.requested.heightM)} × ${meters(selection.requested.widthSam)} · Robot ${selection.requested.classId}) is not in the table. The calculation uses the nearest valid cell: ${cfg(selection.config)}.`
    : `The combination ${cfg(selection.config)} exists in the ${meters(quote.heightM)} table.`;
  const roomLines = result.roomFilterOn
    ? [
        `Room: ceiling ${result.roomHeightM == null ? any : meters(result.roomHeightM)}, width ${result.roomWidthM == null ? any : meters(result.roomWidthM)} measured as ${widthName}, length ${result.roomLengthM == null ? any : meters(result.roomLengthM)}${quote.secondGripper ? ' (already including +0.68 m for the 2nd arm)' : ''}, minimum capacity ${result.minCapacity == null ? any : packs(result.minCapacity)}.`,
        `${flex(space.count, 0)} of ${flex(space.total, 0)} configurations fit.${space.cheapest ? ` Cheapest: ${cfg(space.cheapest.config)}, ${eur(space.cheapest.orderEur)}.` : ''}${space.smallest ? ` Smallest footprint: ${cfg(space.smallest.config)}, ${formatFixed(space.smallest.footprintM2, 2, loc)} m².` : ''}${space.largest ? ` Highest capacity: ${cfg(space.largest.config)}, ${packs(space.largest.capacityPacks)}.` : ''}`,
        ...room.checks.map((item) =>
          item.limit == null
            ? `${dims[item.dim]}: no limit.`
            : `${dims[item.dim]}: robot ${meters(item.need)} in a room of ${meters(item.limit)}, clearance ${meters(item.marginM)}${item.ok ? '' : ' — does not fit'}.`,
        ),
      ]
    : ['Room filter is off. Turn it on to see how many of the 286 configurations fit the store.'];
  const robots = (count) => `${flex(count, 0)} ${count === 1 ? 'robot' : 'robots'}`;
  const servicesText =
    quote.servicesEur === AVERAGE_SERVICES_EUR
      ? `${eur(quote.servicesEur)}, the standard average of the 7 classes`
      : `${eur(quote.servicesEur)}, edited value (standard average ${eur(AVERAGE_SERVICES_EUR)})`;
  const creditLines = volume.tiers
    .filter((tier) => tier.pct > 0)
    .map(
      (tier) =>
        `Milestone at robot ${flex(tier.from, 0)}: tier ${pct(tier.pct)}, retroactive credit note of ${eur(tier.creditNoteEur)} (${brl(tier.creditNoteBrl)}); discount accumulated up to that point ${eur(tier.bonusToDateEur)}.`,
    );
  return [
    {
      title: 'Model and dimensions',
      lines: [
        changedText,
        `Width w/ SAM ${meters(quote.widthSam)} = GO.compact ${meters(quote.widthCompact)} + SAM ${meters(SAM_PROTRUSION_M)}. GO.direct reference: ${meters(quote.widthDirect)}.`,
        `Selected line: ${result.modelLine === 'direct' ? 'GO.direct' : 'GO.compact'}, physical width ${meters(physicalWidthM(quote.widthSam, result.modelLine))}. The price stays on class ${meters(quote.widthSam)} (column including SAM). The displayed area and volume use the physical width.`,
        `Table length ${meters(quote.tableLengthM)} = storage core ${meters(quote.coreLengthM)} + ${meters(LENGTH_INCLUDED.manualLoadingM)} manual loading + ${meters(LENGTH_INCLUDED.speedOptionM)} speed option.${quote.secondGripper ? ` With the 2nd arm: + ${meters(OPTIONS.secondGripperLengthM)} = ${meters(quote.totalLengthM)}.` : ''}`,
        `Area = ${meters(quote.widthSam)} × ${meters(quote.totalLengthM)} = ${formatFixed(quote.footprintM2, 2, loc)} m². Volume = area × ${meters(quote.heightM)} = ${formatFixed(quote.volumeM3, 2, loc)} m³. Guaranteed capacity: ${packs(quote.capacityPacks)} (class ${cls.id}, approx. ${packs(cls.approxPacks)}).`,
      ],
    },
    {
      title: 'Robot price (table)',
      lines: [
        `Table price ${eur(quote.tablePriceEur)}. In class ${cls.id} the table runs from ${eur(range.min)} to ${eur(range.max)} across ${flex(range.count, 0)} cells; slide 4 says "from ${eur(cls.fromEur)}".`,
        `Base robot = ${eur(quote.tablePriceEur)} − ${eur(PRICE_BUILD_UP.bundledEur)} = ${eur(quote.baseRobotEur)}. + Automatic loading with OCR and manual loading ${eur(quote.autoLoadingEur)} + SAM with 4 outputs ${eur(quote.samEur)} = ${eur(quote.robotPriceEur)}.`,
      ],
    },
    {
      title: 'Options and services (separate)',
      lines: [
        `Options: 2nd arm with 2nd SAM ${quote.secondGripper ? eur(quote.secondGripperEur) : 'no'}, cooling ${quote.coolingModule ? eur(quote.coolingEur) : 'no'}, conveyors ${eur(quote.conveyorEur)}. Options subtotal ${eur(quote.optionsEur)}; robot + options = ${eur(quote.equipmentEur)}.`,
        `Transport and installation: ${servicesText}. On the slide 8 table, class ${cls.id} costs ${eur(quote.classServicesEur)} (from ${eur(18000)} for S to ${eur(27000)} for 4XL).`,
        `Gross Gollmann order per robot = ${eur(quote.equipmentEur)} + ${eur(quote.servicesEur)} = ${eur(quote.orderEur)}. This is the base of the volume discount.`,
        `Local services invoiced in Brazil: ${brl(quote.localServicesBrl)} (≈ ${eur(quote.localServicesEurApprox)} at the exchange rate). They stay outside the euro order, import taxes, and credits.`,
      ],
    },
    {
      title: 'Volume discount',
      lines: [
        `Agreement tiers by robot quantity: 0% from 1 to 9, 2% from 10 to 24, 4% from 25 to 49, 6% from 50 to 99, and 8% from 100.`,
        `With ${robots(volume.count)}: tier of ${pct(quote.discountPct)}. Discount = ${pct(quote.discountPct)} × ${eur(quote.orderEur)} = ${eur(quote.discountEur)} per robot. Net Gollmann order ${eur(quote.netOrderEur)}.${volume.next ? ` ${robots(volume.next.from - volume.count)} left to reach ${pct(volume.next.pct)}.` : ' Top tier.'}`,
        `Fleet of ${robots(volume.count)}: gross ${eur(volume.fleetGrossEur)}, discount ${eur(volume.fleetDiscountEur)}, net ${eur(volume.fleetNetEur)}; total price in Brazil ${brl(volume.fleetTotalGrossBrl)}.`,
        `Each robot is invoiced at the tier in force for that order. At 10, 25, 50, and 100 robots, a credit note brings every robot ordered so far up to the new tier:`,
        ...creditLines,
      ],
    },
    {
      title: `Brazil cost (NCM ${NCM_INFO.code}) and total price`,
      lines: [
        `Customs value (VA) = net Gollmann order ${eur(quote.netOrderEur)} × exchange rate ${flex(brazil.fxRate, 4)} = ${brl(brazil.vaBrl)}.`,
        brazil.exTarifario
          ? `Ex-Tarifário on: Import Duty (II) = 0% of the customs value = ${brl(brazil.iiBrl)} (without it, it would be ${pct(brazil.iiRatePct)}).`
          : `Ex-Tarifário off: II = ${pct(brazil.effectiveIiPct)} × ${brl(brazil.vaBrl)} = ${brl(brazil.iiBrl)}, a final cost with no credit.`,
        `IPI = ${pct(brazil.ipiRatePct)} × (customs value + II) ${brl(brazil.ipiBaseBrl)} = ${brl(brazil.ipiBrl)}. PIS-Importação = ${pct(brazil.pisRatePct)} × customs value = ${brl(brazil.pisBrl)}. COFINS-Importação = base ${pct(brazil.cofinsBaseRatePct)} (${brl(brazil.cofinsBaseBrl)}) + 2026 surcharge ${pct(brazil.cofinsAddRatePct)} (${brl(brazil.cofinsAddBrl)}) = ${pct(brazil.cofinsRatePct)}, ${brl(brazil.cofinsBrl)}.`,
        `Customs expenses / Siscomex / AFRMM = ${pct(brazil.customsExpensesPct)} × customs value = ${brl(brazil.customsExpensesBrl)}.`,
        `Import ICMS grossed up (${pct(brazil.icmsRatePct)}${brazil.convenioIcms5291 ? ', Convênio ICMS 52/91' : ', full São Paulo rate'}): base = ${brl(brazil.icmsNumeratorBrl)} ÷ (1 − ${pct(brazil.icmsRatePct)}) = ${brl(brazil.icmsBaseBrl)}; ICMS = ${brl(brazil.icmsBrl)}.`,
        `Total import taxes ${brl(brazil.importBrl)} (${pct(brazil.effectiveImportPct)} effective on the customs value). Landed cost = customs value + taxes = ${brl(brazil.landedBrl)}.`,
        `Gross total price = ${brl(brazil.landedBrl)} + local services ${brl(quote.localServicesBrl)} = ${brl(result.totalGrossBrl)} (≈ ${eur(result.totalEurApprox)}).`,
        brazil.creditPisCofins
          ? `PIS + base COFINS credit = ${pct(brazil.pisRatePct + brazil.cofinsBaseRatePct)} of the customs value = ${brl(brazil.creditPisCofinsBrl)}. The COFINS surcharge of ${pct(brazil.cofinsAddRatePct)} (${brl(brazil.cofinsAddBrl)}) does not generate a credit (Law 10,865/2004, art. 15, § 1-A).`
          : `PIS + COFINS credit is off. The COFINS surcharge of ${pct(brazil.cofinsAddRatePct)} (${brl(brazil.cofinsAddBrl)}) never generates a credit.`,
        brazil.creditIcms
          ? `ICMS credit (CIAP / IBS) = ${pct(brazil.icmsCreditFactorPct)} × ${brl(brazil.icmsBrl)} = ${brl(brazil.creditIcmsBrl)}.`
          : 'ICMS credit is off.',
        `Credits ${brl(brazil.creditBrl)}; non-recoverable tax cost ${brl(brazil.nonRecoverableBrl)} (${pct(brazil.effectiveNetTaxPct)} of the customs value). Net investment after credits = ${brl(result.totalGrossBrl)} − ${brl(brazil.creditBrl)} = ${brl(result.totalNetBrl)}, or ${brl(result.brlPerPack)} per package of capacity.`,
      ],
    },
    { title: 'Store space', lines: roomLines },
  ];
}

function explainDe(result) {
  const loc = 'de-DE';
  const eur = (value) => formatEUR(value, loc);
  const brl = (value) => formatBRL(value, loc);
  const pct = (value) => `${formatFlex(value, 2, loc)}%`;
  const meters = (value) => formatMeters(value, loc);
  const packs = (value) => formatPacks(value, loc);
  const flex = (value, digits = 2) => formatFlex(value, digits, loc);
  const cfg = (config) => configLabel(config, loc);
  const any = 'frei';
  const { quote, brazil, selection, volume, room, space } = result;
  const cls = classOf(quote.classId);
  const range = classPriceRange(quote.classId);
  const widthName = { sam: 'GO.compact mit SAM', compact: 'GO.compact', direct: 'GO.direct' }[result.roomWidthRef];
  const dims = { height: 'Raumhöhe', width: 'Breite', length: 'Länge' };
  const line = result.modelLine === 'direct' ? 'GO.direct' : 'GO.compact';
  const changedText = selection.changed.length
    ? `Die gewünschte Kombination (${meters(selection.requested.heightM)} × ${meters(selection.requested.widthSam)} · Roboter ${selection.requested.classId}) steht nicht in der Tabelle. Die Rechnung nutzt die nächste gültige Zelle: ${cfg(selection.config)}.`
    : `Die Kombination ${cfg(selection.config)} steht in der Tabelle ${meters(quote.heightM)}.`;
  const roomLines = result.roomFilterOn
    ? [
        `Raum: Höhe ${result.roomHeightM == null ? any : meters(result.roomHeightM)}, Breite ${result.roomWidthM == null ? any : meters(result.roomWidthM)} gemessen als ${widthName}, Länge ${result.roomLengthM == null ? any : meters(result.roomLengthM)}${quote.secondGripper ? ' (bereits mit +0,68 m für den 2. Greifer)' : ''}, Mindestkapazität ${result.minCapacity == null ? any : packs(result.minCapacity)}.`,
        `${flex(space.count, 0)} von ${flex(space.total, 0)} Konfigurationen passen.${space.cheapest ? ` Günstigste: ${cfg(space.cheapest.config)}, ${eur(space.cheapest.orderEur)}.` : ''}${space.smallest ? ` Kleinste Fläche: ${cfg(space.smallest.config)}, ${formatFixed(space.smallest.footprintM2, 2, loc)} m².` : ''}${space.largest ? ` Höchste Kapazität: ${cfg(space.largest.config)}, ${packs(space.largest.capacityPacks)}.` : ''}`,
        ...room.checks.map((item) =>
          item.limit == null
            ? `${dims[item.dim]}: ohne Grenze.`
            : `${dims[item.dim]}: Kommissionierautomat ${meters(item.need)} im Raum von ${meters(item.limit)}, Spiel ${meters(item.marginM)}${item.ok ? '' : ' — passt nicht'}.`,
        ),
      ]
    : ['Raumfilter ist aus. Einschalten, um zu sehen, wie viele der 286 Konfigurationen in die Apotheke passen.'];
  const robots = (count) => `${flex(count, 0)} ${count === 1 ? 'Kommissionierautomat' : 'Kommissionierautomaten'}`;
  const servicesText =
    quote.servicesEur === AVERAGE_SERVICES_EUR
      ? `${eur(quote.servicesEur)}, der Standardmittelwert der 7 Klassen`
      : `${eur(quote.servicesEur)}, geänderter Wert (Standardmittelwert ${eur(AVERAGE_SERVICES_EUR)})`;
  const creditLines = volume.tiers
    .filter((tier) => tier.pct > 0)
    .map(
      (tier) =>
        `Schwelle beim ${flex(tier.from, 0)}. Kommissionierautomaten: Stufe ${pct(tier.pct)}, rückwirkende Gutschrift von ${eur(tier.creditNoteEur)} (${brl(tier.creditNoteBrl)}); bis dahin aufgelaufener Rabatt ${eur(tier.bonusToDateEur)}.`,
    );
  return [
    {
      title: 'Modell und Maße',
      lines: [
        changedText,
        `Breite mit SAM ${meters(quote.widthSam)} = GO.compact ${meters(quote.widthCompact)} + SAM ${meters(SAM_PROTRUSION_M)}. GO.direct als Referenz: ${meters(quote.widthDirect)}.`,
        `Gewählte Linie: ${line}, physische Breite ${meters(physicalWidthM(quote.widthSam, result.modelLine))}. Der Preis bleibt bei der Klasse ${meters(quote.widthSam)} (Spalte inklusive SAM). Angezeigte Fläche und Volumen nutzen die physische Breite.`,
        `Tabellenlänge ${meters(quote.tableLengthM)} = Lagerkern ${meters(quote.coreLengthM)} + ${meters(LENGTH_INCLUDED.manualLoadingM)} Handbeladung + ${meters(LENGTH_INCLUDED.speedOptionM)} Speed-Option.${quote.secondGripper ? ` Mit dem 2. Greifer: + ${meters(OPTIONS.secondGripperLengthM)} = ${meters(quote.totalLengthM)}.` : ''}`,
        `Fläche = ${meters(quote.widthSam)} × ${meters(quote.totalLengthM)} = ${formatFixed(quote.footprintM2, 2, loc)} m². Volumen = Fläche × ${meters(quote.heightM)} = ${formatFixed(quote.volumeM3, 2, loc)} m³. Garantierte Kapazität: ${packs(quote.capacityPacks)} (Klasse ${cls.id}, ca. ${packs(cls.approxPacks)}).`,
      ],
    },
    {
      title: 'Preis des Kommissionierautomaten (Tabelle)',
      lines: [
        `Tabellenpreis ${eur(quote.tablePriceEur)}. In Klasse ${cls.id} läuft die Tabelle von ${eur(range.min)} bis ${eur(range.max)} über ${flex(range.count, 0)} Zellen; Folie 4 sagt „ab ${eur(cls.fromEur)}“.`,
        `Basisautomat = ${eur(quote.tablePriceEur)} − ${eur(PRICE_BUILD_UP.bundledEur)} = ${eur(quote.baseRobotEur)}. + Automatische Beladung mit OCR und Handbeladung ${eur(quote.autoLoadingEur)} + SAM mit 4 Ausgaben ${eur(quote.samEur)} = ${eur(quote.robotPriceEur)}.`,
      ],
    },
    {
      title: 'Optionen und Leistungen (getrennt)',
      lines: [
        `Optionen: 2. Greifer mit 2. SAM ${quote.secondGripper ? eur(quote.secondGripperEur) : 'nein'}, Kühlung ${quote.coolingModule ? eur(quote.coolingEur) : 'nein'}, Fördertechnik ${eur(quote.conveyorEur)}. Optionen zusammen ${eur(quote.optionsEur)}; Automat + Optionen = ${eur(quote.equipmentEur)}.`,
        `Transport und Installation: ${servicesText}. In der Tabelle von Folie 8 kostet Klasse ${cls.id} ${eur(quote.classServicesEur)} (von ${eur(18000)} für S bis ${eur(27000)} für 4XL).`,
        `Bruttoauftrag Gollmann je Kommissionierautomat = ${eur(quote.equipmentEur)} + ${eur(quote.servicesEur)} = ${eur(quote.orderEur)}. Das ist die Basis des Mengenrabatts.`,
        `In Brasilien fakturierte lokale Leistungen: ${brl(quote.localServicesBrl)} (≈ ${eur(quote.localServicesEurApprox)} zum Wechselkurs). Sie bleiben außerhalb des Euro-Auftrags, der Einfuhrabgaben und der Gutschriften.`,
      ],
    },
    {
      title: 'Mengenrabatt',
      lines: [
        `Stufen des Vertrags nach Stückzahl: 0 % von 1 bis 9, 2 % von 10 bis 24, 4 % von 25 bis 49, 6 % von 50 bis 99 und 8 % ab 100.`,
        `Mit ${robots(volume.count)}: Stufe ${pct(quote.discountPct)}. Rabatt = ${pct(quote.discountPct)} × ${eur(quote.orderEur)} = ${eur(quote.discountEur)} je Automat. Nettoauftrag Gollmann ${eur(quote.netOrderEur)}.${volume.next ? ` Noch ${robots(volume.next.from - volume.count)} bis ${pct(volume.next.pct)}.` : ' Höchste Stufe.'}`,
        `Flotte von ${robots(volume.count)}: brutto ${eur(volume.fleetGrossEur)}, Rabatt ${eur(volume.fleetDiscountEur)}, netto ${eur(volume.fleetNetEur)}; Gesamtpreis in Brasilien ${brl(volume.fleetTotalGrossBrl)}.`,
        `Jeder Kommissionierautomat wird mit der zum Auftrag gültigen Stufe fakturiert. Bei 10, 25, 50 und 100 Automaten hebt eine Gutschrift alle bisher bestellten auf die neue Stufe:`,
        ...creditLines,
      ],
    },
    {
      title: `Brasilienkosten (NCM ${NCM_INFO.code}) und Gesamtpreis`,
      lines: [
        `Zollwert (VA) = Nettoauftrag Gollmann ${eur(quote.netOrderEur)} × Wechselkurs ${flex(brazil.fxRate, 4)} = ${brl(brazil.vaBrl)}.`,
        brazil.exTarifario
          ? `Ex-Tarifário an: Einfuhrzoll (II) = 0 % des Zollwerts = ${brl(brazil.iiBrl)} (ohne ihn wären es ${pct(brazil.iiRatePct)}).`
          : `Ex-Tarifário aus: II = ${pct(brazil.effectiveIiPct)} × ${brl(brazil.vaBrl)} = ${brl(brazil.iiBrl)}, endgültige Kosten ohne Gutschrift.`,
        `IPI = ${pct(brazil.ipiRatePct)} × (Zollwert + II) ${brl(brazil.ipiBaseBrl)} = ${brl(brazil.ipiBrl)}. PIS-Importação = ${pct(brazil.pisRatePct)} × Zollwert = ${brl(brazil.pisBrl)}. COFINS-Importação = Basis ${pct(brazil.cofinsBaseRatePct)} (${brl(brazil.cofinsBaseBrl)}) + Zuschlag 2026 ${pct(brazil.cofinsAddRatePct)} (${brl(brazil.cofinsAddBrl)}) = ${pct(brazil.cofinsRatePct)}, ${brl(brazil.cofinsBrl)}.`,
        `Zollnebenkosten / Siscomex / AFRMM = ${pct(brazil.customsExpensesPct)} × Zollwert = ${brl(brazil.customsExpensesBrl)}.`,
        `Einfuhr-ICMS von innen (${pct(brazil.icmsRatePct)}${brazil.convenioIcms5291 ? ', Convênio ICMS 52/91' : ', voller Satz São Paulo'}): Basis = ${brl(brazil.icmsNumeratorBrl)} ÷ (1 − ${pct(brazil.icmsRatePct)}) = ${brl(brazil.icmsBaseBrl)}; ICMS = ${brl(brazil.icmsBrl)}.`,
        `Einfuhrabgaben zusammen ${brl(brazil.importBrl)} (${pct(brazil.effectiveImportPct)} effektiv auf den Zollwert). Einstand = Zollwert + Abgaben = ${brl(brazil.landedBrl)}.`,
        `Brutto-Gesamtpreis = ${brl(brazil.landedBrl)} + lokale Leistungen ${brl(quote.localServicesBrl)} = ${brl(result.totalGrossBrl)} (≈ ${eur(result.totalEurApprox)}).`,
        brazil.creditPisCofins
          ? `Gutschrift PIS + COFINS-Basis = ${pct(brazil.pisRatePct + brazil.cofinsBaseRatePct)} des Zollwerts = ${brl(brazil.creditPisCofinsBrl)}. Der COFINS-Zuschlag von ${pct(brazil.cofinsAddRatePct)} (${brl(brazil.cofinsAddBrl)}) begründet keine Gutschrift (Gesetz 10.865/2004, Art. 15 § 1-A).`
          : `Gutschrift von PIS + COFINS ist aus. Der COFINS-Zuschlag von ${pct(brazil.cofinsAddRatePct)} (${brl(brazil.cofinsAddBrl)}) begründet nie eine Gutschrift.`,
        brazil.creditIcms
          ? `ICMS-Gutschrift (CIAP / IBS) = ${pct(brazil.icmsCreditFactorPct)} × ${brl(brazil.icmsBrl)} = ${brl(brazil.creditIcmsBrl)}.`
          : 'ICMS-Gutschrift ist aus.',
        `Gutschriften ${brl(brazil.creditBrl)}; nicht erstattungsfähige Steuerkosten ${brl(brazil.nonRecoverableBrl)} (${pct(brazil.effectiveNetTaxPct)} des Zollwerts). Nettoinvestition nach Gutschriften = ${brl(result.totalGrossBrl)} − ${brl(brazil.creditBrl)} = ${brl(result.totalNetBrl)}, oder ${brl(result.brlPerPack)} je Packung Kapazität.`,
      ],
    },
    { title: 'Ladenfläche', lines: roomLines },
  ];
}

function explainEs(result) {
  const loc = 'es-ES';
  const eur = (value) => formatEUR(value, loc);
  const brl = (value) => formatBRL(value, loc);
  const pct = (value) => `${formatFlex(value, 2, loc)}%`;
  const meters = (value) => formatMeters(value, loc);
  const packs = (value) => formatPacks(value, loc);
  const flex = (value, digits = 2) => formatFlex(value, digits, loc);
  const cfg = (config) => configLabel(config, loc);
  const any = 'libre';
  const { quote, brazil, selection, volume, room, space } = result;
  const cls = classOf(quote.classId);
  const range = classPriceRange(quote.classId);
  const widthName = { sam: 'GO.compact con SAM', compact: 'GO.compact', direct: 'GO.direct' }[result.roomWidthRef];
  const dims = { height: 'Altura libre', width: 'Anchura', length: 'Longitud' };
  const line = result.modelLine === 'direct' ? 'GO.direct' : 'GO.compact';
  const changedText = selection.changed.length
    ? `La combinación pedida (${meters(selection.requested.heightM)} × ${meters(selection.requested.widthSam)} · Robot ${selection.requested.classId}) no está en la tabla. El cálculo usa la celda válida más próxima: ${cfg(selection.config)}.`
    : `La combinación ${cfg(selection.config)} existe en la tabla de ${meters(quote.heightM)}.`;
  const roomLines = result.roomFilterOn
    ? [
        `Sala: altura libre ${result.roomHeightM == null ? any : meters(result.roomHeightM)}, anchura ${result.roomWidthM == null ? any : meters(result.roomWidthM)} medida como ${widthName}, longitud ${result.roomLengthM == null ? any : meters(result.roomLengthM)}${quote.secondGripper ? ' (ya con +0,68 m del 2.º brazo)' : ''}, capacidad mínima ${result.minCapacity == null ? any : packs(result.minCapacity)}.`,
        `${flex(space.count, 0)} de ${flex(space.total, 0)} configuraciones caben.${space.cheapest ? ` Más barata: ${cfg(space.cheapest.config)}, ${eur(space.cheapest.orderEur)}.` : ''}${space.smallest ? ` Menor superficie: ${cfg(space.smallest.config)}, ${formatFixed(space.smallest.footprintM2, 2, loc)} m².` : ''}${space.largest ? ` Mayor capacidad: ${cfg(space.largest.config)}, ${packs(space.largest.capacityPacks)}.` : ''}`,
        ...room.checks.map((item) =>
          item.limit == null
            ? `${dims[item.dim]}: sin límite.`
            : `${dims[item.dim]}: robot ${meters(item.need)} en una sala de ${meters(item.limit)}, holgura ${meters(item.marginM)}${item.ok ? '' : ' — no cabe'}.`,
        ),
      ]
    : ['El filtro de sala está apagado. Actívelo para ver cuántas de las 286 configuraciones caben en la farmacia.'];
  const robots = (count) => `${flex(count, 0)} ${count === 1 ? 'robot' : 'robots'}`;
  const servicesText =
    quote.servicesEur === AVERAGE_SERVICES_EUR
      ? `${eur(quote.servicesEur)}, la media estándar de las 7 clases`
      : `${eur(quote.servicesEur)}, valor editado (media estándar ${eur(AVERAGE_SERVICES_EUR)})`;
  const creditLines = volume.tiers
    .filter((tier) => tier.pct > 0)
    .map(
      (tier) =>
        `Hito en el robot ${flex(tier.from, 0)}: tramo ${pct(tier.pct)}, nota de crédito retroactiva de ${eur(tier.creditNoteEur)} (${brl(tier.creditNoteBrl)}); descuento acumulado hasta ahí ${eur(tier.bonusToDateEur)}.`,
    );
  return [
    {
      title: 'Modelo y medidas',
      lines: [
        changedText,
        `Anchura con SAM ${meters(quote.widthSam)} = GO.compact ${meters(quote.widthCompact)} + SAM ${meters(SAM_PROTRUSION_M)}. GO.direct de referencia: ${meters(quote.widthDirect)}.`,
        `Línea elegida: ${line}, anchura física ${meters(physicalWidthM(quote.widthSam, result.modelLine))}. El precio se queda en la clase ${meters(quote.widthSam)} (columna con SAM). La superficie y el volumen mostrados usan la anchura física.`,
        `Longitud de tabla ${meters(quote.tableLengthM)} = núcleo de almacén ${meters(quote.coreLengthM)} + ${meters(LENGTH_INCLUDED.manualLoadingM)} de carga manual + ${meters(LENGTH_INCLUDED.speedOptionM)} de la opción speed.${quote.secondGripper ? ` Con el 2.º brazo: + ${meters(OPTIONS.secondGripperLengthM)} = ${meters(quote.totalLengthM)}.` : ''}`,
        `Superficie = ${meters(quote.widthSam)} × ${meters(quote.totalLengthM)} = ${formatFixed(quote.footprintM2, 2, loc)} m². Volumen = superficie × ${meters(quote.heightM)} = ${formatFixed(quote.volumeM3, 2, loc)} m³. Capacidad garantizada: ${packs(quote.capacityPacks)} (clase ${cls.id}, aprox. ${packs(cls.approxPacks)}).`,
      ],
    },
    {
      title: 'Precio del robot (tabla)',
      lines: [
        `Precio de tabla ${eur(quote.tablePriceEur)}. En la clase ${cls.id} la tabla va de ${eur(range.min)} a ${eur(range.max)} en ${flex(range.count, 0)} celdas; la diapositiva 4 dice «desde ${eur(cls.fromEur)}».`,
        `Robot base = ${eur(quote.tablePriceEur)} − ${eur(PRICE_BUILD_UP.bundledEur)} = ${eur(quote.baseRobotEur)}. + Carga automática con OCR y carga manual ${eur(quote.autoLoadingEur)} + SAM con 4 salidas ${eur(quote.samEur)} = ${eur(quote.robotPriceEur)}.`,
      ],
    },
    {
      title: 'Opciones y servicios (por separado)',
      lines: [
        `Opciones: 2.º brazo con 2.º SAM ${quote.secondGripper ? eur(quote.secondGripperEur) : 'no'}, refrigeración ${quote.coolingModule ? eur(quote.coolingEur) : 'no'}, cintas ${eur(quote.conveyorEur)}. Subtotal de opciones ${eur(quote.optionsEur)}; robot + opciones = ${eur(quote.equipmentEur)}.`,
        `Transporte e instalación: ${servicesText}. En la tabla de la diapositiva 8, la clase ${cls.id} cuesta ${eur(quote.classServicesEur)} (de ${eur(18000)} en S a ${eur(27000)} en 4XL).`,
        `Pedido bruto Gollmann por robot = ${eur(quote.equipmentEur)} + ${eur(quote.servicesEur)} = ${eur(quote.orderEur)}. Es la base del descuento por volumen.`,
        `Servicios locales facturados en Brasil: ${brl(quote.localServicesBrl)} (≈ ${eur(quote.localServicesEurApprox)} al tipo de cambio). Quedan fuera del pedido en euros, de los impuestos de importación y de los créditos.`,
      ],
    },
    {
      title: 'Descuento por volumen',
      lines: [
        `Tramos del acuerdo según la cantidad de robots: 0 % de 1 a 9, 2 % de 10 a 24, 4 % de 25 a 49, 6 % de 50 a 99 y 8 % a partir de 100.`,
        `Con ${robots(volume.count)}: tramo del ${pct(quote.discountPct)}. Descuento = ${pct(quote.discountPct)} × ${eur(quote.orderEur)} = ${eur(quote.discountEur)} por robot. Pedido neto Gollmann ${eur(quote.netOrderEur)}.${volume.next ? ` Faltan ${robots(volume.next.from - volume.count)} para el ${pct(volume.next.pct)}.` : ' Tramo máximo.'}`,
        `Flota de ${robots(volume.count)}: bruto ${eur(volume.fleetGrossEur)}, descuento ${eur(volume.fleetDiscountEur)}, neto ${eur(volume.fleetNetEur)}; precio total en Brasil ${brl(volume.fleetTotalGrossBrl)}.`,
        `Cada robot se factura con el tramo vigente en ese pedido. Al llegar a 10, 25, 50 y 100 robots, una nota de crédito lleva todos los robots ya pedidos al tramo nuevo:`,
        ...creditLines,
      ],
    },
    {
      title: `Coste Brasil (NCM ${NCM_INFO.code}) y precio total`,
      lines: [
        `Valor en aduana (VA) = pedido neto Gollmann ${eur(quote.netOrderEur)} × tipo de cambio ${flex(brazil.fxRate, 4)} = ${brl(brazil.vaBrl)}.`,
        brazil.exTarifario
          ? `Ex-Tarifário activado: impuesto de importación (II) = 0 % del valor en aduana = ${brl(brazil.iiBrl)} (sin él serían ${pct(brazil.iiRatePct)}).`
          : `Ex-Tarifário desactivado: II = ${pct(brazil.effectiveIiPct)} × ${brl(brazil.vaBrl)} = ${brl(brazil.iiBrl)}, coste definitivo sin crédito.`,
        `IPI = ${pct(brazil.ipiRatePct)} × (valor en aduana + II) ${brl(brazil.ipiBaseBrl)} = ${brl(brazil.ipiBrl)}. PIS-Importação = ${pct(brazil.pisRatePct)} × valor en aduana = ${brl(brazil.pisBrl)}. COFINS-Importação = base ${pct(brazil.cofinsBaseRatePct)} (${brl(brazil.cofinsBaseBrl)}) + recargo de 2026 ${pct(brazil.cofinsAddRatePct)} (${brl(brazil.cofinsAddBrl)}) = ${pct(brazil.cofinsRatePct)}, ${brl(brazil.cofinsBrl)}.`,
        `Gastos de aduana / Siscomex / AFRMM = ${pct(brazil.customsExpensesPct)} × valor en aduana = ${brl(brazil.customsExpensesBrl)}.`,
        `ICMS de importación por dentro (${pct(brazil.icmsRatePct)}${brazil.convenioIcms5291 ? ', Convênio ICMS 52/91' : ', tipo pleno de São Paulo'}): base = ${brl(brazil.icmsNumeratorBrl)} ÷ (1 − ${pct(brazil.icmsRatePct)}) = ${brl(brazil.icmsBaseBrl)}; ICMS = ${brl(brazil.icmsBrl)}.`,
        `Impuestos de importación en total ${brl(brazil.importBrl)} (${pct(brazil.effectiveImportPct)} efectivo sobre el valor en aduana). Coste nacionalizado = valor en aduana + impuestos = ${brl(brazil.landedBrl)}.`,
        `Precio total bruto = ${brl(brazil.landedBrl)} + servicios locales ${brl(quote.localServicesBrl)} = ${brl(result.totalGrossBrl)} (≈ ${eur(result.totalEurApprox)}).`,
        brazil.creditPisCofins
          ? `Crédito de PIS + COFINS base = ${pct(brazil.pisRatePct + brazil.cofinsBaseRatePct)} del valor en aduana = ${brl(brazil.creditPisCofinsBrl)}. El recargo de COFINS del ${pct(brazil.cofinsAddRatePct)} (${brl(brazil.cofinsAddBrl)}) no genera crédito (Ley 10.865/2004, art. 15, § 1-A).`
          : `El crédito de PIS + COFINS está desactivado. El recargo de COFINS del ${pct(brazil.cofinsAddRatePct)} (${brl(brazil.cofinsAddBrl)}) nunca genera crédito.`,
        brazil.creditIcms
          ? `Crédito de ICMS (CIAP / IBS) = ${pct(brazil.icmsCreditFactorPct)} × ${brl(brazil.icmsBrl)} = ${brl(brazil.creditIcmsBrl)}.`
          : 'El crédito de ICMS está desactivado.',
        `Créditos ${brl(brazil.creditBrl)}; coste tributario no recuperable ${brl(brazil.nonRecoverableBrl)} (${pct(brazil.effectiveNetTaxPct)} del valor en aduana). Inversión neta tras créditos = ${brl(result.totalGrossBrl)} − ${brl(brazil.creditBrl)} = ${brl(result.totalNetBrl)}, o ${brl(result.brlPerPack)} por paquete de capacidad.`,
      ],
    },
    { title: 'Espacio de la tienda', lines: roomLines },
  ];
}
