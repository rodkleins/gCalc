import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { createServer, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

function prerenderCalculos(): Plugin {
  let outDir = resolve(rootDir, 'dist');
  return {
    name: 'prerender-calculos',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      if (process.env.GCALC_SKIP_PRERENDER === '1') return;
      const server = await createServer({
        configFile: resolve(rootDir, 'vite.config.ts'),
        server: { middlewareMode: true, hmr: false },
        appType: 'custom',
        logLevel: 'error',
      });
      try {
        const [{ createElement }, { renderToStaticMarkup }, calculos, rh] = await Promise.all([
          import('react'),
          import('react-dom/server'),
          server.ssrLoadModule('/src/calculos/CalculosPage.tsx'),
          server.ssrLoadModule('/src/rh/calculos/RhCalculosPage.tsx'),
        ]);
        stamp(resolve(outDir, 'calculos/index.html'), renderToStaticMarkup(createElement(calculos.CalculosPage)));
        stamp(resolve(outDir, 'rh/calculos/index.html'), renderToStaticMarkup(createElement(rh.RhCalculosPage)));
      } finally {
        await server.close();
      }
    },
  };
}

function stamp(file: string, markup: string) {
  const html = readFileSync(file, 'utf8');
  const token = '<div id="root"></div>';
  if (!html.includes(token)) {
    if (html.includes('data-testid="doc-content"')) return;
    throw new Error(`não achei o root vazio em ${file}`);
  }
  if (!markup.includes('<table') || !markup.includes('<pre>')) {
    throw new Error(`a pré-renderização de ${file} saiu sem tabelas ou fórmulas`);
  }
  writeFileSync(file, html.replace(token, `<div id="root">${markup}</div>`));
}

export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [react(), prerenderCalculos()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        headtohead: resolve(rootDir, 'headtohead/index.html'),
        calculos: resolve(rootDir, 'calculos/index.html'),
        rh: resolve(rootDir, 'rh/index.html'),
        rhCalculos: resolve(rootDir, 'rh/calculos/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.test.mjs'],
    globals: false,
  },
});
