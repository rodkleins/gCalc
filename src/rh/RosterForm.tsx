import { useState } from 'react';
import { createId } from '../model/storage';
import { formatBRL, formatNumber, parseLocaleNumber } from '../model/format';
import { Callout, FieldLabel, FieldTip, NumberField, PercentField, RemoveButton, StageNote, fieldHelpAttr, useFieldHelpEnabled } from '../components/Fields';
import { rosterWarnings } from './importCheck';
import {
  coverageFactor,
  coverageMemory,
  postCoverage,
  shiftName,
  shiftNightMultiplier,
  summarizeRoster,
  type Roster,
  type RosterPost,
  type ScaleId,
  type ShiftCount,
} from './roster';
import type { StoreType } from '../model/types';

const SCALES: Array<{ value: ScaleId; label: string }> = [
  { value: '6x1', label: '6x1' },
  { value: '5x2', label: '5x2' },
  { value: '12x36', label: '12x36' },
];

const HELP = {
  role: 'Nome do cargo nesta linha. Cargos com custo diferente, como o auxiliar do dia e o auxiliar noturno, ficam em linhas separadas. A folha usa o custo desta linha.',
  counter: 'Balcão ou setor desta linha. Organiza o quadro e não entra como número no payback.',
  scale:
    'Escala da linha. 6x1 pede 7/6 pessoas por cadeira, 5x2 pede 7/5 e 12x36 pede 2. Férias e faltas multiplicam esse número. O posto já é a cadeira do turno.',
  cost: 'Custo completo por pessoa por mês, em R$, já com encargos e benefícios. A mesma regra vale para todos os cargos, inclusive o gerente. Não há um fator extra de 1,3333. O adicional noturno entra à parte, só na noite.',
  onDuty:
    'Pessoas presentes neste turno, em quantidade. A folha multiplica este número pelo fator de cobertura e pelo custo mensal do cargo.',
  freed:
    'Posições deste turno que o robô libera, em quantidade, no máximo as pessoas no posto. A vaga evitada é este número vezes o fator de cobertura. Zero em todos zera a economia de pessoal.',
  future:
    'Contratações que a loja faria neste turno a partir do mês 13, em quantidade. Entram no caixa só em loja existente, já com o fator de cobertura.',
  factor:
    'Fator calculado automaticamente pela escala, pelos dias de férias e pelas faltas. A unidade é pessoas contratadas por pessoa no turno. Não se digita.',
  night: 'Percentual do adicional noturno. No JSON a unidade é fração: 10% fica gravado como 0,10. A faixa é de 0% a 50%. O padrão das notas é 10%. Só multiplica a folha do turno da noite, e só com 3 turnos.',
  vacation:
    'Dias de férias por pessoa no ano. Entram no denominador do fator: dias do ano − férias − faltas. O padrão é 30. Mudar este número recalcula o folguista de cada linha.',
  absence:
    'Dias de falta previstos no ano, não um percentual. Entram no denominador do fator junto com as férias. O padrão é 6. Mudar este número recalcula o folguista.',
  override:
    'Substitui o fator calculado só nesta linha. A unidade é pessoas contratadas por pessoa no turno. Preenchido, a folha usa este número no lugar da escala, das férias e das faltas. Vazio volta ao cálculo automático.',
} as const;

function peopleLabel(value: number): string {
  return formatNumber(value, Number.isInteger(value) ? 0 : 2);
}

function coverageSentence(post: RosterPost, roster: Roster): string {
  const memory = coverageMemory(post.scale, roster);
  if (memory.availableDays <= 0) {
    return `${memory.scaleMeaning} Férias e faltas cobrem o ano, então o fator calculado é 0.`;
  }
  return `${memory.scaleMeaning} Fator calculado = ${memory.peoplePerSeatLabel} × ${roster.yearDays} / (${roster.yearDays} − ${roster.vacationDays} − ${roster.absenceDays}) = ${formatNumber(memory.suggested, 4)}. Folguista de ${formatNumber(memory.folguista, 4)} por pessoa neste turno.`;
}

