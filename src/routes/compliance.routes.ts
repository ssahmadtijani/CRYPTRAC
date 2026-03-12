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
    }
  }
);
