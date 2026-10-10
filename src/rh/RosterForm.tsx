import { createId } from '../model/storage';
import { formatBRL, formatNumber, parseLocaleNumber } from '../model/format';
import { Callout, FieldLabel, NumberField, PercentField, RemoveButton, StageNote, TextField, fieldHelpAttr, useFieldHelpEnabled } from '../components/Fields';
import {
  coverageMemory,
  postCoverage,
  shiftName,
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

function peopleLabel(value: number): string {
  return formatNumber(value, Number.isInteger(value) ? 0 : 2);
}

export function RosterSummary({ roster, storeType }: { roster: Roster; storeType: StoreType }) {
  const summary = summarizeRoster(roster);
  return (
    <div data-testid="roster-summary">
      <div className="table-wrap short">
        <table>
          <thead>
            <tr>
              <th>Quadro</th>
              {summary.shifts.map((_, index) => (
                <th key={shiftName(index, roster.shiftCount)} className="num">
                  {shiftName(index, roster.shiftCount)}
                </th>
              ))}
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Pessoas no turno</td>
              {summary.shifts.map((shift, index) => (
                <td key={`present-${index}`} className="num" data-testid={`shift-present-${index}`}>
                  {peopleLabel(shift.present)}
                </td>
              ))}
              <td className="num">{peopleLabel(summary.present)}</td>
            </tr>
            <tr>
              <td>Folguistas</td>
              {summary.shifts.map((shift, index) => (
                <td key={`relief-${index}`} className="num">
                  {peopleLabel(shift.folguista)}
                </td>
              ))}
              <td className="num" data-testid="roster-folguista">
                {peopleLabel(summary.folguista)}
              </td>
            </tr>
            <tr>
              <td>Pessoas contratadas</td>
              {summary.shifts.map((shift, index) => (
                <td key={`hired-${index}`} className="num">
                  {peopleLabel(shift.hired)}
                </td>
              ))}
              <td className="num" data-testid="roster-hired">
                {peopleLabel(summary.hired)}
              </td>
            </tr>
            <tr>
              <td>Folha do mês</td>
              {summary.shifts.map((shift, index) => (
                <td key={`pay-${index}`} className="num" data-testid={`shift-payroll-${index}`}>
                  {formatBRL(shift.payroll)}
                </td>
              ))}
              <td className="num" data-testid="roster-payroll">
                {formatBRL(summary.payroll)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
    </div>
  );
}

const SLOT_HELP = {
  onDuty:
    'Pessoas presentes neste turno, em quantidade. A folha multiplica este número pelo fator de cobertura e pelo custo mensal do cargo.',
  freed:
    'Posições deste turno que o robô libera, em quantidade, no máximo as pessoas no posto. A vaga evitada é este número vezes o fator de cobertura.',
  future:
    'Contratações que a loja faria neste turno a partir do mês 13, em quantidade. Entram no caixa só em loja existente, já com o fator de cobertura.',
} as const;

const FACTOR_HELP =
  'Fator calculado automaticamente pela escala, pelos dias de férias e pelas faltas. A unidade é pessoas contratadas por pessoa no turno. A folha multiplica as pessoas do turno por este fator e pelo custo mensal. Não se digita: mude a escala, as férias ou as faltas para recalcular.';

const OVERRIDE_HELP =
  'Substitui o fator calculado só neste posto. A unidade é pessoas contratadas por pessoa no turno. Preenchido, a folha usa este número no lugar da escala, das férias e das faltas. Vazio volta ao cálculo automático.';

function coverageSentence(memory: ReturnType<typeof coverageMemory>, roster: Roster): string {
  if (memory.availableDays <= 0) {
    return `${memory.scaleMeaning} Férias e faltas cobrem o ano, então o fator calculado é 0.`;
  }
  return `${memory.scaleMeaning} Fator calculado = ${memory.peoplePerSeatLabel} × ${roster.yearDays} / (${roster.yearDays} − ${roster.vacationDays} − ${roster.absenceDays}) = ${formatNumber(memory.suggested, 4)}. Folguista de ${formatNumber(memory.folguista, 4)} por pessoa neste turno.`;
}

function CountCell({
  value,
  testId,
  onChange,
  help,
}: {
  value: number;
  testId: string;
  onChange: (value: number) => void;
  help: string;
}) {
  const helpOn = useFieldHelpEnabled();
  return (
    <input
      className="roster-count"
      data-testid={testId}
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

export function RosterForm({
  roster,
  storeType,
  onChange,
}: {
  roster: Roster;
  storeType: StoreType;
  onChange: (roster: Roster) => void;
}) {
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
        O quadro é por posto: cargo, balcão e quantas pessoas estão em cada turno. Não há horário. Três turnos significam
        loja 24h. O folguista cobre folga, férias e faltas. A vaga evitada sai da posição que o robô libera, já com esse
        folguista. Não existe um campo de vaga à parte.
      </StageNote>
      <Callout>
        Supervisão, movimentação, inventário e horas realocadas ficam de fora desta versão. Essa gente já está na folha do
        quadro. Contar de novo seria pagar a mesma hora duas vezes.
      </Callout>
      <section className="card">
        <h2>Turnos da loja</h2>
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
        <div className="form-grid">
          <PercentField
            label="Adicional noturno"
            value={roster.nightPremiumPct}
            testId="night-premium"
            hint="Vale só no turno da noite, e só quando a loja tem 3 turnos. O padrão sugerido é 10%."
            help="Percentual sobre o custo mensal do cargo. Multiplica só a folha do turno da noite, e só quando a loja tem 3 turnos. Com 2 turnos fica guardado e não entra na conta. O padrão é 10%."
            onChange={(nightPremiumPct) => onChange({ ...roster, nightPremiumPct })}
          />
          <NumberField
            label="Dias de férias no ano"
            value={roster.vacationDays}
            min={0}
            testId="vacation-days"
            hint="Entram no fator calculado do folguista. O padrão é 30."
            help="Dias de férias por pessoa no ano. Entram no denominador do fator: dias do ano − férias − faltas. O padrão é 30. Mudar este número recalcula o fator de cada posto."
            onChange={(vacationDays) => onChange({ ...roster, vacationDays })}
          />
          <NumberField
            label="Faltas no ano"
            value={roster.absenceDays}
            min={0}
            testId="absence-days"
            hint="Também entram no fator calculado. O padrão é 6 dias."
            help="Dias de falta previstos no ano, não um percentual. Entram no denominador do fator junto com as férias. O padrão é 6. Mudar este número recalcula o fator de cada posto."
            onChange={(absenceDays) => onChange({ ...roster, absenceDays })}
          />
        </div>
        <p className="lede">
          Uma cadeira no turno pede gente contratada para cobrir a folga da escala, as férias e as faltas. O posto já é
          o turno: um turno de 8 horas não se converte em 12/8 nem em 12/48. 6x1 trabalha 6 e folga 1 (7/6 pessoas).
          5x2 trabalha 5 e folga 2 (7/5). 12x36 trabalha um dia e folga o outro, em turno de 12 horas (2 pessoas).
          Férias e faltas multiplicam esse número por dias do ano / (dias do ano − férias − faltas). O folguista é o
          fator menos 1. O fator de cada posto é calculado e fica somente leitura. Dias de férias e faltas continuam
          editáveis e recalculam esse fator.
        </p>
      </section>

      <section className="card">
        <h2>Pessoas e folha por turno</h2>
        <RosterSummary roster={roster} storeType={storeType} />
      </section>

        {roster.posts.map((item) => {
        const coverage = postCoverage(item, roster);
        const memory = coverageMemory(item.scale, roster);
        return (
          <section key={item.id} className="card" data-testid={`roster-post-${item.id}`}>
            <header className="benefit-head">
              <div>
                <h3>
                  {item.role || 'Cargo'} · {item.counter || 'Balcão'}
                </h3>
                <p>
                  Fator calculado {formatNumber(memory.suggested, 4)}
                  {' · '}
                  folguista de {formatNumber(memory.folguista, 4)} por pessoa no turno
                  {coverage.overridden ? ` · substituído por ${formatNumber(coverage.applied, 4)}` : ''}
                </p>
              </div>
              <RemoveButton confirm="Tirar este posto do quadro?" onRemove={() => onChange({ ...roster, posts: roster.posts.filter((post) => post.id !== item.id) })} />
            </header>
            <div className="form-grid">
              <TextField
                label="Cargo"
                help="Nome do cargo neste posto. A folha usa o custo mensal desta linha, não um salário à parte."
                value={item.role}
                testId={`post-role-${item.id}`}
                onChange={(role) => updatePost(item.id, { role })}
              />
              <TextField
                label="Balcão"
                help="Balcão ou setor do posto. Organiza o quadro e não entra como número no payback."
                value={item.counter}
                testId={`post-counter-${item.id}`}
                onChange={(counter) => updatePost(item.id, { counter })}
              />
              <label className="field">
                <FieldLabel
                  label="Escala"
                  help="Escala do posto. 6x1 pede 7/6 pessoas por cadeira, 5x2 pede 7/5 e 12x36 pede 2. Férias e faltas multiplicam esse número. O posto já é a cadeira do turno."
                />
                <span className="control">
                  <select
                    data-testid={`post-scale-${item.id}`}
                    {...fieldHelpAttr(
                      true,
                      'Escala do posto. 6x1 pede 7/6 pessoas por cadeira, 5x2 pede 7/5 e 12x36 pede 2. Férias e faltas multiplicam esse número. O posto já é a cadeira do turno.',
                    )}
                    value={item.scale}
                    onChange={(event) => updatePost(item.id, { scale: event.target.value as ScaleId })}
                  >
                    {SCALES.map((scale) => (
                      <option key={scale.value} value={scale.value}>
                        {scale.label}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <NumberField
                label="Custo por pessoa (R$/mês)"
                value={item.monthlyCost}
                suffix="R$"
                min={0}
                testId={`post-cost-${item.id}`}
                hint="Custo completo, sem o adicional noturno. A noite soma o adicional em cima deste valor."
                onChange={(monthlyCost) => updatePost(item.id, { monthlyCost })}
              />
              <label className="field">
                <FieldLabel label="Fator de cobertura" help={FACTOR_HELP} />
                <span className="control is-calculated">
                  <input
                    readOnly
                    tabIndex={0}
                    data-testid={`post-factor-${item.id}`}
                    aria-readonly="true"
                    {...fieldHelpAttr(true, FACTOR_HELP)}
                    value={formatNumber(memory.suggested, 4)}
                  />
                </span>
                <small data-testid={`post-coverage-${item.id}`}>{coverageSentence(memory, roster)}</small>
              </label>
            </div>
            {coverage.overridden ? (
              <p className="lede" data-testid={`post-override-notice-${item.id}`}>
                Um fator de {formatNumber(coverage.applied, 4)} está substituindo o cálculo ({formatNumber(coverage.suggested, 4)}) neste
                posto. Abra “Substituir o fator calculado” para voltar à conta da escala.
              </p>
            ) : null}
            <details className="advanced" data-testid={`post-override-advanced-${item.id}`}>
              <summary>Substituir o fator calculado</summary>
              <p className="lede">
                Preencher este campo substitui o cálculo automático só neste posto. A folha deixa de usar a escala, as férias e as
                faltas e passa a usar o número digitado. Vazio volta ao fator calculado.
              </p>
              <label className="field">
                <FieldLabel label="Fator que substitui o cálculo" help={OVERRIDE_HELP} />
                <span className="control">
                  <input
                    data-testid={`post-override-${item.id}`}
                    {...fieldHelpAttr(true, OVERRIDE_HELP)}
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
                <small>Vazio usa o fator calculado ({formatNumber(coverage.suggested, 4)}). Preenchido substitui a conta.</small>
              </label>
            </details>
            <div className="table-wrap short">
              <table className="roster-table">
                <thead>
                  <tr>
                    <th>No turno</th>
                    {Array.from({ length: roster.shiftCount }, (_, index) => (
                      <th key={index} className="num">
                        {shiftName(index, roster.shiftCount)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['onDuty', 'Pessoas no posto'],
                      ['freed', 'Posições que o robô libera'],
                      ['future', 'Contratação futura'],
                    ] as const
                  ).map(([key, label]) => (
                    <tr key={key}>
                      <td>
                        <FieldLabel label={label} help={SLOT_HELP[key]} />
                      </td>
                      {Array.from({ length: roster.shiftCount }, (_, index) => (
                        <td key={index} className="num">
                          <CountCell
                            value={item[key][index]}
                            testId={`${key}-${item.id}-${index}`}
                            help={SLOT_HELP[key]}
                            onChange={(value) => setSlot(item.id, key, index, value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

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
        Acrescentar posto
      </button>
    </div>
  );
}
