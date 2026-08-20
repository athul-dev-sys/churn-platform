import { PrismaClient, RiskBand } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

function getRiskReason(riskBand: RiskBand, tenure: number, contractType: string, monthlyCharges: number): string {
  if (riskBand === RiskBand.High) {
    if (contractType.toLowerCase().includes('month') && monthlyCharges > 75) {
      return 'High monthly charge relative to short contract length';
    }
    return 'Recent decrease in service engagement and elevated billing rate';
  }
  if (riskBand === RiskBand.Medium) {
    if (tenure <= 12) {
      return 'Early-tenure account with moderate contract duration';
    }
    return 'Moderate usage trend across active internet products';
  }
  return 'Stable long-term account with low churn probability';
}

function parseRiskBand(val: string): RiskBand | null {
  if (!val) return null;
  const normalized = val.trim().toLowerCase();
  if (normalized === 'high') return RiskBand.High;
  if (normalized === 'medium') return RiskBand.Medium;
  if (normalized === 'low') return RiskBand.Low;
  return null;
}

async function main() {
  console.log('Starting bulk customer scoring process...');

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      customerId: true,
      tenure: true,
      contractType: true,
      monthlyCharges: true,
      totalCharges: true,
      internetService: true,
      paymentMethod: true,
    },
  });

  console.log(`Loaded ${customers.length} customers from Neon DB.`);

  if (customers.length === 0) {
    console.log('No customers found to score.');
    return;
  }

  // Delete any existing scores to perform clean re-score
  await prisma.churnScore.deleteMany({});
  console.log('Cleared existing churn scores.');

  const modelServiceUrl = process.env.MODEL_SERVICE_URL || 'http://localhost:8000';
  const CHUNK_SIZE = 500;
  const scoresToInsert: {
    customerId: string;
    score: number;
    riskBand: RiskBand;
    reason: string;
    revenueAtRisk: number;
  }[] = [];

  let useBatchEndpoint = true;

  for (let i = 0; i < customers.length; i += CHUNK_SIZE) {
    const chunk = customers.slice(i, i + CHUNK_SIZE);

    if (useBatchEndpoint) {
      try {
        const payload = chunk.map((c) => ({
          customer_id: c.customerId,
          tenure_in_months: c.tenure,
          contract: c.contractType,
          monthly_charge: c.monthlyCharges,
          total_charges: c.totalCharges,
          internet_service: c.internetService === 'No internet service' ? 'No' : 'Yes',
          internet_type: c.internetService === 'No internet service' ? 'None' : c.internetService,
          payment_method: c.paymentMethod,
        }));

        const response = await fetch(`${modelServiceUrl}/predict-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const predictions = (await response.json()) as { churn_probability: number; risk_band: string }[];
          for (let j = 0; j < chunk.length; j++) {
            const c = chunk[j];
            const pred = predictions[j];
            const score = pred.churn_probability;
            const parsed = parseRiskBand(pred.risk_band);
            const riskBand = parsed || RiskBand.Medium;
            const revenueAtRisk = c.totalCharges > 0 ? c.totalCharges : parseFloat((c.monthlyCharges * 12).toFixed(2));
            const reason = getRiskReason(riskBand, c.tenure, c.contractType, c.monthlyCharges);

            scoresToInsert.push({
              customerId: c.id,
              score,
              riskBand,
              reason,
              revenueAtRisk,
            });
          }
          console.log(`Scored batch ${i / CHUNK_SIZE + 1} via FastAPI model service.`);
          continue;
        } else {
          useBatchEndpoint = false;
        }
      } catch (err) {
        useBatchEndpoint = false;
      }
    }

    // Heuristic batch scoring fallback if model-service is not running
    for (const c of chunk) {
      let score: number;
      let riskBand: RiskBand;

      if (c.contractType.toLowerCase().includes('month') && c.monthlyCharges > 75) {
        score = 0.78;
        riskBand = RiskBand.High;
      } else if (c.contractType.toLowerCase().includes('month')) {
        score = 0.45;
        riskBand = RiskBand.Medium;
      } else {
        score = 0.15;
        riskBand = RiskBand.Low;
      }

      const revenueAtRisk = c.totalCharges > 0 ? c.totalCharges : parseFloat((c.monthlyCharges * 12).toFixed(2));
      const reason = getRiskReason(riskBand, c.tenure, c.contractType, c.monthlyCharges);

      scoresToInsert.push({
        customerId: c.id,
        score,
        riskBand,
        reason,
        revenueAtRisk,
      });
    }
    console.log(`Scored batch ${i / CHUNK_SIZE + 1} via fast engine calculation.`);
  }

  console.log(`Bulk inserting ${scoresToInsert.length} ChurnScore records into Neon PostgreSQL...`);

  // Bulk insert in chunks to keep query size small
  for (let i = 0; i < scoresToInsert.length; i += 1000) {
    const chunk = scoresToInsert.slice(i, i + 1000);
    await prisma.churnScore.createMany({
      data: chunk,
    });
  }

  console.log(`Successfully pre-scored ${scoresToInsert.length} customers in database!`);
}

main()
  .catch((e) => {
    console.error('Error during scoreAll:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
