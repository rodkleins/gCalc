export interface TocItem {
  id: string;
  level: 2 | 3;
  text: string;
}

export function renderMarkdown(source: string): { html: string; toc: TocItem[] } {
  const text = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const chunks = text.split('```');
  const toc: TocItem[] = [];
  const ids = new Set<string>();
  const html = chunks
    .map((chunk, index) => {
      if (index % 2 === 1) {
        const code = chunk.replace(/^\n/, '').replace(/\n$/, '');
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      }
      return renderBlocks(chunk, toc, ids);
    })
    .join('');
  return { html, toc };
}

function renderBlocks(source: string, toc: TocItem[], ids: Set<string>): string {
  const lines = source.split('\n');
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = uniqueId(slug(text), ids);
      if (level === 2 || level === 3) toc.push({ id, level, text });
      blocks.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      index += 1;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(lines[index]);
        index += 1;
      }
      blocks.push(renderTable(rows));
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''));
        index += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+/.test(lines[index]) && !lines[index].trim().startsWith('|') && !/^\s*[-*]\s+/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return blocks.join('');
}

function renderTable(rows: string[]): string {
  const parsed = rows
    .map((row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()))
    .filter((cells) => !cells.every((cell) => /^:?-+:?$/.test(cell)));
  if (parsed.length === 0) return '';
  const [head, ...body] = parsed;
  const header = `<thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead>`;
  const tableBody = `<tbody>${body
    .map((cells) => `<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  return `<div class="doc-table"><table>${header}${tableBody}</table></div>`;
}

function inline(text: string): string {
  return text
    .split(/(`[^`]+`)/g)
    .map((piece) => {
      if (piece.startsWith('`') && piece.endsWith('`') && piece.length > 2) {
        return `<code>${escapeHtml(piece.slice(1, -1))}</code>`;
      }
      return escapeHtml(piece).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    })
    .join('');
}

function uniqueId(base: string, ids: Set<string>): string {
  let id = base || 'secao';
  let n = 2;
  while (ids.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  ids.add(id);
  return id;
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
