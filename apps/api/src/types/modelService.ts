import { RiskBand } from '@prisma/client';

export interface ModelServiceRequest {
  customer_id?: string;
  tenure?: number;
  contract_type?: string;
  monthly_charges?: number;
  total_charges?: number;
  internet_service?: string;
  payment_method?: string;
  additional_features?: Record<string, unknown>;
}

export interface ModelServiceResponse {
  churn_probability: number;
  risk_band: string;
}

export interface ScoreBatchRequestBody {
  customerIds?: string[];
}

export interface ChurnScoreFormatted {
  id: string;
  customerId: string;
  score: number;
  riskBand: RiskBand;
  reason: string;
  revenueAtRisk: number;
  scoredAt: Date;
}