function CountCell({
  value,
  testId,
  help,
  label,
  onChange,
}: {
  value: number;
  testId: string;
  help: string;
  label: string;
  onChange: (value: number) => void;
}) {
  const helpOn = useFieldHelpEnabled();
  return (
    <input
      className="roster-count"
      data-testid={testId}
      aria-label={label}
      inputMode="decimal"
      {...fieldHelpAttr(helpOn, help)}
      value={Number.isInteger(value) ? String(value) : String(value).replace('.', ',')}
      onChange={(event) => {
        const parsed = parseLocaleNumber(event.target.value);
        if (parsed === null) return;
        onChange(Math.max(0, parsed));
      }}
    />
  );
}

function MoneyCell({
  value,
  testId,
  onChange,
}: {
  value: number;
  testId: string;
  onChange: (value: number) => void;
}) {
  const helpOn = useFieldHelpEnabled();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? formatNumber(value);
  return (
    <input
      className="roster-count"
      data-testid={testId}
      aria-label="Custo por pessoa"
      inputMode="decimal"
      {...fieldHelpAttr(helpOn, HELP.cost)}
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
        onChange(Math.max(0, parsed));
      }}
      onBlur={(event) => {
        if (parseLocaleNumber(event.target.value) === null) onChange(0);
        setDraft(null);
      }}
    />
  );
}

function roleTotals(roster: Roster) {
  const map = new Map<string, { role: string; present: number; hired: number; payroll: number }>();
  for (const post of roster.posts) {
    const factor = coverageFactor(post, roster);
    const key = post.role.trim() || 'Cargo';
    const bucket = map.get(key) ?? { role: key, present: 0, hired: 0, payroll: 0 };
    for (let index = 0; index < roster.shiftCount; index += 1) {
      const present = Math.max(0, post.onDuty[index] ?? 0);
      const hired = present * factor;
      bucket.present += present;
      bucket.hired += hired;
      bucket.payroll += hired * Math.max(0, post.monthlyCost) * shiftNightMultiplier(index, roster);
    }
    map.set(key, bucket);
  }
  return [...map.values()];
}

