import { formatPercent } from '../model/format';
import type { Inputs } from '../model/types';
import { applyRoster, type Roster } from './roster';

/** Acima de 50% o adicional deixa de ser a faixa das notas (padrão 10% = 0,10). */
export const NIGHT_PREMIUM_MAX = 0.5;
const CHARGES_FACTOR = 1.3333;

function near(value: number, target: number): boolean {
  return Math.abs(value - target) <= 0.02 * Math.max(1, Math.abs(target));
}

function active(values: number[], shiftCount: number): number[] {
  return values.slice(0, shiftCount);
}

export function rosterWarnings(roster: Roster): string[] {
  const messages: string[] = [];
  const present = roster.posts.some((post) => active(post.onDuty, roster.shiftCount).some((value) => value > 0));
  const freed = roster.posts.some((post) => active(post.freed, roster.shiftCount).some((value) => value > 0));
  if (present && !freed) {
    messages.push('Nenhum posto liberado pelo robô (freed zerado em todos). A economia de pessoal fica em zero.');
  }
  const premium = roster.nightPremiumPct;
  if (!Number.isFinite(premium) || premium < 0 || premium > NIGHT_PREMIUM_MAX) {
    const shown = Number.isFinite(premium) ? formatPercent(premium) : 'inválido';
    const unit = Math.abs(premium - 1) < 1e-9 ? ' O valor 1 significa 100%, não 10%.' : '';
    messages.push(
      `Adicional noturno fora da faixa de 0% a 50% (${shown}). No JSON a unidade é fração: 0,10 significa 10%. O padrão das notas é 10%.${unit}`,
    );
  }
  const costs = new Map<string, Set<number>>();
  for (const post of roster.posts) {
    const key = `${post.role.trim() || 'Cargo'} / ${post.counter.trim() || 'Balcão'}`;
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

function chargesSplit(inputs: Inputs, roster: Roster): boolean {
  let charged = false;
  let plain = false;
  for (const role of inputs.profile.roles) {
    const posts = roster.posts.filter((post) => post.role.trim().toLowerCase() === role.role.trim().toLowerCase());
    for (const post of posts) {
      if (post.monthlyCost <= 0) continue;
      const ratio = role.monthlyCost / post.monthlyCost;
      if (near(ratio, CHARGES_FACTOR)) charged = true;
      if (near(ratio, 1)) plain = true;
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
