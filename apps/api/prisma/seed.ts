import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed process...');

  const csvPaths = [
    path.resolve(__dirname, '../../../data/processed/churn_processed.csv'),
    path.resolve(__dirname, '../../../data/processed/churn_cleaned_readable.csv'),
    path.resolve(__dirname, '../../data/processed/churn_processed.csv'),
  ];

  let csvPath = '';
  for (const p of csvPaths) {
    if (fs.existsSync(p)) {
      csvPath = p;
      break;
    }
  }

  if (!csvPath) {
    throw new Error(`CSV file not found in paths: ${csvPaths.join(', ')}`);
  }

  console.log(`Reading CSV data from: ${csvPath}`);
  const fileContent = fs.readFileSync(csvPath, 'utf-8');

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Parsed ${records.length} records from CSV. Mapping fields...`);

  const customersData = records.map((row: any) => {
    const customerId = row['Customer ID'] || row['customerId'] || row['Customer_ID'];
    const tenure = parseInt(row['Tenure in Months'] || row['tenure'] || '0', 10);
    const contractRaw = row['Contract'] || row['contractType'] || 'Month-to-Month';
    const contractType = contractRaw.trim().toLowerCase() === 'month-to-month'
      ? 'Month-to-month'
      : contractRaw.trim().toLowerCase() === 'one year'
      ? 'One year'
      : contractRaw.trim().toLowerCase() === 'two year'
      ? 'Two year'
      : contractRaw.trim();
    const monthlyCharges = parseFloat(row['Monthly Charge'] || row['monthlyCharges'] || '0');
    const totalChargesRaw = row['Total Charges'] || row['totalCharges'] || '0';
    const totalCharges = parseFloat(totalChargesRaw) || 0;

    let internetService = row['Internet Type'] || row['Internet Service'] || row['internetService'] || 'DSL';
    if (internetService === 'None' || internetService === 'No') {
      internetService = 'No internet service';
    }

    const paymentMethod = row['Payment Method'] || row['paymentMethod'] || 'Electronic check';

    const churnVal = row['Churn Value'] || row['actualChurn'] || '0';
    const actualChurn = churnVal === '1' || churnVal === 'Yes' || churnVal === 'true';

    return {
      customerId,
      tenure,
      contractType,
      monthlyCharges,
      totalCharges,
      internetService,
      paymentMethod,
      actualChurn,
    };
  });

  const validCustomers = customersData.filter((c: { customerId?: string }) => c.customerId);

  console.log(`Inserting ${validCustomers.length} valid customer records into database...`);

  const result = await prisma.customer.createMany({
    data: validCustomers,
    skipDuplicates: true,
  });

  console.log(`Successfully seeded ${result.count} customers into the database!`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
