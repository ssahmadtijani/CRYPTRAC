import { Router, Request, Response, NextFunction } from 'express';
import { transactionService } from '../services/transaction.service';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiLimiter } from '../middleware/rateLimiter';
import {
  createTransactionSchema,
  transactionFilterSchema,
} from '../validators/schemas';
import { UserRole } from '../types';

export const transactionRoutes = Router();

transactionRoutes.use(apiLimiter);

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
    }
  }
);
