import type { StatusKey, PermitStatus } from './types';

export interface StatusStyle {
  key: StatusKey;
  label: string;
  bg: string;
  border: string;
  fg: string;
}

const STATUS_TABLE: Record<StatusKey, StatusStyle> = {
  AP: { key: 'AP', label: 'Approved', bg: '#C0DD97', border: '#7FAE52', fg: '#0E2A02' },
  FI: { key: 'FI', label: 'Filed', bg: '#B5D4F4', border: '#5F94CC', fg: '#042C53' },
  WO: { key: 'WO', label: 'Waiting on', bg: '#FAC775', border: '#D89724', fg: '#412402' },
  TF: { key: 'TF', label: 'To file', bg: '#D3D1C7', border: '#A8A595', fg: '#2C2C2A' },
  TS: { key: 'TS', label: 'To submit', bg: '#F1EFE8', border: '#C7C3B5', fg: '#5F5E5A' },
};

const RAW_TO_KEY: Record<string, StatusKey> = {
  approved: 'AP',
  filed: 'FI',
  'waiting on': 'WO',
  'to file': 'TF',
  'to submit': 'TS',
};

export function planStatusKey(rawStatus: string | null | undefined): StatusKey | null {
  if (!rawStatus) return null;
  return RAW_TO_KEY[rawStatus.trim().toLowerCase()] ?? null;
}

export function planStatusStyle(key: StatusKey | null): StatusStyle | null {
  return key ? STATUS_TABLE[key] : null;
}

export const PLAN_STATUS_ORDER: StatusKey[] = ['AP', 'FI', 'WO', 'TF', 'TS'];
export const PLAN_STATUS_TABLE = STATUS_TABLE;

const PERMIT_RAW_TO_KEY: Record<string, PermitStatus> = {
  active: 'active',
  'expiring soon': 'expiring',
  expiring: 'expiring',
  expired: 'expired',
};

export function permitStatusKey(rawStatus: string | null | undefined): PermitStatus {
  if (!rawStatus) return 'active';
  const k = PERMIT_RAW_TO_KEY[rawStatus.trim().toLowerCase()];
  return k ?? 'active';
}
