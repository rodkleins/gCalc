import { useEffect, useState } from 'react';
import { formatBRL, formatPayback, formatPercent, scenarioLabel, storeLabel } from '../model/format';
import type { Inputs, ModelResult, PlannedHire, ScenarioId, SpaceMode } from '../model/types';
import {
  otherCapex,
  totalOpex,
  validateWizardStep,
  withOtherCapex,
  withTotalOpex,
  WIZARD_STEPS,
} from '../model/wizard';
import { NumberField, PercentField, Switch, TextField } from './Fields';

export function Wizard({
  inputs,
  scenario,
  step,
  result,
  onInputs,
  onScenario,
  onStep,
  onExit,
}: {
  inputs: Inputs;
  scenario: ScenarioId;
  step: number;
  result: ModelResult;
  onInputs: (inputs: Inputs) => void;
  onScenario: (scenario: ScenarioId) => void;
  onStep: (step: number) => void;
  onExit: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
  }, [step, inputs, scenario]);
  const current = WIZARD_STEPS[step] ?? WIZARD_STEPS[0];
  const last = step >= WIZARD_STEPS.length - 1;

  function go(next: number) {
    setError(null);
    onStep(next);
  }

  function advance() {
    const message = validateWizardStep(step, inputs);
    if (message) {
      setError(message);
      return;
    }
    if (last) {
      onExit();
      return;
    }
    go(step + 1);
  }

  return (
    <section className="wizard" data-testid="wizard" aria-labelledby="wizard-title">
      <div className="wizard-progress">
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={WIZARD_STEPS.length}
          aria-valuenow={step + 1}
          aria-label="Progresso do assistente"
        >
          <div className="progress-fill" style={{ width: `${((step + 1) / WIZARD_STEPS.length) * 100}%` }} />
        </div>
        <p className="progress-label">
          Passo {step + 1} de {WIZARD_STEPS.length}
        </p>
      </div>

      <article className="card wizard-card">
        <header className="wizard-head">
          <div>
            <p className="eyebrow">{current.kicker}</p>
            <h2 id="wizard-title">{current.title}</h2>
          </div>
          <button type="button" className="btn ghost" data-testid="wizard-full" onClick={onExit}>
            Ir para o modo completo
          </button>
        </header>
        <p className="lede">{current.help}</p>
        {current.id !== 'resumo' ? (
          <p className="hint-block">Os números já vêm preenchidos. Troque só o que for diferente da loja.</p>
        ) : null}

        <div className="wizard-body">
          {current.id === 'inicio' ? (
            <StartStep inputs={inputs} scenario={scenario} onInputs={onInputs} onScenario={onScenario} />
          ) : null}
          {current.id === 'farmacia' ? <PharmacyStep inputs={inputs} onInputs={onInputs} /> : null}
          {current.id === 'pessoas' ? <PeopleStep inputs={inputs} onInputs={onInputs} /> : null}
          {current.id === 'logistica' ? <LogisticsStep inputs={inputs} onInputs={onInputs} /> : null}
          {current.id === 'estoque' ? <StockStep inputs={inputs} onInputs={onInputs} /> : null}
          {current.id === 'investimento' ? <InvestmentStep inputs={inputs} onInputs={onInputs} /> : null}
          {current.id === 'resumo' ? <SummaryStep inputs={inputs} scenario={scenario} result={result} /> : null}
        </div>

        {error ? (
          <p className="wizard-error" role="alert" data-testid="wizard-error">
            {error}
          </p>
        ) : null}

        <div className="wizard-nav">
          <button type="button" className="btn ghost" data-testid="wizard-back" disabled={step === 0} onClick={() => go(step - 1)}>
            Voltar
          </button>
          <div className="wizard-nav-next">
            {last ? null : (
              <button type="button" className="btn ghost" data-testid="wizard-skip" onClick={() => go(step + 1)}>
                Pular
              </button>
            )}
            <button type="button" className="btn primary" data-testid="wizard-next" onClick={advance}>
              {last ? 'Abrir dashboard' : 'Avançar'}
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}

