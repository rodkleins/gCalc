import { siteHref, type SitePage } from '../model/sitePaths';

const previewBuild = import.meta.env.VITE_PREVIEW === '1';

export function isPreviewBuild(flag: string | undefined = import.meta.env.VITE_PREVIEW): boolean {
  return flag === '1';
}

export function PreviewNotice({ from = 'calculadora' }: { from?: SitePage }) {
  if (!previewBuild) return null;
  return (
    <p className="preview-notice" data-testid="preview-notice">
      Versão de teste. Os dados deste navegador ficam numa chave separada da{' '}
      <a href={siteHref(from, 'calculadora')}>calculadora publicada</a>.
    </p>
  );
}
