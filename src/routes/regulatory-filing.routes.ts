/**
 * Regulatory Filing Routes for CRYPTRAC
 * Mounted at /api/v1/filings
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import * as filingService from '../services/regulatory-filing.service';
import * as auditService from '../services/audit.service';
import { UserRole, AuditAction, FilingType, FilingStatus } from '../types';

export const regulatoryFilingRoutes = Router();

regulatoryFilingRoutes.use(apiRateLimiter);

/**
 * POST /api/v1/filings
 * Create a filing deadline
 */
regulatoryFilingRoutes.post(
  '/',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filingType, title, description, regulatoryAuthority, dueDate, assignedTo, linkedReportIds } = req.body;

      if (!filingType || !title || !description || !regulatoryAuthority || !dueDate) {
        res.status(400).json({ success: false, error: { message: 'Missing required fields: filingType, title, description, regulatoryAuthority, dueDate' } });
        return;
      }

      const filing = filingService.createFiling({
        filingType: filingType as FilingType,
        title,
        description,
        regulatoryAuthority,
        dueDate: new Date(dueDate),
        assignedTo,
        linkedReportIds,
      });

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.FILING_CREATED,
        entityType: 'RegulatoryFiling',
        entityId: filing.id,
        description: `Filing created: ${filing.title} (due ${filing.dueDate.toISOString().split('T')[0]})`,
        metadata: { filingType: filing.filingType, dueDate: filing.dueDate },
      });

      res.status(201).json({ success: true, data: filing });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/filings
 * List filings
 */
regulatoryFilingRoutes.get(
  '/',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST, UserRole.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filingType, status, assignedTo, startDate, endDate } = req.query;

      const filings = filingService.getFilings({
        filingType: filingType as FilingType | undefined,
        status: status as FilingStatus | undefined,
        assignedTo: assignedTo as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({ success: true, data: filings, total: filings.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/filings/calendar
 * Get filing calendar
 */
regulatoryFilingRoutes.get(
  '/calendar',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const daysAhead = req.query.daysAhead ? Number(req.query.daysAhead) : undefined;
      const calendar = filingService.getFilingCalendar(daysAhead);
      res.json({ success: true, data: calendar, total: calendar.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/filings/dashboard
 * Filing dashboard metrics
 */
regulatoryFilingRoutes.get(
  '/dashboard',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dashboard = filingService.getFilingDashboard();
      res.json({ success: true, data: dashboard });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/filings/check-overdue
 * Check and return overdue filings
 */
regulatoryFilingRoutes.post(
  '/check-overdue',
  authenticate,
  authorize(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const overdueFilings = filingService.checkOverdueFilings();
      res.json({ success: true, data: overdueFilings, total: overdueFilings.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/filings/:id
 * Get single filing
 */
regulatoryFilingRoutes.get(
  '/:id',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST, UserRole.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filing = filingService.getFiling(req.params.id as string);
      if (!filing) {
        res.status(404).json({ success: false, error: { message: 'Filing not found' } });
        return;
      }
      res.json({ success: true, data: filing });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/filings/:id
 * Update filing details
 */
regulatoryFilingRoutes.patch(
  '/:id',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { title, description, dueDate, assignedTo, linkedReportIds, notes } = req.body;
      const updates: Parameters<typeof filingService.updateFiling>[1] = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (dueDate !== undefined) updates.dueDate = new Date(dueDate);
      if (assignedTo !== undefined) updates.assignedTo = assignedTo;
      if (linkedReportIds !== undefined) updates.linkedReportIds = linkedReportIds;
      if (notes !== undefined) updates.notes = notes;

      const filing = filingService.updateFiling(req.params.id as string, updates);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.FILING_UPDATED,
        entityType: 'RegulatoryFiling',
        entityId: filing.id,
        description: `Filing updated: ${filing.title}`,
        metadata: updates as Record<string, unknown>,
      });

      res.json({ success: true, data: filing });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/filings/:id/file
 * Mark filing as filed
 */
regulatoryFilingRoutes.post(
  '/:id/file',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filingReference } = req.body;
      const filing = filingService.markAsFiled(req.params.id as string, filingReference);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.FILING_FILED,
        entityType: 'RegulatoryFiling',
        entityId: filing.id,
        description: `Filing marked as filed: ${filing.title}`,
        metadata: { filingReference },
      });

      res.json({ success: true, data: filing });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/filings/:id/cancel
 * Cancel a filing
 */
regulatoryFilingRoutes.post(
  '/:id/cancel',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reason } = req.body;
      if (!reason) {
        res.status(400).json({ success: false, error: { message: 'reason is required' } });
        return;
      }

      const filing = filingService.cancelFiling(req.params.id as string, reason);
      res.json({ success: true, data: filing });
    } catch (error) {
      next(error);
    }
  }
);
