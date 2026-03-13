import { Router, Request, Response, NextFunction } from 'express';
import { walletService } from '../services/wallet.service';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiLimiter } from '../middleware/rateLimiter';
import { walletSchema } from '../validators/schemas';
import { UserRole } from '../types';

export const walletRoutes = Router();

walletRoutes.use(apiLimiter);

/**
 * Wallet Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { walletSchema } from '../validators/schemas';
import * as walletService from '../services/wallet.service';
import { UserRole, ApiResponse, Wallet } from '../types';

export const walletRoutes = Router();

// Apply rate limiting to all wallet routes
walletRoutes.use(apiRateLimiter);

/**
 * POST /api/v1/wallets
 * Register a new wallet.
 */
walletRoutes.post(
  '/',
  authenticate,
  validate(walletSchema),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const wallet = walletService.registerWallet(req.body);
      res.status(201).json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  }
);

walletRoutes.get(
  '/',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const filter = {
        userId: req.query.userId as string | undefined,
        blockchain: req.query.blockchain as string | undefined,
        page,
        limit,
      };
      const { data, total } = walletService.getWallets(filter);
      res.json({
        success: true,
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

walletRoutes.get(
  '/:address',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const wallet = walletService.getWallet(String(req.params.address));
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const wallet = await walletService.registerWallet(req.body, userId);
      const response: ApiResponse<Wallet> = {
        success: true,
        data: wallet,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/wallets/:address
 * Get wallet information by address.
 */
walletRoutes.get(
  '/:address',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const wallet = await walletService.getWalletByAddress(req.params.address as string);

      if (!wallet) {
        res.status(404).json({
          success: false,
          error: { message: 'Wallet not found' },
        });
        return;
      }
      res.json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  }
);

walletRoutes.patch(
  '/:address/risk-score',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { score } = req.body;
      if (score === undefined || typeof score !== 'number') {
        res.status(400).json({ success: false, error: { message: 'score (number) is required' } });
        return;
      }
      const wallet = walletService.updateRiskScore(String(req.params.address), score);
      res.json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  }
);

walletRoutes.get(
  '/:address/sanctions',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = walletService.checkSanctions(String(req.params.address));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);

      const response: ApiResponse<Wallet> = {
        success: true,
        data: wallet,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/wallets/:address/risk
 * Recalculate and update the risk score for a wallet.
 */
walletRoutes.put(
  '/:address/risk',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const wallet = await walletService.updateWalletRiskScore(
        req.params.address as string
      );

      if (!wallet) {
        res.status(404).json({
          success: false,
          error: { message: 'Wallet not found' },
        });
        return;
      }

      const response: ApiResponse<Wallet> = {
        success: true,
        data: wallet,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/wallets/:address/sanctions
 * Check whether a wallet address appears on the sanctions list.
 */
walletRoutes.get(
  '/:address/sanctions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await walletService.checkSanctionsList(req.params.address as string);
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
