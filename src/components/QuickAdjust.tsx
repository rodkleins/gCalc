import { useEffect, useRef, useState } from 'react';
import { evaluate } from '../model/calculate';
import { formatBRL, formatIrr, formatNumber, formatPayback, formatPercent } from '../model/format';
import {
  ADJUST_MAX,
  ADJUST_MIN,
  QUICK_LEVERS,
  leverDelta,
  leversDiffer,
  leverValue,
  nudgeLever,
  withLeverValue,
  type LeverId,
} from '../model/premises';
import type { Inputs, ScenarioId } from '../model/types';
import { QUICK_ADJUST_OPEN_KEY, QUICK_DOCK_OPEN_KEY, readUiFlag, writeUiFlag } from '../model/uiChrome';
import { NumberField, PercentField } from './Fields';

export function QuickAdjust({
  inputs,
  anchor,
  scenario,
  onAdjust,
  onUndo,
  onOpen,
  storageKeys,
}: {
  inputs: Inputs;
  anchor: Inputs;
  scenario: ScenarioId;
  onAdjust: (inputs: Inputs) => void;
  onUndo: () => void;
  onOpen: (fieldId: string) => void;
  storageKeys?: { dock: string; adjust: string };
}) {
  const dockKey = storageKeys?.dock ?? QUICK_DOCK_OPEN_KEY;
  const adjustKey = storageKeys?.adjust ?? QUICK_ADJUST_OPEN_KEY;
  const current = evaluate(inputs, { scenario });
  const base = evaluate(anchor, { scenario });
  const changed = leversDiffer(inputs, anchor);
  const dockRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(() => readUiFlag(localStorage, dockKey) === true);
  const [expanded, setExpanded] = useState(() => readUiFlag(localStorage, adjustKey) !== false);

  useEffect(() => {
    writeUiFlag(localStorage, dockKey, open);
  }, [open, dockKey]);

  useEffect(() => {
    writeUiFlag(localStorage, adjustKey, expanded);
  }, [expanded, adjustKey]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!dockRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function setAbsolute(id: LeverId, absolute: number) {
    onAdjust(withLeverValue(inputs, anchor, id, absolute));
  }

  function slide(id: LeverId, percent: number) {
    const origin = leverValue(anchor, id);
    if (!(origin > 0)) return;
    setAbsolute(id, origin * (1 + percent / 100));
  }

  return (
    <section className="card quick-adjust" data-testid="quick-adjust" aria-label="Ajuste rápido">
      <header className="quick-head">
        <button
          type="button"
          className="quick-head-toggle"
          data-testid="quick-adjust-toggle"
          aria-expanded={expanded}
          aria-controls="quick-adjust-body"
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="quick-head-copy">
            <span className="eyebrow">Ajuste rápido</span>
            <span className="quick-title">Premissas-chave</span>
          </span>
          <span className="quick-head-state">{expanded ? 'Recolher' : 'Expandir'}</span>
        </button>
      </header>
      <p className="lede" hidden={!expanded}>
        O slider e os botões vão de −100% a +30% do valor original. O número aceita zero e qualquer valor acima disso. O
        resultado muda na hora.
      </p>
      <div
        className={open ? 'quick-dock is-open' : 'quick-dock'}
        data-testid="quick-dock"
        ref={dockRef}
      >
        <button
          type="button"
          className="quick-dock-chip"
          data-testid="quick-dock-toggle"
          aria-expanded={open}
          aria-controls="quick-dock-panel"
          onClick={() => setOpen((value) => !value)}
        >
          <span>
            <small>Payback</small>
            <strong>{formatPayback(current.payback)}</strong>
          </span>
          <span>
            <small>ROI</small>
            <strong>{formatPercent(current.roi)}</strong>
          </span>
          <span className="chip-extra">
            <small>VPL</small>
            <strong>{formatBRL(current.npv)}</strong>
          </span>
          <span className="chip-extra">
            <small>TIR</small>
            <strong>{formatIrr(current.irrAnnual)}</strong>
          </span>
        </button>
        <div
          className="quick-dock-panel"
          id="quick-dock-panel"
          data-testid="quick-dock-panel"
          hidden={!open}
        >
          <article data-testid="quick-kpi-payback">
            <span>Payback</span>
            <strong>{formatPayback(current.payback)}</strong>
            <em>{signedMonths(current.payback, base.payback)}</em>
          </article>
          <article data-testid="quick-kpi-roi">
            <span>ROI</span>
            <strong>{formatPercent(current.roi)}</strong>
            <em>{signedPercent(current.roi !== null && base.roi !== null ? current.roi - base.roi : null)}</em>
          </article>
          <article data-testid="quick-kpi-npv">
            <span>VPL</span>
            <strong>{formatBRL(current.npv)}</strong>
            <em>{signedMoney(current.npv - base.npv)}</em>
          </article>
          <article data-testid="quick-kpi-irr">
            <span>TIR</span>
            <strong>{formatIrr(current.irrAnnual)}</strong>
            <em>
              {current.irrAnnual === null
                ? 'Sem troca de sinal'
                : signedPercent(base.irrAnnual === null ? null : current.irrAnnual - base.irrAnnual)}
            </em>
          </article>
          <button type="button" className="btn" data-testid="quick-undo" disabled={!changed} onClick={onUndo}>
            Desfazer ajuste
          </button>
        </div>
      </div>
      <div className="quick-levers" id="quick-adjust-body" hidden={!expanded}>
        {QUICK_LEVERS.map((lever) => {
          const delta = leverDelta(inputs, anchor, lever.id);
          const origin = leverValue(anchor, lever.id);
          const slider = delta === null ? 0 : Math.round(Math.min(ADJUST_MAX, Math.max(ADJUST_MIN, delta)) * 100);
          return (
            <div className="lever" key={lever.id}>
              <button
                type="button"
                className="premise-link"
                data-field={lever.fieldId}
                onClick={() => onOpen(lever.fieldId)}
              >
                {lever.label}
              </button>
              {lever.kind === 'percent' ? (
                <PercentField
                  label="Valor atual"
                  testId={`quick-${lever.id}-value`}
                  value={leverValue(inputs, lever.id)}
                  onChange={(value) => setAbsolute(lever.id, value)}
                />
              ) : (
                <NumberField
                  label="Valor atual"
                  testId={`quick-${lever.id}-value`}
                  suffix={lever.id === 'volume' ? '/dia' : 'R$'}
                  min={0}
                  value={leverValue(inputs, lever.id)}
                  onChange={(value) => setAbsolute(lever.id, value)}
                />
              )}
              <div className="lever-controls">
                <button
                  type="button"
                  className="btn ghost"
                  data-testid={`quick-${lever.id}-down`}
                  aria-label={`Diminuir ${lever.label}`}
                  disabled={!(origin > 0) || (delta !== null && delta <= ADJUST_MIN + 1e-9)}
                  onClick={() => onAdjust(nudgeLever(inputs, anchor, lever.id, -1))}
                >
                  −
                </button>
                <input
                  type="range"
                  min={ADJUST_MIN * 100}
                  max={ADJUST_MAX * 100}
                  step={1}
                  value={slider}
                  disabled={!(origin > 0)}
                  aria-label={`Variação de ${lever.label}`}
                  data-testid={`quick-${lever.id}-slider`}
                  onChange={(event) => {
                    if (document.activeElement !== event.currentTarget) return;
                    slide(lever.id, Number(event.currentTarget.value));
                  }}
                />
                <button
                  type="button"
                  className="btn ghost"
                  data-testid={`quick-${lever.id}-up`}
                  aria-label={`Aumentar ${lever.label}`}
                  disabled={!(origin > 0) || (delta !== null && delta >= ADJUST_MAX - 1e-9)}
                  onClick={() => onAdjust(nudgeLever(inputs, anchor, lever.id, 1))}
                >
                  +
                </button>
                <span className="lever-delta">{formatDelta(delta)}</span>
              </div>
              <p className="hint-block">{lever.hint}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatDelta(delta: number | null): string {
  if (delta === null) return 'sem base';
  const percent = Math.round(delta * 1000) / 10;
  if (Math.abs(percent) < 0.05) return '0%';
  return `${percent > 0 ? '+' : '−'}${formatNumber(Math.abs(percent), 1)}%`;
}

function signedMonths(current: number | null, base: number | null): string {
  if (current === null || base === null) return '—';
  const delta = current - base;
  if (Math.abs(delta) < 0.05) return 'igual ao original';
  return `${delta > 0 ? '+' : '−'}${formatNumber(Math.abs(delta), 1)} meses vs original`;
}

function signedPercent(delta: number | null): string {
  if (delta === null) return '—';
  if (Math.abs(delta) < 0.0005) return 'igual ao original';
  return `${delta > 0 ? '+' : '−'}${formatPercent(Math.abs(delta))} vs original`;
}

function signedMoney(delta: number): string {
  if (Math.abs(delta) < 0.5) return 'igual ao original';
  return `${delta > 0 ? '+' : '−'}${formatBRL(Math.abs(delta))} vs original`;
}
