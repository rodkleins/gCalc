import { useEffect, useMemo, useState } from 'react';
import { AuditPanel } from './components/AuditPanel';
import { CashflowTable } from './components/CashflowTable';
import { Dashboard } from './components/Dashboard';
import { PremiseFocus } from './components/Fields';
import { MoreActions } from './components/MoreActions';
import { PageNav } from './components/PageNav';
import { PreviewNotice } from './components/PreviewNotice';
import { InvestmentForm } from './components/InvestmentForm';
import { LibraryPanel, downloadJson } from './components/LibraryPanel';
import { LogisticsForm } from './components/LogisticsForm';
import { PeopleForm } from './components/PeopleForm';
import { ProfileForm } from './components/ProfileForm';
import { ScenarioPanel } from './components/ScenarioPanel';
import { SensitivityPanel } from './components/SensitivityPanel';
import { StockForm } from './components/StockForm';
import { Wizard } from './components/Wizard';
import { evaluate } from './model/calculate';
import { exampleInputs } from './model/example';
import { formatBRL, formatIrr, formatPayback, formatPercent, scenarioLabel, storeLabel } from './model/format';
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
import { reanchor, sectionForField } from './model/premises';
import type { Inputs, ScenarioId } from './model/types';
import { wizardSeed } from './model/wizard';
import type { StorePreset } from './model/presets';
import {
  NARROW_VIEWPORT_QUERY,
  RAIL_COLLAPSED_KEY,
  initialRailCollapsed,
  readUiFlag,
  writeUiFlag,
} from './model/uiChrome';

const SECTIONS = [
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
] as const satisfies readonly { id: Exclude<SectionId, 'wizard'>; label: string }[];

const NAV_ICONS: Record<Exclude<SectionId, 'wizard'>, string> = {
  dashboard: 'M5 19V11M10 19V6M15 19V9M20 19V4',
  perfil: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  pessoas: 'M12 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM5.5 19.5c.8-2.8 2.8-4.2 6.5-4.2s5.7 1.4 6.5 4.2',
  logistica: 'M3 8l9-4 9 4-9 4-9-4ZM3 8v8l9 4 9-4V8M12 12v8',
  estoque: 'M4 6h16M4 12h16M4 18h16M8 6v12M16 6v12',
  investimento: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 8v8M9.5 10.2h3.2a1.6 1.6 0 0 1 0 3.2H9.5',
  cenarios: 'M4 7h16M4 12h12M4 17h8',
  sensibilidade: 'M4 8h16M4 16h16M9 8v.01M15 16v.01',
  fluxo: 'M5 6h14M5 12h14M5 18h9',
  auditoria: 'M8 3.5h8v17H8zM10.5 9h3M10.5 13h3M10.5 17h2',
  simulacoes: 'M8 7h12v12H8zM4 5h12v12',
};

