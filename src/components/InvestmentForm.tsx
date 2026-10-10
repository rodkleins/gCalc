import { Callout, CheckField, ModuleImpact, NumberField, PercentField, SelectField, StageNote, Switch } from './Fields';
import { opexLooksLikeEquipmentPrice } from '../model/calculate';
import { equipmentFloorWarning, monthlyRobotCostWarning } from '../model/example';
import { sum } from '../model/round';
import { formatBRL, formatIrr, formatPercent } from '../model/format';
import type { Inputs, ModelResult } from '../model/types';

const CAPEX_FIELDS: Array<{ key: keyof Inputs['robot']['capex']; label: string; help: string }> = [
  { key: 'equipment', label: 'Equipamento (só no CAPEX)', help: 'Preço do robô, em R$, pago uma vez. Soma o CAPEX bruto e o investimento líquido. Não entra no custo mensal.' },
  { key: 'freightImportTaxes', label: 'Frete, importação e tributos', help: 'Frete, importação e tributos de entrada, em R$, pagos uma vez. Somam o CAPEX bruto.' },
  { key: 'installationTraining', label: 'Instalação, comissionamento e treinamento', help: 'Instalação, comissionamento e treinamento inicial, em R$, pagos uma vez. Somam o CAPEX bruto.' },
  { key: 'civilElectrical', label: 'Obras, elétrica e rede', help: 'Obra civil, elétrica e rede, em R$, pagas uma vez. Somam o CAPEX bruto.' },
  { key: 'integration', label: 'Integração PDV, ERP e logística', help: 'Integração com PDV, ERP e logística, em R$, paga uma vez. Soma o CAPEX bruto.' },
  { key: 'implementationContingency', label: 'Implantação e contingência', help: 'Implantação e contingência, em R$, pagas uma vez. Somam o CAPEX bruto.' },
];

