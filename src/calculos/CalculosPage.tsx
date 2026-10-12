import { PageNav } from '../components/PageNav';
import { PreviewNotice } from '../components/PreviewNotice';
import conteudo from './conteudo.md?raw';
import { engineExamplesHtml } from './engineExamples';
import { renderMarkdown } from './render';

const { html, toc } = renderMarkdown(conteudo);
const CALCULATED = [
  { id: 'sensibilidade-calculada', text: 'Sensibilidade calculada' },
  { id: 'exemplo-calculado', text: 'Exemplo calculado' },
  { id: 'cenarios-calculados', text: 'Cenários calculados' },
  { id: 'lojas-calculadas', text: 'Lojas calculadas' },
];

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
        {CALCULATED.map((item) => (
          <a key={item.id} className="lvl2" href={`#${item.id}`}>
            {item.text}
          </a>
        ))}
      </nav>
      <article className="doc-body">
        <PreviewNotice from="calculos" />
        <PageNav current="calculos" />
        <div data-testid="doc-content" dangerouslySetInnerHTML={{ __html: html }} />
        <div dangerouslySetInnerHTML={{ __html: engineExamplesHtml() }} />
      </article>
    </div>
  );
}
