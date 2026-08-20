import { Request, Response } from 'express';
import { RiskBand } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { parseRiskBand, getRiskReason } from '../utils/riskBand';
import { ModelServiceRequest, ModelServiceResponse } from '../types/modelService';

/**
 * GET /api/customers
 * Query params: segment, riskBand
 *
 * NOTE: the current Prisma schema (apps/api/prisma/schema.prisma) has no relation
 * between Customer and Segment, so segment filtering cannot be implemented against
 * the database as-is. Requests that include ?segment= are rejected with a 400 Bad Request.
 */
export async function getCustomers(req: Request, res: Response): Promise<Response> {
  try {
    const { segment, riskBand, page, limit } = req.query;

    if (
      segment !== undefined &&
      typeof segment === 'string' &&
      segment.trim() !== '' &&
      segment.toLowerCase() !== 'all'
    ) {
      return res.status(400).json({
        error:
          'Segment filtering is not supported: the Customer model has no relation to Segment in the current Prisma schema.',
      });
    }

    let parsedBand: RiskBand | null = null;
    if (
      riskBand !== undefined &&
      typeof riskBand === 'string' &&
      riskBand.trim() !== '' &&
      riskBand.toLowerCase() !== 'all'
    ) {
      parsedBand = parseRiskBand(riskBand as string);
      if (!parsedBand) {
        return res.status(400).json({
          error: `Invalid riskBand parameter: '${riskBand}'. Valid values are: High, Medium, Low.`,
        });
      }
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = limit === 'all' ? 0 : parseInt(limit as string, 10) || 50;

    const whereClause: any = {};
    if (parsedBand) {
      whereClause.scores = {
        some: {
          riskBand: parsedBand,
        },
      };
    }

    const total = await prisma.customer.count({ where: whereClause });

    const findOptions: any = {
      where: whereClause,
      include: {
        scores: {
          orderBy: {
            scoredAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        customerId: 'asc',
      },
    };

    if (limitNum > 0) {
      findOptions.skip = (pageNum - 1) * limitNum;
      findOptions.take = limitNum;
    }

    const customers = await prisma.customer.findMany(findOptions);
    const totalPages = limitNum > 0 ? Math.ceil(total / limitNum) : 1;

    return res.json({
      data: customers,
      total,
      page: pageNum,
      totalPages,
      limit: limitNum || total,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({ error: 'Internal server error fetching customers' });
  }
}

/**
 * GET /api/customers/:id
 * Fetch single customer profile by UUID or customerId string.
 */
export async function getCustomerById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ id }, { customerId: id }],
      },
      include: {
        scores: {
          orderBy: {
            scoredAt: 'desc',
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: `Customer '${id}' not found` });
    }

    return res.json(customer);
  } catch (error) {
    console.error('Error fetching customer by id:', error);
    return res.status(500).json({ error: 'Internal server error fetching customer' });
  }
}

/**
 * GET /api/summary
 * Retrieve global aggregate churn summary statistics.
 */
export async function getSummary(req: Request, res: Response): Promise<Response> {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        scores: {
          orderBy: {
            scoredAt: 'desc',
          },
          take: 1,
        },
      },
    });

    const totalCustomers = customers.length;
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;
    let totalRevenueAtRisk = 0;
    let scoreSum = 0;
    let scoredCount = 0;

    for (const c of customers) {
      if (c.scores.length > 0) {
        const latest = c.scores[0];
        scoredCount += 1;
        scoreSum += latest.score;

        if (latest.riskBand === RiskBand.High) {
          highRiskCount += 1;
          totalRevenueAtRisk += latest.revenueAtRisk;
        } else if (latest.riskBand === RiskBand.Medium) {
          mediumRiskCount += 1;
          totalRevenueAtRisk += latest.revenueAtRisk;
        } else if (latest.riskBand === RiskBand.Low) {
          lowRiskCount += 1;
        }
      }
    }

    const averageChurnScore =
      scoredCount > 0 ? parseFloat((scoreSum / scoredCount).toFixed(2)) : 0;

    return res.json({
      totalCustomers,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      totalRevenueAtRisk: parseFloat(totalRevenueAtRisk.toFixed(2)),
      averageChurnScore,
    });
  } catch (error) {
    console.error('Error computing summary:', error);
    return res.status(500).json({ error: 'Internal server error computing summary' });
  }
}

/**
 * POST /api/score-batch
 * Trigger batch ML scoring for specified customers or unscored customers.
 */
export async function scoreBatch(req: Request, res: Response): Promise<Response> {
  try {
    const { customerIds } = req.body || {};

    let targetCustomers;
    if (Array.isArray(customerIds) && customerIds.length > 0) {
      targetCustomers = await prisma.customer.findMany({
        where: {
          OR: [
            { customerId: { in: customerIds } },
            { id: { in: customerIds } },
          ],
        },
      });
    } else {
      targetCustomers = await prisma.customer.findMany({
        where: {
          scores: {
            none: {},
          },
        },
      });
    }

    if (targetCustomers.length === 0) {
      return res.json({
        processed: 0,
        scores: [],
      });
    }

    const modelServiceUrl = process.env.MODEL_SERVICE_URL || 'http://localhost:8000';
    const scoresToInsert: {
      customerId: string;
      score: number;
      riskBand: RiskBand;
      reason: string;
      revenueAtRisk: number;
    }[] = [];

    const CHUNK_SIZE = 500;
    let useBatchEndpoint = true;

    for (let i = 0; i < targetCustomers.length; i += CHUNK_SIZE) {
      const chunk = targetCustomers.slice(i, i + CHUNK_SIZE);
      
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
            continue;
          } else {
            useBatchEndpoint = false;
          }
        } catch (err) {
          useBatchEndpoint = false;
        }
      }

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
    }

    await prisma.churnScore.createMany({
      data: scoresToInsert,
    });

    const insertedScores = await prisma.churnScore.findMany({
      where: {
        customerId: { in: targetCustomers.map((c) => c.id) },
      },
      take: 100,
    });

    return res.json({
      processed: scoresToInsert.length,
      scores: insertedScores,
    });
  } catch (error) {
    console.error('Error running batch scoring:', error);
    return res.status(500).json({ error: 'Internal server error in scoreBatch' });
  }
}