function Choice({
  checked,
  title,
  detail,
  onClick,
}: {
  checked: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={checked} className={`choice ${checked ? 'is-active' : ''}`} onClick={onClick}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </button>
  );
}

function StartStep({
  inputs,
  scenario,
  onInputs,
  onScenario,
}: {
  inputs: Inputs;
  scenario: ScenarioId;
  onInputs: (inputs: Inputs) => void;
  onScenario: (scenario: ScenarioId) => void;
}) {
  return (
    <div className="stack">
      <div className="form-grid">
        <TextField
          label="Cliente"
          value={inputs.meta.clientName}
          hint="Opcional. Ajuda a achar a simulação depois."
          onChange={(clientName) => onInputs({ ...inputs, meta: { ...inputs.meta, clientName } })}
        />
        <TextField
          label="Nome da loja"
          testId="wizard-store-name"
          value={inputs.meta.storeName}
          hint="Obrigatório para avançar. Pular segue mesmo sem nome."
          onChange={(storeName) => onInputs({ ...inputs, meta: { ...inputs.meta, storeName } })}
        />
      </div>
      <div>
        <p className="choice-label">A loja já existe?</p>
        <div className="choice-row pair" role="radiogroup" aria-label="Tipo de loja">
          <Choice
            checked={inputs.profile.storeType === 'nova'}
            title="Loja nova"
            detail="A prateleira que deixa de ser comprada reduz o investimento."
            onClick={() => onInputs({ ...inputs, profile: { ...inputs.profile, storeType: 'nova' } })}
          />
          <Choice
            checked={inputs.profile.storeType === 'existente'}
            title="Loja existente"
            detail="Rescisão e revenda de prateleira entram no caixa."
            onClick={() => onInputs({ ...inputs, profile: { ...inputs.profile, storeType: 'existente' } })}
          />
        </div>
      </div>
      <div>
        <p className="choice-label">Qual cenário usar agora?</p>
        <div className="choice-row trio" role="radiogroup" aria-label="Cenário do assistente">
          <Choice
            checked={scenario === 'conservador'}
            title="Conservador"
            detail="Benefícios menores e custo maior."
            onClick={() => onScenario('conservador')}
          />
          <Choice checked={scenario === 'base'} title="Base" detail="A leitura central da visita." onClick={() => onScenario('base')} />
          <Choice
            checked={scenario === 'otimista'}
            title="Otimista"
            detail="Benefícios no topo da faixa."
            onClick={() => onScenario('otimista')}
          />
        </div>
      </div>
    </div>
  );
}

function PharmacyStep({ inputs, onInputs }: { inputs: Inputs; onInputs: (inputs: Inputs) => void }) {
  const profile = inputs.profile;
  function patch(next: Partial<Inputs['profile']>) {
    onInputs({ ...inputs, profile: { ...profile, ...next } });
  }
  return (
    <div className="stack">
      <div className="form-grid">
        <NumberField label="Faturamento mensal" suffix="R$" value={profile.monthlyRevenue} onChange={(monthlyRevenue) => patch({ monthlyRevenue })} />
        <PercentField
          label="Margem de contribuição"
          value={profile.contributionMarginPct}
          hint="Parte da venda que vira resultado."
          onChange={(contributionMarginPct) => patch({ contributionMarginPct })}
        />
        <NumberField
          label="Dispensações por dia"
          value={profile.dispensationsPerDay}
          hint="Serve para ver se o robô comporta o volume."
          onChange={(dispensationsPerDay) => patch({ dispensationsPerDay })}
        />
      </div>
      <details className="advanced">
        <summary>Perguntas opcionais</summary>
        <div className="form-grid">
          <NumberField label="Atendimentos por dia" value={profile.attendancesPerDay} onChange={(attendancesPerDay) => patch({ attendancesPerDay })} />
          <NumberField
            label="Dias de funcionamento no mês"
            value={profile.operatingDaysPerMonth}
            onChange={(operatingDaysPerMonth) => patch({ operatingDaysPerMonth })}
          />
          <NumberField label="Área total" suffix="m²" value={profile.totalAreaM2} onChange={(totalAreaM2) => patch({ totalAreaM2 })} />
          <NumberField label="Retaguarda" suffix="m²" value={profile.backroomAreaM2} onChange={(backroomAreaM2) => patch({ backroomAreaM2 })} />
          <PercentField
            label="Crescimento da demanda ao ano"
            value={profile.demandGrowthPctPerYear}
            onChange={(demandGrowthPctPerYear) => patch({ demandGrowthPctPerYear })}
          />
        </div>
      </details>
    </div>
  );
}

