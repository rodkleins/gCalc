/**
 * Modelos GO.compact e acordo-quadro Gollmann × DPSP. Dados da apresentação de 21.10.2026:
 * slides 4 e 8 (classes e serviços), 5 a 7 (composição do preço e opcionais), 10 a 12 (prazo, VPI e bônus)
 * e 14 a 23 (uma tabela por altura). Tudo fica embutido aqui: a página não busca nada em tempo de execução.
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

export function formatFixed(value, digits) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatFlex(value, maxDigits = 2) {
  if (value == null || !Number.isFinite(value)) return '—';
  const factor = 10 ** maxDigits;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  }).format(rounded);
}

export function formatBRL(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundMoney(value));
}

/** Euro no padrão brasileiro: "€ 108.000". Centavos só aparecem quando existem (reajuste do VPI). */
export function formatEUR(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  const rounded = roundMoney(value);
  const digits = Number.isInteger(rounded) ? 0 : 2;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rounded);
}

export function formatMeters(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${formatFixed(value, 2)} m`;
}

export function formatPacks(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${formatFlex(value, 0)} pacotes`;
}

/** Os 10 pés-direitos de robô (slides 14 a 23). */
export const HEIGHTS = [2.2, 2.35, 2.5, 2.65, 2.8, 2.95, 3.1, 3.25, 3.4, 3.55];

/**
 * As 7 larguras das tabelas. A chave é a largura do GO.compact com o SAM, que é a coluna dos slides.
 * O SAM soma 0,20 m ao GO.compact. O GO.direct é a largura de referência da outra linha, só para comparar.
 * O slide 3 fala em 8 larguras, mas as tabelas trazem 7: valem as tabelas.
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

export const DEFAULTS = {
  heightM: 2.95,
  widthSam: 3.2,
  classId: 'L',
  secondGripper: false,
  coolingModule: false,
  conveyorEur: 0,
  includeServices: true,
  roomFilterOn: false,
  roomHeightM: 3,
  roomWidthM: 3.5,
  roomWidthRef: 'sam',
  roomLengthM: 5,
  minCapacity: 20000,
  fxRate: 6.2,
  importCostPct: 0,
  taxCreditPct: 25,
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
  for (const key of ['secondGripper', 'coolingModule', 'includeServices', 'roomFilterOn']) {
    if (typeof raw[key] === 'boolean') input[key] = raw[key];
  }
  input.conveyorEur = Math.max(0, num(raw.conveyorEur, DEFAULTS.conveyorEur));
  input.roomHeightM = optionalMeters(raw.roomHeightM, DEFAULTS.roomHeightM);
  input.roomWidthM = optionalMeters(raw.roomWidthM, DEFAULTS.roomWidthM);
  input.roomLengthM = optionalMeters(raw.roomLengthM, DEFAULTS.roomLengthM);
  input.roomWidthRef = WIDTH_REFS.includes(raw.roomWidthRef) ? raw.roomWidthRef : DEFAULTS.roomWidthRef;
  if (raw.minCapacity === null || raw.minCapacity === '') input.minCapacity = null;
  else input.minCapacity = Math.max(0, Math.round(num(raw.minCapacity, DEFAULTS.minCapacity)));
  input.fxRate = clamp(num(raw.fxRate, DEFAULTS.fxRate), 0.01, 100);
  input.importCostPct = clamp(num(raw.importCostPct, DEFAULTS.importCostPct), 0, 300);
  input.taxCreditPct = clamp(num(raw.taxCreditPct, DEFAULTS.taxCreditPct), 0, 100);
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

/** Composição do preço de um robô (slides 5 a 8) e as medidas que dela decorrem. */
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
  const servicesEur = options.includeServices ? cls.servicesEur : 0;
  const equipmentEur = roundMoney(tablePriceEur + secondGripperEur + coolingEur + conveyorEur);
  const orderEur = roundMoney(equipmentEur + servicesEur);
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
    servicesEur,
    classServicesEur: cls.servicesEur,
    equipmentEur,
    orderEur,
    tableLengthM,
    coreLengthM,
    extraLengthM,
    totalLengthM,
    footprintM2,
    compactAreaM2: Math.round(config.widthCompact * totalLengthM * 10000) / 10000,
    directAreaM2: Math.round(config.widthDirect * totalLengthM * 10000) / 10000,
    volumeM3: Math.round(footprintM2 * config.heightM * 10000) / 10000,
    eurPerPack: orderEur / config.capacityPacks,
  };
}

