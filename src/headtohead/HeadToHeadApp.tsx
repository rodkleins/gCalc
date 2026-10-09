import { useEffect, useMemo, useState } from 'react';
import { NumberField, PercentField, Switch } from '../components/Fields';
import { formatBRL, formatIrr, formatNumber, formatPayback, formatPercent, parseLocaleNumber } from '../model/format';
import {
  blankIndicator,
  blankLine,
  blankStaff,
  evaluateHeadToHead,
  exampleDraft,
  formatImpact,
  formatIndicatorDelta,
  sectionTitle,
  signedLine,
  signedStaff,
  type DreLine,
  type HeadToHeadDraft,
  type HeadToHeadSection,
  type ProductivityIndicator,
  type StaffLine,
} from './model';
import { clearDraft, loadDraft, newId, saveDraft } from './storage';

const ORDER: HeadToHeadSection[] = ['receita', 'cmv', 'ocupacao', 'logistica', 'perdas', 'outras', 'robo', 'extra'];

export function HeadToHeadApp({ initialDraft }: { initialDraft?: HeadToHeadDraft }) {
  const [draft, setDraft] = useState<HeadToHeadDraft>(() => initialDraft ?? loadDraft(localStorage));
  const view = useMemo(() => evaluateHeadToHead(draft), [draft]);

  useEffect(() => {
    if (initialDraft) return;
    saveDraft(localStorage, draft);
  }, [draft, initialDraft]);

  function updateLine(id: string, patch: Partial<DreLine>) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  }

  function updateStaff(id: string, patch: Partial<StaffLine>) {
    setDraft((current) => ({
      ...current,
      staff: current.staff.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  }

  function updateIndicator(id: string, patch: Partial<ProductivityIndicator>) {
    setDraft((current) => ({
      ...current,
      indicators: current.indicators.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
  }

  return (
    <div className="hh">
      <header className="hh-top">
        <div className="hh-title">
          <p className="eyebrow">Rascunho · comparação head-to-head</p>
          <h1>{draft.storeName || 'Loja sem nome'}</h1>
          <p className="sub">A loja de hoje ao lado da mesma loja com o robô. A última linha é o que sobra.</p>
        </div>
        <a className="btn hh-back" data-testid="back-to-current" href={import.meta.env.BASE_URL}>
          Voltar à calculadora atual
        </a>
      </header>

      {draft.fictional ? (
        <p className="banner fiction" data-testid="hh-fiction">
          Números fictícios, para conversa com a rede. A loja do exemplo fatura R$ 1 milhão por mês. Não é uma loja real
          nem parâmetro oficial da Gollmann.
        </p>
      ) : (
        <p className="banner" data-testid="hh-fiction">
          Rascunho de discussão. Estes números não estão marcados como fictícios.
        </p>
      )}
      <p className="storage-note hh-note">Este rascunho fica só neste navegador, separado da calculadora atual.</p>

      <p className="sub">Resultado que sobra, por mês</p>
      <section className="hh-hero" aria-label="Resultado que sobra por mês">
        <article>
          <span>Hoje</span>
          <strong>{formatBRL(view.result.today)}</strong>
        </article>
        <article>
          <span>Com robô</span>
          <strong>{formatBRL(view.result.withRobot)}</strong>
        </article>
        <article>
          <span>Diferença</span>
          <strong className="hh-delta">{formatImpact(view.result.delta)}</strong>
        </article>
      </section>

      <div className="hh-actions">
        <label className="field grow">
          <span>Nome da loja</span>
          <span className="control">
            <input
              data-testid="hh-store-name"
              value={draft.storeName}
              onChange={(event) => setDraft({ ...draft, storeName: event.target.value })}
            />
          </span>
        </label>
        <Switch
          checked={draft.fictional}
          label={draft.fictional ? 'Dados fictícios' : 'Dados da rede'}
          onChange={(fictional) => setDraft({ ...draft, fictional })}
        />
        <button type="button" className="btn" data-testid="hh-restore" onClick={() => setDraft(exampleDraft())}>
          Restaurar exemplo
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            clearDraft(localStorage);
            setDraft(exampleDraft());
          }}
        >
          Limpar rascunho
        </button>
      </div>

      <section className="hh-block" aria-labelledby="hh-dre-title">
        <div>
          <h2 id="hh-dre-title">Resultado da loja, por mês</h2>
          <p className="lede">
            Receita, CMV, pessoal por função, ocupação, logística, perdas e as linhas que a rede criar. A diferença de
            cada linha é o que muda no resultado: positivo sobra mais com o robô.
          </p>
        </div>
        <div className="hh-scroll">
          <table className="hh-table">
            <colgroup>
              <col className="line" />
              <col className="num" />
              <col className="num" />
              <col className="num" />
            </colgroup>
            <thead>
              <tr>
                <th>Linha</th>
                <th className="num hh-hoje">Hoje</th>
                <th className="num hh-robo">Com robô</th>
                <th className="num">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {ORDER.map((section) => (
                <SectionBlock
                  key={section}
                  section={section}
                  draft={draft}
                  onLine={updateLine}
                  onRemoveLine={(id) => setDraft({ ...draft, lines: draft.lines.filter((line) => line.id !== id) })}
                  showMargin={section === 'cmv'}
                  margin={view.margin}
                  staff={section === 'ocupacao' ? draft.staff : null}
                  onStaff={updateStaff}
                  onRemoveStaff={(id) => setDraft({ ...draft, staff: draft.staff.filter((line) => line.id !== id) })}
                  onAddStaff={() => setDraft({ ...draft, staff: [...draft.staff, blankStaff(newId())] })}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="hh-result">
                <th scope="row">Resultado que sobra</th>
                <td className="num">
                  <strong data-testid="hh-result-today">{formatBRL(view.result.today)}</strong>
                </td>
                <td className="num">
                  <strong data-testid="hh-result-robot">{formatBRL(view.result.withRobot)}</strong>
                </td>
                <td className="num">
                  <strong className="hh-delta" data-testid="hh-result-delta">
                    {formatImpact(view.result.delta)}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <button
          type="button"
          className="btn"
          data-testid="hh-add-extra"
          onClick={() => setDraft({ ...draft, lines: [...draft.lines, blankLine(newId())] })}
        >
          Adicionar linha da rede
        </button>
      </section>

      <section className="hh-block" aria-labelledby="hh-prod-title">
        <div>
          <h2 id="hh-prod-title">Indicadores da equipe</h2>
          <p className="lede">
            Cada rede mede produtividade de um jeito. O nome, a unidade e os dois valores são editáveis. Estes números
            não entram no resultado em reais.
          </p>
        </div>
        <div className="hh-scroll">
          <table className="hh-table">
            <colgroup>
              <col className="line" />
              <col className="num" />
              <col className="num" />
              <col className="num" />
            </colgroup>
            <thead>
              <tr>
                <th>Indicador</th>
                <th className="num hh-hoje">Hoje</th>
                <th className="num hh-robo">Com robô</th>
                <th className="num">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {draft.indicators.map((indicator) => (
                <tr key={indicator.id}>
                  <th scope="row">
                    <div className="hh-label">
                      <input
                        type="text"
                        aria-label={`Nome do indicador ${indicator.name}`}
                        value={indicator.name}
                        onChange={(event) => updateIndicator(indicator.id, { name: event.target.value })}
                      />
                      <input
                        type="text"
                        aria-label={`Unidade de ${indicator.name}`}
                        value={indicator.unit}
                        placeholder="unidade"
                        onChange={(event) => updateIndicator(indicator.id, { unit: event.target.value })}
                      />
                      <button
                        type="button"
                        className="btn ghost hh-remove"
                        onClick={() =>
                          setDraft({ ...draft, indicators: draft.indicators.filter((item) => item.id !== indicator.id) })
                        }
                      >
                        Remover
                      </button>
                    </div>
                  </th>
                  <td>
                    <CellInput
                      label={`Hoje — ${indicator.name}`}
                      value={indicator.today}
                      onChange={(today) => updateIndicator(indicator.id, { today })}
                    />
                  </td>
                  <td>
                    <CellInput
                      label={`Com robô — ${indicator.name}`}
                      value={indicator.withRobot}
                      onChange={(withRobot) => updateIndicator(indicator.id, { withRobot })}
                    />
                  </td>
                  <td className="num">
                    <span className="hh-delta flat">{formatIndicatorDelta(indicator.withRobot - indicator.today)}</span>
                    {indicator.unit ? <span className="cell-note">{indicator.unit}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn"
          data-testid="hh-add-indicator"
          onClick={() => setDraft({ ...draft, indicators: [...draft.indicators, blankIndicator(newId())] })}
        >
          Adicionar indicador
        </button>
      </section>

      <section className="hh-block" aria-labelledby="hh-invest-title">
        <div>
          <h2 id="hh-invest-title">Payback, ROI, VPL e TIR</h2>
          <p className="lede">
            A diferença de resultado, {formatBRL(view.monthlyDelta)} por mês, entra nos 60 meses. O investimento sai na
            data zero. É a mesma convenção da calculadora atual: ROI é o resultado incremental do ano dividido pelo
            investimento, e não é a TIR.
          </p>
        </div>
        <div className="hh-invest">
          <NumberField
            label="Investimento do robô"
            suffix="R$"
            min={0}
            testId="hh-investment"
            value={draft.investment}
            onChange={(investment) => setDraft({ ...draft, investment })}
          />
          <PercentField
            label="Taxa de desconto ao ano"
            testId="hh-discount"
            value={draft.discountRateAnnual}
            onChange={(discountRateAnnual) => setDraft({ ...draft, discountRateAnnual })}
          />
        </div>
        <div className="kpis hh-kpis">
          <article className="kpi accent">
            <span>Payback simples</span>
            <strong data-testid="hh-payback">{formatPayback(view.payback)}</strong>
            <em>Descontado {formatPayback(view.discountedPayback)}</em>
          </article>
          <article className="kpi accent">
            <span>ROI anual simples</span>
            <strong data-testid="hh-roi">{formatPercent(view.roi)}</strong>
            <em>
              {view.roi === null
                ? 'Não se aplica sem investimento positivo.'
                : `${formatBRL(view.annualDelta)} / ${formatBRL(view.investment)}`}
            </em>
          </article>
          <article className="kpi">
            <span>VPL a {formatPercent(draft.discountRateAnnual)}</span>
            <strong data-testid="hh-npv">{formatBRL(view.npv)}</strong>
            <em>Taxa efetiva anual, equivalente mensal</em>
          </article>
          <article className="kpi">
            <span>TIR anual efetiva</span>
            <strong data-testid="hh-irr">{formatIrr(view.irrAnnual)}</strong>
            <em>{view.irrAnnual === null ? 'Não há troca de sinal no caixa' : `Mensal ${formatPercent(view.irrMonthly, 2)}`}</em>
          </article>
        </div>
      </section>
    </div>
  );
}

function SectionBlock({
  section,
  draft,
  onLine,
  onRemoveLine,
  showMargin,
  margin,
  staff,
  onStaff,
  onRemoveStaff,
  onAddStaff,
}: {
  section: HeadToHeadSection;
  draft: HeadToHeadDraft;
  onLine: (id: string, patch: Partial<DreLine>) => void;
  onRemoveLine: (id: string) => void;
  showMargin: boolean;
  margin: { today: number; withRobot: number; delta: number };
  staff: StaffLine[] | null;
  onStaff: (id: string, patch: Partial<StaffLine>) => void;
  onRemoveStaff: (id: string) => void;
  onAddStaff: () => void;
}) {
  const lines = draft.lines.filter((line) => line.section === section);
  const hint =
    section === 'extra'
      ? 'A rede nomeia e escolhe se a linha aumenta ou reduz o resultado'
      : section === 'robo'
        ? 'Sai do resultado. No exemplo, só existe com o robô'
        : section === 'receita'
          ? 'Entra no resultado'
          : 'Sai do resultado';
  return (
    <>
      {staff ? (
        <>
          <tr className="hh-section">
            <th colSpan={4}>
              Pessoal por função <span>o custo por pessoa vale nas duas colunas; a diferença vem da quantidade</span>
            </th>
          </tr>
          {staff.map((line) => (
            <tr key={line.id}>
              <th scope="row">
                <div className="hh-label">
                  <input
                    type="text"
                    aria-label={`Função ${line.role}`}
                    value={line.role}
                    onChange={(event) => onStaff(line.id, { role: event.target.value })}
                  />
                  <div className="hh-inline">
                    <CellInput
                      label={`Custo mensal por pessoa — ${line.role}`}
                      suffix="R$"
                      value={line.monthlyCostPerPerson}
                      onChange={(monthlyCostPerPerson) => onStaff(line.id, { monthlyCostPerPerson })}
                    />
                    <button type="button" className="btn ghost hh-remove" onClick={() => onRemoveStaff(line.id)}>
                      Remover
                    </button>
                  </div>
                </div>
              </th>
              <td>
                <div className="hh-money">
                  <CellInput
                    label={`Pessoas hoje — ${line.role}`}
                    suffix="pessoas"
                    testId={line.id === 'balcao' ? 'hh-staff-balcao-today' : undefined}
                    value={line.todayHeadcount}
                    onChange={(todayHeadcount) => onStaff(line.id, { todayHeadcount })}
                  />
                  <strong>{formatBRL(Math.abs(signedStaff(line, 'today')))}</strong>
                </div>
              </td>
              <td>
                <div className="hh-money">
                  <CellInput
                    label={`Pessoas com robô — ${line.role}`}
                    suffix="pessoas"
                    value={line.withRobotHeadcount}
                    onChange={(withRobotHeadcount) => onStaff(line.id, { withRobotHeadcount })}
                  />
                  <strong>{formatBRL(Math.abs(signedStaff(line, 'withRobot')))}</strong>
                </div>
              </td>
              <td className="num">
                <span className={deltaClass(signedStaff(line, 'withRobot') - signedStaff(line, 'today'))}>
                  {formatImpact(signedStaff(line, 'withRobot') - signedStaff(line, 'today'))}
                </span>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={4}>
              <button type="button" className="btn" data-testid="hh-add-staff" onClick={onAddStaff}>
                Adicionar função
              </button>
            </td>
          </tr>
        </>
      ) : null}
      <tr className="hh-section">
        <th colSpan={4}>
          {sectionTitle(section)} <span>{hint}</span>
        </th>
      </tr>
      {lines.map((line) => {
        const today = signedLine(line, 'today');
        const withRobot = signedLine(line, 'withRobot');
        return (
          <tr key={line.id}>
            <th scope="row">
              <div className="hh-label">
                <input
                  type="text"
                  aria-label={`Nome da linha ${line.label}`}
                  value={line.label}
                  onChange={(event) => onLine(line.id, { label: event.target.value })}
                />
                {line.section === 'extra' ? (
                  <select
                    aria-label={`Efeito de ${line.label}`}
                    value={line.effect}
                    onChange={(event) => onLine(line.id, { effect: event.target.value === 'soma' ? 'soma' : 'subtrai' })}
                  >
                    <option value="soma">Aumenta o resultado</option>
                    <option value="subtrai">Reduz o resultado</option>
                  </select>
                ) : null}
                <button type="button" className="btn ghost hh-remove" onClick={() => onRemoveLine(line.id)}>
                  Remover
                </button>
              </div>
            </th>
            <td>
              <CellInput
                label={`Hoje — ${line.label}`}
                suffix="R$"
                testId={`hh-line-${line.id}-today`}
                value={line.today}
                onChange={(todayValue) => onLine(line.id, { today: todayValue })}
              />
            </td>
            <td>
              <CellInput
                label={`Com robô — ${line.label}`}
                suffix="R$"
                testId={`hh-line-${line.id}-robot`}
                value={line.withRobot}
                onChange={(withRobotValue) => onLine(line.id, { withRobot: withRobotValue })}
              />
            </td>
            <td className="num">
              <span className={deltaClass(withRobot - today)}>{formatImpact(withRobot - today)}</span>
            </td>
          </tr>
        );
      })}
      {showMargin ? (
        <tr className="hh-subtotal">
          <th scope="row">Margem após o CMV</th>
          <td className="num">
            <strong>{formatBRL(margin.today)}</strong>
          </td>
          <td className="num">
            <strong>{formatBRL(margin.withRobot)}</strong>
          </td>
          <td className="num">
            <span className={deltaClass(margin.delta)}>{formatImpact(margin.delta)}</span>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function deltaClass(value: number): string {
  if (Math.abs(value) < 0.5) return 'hh-delta flat';
  return value > 0 ? 'hh-delta up' : 'hh-delta down';
}

function CellInput({
  label,
  value,
  onChange,
  suffix,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  testId?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const shown = editing ?? (Number.isInteger(value) ? formatNumber(value) : formatNumber(value, 2));
  return (
    <span className="control">
      <input
        aria-label={label}
        data-testid={testId}
        inputMode="decimal"
        value={shown}
        onFocus={(event) => {
          const plain = Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
          setEditing(plain);
          requestAnimationFrame(() => event.target.select());
        }}
        onChange={(event) => {
          setEditing(event.target.value);
          const parsed = parseLocaleNumber(event.target.value);
          if (parsed === null) return;
          onChange(Math.max(0, parsed));
        }}
        onBlur={(event) => {
          if (parseLocaleNumber(event.target.value) === null) onChange(0);
          setEditing(null);
        }}
      />
      {suffix ? <i>{suffix}</i> : null}
    </span>
  );
}
