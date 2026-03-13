/**
 * Transaction Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiRateLimiter } from '../middleware/rateLimiter';
import {
  createTransactionSchema,
  transactionFilterSchema,
} from '../validators/schemas';
import * as transactionService from '../services/transaction.service';
import { UserRole, ApiResponse, Transaction } from '../types';

export const transactionRoutes = Router();

// Apply rate limiting to all transaction routes
transactionRoutes.use(apiRateLimiter);

/**
 * POST /api/v1/transactions
 * Create a new transaction.
 */
transactionRoutes.post(
  '/',
  authenticate,
  validate(createTransactionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const transaction = await transactionService.createTransaction(
        req.body,
        userId
      );
      const response: ApiResponse<Transaction> = {
        success: true,
        data: transaction,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/transactions
 * List transactions with optional filters.
 */
transactionRoutes.get(
  '/',
  authenticate,
  validate(transactionFilterSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter = req.query as unknown as Parameters<
        typeof transactionService.getTransactions
      >[0];
      const result = await transactionService.getTransactions(filter);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/transactions/:id
 * Get a single transaction by ID.
 */
transactionRoutes.get(
  '/:id',
  authenticate,
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

      const response: ApiResponse<Transaction> = {
        success: true,
        data: transaction,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/transactions/:id/assess
 * Trigger risk assessment for a transaction (compliance officer+).
 */
transactionRoutes.post(
  '/:id/assess',
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

      const assessment = transactionService.assessTransactionRisk(transaction);
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
