/**
 * Analytics Routes for CRYPTRAC
 * Mounted at /api/v1/analytics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import * as analyticsService from '../services/analytics.service';
import * as patternService from '../services/pattern-detection.service';
import * as networkService from '../services/network-analysis.service';
import { UserRole, ApiResponse } from '../types';

export const analyticsRoutes = Router();

analyticsRoutes.use(apiRateLimiter);

const ANALYST_ROLES = [
  UserRole.COMPLIANCE_OFFICER,
  UserRole.ADMIN,
  UserRole.ANALYST,
  UserRole.AUDITOR,
];

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

analyticsRoutes.get(
  '/kpis',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const kpis = await analyticsService.getKPIs();
      const response: ApiResponse<typeof kpis> = { success: true, data: kpis };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Time Series
// ---------------------------------------------------------------------------

analyticsRoutes.get(
  '/time-series',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month') ?? 'day';
      const range = parseInt(String(req.query.range ?? '30'), 10);
      const data = await analyticsService.getTransactionTimeSeries(period, range);
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Risk Distribution
// ---------------------------------------------------------------------------

analyticsRoutes.get(
  '/risk-distribution',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await analyticsService.getRiskDistribution();
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Asset Breakdown
// ---------------------------------------------------------------------------

analyticsRoutes.get(
  '/asset-breakdown',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await analyticsService.getAssetBreakdown();
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Network Breakdown
// ---------------------------------------------------------------------------

analyticsRoutes.get(
  '/network-breakdown',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await analyticsService.getNetworkBreakdown();
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Top Wallets
// ---------------------------------------------------------------------------

analyticsRoutes.get(
  '/top-wallets',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(String(req.query.limit ?? '10'), 10);
      const sortBy = (req.query.sortBy as 'volume' | 'risk') ?? 'volume';
      const data = await analyticsService.getTopWallets(limit, sortBy);
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Compliance Overview
// ---------------------------------------------------------------------------

analyticsRoutes.get(
  '/compliance-overview',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await analyticsService.getComplianceOverview();
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Geographic Breakdown
// ---------------------------------------------------------------------------

analyticsRoutes.get(
  '/geographic',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await analyticsService.getGeographicBreakdown();
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Pattern Detection
// ---------------------------------------------------------------------------

analyticsRoutes.get(
  '/patterns',
  authenticate,
  authorize(...ANALYST_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string | undefined;
      const data = await patternService.detectAllPatterns(userId);
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

analyticsRoutes.get(
  '/patterns/structuring',
  authenticate,
  authorize(...ANALYST_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string | undefined;
      const data = await patternService.detectStructuring(userId);
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

analyticsRoutes.get(
  '/patterns/rapid-movement',
  authenticate,
  authorize(...ANALYST_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string | undefined;
      const data = await patternService.detectRapidMovement(userId);
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

analyticsRoutes.get(
  '/patterns/layering',
  authenticate,
  authorize(...ANALYST_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string | undefined;
      const data = await patternService.detectLayering(userId);
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

analyticsRoutes.get(
  '/patterns/round-tripping',
  authenticate,
  authorize(...ANALYST_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string | undefined;
      const data = await patternService.detectRoundTripping(userId);
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

analyticsRoutes.get(
  '/patterns/history',
  authenticate,
  authorize(...ANALYST_ROLES),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = patternService.getPatternHistory();
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Network Analysis
// ---------------------------------------------------------------------------

analyticsRoutes.get(
  '/network/graph',
  authenticate,
  authorize(...ANALYST_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string | undefined;
      const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
      const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;
      const data = await networkService.buildTransactionGraph({ userId, startDate, endDate });
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

analyticsRoutes.get(
  '/network/wallet/:address',
  authenticate,
  authorize(...ANALYST_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const address = String(req.params.address);
      const depth = parseInt(String(req.query.depth ?? '2'), 10);
      const data = await networkService.getWalletConnections(address, depth);
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

analyticsRoutes.get(
  '/network/clusters',
  authenticate,
  authorize(...ANALYST_ROLES),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await networkService.identifyClusters();
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

analyticsRoutes.get(
  '/network/high-risk-paths',
  authenticate,
  authorize(...ANALYST_ROLES),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await networkService.getHighRiskPaths();
      const response: ApiResponse<typeof data> = { success: true, data };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);