const OPEX_FIELDS: Array<{ key: keyof Inputs['robot']['opexMonthly']; label: string; help: string }> = [
  { key: 'maintenance', label: 'Manutenção e suporte', help: 'Manutenção e suporte, em R$ por mês. Entra no OPEX a partir do go-live e reduz a sobra mensal. Não é o preço do equipamento.' },
  { key: 'software', label: 'Software, conectividade e monitoramento', help: 'Software, conectividade e monitoramento, em R$ por mês. Entram no OPEX recorrente.' },
  { key: 'energy', label: 'Energia e consumíveis', help: 'Energia e consumíveis, em R$ por mês. Entram no OPEX recorrente.' },
  { key: 'downtime', label: 'Indisponibilidade e contingência', help: 'Custo de indisponibilidade e contingência, em R$ por mês. Entra no OPEX recorrente.' },
  { key: 'insurance', label: 'Seguros', help: 'Seguro do robô, em R$ por mês. Entra no OPEX recorrente.' },
  { key: 'other', label: 'Outros custos', help: 'Outros custos recorrentes do robô, em R$ por mês. Entram no OPEX.' },
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
      <StageNote>
        Esta tela separa o preço de comprar o robô do custo de mantê-lo. O equipamento entra uma vez no CAPEX. O custo
        mensal é manutenção, suporte e o que se repete. Os dois não se somam como se o robô fosse pago duas vezes. O
        payback e o ROI usam o investimento líquido e a sobra mensal depois desse custo.
      </StageNote>
      <ModuleImpact result={result} module="Investimento" />
      <section className="card">
        <h2>CAPEX</h2>
        <p className="lede">
          Bruto {formatBRL(result.grossCapex)} − prateleiras evitadas {formatBRL(result.avoidedCapex)} = investimento
          líquido {formatBRL(result.netInvestment)}.
        </p>
        {equipmentFloorWarning(robot.capex.equipment) ? (
          <Callout tone="warn">
            <span data-testid="equipment-floor-warning">{equipmentFloorWarning(robot.capex.equipment)}</span>
          </Callout>
        ) : null}
        <div className="form-grid">
          {CAPEX_FIELDS.map((field) => (
            <NumberField
              key={field.key}
              fieldId={`robot.capex.${field.key}`}
              label={field.label}
              help={field.help}
              value={robot.capex[field.key]}
              suffix="R$"
              min={0}
              onChange={(value) => setRobot({ ...robot, capex: { ...robot.capex, [field.key]: value } })}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Custo mensal do robô</h2>
        <p className="lede">
          Só manutenção, suporte e outros gastos recorrentes. Total {formatBRL(result.monthlyOpex)} por mês, a partir do
          go-live. O preço do equipamento não entra aqui.
        </p>
        {monthlyRobotCostWarning(sum(Object.values(robot.opexMonthly))) ? (
          <Callout tone="warn">
            <span data-testid="opex-floor-warning">{monthlyRobotCostWarning(sum(Object.values(robot.opexMonthly)))}</span>
          </Callout>
        ) : null}
        {opexLooksLikeEquipmentPrice(result.grossCapex, result.monthlyOpex) ? (
          <Callout tone="warn">
            Em um ano, este custo passa de 20% do CAPEX. Confira se o preço do equipamento foi lançado no mensal. O
            equipamento fica só no CAPEX.
          </Callout>
        ) : null}
        <div className="form-grid">
          {OPEX_FIELDS.map((field) => (
            <NumberField
              key={field.key}
              fieldId={`robot.opexMonthly.${field.key}`}
              label={field.label}
              help={field.help}
              value={robot.opexMonthly[field.key]}
              suffix="R$"
              min={0}
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
            help="Dispensações por dia que o robô comporta. Se a loja passa disso, os benefícios operacionais são reduzidos na mesma proporção. O OPEX não muda."
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
            help="Valor de revenda ou uso restante no fim do horizonte, em R$. Entra como caixa no mês 60 e reduz o investimento que o VPL ainda carrega."
            onChange={(residualValue) => setRobot({ ...robot, residualValue })}
          />
          <NumberField
            label="Vida para depreciação"
            value={robot.depreciationYears}
            suffix="anos"
            help="Vida útil em anos, usada só na leitura de depreciação. Não muda o payback, o ROI nem o VPL do caixa."
            onChange={(depreciationYears) => setRobot({ ...robot, depreciationYears })}
          />
          <PercentField
            label="Alíquota"
            value={robot.taxRate}
            hint="Não é uma recomendação. 34% não serve a qualquer regime."
            onChange={(taxRate) => setRobot({ ...robot, taxRate })}
          />
          <SelectField
            label="Política tributária"
            help="Define como o imposto incide sobre o benefício. Sem impostos, a alíquota fica fora do caixa. As outras políticas trazem o imposto para o fluxo quando a opção de caixa está ligada."
            value={robot.taxPolicy}
            onChange={(taxPolicy) =>
              setRobot({
                ...robot,
                taxPolicy: taxPolicy as Inputs['robot']['taxPolicy'],
                includeTax: taxPolicy !== 'sem_impostos',
              })
            }
            options={[
              { value: 'sem_impostos', label: 'Sem impostos' },
              { value: 'incremental_simplificado', label: 'Incremental simplificado' },
              { value: 'prejuizo_com_limite', label: 'Prejuízo com limite de aproveitamento' },
              { value: 'beneficio_condicionado', label: 'Benefício condicionado à capacidade' },
            ]}
          />
          <PercentField
            fieldId="robot.discountRateAnnual"
            label="Taxa de desconto anual efetiva"
            value={robot.discountRateAnnual}
            hint="Vira taxa mensal equivalente: (1 + i) elevado a 1/12, menos 1."
            onChange={(discountRateAnnual) => setRobot({ ...robot, discountRateAnnual })}
          />
          <CheckField
            checked={robot.includeTax}
            onChange={(includeTax) => setRobot({ ...robot, includeTax })}
            label="Trazer imposto para o caixa. Prejuízo não vira crédito sozinho."
            help="Ligado, a alíquota reduz o benefício no fluxo de caixa. Prejuízo fiscal não gera crédito automático. Desligado, o imposto fica só na leitura."
          />
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
            help="Liga a parcela estimada do financiamento. A tabela Price não altera VPL, TIR, ROI nem payback econômico do projeto."
          />
        </header>
        <div className="form-grid">
          <PercentField
            label="Entrada"
            value={robot.financing.downPaymentPct}
            help="Percentual do investimento pago à vista. O restante é o valor financiado. Não entra no payback econômico."
            onChange={(downPaymentPct) => setRobot({ ...robot, financing: { ...robot.financing, downPaymentPct } })}
          />
          <NumberField
            label="Prazo"
            value={robot.financing.termMonths}
            suffix="meses"
            min={1}
            help="Prazo do financiamento, em meses. Define por quanto tempo a parcela Price é estimada. Não muda o payback do projeto."
            onChange={(termMonths) => setRobot({ ...robot, financing: { ...robot.financing, termMonths } })}
          />
          <PercentField
            label="Juros anuais efetivos"
            value={robot.financing.annualInterest}
            help="Juros efetivos ao ano do financiamento, em percentual. Entram na parcela estimada e no custo financeiro da dívida, fora do ROI operacional."
            onChange={(annualInterest) => setRobot({ ...robot, financing: { ...robot.financing, annualInterest } })}
          />
          <NumberField
            label="Balão no fim do prazo"
            value={robot.financing.balloon}
            suffix="R$"
            help="Parcela extra no fim do prazo, em R$. Soma o serviço da dívida. Não entra no benefício operacional nem no payback."
            onChange={(balloon) => setRobot({ ...robot, financing: { ...robot.financing, balloon } })}
          />
        </div>
        {result.financing ? (
          <Callout tone="warn">
            Valor financiado {formatBRL(result.financing.financedAmount)}. Serviço da dívida{' '}
            {formatBRL(result.financing.debtServiceMonthly)} por {result.financing.termMonths} meses. Custo financeiro{' '}
            {formatBRL(result.financing.totalFinancialCost)}. VPL do projeto {formatBRL(result.financing.projectNpv)}. TIR
            do capital próprio {formatIrr(result.financing.equityIrrAnnual)}. O financiamento recebido não é benefício
            operacional. O retorno estabilizado do projeto segue em {formatPercent(result.roi)}.
          </Callout>
        ) : null}
      </section>
    </div>
  );
}
