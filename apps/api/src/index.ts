import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Healthcheck
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'churn-api' });
});

/**
 * GET /api/customers
 * Query params: segment, riskBand
 * TODO: Implement customer retrieval with optional filtering by segment and riskBand using Prisma.
 */
app.get('/api/customers', async (req: Request, res: Response) => {
  const { segment, riskBand } = req.query;
  // TODO: Fetch customers from database filtered by segment and/or riskBand
  res.json({
    message: 'Stub GET /api/customers endpoint',
    filters: { segment, riskBand },
    data: [],
  });
});

/**
 * GET /api/summary
 * TODO: Implement aggregate summary metrics calculation (total customers, risk count breakdowns, total revenue at risk).
 */
app.get('/api/summary', async (req: Request, res: Response) => {
  // TODO: Aggregate churn statistics across all customer accounts
  res.json({
    message: 'Stub GET /api/summary endpoint',
    totalCustomers: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    totalRevenueAtRisk: 0,
    averageChurnScore: 0,
  });
});

/**
 * POST /api/score-batch
 * TODO: Implement batch scoring by querying model-service /predict endpoint and persisting ChurnScore entries.
 */
app.post('/api/score-batch', async (req: Request, res: Response) => {
  const { customerIds } = req.body;
  // TODO: Call model-service /predict endpoint for batch customers and store resulting scores
  res.json({
    message: 'Stub POST /api/score-batch endpoint',
    processed: 0,
    scores: [],
  });
});

app.listen(port, () => {
  console.log(`[churn-api] Express server running on port ${port}`);
});
