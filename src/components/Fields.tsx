import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import type { Confidence } from '../model/types';
import { formatNumber, parseLocaleNumber } from '../model/format';
import type { ModelResult } from '../model/types';
import { formatBRL } from '../model/format';

const PremiseFocusContext = createContext<string | null>(null);
const FieldHelpContext = createContext(false);

/** Liga a ajuda no rótulo. A calculadora da raiz não usa este provedor. */
export function FieldHelpProvider({ children }: { children: React.ReactNode }) {
  return <FieldHelpContext.Provider value={true}>{children}</FieldHelpContext.Provider>;
}

export function useFieldHelpEnabled(): boolean {
  return useContext(FieldHelpContext);
}

function helpText(help?: string, hint?: string): string | undefined {
  const text = (help ?? hint)?.trim();
  return text ? text : undefined;
}

export function fieldHelpAttr(enabled: boolean, text: string | undefined): { 'data-field-help'?: string } {
  return enabled && text ? { 'data-field-help': text } : {};
}

export function FieldTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const host = button.current?.parentElement;
      if (!host?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="field-help"
        aria-label={`Ajuda: ${label}`}
        aria-expanded={open}
        aria-describedby={id}
        data-field-help={text}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        ?
      </button>
      <span role="tooltip" id={id} className="field-tooltip">
        {text}
      </span>
    </>
  );
}

export function FieldLabel({ label, help }: { label: string; help?: string }) {
  const enabled = useFieldHelpEnabled();
  const text = help?.trim();
  if (!enabled || !text) return <span>{label}</span>;
  return (
    <span className="field-label">
      <span>{label}</span>
      <FieldTip label={label} text={text} />
    </span>
  );
}

