import { Callout, CheckField, ModuleImpact, NumberField, PercentField, ReadOnlyField, SelectField, StageNote, Switch } from './Fields';
import { PARTIAL_AVAILABILITY_IDLE, partialAvailabilityMatters } from '../model/benefitStatus';
import { opexLooksLikeEquipmentPrice } from '../model/calculate';
import { equipmentFloorWarning, monthlyRobotCostWarning, RECOVERABLE_TAX_CREDIT_HELP } from '../model/example';
import { formatBRL, formatIrr, formatNumber, formatPercent } from '../model/format';
import { energyConsumptionKwh, energyMonthlyCost } from '../model/robotCost';
import type { Inputs, ModelResult } from '../model/types';

const CAPEX_FIELDS: Array<{ key: keyof Inputs['robot']['capex']; label: string; help: string }> = [
  { key: 'equipment', label: 'Equipamento (só no CAPEX)', help: 'Preço do robô, em R$, pago uma vez. Soma o CAPEX bruto e o investimento líquido. Não entra no custo mensal.' },
  { key: 'freightImportTaxes', label: 'Frete, importação e tributos', help: 'Frete, importação e tributos de entrada, em R$, pagos uma vez. Somam o CAPEX bruto.' },
  { key: 'installationTraining', label: 'Instalação, comissionamento e treinamento', help: 'Instalação, comissionamento e treinamento inicial, em R$, pagos uma vez. Somam o CAPEX bruto.' },
  { key: 'civilElectrical', label: 'Obras, elétrica e rede', help: 'Obra civil, elétrica e rede, em R$, pagas uma vez. Somam o CAPEX bruto.' },
  { key: 'integration', label: 'Integração PDV, ERP e logística', help: 'Integração com PDV, ERP e logística, em R$, paga uma vez. Soma o CAPEX bruto.' },
  { key: 'implementationContingency', label: 'Implantação e contingência', help: 'Implantação e contingência, em R$, pagas uma vez. Somam o CAPEX bruto.' },
];

const SUPPORT_HELP =
  'Suporte pago à fornecedora, em R$ por mês. A faixa deste campo é de R$ 5.000 a R$ 6.000. Entra no OPEX a partir do go-live. Não é o preço do equipamento.';
const POWER_HELP =
  'Potência média do robô em operação, em kW. O consumo mensal é potência × horas por dia × dias por mês. O padrão é 2,5 kW.';
const HOURS_HELP = 'Horas de operação por dia. Entram no consumo mensal de energia. O padrão é 16 horas.';
const DAYS_HELP =
  'Dias de operação por mês usados na energia. O padrão é 30. Este campo não acompanha sozinho os dias de funcionamento da loja.';
const TARIFF_HELP =
  'Tarifa de energia em R$ por kWh, já com impostos. O custo mensal é o consumo em kWh vezes esta tarifa. Na inflação e no cenário, este valor acompanha o OPEX.';
const CONSUMPTION_HELP =
  'Consumo mensal calculado, em kWh: potência média × horas por dia × dias de operação. Somente leitura.';
const ENERGY_COST_HELP =
  'Custo mensal de energia calculado: consumo em kWh × tarifa com impostos. Somente leitura. Acompanha a inflação de OPEX e o fator de OPEX do cenário.';
