import { useEffect, useMemo, useState } from 'react';
import { AuditPanel } from '../components/AuditPanel';
import { CashflowTable } from '../components/CashflowTable';
import { Dashboard } from '../components/Dashboard';
import { FieldHelpProvider, PremiseFocus } from '../components/Fields';
import { MoreActions } from '../components/MoreActions';
import { InvestmentForm } from '../components/InvestmentForm';
import { LibraryPanel, downloadJson } from '../components/LibraryPanel';
import { LogisticsForm } from '../components/LogisticsForm';
import { ProfileForm } from '../components/ProfileForm';
import { ScenarioPanel } from '../components/ScenarioPanel';
import { SensitivityPanel } from '../components/SensitivityPanel';
import { StockForm } from '../components/StockForm';
import { Wizard } from '../components/Wizard';
import { evaluate } from '../model/calculate';
import { formatBRL, formatIrr, formatPayback, formatPercent, scenarioLabel, storeLabel } from '../model/format';
import { reanchor, sectionForField } from '../model/premises';
import { createId, defaultSimulationName, type SectionId } from '../model/storage';
import { NARROW_VIEWPORT_QUERY, readUiFlag, writeUiFlag } from '../model/uiChrome';
import type { Inputs, ScenarioId } from '../model/types';
import { wizardSeed } from '../model/wizard';
import { RhPresetPanel, RhStorePicker } from './RhPresets';
import { RhPageNav, RhValidationNotice } from './RhPageNav';
import { RosterForm } from './RosterForm';
import { exampleRoster, rhExample, rhStorePresets, type RhPreset } from './presets';
import { applyRoster, type Roster } from './roster';
import {
  RH_KIND,
  RH_STORAGE_VERSION,
  RH_UI_KEYS,
  clearRhSession,
  importRhPayload,
  readRhSession,
  writeRhSession,
  type RhSimulation,
} from './storage';

