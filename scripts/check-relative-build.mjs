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
    if (ext === '.html' || ext === '.css') {
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

  if (problems.length > 0) {
    const message = problems.join('\n');
    console.error(message);
    throw new Error(message);
  }
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
