export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
