import { useEffect, useMemo, useState } from 'react';
import { AuditPanel } from './components/AuditPanel';
import { CashflowTable } from './components/CashflowTable';
import { Dashboard } from './components/Dashboard';
import { InvestmentForm } from './components/InvestmentForm';
import { LibraryPanel, downloadJson } from './components/LibraryPanel';
import { LogisticsForm } from './components/LogisticsForm';
import { PeopleForm } from './components/PeopleForm';
import { ProfileForm } from './components/ProfileForm';
import { ScenarioPanel } from './components/ScenarioPanel';
import { SensitivityPanel } from './components/SensitivityPanel';
import { StockForm } from './components/StockForm';
import { evaluate } from './model/calculate';
import { blankInputs, exampleInputs } from './model/example';
import { formatBRL, formatPayback, formatPercent, scenarioLabel, storeLabel } from './model/format';
import {
  STORAGE_VERSION,
  clearSession,
  createId,
  defaultSimulationName,
  deleteSimulation,
  importPayload,
  insertDuplicate,
  mergeSimulations,
  readSession,
  renameSimulation,
  writeSession,
  type SectionId,
  type SimulationRecord,
} from './model/storage';
import type { Inputs, ScenarioId } from './model/types';

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'dashboard', label: 'Resultados' },
  { id: 'perfil', label: 'Perfil' },
  { id: 'pessoas', label: 'Pessoas' },
  { id: 'logistica', label: 'Logística' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'investimento', label: 'Investimento' },
  { id: 'cenarios', label: 'Cenários' },
  { id: 'sensibilidade', label: 'Sensibilidade' },
  { id: 'fluxo', label: 'Fluxo' },
  { id: 'auditoria', label: 'Auditoria' },
  { id: 'simulacoes', label: 'Simulações' },
];

interface BootState {
  inputs: Inputs;
  scenario: ScenarioId;
  section: SectionId;
  simulations: SimulationRecord[];
}

function boot(initialInputs?: Inputs): BootState {
  if (initialInputs) {
    return { inputs: initialInputs, scenario: 'base', section: 'dashboard', simulations: [] };
  }
  const loaded = readSession(localStorage);
  const draft = loaded.draft ?? { inputs: exampleInputs(), scenario: 'base' as const, section: 'dashboard' as const };
  return { inputs: draft.inputs, scenario: draft.scenario, section: draft.section, simulations: loaded.simulations };
}

