import { useEffect, useRef, useState } from 'react';
import { resultStamp } from '../model/benefitStatus';
import { evaluate } from '../model/calculate';
import { formatBRL, formatIrr, formatNumber, formatPayback, formatPercent } from '../model/format';
import { leversDiffer } from '../model/premises';
import type { Inputs, ModelResult, ScenarioId } from '../model/types';
import { QUICK_DOCK_OPEN_KEY, readUiFlag, writeUiFlag } from '../model/uiChrome';

export function FloatingPayback({
  inputs,
  anchor,
  scenario,
  result,
  onUndo,
  storageKey = QUICK_DOCK_OPEN_KEY,
}: {
  inputs: Inputs;
  anchor: Inputs;
  scenario: ScenarioId;
  result: ModelResult;
  onUndo: () => void;
  storageKey?: string;
}) {
  const baseline = evaluate(anchor, { scenario });
  const changed = leversDiffer(inputs, anchor);
  const dockRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(() => readUiFlag(localStorage, storageKey) === true);

  useEffect(() => {
    writeUiFlag(localStorage, storageKey, open);
  }, [open, storageKey]);

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

  return (
    <div
      className={open ? 'quick-dock is-open' : 'quick-dock'}
      data-testid="quick-dock"
      data-result-stamp={resultStamp(result)}
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
          <strong>{formatPayback(result.payback)}</strong>
        </span>
        <span>
          <small>ROI</small>
          <strong>{formatPercent(result.roi)}</strong>
        </span>
        <span className="chip-extra">
          <small>VPL</small>
          <strong>{formatBRL(result.npv)}</strong>
        </span>
        <span className="chip-extra">
          <small>TIR</small>
          <strong>{formatIrr(result.irrAnnual)}</strong>
        </span>
      </button>
      <div className="quick-dock-panel" id="quick-dock-panel" data-testid="quick-dock-panel" hidden={!open}>
        <article data-testid="quick-kpi-payback">
          <span>Payback</span>
          <strong>{formatPayback(result.payback)}</strong>
          <em>{signedMonths(result.payback, baseline.payback)}</em>
        </article>
        <article data-testid="quick-kpi-roi">
          <span>ROI</span>
          <strong>{formatPercent(result.roi)}</strong>
          <em>{signedPercent(result.roi !== null && baseline.roi !== null ? result.roi - baseline.roi : null)}</em>
        </article>
        <article data-testid="quick-kpi-npv">
          <span>VPL</span>
          <strong>{formatBRL(result.npv)}</strong>
          <em>{signedMoney(result.npv - baseline.npv)}</em>
        </article>
        <article data-testid="quick-kpi-irr">
          <span>TIR</span>
          <strong>{formatIrr(result.irrAnnual)}</strong>
          <em>
            {result.irrAnnual === null
              ? 'Sem troca de sinal'
              : signedPercent(baseline.irrAnnual === null ? null : result.irrAnnual - baseline.irrAnnual)}
          </em>
        </article>
        <button type="button" className="btn" data-testid="quick-undo" disabled={!changed} onClick={onUndo}>
          Desfazer ajuste
        </button>
      </div>
    </div>
  );
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
