/**
 * Wallet Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { walletSchema } from '../validators/schemas';
import * as walletService from '../services/wallet.service';
import { UserRole, ApiResponse, Wallet } from '../types';

export const walletRoutes = Router();

/**
 * POST /api/v1/wallets
 * Register a new wallet.
 */
walletRoutes.post(
  '/',
  authenticate,
  validate(walletSchema),
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
