/**
 * Sanctions Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import * as sanctionsService from '../services/sanctions.service';
import { UserRole, ApiResponse } from '../types';

export const sanctionsRoutes = Router();

sanctionsRoutes.use(apiRateLimiter);

/**
 * GET /api/v1/sanctions/check/:address
 * Check a single address against the sanctions list.
 */
sanctionsRoutes.get(
  '/check/:address',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = sanctionsService.checkAddress(req.params.address as string);
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
 * POST /api/v1/sanctions/refresh
 * Trigger a refresh of the OFAC sanctions list (admin only).
 */
sanctionsRoutes.post(
  '/refresh',
  authenticate,
  authorize(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await sanctionsService.refreshSanctionsList();
      const status = sanctionsService.getSanctionsListStatus();
      const response: ApiResponse<typeof status> = {
        success: true,
        data: status,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/sanctions/status
 * Return sanctions list metadata (last refreshed, entry count).
 */
sanctionsRoutes.get(
  '/status',
  authenticate,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = sanctionsService.getSanctionsListStatus();
      const response: ApiResponse<typeof status> = {
        success: true,
        data: status,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
