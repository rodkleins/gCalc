import { CheckField, ModuleImpact, NumberField, PercentField, RemoveButton, RemoveField, SelectField, StageNote, TextField } from './Fields';
import { SUGGESTED_PHARMACIST_MONTHLY_COST } from '../model/example';
import type { Inputs, ModelResult } from '../model/types';
import { formatBRL } from '../model/format';

export function ProfileForm({
  inputs,
  result,
  onChange,
}: {
  inputs: Inputs;
  result: ModelResult;
  onChange: (inputs: Inputs) => void;
}) {
  const profile = inputs.profile;
  const setProfile = (partial: Partial<Inputs['profile']>) =>
    onChange({ ...inputs, profile: { ...profile, ...partial } });
  const setMeta = (partial: Partial<Inputs['meta']>) => onChange({ ...inputs, meta: { ...inputs.meta, ...partial } });
  const headcount = profile.roles.reduce((total, role) => total + role.headcount, 0);
  const payroll = profile.roles.reduce((total, role) => total + role.headcount * role.monthlyCost, 0);

  return (
    <div className="stack">
      <StageNote>
        Esta tela descreve a loja: tamanho, equipe e tipo (nova ou existente). Ela não calcula o payback sozinha. Os
        outros módulos usam estes números para saber o que o robô evita e o que continua igual.
      </StageNote>
      <ModuleImpact result={result} module="Perfil" />
      <section className="card">
        <h2>Identificação</h2>
        <div className="form-grid">
          <TextField label="Cliente ou rede" help="Nome do cliente ou da rede. Identifica a simulação e não entra no payback, no ROI nem no VPL." value={inputs.meta.clientName} onChange={(clientName) => setMeta({ clientName })} />
          <TextField label="Loja" help="Nome da unidade. Identifica a simulação e não entra no cálculo financeiro." value={inputs.meta.storeName} onChange={(storeName) => setMeta({ storeName })} />
          <TextField label="Responsável" help="Quem responde pela premissa na loja. Não entra no cálculo." value={inputs.meta.owner} onChange={(owner) => setMeta({ owner })} />
          <TextField label="Preparado por" help="Quem montou esta simulação. Não entra no cálculo." value={inputs.meta.preparedBy} onChange={(preparedBy) => setMeta({ preparedBy })} />
          <TextField label="Data da premissa" help="Data em que os números foram assumidos. Não entra no cálculo." value={inputs.meta.premiseDate} onChange={(premiseDate) => setMeta({ premiseDate })} />
          <TextField label="Fonte" help="De onde vieram os números. Não entra no cálculo." value={inputs.meta.source} onChange={(source) => setMeta({ source })} />
          <CheckField
            className="field span-2 check"
            checked={inputs.fictional}
            onChange={(fictional) => onChange({ ...inputs, fictional })}
            label="Marcar esta simulação como dados fictícios"
            help="Ligado, a tela avisa que o caso não é parâmetro oficial nem resultado de loja real. Não muda payback, ROI nem VPL."
          />
          <TextField
            label="Notas"
            value={inputs.meta.notes}
            onChange={(notes) => setMeta({ notes })}
            hint="Contexto da visita. Não entra no cálculo."
          />
        </div>
      </section>

      <section className="card">
        <h2>Operação</h2>
        <div className="form-grid">
          <SelectField
            label="Tipo de loja"
            value={profile.storeType}
            onChange={(storeType) => setProfile({ storeType: storeType as Inputs['profile']['storeType'] })}
            options={[
              { value: 'nova', label: 'Loja nova' },
              { value: 'existente', label: 'Loja existente' },
            ]}
            hint="Loja nova pode abater prateleiras do CAPEX. Loja existente usa revenda, manutenção e rescisão."
          />
          <NumberField
            label="Lojas na projeção"
            value={profile.storeCount}
            min={1}
            suffix="lojas"
            onChange={(storeCount) => setProfile({ storeCount })}
            hint="O payback e o ROI não mudam. VPL e caixa da rede são a soma linear."
          />
          <NumberField label="Faturamento mensal" value={profile.monthlyRevenue} suffix="R$" help="Venda da loja em R$ por mês. Situa o porte. A margem de contribuição transforma venda adicional em resultado. O faturamento em si não é benefício." onChange={(monthlyRevenue) => setProfile({ monthlyRevenue })} />
          <PercentField
            label="Margem de contribuição"
            value={profile.contributionMarginPct}
            onChange={(contributionMarginPct) => setProfile({ contributionMarginPct })}
            hint="Usada só para transformar venda adicional em margem."
          />
          <NumberField label="Atendimentos por dia" value={profile.attendancesPerDay} help="Atendimentos por dia, em quantidade. Contexto da operação. Não cria benefício sozinho." onChange={(attendancesPerDay) => setProfile({ attendancesPerDay })} />
          <NumberField
            fieldId="profile.dispensationsPerDay"
            label="Dispensações por dia"
            value={profile.dispensationsPerDay}
            onChange={(dispensationsPerDay) => setProfile({ dispensationsPerDay })}
            hint="Se passar da capacidade do robô, os benefícios são reduzidos."
          />
          <NumberField label="Dias de operação no mês" value={profile.operatingDaysPerMonth} help="Dias em que a loja opera no mês. Converte volume diário em volume mensal usado nas perdas, nas caixas e na movimentação." onChange={(operatingDaysPerMonth) => setProfile({ operatingDaysPerMonth })} />
          <PercentField
            label="Crescimento anual da demanda"
            value={profile.demandGrowthPctPerYear}
            onChange={(demandGrowthPctPerYear) => setProfile({ demandGrowthPctPerYear })}
            hint="Escala perdas, avarias, caixas, movimentação e vendas. Não cria vaga sozinho."
          />
          <NumberField label="Área total" value={profile.totalAreaM2} suffix="m²" help="Área da loja, em m². Contexto. O benefício de espaço usa os m² liberados no módulo de logística, não esta área inteira." onChange={(totalAreaM2) => setProfile({ totalAreaM2 })} />
          <NumberField label="Retaguarda" value={profile.backroomAreaM2} suffix="m²" help="Área de retaguarda, em m². Contexto da operação. Não entra direto no payback." onChange={(backroomAreaM2) => setProfile({ backroomAreaM2 })} />
          <NumberField
            label="Aluguel ou ocupação de referência"
            value={profile.occupancyCostPerM2}
            suffix="R$/m²"
            onChange={(occupancyCostPerM2) => setProfile({ occupancyCostPerM2 })}
            hint="Referência da loja. O m² liberado usa o valor do módulo de logística."
          />
          <NumberField label="Estoque médio" value={profile.averageInventory} suffix="R$" help="Estoque médio atual, em R$. É a base da liberação de capital de giro: estoque atual menos estoque com o robô." onChange={(averageInventory) => setProfile({ averageInventory })} />
          <NumberField label="Giro do estoque" value={profile.inventoryTurnsPerYear} suffix="x/ano" help="Vezes que o estoque gira por ano. Leitura da operação. Não entra sozinho no fluxo de caixa." onChange={(inventoryTurnsPerYear) => setProfile({ inventoryTurnsPerYear })} />
          <NumberField label="SKUs" value={profile.skuCount} help="Quantidade de SKUs. Contexto do sortimento. Não entra sozinho no payback." onChange={(skuCount) => setProfile({ skuCount })} />
          <NumberField
            fieldId="profile.historicalLossesMonthly"
            label="Perdas históricas"
            value={profile.historicalLossesMonthly}
            suffix="R$/mês"
            onChange={(historicalLossesMonthly) => setProfile({ historicalLossesMonthly })}
            hint="Perdas evitadas = este valor − perdas projetadas no módulo de estoque."
          />
        </div>
      </section>

      <section className="card">
        <header className="section-head">
          <div>
            <h2>Quadro atual</h2>
            <p>
              {headcount} pessoas, folha completa de {formatBRL(payroll)} por mês. A economia não usa esta folha inteira:
              só as vagas evitadas no módulo Pessoas.
            </p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() =>
              setProfile({
                roles: [
                  ...profile.roles,
                  { id: crypto.randomUUID(), role: 'Novo cargo', headcount: 1, monthlyCost: 0, shift: '6x1' },
                ],
              })
            }
          >
            Adicionar cargo
          </button>
        </header>
        <div className="rows">
          {profile.roles.map((role, index) => (
            <div className="row-card" key={role.id}>
              <TextField
                label="Cargo"
                help="Nome do cargo no quadro de referência. Na versão de RH a folha que entra no caixa sai do quadro por turno, não desta lista."
                value={role.role}
                onChange={(name) => {
                  const roles = profile.roles.slice();
                  roles[index] = { ...role, role: name };
                  setProfile({ roles });
                }}
              />
              <NumberField
                label="Pessoas"
                help="Quantidade de pessoas neste cargo. Serve de contexto. A economia usa só as vagas evitadas, não esta lista inteira."
                value={role.headcount}
                min={0}
                onChange={(headcountValue) => {
                  const roles = profile.roles.slice();
                  roles[index] = { ...role, headcount: headcountValue };
                  setProfile({ roles });
                }}
              />
              <NumberField
                label="Custo completo (R$/pessoa/mês)"
                value={role.monthlyCost}
                suffix="R$"
                hint={
                  role.role.toLowerCase().includes('farmac')
                    ? `Por pessoa, por mês, já com encargos e benefícios. Sugestão fictícia do farmacêutico: R$ ${SUGGESTED_PHARMACIST_MONTHLY_COST.toLocaleString('pt-BR')}, a validar.`
                    : 'Por pessoa, por mês, já com encargos e benefícios. Não é o salário bruto.'
                }
                onChange={(monthlyCost) => {
                  const roles = profile.roles.slice();
                  roles[index] = { ...role, monthlyCost };
                  setProfile({ roles });
                }}
              />
              <TextField
                label="Escala"
                help="Escala informada neste quadro de referência, em texto. Na versão de RH o fator de cobertura é calculado no quadro por turno."
                value={role.shift}
                onChange={(shift) => {
                  const roles = profile.roles.slice();
                  roles[index] = { ...role, shift };
                  setProfile({ roles });
                }}
              />
              <RemoveField>
                <RemoveButton
                  testId={`remove-role-${role.id}`}
                  onRemove={() => setProfile({ roles: profile.roles.filter((item) => item.id !== role.id) })}
                />
              </RemoveField>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Rede escalonada</h2>
        <p className="lede">
          Desligada, a rede só replica a loja atual. Ligada, cada unidade tem data, investimento e volume próprios. O
          painel de resultados mostra o payback de cada uma.
        </p>
        <CheckField
          checked={inputs.network.enabled}
          onChange={(enabled) => onChange({ ...inputs, network: { ...inputs.network, enabled } })}
          label="Consolidar implantação escalonada"
          help="Ligado, cada unidade tem data, investimento e volume próprios e o painel mostra o payback de cada uma. Desligado, a rede só replica a loja atual."
        />
        <div className="form-grid">
          <NumberField
            label="Custo compartilhado mensal"
            value={inputs.network.sharedMonthlyCost}
            suffix="R$"
            help="Custo mensal compartilhado da rede, em R$. Entra no caixa consolidado quando a implantação escalonada está ligada. Não muda o payback de uma loja isolada."
            onChange={(sharedMonthlyCost) =>
              onChange({ ...inputs, network: { ...inputs.network, sharedMonthlyCost } })
            }
          />
        </div>
        <button
          type="button"
          className="btn"
          onClick={() =>
            onChange({
              ...inputs,
              network: {
                ...inputs.network,
                enabled: true,
                stores: [
                  ...inputs.network.stores,
                  {
                    id: `loja-${inputs.network.stores.length + 1}`,
                    name: `Loja ${inputs.network.stores.length + 1}`,
                    storeType: profile.storeType,
                    count: 1,
                    goLiveMonth: inputs.network.stores.length === 0 ? 1 : 13,
                    investmentFactor: 1,
                    volumeFactor: 1,
                    laborFactor: 1,
                  },
                ],
              },
            })
          }
        >
          Adicionar loja
        </button>
        {inputs.network.stores.map((store, index) => (
          <div className="row-card" key={store.id}>
            <TextField
              label="Nome"
              help="Nome da unidade na rede. Identifica a loja no consolidado e não entra na fórmula do payback."
              value={store.name}
              onChange={(name) => {
                const stores = inputs.network.stores.slice();
                stores[index] = { ...store, name };
                onChange({ ...inputs, network: { ...inputs.network, stores } });
              }}
            />
            <NumberField
              label="Go-live"
              help="Mês em que esta unidade começa a operar. Antes disso o benefício operacional dela fica zerado. O CAPEX sai na data de implantação."
              value={store.goLiveMonth}
              min={1}
              onChange={(goLiveMonth) => {
                const stores = inputs.network.stores.slice();
                stores[index] = { ...store, goLiveMonth };
                onChange({ ...inputs, network: { ...inputs.network, stores } });
              }}
            />
            <NumberField
              label="Fator de investimento"
              help="Multiplicador do investimento desta unidade. 1 repete o CAPEX da loja base. Entra no investimento líquido da unidade."
              value={store.investmentFactor}
              onChange={(investmentFactor) => {
                const stores = inputs.network.stores.slice();
                stores[index] = { ...store, investmentFactor };
                onChange({ ...inputs, network: { ...inputs.network, stores } });
              }}
            />
            <NumberField
              label="Fator de volume"
              help="Multiplicador do volume desta unidade. 1 repete a loja base. Escala os benefícios que dependem de movimento."
              value={store.volumeFactor}
              onChange={(volumeFactor) => {
                const stores = inputs.network.stores.slice();
                stores[index] = { ...store, volumeFactor };
                onChange({ ...inputs, network: { ...inputs.network, stores } });
              }}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
