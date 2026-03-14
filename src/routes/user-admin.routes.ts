/**
 * User Administration Routes for CRYPTRAC
 * ADMIN-only endpoints for full user lifecycle management.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiRateLimiter } from '../middleware/rateLimiter';
import {
  createUserAdminSchema,
  updateUserProfileSchema,
  changeUserRoleSchema,
  suspendUserSchema,
  lockUserSchema,
  resetPasswordSchema,
  userFilterSchema,
} from '../validators/schemas';
import * as userAdminService from '../services/user-admin.service';
import { UserRole, ApiResponse } from '../types';

export const userAdminRoutes = Router();

userAdminRoutes.use(apiRateLimiter);
userAdminRoutes.use(authenticate);
userAdminRoutes.use(authorize(UserRole.ADMIN));

/**
 * GET /api/v1/admin/users
 * List users with filtering and pagination
 */
userAdminRoutes.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = userFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: { message: 'Invalid filter', details: parsed.error.flatten() } });
        return;
      }
      const result = userAdminService.getUsers(parsed.data);
      res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: Math.ceil(result.total / result.pageSize) },
      });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/users/stats
 * Get user administration statistics
 */
userAdminRoutes.get(
  '/stats',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = userAdminService.getUserAdminStats();
      res.json({ success: true, data: stats });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/admin/users
 * Create a new user
 */
userAdminRoutes.post(
  '/',
  validate(createUserAdminSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await userAdminService.createUser({
        ...req.body,
        createdById: req.user!.userId,
        createdByEmail: req.user!.email,
        createdByRole: req.user!.role,
      });
      res.status(201).json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/users/:id
 * Get a single user by ID
 */
userAdminRoutes.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = userAdminService.getUserById(req.params.id as string);
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * PATCH /api/v1/admin/users/:id
 * Update user profile
 */
userAdminRoutes.patch(
  '/:id',
  validate(updateUserProfileSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = userAdminService.updateUserProfile(
        req.params.id as string,
        req.body,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * PATCH /api/v1/admin/users/:id/role
 * Change user role
 */
userAdminRoutes.patch(
  '/:id/role',
  validate(changeUserRoleSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = userAdminService.changeUserRole(
        req.params.id as string,
        req.body.role,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/admin/users/:id/suspend
 * Suspend a user account
 */
userAdminRoutes.post(
  '/:id/suspend',
  validate(suspendUserSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = userAdminService.suspendUser(
        req.params.id as string,
        req.body.reason,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/admin/users/:id/reactivate
 * Reactivate a suspended/locked user
 */
userAdminRoutes.post(
  '/:id/reactivate',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = userAdminService.reactivateUser(
        req.params.id as string,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/admin/users/:id/lock
 * Lock a user account
 */
userAdminRoutes.post(
  '/:id/lock',
  validate(lockUserSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = userAdminService.lockUser(
        req.params.id as string,
        req.body.durationMs,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/admin/users/:id/unlock
 * Unlock a user account
 */
userAdminRoutes.post(
  '/:id/unlock',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = userAdminService.unlockUser(
        req.params.id as string,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/admin/users/:id/deactivate
 * Permanently deactivate a user account
 */
userAdminRoutes.post(
  '/:id/deactivate',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = userAdminService.deactivateUser(
        req.params.id as string,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/admin/users/:id/reset-password
 * Reset a user's password
 */
userAdminRoutes.post(
  '/:id/reset-password',
  validate(resetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await userAdminService.resetUserPassword(
        req.params.id as string,
        req.body.newPassword,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: { message: 'Password reset successfully' } });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/users/:id/sessions
 * List active sessions for a user
 */
userAdminRoutes.get(
  '/:id/sessions',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessions = userAdminService.getUserSessions(req.params.id as string);
      res.json({ success: true, data: sessions });
    } catch (err) { next(err); }
  }
);

/**
 * DELETE /api/v1/admin/users/:id/sessions
 * Terminate all sessions for a user
 */
userAdminRoutes.delete(
  '/:id/sessions',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const count = userAdminService.terminateAllSessions(
        req.params.id as string,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: { terminated: count } });
    } catch (err) { next(err); }
  }
);

/**
 * DELETE /api/v1/admin/users/:id/sessions/:sessionId
 * Terminate a specific session
 */
userAdminRoutes.delete(
  '/:id/sessions/:sessionId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      userAdminService.terminateSession(
        req.params.id as string,
        req.params.sessionId as string,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: { message: 'Session terminated' } });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/users/:id/activity
 * Get activity log for a user
 */
userAdminRoutes.get(
  '/:id/activity',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 20);
      const result = userAdminService.getUserActivity(req.params.id as string, page, pageSize);
      res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, pageSize: result.pageSize, total: result.total },
      });
    } catch (err) { next(err); }
  }
);
