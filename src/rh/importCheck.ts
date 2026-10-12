import { MINIMUM_EQUIPMENT_PRICE } from '../model/example';
import { formatBRL, formatPercent } from '../model/format';
import type { Inputs } from '../model/types';
import { applyRoster, NIGHT_PREMIUM_MIN, shiftNightMultiplier, type Roster, type RosterPost } from './roster';

const CHARGES_FACTOR = 1.3333;
const INSTALLATION_TRAINING = 50_000;

function near(value: number, target: number): boolean {
  return Math.abs(value - target) <= 0.02 * Math.max(1, Math.abs(target));
}

function active(values: number[], shiftCount: number): number[] {
  return values.slice(0, shiftCount);
}

/** Avisa quando o arquivo traz adicional abaixo de 100%. A unidade no JSON é fração: 100% = 1,0. */
export function nightPremiumBelowMinimum(premium: number): string | null {
  if (Number.isFinite(premium) && premium >= NIGHT_PREMIUM_MIN) return null;
  const shown = Number.isFinite(premium) ? formatPercent(premium) : 'inválido';
  return `Adicional noturno abaixo de 100% (${shown}). No JSON a unidade é fração: 100% = 1,0. O padrão é 100% e o valor não fica abaixo disso. O quadro usa 100%.`;
}

export function rosterWarnings(roster: Roster): string[] {
  const messages: string[] = [];
  const present = roster.posts.some((post) => active(post.onDuty, roster.shiftCount).some((value) => value > 0));
  const freed = roster.posts.some((post) => active(post.freed, roster.shiftCount).some((value) => value > 0));
  if (present && !freed) {
    messages.push('Nenhum posto liberado pelo robô (freed zerado em todos). A economia de pessoal fica em zero.');
  }
  const night = nightPremiumBelowMinimum(roster.nightPremiumPct);
  if (night) messages.push(night);
  const costs = new Map<string, Set<number>>();
  for (const post of roster.posts) {
    const key = `${post.role.trim() || 'Cargo'} / ${post.counter.trim() || 'sem balcão'}`;
    const seen = costs.get(key) ?? new Set<number>();
    seen.add(Math.round(post.monthlyCost));
    costs.set(key, seen);
  }
  for (const [key, seen] of costs) {
    if (seen.size > 1) {
      messages.push(`Há mais de um custo para ${key}. Separe por função, com um nome de cargo diferente em cada linha.`);
    }
  }
  return messages;
}

/** Média do adicional noturno neste posto. Com 100% e gente igual nos 3 turnos, dá 4/3. */
function nightBlend(post: RosterPost, roster: Roster): number {
  let weight = 0;
  let blended = 0;
  for (let index = 0; index < roster.shiftCount; index += 1) {
    const seats = Math.max(0, post.onDuty[index] ?? 0);
    weight += seats;
    blended += seats * shiftNightMultiplier(index, roster);
  }
  return weight > 0 ? blended / weight : 1;
}

function chargesSplit(inputs: Inputs, roster: Roster): boolean {
  let charged = false;
  let plain = false;
  for (const role of inputs.profile.roles) {
    const posts = roster.posts.filter((post) => post.role.trim().toLowerCase() === role.role.trim().toLowerCase());
    for (const post of posts) {
      if (post.monthlyCost <= 0) continue;
      const ratio = role.monthlyCost / post.monthlyCost;
      const blend = nightBlend(post, roster);
      if (near(ratio, blend) || near(ratio, 1)) plain = true;
      if (!near(ratio, blend) && (near(ratio, CHARGES_FACTOR) || near(ratio / blend, CHARGES_FACTOR))) charged = true;
    }
  }
  return charged && plain;
}

function profileDiverges(inputs: Inputs, roster: Roster): boolean {
  const aligned = applyRoster(structuredClone(inputs), roster).profile.roles;
  const signature = (roles: Inputs['profile']['roles']) =>
    roles
      .map((role) => `${role.role.trim().toLowerCase()}|${role.headcount.toFixed(2)}|${role.monthlyCost.toFixed(0)}`)
      .sort()
      .join(';');
  return signature(inputs.profile.roles) !== signature(aligned);
}

/**
 * Inconsistências do JSON antes de o quadro reescrever o perfil.
 * `explicitRoster` falso é migração da calculadora antiga: o perfil ainda não é um quadro.
 */
export function rhImportWarnings(inputs: Inputs, roster: Roster, explicitRoster: boolean): string[] {
  const messages = rosterWarnings(roster);
  const equipment = inputs.robot.capex.equipment;
  if (equipment < MINIMUM_EQUIPMENT_PRICE) {
    messages.push(
      `Equipamento abaixo de R$ 1.000.000 (${formatBRL(equipment)}). O piso dos modelos é R$ 1.000.000, sem fator escondido.`,
    );
  } else if (Math.round(equipment) % 1_000 !== 0) {
    messages.push(
      `Equipamento de ${formatBRL(equipment)} não está em milhar cheio. Os modelos não aplicam um fator escondido, como 1,05 sobre o preço.`,
    );
  }
  const installation = inputs.robot.capex.installationTraining;
  if (installation !== INSTALLATION_TRAINING) {
    messages.push(
      `Instalação do robô em ${formatBRL(installation)} em vez de R$ 50.000. Os modelos desta versão usam R$ 50.000, sem fator de 1,05.`,
    );
  }
  if (!explicitRoster) return messages;
  if (inputs.people.payroll.chargesPct > 0) {
    messages.push(
      `Encargos de ${formatPercent(inputs.people.payroll.chargesPct)} no perfil não são reaplicados. O custo do quadro já inclui encargos e benefícios, no mesmo critério para todos os cargos.`,
    );
  }
  if (chargesSplit(inputs, roster)) {
    messages.push(
      'O fator de encargos 1,3333 aparece em alguns cargos do perfil e não em outros. A regra é uma só: o custo da linha já inclui encargos e benefícios, sem multiplicar de novo.',
    );
  }
  if (profileDiverges(inputs, roster)) {
    messages.push('Perfil e quadro divergem em efetivo ou custo. O quadro prevalece e o perfil importado é alinhado a ele.');
  }
  return messages;
}