function PeopleStep({ inputs, onInputs }: { inputs: Inputs; onInputs: (inputs: Inputs) => void }) {
  const payroll = inputs.people.payroll;
  const hire = inputs.people.futureHires.hires[0];
  function patchPayroll(next: Partial<Inputs['people']['payroll']>) {
    onInputs({ ...inputs, people: { ...inputs.people, payroll: { ...payroll, ...next } } });
  }
  function patchHire(next: Partial<PlannedHire>) {
    const current = hire ?? { id: 'hire-13', role: 'Auxiliar de farmácia', month: 13, headcount: 1, monthlyCost: 9_200 };
    const hires = [{ ...current, ...next }, ...inputs.people.futureHires.hires.slice(1)];
    onInputs({ ...inputs, people: { ...inputs.people, futureHires: { ...inputs.people.futureHires, hires } } });
  }
  return (
    <div className="stack">
      <Switch
        checked={payroll.enabled}
        label={payroll.enabled ? 'Economia de folha ligada' : 'Economia de folha desligada'}
        onChange={(enabled) => patchPayroll({ enabled })}
      />
      <div className="form-grid">
        <NumberField label="Vagas que o robô evita" value={payroll.positionsReduced} onChange={(positionsReduced) => patchPayroll({ positionsReduced })} />
        <NumberField
          label="Custo completo da vaga"
          suffix="R$/mês"
          value={payroll.monthlyCostPerPosition}
          hint="Salário, encargos e o que já couber nessa vaga."
          onChange={(monthlyCostPerPosition) => patchPayroll({ monthlyCostPerPosition })}
        />
        <PercentField
          label="Turnover ao ano"
          value={inputs.people.turnover.annualRate}
          hint="Recrutamento e treinamento já inclusos no custo de substituição não entram de novo."
          onChange={(annualRate) =>
            onInputs({ ...inputs, people: { ...inputs.people, turnover: { ...inputs.people.turnover, annualRate } } })
          }
        />
      </div>
      <details className="advanced">
        <summary>Perguntas opcionais</summary>
        <div className="stack">
          <div className="form-grid">
            <NumberField label="Mês em que a economia começa" value={payroll.startMonth} min={0} onChange={(startMonth) => patchPayroll({ startMonth })} />
            {inputs.profile.storeType === 'existente' ? (
              <NumberField
                label="Rescisão no desligamento"
                suffix="R$"
                value={payroll.severanceCost}
                hint="Só entra em loja existente."
                onChange={(severanceCost) => patchPayroll({ severanceCost })}
              />
            ) : null}
          </div>
          <Switch
            checked={inputs.people.futureHires.enabled}
            label={inputs.people.futureHires.enabled ? 'Contratação futura ligada' : 'Contratação futura desligada'}
            onChange={(enabled) =>
              onInputs({ ...inputs, people: { ...inputs.people, futureHires: { ...inputs.people.futureHires, enabled } } })
            }
          />
          {inputs.people.futureHires.enabled ? (
            <div className="form-grid">
              <NumberField label="Mês da contratação evitada" value={hire?.month ?? 13} min={1} onChange={(month) => patchHire({ month })} />
              <NumberField label="Pessoas" value={hire?.headcount ?? 1} min={0} onChange={(headcount) => patchHire({ headcount })} />
              <NumberField label="Custo mensal" suffix="R$" value={hire?.monthlyCost ?? 0} onChange={(monthlyCost) => patchHire({ monthlyCost })} />
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function LogisticsStep({ inputs, onInputs }: { inputs: Inputs; onInputs: (inputs: Inputs) => void }) {
  const space = inputs.logistics.space;
  const shelving = inputs.logistics.shelving;
  function patchSpace(next: Partial<Inputs['logistics']['space']>) {
    onInputs({ ...inputs, logistics: { ...inputs.logistics, space: { ...space, ...next } } });
  }
  function patchShelving(next: Partial<Inputs['logistics']['shelving']>) {
    onInputs({ ...inputs, logistics: { ...inputs.logistics, shelving: { ...shelving, ...next } } });
  }
  return (
    <div className="stack">
      <Switch checked={space.enabled} label={space.enabled ? 'Ganho de espaço ligado' : 'Ganho de espaço desligado'} onChange={(enabled) => patchSpace({ enabled })} />
      <NumberField label="Área liberada" suffix="m²" value={space.m2Freed} onChange={(m2Freed) => patchSpace({ m2Freed })} />
      <div>
        <p className="choice-label">Como essa área vale dinheiro?</p>
        <div className="choice-row pair" role="radiogroup" aria-label="Uso da área liberada">
          <Choice
            checked={space.mode === 'ocupacao'}
            title="Aluguel evitado"
            detail="Custo de ocupação que deixa de ser pago."
            onClick={() => patchSpace({ mode: 'ocupacao' satisfies SpaceMode })}
          />
          <Choice
            checked={space.mode === 'margem'}
            title="Venda no lugar"
            detail="Margem de uma área que passa a vender."
            onClick={() => patchSpace({ mode: 'margem' satisfies SpaceMode })}
          />
        </div>
      </div>
      {space.mode === 'ocupacao' ? (
        <NumberField
          label="Custo de ocupação"
          suffix="R$/m²"
          value={space.occupancyCostPerM2}
          onChange={(occupancyCostPerM2) => patchSpace({ occupancyCostPerM2 })}
        />
      ) : (
        <NumberField
          label="Margem da área"
          suffix="R$/m² por mês"
          value={space.contributionPerM2Month}
          onChange={(contributionPerM2Month) => patchSpace({ contributionPerM2Month })}
        />
      )}
      <details className="advanced">
        <summary>Perguntas opcionais</summary>
        <div className="stack">
          <p className="hint-block">Caixa do fornecedor fica no modo completo e só entra se o processo foi validado.</p>
          <Switch
            checked={shelving.enabled}
            label={shelving.enabled ? 'Prateleiras ligadas' : 'Prateleiras desligadas'}
            onChange={(enabled) => patchShelving({ enabled })}
          />
          <div className="form-grid">
            {inputs.profile.storeType === 'nova' ? (
              <NumberField
                label="Prateleira que deixa de ser comprada"
                suffix="R$"
                value={shelving.avoidedAcquisition}
                onChange={(avoidedAcquisition) => patchShelving({ avoidedAcquisition })}
              />
            ) : (
              <>
                <NumberField label="Revenda das prateleiras" suffix="R$" value={shelving.resaleValue} onChange={(resaleValue) => patchShelving({ resaleValue })} />
                <NumberField
                  label="Manutenção mensal evitada"
                  suffix="R$"
                  value={shelving.avoidedMaintenanceMonthly}
                  onChange={(avoidedMaintenanceMonthly) => patchShelving({ avoidedMaintenanceMonthly })}
                />
              </>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

function StockStep({ inputs, onInputs }: { inputs: Inputs; onInputs: (inputs: Inputs) => void }) {
  const losses = inputs.stock.losses;
  const capital = inputs.stock.workingCapital;
  return (
    <div className="stack">
      <Switch
        checked={losses.enabled}
        label={losses.enabled ? 'Perdas evitadas ligadas' : 'Perdas evitadas desligadas'}
        onChange={(enabled) => onInputs({ ...inputs, stock: { ...inputs.stock, losses: { ...losses, enabled } } })}
      />
      <div className="form-grid">
        <NumberField
          label="Perdas atuais"
          suffix="R$/mês"
          value={inputs.profile.historicalLossesMonthly}
          onChange={(historicalLossesMonthly) =>
            onInputs({ ...inputs, profile: { ...inputs.profile, historicalLossesMonthly } })
          }
        />
        <NumberField
          label="Perdas com o robô"
          suffix="R$/mês"
          value={losses.projectedLossesMonthly}
          hint="Tem de ser menor ou igual às perdas atuais."
          onChange={(projectedLossesMonthly) =>
            onInputs({ ...inputs, stock: { ...inputs.stock, losses: { ...losses, projectedLossesMonthly } } })
          }
        />
      </div>
      <details className="advanced">
        <summary>Perguntas opcionais</summary>
        <div className="stack">
          <p className="hint-block">A queda do estoque é caixa uma vez. Não é lucro todo mês.</p>
          <div className="form-grid">
            <NumberField
              label="Estoque médio atual"
              suffix="R$"
              value={inputs.profile.averageInventory}
              onChange={(averageInventory) => onInputs({ ...inputs, profile: { ...inputs.profile, averageInventory } })}
            />
            <NumberField
              label="Estoque depois do robô"
              suffix="R$"
              value={capital.inventoryAfter}
              onChange={(inventoryAfter) =>
                onInputs({ ...inputs, stock: { ...inputs.stock, workingCapital: { ...capital, inventoryAfter } } })
              }
            />
          </div>
          <Switch
            checked={capital.enabled}
            label={capital.enabled ? 'Capital de giro ligado' : 'Capital de giro desligado'}
            onChange={(enabled) =>
              onInputs({ ...inputs, stock: { ...inputs.stock, workingCapital: { ...capital, enabled } } })
            }
          />
        </div>
      </details>
    </div>
  );
}

function InvestmentStep({ inputs, onInputs }: { inputs: Inputs; onInputs: (inputs: Inputs) => void }) {
  const robot = inputs.robot;
  return (
    <div className="stack">
      <div className="form-grid">
        <NumberField
          label="Equipamento"
          suffix="R$"
          value={robot.capex.equipment}
          onChange={(equipment) => onInputs({ ...inputs, robot: { ...robot, capex: { ...robot.capex, equipment } } })}
        />
        <NumberField
          label="Demais custos para instalar"
          suffix="R$"
          value={otherCapex(inputs)}
          hint="Frete, obra, integração e contingência. Editar junta esses itens num só valor."
          onChange={(value) => onInputs(withOtherCapex(inputs, value))}
        />
        <NumberField
          label="Custo mensal do robô"
          suffix="R$"
          value={totalOpex(inputs)}
          hint="Manutenção, software, energia e o resto. Editar junta esses itens num só valor."
          onChange={(value) => onInputs(withTotalOpex(inputs, value))}
        />
        <PercentField
          label="Taxa de desconto ao ano"
          value={robot.discountRateAnnual}
          hint="Usada no VPL e no payback descontado. O ROI não usa essa taxa."
          onChange={(discountRateAnnual) => onInputs({ ...inputs, robot: { ...robot, discountRateAnnual } })}
        />
      </div>
      <details className="advanced">
        <summary>Perguntas opcionais</summary>
        <div className="stack">
          <div className="form-grid">
            <PercentField
              label="Disponibilidade do robô"
              value={robot.availabilityPct}
              hint="Reduz os benefícios, não o custo mensal."
              onChange={(availabilityPct) =>
                onInputs({ ...inputs, robot: { ...robot, availabilityPct: Math.min(1, Math.max(0, availabilityPct)) } })
              }
            />
            {robot.includeTax ? (
              <PercentField
                label="Alíquota sobre o benefício"
                value={robot.taxRate}
                onChange={(taxRate) => onInputs({ ...inputs, robot: { ...robot, taxRate } })}
              />
            ) : null}
          </div>
          <Switch
            checked={robot.includeTax}
            label={robot.includeTax ? 'Imposto ligado' : 'Imposto desligado'}
            onChange={(includeTax) => onInputs({ ...inputs, robot: { ...robot, includeTax } })}
          />
          <Switch
            checked={robot.financing.enabled}
            label={robot.financing.enabled ? 'Financiamento ligado' : 'Financiamento desligado'}
            onChange={(enabled) =>
              onInputs({ ...inputs, robot: { ...robot, financing: { ...robot.financing, enabled } } })
            }
          />
          {robot.financing.enabled ? (
            <div className="form-grid">
              <p className="hint-block span-2">A parcela aparece à parte. VPL, TIR, ROI e payback continuam sem a dívida.</p>
              <PercentField
                label="Entrada"
                value={robot.financing.downPaymentPct}
                onChange={(downPaymentPct) =>
                  onInputs({ ...inputs, robot: { ...robot, financing: { ...robot.financing, downPaymentPct } } })
                }
              />
              <NumberField
                label="Prazo"
                suffix="meses"
                value={robot.financing.termMonths}
                onChange={(termMonths) =>
                  onInputs({ ...inputs, robot: { ...robot, financing: { ...robot.financing, termMonths } } })
                }
              />
              <PercentField
                label="Juros ao ano"
                value={robot.financing.annualInterest}
                onChange={(annualInterest) =>
                  onInputs({ ...inputs, robot: { ...robot, financing: { ...robot.financing, annualInterest } } })
                }
              />
            </div>
          ) : (
            <p className="hint-block">Financiamento, quando ligado, mostra a parcela sem mudar o resultado econômico.</p>
          )}
        </div>
      </details>
    </div>
  );
}

function SummaryStep({
  inputs,
  scenario,
  result,
}: {
  inputs: Inputs;
  scenario: ScenarioId;
  result: ModelResult;
}) {
  return (
    <div className="stack">
      {inputs.fictional ? (
        <div className="banner fiction">Sugestões editáveis. Enquanto os dados forem de exemplo, o resultado continua marcado como fictício.</div>
      ) : null}
      <p>
        {inputs.meta.clientName || 'Cliente'} · {inputs.meta.storeName || 'Loja sem nome'} · {storeLabel(inputs.profile.storeType)} ·{' '}
        {scenarioLabel(scenario)}
      </p>
      <section className="kpis">
        <article className="kpi accent">
          <span>Investimento líquido</span>
          <strong data-testid="wizard-kpi-investment">{formatBRL(result.netInvestment)}</strong>
        </article>
        <article className="kpi">
          <span>Benefício líquido mensal</span>
          <strong data-testid="wizard-kpi-net">{formatBRL(result.steadyNet)}</strong>
        </article>
        <article className="kpi">
          <span>Payback simples</span>
          <strong data-testid="wizard-kpi-payback">{formatPayback(result.payback)}</strong>
        </article>
        <article className="kpi">
          <span>ROI anual simples</span>
          <strong data-testid="wizard-kpi-roi">{formatPercent(result.roi)}</strong>
        </article>
        <article className="kpi">
          <span>VPL</span>
          <strong data-testid="wizard-kpi-npv">{formatBRL(result.npv)}</strong>
        </article>
        <article className="kpi">
          <span>TIR anual</span>
          <strong data-testid="wizard-kpi-irr">{formatPercent(result.irrAnnual)}</strong>
        </article>
      </section>
      <p className="hint-block">Financiamento, imposto, vendas sem evidência e o detalhe de cada benefício ficam no modo completo.</p>
    </div>
  );
}