/**
 * Custo Brasil de um valor em euro. Câmbio → nacionalização sobre o valor convertido → crédito recuperável
 * sobre o custo nacionalizado. Retorna reais com centavos.
 */
export function brazilCost(eur, raw = {}) {
  const fxRate = clamp(num(raw.fxRate, DEFAULTS.fxRate), 0.01, 100);
  const importCostPct = clamp(num(raw.importCostPct, DEFAULTS.importCostPct), 0, 300);
  const taxCreditPct = clamp(num(raw.taxCreditPct, DEFAULTS.taxCreditPct), 0, 100);
  const grossBrl = roundMoney(eur * fxRate);
  const importBrl = roundMoney(grossBrl * (importCostPct / 100));
  const landedBrl = roundMoney(grossBrl + importBrl);
  const creditBrl = roundMoney(landedBrl * (taxCreditPct / 100));
  const netBrl = roundMoney(landedBrl - creditBrl);
  return { eur, fxRate, importCostPct, taxCreditPct, grossBrl, importBrl, landedBrl, creditBrl, netBrl };
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

/** Rótulo de uma configuração: "2,95 m × 3,20 m · Robô L". */
export function configLabel(config) {
  return `${formatMeters(config.heightM)} × ${formatMeters(config.widthSam)} · Robô ${config.classId}`;
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
  const brazil = brazilCost(quote.orderEur, chosen);
  return {
    ...chosen,
    selection,
    quote,
    brazil,
    brl: {
      baseRobot: fx(quote.baseRobotEur),
      autoLoading: fx(quote.autoLoadingEur),
      sam: fx(quote.samEur),
      tablePrice: fx(quote.tablePriceEur),
      secondGripper: fx(quote.secondGripperEur),
      cooling: fx(quote.coolingEur),
      conveyor: fx(quote.conveyorEur),
      equipment: fx(quote.equipmentEur),
      services: fx(quote.servicesEur),
      order: brazil.grossBrl,
    },
    brlPerPack: brazil.netBrl / quote.capacityPacks,
    room: fitsRoom(selection.config, chosen),
    space: findSpace(chosen),
    rollout: rollout(chosen, quote.orderEur),
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

export function explain(result) {
  const { quote, brazil, selection, rollout: plan, room, space } = result;
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
  const milestoneLines = plan.milestones
    .filter((row) => row.to != null)
    .map((row) =>
      row.reached
        ? `Robô ${formatFlex(row.to)} (ano ${formatFlex(row.year)}): faixa ${pct(row.levelPct)}. Os robôs ${formatFlex(row.from)} a ${formatFlex(row.to)} saíram com ${pct(row.invoicePct)} na fatura (${eur(row.bandInvoiceBonusCents / 100)}). Nota de crédito = ${pct(row.levelPct)} × ${eur(row.cumulativeCents / 100)} − bônus já dado = ${eur(row.creditNoteCents / 100)}. Bônus acumulado ${eur(row.bonusToDateCents / 100)}.`
        : `Faixa de ${pct(row.levelPct)} no robô ${formatFlex(row.to)}: não alcançada, faltam ${formatFlex(row.missing)}.`,
    );
  return [
    {
      title: 'Modelo e dimensões',
      lines: [
        changedText,
        `Largura c/ SAM ${formatMeters(quote.widthSam)} = GO.compact ${formatMeters(quote.widthCompact)} + SAM ${formatMeters(SAM_PROTRUSION_M)}. GO.direct de referência: ${formatMeters(quote.widthDirect)}.`,
        `Comprimento da tabela ${formatMeters(quote.tableLengthM)} = núcleo de armazenagem ${formatMeters(quote.coreLengthM)} + ${formatMeters(LENGTH_INCLUDED.manualLoadingM)} da carga manual + ${formatMeters(LENGTH_INCLUDED.speedOptionM)} da opção speed.${quote.secondGripper ? ` Com o 2º braço: + ${formatMeters(OPTIONS.secondGripperLengthM)} = ${formatMeters(quote.totalLengthM)}.` : ''}`,
        `Área = ${formatMeters(quote.widthSam)} × ${formatMeters(quote.totalLengthM)} = ${formatFixed(quote.footprintM2, 2)} m². Volume = área × ${formatMeters(quote.heightM)} = ${formatFixed(quote.volumeM3, 2)} m³. Capacidade garantida: ${formatPacks(quote.capacityPacks)} (classe ${cls.id}, aprox. ${formatPacks(cls.approxPacks)}).`,
      ],
    },
    {
      title: 'Preço do robô',
      lines: [
        `Preço de tabela ${eur(quote.tablePriceEur)}. Na classe ${cls.id} a tabela vai de ${eur(range.min)} a ${eur(range.max)} em ${formatFlex(range.count)} células; o slide 4 diz "a partir de ${eur(cls.fromEur)}".`,
        `Robô base = ${eur(quote.tablePriceEur)} − ${eur(PRICE_BUILD_UP.bundledEur)} = ${eur(quote.baseRobotEur)}. + Carga automática com OCR e carga manual ${eur(quote.autoLoadingEur)} + SAM com 4 saídas ${eur(quote.samEur)} = ${eur(quote.robotPriceEur)}.`,
      ],
    },
    {
      title: 'Opcionais e serviços',
      lines: [
        `2º braço com 2º SAM: ${quote.secondGripper ? eur(quote.secondGripperEur) : 'não'}. Refrigeração: ${quote.coolingModule ? eur(quote.coolingEur) : 'não'}. Esteiras: ${eur(quote.conveyorEur)}.`,
        `Equipamento = ${eur(quote.equipmentEur)}. Serviços de transporte e instalação da classe ${cls.id}: ${quote.includeServices ? eur(quote.servicesEur) : `fora (${eur(quote.classServicesEur)} se incluir)`}.`,
        `Pedido por robô = ${eur(quote.orderEur)}. É a base do bônus de volume: inclui opcionais e serviços.`,
      ],
    },
    {
      title: 'Custo Brasil',
      lines: [
        `Em reais = ${eur(quote.orderEur)} × ${formatFlex(brazil.fxRate, 4)} = ${brl(brazil.grossBrl)}.`,
        `Nacionalização = ${pct(brazil.importCostPct)} × ${brl(brazil.grossBrl)} = ${brl(brazil.importBrl)}. Custo nacionalizado ${brl(brazil.landedBrl)}.`,
        `Crédito recuperável = ${pct(brazil.taxCreditPct)} × ${brl(brazil.landedBrl)} = ${brl(brazil.creditBrl)}. Custo líquido efetivo ${brl(brazil.netBrl)}, ou ${brl(result.brlPerPack)} por pacote de capacidade.`,
      ],
    },
    { title: 'Espaço da loja', lines: roomLines },
    {
      title: 'Acordo-quadro e bônus',
      lines: [
        `Anos 1 e 2 com preço fixo. Anos 3, 4 e 5: × (1 + ${pct(result.germanInflationPct)}) elevado a 1, 2 e 3. Pedido por robô no ano: ${plan.unitByYear.map((value, index) => `ano ${index + 1} ${eur(value)}`).join(', ')}.`,
        `Faixas pela contagem acumulada: 2% a partir do 10º, 4% do 25º, 6% do 50º e 8% do 100º robô. Cada robô sai com a faixa vigente no pedido. Ao alcançar uma faixa nova, a nota de crédito leva todos os robôs pedidos até ali à nova faixa.`,
        ...milestoneLines,
        `Total: ${formatFlex(plan.totalRobots)} robôs, bruto ${eur(plan.gross)}, bônus ${eur(plan.bonus)} (${pct(plan.effectivePct)} efetivo), líquido ${eur(plan.net)}. Em reais pelo câmbio: bônus ${brl(plan.bonusBrl)}, líquido ${brl(plan.netBrl)}; com nacionalização e crédito, ${brl(plan.netLandedBrl)}.`,
      ],
    },
  ];
}
