/**
 * Exchange Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import * as exchangeService from '../services/exchange.service';
import { ApiResponse } from '../types';

export const exchangeRoutes = Router();

exchangeRoutes.use(apiRateLimiter);

/**
 * POST /api/v1/exchanges/connect
 */
exchangeRoutes.post(
  '/connect',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { exchangeName } = req.body as { exchangeName: string };
      if (!exchangeName) {
        res.status(400).json({
          success: false,
          error: { message: 'exchangeName is required' },
        });
        return;
      }

      const connection = await exchangeService.connectExchange(
        req.user!.userId,
        exchangeName
      );

      const response: ApiResponse<typeof connection> = {
        success: true,
        data: connection,
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/exchanges
 */
exchangeRoutes.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const connections = exchangeService.getConnectedExchanges(req.user!.userId);
      const response: ApiResponse<typeof connections> = {
        success: true,
        data: connections,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/exchanges/:name/sync
 */
exchangeRoutes.post(
  '/:name/sync',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await exchangeService.syncExchangeData(
        req.user!.userId,
        req.params.name as string
      );
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

/**
 * GET /api/v1/exchanges/transactions
 */
exchangeRoutes.get(
  '/transactions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const txs = exchangeService.getAllExchangeTransactions(req.user!.userId);
      const response: ApiResponse<typeof txs> = {
        success: true,
        data: txs,
        meta: { total: txs.length },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/exchanges/:name/transactions
 */
exchangeRoutes.get(
  '/:name/transactions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const txs = exchangeService.getExchangeTransactions(
        req.user!.userId,
        req.params.name as string
      );
      const response: ApiResponse<typeof txs> = {
        success: true,
        data: txs,
        meta: { total: txs.length },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
