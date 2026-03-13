/**
 * Compliance Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { complianceRateLimiter } from '../middleware/rateLimiter';
import * as complianceService from '../services/compliance.service';
import * as transactionService from '../services/transaction.service';
import { UserRole, ApiResponse, ComplianceReport } from '../types';

export const complianceRoutes = Router();

// Apply rate limiting to all compliance routes
complianceRoutes.use(complianceRateLimiter);

/**
 * POST /api/v1/compliance/check/:transactionId
 * Run all compliance checks for a transaction.
 */
complianceRoutes.post(
  '/check/:transactionId',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transaction = await transactionService.getTransactionById(
        req.params.transactionId as string
      );

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: { message: 'Transaction not found' },
        });
        return;
      }

      const result = await complianceService.checkCompliance(transaction);
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
 * GET /api/v1/compliance/reports
 * List compliance reports.
 */
complianceRoutes.get(
  '/reports',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await complianceService.getComplianceReports({
        page,
        pageSize,
        transactionId: req.query.transactionId as string | undefined,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/compliance/reports/:id
 * Get a single compliance report by ID.
 */
complianceRoutes.get(
  '/reports/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await complianceService.getComplianceReportById(
        req.params.id as string
      );

      if (!report) {
        res.status(404).json({
          success: false,
          error: { message: 'Compliance report not found' },
        });
        return;
      }

      const response: ApiResponse<ComplianceReport> = {
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
 * POST /api/v1/compliance/sar/:transactionId
 * Generate a Suspicious Activity Report.
 */
complianceRoutes.post(
  '/sar/:transactionId',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transaction = await transactionService.getTransactionById(
        req.params.transactionId as string
      );

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: { message: 'Transaction not found' },
        });
        return;
      }

      const sar = await complianceService.generateSAR(transaction);
      const response: ApiResponse<ComplianceReport> = {
        success: true,
        data: sar,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/compliance/travel-rule/:transactionId
 * Run FATF Travel Rule compliance check.
 */
complianceRoutes.post(
  '/travel-rule/:transactionId',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transaction = await transactionService.getTransactionById(
        req.params.transactionId as string
      );

      if (!transaction) {
        res.status(404).json({
          success: false,
          error: { message: 'Transaction not found' },
        });
        return;
      }

      const travelRuleReport = await complianceService.checkTravelRule(
        transaction
      );
      const response: ApiResponse<ComplianceReport> = {
        success: true,
        data: travelRuleReport,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);
