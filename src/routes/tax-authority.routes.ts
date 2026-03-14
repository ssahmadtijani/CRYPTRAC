/**
 * Tax Authority Routes for CRYPTRAC
 * Read-only custodian portal for FIRS/regulators
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import * as taxAssessmentService from '../services/tax-assessment.service';
import * as taxEngineService from '../services/tax-engine.service';
import { getAllUsers } from '../services/auth.service';
import { UserRole, ApiResponse, User } from '../types';

export const taxAuthorityRoutes = Router();

taxAuthorityRoutes.use(apiRateLimiter);
taxAuthorityRoutes.use(
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.AUDITOR)
);

/**
 * GET /api/v1/authority/dashboard
 * Aggregate stats for all taxpayers
 */
taxAuthorityRoutes.get(
  '/dashboard',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = (await getAllUsers()) as User[];
      const dashboard = await taxAssessmentService.getAggregateStats(users);
      const response: ApiResponse<typeof dashboard> = {
        success: true,
        data: dashboard,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/authority/taxpayers
 * List all taxpayers with their tax liability
 */
taxAuthorityRoutes.get(
  '/taxpayers',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = (await getAllUsers()) as User[];
      const summaries = await taxAssessmentService.getTaxpayerSummaries(users);
      const response: ApiResponse<typeof summaries> = {
        success: true,
        data: summaries,
        meta: { total: summaries.length },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/authority/taxpayers/:userId
 * Full detail for a specific taxpayer
 */
taxAuthorityRoutes.get(
  '/taxpayers/:userId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params as { userId: string };
      const users = (await getAllUsers()) as User[];
      const user = users.find((u) => u.id === userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: { message: 'Taxpayer not found' },
        });
        return;
      }

      const [assessments, events, [summary]] = await Promise.all([
        taxAssessmentService.getUserAssessments(userId),
        taxEngineService.getTaxableEvents(userId),
        taxAssessmentService.getTaxpayerSummaries([user]),
      ]);

      const response: ApiResponse<{
        user: typeof user;
        summary: typeof summary;
        assessments: typeof assessments;
        recentEvents: typeof events;
      }> = {
        success: true,
        data: {
          user,
          summary,
          assessments,
          recentEvents: events.slice(-20),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/authority/taxpayers/:userId/assessments
 */
taxAuthorityRoutes.get(
  '/taxpayers/:userId/assessments',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assessments = await taxAssessmentService.getUserAssessments(
        req.params.userId as string
      );
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
 * GET /api/v1/authority/taxpayers/:userId/events
 */
taxAuthorityRoutes.get(
  '/taxpayers/:userId/events',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const events = await taxEngineService.getTaxableEvents(
        req.params.userId as string
      );
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
 * GET /api/v1/authority/exchanges
 * Tax breakdown by exchange
 */
taxAuthorityRoutes.get(
  '/exchanges',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = (await getAllUsers()) as User[];
      const dashboard = await taxAssessmentService.getAggregateStats(users);
      const response: ApiResponse<typeof dashboard.byExchange> = {
        success: true,
        data: dashboard.byExchange,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/authority/reports/generate
 * Generate authority-level tax report
 */
taxAuthorityRoutes.get(
  '/reports/generate',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = (await getAllUsers()) as User[];
      const [dashboard, summaries, allAssessments] = await Promise.all([
        taxAssessmentService.getAggregateStats(users),
        taxAssessmentService.getTaxpayerSummaries(users),
        taxAssessmentService.getAllAssessments(),
      ]);

      const report = {
        generatedAt: new Date().toISOString(),
        generatedBy: 'CRYPTRAC Tax Authority Portal',
        period: 'Full Report',
        summary: dashboard,
        taxpayers: summaries,
        totalAssessments: allAssessments.length,
      };

      const response: ApiResponse<typeof report> = {
        success: true,
        data: report,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/authority/flagged
 * High-value / flagged assessments
 */
taxAuthorityRoutes.get(
  '/flagged',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const flagged = await taxAssessmentService.getAllAssessments({
        minTaxNGN: 1_000_000,
      });

      const response: ApiResponse<typeof flagged> = {
        success: true,
        data: flagged.sort(
          (a, b) => b.totalTaxLiabilityNGN - a.totalTaxLiabilityNGN
        ),
        meta: { total: flagged.length },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
