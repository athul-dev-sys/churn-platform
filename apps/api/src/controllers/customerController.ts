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
    const { segment, riskBand } = req.query;

    if (segment !== undefined) {
      return res.status(400).json({
        error:
          'Segment filtering is not supported: the Customer model has no relation to Segment in the current Prisma schema.',
      });
    }

    let parsedBand: RiskBand | null = null;
    if (riskBand !== undefined) {
      parsedBand = parseRiskBand(riskBand);
      if (!parsedBand) {
        return res.status(400).json({
          error: `Invalid riskBand parameter: '${riskBand}'. Valid values are: High, Medium, Low.`,
        });
      }
    }

    const customers = await prisma.customer.findMany({
      include: {
        scores: {
          orderBy: {
            scoredAt: 'desc',
          },
        },
      },
      orderBy: {
        customerId: 'asc',
      },
    });

    if (parsedBand) {
      const filtered = customers.filter(
        (c) => c.scores.length > 0 && c.scores[0].riskBand === parsedBand
      );
      return res.json(filtered);
    }

    return res.json(customers);
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
    const createdScores = [];

    for (const customer of targetCustomers) {
      let score: number;
      let riskBand: RiskBand;

      try {
        const payload: ModelServiceRequest = {
          customer_id: customer.customerId,
          tenure: customer.tenure,
          contract_type: customer.contractType,
          monthly_charges: customer.monthlyCharges,
          total_charges: customer.totalCharges,
          internet_service: customer.internetService,
          payment_method: customer.paymentMethod,
        };

        const response = await fetch(`${modelServiceUrl}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = (await response.json()) as ModelServiceResponse;
          score = data.churn_probability;
          const parsed = parseRiskBand(data.risk_band);
          riskBand = parsed || RiskBand.Medium;
        } else {
          throw new Error(`Model service error: ${response.statusText}`);
        }
      } catch (err) {
        console.warn(`Model service request failed for ${customer.customerId}, using fallback score logic:`, err);
        if (customer.contractType === 'Month-to-month' && customer.monthlyCharges > 75) {
          score = 0.78;
          riskBand = RiskBand.High;
        } else if (customer.contractType === 'Month-to-month') {
          score = 0.45;
          riskBand = RiskBand.Medium;
        } else {
          score = 0.15;
          riskBand = RiskBand.Low;
        }
      }

      const revenueAtRisk =
        customer.totalCharges > 0
          ? customer.totalCharges
          : parseFloat((customer.monthlyCharges * 12).toFixed(2));

      const reason = getRiskReason(
        riskBand,
        customer.tenure,
        customer.contractType,
        customer.monthlyCharges
      );

      const newScore = await prisma.churnScore.create({
        data: {
          customerId: customer.id,
          score,
          riskBand,
          reason,
          revenueAtRisk,
        },
      });

      createdScores.push(newScore);
    }

    return res.json({
      processed: createdScores.length,
      scores: createdScores,
    });
  } catch (error) {
    console.error('Error running batch scoring:', error);
    return res.status(500).json({ error: 'Internal server error in scoreBatch' });
  }
}
