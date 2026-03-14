/**
 * Demo Routes for CRYPTRAC
 * Seed realistic data for demonstrations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { seedDemoData, isDemoSeeded } from '../services/demo.service';
import { ApiResponse } from '../types';

export const demoRoutes = Router();

demoRoutes.use(apiRateLimiter);

/**
 * POST /api/v1/demo/seed
 * Seeds the in-memory store with realistic demo data
 */
demoRoutes.post(
  '/seed',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await seedDemoData();
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/demo/status
 */
demoRoutes.get(
  '/status',
  (_req: Request, res: Response): void => {
    res.json({
      success: true,
      data: { seeded: isDemoSeeded() },
    });
  }
);
