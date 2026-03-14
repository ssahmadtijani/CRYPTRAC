/**
 * STR/SAR Report Routes for CRYPTRAC
 * Mounted at /api/v1/str-sar
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import * as strSarService from '../services/str-sar.service';
import * as auditService from '../services/audit.service';
import { UserRole, AuditAction, STRSARType, STRSARStatus, SuspicionCategory } from '../types';

export const strSarRoutes = Router();

strSarRoutes.use(apiRateLimiter);

/**
 * POST /api/v1/str-sar
 * Create a new STR/SAR report
 */
strSarRoutes.post(
  '/',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        type, subjectName, subjectWalletAddresses, suspicionCategories, narrativeSummary,
        indicatorsOfSuspicion, linkedTransactionIds, linkedCaseIds, linkedWalletAddresses,
        totalAmountUSD, dateRangeStart, dateRangeEnd, regulatoryAuthority,
        subjectIdentification, subjectCountry,
      } = req.body;

      if (!type || !subjectName || !suspicionCategories || !narrativeSummary || totalAmountUSD === undefined || !dateRangeStart || !dateRangeEnd) {
        res.status(400).json({ success: false, error: { message: 'Missing required fields' } });
        return;
      }

      const filingOfficerName = `${req.user!.email}`;
      const report = strSarService.createSTRSAR(
        {
          type: type as STRSARType,
          subjectName,
          subjectWalletAddresses: subjectWalletAddresses ?? [],
          suspicionCategories: suspicionCategories as SuspicionCategory[],
          narrativeSummary,
          indicatorsOfSuspicion: indicatorsOfSuspicion ?? [],
          linkedTransactionIds,
          linkedCaseIds,
          linkedWalletAddresses,
          totalAmountUSD,
          dateRangeStart: new Date(dateRangeStart),
          dateRangeEnd: new Date(dateRangeEnd),
          filingOfficerUserId: req.user!.userId,
          regulatoryAuthority,
          subjectIdentification,
          subjectCountry,
        },
        filingOfficerName
      );

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.STR_SAR_CREATED,
        entityType: 'STRSARReport',
        entityId: report.id,
        description: `${report.type} report ${report.reportNumber} created`,
        metadata: { reportNumber: report.reportNumber, type: report.type },
      });

      res.status(201).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/str-sar
 * List STR/SAR reports with filters
 */
strSarRoutes.get(
  '/',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST, UserRole.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type, status, suspicionCategory, filingOfficerUserId, startDate, endDate, page, pageSize } = req.query;

      const result = strSarService.getSTRSARs({
        type: type as STRSARType | undefined,
        status: status as STRSARStatus | undefined,
        suspicionCategory: suspicionCategory as SuspicionCategory | undefined,
        filingOfficerUserId: filingOfficerUserId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      });

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/str-sar/stats
 * STR/SAR statistics
 */
strSarRoutes.get(
  '/stats',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = strSarService.getSTRSARStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/str-sar/auto-generate
 * Auto-generate STR from transaction IDs
 */
strSarRoutes.post(
  '/auto-generate',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { transactionIds, caseId } = req.body;
      if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
        res.status(400).json({ success: false, error: { message: 'transactionIds must be a non-empty array' } });
        return;
      }

      const report = strSarService.autoGenerateSTR(transactionIds, caseId);
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/str-sar/:id
 * Get single STR/SAR report
 */
strSarRoutes.get(
  '/:id',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST, UserRole.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = strSarService.getSTRSAR(req.params.id as string);
      if (!report) {
        res.status(404).json({ success: false, error: { message: 'Report not found' } });
        return;
      }
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/str-sar/:id
 * Update a DRAFT STR/SAR report
 */
strSarRoutes.patch(
  '/:id',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = strSarService.updateSTRSAR(req.params.id as string, req.body);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/str-sar/:id/submit
 * Submit report for review
 */
strSarRoutes.post(
  '/:id/submit',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = strSarService.submitForReview(req.params.id as string);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.STR_SAR_SUBMITTED,
        entityType: 'STRSARReport',
        entityId: report.id,
        description: `${report.type} report ${report.reportNumber} submitted for review`,
        metadata: { reportNumber: report.reportNumber },
      });

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/str-sar/:id/approve
 * Approve a report
 */
strSarRoutes.post(
  '/:id/approve',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewNotes } = req.body;
      const report = strSarService.approveReport(req.params.id as string, req.user!.userId, reviewNotes);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.STR_SAR_APPROVED,
        entityType: 'STRSARReport',
        entityId: report.id,
        description: `${report.type} report ${report.reportNumber} approved`,
        metadata: { reportNumber: report.reportNumber, reviewNotes },
      });

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/str-sar/:id/reject
 * Reject a report
 */
strSarRoutes.post(
  '/:id/reject',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reviewNotes } = req.body;
      if (!reviewNotes) {
        res.status(400).json({ success: false, error: { message: 'reviewNotes is required for rejection' } });
        return;
      }

      const report = strSarService.rejectReport(req.params.id as string, req.user!.userId, reviewNotes);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/str-sar/:id/file
 * File an approved report
 */
strSarRoutes.post(
  '/:id/file',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = strSarService.fileReport(req.params.id as string);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.STR_SAR_FILED,
        entityType: 'STRSARReport',
        entityId: report.id,
        description: `${report.type} report ${report.reportNumber} filed`,
        metadata: { reportNumber: report.reportNumber, submittedAt: report.submittedAt },
      });

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/str-sar/:id/acknowledge
 * Acknowledge a filed report
 */
strSarRoutes.post(
  '/:id/acknowledge',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = strSarService.acknowledgeReport(req.params.id as string);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/str-sar/:id/amend
 * Create an amendment
 */
strSarRoutes.post(
  '/:id/amend',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reason } = req.body;
      if (!reason) {
        res.status(400).json({ success: false, error: { message: 'reason is required for amendment' } });
        return;
      }

      const filingOfficerName = req.user!.email;
      const report = strSarService.amendReport(req.params.id as string, req.user!.userId, filingOfficerName, reason);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.STR_SAR_AMENDED,
        entityType: 'STRSARReport',
        entityId: report.id,
        description: `Amendment ${report.reportNumber} created for original ${req.params.id}`,
        metadata: { originalId: req.params.id as string, reason },
      });

      res.status(201).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);
