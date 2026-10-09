import { useEffect, useMemo, useState } from 'react';
import { AuditPanel } from './components/AuditPanel';
import { CashflowTable } from './components/CashflowTable';
import { Dashboard } from './components/Dashboard';
import { InvestmentForm } from './components/InvestmentForm';
import { LogisticsForm } from './components/LogisticsForm';
import { PeopleForm } from './components/PeopleForm';
import { ProfileForm } from './components/ProfileForm';
import { ScenarioPanel } from './components/ScenarioPanel';
import { SensitivityPanel } from './components/SensitivityPanel';
import { StockForm } from './components/StockForm';
import { evaluate } from './model/calculate';
import { blankInputs, exampleInputs } from './model/example';
import { formatBRL, formatPayback, formatPercent, scenarioLabel, storeLabel } from './model/format';
import type { Inputs, ScenarioId } from './model/types';

const STORAGE_KEY = 'gcalc.inputs.v1';

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
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function readStorage(): Inputs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Inputs;
    if (!parsed?.profile || !parsed.people || !parsed.robot || !parsed.scenarios) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function App({ initialInputs }: { initialInputs?: Inputs }) {
  const [inputs, setInputs] = useState<Inputs>(() => initialInputs ?? readStorage() ?? exampleInputs());
  const [scenario, setScenario] = useState<ScenarioId>('base');
  const [section, setSection] = useState<SectionId>('dashboard');
  const result = useMemo(() => evaluate(inputs, { scenario }), [inputs, scenario]);

  useEffect(() => {
    if (initialInputs) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  }, [initialInputs, inputs]);

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

  function downloadJson() {
    const blob = new Blob([JSON.stringify(inputs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'gcalc-simulacao.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function loadJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Inputs;
        if (!parsed?.profile || !parsed.people || !parsed.robot || !parsed.scenarios) return;
        setInputs(parsed);
      } catch {
        window.alert('Não foi possível ler este JSON.');
      }
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
            <p className="sub">
              {inputs.meta.clientName || 'Farmácia'} · robô de armazenagem e dispensação
            </p>
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
          <button type="button" className="btn" onClick={() => setInputs(exampleInputs())}>
            Restaurar exemplo fictício
          </button>
          <button type="button" className="btn ghost" onClick={() => setInputs(blankInputs())}>
            Nova simulação
          </button>
          <button type="button" className="btn ghost" onClick={() => void copySummary()}>
            Copiar resumo
          </button>
          <button type="button" className="btn ghost" onClick={downloadJson}>
            Baixar JSON
          </button>
          <label className="btn ghost file">
            Carregar JSON
            <input
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) loadJson(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>

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
      </main>
    </div>
  );
}
