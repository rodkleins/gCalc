import { useState } from 'react';
import { formatBRL } from '../model/format';
import type { ModelResult } from '../model/types';

type Filter = 'todos' | 'incluidos' | 'fora';

export function AuditPanel({ result }: { result: ModelResult }) {
  const [filter, setFilter] = useState<Filter>('todos');
  const lines = result.audit.filter((line) => {
    if (filter === 'incluidos') return line.includedInCashFlow;
    if (filter === 'fora') return !line.includedInCashFlow;
    return true;
  });

  return (
    <div className="stack">
      <p className="lede">
        Cada linha diz se entrou no fluxo e por quê. Itens fora do fluxo continuam visíveis para a conversa comercial,
        sem somar duas vezes o mesmo real.
      </p>
      <div className="seg">
        {(
          [
            ['todos', 'Todas'],
            ['incluidos', 'No fluxo'],
            ['fora', 'Fora do fluxo'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="audit-list">
        {lines.map((line) => (
          <article key={line.id} className={`audit-item ${line.includedInCashFlow ? 'in' : 'out'}`}>
            <header>
              <div>
                <span className="eyebrow">{line.module}</span>
                <h3>{line.label}</h3>
              </div>
              <b>{line.includedInCashFlow ? 'No fluxo' : 'Fora'}</b>
            </header>
            <p>{line.reason}</p>
            <p className="formula">{line.formula}</p>
            <footer>
              {line.kind === 'recorrente' || line.kind === 'custo' ? <span>{formatBRL(line.monthlyValue)} / mês</span> : null}
              {line.oneTimeValue ? (
                <span>
                  {formatBRL(line.oneTimeValue)} no mês {line.oneTimeMonth}
                </span>
              ) : null}
              <span>{line.confidence === 'comprovavel' ? 'Comprovável' : line.confidence === 'potencial' ? 'Potencial' : 'Não se aplica'}</span>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
