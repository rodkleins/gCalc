import { useState } from 'react';
import type { Confidence } from '../model/types';
import { formatNumber, parseLocaleNumber } from '../model/format';
import type { ModelResult } from '../model/types';
import { formatBRL } from '../model/format';

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  hint,
  min,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  hint?: string;
  min?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (Number.isInteger(value) ? formatNumber(value) : formatNumber(value, 2));
  return (
    <label className="field">
      <span>{label}</span>
      <span className="control">
        <input
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
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <NumberField
      label={label}
      value={Math.round(value * 10000) / 100}
      suffix="%"
      hint={hint}
      onChange={(next) => onChange(next / 100)}
    />
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  testId?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="control">
        <input data-testid={testId} value={value} onChange={(event) => onChange(event.target.value)} />
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="control">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
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
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`switch ${checked ? 'is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <i />
      {label}
    </button>
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
        <Switch checked={enabled} onChange={onEnabled} label={enabled ? 'Ativo' : 'Inativo'} />
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
