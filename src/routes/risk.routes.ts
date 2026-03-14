/**
 * Risk Assessment Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import * as riskEngine from '../services/risk-engine.service';
import * as transactionService from '../services/transaction.service';
import { UserRole, ApiResponse } from '../types';

export const riskRoutes = Router();

riskRoutes.use(apiRateLimiter);

/**
 * POST /api/v1/risk/assess-transaction/:id
 * Run the heuristic risk engine on a specific transaction.
 */
riskRoutes.post(
  '/assess-transaction/:id',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transaction = await transactionService.getTransactionById(
        req.params.id as string
      );

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: { message: 'Transaction not found' },
        });
        return;
      }

      const assessment = await riskEngine.assessTransactionRisk(transaction);
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
 * POST /api/v1/risk/assess-address/:address
 * Run the heuristic risk engine on an address.
 */
riskRoutes.post(
  '/assess-address/:address',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assessment = await riskEngine.assessAddressRisk(
        req.params.address as string
      );
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
 * GET /api/v1/risk/heuristics
 * List active heuristics and their weights.
 */
riskRoutes.get(
  '/heuristics',
  authenticate,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const heuristics = riskEngine.getRiskHeuristics();
      const response: ApiResponse<typeof heuristics> = {
        success: true,
        data: heuristics,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/risk/heuristics
 * Update heuristic weights (admin only).
 */
riskRoutes.put(
  '/heuristics',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const updates = req.body as Record<string, number>;

      if (!updates || typeof updates !== 'object') {
        res.status(400).json({
          success: false,
          error: { message: 'Request body must be an object of heuristic weights' },
        });
        return;
      }

      const updated = riskEngine.updateHeuristicWeights(updates);
      const response: ApiResponse<typeof updated> = {
        success: true,
        data: updated,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