export default function App({ initialInputs }: { initialInputs?: Inputs }) {
  const [booted] = useState(() => boot(initialInputs));
  const [inputs, setInputs] = useState(booted.inputs);
  const [scenario, setScenario] = useState<ScenarioId>(booted.scenario);
  const [section, setSection] = useState<SectionId>(booted.section);
  const [simulations, setSimulations] = useState<SimulationRecord[]>(booted.simulations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(() => defaultSimulationName(booted.inputs, booted.scenario));
  const [status, setStatus] = useState<string | null>(null);
  const result = useMemo(() => evaluate(inputs, { scenario }), [inputs, scenario]);

  useEffect(() => {
    if (initialInputs) return;
    writeSession(localStorage, {
      version: STORAGE_VERSION,
      draft: { inputs, scenario, section },
      simulations,
    });
  }, [initialInputs, inputs, scenario, section, simulations]);

  const summary = [
    inputs.fictional ? 'DADOS FICTÍCIOS' : 'Simulação',
    `${inputs.meta.clientName} — ${inputs.meta.storeName}`,
    `Cenário ${scenarioLabel(scenario)} · ${storeLabel(inputs.profile.storeType)}`,
    `Investimento líquido: ${formatBRL(result.netInvestment)}`,
    `Benefício líquido mensal: ${formatBRL(result.steadyNet)}`,
    `Payback simples: ${formatPayback(result.payback)}`,
    `ROI anual simples: ${formatPercent(result.roi)}`,
    `VPL: ${formatBRL(result.npv)}`,
    `TIR anual: ${formatPercent(result.irrAnnual)}`,
  ].join('\n');

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      window.prompt('Copie o resumo:', summary);
    }
  }

  function restoreExample() {
    const example = exampleInputs();
    setInputs(example);
    setScenario('base');
    setSection('dashboard');
    setActiveId(null);
    setDraftName(defaultSimulationName(example, 'base'));
    setStatus('Exemplo fictício restaurado. As simulações nomeadas continuam neste navegador.');
  }

  function clearSaved() {
    clearSession(localStorage);
    const example = exampleInputs();
    setInputs(example);
    setScenario('base');
    setSection('dashboard');
    setSimulations([]);
    setActiveId(null);
    setDraftName(defaultSimulationName(example, 'base'));
    setStatus('Dados salvos apagados deste navegador.');
  }

  function saveNamed() {
    const name = draftName.trim() || defaultSimulationName(inputs, scenario);
    const savedAt = new Date().toISOString();
    const snapshot = structuredClone(inputs);
    if (activeId && simulations.some((simulation) => simulation.id === activeId)) {
      setSimulations((current) =>
        current.map((simulation) =>
          simulation.id === activeId ? { ...simulation, name, savedAt, inputs: snapshot, scenario, section } : simulation,
        ),
      );
      setStatus(`Simulação “${name}” atualizada neste navegador.`);
    } else {
      const id = createId();
      setSimulations((current) => [...current, { id, name, savedAt, inputs: snapshot, scenario, section }]);
      setActiveId(id);
      setStatus(`Simulação “${name}” salva neste navegador.`);
    }
    setDraftName(name);
  }

  function loadSimulation(simulation: SimulationRecord) {
    const snapshot = structuredClone(simulation.inputs);
    setInputs(snapshot);
    setScenario(simulation.scenario);
    setSection(simulation.section);
    setActiveId(simulation.id);
    setDraftName(simulation.name);
    setStatus(`“${simulation.name}” carregada.`);
  }

  function exportCurrent() {
    downloadJson('gcalc-simulacao.json', {
      version: STORAGE_VERSION,
      simulations: [
        {
          id: activeId ?? createId(),
          name: draftName.trim() || defaultSimulationName(inputs, scenario),
          savedAt: new Date().toISOString(),
          inputs,
          scenario,
          section,
        },
      ],
    });
  }

  function exportLibrary() {
    downloadJson('gcalc-biblioteca.json', {
      version: STORAGE_VERSION,
      draft: { inputs, scenario, section },
      simulations,
    });
  }

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importPayload(String(reader.result));
      if (!imported) {
        setStatus('Não foi possível ler este JSON.');
        return;
      }
      if (imported.draft) {
        setInputs(structuredClone(imported.draft.inputs));
        setScenario(imported.draft.scenario);
        setSection(imported.draft.section);
        setActiveId(null);
        setDraftName(defaultSimulationName(imported.draft.inputs, imported.draft.scenario));
      }
      if (imported.simulations.length > 0) {
        setSimulations((current) => mergeSimulations(current, imported.simulations));
      }
      setStatus('JSON importado para este navegador.');
    };
    reader.readAsText(file);
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <span className="mark" aria-hidden="true" />
          <div>
            <strong>gCalc</strong>
            <small>ROI Gollmann</small>
          </div>
        </div>
        <nav className="nav" aria-label="Módulos">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? 'is-active' : ''}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <p className="rail-note">Premissas editáveis. O cálculo roda no navegador, sem enviar dados.</p>
      </aside>

      <main className="main">
        <header className="top">
          <div>
            <p className="eyebrow">
              {storeLabel(inputs.profile.storeType)} · {scenarioLabel(scenario)}
              {inputs.fictional ? ' · exemplo fictício' : ''}
            </p>
            <h1>{inputs.meta.storeName || 'Simulação de ROI'}</h1>
            <p className="sub">{inputs.meta.clientName || 'Farmácia'} · robô de armazenagem e dispensação</p>
          </div>
          <div className="top-controls">
            <div className="seg" aria-label="Cenário">
              {(['conservador', 'base', 'otimista'] as const).map((id) => (
                <button key={id} type="button" className={scenario === id ? 'is-active' : ''} onClick={() => setScenario(id)}>
                  {scenarioLabel(id)}
                </button>
              ))}
            </div>
            <div className="seg" aria-label="Tipo de loja">
              <button
                type="button"
                className={inputs.profile.storeType === 'nova' ? 'is-active' : ''}
                onClick={() => setInputs({ ...inputs, profile: { ...inputs.profile, storeType: 'nova' } })}
              >
                Nova
              </button>
              <button
                type="button"
                className={inputs.profile.storeType === 'existente' ? 'is-active' : ''}
                onClick={() => setInputs({ ...inputs, profile: { ...inputs.profile, storeType: 'existente' } })}
              >
                Existente
              </button>
            </div>
          </div>
        </header>

        <div className="toolbar">
          <button type="button" className="btn" data-testid="restore-example" onClick={restoreExample}>
            Restaurar exemplo
          </button>
          <button type="button" className="btn ghost" data-testid="clear-storage" onClick={clearSaved}>
            Limpar dados salvos
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              const blank = blankInputs();
              setInputs(blank);
              setScenario('base');
              setActiveId(null);
              setDraftName(defaultSimulationName(blank, 'base'));
              setStatus(null);
            }}
          >
            Nova simulação
          </button>
          <button type="button" className="btn ghost" onClick={() => void copySummary()}>
            Copiar resumo
          </button>
          <button type="button" className="btn ghost" onClick={() => setSection('simulacoes')}>
            Simulações
          </button>
        </div>
        <p className="storage-note" data-testid="storage-note">
          Os dados ficam só neste navegador.
          {status ? ` ${status}` : ''}
        </p>

        {section === 'dashboard' ? (
          <Dashboard inputs={inputs} result={result} scenario={scenario} onScenario={setScenario} onInputs={setInputs} />
        ) : null}
        {section === 'perfil' ? <ProfileForm inputs={inputs} result={result} onChange={setInputs} /> : null}
        {section === 'pessoas' ? <PeopleForm inputs={inputs} result={result} onChange={setInputs} /> : null}
        {section === 'logistica' ? <LogisticsForm inputs={inputs} result={result} onChange={setInputs} /> : null}
        {section === 'estoque' ? <StockForm inputs={inputs} result={result} onChange={setInputs} /> : null}
        {section === 'investimento' ? <InvestmentForm inputs={inputs} result={result} onChange={setInputs} /> : null}
        {section === 'cenarios' ? (
          <ScenarioPanel inputs={inputs} scenario={scenario} onScenario={setScenario} onChange={setInputs} />
        ) : null}
        {section === 'sensibilidade' ? <SensitivityPanel inputs={inputs} scenario={scenario} /> : null}
        {section === 'fluxo' ? <CashflowTable result={result} /> : null}
        {section === 'auditoria' ? <AuditPanel result={result} /> : null}
        {section === 'simulacoes' ? (
          <LibraryPanel
            draftName={draftName}
            onDraftName={setDraftName}
            simulations={simulations}
            activeId={activeId}
            onSave={saveNamed}
            onLoad={loadSimulation}
            onDuplicate={(id) => setSimulations((current) => insertDuplicate(current, id))}
            onRename={(id, name) => {
              setSimulations((current) => renameSimulation(current, id, name));
              if (id === activeId) setDraftName(name.trim());
            }}
            onDelete={(id) => {
              setSimulations((current) => deleteSimulation(current, id));
              if (id === activeId) setActiveId(null);
            }}
            onExportCurrent={exportCurrent}
            onExportLibrary={exportLibrary}
            onImport={importFile}
          />
        ) : null}
      </main>
    </div>
  );
}
