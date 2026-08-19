import { PrismaClient, RiskBand } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with sample customers and churn scores...');

  // Clean existing data
  await prisma.churnScore.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.segment.deleteMany();

  // Create segments
  await prisma.segment.createMany({
    data: [
      { name: 'Enterprise', description: 'High volume enterprise contracts' },
      { name: 'SMB', description: 'Small and medium business accounts' },
      { name: 'Consumer High-Value', description: 'High monthly charge consumer plans' },
    ],
  });

  // Create Customers with scores
  const c1 = await prisma.customer.create({
    data: {
      customerId: 'CUST-9821',
      tenure: 24,
      contractType: 'Month-to-month',
      monthlyCharges: 85.50,
      totalCharges: 2052.00,
      internetService: 'Fiber optic',
      paymentMethod: 'Electronic check',
      actualChurn: false,
      scores: {
        create: [
          {
            score: 0.78,
            riskBand: RiskBand.High,
            reason: 'High monthly charge relative to month-to-month contract length',
            revenueAtRisk: 2052.00,
            scoredAt: new Date('2026-08-17T12:00:00Z'),
          },
        ],
      },
    },
  });

  const c2 = await prisma.customer.create({
    data: {
      customerId: 'CUST-9822',
      tenure: 36,
      contractType: 'One year',
      monthlyCharges: 45.00,
      totalCharges: 1620.00,
      internetService: 'DSL',
      paymentMethod: 'Bank transfer',
      actualChurn: false,
      scores: {
        create: [
          {
            score: 0.15,
            riskBand: RiskBand.Low,
            reason: 'Long tenure and annual contract commitment',
            revenueAtRisk: 1620.00,
            scoredAt: new Date('2026-08-17T12:00:00Z'),
          },
        ],
      },
    },
  });

  const c3 = await prisma.customer.create({
    data: {
      customerId: 'CUST-9823',
      tenure: 14,
      contractType: 'Month-to-month',
      monthlyCharges: 65.00,
      totalCharges: 910.00,
      internetService: 'Fiber optic',
      paymentMethod: 'Electronic check',
      actualChurn: false,
      scores: {
        create: [
          {
            score: 0.48,
            riskBand: RiskBand.Medium,
            reason: 'Moderate tenure with flexible month-to-month agreement',
            revenueAtRisk: 910.00,
            scoredAt: new Date('2026-08-17T12:00:00Z'),
          },
        ],
      },
    },
  });

  const c4 = await prisma.customer.create({
    data: {
      customerId: 'CUST-9824',
      tenure: 48,
      contractType: 'Two year',
      monthlyCharges: 110.00,
      totalCharges: 5280.00,
      internetService: 'Fiber optic',
      paymentMethod: 'Mailed check',
      actualChurn: false,
      scores: {
        create: [
          {
            score: 0.22,
            riskBand: RiskBand.Low,
            reason: 'Stable account metrics and low churn probability',
            revenueAtRisk: 5280.00,
            scoredAt: new Date('2026-08-17T12:00:00Z'),
          },
        ],
      },
    },
  });

  const c5 = await prisma.customer.create({
    data: {
      customerId: 'CUST-9825',
      tenure: 6,
      contractType: 'Month-to-month',
      monthlyCharges: 95.00,
      totalCharges: 570.00,
      internetService: 'Fiber optic',
      paymentMethod: 'Electronic check',
      actualChurn: true,
      scores: {
        create: [
          {
            score: 0.84,
            riskBand: RiskBand.High,
            reason: 'Short customer tenure (< 12 months) with high churn risk indicators',
            revenueAtRisk: 570.00,
            scoredAt: new Date('2026-08-17T12:00:00Z'),
          },
        ],
      },
    },
  });

  // Unscored customers for testing batch scoring
  await prisma.customer.create({
    data: {
      customerId: 'CUST-9826',
      tenure: 8,
      contractType: 'Month-to-month',
      monthlyCharges: 70.00,
      totalCharges: 560.00,
      internetService: 'DSL',
      paymentMethod: 'Electronic check',
      actualChurn: false,
    },
  });

  await prisma.customer.create({
    data: {
      customerId: 'CUST-9827',
      tenure: 18,
      contractType: 'One year',
      monthlyCharges: 55.00,
      totalCharges: 990.00,
      internetService: 'Fiber optic',
      paymentMethod: 'Bank transfer',
      actualChurn: false,
    },
  });

  console.log(`Database seeded successfully! Created 7 customers and 5 initial scores.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
