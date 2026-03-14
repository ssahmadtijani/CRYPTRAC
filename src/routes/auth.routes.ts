/**
 * Auth Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimiter';
import { loginSchema, registerSchema } from '../validators/schemas';
import * as authService from '../services/auth.service';
import * as auditService from '../services/audit.service';
import { ApiResponse, AuditAction } from '../types';

export const authRoutes = Router();

/**
 * POST /api/v1/auth/register
 */
authRoutes.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await authService.register(req.body);

      auditService.logAction({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: AuditAction.USER_REGISTER,
        entityType: 'User',
        entityId: user.id,
        description: `New user registered: ${user.email}`,
        metadata: { role: user.role },
      });

      const response: ApiResponse<typeof user> = {
        success: true,
        data: user,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/login
 */
authRoutes.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.login(req.body);

      auditService.logAction({
        userId: result.user.id,
        userEmail: result.user.email,
        userRole: result.user.role,
        action: AuditAction.USER_LOGIN,
        entityType: 'User',
        entityId: result.user.id,
        description: `User logged in: ${result.user.email}`,
      });

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
