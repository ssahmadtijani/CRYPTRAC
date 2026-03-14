/**
 * Enhanced Audit Routes for CRYPTRAC
 * Endpoints for the enhanced audit dashboard, security events, and compliance reports.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { auditEnhancedFilterSchema } from '../validators/schemas';
import * as auditEnhancedService from '../services/audit-enhanced.service';
import { UserRole } from '../types';

export const auditEnhancedRoutes = Router();

auditEnhancedRoutes.use(apiRateLimiter);
auditEnhancedRoutes.use(authenticate);

const ADMIN_AUDITOR = [UserRole.ADMIN, UserRole.AUDITOR];
const ADMIN_AUDITOR_CO = [UserRole.ADMIN, UserRole.AUDITOR, UserRole.COMPLIANCE_OFFICER];

/**
 * GET /api/v1/admin/audit
 * Get filtered, paginated, sorted audit logs
 */
auditEnhancedRoutes.get(
  '/',
  authorize(...ADMIN_AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = auditEnhancedFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: { message: 'Invalid filter', details: parsed.error.flatten() } });
        return;
      }
      const result = auditEnhancedService.getEnhancedAuditLogs(parsed.data);
      res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: Math.ceil(result.total / result.pageSize) },
      });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/audit/dashboard
 * Get audit dashboard metrics
 */
auditEnhancedRoutes.get(
  '/dashboard',
  authorize(...ADMIN_AUDITOR),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metrics = auditEnhancedService.getAuditDashboardMetrics();
      res.json({ success: true, data: metrics });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/audit/timeline
 * Get audit timeline
 */
auditEnhancedRoutes.get(
  '/timeline',
  authorize(...ADMIN_AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const timeline = auditEnhancedService.getAuditTimeline(startDate, endDate, limit);
      res.json({ success: true, data: timeline });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/audit/security-events
 * Get critical security events (ADMIN only)
 */
auditEnhancedRoutes.get(
  '/security-events',
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const events = auditEnhancedService.getSecurityEvents(limit);
      res.json({ success: true, data: events });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/audit/compliance-report
 * Generate a compliance report for a date range
 */
auditEnhancedRoutes.get(
  '/compliance-report',
  authorize(...ADMIN_AUDITOR_CO),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const report = auditEnhancedService.generateComplianceReport(
        startDate,
        endDate,
        req.user!.userId
      );
      res.json({ success: true, data: report });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/audit/users/:userId
 * Get audit trail for a specific user
 */
auditEnhancedRoutes.get(
  '/users/:userId',
  authorize(...ADMIN_AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 20);
      const result = auditEnhancedService.getUserAuditTrail(req.params.userId as string, page, pageSize);
      res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, pageSize: result.pageSize, total: result.total },
      });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/audit/:id
 * Get a single audit log entry by ID
 */
auditEnhancedRoutes.get(
  '/:id',
  authorize(...ADMIN_AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entry = auditEnhancedService.getAuditLogById(req.params.id as string);
      res.json({ success: true, data: entry });
    } catch (err) { next(err); }
  }
);
