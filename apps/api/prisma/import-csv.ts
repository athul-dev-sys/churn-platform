import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();

interface CsvRow {
  'Customer ID'?: string;
  'Tenure in Months'?: string;
  Contract?: string;
  'Monthly Charge'?: string;
  'Total Charges'?: string;
  'Internet Type'?: string;
  'Payment Method'?: string;
  'Churn Value'?: string;
  [key: string]: string | undefined;
}

interface CustomerInsertData {
  customerId: string;
  tenure: number;
  contractType: string;
  monthlyCharges: number;
  totalCharges: number;
  internetService: string;
  paymentMethod: string;
  actualChurn: boolean;
}

function normalizeContract(contractRaw: string): string {
  const trimmed = contractRaw.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'month-to-month') {
    return 'Month-to-month';
  }
  if (lower === 'one year') {
    return 'One year';
  }
  if (lower === 'two year') {
    return 'Two year';
  }
  return trimmed;
}

async function importCsv() {
  console.log('Starting bulk CSV import into Customer database table...');

  const csvPath = path.resolve(__dirname, '../../../data/processed/churn_cleaned_readable.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at expected path: ${csvPath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');

  const records: CsvRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Loaded ${records.length} raw rows from CSV.`);

  const validCustomers: CustomerInsertData[] = [];
  const skippedRows: { customerId?: string; reason: string }[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rawId = row['Customer ID'];

    if (!rawId || typeof rawId !== 'string' || rawId.trim() === '') {
      skippedRows.push({
        customerId: `Row #${i + 2}`,
        reason: 'Missing or empty Customer ID',
      });
      continue;
    }

    const customerId = rawId.trim();

    const tenureRaw = row['Tenure in Months'];
    const tenure = tenureRaw !== undefined ? parseInt(tenureRaw, 10) : NaN;
    if (isNaN(tenure)) {
      skippedRows.push({
        customerId,
        reason: `Invalid or missing 'Tenure in Months': '${tenureRaw}'`,
      });
      continue;
    }

    const monthlyRaw = row['Monthly Charge'];
    const monthlyCharges = monthlyRaw !== undefined ? parseFloat(monthlyRaw) : NaN;
    if (isNaN(monthlyCharges)) {
      skippedRows.push({
        customerId,
        reason: `Invalid or missing 'Monthly Charge': '${monthlyRaw}'`,
      });
      continue;
    }

    const totalRaw = row['Total Charges'];
    const totalCharges = totalRaw !== undefined ? parseFloat(totalRaw) : NaN;
    if (isNaN(totalCharges)) {
      skippedRows.push({
        customerId,
        reason: `Invalid or missing 'Total Charges': '${totalRaw}'`,
      });
      continue;
    }

    const contractRaw = row['Contract'];
    if (!contractRaw || typeof contractRaw !== 'string' || contractRaw.trim() === '') {
      skippedRows.push({
        customerId,
        reason: 'Missing or empty Contract value',
      });
      continue;
    }
    const contractType = normalizeContract(contractRaw);

    const internetService = (row['Internet Type'] || '').trim();
    if (!internetService) {
      skippedRows.push({
        customerId,
        reason: 'Missing or empty Internet Type',
      });
      continue;
    }

    const paymentMethod = (row['Payment Method'] || '').trim();
    if (!paymentMethod) {
      skippedRows.push({
        customerId,
        reason: 'Missing or empty Payment Method',
      });
      continue;
    }

    const churnRaw = row['Churn Value'];
    if (churnRaw === undefined || churnRaw === null || (churnRaw !== '0' && churnRaw !== '1')) {
      skippedRows.push({
        customerId,
        reason: `Invalid 'Churn Value' (expected 0 or 1): '${churnRaw}'`,
      });
      continue;
    }
    const actualChurn = churnRaw === '1';

    validCustomers.push({
      customerId,
      tenure,
      contractType,
      monthlyCharges,
      totalCharges,
      internetService,
      paymentMethod,
      actualChurn,
    });
  }

  if (skippedRows.length > 0) {
    console.warn(`\n[WARNING] Skipped ${skippedRows.length} row(s) due to missing or invalid fields:`);
    for (const skipped of skippedRows) {
      console.warn(`  - Customer ID: ${skipped.customerId} | Reason: ${skipped.reason}`);
    }
  } else {
    console.log('Zero rows skipped. All records passed validation checks.');
  }

  console.log(`\nInserting ${validCustomers.length} valid customer records in batches...`);

  const BATCH_SIZE = 1000;
  let totalInsertedCount = 0;

  for (let i = 0; i < validCustomers.length; i += BATCH_SIZE) {
    const batch = validCustomers.slice(i, i + BATCH_SIZE);
    const result = await prisma.customer.createMany({
      data: batch,
      skipDuplicates: true,
    });
    totalInsertedCount += result.count;
    console.log(`  - Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.count} rows inserted.`);
  }

  const finalDbCount = await prisma.customer.count();

  console.log('\n==================================================');
  console.log(`CSV Import Complete!`);
  console.log(`Total valid rows processed: ${validCustomers.length}`);
  console.log(`Rows skipped: ${skippedRows.length}`);
  console.log(`Rows inserted in this run: ${totalInsertedCount}`);
  console.log(`Final total row count in Customer database table: ${finalDbCount}`);
  console.log('==================================================\n');
}

importCsv()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Import failed with error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
