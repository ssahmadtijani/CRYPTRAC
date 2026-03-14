/**
 * Tax Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import * as taxEngineService from '../services/tax-engine.service';
import * as taxAssessmentService from '../services/tax-assessment.service';
import * as exchangeService from '../services/exchange.service';
import { ApiResponse, AssessmentPeriod } from '../types';

export const taxRoutes = Router();

taxRoutes.use(apiRateLimiter);

/**
 * POST /api/v1/tax/process
 * Process all exchange transactions into taxable events
 */
taxRoutes.post(
  '/process',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const txs = exchangeService.getAllExchangeTransactions(userId);
      const events = await taxEngineService.processAllTransactions(userId, txs);

      const response: ApiResponse<{ processed: number; taxableEvents: number }> = {
        success: true,
        data: { processed: txs.length, taxableEvents: events.length },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/tax/events
 * List taxable events for the authenticated user
 */
taxRoutes.get(
  '/events',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const filters: taxEngineService.TaxableEventFilter = {};

      if (req.query.type) filters.type = req.query.type as taxEngineService.TaxableEventFilter['type'];
      if (req.query.asset) filters.asset = req.query.asset as string;
      if (req.query.exchange) filters.exchange = req.query.exchange as string;
      if (req.query.taxYear) filters.taxYear = parseInt(req.query.taxYear as string, 10);

      const events = taxEngineService.getTaxableEvents(userId, filters);
      const response: ApiResponse<typeof events> = {
        success: true,
        data: events,
        meta: { total: events.length },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/tax/assessment
 * Generate a tax assessment
 */
taxRoutes.post(
  '/assessment',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { taxYear, period } = req.body as { taxYear: number; period: AssessmentPeriod };

      if (!taxYear || !period) {
        res.status(400).json({
          success: false,
          error: { message: 'taxYear and period are required' },
        });
        return;
      }

      const assessment = await taxAssessmentService.generateAssessment(
        userId,
        taxYear,
        period
      );
      const response: ApiResponse<typeof assessment> = {
        success: true,
        data: assessment,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/tax/assessments
 * List user's tax assessments
 */
taxRoutes.get(
  '/assessments',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assessments = taxAssessmentService.getUserAssessments(req.user!.userId);
      const response: ApiResponse<typeof assessments> = {
        success: true,
        data: assessments,
        meta: { total: assessments.length },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/tax/assessments/:id
 * Get a specific assessment
 */
taxRoutes.get(
  '/assessments/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assessment = taxAssessmentService.getAssessment(req.params.id as string);
      if (!assessment) {
        res.status(404).json({
          success: false,
          error: { message: 'Assessment not found' },
        });
        return;
      }

      const response: ApiResponse<typeof assessment> = {
        success: true,
        data: assessment,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/tax/summary
 * Quick summary of tax liability for the authenticated user
 */
taxRoutes.get(
  '/summary',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const assessments = taxAssessmentService.getUserAssessments(userId);
      const events = taxEngineService.getTaxableEvents(userId);

      const totalTaxLiabilityUSD = assessments.reduce(
        (sum, a) => sum + a.totalTaxLiabilityUSD,
        0
      );
      const totalTaxLiabilityNGN = assessments.reduce(
        (sum, a) => sum + a.totalTaxLiabilityNGN,
        0
      );

      const summary = {
        userId,
        totalAssessments: assessments.length,
        totalTaxableEvents: events.length,
        totalTaxLiabilityUSD,
        totalTaxLiabilityNGN,
        recentAssessments: assessments.slice(-5),
      };

      const response: ApiResponse<typeof summary> = {
        success: true,
        data: summary,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
