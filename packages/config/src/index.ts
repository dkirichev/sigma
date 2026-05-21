import type { RiskBand } from '@sigma/shared';

export const PRICE_INDEX_CATEGORIES = ['храни', 'строителство'] as const;
export type PriceIndexCategory = (typeof PRICE_INDEX_CATEGORIES)[number];

export interface RiskWeights {
  spec: number;
  price: number;
  competition: number;
  cartel: number;
  process: number;
}

// Weights sum to 1.0 so a fully-saturated tender scores exactly 100.
export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  spec: 0.25,
  price: 0.25,
  competition: 0.2,
  cartel: 0.2,
  process: 0.1,
};

export const RISK_BAND_LABELS: Record<RiskBand, string> = {
  low: 'Нисък',
  medium: 'Среден',
  high: 'Висок',
  critical: 'Критичен',
};

export function requireEnv(env: Record<string, unknown>, key: string): string {
  const value = env[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