export function PremiseFocus({ field, children }: { field: string | null; children: React.ReactNode }) {
  return <PremiseFocusContext.Provider value={field}>{children}</PremiseFocusContext.Provider>;
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  hint,
  help,
  min,
  fieldId,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  hint?: string;
  /** Texto do tooltip. Só aparece na versão que liga FieldHelpProvider. */
  help?: string;
  min?: number;
  fieldId?: string;
  testId?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const focused = useContext(PremiseFocusContext);
  const helpOn = useFieldHelpEnabled();
  const description = helpText(help, hint);
  const active = fieldId !== undefined && focused === fieldId;
  const root = useRef<HTMLLabelElement>(null);
  const shown = draft ?? (Number.isInteger(value) ? formatNumber(value) : formatNumber(value, 2));
  useEffect(() => {
    if (!active || !root.current) return;
    root.current.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    root.current.querySelector('input')?.focus();
  }, [active]);
  return (
    <label className={`field${active ? ' is-target' : ''}`} ref={root} data-field={fieldId}>
      <FieldLabel label={label} help={helpOn ? description : undefined} />
      <span className="control">
        <input
          data-testid={testId}
          {...fieldHelpAttr(helpOn, description)}
          inputMode="decimal"
          value={shown}
          onFocus={(event) => {
            const plain = Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
            setDraft(plain);
            requestAnimationFrame(() => event.target.select());
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            const parsed = parseLocaleNumber(event.target.value);
            if (parsed === null) return;
            onChange(min !== undefined ? Math.max(min, parsed) : parsed);
          }}
          onBlur={(event) => {
            if (parseLocaleNumber(event.target.value) === null) onChange(0);
            setDraft(null);
          }}
        />
        {suffix ? <i>{suffix}</i> : null}
      </span>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function PercentField({
  label,
  value,
  onChange,
  hint,
  help,
  fieldId,
  testId,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  help?: string;
  fieldId?: string;
  testId?: string;
}) {
  return (
    <NumberField
      label={label}
      value={Math.round(value * 10000) / 100}
      suffix="%"
      hint={hint}
      help={help}
      fieldId={fieldId}
      testId={testId}
      onChange={(next) => onChange(next / 100)}
    />
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  help,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  help?: string;
  testId?: string;
}) {
  const helpOn = useFieldHelpEnabled();
  const description = helpText(help, hint);
  return (
    <label className="field">
      <FieldLabel label={label} help={helpOn ? description : undefined} />
      <span className="control">
        <input
          data-testid={testId}
          {...fieldHelpAttr(helpOn, description)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  hint?: string;
  help?: string;
}) {
  const helpOn = useFieldHelpEnabled();
  const description = helpText(help, hint);
  return (
    <label className="field">
      <FieldLabel label={label} help={helpOn ? description : undefined} />
      <span className="control">
        <select {...fieldHelpAttr(helpOn, description)} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  help?: string;
}) {
  const helpOn = useFieldHelpEnabled();
  const description = help?.trim();
  const button = (
    <button
      type="button"
      className={`switch ${checked ? 'is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      {...fieldHelpAttr(helpOn, description)}
      onClick={() => onChange(!checked)}
    >
      <i />
      {label}
    </button>
  );
  if (!helpOn || !description) return button;
  return (
    <span className="field-label">
      {button}
      <FieldTip label={label} text={description} />
    </span>
  );
}

export function CheckField({
  checked,
  onChange,
  label,
  help,
  className = 'field check',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  help: string;
  className?: string;
}) {
  const helpOn = useFieldHelpEnabled();
  const description = help.trim();
  return (
    <label className={className}>
      <input
        type="checkbox"
        checked={checked}
        {...fieldHelpAttr(helpOn, description)}
        onChange={(event) => onChange(event.target.checked)}
      />
      <FieldLabel label={label} help={helpOn ? description : undefined} />
    </label>
  );
}

export function BenefitCard({
  title,
  description,
  enabled,
  confidence,
  onEnabled,
  onConfidence,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  confidence: Confidence;
  onEnabled: (value: boolean) => void;
  onConfidence: (value: Confidence) => void;
  children?: React.ReactNode;
}) {
  return (
    <section className={`card benefit ${enabled ? '' : 'is-off'}`}>
      <header className="benefit-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <Switch
          checked={enabled}
          onChange={onEnabled}
          label={enabled ? 'Ativo' : 'Inativo'}
          help="Liga ou desliga este benefício. Desligado, os valores deste cartão ficam fora do fluxo de caixa, do payback e do VPL."
        />
      </header>
      <SelectField
        label="Confiança"
        value={confidence}
        onChange={(value) => onConfidence(value as Confidence)}
        options={[
          { value: 'comprovavel', label: 'Comprovável' },
          { value: 'potencial', label: 'Potencial' },
        ]}
        hint="Potencial só entra no fluxo se a opção global estiver ligada."
      />
      {children ? <div className="form-grid">{children}</div> : null}
    </section>
  );
}

export function Callout({ children, tone = 'note' }: { children: React.ReactNode; tone?: 'note' | 'warn' }) {
  return <div className={`callout ${tone}`}>{children}</div>;
}

export function StageNote({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <details className="stage-note" data-testid={testId ?? 'stage-note'}>
      <summary>O que esta tela calcula</summary>
      <div className="stage-note-body">{children}</div>
    </details>
  );
}

export function ExcludedReason({ result, id }: { result: ModelResult; id: string }) {
  const line = result.audit.find((item) => item.id === id);
  if (!line || line.includedInCashFlow) return null;
  return (
    <p className="hint-block zero-reason" data-testid={`zero-reason-${id}`}>
      {line.reason}
    </p>
  );
}

export function ModuleImpact({ result, module }: { result: ModelResult; module: string }) {
  const lines = result.audit.filter((line) => line.module === module);
  if (lines.length === 0) {
    return (
      <aside className="impact">
        <strong>Contexto da loja</strong>
        <span>Estes dados alimentam os outros módulos. A economia entra em pessoas, logística, estoque e investimento.</span>
      </aside>
    );
  }
  const benefits = lines
    .filter((line) => line.includedInCashFlow && line.kind === 'recorrente')
    .reduce((total, line) => total + line.monthlyValue, 0);
  const costs = lines
    .filter((line) => line.includedInCashFlow && line.kind === 'custo' && line.monthlyValue > 0)
    .reduce((total, line) => total + line.monthlyValue, 0);
  const excluded = lines.filter((line) => !line.includedInCashFlow).length;
  return (
    <aside className="impact">
      <strong>
        {formatBRL(benefits)} de benefício por mês
        {costs > 0 ? ` · ${formatBRL(costs)} de custo` : ''}
      </strong>
      <span>
        {excluded > 0
          ? `${excluded} linha(s) fora do fluxo, por regra ou por estarem desligadas.`
          : 'Todas as linhas ativas deste módulo entram no fluxo.'}
      </span>
    </aside>
  );
}

/** Reserva a altura do rótulo para o botão ficar na mesma linha dos inputs. */
export function RemoveField({ children }: { children: React.ReactNode }) {
  return (
    <div className="field remove-field">
      <span className="remove-spacer" aria-hidden="true">
        &nbsp;
      </span>
      {children}
    </div>
  );
}

export function RemoveButton({
  onRemove,
  confirm,
  testId,
  label = 'Remover',
}: {
  onRemove: () => void;
  /** Texto da confirmação. Sem isso, o clique remove na hora. */
  confirm?: string;
  testId?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pending) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setPending(false);
    }
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setPending(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [pending]);

  return (
    <span className="remove-wrap" ref={root}>
      <button
        type="button"
        className="btn-remove"
        aria-label={label}
        title={label}
        data-tooltip={label}
        data-testid={testId}
        aria-expanded={confirm ? pending : undefined}
        onClick={() => {
          if (!confirm) {
            onRemove();
            return;
          }
          setPending((value) => !value);
        }}
      >
        <TrashIcon />
      </button>
      {pending && confirm ? (
        <span className="remove-confirm" role="group" aria-label="Confirmar remoção">
          <span>{confirm}</span>
          <span className="remove-confirm-actions">
            <button
              type="button"
              className="btn ghost"
              data-testid={testId ? `${testId}-cancel` : undefined}
              onClick={() => setPending(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn danger"
              data-testid={testId ? `${testId}-confirm` : undefined}
              onClick={() => {
                setPending(false);
                onRemove();
              }}
            >
              Remover
            </button>
          </span>
        </span>
      ) : null}
    </span>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M4 7h16M9 7V5h6v2M8 7l1 13h6l1-13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