export function RosterForm({
  roster,
  storeType,
  onChange,
}: {
  roster: Roster;
  storeType: StoreType;
  onChange: (roster: Roster) => void;
}) {
  const summary = summarizeRoster(roster);
  const warnings = rosterWarnings(roster);
  const totals = roleTotals(roster);

  function updatePost(id: string, patch: Partial<RosterPost>) {
    onChange({
      ...roster,
      posts: roster.posts.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  function setSlot(id: string, key: 'onDuty' | 'freed' | 'future', index: number, value: number) {
    const current = roster.posts.find((item) => item.id === id);
    if (!current) return;
    const next = [...current[key]] as [number, number, number];
    next[index] = value;
    updatePost(id, { [key]: next });
  }

  return (
    <div className="stack roster-form">
      <StageNote>
        Uma linha é um cargo na sua escala, com o custo e a quantidade em cada turno. O folguista sai sozinho dessa
        escala, das férias e das faltas. O custo já inclui encargos e benefícios, no mesmo critério para todos os
        cargos.
      </StageNote>
      <Callout>
        O custo da linha já inclui encargos e benefícios. Não existe um fator extra, como 1,3333, aplicado só ao gerente
        ou só a alguns cargos. O perfil da loja repete estes custos. O adicional noturno é outra conta: no JSON, 10% é a
        fração 0,10 e só entra no turno da noite.
      </Callout>
      {warnings.length > 0 ? (
        <div className="callout warn" data-testid="roster-warnings">
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <section className="card">
        <h2>Quadro por turno</h2>
        <div className="seg" role="group" aria-label="Quantidade de turnos" data-testid="shift-count">
          {([2, 3] as const).map((count) => (
            <button
              key={count}
              type="button"
              data-testid={`shift-count-${count}`}
              className={roster.shiftCount === count ? 'is-active' : ''}
              aria-pressed={roster.shiftCount === count}
              onClick={() => onChange({ ...roster, shiftCount: count satisfies ShiftCount })}
            >
              {count === 2 ? '2 turnos' : '3 turnos (24h)'}
            </button>
          ))}
        </div>
        <p className="lede">
          As células são o número de postos naquele turno. O total de cada linha e o total de cada turno são calculados.
          O folguista é somente leitura. As colunas marcadas são os postos que o robô evita.
        </p>
        <div className="table-wrap roster-sheet" data-testid="roster-sheet">
          <table data-testid="roster-summary">
            <thead>
              <tr>
                <th className="sticky-col" rowSpan={2}>
                  <FieldLabel label="Cargo" help={HELP.role} />
                </th>
                <th rowSpan={2}>
                  <FieldLabel label="Balcão" help={HELP.counter} />
                </th>
                <th rowSpan={2}>
                  <FieldLabel label="Escala" help={HELP.scale} />
                </th>
                <th rowSpan={2}>
                  <FieldLabel label="Custo (R$/mês)" help={HELP.cost} />
                </th>
                <th colSpan={roster.shiftCount}>Pessoas no turno</th>
                <th rowSpan={2}>
                  <FieldLabel label="Fator" help={HELP.factor} />
                </th>
                <th rowSpan={2}>Folguista</th>
                <th rowSpan={2}>Contratados</th>
                <th rowSpan={2}>Folha</th>
                <th className="is-freed" colSpan={roster.shiftCount}>
                  Robô evita
                </th>
                <th rowSpan={2} />
              </tr>
              <tr>
                {Array.from({ length: roster.shiftCount }, (_, index) => (
                  <th key={`people-${index}`} className="num">
                    {shiftName(index, roster.shiftCount)}
                  </th>
                ))}
                {Array.from({ length: roster.shiftCount }, (_, index) => (
                  <th key={`freed-${index}`} className="num is-freed">
                    <FieldLabel label={shiftName(index, roster.shiftCount)} help={HELP.freed} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roster.posts.map((item) => {
                const coverage = postCoverage(item, roster);
                const sentence = coverageSentence(item, roster);
                let present = 0;
                let hired = 0;
                let payroll = 0;
                for (let index = 0; index < roster.shiftCount; index += 1) {
                  const seats = Math.max(0, item.onDuty[index] ?? 0);
                  const lineHired = seats * coverage.applied;
                  present += seats;
                  hired += lineHired;
                  payroll += lineHired * Math.max(0, item.monthlyCost) * shiftNightMultiplier(index, roster);
                }
                const folguista = hired - present;
                return (
                  <tr key={item.id} data-testid={`roster-post-${item.id}`}>
                    <td className="sticky-col">
                      <input
                        className="roster-text"
                        data-testid={`post-role-${item.id}`}
                        aria-label="Cargo"
                        {...fieldHelpAttr(true, HELP.role)}
                        value={item.role}
                        onChange={(event) => updatePost(item.id, { role: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="roster-text"
                        data-testid={`post-counter-${item.id}`}
                        aria-label="Balcão"
                        {...fieldHelpAttr(true, HELP.counter)}
                        value={item.counter}
                        onChange={(event) => updatePost(item.id, { counter: event.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        data-testid={`post-scale-${item.id}`}
                        aria-label="Escala"
                        {...fieldHelpAttr(true, HELP.scale)}
                        value={item.scale}
                        onChange={(event) => updatePost(item.id, { scale: event.target.value as ScaleId })}
                      >
                        {SCALES.map((scale) => (
                          <option key={scale.value} value={scale.value}>
                            {scale.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num">
                      <MoneyCell
                        value={item.monthlyCost}
                        testId={`post-cost-${item.id}`}
                        onChange={(monthlyCost) => updatePost(item.id, { monthlyCost })}
                      />
                    </td>
                    {Array.from({ length: roster.shiftCount }, (_, index) => (
                      <td key={`on-${index}`} className="num">
                        <CountCell
                          value={item.onDuty[index]}
                          testId={`onDuty-${item.id}-${index}`}
                          help={HELP.onDuty}
                          label={`Pessoas no ${shiftName(index, roster.shiftCount)}`}
                          onChange={(value) => setSlot(item.id, 'onDuty', index, value)}
                        />
                      </td>
                    ))}
                    <td className="num">
                      <span className="field-label">
                        <output data-testid={`post-factor-${item.id}`}>{formatNumber(coverage.suggested, 4)}</output>
                        <FieldTip label="Fator de cobertura" text={sentence} />
                      </span>
                      <span className="roster-memory" data-testid={`post-coverage-${item.id}`}>
                        {sentence}
                      </span>
                      {coverage.overridden ? <span className="cell-note">substituído por {formatNumber(coverage.applied, 4)}</span> : null}
                    </td>
                    <td className="num">{peopleLabel(Math.max(0, folguista))}</td>
                    <td className="num">{peopleLabel(hired)}</td>
                    <td className="num">{formatBRL(payroll)}</td>
                    {Array.from({ length: roster.shiftCount }, (_, index) => (
                      <td key={`free-${index}`} className="num is-freed">
                        <CountCell
                          value={item.freed[index]}
                          testId={`freed-${item.id}-${index}`}
                          help={HELP.freed}
                          label={`Robô evita no ${shiftName(index, roster.shiftCount)}`}
                          onChange={(value) => setSlot(item.id, 'freed', index, value)}
                        />
                      </td>
                    ))}
                    <td>
                      <RemoveButton
                        confirm="Tirar esta linha do quadro?"
                        onRemove={() => onChange({ ...roster, posts: roster.posts.filter((post) => post.id !== item.id) })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky-col">Total</td>
                <td />
                <td />
                <td />
                {summary.shifts.map((shift, index) => (
                  <td key={`present-${index}`} className="num" data-testid={`shift-present-${index}`}>
                    {peopleLabel(shift.present)}
                  </td>
                ))}
                <td />
                <td className="num" data-testid="roster-folguista">
                  {peopleLabel(summary.folguista)}
                </td>
                <td className="num" data-testid="roster-hired">
                  {peopleLabel(summary.hired)}
                </td>
                <td className="num" data-testid="roster-payroll">
                  {formatBRL(summary.payroll)}
                </td>
                {summary.shifts.map((shift, index) => (
                  <td key={`freed-total-${index}`} className="num is-freed" data-testid={`shift-freed-${index}`}>
                    {peopleLabel(shift.freedPresent)}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <ul className="roster-role-totals" data-testid="roster-role-totals">
          {totals.map((role) => (
            <li key={role.role}>
              {role.role}: {peopleLabel(role.present)} no turno, {peopleLabel(role.hired)} contratadas, {formatBRL(role.payroll)}
            </li>
          ))}
        </ul>
        <p className="lede" data-testid="roster-avoided">
          O robô libera{' '}
          {summary.shifts
            .map((shift, index) => `${peopleLabel(shift.freedPresent)} no ${shiftName(index, roster.shiftCount).toLowerCase()}`)
            .join(', ')}
          . Com o folguista, isso vira {peopleLabel(summary.avoidedHired)} vagas evitadas e {formatBRL(summary.avoidedPayroll)} de
          folha por mês. A rescisão é {formatBRL(summary.severance)}
          {storeType === 'existente' ? ', um mês dessa folha, e entra no caixa.' : ' e não entra no caixa: em loja nova a vaga não chega a ser contratada.'}{' '}
          A contratação futura, no mês 13, soma {peopleLabel(summary.futureHired)} vagas e {formatBRL(summary.futurePayroll)} por mês
          {storeType === 'existente' ? '.' : ', e só passa a valer se a loja for existente.'}
        </p>
        <button
          type="button"
          className="btn"
          data-testid="add-roster-post"
          onClick={() =>
            onChange({
              ...roster,
              posts: [
                ...roster.posts,
                {
                  id: createId(),
                  role: 'Auxiliar de farmácia',
                  counter: 'Balcão',
                  scale: '6x1',
                  monthlyCost: 4_200,
                  onDuty: [0, 0, 0],
                  freed: [0, 0, 0],
                  future: [0, 0, 0],
                  coverageOverride: null,
                },
              ],
            })
          }
        >
          Acrescentar linha
        </button>
        <details className="advanced" data-testid="roster-advanced">
          <summary>Parâmetros avançados</summary>
          <p className="lede">
            Férias, faltas e o adicional noturno recalculam o folguista de todas as linhas. A contratação futura entra no mês
            13. Substituir o fator troca a conta só naquela linha e deixa de usar a escala.
          </p>
          <div className="form-grid">
            <PercentField
              label="Adicional noturno"
              value={roster.nightPremiumPct}
              testId="night-premium"
              hint="Fração no JSON: 10% = 0,10. Faixa de 0% a 50%. Só vale no turno da noite, com 3 turnos."
              help={HELP.night}
              onChange={(nightPremiumPct) => onChange({ ...roster, nightPremiumPct: Math.min(0.5, Math.max(0, nightPremiumPct)) })}
            />
            <NumberField
              label="Dias de férias no ano"
              value={roster.vacationDays}
              min={0}
              testId="vacation-days"
              hint="Entram no folguista. O padrão é 30."
              help={HELP.vacation}
              onChange={(vacationDays) => onChange({ ...roster, vacationDays })}
            />
            <NumberField
              label="Faltas no ano"
              value={roster.absenceDays}
              min={0}
              testId="absence-days"
              hint="Dias, não percentual. O padrão é 6."
              help={HELP.absence}
              onChange={(absenceDays) => onChange({ ...roster, absenceDays })}
            />
          </div>
          {roster.posts.map((item) => {
            const coverage = postCoverage(item, roster);
            return (
              <details key={item.id} className="advanced" data-testid={`post-override-advanced-${item.id}`}>
                <summary>
                  {item.role || 'Cargo'} · {item.counter || 'Balcão'}
                </summary>
                <p className="lede">
                  Preencher o fator substitui o cálculo automático só nesta linha. A folha deixa de usar a escala, as férias e as
                  faltas e passa a usar o número digitado. Vazio volta ao fator calculado ({formatNumber(coverage.suggested, 4)}).
                </p>
                <label className="field">
                  <FieldLabel label="Fator que substitui o cálculo" help={HELP.override} />
                  <span className="control">
                    <input
                      data-testid={`post-override-${item.id}`}
                      aria-label="Fator que substitui o cálculo"
                      {...fieldHelpAttr(true, HELP.override)}
                      inputMode="decimal"
                      placeholder={formatNumber(coverage.suggested, 4)}
                      value={item.coverageOverride === null ? '' : String(item.coverageOverride).replace('.', ',')}
                      onChange={(event) => {
                        const text = event.target.value.trim();
                        if (!text) {
                          updatePost(item.id, { coverageOverride: null });
                          return;
                        }
                        const parsed = parseLocaleNumber(text);
                        if (parsed === null) return;
                        updatePost(item.id, { coverageOverride: Math.max(0, parsed) });
                      }}
                    />
                  </span>
                  <small>Vazio usa o fator calculado. Preenchido substitui a conta.</small>
                </label>
                <div className="form-grid">
                  {Array.from({ length: roster.shiftCount }, (_, index) => (
                    <label key={index} className="field">
                      <FieldLabel label={`Contratação futura · ${shiftName(index, roster.shiftCount)}`} help={HELP.future} />
                      <CountCell
                        value={item.future[index]}
                        testId={`future-${item.id}-${index}`}
                        help={HELP.future}
                        label={`Contratação futura no ${shiftName(index, roster.shiftCount)}`}
                        onChange={(value) => setSlot(item.id, 'future', index, value)}
                      />
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
        </details>
      </section>
    </div>
  );
}
