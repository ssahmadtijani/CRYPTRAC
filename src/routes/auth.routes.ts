/**
 * Auth Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema } from '../validators/schemas';
import * as authService from '../services/auth.service';
import { ApiResponse } from '../types';

export const authRoutes = Router();

/**
 * POST /api/v1/auth/register
 * Register a new user account.
 */
authRoutes.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await authService.register(req.body);
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
 * Authenticate and receive a JWT token.
 */
authRoutes.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.login(req.body);
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
