/**
 * Alert Rules Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiRateLimiter } from '../middleware/rateLimiter';
import {
  createAlertRuleSchema,
  updateAlertRuleSchema,
} from '../validators/schemas';
import * as alertService from '../services/alert.service';
import { UserRole, ApiResponse, AlertRule } from '../types';

export const alertRoutes = Router();

alertRoutes.use(apiRateLimiter);
alertRoutes.use(authenticate);
alertRoutes.use(authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER));

/**
 * GET /api/v1/alerts/rules/defaults
 * Get the built-in default alert rules (must be before /:id route)
 */
alertRoutes.get(
  '/rules/defaults',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const defaults = alertService.getDefaultRules();
      res.status(200).json({ success: true, data: defaults });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/alerts/rules
 * List all alert rules
 */
alertRoutes.get(
  '/rules',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isActive =
        req.query.isActive === 'true'
          ? true
          : req.query.isActive === 'false'
            ? false
            : undefined;

      const rules = alertService.getAlertRules({ isActive });
      const response: ApiResponse<AlertRule[]> = { success: true, data: rules };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/alerts/rules
 * Create a new alert rule
 */
alertRoutes.post(
  '/rules',
  validate(createAlertRuleSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const createdBy = req.user!.userId;
      const rule = alertService.createAlertRule(req.body, createdBy);
      const response: ApiResponse<AlertRule> = { success: true, data: rule };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/alerts/rules/:id
 * Get a single alert rule
 */
alertRoutes.get(
  '/rules/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rule = alertService.getAlertRule(req.params.id as string);
      if (!rule) {
        res.status(404).json({
          success: false,
          error: { message: 'Alert rule not found' },
        });
        return;
      }
      const response: ApiResponse<AlertRule> = { success: true, data: rule };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/alerts/rules/:id
 * Update an alert rule
 */
alertRoutes.put(
  '/rules/:id',
  validate(updateAlertRuleSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rule = alertService.updateAlertRule(req.params.id as string, req.body);
      const response: ApiResponse<AlertRule> = { success: true, data: rule };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/alerts/rules/:id/toggle
 * Toggle alert rule active/inactive
 */
alertRoutes.patch(
  '/rules/:id/toggle',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rule = alertService.toggleAlertRule(req.params.id as string);
      const response: ApiResponse<AlertRule> = { success: true, data: rule };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/alerts/rules/:id
 * Delete an alert rule
 */
alertRoutes.delete(
  '/rules/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      alertService.deleteAlertRule(req.params.id as string);
      res.status(200).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  }
);
