import { Router, Request, Response, NextFunction } from 'express';
import { transactionService } from '../services/transaction.service';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiLimiter } from '../middleware/rateLimiter';
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
import { UserRole } from '../types';

export const transactionRoutes = Router();

transactionRoutes.use(apiLimiter);

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
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const transaction = transactionService.createTransaction(req.body);
      res.status(201).json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  }
);

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
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const filter = req.query as unknown as Parameters<typeof transactionService.getTransactions>[0];
      const { data, total } = transactionService.getTransactions(filter);
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      res.json({
        success: true,
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

transactionRoutes.get(
  '/:id',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const transaction = transactionService.getTransactionById(String(req.params.id));
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
      res.json({ success: true, data: transaction });
    } catch (err) {
      next(err);
    }
  }
);

transactionRoutes.get(
  '/:id/risk-assessment',
  authenticate,
  authorize(
    UserRole.ADMIN,
    UserRole.COMPLIANCE_OFFICER,
    UserRole.ANALYST,
    UserRole.AUDITOR
  ),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const transaction = transactionService.getTransactionById(String(req.params.id));

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
      const riskLevel = transactionService.assessRisk(transaction);
      res.json({
        success: true,
        data: { transactionId: transaction.id, riskLevel, transaction },
      });
    } catch (err) {
      next(err);

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
