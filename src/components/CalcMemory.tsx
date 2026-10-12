import { calculationMemory, type MemoryId } from '../model/calcMemory';
import type { Inputs, ModelResult } from '../model/types';

export function CalcMemory({
  inputs,
  result,
  ids,
}: {
  inputs: Inputs;
  result: ModelResult;
  ids: MemoryId[];
}) {
  const blocks = calculationMemory(inputs, result).filter((block) => ids.includes(block.id));
  if (blocks.length === 0) return null;
  return (
    <details className="calc-memory" data-testid={`calc-memory-${ids.join('-')}`}>
      <summary>Ver cálculo</summary>
      <div className="calc-memory-body">
        {blocks.map((block) => (
          <section key={block.id}>
            <h3>{block.title}</h3>
            <ul>
              {block.rows.map((row) => (
                <li key={row.id} className={row.considered ? undefined : 'is-out'} data-testid={`calc-row-${row.id}`}>
                  <strong>{row.label}.</strong> {row.text}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}

export function CalcMemoryPrint({ inputs, result }: { inputs: Inputs; result: ModelResult }) {
  const blocks = calculationMemory(inputs, result);
  return (
    <section data-testid="print-calc-memory">
      <h2>Memória de cálculo</h2>
      {blocks.map((block) => (
        <div key={block.id}>
          <h3>{block.title}</h3>
          <ul>
            {block.rows.map((row) => (
              <li key={row.id}>
                <strong>{row.label}.</strong> {row.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
