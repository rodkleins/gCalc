import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';

const ALLOWED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const FORBIDDEN = ['/gCalc/', 'rodkleins.github.io', 'gcalc.t2software.co'];
const PAGES = [
  'index.html',
  'headtohead/index.html',
  'calculos/index.html',
  'rh/index.html',
  'rh/calculos/index.html',
  'dpsp/index.html',
];

export function checkRelativeBuild(distDir) {
  const problems = [];
  if (existsSync(join(distDir, 'preview'))) problems.push('o artefato não deve incluir a pasta preview');
  for (const page of PAGES) {
    if (!existsSync(join(distDir, page))) problems.push(`falta ${page}`);
  }

  for (const file of walk(distDir)) {
    const ext = extname(file);
    if (!['.html', '.js', '.css'].includes(ext)) continue;
    const text = readFileSync(file, 'utf8');
    const rel = relative(distDir, file);
    for (const token of FORBIDDEN) {
      if (text.includes(token)) problems.push(`${rel} contém ${token}`);
    }
    if (ext === '.js' && /["'`]\/(?:assets\/|favicon\.svg)/.test(text)) {
      problems.push(`${rel} usa caminho absoluto de asset`);
    }
    // /interno/ cita fontes de pesquisa (https). O restante do site continua
    // sem host absoluto, fora de fonts.googleapis.com e fonts.gstatic.com.
    // Domínio antigo, prefixo /gCalc/ e caminho absoluto de asset seguem proibidos.
    if ((ext === '.html' || ext === '.css') && !rel.startsWith('interno/')) {
      for (const match of text.matchAll(/https?:\/\/[^\s"'`<>)]+/g)) {
        const url = match[0].replace(/[.,;]+$/, '');
        let host = '';
        try {
          host = new URL(url).host;
        } catch {
          host = url;
        }
        if (!ALLOWED_HOSTS.has(host)) problems.push(`${rel} usa host absoluto ${url}`);
      }
    }
    for (const url of collectLocalUrls(text)) {
      if (url.startsWith('/') || url.startsWith('//')) {
        problems.push(`${rel} usa caminho absoluto ${url}`);
        continue;
      }
      if (ext === '.html' && /\.(?:js|css|svg|png|jpe?g|webp|gif|woff2?|ttf|otf)(?:[?#]|$)/i.test(url)) {
        const target = join(dirname(file), url.split(/[?#]/)[0]);
        if (!existsSync(target)) problems.push(`${rel} aponta para ${url}, que não existe no artefato`);
      }
    }
  }

  problems.push(...staticCalculosProblems(distDir));

  if (problems.length > 0) {
    const message = problems.join('\n');
    console.error(message);
    throw new Error(message);
  }
}

function visibleHtml(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

function staticCalculosProblems(distDir) {
  const problems = [];
  const calculos = visibleHtml(readFileSync(join(distDir, 'calculos/index.html'), 'utf8'));
  const rh = visibleHtml(readFileSync(join(distDir, 'rh/calculos/index.html'), 'utf8'));
  if (calculos.includes('<div id="root"></div>')) problems.push('calculos/index.html depende de JavaScript para o texto');
  if (!calculos.includes('mês de início da operação')) problems.push('calculos/index.html não traz a fórmula no HTML');
  if (!calculos.includes('data-testid="engine-examples"')) problems.push('calculos/index.html não traz os exemplos calculados');
  if (!calculos.includes('50,3 meses') || !calculos.includes('Não recupera em 60 meses')) {
    problems.push('calculos/index.html não traz o exemplo numérico no HTML');
  }
  if ((calculos.match(/<pre>/g) ?? []).length < 8) problems.push('calculos/index.html não traz as fórmulas em texto');
  if ((calculos.match(/<table>/g) ?? []).length < 8) problems.push('calculos/index.html não traz as tabelas no HTML');
  if (rh.includes('<div id="root"></div>')) problems.push('rh/calculos/index.html depende de JavaScript para o texto');
  if (!rh.includes('1,2943')) problems.push('rh/calculos/index.html não traz a fórmula do folguista no HTML');
  if (!rh.includes('data-testid="rh-scorecard"') || !rh.includes('data-testid="score-exemplo-base"')) {
    problems.push('rh/calculos/index.html não traz a tabela calculada dos modelos');
  }
  if (!rh.includes('Não recupera em 60 meses')) problems.push('rh/calculos/index.html não traz o payback calculado no HTML');
  return problems;
}

function collectLocalUrls(text) {
  const urls = [];
  for (const match of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) urls.push(match[1]);
  for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) urls.push(match[1]);
  return urls.filter((url) => !url.startsWith('#') && !url.startsWith('data:') && !/^https?:\/\//i.test(url));
}

function walk(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found;
}

if (process.argv[1] && process.argv[1].endsWith('check-relative-build.mjs')) {
  const distDir = process.argv[2];
  if (!distDir) {
    console.error('uso: node scripts/check-relative-build.mjs <dist>');
    process.exit(2);
  }
  try {
    checkRelativeBuild(distDir);
  } catch {
    process.exit(1);
  }
}
