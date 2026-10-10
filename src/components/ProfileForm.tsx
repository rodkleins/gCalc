import { ModuleImpact, NumberField, PercentField, RemoveButton, RemoveField, SelectField, StageNote, TextField } from './Fields';
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
          <TextField label="Cliente ou rede" value={inputs.meta.clientName} onChange={(clientName) => setMeta({ clientName })} />
          <TextField label="Loja" value={inputs.meta.storeName} onChange={(storeName) => setMeta({ storeName })} />
          <TextField label="Responsável" value={inputs.meta.owner} onChange={(owner) => setMeta({ owner })} />
          <TextField label="Preparado por" value={inputs.meta.preparedBy} onChange={(preparedBy) => setMeta({ preparedBy })} />
          <TextField label="Data da premissa" value={inputs.meta.premiseDate} onChange={(premiseDate) => setMeta({ premiseDate })} />
          <TextField label="Fonte" value={inputs.meta.source} onChange={(source) => setMeta({ source })} />
          <label className="field span-2 check">
            <input
              type="checkbox"
              checked={inputs.fictional}
              onChange={(event) => onChange({ ...inputs, fictional: event.target.checked })}
            />
            <span>Marcar esta simulação como dados fictícios</span>
          </label>
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
          <NumberField label="Faturamento mensal" value={profile.monthlyRevenue} suffix="R$" onChange={(monthlyRevenue) => setProfile({ monthlyRevenue })} />
          <PercentField
            label="Margem de contribuição"
            value={profile.contributionMarginPct}
            onChange={(contributionMarginPct) => setProfile({ contributionMarginPct })}
            hint="Usada só para transformar venda adicional em margem."
          />
          <NumberField label="Atendimentos por dia" value={profile.attendancesPerDay} onChange={(attendancesPerDay) => setProfile({ attendancesPerDay })} />
          <NumberField
            fieldId="profile.dispensationsPerDay"
            label="Dispensações por dia"
            value={profile.dispensationsPerDay}
            onChange={(dispensationsPerDay) => setProfile({ dispensationsPerDay })}
            hint="Se passar da capacidade do robô, os benefícios são reduzidos."
          />
          <NumberField label="Dias de operação no mês" value={profile.operatingDaysPerMonth} onChange={(operatingDaysPerMonth) => setProfile({ operatingDaysPerMonth })} />
          <PercentField
            label="Crescimento anual da demanda"
            value={profile.demandGrowthPctPerYear}
            onChange={(demandGrowthPctPerYear) => setProfile({ demandGrowthPctPerYear })}
            hint="Escala perdas, avarias, caixas, movimentação e vendas. Não cria vaga sozinho."
          />
          <NumberField label="Área total" value={profile.totalAreaM2} suffix="m²" onChange={(totalAreaM2) => setProfile({ totalAreaM2 })} />
          <NumberField label="Retaguarda" value={profile.backroomAreaM2} suffix="m²" onChange={(backroomAreaM2) => setProfile({ backroomAreaM2 })} />
          <NumberField
            label="Aluguel ou ocupação de referência"
            value={profile.occupancyCostPerM2}
            suffix="R$/m²"
            onChange={(occupancyCostPerM2) => setProfile({ occupancyCostPerM2 })}
            hint="Referência da loja. O m² liberado usa o valor do módulo de logística."
          />
          <NumberField label="Estoque médio" value={profile.averageInventory} suffix="R$" onChange={(averageInventory) => setProfile({ averageInventory })} />
          <NumberField label="Giro do estoque" value={profile.inventoryTurnsPerYear} suffix="x/ano" onChange={(inventoryTurnsPerYear) => setProfile({ inventoryTurnsPerYear })} />
          <NumberField label="SKUs" value={profile.skuCount} onChange={(skuCount) => setProfile({ skuCount })} />
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
                value={role.role}
                onChange={(name) => {
                  const roles = profile.roles.slice();
                  roles[index] = { ...role, role: name };
                  setProfile({ roles });
                }}
              />
              <NumberField
                label="Pessoas"
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
        <label className="field check">
          <input
            type="checkbox"
            checked={inputs.network.enabled}
            onChange={(event) =>
              onChange({ ...inputs, network: { ...inputs.network, enabled: event.target.checked } })
            }
          />
          <span>Consolidar implantação escalonada</span>
        </label>
        <div className="form-grid">
          <NumberField
            label="Custo compartilhado mensal"
            value={inputs.network.sharedMonthlyCost}
            suffix="R$"
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
              value={store.name}
              onChange={(name) => {
                const stores = inputs.network.stores.slice();
                stores[index] = { ...store, name };
                onChange({ ...inputs, network: { ...inputs.network, stores } });
              }}
            />
            <NumberField
              label="Go-live"
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
              value={store.investmentFactor}
              onChange={(investmentFactor) => {
                const stores = inputs.network.stores.slice();
                stores[index] = { ...store, investmentFactor };
                onChange({ ...inputs, network: { ...inputs.network, stores } });
              }}
            />
            <NumberField
              label="Fator de volume"
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
