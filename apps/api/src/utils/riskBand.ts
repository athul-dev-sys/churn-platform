import { RiskBand } from '@prisma/client';

export const RISK_BAND_VALUES: RiskBand[] = [RiskBand.High, RiskBand.Medium, RiskBand.Low];

export function parseRiskBand(val: unknown): RiskBand | null {
  if (typeof val !== 'string') return null;
  const normalized = val.trim();
  const matched = RISK_BAND_VALUES.find(
    (b) => b.toLowerCase() === normalized.toLowerCase()
  );
  return matched || null;
}

export function getRiskReason(
  riskBand: RiskBand,
  tenure: number,
  contractType: string,
  monthlyCharges: number
): string {
  if (riskBand === RiskBand.High) {
    if (contractType === 'Month-to-month' && monthlyCharges > 70) {
      return 'High monthly charge relative to month-to-month contract length';
    }
    if (tenure < 12) {
      return 'Short customer tenure (< 12 months) with high churn risk indicators';
    }
    return 'High churn probability based on historical usage and billing pattern';
  }

  if (riskBand === RiskBand.Medium) {
    if (contractType === 'Month-to-month') {
      return 'Moderate tenure with flexible month-to-month agreement';
    }
    return 'Moderate churn risk; monitored for changes in billing or service activity';
  }

  // RiskBand.Low
  if (contractType.includes('year')) {
    return 'Long tenure and annual contract commitment';
  }
  return 'Stable account metrics and low churn probability';
}
