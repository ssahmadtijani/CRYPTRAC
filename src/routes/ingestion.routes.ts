/**
 * Chain Ingestion Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import * as ingestionService from '../services/chain-ingestion.service';
import { UserRole, ApiResponse } from '../types';

export const ingestionRoutes = Router();

ingestionRoutes.use(apiRateLimiter);

/**
 * GET /api/v1/ingestion/status
 * Returns current sync block, target block, and watched address count.
 */
ingestionRoutes.get(
  '/status',
  authenticate,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = ingestionService.getIngestionStatus();
      const watchedCount = ingestionService.getWatchedAddresses().length;
      const response: ApiResponse<typeof status & { watchedAddressCount: number }> = {
        success: true,
        data: { ...status, watchedAddressCount: watchedCount },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/ingestion/start
 * Starts the ingestion worker (admin only).
 */
ingestionRoutes.post(
  '/start',
  authenticate,
  authorize(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ingestionService.startIngestion();
      const status = ingestionService.getIngestionStatus();
      const response: ApiResponse<typeof status> = {
        success: true,
        data: status,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/ingestion/stop
 * Stops the ingestion worker (admin only).
 */
ingestionRoutes.post(
  '/stop',
  authenticate,
  authorize(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      ingestionService.stopIngestion();
      const status = ingestionService.getIngestionStatus();
      const response: ApiResponse<typeof status> = {
        success: true,
        data: status,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/ingestion/watched-addresses
 * List all watched addresses.
 */
ingestionRoutes.get(
  '/watched-addresses',
  authenticate,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const addresses = ingestionService.getWatchedAddresses();
      const response: ApiResponse<typeof addresses> = {
        success: true,
        data: addresses,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/ingestion/watched-addresses
 * Add an address to the watch list.
 */
ingestionRoutes.post(
  '/watched-addresses',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { address, label, network } = req.body as {
        address?: string;
        label?: string;
        network?: string;
      };

      if (!address || typeof address !== 'string') {
        res.status(400).json({
          success: false,
          error: { message: 'address is required' },
        });
        return;
      }

      ingestionService.addWatchedAddress(address, { label, network });
      const addresses = ingestionService.getWatchedAddresses();
      const response: ApiResponse<typeof addresses> = {
        success: true,
        data: addresses,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/ingestion/watched-addresses/:address
 * Remove a watched address.
 */
ingestionRoutes.delete(
  '/watched-addresses/:address',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const removed = ingestionService.removeWatchedAddress(
        req.params.address as string
      );

      if (!removed) {
        res.status(404).json({
          success: false,
          error: { message: 'Address not found in watch list' },
        });
        return;
      }

      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);