const SECTIONS = [
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
  { id: 'dashboard', label: 'Resultados' },
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
      <path d={NAV_ICONS[id]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface BootState {
  inputs: Inputs;
  roster: Roster;
  scenario: ScenarioId;
  section: SectionId;
  wizardStep: number;
  adjustAnchor: Inputs;
  simulations: RhSimulation[];
}

function boot(initial?: { inputs: Inputs; roster: Roster }): BootState {
  if (initial) {
    const inputs = applyRoster(initial.inputs, initial.roster);
    return {
      inputs,
      roster: initial.roster,
      scenario: 'base',
      section: 'dashboard',
      wizardStep: 0,
      adjustAnchor: structuredClone(inputs),
      simulations: [],
    };
  }
  const loaded = readRhSession(localStorage);
  const fallback = rhExample();
  const draft = loaded.draft ?? {
    inputs: fallback.inputs,
    roster: fallback.roster,
    scenario: 'base' as const,
    section: 'dashboard' as const,
    wizardStep: 0,
    adjustAnchor: structuredClone(fallback.inputs),
  };
  return {
    inputs: draft.inputs,
    roster: draft.roster,
    scenario: draft.scenario,
    section: draft.section,
    wizardStep: draft.wizardStep,
    adjustAnchor: draft.adjustAnchor,
    simulations: loaded.simulations,
  };
}

export default function RhApp({ initial }: { initial?: { inputs: Inputs; roster: Roster } }) {
  const [booted] = useState(() => boot(initial));
  const [inputs, setInputs] = useState(booted.inputs);
  const [roster, setRoster] = useState(booted.roster);
  const [scenario, setScenario] = useState<ScenarioId>(booted.scenario);
  const [section, setSection] = useState<SectionId>(booted.section);
  const [wizardStep, setWizardStep] = useState(booted.wizardStep);
  const [adjustAnchor, setAdjustAnchor] = useState(booted.adjustAnchor);
  const [focusField, setFocusField] = useState<string | null>(null);
  const [simulations, setSimulations] = useState<RhSimulation[]>(booted.simulations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(() => defaultSimulationName(booted.inputs, booted.scenario));
  const [status, setStatus] = useState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(() => readUiFlag(localStorage, RH_UI_KEYS.railCollapsed) === true);
  const [pendingPreset, setPendingPreset] = useState<RhPreset | null>(null);
  const presets = useMemo(() => rhStorePresets(), []);
  const result = useMemo(() => evaluate(inputs, { scenario }), [inputs, scenario]);

  useEffect(() => {
    let media: MediaQueryList;
    try {
      media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    } catch {
      return;
    }
    const apply = () => {
      const stored = readUiFlag(localStorage, RH_UI_KEYS.railCollapsed);
      setRailCollapsed(stored ?? media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  function toggleRail() {
    const next = !railCollapsed;
    writeUiFlag(localStorage, RH_UI_KEYS.railCollapsed, next);
    setRailCollapsed(next);
  }

  useEffect(() => {
    if (initial) return;
    writeRhSession(localStorage, {
      kind: RH_KIND,
      version: RH_STORAGE_VERSION,
      draft: { inputs, roster, scenario, section, wizardStep, adjustAnchor },
      simulations,
    });
  }, [initial, inputs, roster, scenario, section, wizardStep, adjustAnchor, simulations]);

  const summary = [
    inputs.fictional ? 'DADOS FICTÍCIOS' : 'Simulação',
    'Versão em validação — quadro de RH',
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
    const applied = applyRoster(next, roster);
    setAdjustAnchor((anchor) => reanchor(anchor, inputs, applied));
    setInputs(applied);
  }

  function commitRoster(next: Roster) {
    setRoster(next);
    setInputs((current) => applyRoster(current, next));
    setAdjustAnchor((anchor) => applyRoster(anchor, next));
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

  function loadPreset(preset: RhPreset) {
    const nextRoster = structuredClone(preset.roster);
    const next = applyRoster(structuredClone(preset.inputs), nextRoster);
    setRoster(nextRoster);
    resetDraft(next);
    setScenario('base');
    setSection('dashboard');
    setWizardStep(0);
    setActiveId(null);
    setDraftName(preset.name);
    setStatus(`Modelo “${preset.name}” carregado. Números fictícios, prontos para os parâmetros reais.`);
    window.scrollTo({ top: 0, left: 0 });
  }

  function restoreExample() {
    const example = rhExample();
    setRoster(example.roster);
    resetDraft(example.inputs);
    setScenario('base');
    setSection('dashboard');
    setWizardStep(0);
    setActiveId(null);
    setDraftName(defaultSimulationName(example.inputs, 'base'));
    setStatus('Exemplo fictício desta versão restaurado. As simulações nomeadas continuam neste navegador.');
  }

  function clearSaved() {
    clearRhSession(localStorage);
    const example = rhExample();
    setRoster(example.roster);
    resetDraft(example.inputs);
    setScenario('base');
    setSection('dashboard');
    setWizardStep(0);
    setSimulations([]);
    setActiveId(null);
    setDraftName(defaultSimulationName(example.inputs, 'base'));
    setStatus('Dados desta versão apagados deste navegador. A calculadora atual não foi alterada.');
  }

  function saveNamed() {
    const name = draftName.trim() || defaultSimulationName(inputs, scenario);
    const savedAt = new Date().toISOString();
    const snapshot = structuredClone(inputs);
    const rosterSnapshot = structuredClone(roster);
    if (activeId && simulations.some((simulation) => simulation.id === activeId)) {
      setSimulations((current) =>
        current.map((simulation) =>
          simulation.id === activeId
            ? { ...simulation, name, savedAt, inputs: snapshot, roster: rosterSnapshot, scenario, section }
            : simulation,
        ),
      );
      setStatus(`Simulação “${name}” atualizada neste navegador.`);
    } else {
      const id = createId();
      setSimulations((current) => [
        ...current,
        { id, name, savedAt, inputs: snapshot, roster: rosterSnapshot, scenario, section },
      ]);
      setActiveId(id);
      setStatus(`Simulação “${name}” salva neste navegador.`);
    }
    setDraftName(name);
  }

  function replaceWithPreset() {
    if (!pendingPreset) return;
    const preset = pendingPreset;
    setPendingPreset(null);
    loadPreset(preset);
  }

  function saveThenLoadPreset() {
    if (!pendingPreset) return;
    const preset = pendingPreset;
    saveNamed();
    setPendingPreset(null);
    loadPreset(preset);
    setStatus(`Simulação atual salva. Modelo “${preset.name}” carregado. Números fictícios, prontos para os parâmetros reais.`);
  }

  useEffect(() => {
    if (!pendingPreset) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPendingPreset(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pendingPreset]);

  function loadSimulation(simulation: RhSimulation) {
    const nextRoster = structuredClone(simulation.roster);
    setRoster(nextRoster);
    resetDraft(applyRoster(structuredClone(simulation.inputs), nextRoster));
    setScenario(simulation.scenario);
    setSection(simulation.section === 'wizard' ? 'dashboard' : simulation.section);
    setWizardStep(0);
    setActiveId(simulation.id);
    setDraftName(simulation.name);
    setStatus(`“${simulation.name}” carregada.`);
  }

  function exportCurrent() {
    downloadJson('gcalc-rh-simulacao.json', {
      kind: RH_KIND,
      version: RH_STORAGE_VERSION,
      simulations: [
        {
          id: activeId ?? createId(),
          name: draftName.trim() || defaultSimulationName(inputs, scenario),
          savedAt: new Date().toISOString(),
          inputs,
          roster,
          scenario,
          section,
        },
      ],
    });
  }

  function exportLibrary() {
    downloadJson('gcalc-rh-biblioteca.json', {
      kind: RH_KIND,
      version: RH_STORAGE_VERSION,
      draft: { inputs, roster, scenario, section, wizardStep, adjustAnchor },
      simulations,
    });
  }

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importRhPayload(String(reader.result));
      if (!imported) {
        setStatus('Não foi possível ler este JSON.');
        return;
      }
      if (imported.draft) {
        setRoster(imported.draft.roster);
        resetDraft(imported.draft.adjustAnchor);
        setInputs(imported.draft.inputs);
        setScenario(imported.draft.scenario);
        setSection(imported.draft.section);
        setWizardStep(imported.draft.wizardStep);
        setActiveId(null);
        setDraftName(defaultSimulationName(imported.draft.inputs, imported.draft.scenario));
      }
      if (imported.simulations.length > 0) {
        setSimulations((current) => {
          const ids = new Set(current.map((simulation) => simulation.id));
          const appended = imported.simulations.map((simulation) => {
            if (!ids.has(simulation.id)) {
              ids.add(simulation.id);
              return simulation;
            }
            const copy = { ...structuredClone(simulation), id: createId() };
            ids.add(copy.id);
            return copy;
          });
          return [...current, ...appended];
        });
      }
      setStatus('JSON importado nesta versão. A calculadora atual não foi alterada.');
    };
    reader.readAsText(file);
  }

  return (
    <FieldHelpProvider>
    <div className={railCollapsed ? 'app is-rail-collapsed' : 'app'}>
      <aside className={railCollapsed ? 'rail is-collapsed' : 'rail'} data-testid="rail">
        <div className="rail-top">
          <div className="brand">
            <span className="mark" aria-hidden="true" />
            <div className="brand-copy">
              <strong>gCalc</strong>
              <small>Quadro de RH</small>
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
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
              <path
                d={railCollapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
                window.scrollTo({ top: 0, left: 0 });
              }}
            >
              <NavIcon id={item.id} />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <p className="rail-note">Versão em validação. O cálculo roda no navegador e fica numa chave separada.</p>
      </aside>

      <main className="main">
        <RhValidationNotice />
        <RhPageNav current="rh" />
        <header className="top">
          <div>
            <p className="eyebrow">
              {storeLabel(inputs.profile.storeType)} · {scenarioLabel(scenario)}
              {inputs.fictional ? ' · exemplo fictício' : ''}
            </p>
            <h1>{inputs.meta.storeName || 'Simulação de ROI'}</h1>
            <p className="sub">{inputs.meta.clientName || 'Farmácia'} · quadro de RH por turno</p>
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
                const seed = applyRoster(wizardSeed(), exampleRoster());
                setRoster(exampleRoster());
                resetDraft(seed);
                setScenario('base');
                setSection('wizard');
                setWizardStep(0);
                setActiveId(null);
                setDraftName(defaultSimulationName(seed, 'base'));
                setStatus('Assistente aberto com o quadro sugerido. Troque pelos dados da loja.');
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
                onClick={() => commitInputs({ ...inputs, assumptions: { ...inputs.assumptions, viewMode: 'simples' } })}
              >
                Simples
              </button>
              <button
                type="button"
                data-testid="view-avancado"
                aria-pressed={inputs.assumptions.viewMode !== 'simples'}
                className={inputs.assumptions.viewMode !== 'simples' ? 'is-active' : ''}
                onClick={() => commitInputs({ ...inputs, assumptions: { ...inputs.assumptions, viewMode: 'avancado' } })}
              >
                Avançado
              </button>
            </div>
            <MoreActions
              onCopy={() => void copySummary()}
              onRestore={restoreExample}
              onClear={clearSaved}
              onExportJson={exportCurrent}
              onImportJson={importFile}
            />
          </div>
        </div>
        <RhStorePicker presets={presets} onLoad={setPendingPreset} />
        <p className="storage-note" data-testid="storage-note">
          Os dados desta versão ficam só neste navegador, separados da calculadora atual.
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
              uiKeys={{ dock: RH_UI_KEYS.quickDockOpen, adjust: RH_UI_KEYS.quickAdjustOpen }}
              hiddenLevers={['salarios']}
            />
          ) : null}
          {section === 'perfil' ? <ProfileForm inputs={inputs} result={result} onChange={commitInputs} /> : null}
          {section === 'pessoas' ? <RosterForm roster={roster} storeType={inputs.profile.storeType} onChange={commitRoster} /> : null}
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
              onLoad={(simulation) => {
                const full = simulations.find((item) => item.id === simulation.id);
                if (full) loadSimulation(full);
              }}
              onDuplicate={(id) =>
                setSimulations((current) => {
                  const index = current.findIndex((item) => item.id === id);
                  if (index < 0) return current;
                  const copy: RhSimulation = {
                    ...structuredClone(current[index]),
                    id: createId(),
                    name: `${current[index].name} (cópia)`,
                    savedAt: new Date().toISOString(),
                  };
                  const next = current.slice();
                  next.splice(index + 1, 0, copy);
                  return next;
                })
              }
              onRename={(id, name) => {
                setSimulations((current) => current.map((item) => (item.id === id ? { ...item, name: name.trim() || item.name } : item)));
                if (id === activeId && name.trim()) setDraftName(name.trim());
              }}
              onDelete={(id) => {
                setSimulations((current) => current.filter((item) => item.id !== id));
                if (id === activeId) setActiveId(null);
              }}
              onExportCurrent={exportCurrent}
              onExportLibrary={exportLibrary}
              onImport={importFile}
              exportCurrentLabel="Exportar JSON"
              emphasizeJson
              onLoadPreset={(preset) => {
                const match = presets.find((item) => item.id === preset.id);
                if (match) setPendingPreset(match);
              }}
              presetPanel={<RhPresetPanel presets={presets} onLoad={setPendingPreset} />}
            />
          ) : null}
        </PremiseFocus>
      </main>
      {pendingPreset ? (
        <div
          className="modal-backdrop"
          data-testid="preset-confirm"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPendingPreset(null);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="preset-confirm-title">
            <h2 id="preset-confirm-title">Carregar {pendingPreset.name}?</h2>
            <p>Isso substitui a simulação aberta, inclusive o quadro de RH. Você pode guardar o rascunho neste navegador antes.</p>
            <div className="menu-confirm-actions">
              <button type="button" className="btn ghost" data-testid="preset-cancel" onClick={() => setPendingPreset(null)}>
                Cancelar
              </button>
              <button type="button" className="btn" data-testid="preset-save-then-load" onClick={saveThenLoadPreset}>
                Salvar atual e carregar
              </button>
              <button type="button" className="btn primary" data-testid="preset-replace" onClick={replaceWithPreset}>
                Substituir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </FieldHelpProvider>
  );
}
