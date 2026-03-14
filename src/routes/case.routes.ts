/**
 * Case Management Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiRateLimiter } from '../middleware/rateLimiter';
import {
  createCaseSchema,
  updateCaseStatusSchema,
  assignCaseSchema,
  addCaseNoteSchema,
  linkTransactionSchema,
  linkWalletSchema,
  updateCasePrioritySchema,
  caseFilterSchema,
} from '../validators/schemas';
import * as caseService from '../services/case.service';
import { UserRole, ApiResponse, Case, CaseNote, CaseTimelineEntry, CaseDashboardMetrics } from '../types';

export const caseRoutes = Router();

caseRoutes.use(apiRateLimiter);

/**
 * POST /api/v1/cases
 * Create a new investigation case
 */
caseRoutes.post(
  '/',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  validate(createCaseSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const newCase = caseService.createCase(req.body, userId);
      const response: ApiResponse<Case> = {
        success: true,
        data: newCase,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/cases
 * List and filter cases
 */
caseRoutes.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = caseFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid filter parameters', details: parsed.error.flatten() },
        });
        return;
      }

      const filter = parsed.data;
      const result = caseService.getCases({
        ...filter,
        startDate: filter.startDate ? new Date(filter.startDate) : undefined,
        endDate: filter.endDate ? new Date(filter.endDate) : undefined,
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
 * GET /api/v1/cases/dashboard
 * Get dashboard metrics
 */
caseRoutes.get(
  '/dashboard',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST, UserRole.AUDITOR),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metrics = caseService.getDashboardMetrics();
      const response: ApiResponse<CaseDashboardMetrics> = {
        success: true,
        data: metrics,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/cases/:id
 * Get a single case with notes and timeline
 */
caseRoutes.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const found = caseService.getCaseById(req.params.id as string);
      if (!found) {
        res.status(404).json({
          success: false,
          error: { message: 'Case not found' },
        });
        return;
      }
      res.status(200).json({ success: true, data: found });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/cases/:id/status
 * Update case status
 */
caseRoutes.patch(
  '/:id/status',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  validate(updateCaseStatusSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const updated = caseService.updateCaseStatus(
        req.params.id as string,
        req.body.status,
        userId,
        req.body.resolution
      );
      const response: ApiResponse<Case> = { success: true, data: updated };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/cases/:id/assign
 * Assign case to a compliance officer
 */
caseRoutes.patch(
  '/:id/assign',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  validate(assignCaseSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const updated = caseService.assignCase(
        req.params.id as string,
        req.body.assigneeId,
        userId
      );
      const response: ApiResponse<Case> = { success: true, data: updated };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/cases/:id/priority
 * Update case priority
 */
caseRoutes.patch(
  '/:id/priority',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  validate(updateCasePrioritySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const updated = caseService.updateCasePriority(
        req.params.id as string,
        req.body.priority,
        userId
      );
      const response: ApiResponse<Case> = { success: true, data: updated };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/cases/:id/notes
 * Add an investigation note
 */
caseRoutes.post(
  '/:id/notes',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  validate(addCaseNoteSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const note = caseService.addCaseNote(
        req.params.id as string,
        userId,
        req.body.content,
        req.body.noteType,
        req.body.attachments
      );
      const response: ApiResponse<CaseNote> = { success: true, data: note };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/cases/:id/transactions
 * Link a transaction to a case
 */
caseRoutes.post(
  '/:id/transactions',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  validate(linkTransactionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const updated = caseService.linkTransaction(
        req.params.id as string,
        req.body.transactionId,
        userId
      );
      const response: ApiResponse<Case> = { success: true, data: updated };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/cases/:id/wallets
 * Link a wallet address to a case
 */
caseRoutes.post(
  '/:id/wallets',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  validate(linkWalletSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const updated = caseService.linkWallet(
        req.params.id as string,
        req.body.walletAddress,
        userId
      );
      const response: ApiResponse<Case> = { success: true, data: updated };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/cases/:id/timeline
 * Get the case timeline
 */
caseRoutes.get(
  '/:id/timeline',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const timeline = caseService.getCaseTimeline(req.params.id as string);
      const response: ApiResponse<CaseTimelineEntry[]> = { success: true, data: timeline };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/cases/:id/related
 * Get related cases (sharing transactions or wallets)
 */
caseRoutes.get(
  '/:id/related',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const related = caseService.getRelatedCases(req.params.id as string);
      const response: ApiResponse<Case[]> = { success: true, data: related };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
