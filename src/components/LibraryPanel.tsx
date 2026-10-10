import { useMemo, useState } from 'react';
import { evaluate } from '../model/calculate';
import { formatBRL, formatIrr, formatPayback, formatPercent, scenarioLabel, storeLabel } from '../model/format';
import type { StorePreset } from '../model/presets';
import type { SimulationRecord } from '../model/storage';
import { RemoveButton, StageNote } from './Fields';
import { StorePresets } from './StorePresets';

export function LibraryPanel({
  draftName,
  onDraftName,
  simulations,
  activeId,
  onSave,
  onLoad,
  onDuplicate,
  onRename,
  onDelete,
  onExportCurrent,
  onExportLibrary,
  onImport,
  onLoadPreset,
}: {
  draftName: string;
  onDraftName: (name: string) => void;
  simulations: SimulationRecord[];
  activeId: string | null;
  onSave: () => void;
  onLoad: (simulation: SimulationRecord) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onExportCurrent: () => void;
  onExportLibrary: () => void;
  onImport: (file: File) => void;
  onLoadPreset: (preset: StorePreset) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [leftId, setLeftId] = useState(simulations[0]?.id ?? '');
  const [rightId, setRightId] = useState(simulations[1]?.id ?? simulations[0]?.id ?? '');

  const left = simulations.find((simulation) => simulation.id === leftId) ?? simulations[0] ?? null;
  const right = simulations.find((simulation) => simulation.id === rightId) ?? simulations[1] ?? simulations[0] ?? null;
  const comparison = useMemo(() => {
    return [left, right].map((simulation) => (simulation ? evaluate(simulation.inputs, { scenario: simulation.scenario }) : null));
  }, [left, right]);

  return (
    <div className="stack">
      <StageNote>
        Esta tela guarda casos neste navegador e compara dois deles. Os três portes também ficam no topo da calculadora.
        Carregar um modelo pede confirmação e oferece salvar o rascunho atual antes de substituir.
      </StageNote>
      <StorePresets onLoad={onLoadPreset} />
      <section className="card">
        <h2>Salvar com nome</h2>
        <p className="lede">
          O rascunho já fica neste navegador. Uma simulação nomeada guarda cliente, loja, cenário, tipo de loja, benefícios e o módulo em que você estava.
        </p>
        <div className="save-row">
          <label className="field grow">
            <span>Nome</span>
            <span className="control">
              <input value={draftName} onChange={(event) => onDraftName(event.target.value)} />
            </span>
          </label>
          <button type="button" className="btn" onClick={onSave}>
            Salvar simulação
          </button>
        </div>
        <div className="toolbar compact">
          <button type="button" className="btn ghost" onClick={onExportCurrent}>
            Exportar esta simulação
          </button>
          <button type="button" className="btn ghost" onClick={onExportLibrary}>
            Exportar biblioteca
          </button>
          <label className="btn ghost file">
            Importar JSON
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Comparar</h2>
        {simulations.length < 2 ? (
          <p className="lede">Salve pelo menos duas simulações para ver os indicadores lado a lado.</p>
        ) : (
          <>
            <div className="form-grid">
              <label className="field">
                <span>Simulação A</span>
                <span className="control">
                  <select value={left?.id ?? ''} onChange={(event) => setLeftId(event.target.value)}>
                    {simulations.map((simulation) => (
                      <option key={simulation.id} value={simulation.id}>
                        {simulation.name}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="field">
                <span>Simulação B</span>
                <span className="control">
                  <select value={right?.id ?? ''} onChange={(event) => setRightId(event.target.value)}>
                    {simulations.map((simulation) => (
                      <option key={simulation.id} value={simulation.id}>
                        {simulation.name}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </div>
            <div className="table-wrap short">
              <table>
                <thead>
                  <tr>
                    <th>Indicador</th>
                    <th className="num">{left?.name ?? 'A'}</th>
                    <th className="num">{right?.name ?? 'B'}</th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="Cenário" left={left ? scenarioLabel(left.scenario) : '—'} right={right ? scenarioLabel(right.scenario) : '—'} />
                  <CompareRow
                    label="Tipo de loja"
                    left={left ? storeLabel(left.inputs.profile.storeType) : '—'}
                    right={right ? storeLabel(right.inputs.profile.storeType) : '—'}
                  />
                  <CompareRow label="Investimento líquido" left={money(comparison[0]?.netInvestment)} right={money(comparison[1]?.netInvestment)} />
                  <CompareRow label="Benefício líquido mensal" left={money(comparison[0]?.steadyNet)} right={money(comparison[1]?.steadyNet)} />
                  <CompareRow label="Payback simples" left={formatPayback(comparison[0]?.payback ?? null)} right={formatPayback(comparison[1]?.payback ?? null)} />
                  <CompareRow label="ROI" left={formatPercent(comparison[0]?.roi ?? null)} right={formatPercent(comparison[1]?.roi ?? null)} />
                  <CompareRow label="VPL" left={money(comparison[0]?.npv)} right={money(comparison[1]?.npv)} />
                  <CompareRow label="TIR anual" left={formatIrr(comparison[0]?.irrAnnual ?? null)} right={formatIrr(comparison[1]?.irrAnnual ?? null)} />
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2>Simulações neste navegador</h2>
        {simulations.length === 0 ? <p className="lede">Nenhuma simulação nomeada ainda.</p> : null}
        <div className="library-list">
          {simulations.map((simulation) => (
            <article key={simulation.id} className={`library-item ${simulation.id === activeId ? 'is-active' : ''}`}>
              <div>
                {renamingId === simulation.id ? (
                  <label className="field">
                    <span>Novo nome</span>
                    <span className="control">
                      <input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
                    </span>
                  </label>
                ) : (
                  <>
                    <h3>{simulation.name}</h3>
                    <p className="lede">
                      {simulation.inputs.meta.clientName || 'Sem cliente'} · {simulation.inputs.meta.storeName || 'Sem loja'} ·{' '}
                      {scenarioLabel(simulation.scenario)} · {storeLabel(simulation.inputs.profile.storeType)}
                    </p>
                  </>
                )}
              </div>
              <div className="library-actions">
                {renamingId === simulation.id ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        onRename(simulation.id, renameValue);
                        setRenamingId(null);
                      }}
                    >
                      Confirmar
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setRenamingId(null)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn" onClick={() => onLoad(simulation)}>
                      Carregar
                    </button>
                    <button type="button" className="btn ghost" onClick={() => onDuplicate(simulation.id)}>
                      Duplicar
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setRenamingId(simulation.id);
                        setRenameValue(simulation.name);
                      }}
                    >
                      Renomear
                    </button>
                    <RemoveButton
                      testId={`remove-simulation-${simulation.id}`}
                      confirm="Apagar esta simulação salva neste navegador?"
                      onRemove={() => onDelete(simulation.id)}
                    />
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CompareRow({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="num">{left}</td>
      <td className="num">{right}</td>
    </tr>
  );
}

function money(value: number | undefined): string {
  return value === undefined ? '—' : formatBRL(value);
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
