import { PrismaClient, RiskBand } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { calculateDynamicChurnScore, getRiskReason, parseRiskBand } from '../src/utils/riskBand';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

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
            const riskBand = parsed || (score >= 0.6 ? RiskBand.High : score >= 0.3 ? RiskBand.Medium : RiskBand.Low);
            const revenueAtRisk = c.totalCharges > 0 ? c.totalCharges : parseFloat((c.monthlyCharges * 12).toFixed(2));
            const reason = getRiskReason(riskBand, c.tenure, c.contractType, c.monthlyCharges, c.internetService);

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

    // Dynamic continuous batch scoring fallback if model-service is not running
    for (const c of chunk) {
      const dynamicResult = calculateDynamicChurnScore({
        customerId: c.customerId,
        tenure: c.tenure,
        contractType: c.contractType,
        monthlyCharges: c.monthlyCharges,
        internetService: c.internetService,
        paymentMethod: c.paymentMethod,
      });

      const revenueAtRisk = c.totalCharges > 0 ? c.totalCharges : parseFloat((c.monthlyCharges * 12).toFixed(2));

      scoresToInsert.push({
        customerId: c.id,
        score: dynamicResult.score,
        riskBand: dynamicResult.riskBand,
        reason: dynamicResult.reason,
        revenueAtRisk,
      });
    }
    console.log(`Scored batch ${i / CHUNK_SIZE + 1} via dynamic continuous engine calculation.`);
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
