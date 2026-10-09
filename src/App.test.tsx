/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';
import { exampleInputs } from './model/example';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('aplicação', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mostra o exemplo ilustrativo no dashboard', async () => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<App initialInputs={exampleInputs()} />);
    });
    const text = (selector: string) => host.querySelector(selector)?.textContent?.replace(/\u00a0/g, ' ') ?? '';
    expect(text('[data-testid="kpi-investment"]')).toContain('R$ 2.000.000');
    expect(text('[data-testid="kpi-net"]')).toContain('R$ 65.000');
    expect(text('[data-testid="kpi-payback"]')).toContain('30,8');
    expect(text('[data-testid="kpi-roi"]')).toBe('39%');
    expect(host.querySelector('[data-testid="example-check"]')).not.toBeNull();
    act(() => root.unmount());
  });
});
