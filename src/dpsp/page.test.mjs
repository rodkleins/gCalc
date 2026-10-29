import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('página DPSP fora do menu', () => {
  it('é noindex, relativa e não entra na navegação pública', () => {
    const page = readFileSync(join(root, 'dpsp/index.html'), 'utf8');
    const nav = readFileSync(join(root, 'src/components/PageNav.tsx'), 'utf8');
    const rhNav = readFileSync(join(root, 'src/rh/RhPageNav.tsx'), 'utf8');
    const home = readFileSync(join(root, 'index.html'), 'utf8');
    const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8');
    assert.match(page, /<meta name="robots" content="noindex,nofollow"\s*\/?>/);
    assert.doesNotMatch(page, /gcalc\.t2software\.co/);
    assert.match(page, /href="\.\.\/favicon\.svg"/);
    assert.doesNotMatch(nav, /dpsp/i);
    assert.doesNotMatch(rhNav, /dpsp/i);
    assert.doesNotMatch(home, /dpsp/i);
    assert.match(robots, /Disallow:\s*\/dpsp\//);
  });
});
