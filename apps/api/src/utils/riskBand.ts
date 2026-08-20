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

export interface CustomerScoreInput {
  customerId: string;
  tenure: number;
  contractType: string;
  monthlyCharges: number;
  internetService?: string;
  paymentMethod?: string;
}

export interface DynamicChurnScoreResult {
  score: number;
  riskBand: RiskBand;
  reason: string;
}

/**
 * Computes a dynamic, continuous churn probability score [0.03, 0.97]
 * and assigns appropriate RiskBand and contextual reason based on
 * customer contract, tenure, billing, internet service, and payment method.
 */
export function calculateDynamicChurnScore(input: CustomerScoreInput): DynamicChurnScoreResult {
  const { customerId, tenure, contractType, monthlyCharges, internetService = '', paymentMethod = '' } = input;

  const contractNorm = contractType.toLowerCase();
  const internetNorm = internetService.toLowerCase();
  const paymentNorm = paymentMethod.toLowerCase();

  // 1. Base probability
  let baseProb = 0.30;

  // 2. Contract factor
  if (contractNorm.includes('month')) {
    baseProb += 0.28;
  } else if (contractNorm.includes('two') || contractNorm.includes('2')) {
    baseProb -= 0.22;
  } else if (contractNorm.includes('one') || contractNorm.includes('1') || contractNorm.includes('year')) {
    baseProb -= 0.08;
  }

  // 3. Tenure factor (exponential decay + long tenure bonus)
  const tenureEffect = 0.18 * Math.exp(-Math.max(0, tenure) / 14) - 0.12 * Math.min(Math.max(0, tenure) / 60, 1);
  baseProb += tenureEffect;

  // 4. Monthly charge factor relative to $65 baseline
  const chargeEffect = ((monthlyCharges - 65) / 55) * 0.14;
  baseProb += chargeEffect;

  // 5. Internet service tier
  if (internetNorm.includes('fiber')) {
    baseProb += 0.09;
  } else if (internetNorm.includes('no') || internetNorm.includes('none')) {
    baseProb -= 0.12;
  } else if (internetNorm.includes('dsl')) {
    baseProb += 0.01;
  }

  // 6. Payment method
  if (paymentNorm.includes('electronic') || paymentNorm.includes('bank') || paymentNorm.includes('withdrawal')) {
    baseProb += 0.06;
  } else if (paymentNorm.includes('credit') || paymentNorm.includes('auto')) {
    baseProb -= 0.06;
  } else if (paymentNorm.includes('mail')) {
    baseProb += 0.02;
  }

  // 7. Deterministic customer variance to avoid artificial clumping
  const hash = customerId.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 10000, 0);
  const variance = ((hash % 100) - 50) / 1000; // range [-0.05, +0.05]
  baseProb += variance;

  // Bound score between 0.03 and 0.97
  const score = Math.max(0.03, Math.min(0.97, parseFloat(baseProb.toFixed(4))));

  // Classify Risk Band based on standard model service thresholds
  let riskBand: RiskBand;
  if (score >= 0.60) {
    riskBand = RiskBand.High;
  } else if (score >= 0.30) {
    riskBand = RiskBand.Medium;
  } else {
    riskBand = RiskBand.Low;
  }

  const reason = getRiskReason(riskBand, tenure, contractType, monthlyCharges, internetService);

  return {
    score,
    riskBand,
    reason,
  };
}

export function getRiskReason(
  riskBand: RiskBand,
  tenure: number,
  contractType: string,
  monthlyCharges: number,
  internetService?: string
): string {
  const contractNorm = contractType.toLowerCase();
  const internetNorm = (internetService || '').toLowerCase();

  if (riskBand === RiskBand.High) {
    if (contractNorm.includes('month') && tenure < 12 && monthlyCharges > 75) {
      return `Short tenure (${tenure} mos) on month-to-month plan with elevated monthly bill ($${monthlyCharges.toFixed(2)})`;
    }
    if (contractNorm.includes('month') && monthlyCharges > 70) {
      return `High monthly charge ($${monthlyCharges.toFixed(2)}) relative to flexible month-to-month contract length`;
    }
    if (tenure < 12) {
      return `Short customer tenure (${tenure} mos) with elevated early-lifecycle churn risk indicators`;
    }
    if (internetNorm.includes('fiber')) {
      return `High-rate Fiber Optic plan on month-to-month commitment with high churn probability`;
    }
    return 'Elevated churn probability driven by contract flexibility and pricing sensitivity';
  }

  if (riskBand === RiskBand.Medium) {
    if (contractNorm.includes('month')) {
      return `Moderate tenure (${tenure} mos) on month-to-month agreement; monitored for usage changes`;
    }
    if (tenure <= 24) {
      return `Mid-tenure account (${tenure} mos) with moderate renewal and retention indicators`;
    }
    return 'Moderate churn risk; stable payment history with standard service engagement';
  }

  // RiskBand.Low
  if (contractNorm.includes('two') || contractNorm.includes('2')) {
    return `Long-term two-year contract commitment with ${tenure} months account stability`;
  }
  if (contractNorm.includes('one') || contractNorm.includes('1') || contractNorm.includes('year')) {
    return `Annual contract commitment with ${tenure} months established account tenure`;
  }
  return `Stable long-term account metrics (${tenure} mos tenure) with low churn probability`;
}

