import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('build publicado', () => {
  it('não embute /gCalc/ nem host absoluto', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'gcalc-build-'));
    try {
      execFileSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir], {
        cwd: root,
        env: { ...process.env, VITE_BASE: './', NODE_ENV: 'production' },
        stdio: 'pipe',
      });
      execFileSync(process.execPath, [join(root, 'scripts/check-relative-build.mjs'), outDir], {
        cwd: root,
        stdio: 'pipe',
      });
    } catch (error) {
      const failure = error;
      const detail = `${failure.stdout?.toString() ?? ''}\n${failure.stderr?.toString() ?? ''}\n${failure.message ?? ''}`;
      throw new Error(detail);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 180_000);
});
