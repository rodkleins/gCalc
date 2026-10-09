/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { PreviewNotice, isPreviewBuild } from './PreviewNotice';

describe('aviso de prévia', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fica oculto na calculadora publicada', async () => {
    expect(isPreviewBuild(undefined)).toBe(false);
    expect(isPreviewBuild('')).toBe(false);
    expect(isPreviewBuild('1')).toBe(true);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<PreviewNotice />);
    });
    expect(host.querySelector('[data-testid="preview-notice"]')).toBeNull();
    act(() => root.unmount());
  });
});