function NavIcon({ id }: { id: Exclude<SectionId, 'wizard'> }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d={NAV_ICONS[id]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface BootState {
  inputs: Inputs;
  scenario: ScenarioId;
  section: SectionId;
  wizardStep: number;
  adjustAnchor: Inputs;
  simulations: SimulationRecord[];
}

function boot(initialInputs?: Inputs): BootState {
  if (initialInputs) {
    return {
      inputs: initialInputs,
      scenario: 'base',
      section: 'dashboard',
      wizardStep: 0,
      adjustAnchor: structuredClone(initialInputs),
      simulations: [],
    };
  }
  const loaded = readSession(localStorage);
  const fallbackInputs = exampleInputs();
  const draft = loaded.draft ?? {
    inputs: fallbackInputs,
    scenario: 'base' as const,
    section: 'dashboard' as const,
    wizardStep: 0,
    adjustAnchor: structuredClone(fallbackInputs),
  };
  return {
    inputs: draft.inputs,
    scenario: draft.scenario,
    section: draft.section,
    wizardStep: draft.wizardStep,
    adjustAnchor: draft.adjustAnchor,
    simulations: loaded.simulations,
  };
}

export default function App({ initialInputs }: { initialInputs?: Inputs }) {
  const [booted] = useState(() => boot(initialInputs));
  const [inputs, setInputs] = useState(booted.inputs);
  const [scenario, setScenario] = useState<ScenarioId>(booted.scenario);
  const [section, setSection] = useState<SectionId>(booted.section);
  const [wizardStep, setWizardStep] = useState(booted.wizardStep);
  const [adjustAnchor, setAdjustAnchor] = useState(booted.adjustAnchor);
  const [focusField, setFocusField] = useState<string | null>(null);
  const [simulations, setSimulations] = useState<SimulationRecord[]>(booted.simulations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(() => defaultSimulationName(booted.inputs, booted.scenario));
  const [status, setStatus] = useState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(() => initialRailCollapsed(localStorage));
  const result = useMemo(() => evaluate(inputs, { scenario }), [inputs, scenario]);

  useEffect(() => {
    let media: MediaQueryList;
    try {
      media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    } catch {
      return;
    }
    const apply = () => {
      const stored = readUiFlag(localStorage, RAIL_COLLAPSED_KEY);
      setRailCollapsed(stored ?? media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  function toggleRail() {
    const next = !railCollapsed;
    writeUiFlag(localStorage, RAIL_COLLAPSED_KEY, next);
    setRailCollapsed(next);
  }

  useEffect(() => {
    if (initialInputs) return;
    writeSession(localStorage, {
      version: STORAGE_VERSION,
      draft: { inputs, scenario, section, wizardStep, adjustAnchor },
      simulations,
    });
  }, [initialInputs, inputs, scenario, section, wizardStep, adjustAnchor, simulations]);

  const summary = [
    inputs.fictional ? 'DADOS FICTÍCIOS' : 'Simulação',
    `${inputs.meta.clientName} — ${inputs.meta.storeName}`,
    `Cenário ${scenarioLabel(scenario)} · ${storeLabel(inputs.profile.storeType)}`,
    `Investimento líquido: ${formatBRL(result.netInvestment)}`,
    `Benefício líquido mensal: ${formatBRL(result.steadyNet)}`,
    `Payback simples: ${formatPayback(result.payback)}`,
    `ROI anual simples: ${formatPercent(result.roi)}`,
    `VPL: ${formatBRL(result.npv)}`,
    `TIR anual: ${formatIrr(result.irrAnnual)}`,
  ].join('\n');

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      window.prompt('Copie o resumo:', summary);
    }
  }

  function commitInputs(next: Inputs) {
    setAdjustAnchor((anchor) => reanchor(anchor, inputs, next));
    setInputs(next);
  }

  function resetDraft(next: Inputs) {
    setInputs(next);
    setAdjustAnchor(structuredClone(next));
    setFocusField(null);
  }

  function openPremise(fieldId: string) {
    setSection(sectionForField(fieldId));
    setFocusField(fieldId);
  }

  function loadPreset(preset: StorePreset) {
    const next = structuredClone(preset.inputs);
    resetDraft(next);
    setScenario('base');
    setSection('dashboard');
    setWizardStep(0);
    setActiveId(null);
    setDraftName(preset.name);
    setStatus(`Modelo “${preset.name}” carregado. Números fictícios, prontos para os parâmetros reais.`);
  }

  function restoreExample() {
    const example = exampleInputs();
    resetDraft(example);
    setScenario('base');
    setSection('dashboard');
    setWizardStep(0);
    setActiveId(null);
    setDraftName(defaultSimulationName(example, 'base'));
    setStatus('Exemplo fictício restaurado. As simulações nomeadas continuam neste navegador.');
  }

  function clearSaved() {
    clearSession(localStorage);
    const example = exampleInputs();
    resetDraft(example);
    setScenario('base');
    setSection('dashboard');
    setWizardStep(0);
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
    resetDraft(snapshot);
    setScenario(simulation.scenario);
    setSection(simulation.section === 'wizard' ? 'dashboard' : simulation.section);
    setWizardStep(0);
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
      draft: { inputs, scenario, section, wizardStep, adjustAnchor },
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
        resetDraft(structuredClone(imported.draft.adjustAnchor ?? imported.draft.inputs));
        setInputs(structuredClone(imported.draft.inputs));
        setScenario(imported.draft.scenario);
        setSection(imported.draft.section);
        setWizardStep(imported.draft.wizardStep);
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
    <div className={railCollapsed ? 'app is-rail-collapsed' : 'app'}>
      <aside className={railCollapsed ? 'rail is-collapsed' : 'rail'} data-testid="rail">
        <div className="rail-top">
          <div className="brand">
            <span className="mark" aria-hidden="true" />
            <div className="brand-copy">
              <strong>gCalc</strong>
              <small>ROI Gollmann</small>
            </div>
          </div>
          <button
            type="button"
            className="rail-toggle"
            data-testid="rail-toggle"
            aria-expanded={!railCollapsed}
            aria-label={railCollapsed ? 'Expandir menu' : 'Recolher menu'}
            title={railCollapsed ? 'Expandir menu' : 'Recolher menu'}
            onClick={toggleRail}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path
                d={railCollapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="rail-toggle-label">{railCollapsed ? 'Expandir' : 'Recolher'}</span>
          </button>
        </div>
        <nav className="nav" aria-label="Módulos">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? 'is-active' : ''}
              aria-current={section === item.id ? 'page' : undefined}
              title={item.label}
              data-tooltip={item.label}
              onClick={() => {
                setSection(item.id);
                setFocusField(null);
              }}
            ><NavIcon id={item.id} /><span className="nav-label">{item.label}</span></button>
          ))}
        </nav>
        <p className="rail-note">Premissas editáveis. O cálculo roda no navegador, sem enviar dados.</p>
      </aside>

      <main className="main">
        <PreviewNotice />
        <PageNav current="calculadora" />
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
                onClick={() => commitInputs({ ...inputs, profile: { ...inputs.profile, storeType: 'nova' } })}
              >
                Nova
              </button>
              <button
                type="button"
                className={inputs.profile.storeType === 'existente' ? 'is-active' : ''}
                onClick={() => commitInputs({ ...inputs, profile: { ...inputs.profile, storeType: 'existente' } })}
              >
                Existente
              </button>
            </div>
          </div>
        </header>

        <div className="command-bar">
          <div className="command-primary">
            <button
              type="button"
              className="btn primary"
              data-testid="new-simulation"
              onClick={() => {
                const seed = wizardSeed();
                resetDraft(seed);
                setScenario('base');
                setSection('wizard');
                setWizardStep(0);
                setActiveId(null);
                setDraftName(defaultSimulationName(seed, 'base'));
                setStatus('Assistente aberto com valores sugeridos. Troque pelos dados da loja.');
              }}
            >
              Nova simulação
            </button>
            <button type="button" className="btn" data-testid="open-wizard" onClick={() => setSection('wizard')}>
              Assistente
            </button>
            <button type="button" className="btn" data-testid="open-simulations" onClick={() => setSection('simulacoes')}>
              Simulações
            </button>
          </div>
          <div className="command-secondary">
            <div className="seg" role="group" aria-label="Modo de edição" data-testid="toggle-view">
              <button
                type="button"
                data-testid="view-simples"
                aria-pressed={inputs.assumptions.viewMode === 'simples'}
                className={inputs.assumptions.viewMode === 'simples' ? 'is-active' : ''}
                onClick={() =>
                  commitInputs({
                    ...inputs,
                    assumptions: { ...inputs.assumptions, viewMode: 'simples' },
                  })
                }
              >
                Simples
              </button>
              <button
                type="button"
                data-testid="view-avancado"
                aria-pressed={inputs.assumptions.viewMode !== 'simples'}
                className={inputs.assumptions.viewMode !== 'simples' ? 'is-active' : ''}
                onClick={() =>
                  commitInputs({
                    ...inputs,
                    assumptions: { ...inputs.assumptions, viewMode: 'avancado' },
                  })
                }
              >
                Avançado
              </button>
            </div>
            <MoreActions onCopy={() => void copySummary()} onRestore={restoreExample} onClear={clearSaved} />
          </div>
        </div>
        <p className="storage-note" data-testid="storage-note">
          Os dados ficam só neste navegador.
          {status ? ` ${status}` : ''}
        </p>

        <PremiseFocus field={focusField}>
        {section === 'wizard' ? (
          <Wizard
            inputs={inputs}
            scenario={scenario}
            step={wizardStep}
            result={result}
            onInputs={commitInputs}
            onScenario={setScenario}
            onStep={setWizardStep}
            onExit={() => {
              setSection('dashboard');
              setFocusField(null);
            }}
          />
        ) : null}
        {section === 'dashboard' ? (
          <Dashboard
            inputs={inputs}
            anchor={adjustAnchor}
            result={result}
            scenario={scenario}
            onScenario={setScenario}
            onInputs={commitInputs}
            onAdjust={setInputs}
            onUndo={() => setInputs(structuredClone(adjustAnchor))}
            onOpenPremise={openPremise}
            onLoadPreset={loadPreset}
          />
        ) : null}
        {section === 'perfil' ? <ProfileForm inputs={inputs} result={result} onChange={commitInputs} /> : null}
        {section === 'pessoas' ? (
          <PeopleForm
            inputs={inputs}
            result={result}
            onChange={commitInputs}
            advanced={inputs.assumptions.viewMode !== 'simples'}
          />
        ) : null}
        {section === 'logistica' ? <LogisticsForm inputs={inputs} result={result} onChange={commitInputs} /> : null}
        {section === 'estoque' ? <StockForm inputs={inputs} result={result} onChange={commitInputs} /> : null}
        {section === 'investimento' ? <InvestmentForm inputs={inputs} result={result} onChange={commitInputs} /> : null}
        {section === 'cenarios' ? (
          <ScenarioPanel inputs={inputs} scenario={scenario} onScenario={setScenario} onChange={commitInputs} />
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
            onLoadPreset={loadPreset}
          />
        ) : null}
        </PremiseFocus>
      </main>
    </div>
  );
}
