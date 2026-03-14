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

// ---------------------------------------------------------------------------
// Analytics Report
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/export/analytics?format=csv|json|pdf
 */
exportRoutes.get(
  '/analytics',
  apiRateLimiter,
  authenticate,
  authorize(...EXPORT_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || 'json';
      if (!['csv', 'json', 'pdf'].includes(format)) {
        res.status(400).json({ success: false, error: { message: 'Invalid format' } });
        return;
      }

      const exportResult = await exportService.exportAnalyticsReport(
        format as 'csv' | 'json' | 'pdf'
      );

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.EXPORT_GENERATED,
        entityType: 'AnalyticsReport',
        entityId: 'dashboard',
        description: `Exported analytics report as ${format.toUpperCase()}`,
        metadata: { format },
      });

      sendExport(res, exportResult);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Case Report (single)
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/export/cases/:id?format=csv|json|pdf
 */
exportRoutes.get(
  '/cases/:id',
  apiRateLimiter,
  authenticate,
  authorize(...EXPORT_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const format = (req.query.format as string) || 'json';
      if (!['csv', 'json', 'pdf'].includes(format)) {
        res.status(400).json({ success: false, error: { message: 'Invalid format' } });
        return;
      }

      const exportResult = await exportService.exportCaseReport(
        id,
        format as 'csv' | 'json' | 'pdf'
      );

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.EXPORT_GENERATED,
        entityType: 'Case',
        entityId: id,
        description: `Exported case ${id} report as ${format.toUpperCase()}`,
        metadata: { format, caseId: id },
      });

      sendExport(res, exportResult);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Audit Log (with filters)
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/export/audit-log?format=csv|json|pdf&startDate=&endDate=
 */
exportRoutes.get(
  '/audit-log',
  apiRateLimiter,
  authenticate,
  authorize(
    UserRole.ADMIN,
    UserRole.COMPLIANCE_OFFICER,
    UserRole.ANALYST,
    UserRole.AUDITOR
  ),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || 'json';
      if (!['csv', 'json', 'pdf'].includes(format)) {
        res.status(400).json({ success: false, error: { message: 'Invalid format' } });
        return;
      }

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const exportResult = await exportService.exportAuditLog(
        { startDate, endDate, pageSize: 10_000 },
        format as 'csv' | 'json' | 'pdf'
      );

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.EXPORT_GENERATED,
        entityType: 'AuditEntry',
        entityId: 'filtered',
        description: `Exported audit log as ${format.toUpperCase()}`,
        metadata: { format },
      });

      sendExport(res, exportResult);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Pattern Report
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/export/patterns?format=csv|json|pdf
 */
exportRoutes.get(
  '/patterns',
  apiRateLimiter,
  authenticate,
  authorize(
    UserRole.COMPLIANCE_OFFICER,
    UserRole.ADMIN,
    UserRole.ANALYST,
    UserRole.AUDITOR
  ),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const format = (req.query.format as string) || 'json';
      if (!['csv', 'json', 'pdf'].includes(format)) {
        res.status(400).json({ success: false, error: { message: 'Invalid format' } });
        return;
      }

      const exportResult = await exportService.exportPatternReport(
        format as 'csv' | 'json' | 'pdf'
      );

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.EXPORT_GENERATED,
        entityType: 'PatternReport',
        entityId: 'all',
        description: `Exported pattern detection report as ${format.toUpperCase()}`,
        metadata: { format },
      });

      sendExport(res, exportResult);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Network Graph
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/export/network-graph
 */
exportRoutes.get(
  '/network-graph',
  apiRateLimiter,
  authenticate,
  authorize(
    UserRole.COMPLIANCE_OFFICER,
    UserRole.ADMIN,
    UserRole.ANALYST,
    UserRole.AUDITOR
  ),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const exportResult = await exportService.exportNetworkGraph();

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.EXPORT_GENERATED,
        entityType: 'NetworkGraph',
        entityId: 'all',
        description: 'Exported network graph as JSON',
        metadata: { format: 'json' },
      });

      sendExport(res, exportResult);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Export Jobs
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/export/jobs — schedule an export job
 */
exportRoutes.post(
  '/jobs',
  apiRateLimiter,
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { exportType, format, filters } = req.body as {
        exportType?: string;
        format?: string;
        filters?: Record<string, unknown>;
      };

      if (!exportType || !format) {
        res.status(400).json({
          success: false,
          error: { message: 'exportType and format are required' },
        });
        return;
      }

      if (!['csv', 'json', 'pdf'].includes(format)) {
        res.status(400).json({ success: false, error: { message: 'Invalid format' } });
        return;
      }

      const job = exportService.scheduleExport(
        req.user!.userId,
        exportType,
        format,
        filters
      );

      res.status(202).json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/export/jobs — list user's export jobs
 */
exportRoutes.get(
  '/jobs',
  apiRateLimiter,
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const jobs = exportService.getExportHistory(req.user!.userId);
      res.json({ success: true, data: jobs, meta: { total: jobs.length } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/export/jobs/:id — get specific export job status
 */
exportRoutes.get(
  '/jobs/:id',
  apiRateLimiter,
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const job = exportService.getExportJob(String(req.params.id));
      if (!job) {
        res.status(404).json({ success: false, error: { message: 'Export job not found' } });
        return;
      }
      if (job.userId !== req.user!.userId && req.user!.role !== UserRole.ADMIN) {
        res.status(403).json({ success: false, error: { message: 'Forbidden' } });
        return;
      }
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }
);

// Export history (legacy)
exportRoutes.get(
  '/history',
  apiRateLimiter,
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const history = exportService.getExportHistory(req.user!.userId);
      res.json({
        success: true,
        data: history,
        meta: { total: history.length },
      });
    } catch (error) {
      next(error);
    }
  }
);
