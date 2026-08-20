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

export interface PaginatedCustomers {
  data: Customer[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export async function fetchCustomers(
  segment?: string,
  riskBand?: string,
  page?: number,
  limit?: number
): Promise<PaginatedCustomers> {
  const params = new URLSearchParams();
  if (segment && segment.trim() !== '' && segment.toLowerCase() !== 'all') {
    params.append('segment', segment);
  }
  if (riskBand && riskBand.trim() !== '' && riskBand.toLowerCase() !== 'all') {
    params.append('riskBand', riskBand);
  }
  if (page) params.append('page', page.toString());
  if (limit) params.append('limit', limit.toString());

  const query = params.toString();
  const url = `${BASE_URL}/api/customers${query ? `?${query}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch customers: ${res.statusText}`);
  }
  const body = await res.json();
  if (Array.isArray(body)) {
    return {
      data: body,
      total: body.length,
      page: 1,
      totalPages: 1,
      limit: body.length,
    };
  }
  return body;
}

export async function fetchCustomerById(id: string): Promise<Customer> {
  const res = await fetch(`${BASE_URL}/api/customers/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch customer '${id}': ${res.statusText}`);
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
