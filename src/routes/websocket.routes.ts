/**
 * WebSocket Admin Routes for CRYPTRAC
 * REST endpoints for monitoring and managing WebSocket connections.
 * Mounted at /api/v1/ws
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { UserRole, WSEventType, WSEvent } from '../types';
import {
  getConnectedClients,
  getConnectionStats,
  broadcastEvent,
} from '../services/websocket.service';
import { ApiResponse } from '../types';

export const websocketRoutes = Router();

websocketRoutes.use(apiRateLimiter);

// ---------------------------------------------------------------------------
// GET /api/v1/ws/clients — list connected clients (ADMIN only)
// ---------------------------------------------------------------------------

websocketRoutes.get(
  '/clients',
  authenticate,
  authorize(UserRole.ADMIN),
  (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const clients = getConnectedClients();
      const response: ApiResponse<typeof clients> = {
        success: true,
        data: clients,
        meta: { total: clients.length },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/ws/stats — connection statistics (ADMIN, COMPLIANCE_OFFICER)
// ---------------------------------------------------------------------------

websocketRoutes.get(
  '/stats',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const stats = getConnectionStats();
      const response: ApiResponse<typeof stats> = {
        success: true,
        data: stats,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/ws/broadcast — send a system alert to all clients (ADMIN only)
// ---------------------------------------------------------------------------

websocketRoutes.post(
  '/broadcast',
  authenticate,
  authorize(UserRole.ADMIN),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { message } = req.body as { message?: string };
      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({
          success: false,
          error: { message: 'message is required' },
        });
        return;
      }

      const event: WSEvent = {
        type: WSEventType.SYSTEM_ALERT,
        payload: { message: message.trim(), sentBy: req.user!.userId },
        timestamp: new Date(),
        userId: req.user!.userId,
      };

      broadcastEvent(event);

      const response: ApiResponse<{ sent: boolean }> = {
        success: true,
        data: { sent: true },
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);
