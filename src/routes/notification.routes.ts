/**
 * Notification Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiRateLimiter } from '../middleware/rateLimiter';
import {
  notificationPreferencesSchema,
  notificationFilterSchema,
} from '../validators/schemas';
import * as notificationService from '../services/notification.service';
import { ApiResponse, Notification, NotificationPreferences, NotificationStats } from '../types';

export const notificationRoutes = Router();

notificationRoutes.use(apiRateLimiter);

/**
 * GET /api/v1/notifications
 * List notifications for the authenticated user (paginated, filterable)
 */
notificationRoutes.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = notificationFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid filter parameters', details: parsed.error.flatten() },
        });
        return;
      }

      const userId = req.user!.userId;
      const result = notificationService.getNotifications({
        userId,
        type: parsed.data.type,
        priority: parsed.data.priority,
        isRead: parsed.data.isRead,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
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
 * GET /api/v1/notifications/stats
 * Get notification stats for the authenticated user
 */
notificationRoutes.get(
  '/stats',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const stats = notificationService.getNotificationStats(userId);
      const response: ApiResponse<NotificationStats> = { success: true, data: stats };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/notifications/preferences
 * Get user notification preferences
 */
notificationRoutes.get(
  '/preferences',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const prefs = notificationService.getUserPreferences(userId);
      const response: ApiResponse<NotificationPreferences> = { success: true, data: prefs };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/notifications/preferences
 * Update user notification preferences
 */
notificationRoutes.put(
  '/preferences',
  authenticate,
  validate(notificationPreferencesSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const prefs = notificationService.updateUserPreferences(userId, req.body);
      const response: ApiResponse<NotificationPreferences> = { success: true, data: prefs };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all notifications as read
 */
notificationRoutes.patch(
  '/read-all',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const count = notificationService.markAllAsRead(userId);
      res.status(200).json({
        success: true,
        data: { markedAsRead: count },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a notification as read
 */
notificationRoutes.patch(
  '/:id/read',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const updated = notificationService.markAsRead(req.params.id as string, userId);
      const response: ApiResponse<Notification> = { success: true, data: updated };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/notifications/:id
 * Delete a notification
 */
notificationRoutes.delete(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      notificationService.deleteNotification(req.params.id as string, userId);
      res.status(200).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  }
);
