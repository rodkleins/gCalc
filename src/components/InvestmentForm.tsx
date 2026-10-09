import { Callout, ModuleImpact, NumberField, PercentField, Switch } from './Fields';
import { formatBRL, formatPercent } from '../model/format';
import type { Inputs, ModelResult } from '../model/types';

const CAPEX_FIELDS: Array<{ key: keyof Inputs['robot']['capex']; label: string }> = [
  { key: 'equipment', label: 'Robô' },
  { key: 'freightImportTaxes', label: 'Frete, importação e tributos' },
  { key: 'installationTraining', label: 'Instalação, comissionamento e treinamento' },
  { key: 'civilElectrical', label: 'Obras, elétrica e rede' },
  { key: 'integration', label: 'Integração PDV, ERP e logística' },
  { key: 'implementationContingency', label: 'Implantação e contingência' },
];

const OPEX_FIELDS: Array<{ key: keyof Inputs['robot']['opexMonthly']; label: string }> = [
  { key: 'maintenance', label: 'Manutenção e peças' },
  { key: 'software', label: 'Software, conectividade e monitoramento' },
  { key: 'energy', label: 'Energia e consumíveis' },
  { key: 'downtime', label: 'Indisponibilidade e contingência' },
  { key: 'insurance', label: 'Seguros' },
  { key: 'other', label: 'Outros custos' },
];

export function InvestmentForm({
  inputs,
  result,
  onChange,
}: {
  inputs: Inputs;
  result: ModelResult;
  onChange: (inputs: Inputs) => void;
}) {
  const robot = inputs.robot;
  const setRobot = (next: Inputs['robot']) => onChange({ ...inputs, robot: next });

  return (
    <div className="stack">
      <ModuleImpact result={result} module="Investimento" />
      <section className="card">
        <h2>CAPEX</h2>
        <p className="lede">
          Bruto {formatBRL(result.grossCapex)} − prateleiras evitadas {formatBRL(result.avoidedCapex)} = investimento
          líquido {formatBRL(result.netInvestment)}.
        </p>
        <div className="form-grid">
          {CAPEX_FIELDS.map((field) => (
            <NumberField
              key={field.key}
              fieldId={`robot.capex.${field.key}`}
              label={field.label}
              value={robot.capex[field.key]}
              suffix="R$"
              onChange={(value) => setRobot({ ...robot, capex: { ...robot.capex, [field.key]: value } })}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>OPEX mensal</h2>
        <p className="lede">Total considerado: {formatBRL(result.monthlyOpex)} por mês, a partir do go-live.</p>
        <div className="form-grid">
          {OPEX_FIELDS.map((field) => (
            <NumberField
              key={field.key}
              fieldId={`robot.opexMonthly.${field.key}`}
              label={field.label}
              value={robot.opexMonthly[field.key]}
              suffix="R$"
              onChange={(value) => setRobot({ ...robot, opexMonthly: { ...robot.opexMonthly, [field.key]: value } })}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Operação, imposto e taxa</h2>
        <div className="form-grid">
          <PercentField
            label="Disponibilidade operacional"
            value={robot.availabilityPct}
            hint="Reduz os benefícios na mesma proporção. O OPEX continua integral."
            onChange={(availabilityPct) => setRobot({ ...robot, availabilityPct })}
          />
          <NumberField
            label="Capacidade de dispensação"
            value={robot.capacityDispensationsPerDay}
            suffix="/dia"
            onChange={(capacityDispensationsPerDay) => setRobot({ ...robot, capacityDispensationsPerDay })}
          />
          <NumberField
            label="Mês de go-live"
            value={robot.goLiveMonth}
            min={1}
            hint="Antes disso o incremental operacional é zero. O CAPEX sai na data zero."
            onChange={(goLiveMonth) => setRobot({ ...robot, goLiveMonth })}
          />
          <NumberField
            label="Valor residual no mês 60"
            value={robot.residualValue}
            suffix="R$"
            onChange={(residualValue) => setRobot({ ...robot, residualValue })}
          />
          <NumberField
            label="Vida para depreciação"
            value={robot.depreciationYears}
            suffix="anos"
            onChange={(depreciationYears) => setRobot({ ...robot, depreciationYears })}
          />
          <PercentField
            label="Alíquota"
            value={robot.taxRate}
            onChange={(taxRate) => setRobot({ ...robot, taxRate })}
          />
          <PercentField
            fieldId="robot.discountRateAnnual"
            label="Taxa de desconto anual efetiva"
            value={robot.discountRateAnnual}
            hint="Vira taxa mensal equivalente: (1 + i) elevado a 1/12, menos 1."
            onChange={(discountRateAnnual) => setRobot({ ...robot, discountRateAnnual })}
          />
          <label className="field check">
            <input
              type="checkbox"
              checked={robot.includeTax}
              onChange={(event) => setRobot({ ...robot, includeTax: event.target.checked })}
            />
            <span>Trazer imposto e escudo da depreciação linear para o caixa</span>
          </label>
        </div>
      </section>

      <section className="card">
        <header className="benefit-head">
          <div>
            <h2>Financiamento</h2>
            <p>Parcela estimada em tabela Price. Não altera VPL, TIR, ROI nem payback econômico.</p>
          </div>
          <Switch
            checked={robot.financing.enabled}
            onChange={(enabled) => setRobot({ ...robot, financing: { ...robot.financing, enabled } })}
            label={robot.financing.enabled ? 'Ativo' : 'Inativo'}
          />
        </header>
        <div className="form-grid">
          <PercentField
            label="Entrada"
            value={robot.financing.downPaymentPct}
            onChange={(downPaymentPct) => setRobot({ ...robot, financing: { ...robot.financing, downPaymentPct } })}
          />
          <NumberField
            label="Prazo"
            value={robot.financing.termMonths}
            suffix="meses"
            min={1}
            onChange={(termMonths) => setRobot({ ...robot, financing: { ...robot.financing, termMonths } })}
          />
          <PercentField
            label="Juros anuais efetivos"
            value={robot.financing.annualInterest}
            onChange={(annualInterest) => setRobot({ ...robot, financing: { ...robot.financing, annualInterest } })}
          />
          <NumberField
            label="Balão no fim do prazo"
            value={robot.financing.balloon}
            suffix="R$"
            onChange={(balloon) => setRobot({ ...robot, financing: { ...robot.financing, balloon } })}
          />
        </div>
        {result.financing ? (
          <Callout tone="warn">
            Valor financiado {formatBRL(result.financing.financedAmount)}. Parcela {formatBRL(result.financing.monthlyPayment)}{' '}
            por {result.financing.termMonths} meses. Juros totais estimados {formatBRL(result.financing.interestTotal)}.
            Esta leitura está fora do retorno econômico, hoje em {formatPercent(result.roi)} de ROI e VPL de{' '}
            {formatBRL(result.npv)}.
          </Callout>
        ) : null}
      </section>
    </div>
  );
}
