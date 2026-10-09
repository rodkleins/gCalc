import { PageNav } from '../components/PageNav';
import { PreviewNotice } from '../components/PreviewNotice';
import conteudo from './conteudo.md?raw';
import { renderMarkdown } from './render';

const { html, toc } = renderMarkdown(conteudo);

export function CalculosPage() {
  return (
    <div className="doc">
      <nav className="doc-toc" aria-label="Índice">
        <p>Índice</p>
        {toc.map((item) => (
          <a key={item.id} className={item.level === 3 ? 'lvl3' : 'lvl2'} href={`#${item.id}`}>
            {item.text}
          </a>
        ))}
      </nav>
      <article className="doc-body">
        <PreviewNotice />
        <PageNav current="calculos" />
        <div data-testid="doc-content" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </div>
  );
}
