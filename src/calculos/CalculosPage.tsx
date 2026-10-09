import conteudo from './conteudo.md?raw';
import { renderMarkdown } from './render';

const { html, toc } = renderMarkdown(conteudo);

export function CalculosPage() {
  const base = import.meta.env.BASE_URL;
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
        <p className="doc-links">
          <a className="btn" data-testid="doc-back" href={base}>
            Calculadora
          </a>
          <a className="btn" data-testid="doc-headtohead" href={`${base}headtohead/`}>
            Comparação head-to-head
          </a>
        </p>
        <div data-testid="doc-content" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </div>
  );
}
