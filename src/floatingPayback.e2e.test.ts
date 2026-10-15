/** @vitest-environment node */
// @ts-expect-error o teste roda no Node; o app não depende dos tipos de fs
import { existsSync, mkdtempSync } from 'node:fs';
// @ts-expect-error o teste roda no Node; o app não depende dos tipos de os
import { tmpdir } from 'node:os';
// @ts-expect-error o teste roda no Node; o app não depende dos tipos de path
import { join } from 'node:path';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';

const TABS = ['Perfil', 'Pessoas', 'Logística', 'Estoque', 'Investimento', 'Assistente'] as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, position: 'fixed' },
  { name: 'ipad', width: 820, height: 1100, position: 'sticky' },
  { name: 'celular', width: 390, height: 844, position: 'sticky' },
] as const;

function chromePath(): string {
  const found = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Chrome não encontrado para o teste do payback flutuante.');
  return found;
}

async function openTab(page: Page, label: string) {
  try {
    await page.waitForFunction(
      (name) => {
        const button = [...document.querySelectorAll('nav button, [data-testid="open-wizard"]')].find((node) =>
          (node.textContent || '').includes(name),
        ) as HTMLButtonElement | undefined;
        if (!button) return false;
        const dock = document.querySelector('[data-testid="quick-dock"]');
        const showing =
          name === 'Assistente'
            ? Boolean(document.querySelector('[data-testid="wizard"], .wizard'))
            : Boolean(document.querySelector('nav button.is-active')?.textContent?.includes(name));
        if (!showing) button.click();
        return Boolean(dock && showing);
      },
      // O polling padrão usa requestAnimationFrame. No Chrome do runner, com a suíte
      // saturando a CPU, esse quadro não volta e a espera estoura mesmo com a tela pronta.
      { timeout: 40_000, polling: 100 },
      label,
    );
  } catch (error) {
    const snap = await page
      .evaluate(() => ({
        href: location.href,
        title: document.title,
        text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
      }))
      .catch(() => ({ href: page.url(), title: '', text: '' }));
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${detail} — ${label} em ${snap.href} (${snap.title}): ${snap.text}`);
  }
}

async function scrollToEnd(page: Page) {
  await page.evaluate(async () => {
    const max = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    window.scrollTo(0, max);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))));
  });
}

describe('payback flutuante permanece na tela ao rolar', () => {
  let server: ViteDevServer;
  let browser: Browser;
  let base = '';

  beforeAll(async () => {
    server = await createServer({
      // Cache e watcher próprios: o build de caminhos relativos, no outro processo,
      // regrava node_modules/.vite e derruba esta página com 504 se os dois dividem o cache.
      cacheDir: mkdtempSync(join(tmpdir(), 'gcalc-e2e-')),
      server: {
        host: '127.0.0.1',
        port: 0,
        strictPort: false,
        hmr: false,
        watch: null,
        warmup: { clientFiles: ['./src/main.tsx', './src/rh/main.tsx'] },
      },
      logLevel: 'error',
    });
    await server.listen();
    const address = server.httpServer?.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    base = `http://127.0.0.1:${port}`;
    browser = await puppeteer.launch({
      executablePath: chromePath(),
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  }, 60_000);

  afterAll(async () => {
    await browser?.close().catch(() => undefined);
    await server?.close();
  });

  it('nas duas versões, em cada aba de edição, o indicador continua na viewport depois de rolar até o fim', async () => {
    const failures: string[] = [];
    const page = await browser.newPage();
    try {
      for (const edition of [
        { name: 'raiz', url: `${base}/` },
        { name: 'rh', url: `${base}/rh/` },
      ]) {
        for (const viewport of VIEWPORTS) {
          await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
          await page.goto(edition.url, { waitUntil: 'networkidle0' });
          await page.evaluate(() => localStorage.clear());
          await page.reload({ waitUntil: 'networkidle0' });
          for (const tab of TABS) {
            await openTab(page, tab);
            await scrollToEnd(page);
            const reading = await page.evaluate(() => {
              const dock = document.querySelector('[data-testid="quick-dock"]');
              const rect = dock?.getBoundingClientRect();
              const style = dock ? getComputedStyle(dock) : null;
              const blockers: string[] = [];
              let node = dock?.parentElement ?? null;
              while (node && node !== document.documentElement) {
                const parent = getComputedStyle(node);
                if (parent.overflowX !== 'visible' || parent.overflowY !== 'visible') {
                  blockers.push(`${node.className || node.tagName} overflow ${parent.overflowX}/${parent.overflowY}`);
                }
                node = node.parentElement;
              }
              const hit = rect
                ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + Math.min(rect.height / 2, 20))
                : null;
              const max = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight;
              return {
                text: dock?.textContent ?? '',
                position: style?.position ?? '',
                top: rect ? Math.round(rect.top) : null,
                bottom: rect ? Math.round(rect.bottom) : null,
                height: rect ? Math.round(rect.height) : 0,
                inView: Boolean(
                  rect &&
                    rect.height > 20 &&
                    rect.width > 40 &&
                    rect.top >= -1 &&
                    rect.bottom <= window.innerHeight + 1 &&
                    rect.left >= -1 &&
                    rect.right <= window.innerWidth + 1,
                ),
                painted: Boolean(dock && hit && (dock === hit || dock.contains(hit))),
                blockers,
                scrollY: Math.round(window.scrollY),
                max: Math.round(Math.max(0, max)),
              };
            });
            const where = `${edition.name} ${viewport.name} ${tab}`;
            if (!/Payback/.test(reading.text)) failures.push(`${where}: sem texto de payback`);
            if (reading.position !== viewport.position) {
              failures.push(`${where}: position ${reading.position}, esperado ${viewport.position}`);
            }
            if (!reading.inView) failures.push(`${where}: saiu da viewport (top ${reading.top}, bottom ${reading.bottom})`);
            if (!reading.painted) failures.push(`${where}: o indicador está coberto`);
            if (reading.blockers.length > 0) failures.push(`${where}: ancestral recorta o indicador (${reading.blockers.join('; ')})`);
            if (tab === 'Logística' && reading.max > viewport.height && reading.scrollY < viewport.height) {
              failures.push(`${where}: a rolagem não chegou ao fim (scroll ${reading.scrollY}, máximo ${reading.max})`);
            }
          }
        }
      }
      await page.goto(`${base}/calculos/`, { waitUntil: 'networkidle0' });
      const calculos = await page.evaluate(() => document.querySelector('[data-testid="quick-dock"]'));
      if (calculos) failures.push('calculos: o indicador não deveria aparecer');
      await page.goto(`${base}/rh/calculos/`, { waitUntil: 'networkidle0' });
      const rhCalculos = await page.evaluate(() => document.querySelector('[data-testid="quick-dock"]'));
      if (rhCalculos) failures.push('rh/calculos: o indicador não deveria aparecer');
    } finally {
      await page.close().catch(() => undefined);
    }
    expect(failures).toEqual([]);
  }, 240_000);
});