const OTHER_HELP = 'Outros custos recorrentes do robô, em R$ por mês. Entram no OPEX junto com o suporte e a energia calculada.';

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
  const volumeMoves = partialAvailabilityMatters(result);
  const financeOff = !robot.financing.enabled;
  const financeNote = financeOff
    ? 'Não altera o payback econômico enquanto o financiamento estiver desligado.'
    : undefined;

  return (
    <div className="stack">
      <StageNote>
        Esta tela separa o preço de comprar o robô do custo de mantê-lo. O equipamento entra uma vez no CAPEX. O custo
        mensal é o suporte pago à fornecedora, a energia calculada e os outros custos. Os dois não se somam como se o
        robô fosse pago duas vezes. O payback e o ROI usam o investimento líquido e a sobra mensal depois desse custo.
      </StageNote>
      <ModuleImpact result={result} module="Investimento" />
      <section className="card">
        <h2>CAPEX</h2>
        <p className="lede" data-testid="investment-summary">
          Bruto {formatBRL(result.grossCapex)} − prateleiras evitadas {formatBRL(result.avoidedCapex)} − créditos
          recuperáveis {formatBRL(result.recoverableTaxCredit)} = investimento líquido {formatBRL(result.netInvestment)}.
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
          <PercentField
            fieldId="robot.recoverableTaxCreditPct"
            testId="tax-credit-pct"
            label="Créditos recuperáveis de impostos (IBS/CBS ou ICMS)"
            help={RECOVERABLE_TAX_CREDIT_HELP}
            hint={RECOVERABLE_TAX_CREDIT_HELP}
            value={robot.recoverableTaxCreditPct}
            onChange={(recoverableTaxCreditPct) =>
              setRobot({
                ...robot,
                recoverableTaxCreditPct: Math.min(1, Math.max(0, recoverableTaxCreditPct)),
              })
            }
          />
        </div>
        <p className="lede" data-testid="tax-credit-amount">
          {formatBRL(result.recoverableTaxCredit)} sobre o equipamento neste cenário. Entra no mês 0. É comprovável.
        </p>
      </section>

      <section className="card" data-testid="monthly-robot-cost">
        <h2>Custo mensal do robô</h2>
        <p className="lede">
          Suporte pago à fornecedora, na faixa de R$ 5.000 a R$ 6.000, energia calculada e outros custos. O consumo e o
          custo de energia são somente leitura. Na escala de crescimento, a energia acompanha a inflação de OPEX. Total
          neste cenário {formatBRL(result.monthlyOpex)} por mês, a partir do go-live. O preço do equipamento não entra
          aqui.
        </p>
        {monthlyRobotCostWarning(robot.opexMonthly.maintenance) ? (
          <Callout tone="warn">
            <span data-testid="opex-floor-warning">{monthlyRobotCostWarning(robot.opexMonthly.maintenance)}</span>
          </Callout>
        ) : null}
        {opexLooksLikeEquipmentPrice(result.grossCapex, result.monthlyOpex) ? (
          <Callout tone="warn">
            Em um ano, este custo passa de 20% do CAPEX. Confira se o preço do equipamento foi lançado no mensal. O
            equipamento fica só no CAPEX.
          </Callout>
        ) : null}
        <div className="form-grid">
          <NumberField
            fieldId="robot.opexMonthly.maintenance"
            label="Manutenção e suporte"
            help={SUPPORT_HELP}
            hint={SUPPORT_HELP}
            value={robot.opexMonthly.maintenance}
            suffix="R$"
            min={0}
            onChange={(maintenance) => setRobot({ ...robot, opexMonthly: { ...robot.opexMonthly, maintenance } })}
          />
          <NumberField
            fieldId="robot.energy.powerKw"
            label="Potência média"
            help={POWER_HELP}
            hint={POWER_HELP}
            value={robot.energy.powerKw}
            suffix="kW"
            min={0}
            onChange={(powerKw) => setRobot({ ...robot, energy: { ...robot.energy, powerKw } })}
          />
          <NumberField
            fieldId="robot.energy.hoursPerDay"
            label="Horas de operação por dia"
            help={HOURS_HELP}
            hint={HOURS_HELP}
            value={robot.energy.hoursPerDay}
            suffix="h/dia"
            min={0}
            onChange={(hoursPerDay) => setRobot({ ...robot, energy: { ...robot.energy, hoursPerDay } })}
          />
          <NumberField
            fieldId="robot.energy.daysPerMonth"
            label="Dias de operação por mês"
            help={DAYS_HELP}
            hint={DAYS_HELP}
            value={robot.energy.daysPerMonth}
            suffix="dias"
            min={0}
            onChange={(daysPerMonth) => setRobot({ ...robot, energy: { ...robot.energy, daysPerMonth } })}
          />
          <NumberField
            fieldId="robot.energy.tariffPerKwh"
            label="Tarifa com impostos"
            help={TARIFF_HELP}
            hint={TARIFF_HELP}
            value={robot.energy.tariffPerKwh}
            suffix="R$/kWh"
            min={0}
            onChange={(tariffPerKwh) => setRobot({ ...robot, energy: { ...robot.energy, tariffPerKwh } })}
          />
          <ReadOnlyField
            testId="energy-readout"
            fieldId="robot.energy.consumptionKwh"
            label="Consumo mensal"
            help={CONSUMPTION_HELP}
            hint={CONSUMPTION_HELP}
            value={formatNumber(energyConsumptionKwh(robot.energy))}
            suffix="kWh"
          />
          <ReadOnlyField
            testId="energy-cost"
            fieldId="robot.energy.monthlyCost"
            label="Custo mensal de energia"
            help={ENERGY_COST_HELP}
            hint={ENERGY_COST_HELP}
            value={formatBRL(energyMonthlyCost(robot.energy))}
          />
          <NumberField
            fieldId="robot.opexMonthly.other"
            label="Outros custos"
            help={OTHER_HELP}
            hint={OTHER_HELP}
            value={robot.opexMonthly.other}
            suffix="R$"
            min={0}
            onChange={(other) => setRobot({ ...robot, opexMonthly: { ...robot.opexMonthly, other } })}
          />
        </div>
      </section>

      <section className="card">
        <h2>Operação, imposto e taxa</h2>
        <div className="form-grid">
          <PercentField
            label="Disponibilidade operacional"
            value={robot.availabilityPct}
            hint={
              volumeMoves
                ? 'Reduz caixas, movimentação e vendas. A folha não cai enquanto a disponibilidade for maior que zero. O custo mensal do robô continua integral. Zero tira folha, estoque e vendas.'
                : PARTIAL_AVAILABILITY_IDLE
            }
            help={
              volumeMoves
                ? 'Reduz caixas, movimentação e vendas. A folha não cai enquanto a disponibilidade for maior que zero. Zero tira folha, estoque e vendas. O custo mensal do robô continua.'
                : PARTIAL_AVAILABILITY_IDLE
            }
            onChange={(availabilityPct) => setRobot({ ...robot, availabilityPct })}
          />
          <NumberField
            label="Capacidade de dispensação"
            value={robot.capacityDispensationsPerDay}
            suffix="/dia"
            help="Dispensações por dia que o robô comporta. Se a loja passa disso, caixas, movimentação e vendas caem na mesma proporção. A folha não usa esta cobertura. O custo mensal não muda."
            noEffect={
              volumeMoves
                ? undefined
                : 'Não altera este modelo: não há caixas, movimentação nem vendas no fluxo para a cobertura reduzir.'
            }
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
            help="Vida útil em anos, usada na leitura de depreciação e no imposto sobre o valor residual. Com o imposto fora do caixa, este prazo não muda payback, ROI nem VPL."
            noEffect={
              robot.includeTax
                ? undefined
                : 'Com o imposto fora do caixa, este prazo não muda payback, ROI nem VPL.'
            }
            onChange={(depreciationYears) => setRobot({ ...robot, depreciationYears })}
          />
          <PercentField
            label="Alíquota"
            value={robot.taxRate}
            hint="Não é uma recomendação. 34% não serve a qualquer regime."
            noEffect={robot.includeTax ? undefined : 'A alíquota só muda o caixa quando o imposto está ligado.'}
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
            disabled={financeOff}
            noEffect={financeNote}
            onChange={(downPaymentPct) => setRobot({ ...robot, financing: { ...robot.financing, downPaymentPct } })}
          />
          <NumberField
            label="Prazo"
            value={robot.financing.termMonths}
            suffix="meses"
            min={1}
            help="Prazo do financiamento, em meses. Define por quanto tempo a parcela Price é estimada. Não muda o payback do projeto."
            disabled={financeOff}
            noEffect={financeNote}
            onChange={(termMonths) => setRobot({ ...robot, financing: { ...robot.financing, termMonths } })}
          />
          <PercentField
            label="Juros anuais efetivos"
            value={robot.financing.annualInterest}
            help="Juros efetivos ao ano do financiamento, em percentual. Entram na parcela estimada e no custo financeiro da dívida, fora do ROI operacional."
            disabled={financeOff}
            noEffect={financeNote}
            onChange={(annualInterest) => setRobot({ ...robot, financing: { ...robot.financing, annualInterest } })}
          />
          <NumberField
            label="Balão no fim do prazo"
            value={robot.financing.balloon}
            suffix="R$"
            help="Parcela extra no fim do prazo, em R$. Soma o serviço da dívida. Não entra no benefício operacional nem no payback."
            disabled={financeOff}
            noEffect={financeNote}
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
