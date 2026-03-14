/**
 * Export Routes for CRYPTRAC
 * Provides CSV, JSON, and PDF exports for all major data types.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { exportQuerySchema } from '../validators/schemas';
import * as exportService from '../services/export.service';
import * as auditService from '../services/audit.service';
import { AuditAction, UserRole } from '../types';
import { getTransactions } from '../services/transaction.service';
import { getComplianceReports } from '../services/compliance.service';
import { getAllAssessments } from '../services/tax-assessment.service';
import { getCases } from '../services/case.service';

export const exportRoutes = Router();

exportRoutes.use(apiRateLimiter);

const EXPORT_ROLES = [
  UserRole.ADMIN,
  UserRole.AUDITOR,
  UserRole.COMPLIANCE_OFFICER,
  UserRole.ANALYST,
];

// ---------------------------------------------------------------------------
// Helper — send export response
// ---------------------------------------------------------------------------

function sendExport(res: Response, result: exportService.ExportResult): void {
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.setHeader('Content-Type', result.contentType);
  if (Buffer.isBuffer(result.data)) {
    res.send(result.data);
  } else {
    res.send(result.data);
  }
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/export/transactions?format=csv|json|pdf
 */
exportRoutes.get(
  '/transactions',
  apiRateLimiter,
  authenticate,
  authorize(...EXPORT_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = exportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid query parameters', details: parsed.error.flatten() },
        });
        return;
      }

      const { format, startDate, endDate, userId } = parsed.data;

      const result = await getTransactions({
        userId,
        startDate,
        endDate,
        pageSize: 10_000,
      });

      const data = result.data ?? [];
      const exportResult = await exportService.exportData('transactions', format, data);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.EXPORT_GENERATED,
        entityType: 'Transaction',
        entityId: 'bulk',
        description: `Exported ${data.length} transactions as ${format.toUpperCase()}`,
        metadata: { format, count: data.length },
      });

      sendExport(res, exportResult);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Compliance Reports
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/export/compliance-reports?format=csv|json|pdf
 */
exportRoutes.get(
  '/compliance-reports',
  apiRateLimiter,
  authenticate,
  authorize(...EXPORT_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = exportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid query parameters', details: parsed.error.flatten() },
        });
        return;
      }

      const { format } = parsed.data;

      const result = await getComplianceReports({ pageSize: 10_000 });
      const data = result.data;
      const exportResult = await exportService.exportData('compliance-reports', format, data);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.EXPORT_GENERATED,
        entityType: 'ComplianceReport',
        entityId: 'bulk',
        description: `Exported ${data.length} compliance reports as ${format.toUpperCase()}`,
        metadata: { format, count: data.length },
      });

      sendExport(res, exportResult);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Tax Assessments
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/export/tax-assessments?format=csv|json|pdf
 */
exportRoutes.get(
  '/tax-assessments',
  apiRateLimiter,
  authenticate,
  authorize(...EXPORT_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = exportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid query parameters', details: parsed.error.flatten() },
        });
        return;
      }

      const { format, userId } = parsed.data;

      const data = await getAllAssessments({ userId });
      const exportResult = await exportService.exportData('tax-assessments', format, data);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.EXPORT_GENERATED,
        entityType: 'TaxAssessment',
        entityId: 'bulk',
        description: `Exported ${data.length} tax assessments as ${format.toUpperCase()}`,
        metadata: { format, count: data.length },
      });

      sendExport(res, exportResult);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/export/cases?format=csv|json|pdf
 */
exportRoutes.get(
  '/cases',
  apiRateLimiter,
  authenticate,
  authorize(...EXPORT_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = exportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid query parameters', details: parsed.error.flatten() },
        });
        return;
      }

      const { format, startDate, endDate } = parsed.data;

      const result = getCases({ startDate, endDate, pageSize: 10_000 });
      const data = result.data;
      const exportResult = await exportService.exportData('cases', format, data);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.EXPORT_GENERATED,
        entityType: 'Case',
        entityId: 'bulk',
        description: `Exported ${data.length} cases as ${format.toUpperCase()}`,
        metadata: { format, count: data.length },
      });

      sendExport(res, exportResult);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/export/audit-logs?format=csv|json|pdf
 * Only ADMIN and AUDITOR may export the audit log.
 */
exportRoutes.get(
  '/audit-logs',
  apiRateLimiter,
  authenticate,
  authorize(UserRole.ADMIN, UserRole.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = exportQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid query parameters', details: parsed.error.flatten() },
        });
        return;
      }

      const { format, startDate, endDate, userId } = parsed.data;

      const data = auditService.getAllAuditEntries({ startDate, endDate, userId });
      const exportResult = await exportService.exportData('audit-logs', format, data);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.EXPORT_GENERATED,
        entityType: 'AuditEntry',
        entityId: 'bulk',
        description: `Exported ${data.length} audit log entries as ${format.toUpperCase()}`,
        metadata: { format, count: data.length },
      });

      sendExport(res, exportResult);
    } catch (error) {
      next(error);
    }
  }
);
