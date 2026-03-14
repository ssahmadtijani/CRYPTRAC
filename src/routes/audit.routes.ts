/**
 * Audit Routes for CRYPTRAC
 * Provides access to the comprehensive audit log for administrators and auditors.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { auditFilterSchema } from '../validators/schemas';
import * as auditService from '../services/audit.service';
import { ApiResponse, AuditEntry, AuditStats, UserRole } from '../types';

export const auditRoutes = Router();

auditRoutes.use(apiRateLimiter);

// Roles permitted to access audit logs
const AUDIT_ROLES = [UserRole.ADMIN, UserRole.AUDITOR, UserRole.COMPLIANCE_OFFICER];

/**
 * GET /api/v1/audit
 * List audit log entries with optional filters and pagination.
 * Restricted to ADMIN, AUDITOR, and COMPLIANCE_OFFICER roles.
 */
auditRoutes.get(
  '/',
  apiRateLimiter,
  authenticate,
  authorize(...AUDIT_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = auditFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid filter parameters', details: parsed.error.flatten() },
        });
        return;
      }

      const result = auditService.getAuditLog(parsed.data);
      const response: ApiResponse<AuditEntry[]> = {
        success: true,
        data: result.data,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/audit/stats
 * Aggregate statistics about audit activity.
 */
auditRoutes.get(
  '/stats',
  apiRateLimiter,
  authenticate,
  authorize(...AUDIT_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string | undefined;
      const stats = auditService.getAuditStats(userId);
      const response: ApiResponse<AuditStats> = { success: true, data: stats };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/audit/:id
 * Retrieve a single audit entry by ID.
 */
auditRoutes.get(
  '/:id',
  apiRateLimiter,
  authenticate,
  authorize(...AUDIT_ROLES),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entry = auditService.getAuditEntryById(req.params.id as string);
      const response: ApiResponse<AuditEntry> = { success: true, data: entry };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
