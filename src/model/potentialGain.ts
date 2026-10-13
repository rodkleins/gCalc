import { evaluate } from './calculate';
import type { Inputs, ModelResult } from './types';

export interface PotentialGainLine {
  id: string;
  label: string;
  monthly: number;
  oneTime: number;
}

export interface PotentialGain {
  lines: PotentialGainLine[];
  monthlyTotal: number;
  payback: number | null;
  roi: number | null;
}

/**
 * Ganhos marcados como potencial que ficaram fora do caixa e teriam valor
 * se a opção de incluí-los estivesse ligada. Não altera o resultado oficial.
 */
export function potentialGain(inputs: Inputs, result: ModelResult): PotentialGain | null {
  if (inputs.assumptions.includePotential) return null;
  const upside = evaluate(
    { ...inputs, assumptions: { ...inputs.assumptions, includePotential: true } },
    { scenario: result.scenario },
  );
  const lines = upside.audit
    .filter((line) => {
      if (line.confidence !== 'potencial' || !line.includedInCashFlow) return false;
      const before = result.audit.find((item) => item.id === line.id);
      if (before?.includedInCashFlow) return false;
      return line.monthlyValue !== 0 || line.oneTimeValue !== 0;
    })
    .map((line) => ({
      id: line.id,
      label: line.label,
      monthly: line.monthlyValue,
      oneTime: line.oneTimeValue,
    }));
  if (lines.length === 0) return null;
  return {
    lines,
    monthlyTotal: lines.reduce((sum, line) => sum + line.monthly, 0),
    payback: upside.payback,
    roi: upside.roi,
  };
}
