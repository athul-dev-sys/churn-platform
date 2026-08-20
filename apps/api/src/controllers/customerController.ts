import { Request, Response } from 'express';
import { RiskBand } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { parseRiskBand, getRiskReason, calculateDynamicChurnScore } from '../utils/riskBand';
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
    const { segment, riskBand, page, limit, contract, search, sortBy, sortOrder } = req.query;

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

    if (contract && typeof contract === 'string' && contract.trim() !== '' && contract.toLowerCase() !== 'all') {
      const cNorm = contract.trim().toLowerCase();
      if (cNorm.includes('month')) {
        whereClause.contractType = { in: ['Month-to-Month', 'Month-to-month', 'Month to Month', 'month-to-month'] };
      } else if (cNorm.includes('one') || cNorm.includes('1')) {
        whereClause.contractType = { in: ['One Year', 'One year', '1 Year', 'one year'] };
      } else if (cNorm.includes('two') || cNorm.includes('2')) {
        whereClause.contractType = { in: ['Two Year', 'Two year', '2 Year', 'two year'] };
      } else {
        whereClause.contractType = { equals: contract.trim(), mode: 'insensitive' };
      }
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = search.trim();
      whereClause.OR = [
        { customerId: { contains: term, mode: 'insensitive' } },
        { id: { contains: term, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.customer.count({ where: whereClause });

    const orderDirection: 'asc' | 'desc' = (sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';

    if (sortBy === 'score') {
      const allMatching = await prisma.customer.findMany({
        where: whereClause,
        include: {
          scores: {
            orderBy: {
              scoredAt: 'desc',
            },
            take: 1,
          },
        },
      });

      allMatching.sort((a, b) => {
        const scoreA = a.scores?.[0]?.score ?? -1;
        const scoreB = b.scores?.[0]?.score ?? -1;
        return orderDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      });

      const totalPages = limitNum > 0 ? Math.ceil(allMatching.length / limitNum) : 1;
      const data = limitNum > 0 ? allMatching.slice((pageNum - 1) * limitNum, pageNum * limitNum) : allMatching;

      return res.json({
        data,
        total: allMatching.length,
        page: pageNum,
        totalPages,
        limit: limitNum || allMatching.length,
      });
    }

    let orderByClause: any = { customerId: 'asc' };
    if (sortBy === 'tenure') {
      orderByClause = { tenure: orderDirection };
    } else if (sortBy === 'charges') {
      orderByClause = { monthlyCharges: orderDirection };
    } else if (sortBy === 'customerId') {
      orderByClause = { customerId: orderDirection };
    }

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
      orderBy: orderByClause,
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

let summaryCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 60000; // 60 seconds cache

export function invalidateSummaryCache() {
  summaryCache = null;
}

/**
 * GET /api/summary
 * Retrieve global aggregate churn summary statistics.
 */
export async function getSummary(req: Request, res: Response): Promise<Response> {
  try {
    const now = Date.now();
    if (summaryCache && now - summaryCache.timestamp < CACHE_TTL_MS) {
      return res.json(summaryCache.data);
    }

    const [totalCustomers, aggregateResult] = await Promise.all([
      prisma.customer.count(),
      prisma.$queryRaw<Array<{
        highRiskCount: number;
        mediumRiskCount: number;
        lowRiskCount: number;
        totalRevenueAtRisk: number;
        averageChurnScore: number;
      }>>`
        SELECT 
          COUNT(*) FILTER (WHERE "riskBand" = 'High')::int as "highRiskCount",
          COUNT(*) FILTER (WHERE "riskBand" = 'Medium')::int as "mediumRiskCount",
          COUNT(*) FILTER (WHERE "riskBand" = 'Low')::int as "lowRiskCount",
          COALESCE(SUM("revenueAtRisk") FILTER (WHERE "riskBand" IN ('High', 'Medium')), 0)::float as "totalRevenueAtRisk",
          COALESCE(AVG("score"), 0)::float as "averageChurnScore"
        FROM "ChurnScore"
      `
    ]);

    const stats = aggregateResult[0] || {
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalRevenueAtRisk: 0,
      averageChurnScore: 0,
    };

    const responseData = {
      totalCustomers,
      highRiskCount: Number(stats.highRiskCount || 0),
      mediumRiskCount: Number(stats.mediumRiskCount || 0),
      lowRiskCount: Number(stats.lowRiskCount || 0),
      totalRevenueAtRisk: parseFloat(Number(stats.totalRevenueAtRisk || 0).toFixed(2)),
      averageChurnScore: parseFloat(Number(stats.averageChurnScore || 0).toFixed(2)),
    };

    summaryCache = { data: responseData, timestamp: now };
    return res.json(responseData);
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
            continue;
          } else {
            useBatchEndpoint = false;
          }
        } catch (err) {
          useBatchEndpoint = false;
        }
      }

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
    }

    await prisma.churnScore.createMany({
      data: scoresToInsert,
    });

    invalidateSummaryCache();

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
