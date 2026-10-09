import { createId } from '../model/storage';
import {
  exampleDraft,
  isHeadToHeadSection,
  type DreLine,
  type HeadToHeadDraft,
  type LineEffect,
  type ProductivityIndicator,
  type StaffLine,
} from './model';

export const HEADTOHEAD_STORAGE_KEY = 'gcalc.headtohead.v1';

export function loadDraft(storage: Pick<Storage, 'getItem'>): HeadToHeadDraft {
  const raw = storage.getItem(HEADTOHEAD_STORAGE_KEY);
  if (!raw) return exampleDraft();
  try {
    return parseDraft(JSON.parse(raw));
  } catch {
    return exampleDraft();
  }
}

export function saveDraft(storage: Pick<Storage, 'setItem'>, draft: HeadToHeadDraft): void {
  storage.setItem(HEADTOHEAD_STORAGE_KEY, JSON.stringify(draft));
}

export function clearDraft(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(HEADTOHEAD_STORAGE_KEY);
}

export function newId(): string {
  return createId();
}

function parseDraft(value: unknown): HeadToHeadDraft {
  if (!value || typeof value !== 'object') return exampleDraft();
  const record = value as Partial<HeadToHeadDraft>;
  const lines = Array.isArray(record.lines) ? record.lines.map(parseLine).filter((line) => line !== null) : null;
  const staff = Array.isArray(record.staff) ? record.staff.map(parseStaff).filter((line) => line !== null) : null;
  const indicators = Array.isArray(record.indicators)
    ? record.indicators.map(parseIndicator).filter((line) => line !== null)
    : null;
  if (!lines || !staff || !indicators) return exampleDraft();
  const fallback = exampleDraft();
  return {
    version: 1,
    fictional: record.fictional !== false,
    storeName: typeof record.storeName === 'string' ? record.storeName : fallback.storeName,
    lines,
    staff,
    indicators,
    investment: numberOr(record.investment, fallback.investment),
    discountRateAnnual: numberOr(record.discountRateAnnual, fallback.discountRateAnnual),
  };
}

function parseLine(value: unknown): DreLine | null {
  if (!value || typeof value !== 'object') return null;
  const line = value as Partial<DreLine>;
  if (typeof line.id !== 'string' || typeof line.label !== 'string') return null;
  if (typeof line.section !== 'string' || !isHeadToHeadSection(line.section)) return null;
  if (line.effect !== 'soma' && line.effect !== 'subtrai') return null;
  return {
    id: line.id,
    section: line.section,
    label: line.label,
    effect: line.effect as LineEffect,
    today: numberOr(line.today, 0),
    withRobot: numberOr(line.withRobot, 0),
  };
}

function parseStaff(value: unknown): StaffLine | null {
  if (!value || typeof value !== 'object') return null;
  const line = value as Partial<StaffLine>;
  if (typeof line.id !== 'string' || typeof line.role !== 'string') return null;
  return {
    id: line.id,
    role: line.role,
    todayHeadcount: numberOr(line.todayHeadcount, 0),
    withRobotHeadcount: numberOr(line.withRobotHeadcount, 0),
    monthlyCostPerPerson: numberOr(line.monthlyCostPerPerson, 0),
  };
}

function parseIndicator(value: unknown): ProductivityIndicator | null {
  if (!value || typeof value !== 'object') return null;
  const line = value as Partial<ProductivityIndicator>;
  if (typeof line.id !== 'string' || typeof line.name !== 'string') return null;
  return {
    id: line.id,
    name: line.name,
    unit: typeof line.unit === 'string' ? line.unit : '',
    today: numberOr(line.today, 0),
    withRobot: numberOr(line.withRobot, 0),
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
