const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface Customer {
  id: string;
  customerId: string;
  tenure: number;
  contractType: string;
  monthlyCharges: number;
  totalCharges: number;
  internetService: string;
  paymentMethod: string;
  actualChurn: boolean;
  scores?: ChurnScore[];
}

export interface ChurnScore {
  id: string;
  customerId: string;
  score: number;
  riskBand: 'High' | 'Medium' | 'Low';
  reason: string;
  revenueAtRisk: number;
  scoredAt: string;
}

export interface SummaryStats {
  totalCustomers: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalRevenueAtRisk: number;
  averageChurnScore: number;
}

export async function fetchCustomers(segment?: string, riskBand?: string): Promise<Customer[]> {
  const params = new URLSearchParams();
  if (segment) params.append('segment', segment);
  if (riskBand) params.append('riskBand', riskBand);

  const res = await fetch(`${BASE_URL}/api/customers?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch customers: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSummary(): Promise<SummaryStats> {
  const res = await fetch(`${BASE_URL}/api/summary`);
  if (!res.ok) {
    throw new Error(`Failed to fetch summary: ${res.statusText}`);
  }
  return res.json();
}

export async function scoreBatch(customerIds: string[]): Promise<{ processed: number; scores: ChurnScore[] }> {
  const res = await fetch(`${BASE_URL}/api/score-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerIds }),
  });
  if (!res.ok) {
    throw new Error(`Failed to trigger batch scoring: ${res.statusText}`);
  }
  return res.json();
}
