import { describe, expect, it } from 'vitest';
import { siteHref } from './sitePaths';

describe('links entre páginas', () => {
  it('sobe só o necessário e não usa prefixo absoluto', () => {
    expect(siteHref('calculadora', 'calculadora')).toBe('./');
    expect(siteHref('calculadora', 'headtohead')).toBe('headtohead/');
    expect(siteHref('calculadora', 'calculos')).toBe('calculos/');
    expect(siteHref('calculadora', 'rh')).toBe('rh/');
    expect(siteHref('calculadora', 'rh-calculos')).toBe('rh/calculos/');

    expect(siteHref('headtohead', 'calculadora')).toBe('../');
    expect(siteHref('headtohead', 'calculos')).toBe('../calculos/');
    expect(siteHref('calculos', 'calculadora')).toBe('../');
    expect(siteHref('calculos', 'headtohead')).toBe('../headtohead/');

    expect(siteHref('rh', 'calculadora')).toBe('../');
    expect(siteHref('rh', 'rh-calculos')).toBe('../rh/calculos/');
    expect(siteHref('rh-calculos', 'calculadora')).toBe('../../');
    expect(siteHref('rh-calculos', 'rh')).toBe('../../rh/');
    expect(siteHref('rh-calculos', 'calculos')).toBe('../../calculos/');

    for (const href of [
      siteHref('calculadora', 'rh'),
      siteHref('rh', 'calculadora'),
      siteHref('rh-calculos', 'headtohead'),
    ]) {
      expect(href.startsWith('/')).toBe(false);
      expect(href).not.toContain('gCalc');
      expect(href).not.toMatch(/^https?:/);
    }
  });
});
