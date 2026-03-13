import { Router, Request, Response, NextFunction } from 'express';
import { complianceService } from '../services/compliance.service';
import { authenticate, authorize } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimiter';
import { ComplianceStatus, ReportType, UserRole } from '../types';

export const complianceRoutes = Router();

complianceRoutes.use(apiLimiter);

complianceRoutes.post(
  '/sar/:transactionId',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const report = complianceService.generateSAR(String(req.params.transactionId));
      res.status(201).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
);

complianceRoutes.post(
  '/ctr/:transactionId',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const report = complianceService.generateCTR(String(req.params.transactionId));
      res.status(201).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
);

complianceRoutes.post(
  '/travel-rule/:transactionId',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = complianceService.checkTravelRule(
        String(req.params.transactionId)
      );
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

complianceRoutes.get(
  '/reports',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const filter = {
        type: req.query.type as ReportType | undefined,
        status: req.query.status as ComplianceStatus | undefined,
        page,
        limit,
      };
      const { data, total } = complianceService.getReports(filter);
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

complianceRoutes.patch(
  '/reports/:id/review',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { status, reviewNotes } = req.body;
      if (!status) {
        res.status(400).json({ success: false, error: { message: 'Status is required' } });
        return;
      }
      const report = complianceService.reviewReport(
        String(req.params.id),
        status as ComplianceStatus,
        req.user!.id,
        reviewNotes
      );
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
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
