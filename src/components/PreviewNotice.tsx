export function isPreviewBuild(flag: string | undefined = import.meta.env.VITE_PREVIEW): boolean {
  return flag === '1';
}

export function PreviewNotice() {
  if (!isPreviewBuild()) return null;
  return (
    <p className="preview-notice" data-testid="preview-notice">
      Versão de teste. Os dados deste navegador ficam numa chave separada da{' '}
      <a href="/gCalc/">calculadora publicada</a>.
    </p>
  );
}
