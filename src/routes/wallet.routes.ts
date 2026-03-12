import { Router, Request, Response, NextFunction } from 'express';
import { walletService } from '../services/wallet.service';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiLimiter } from '../middleware/rateLimiter';
import { walletSchema } from '../validators/schemas';
import { UserRole } from '../types';

export const walletRoutes = Router();

walletRoutes.use(apiLimiter);

walletRoutes.post(
  '/',
  authenticate,
  validate(walletSchema),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const wallet = walletService.registerWallet(req.body);
      res.status(201).json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  }
);

walletRoutes.get(
  '/',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const filter = {
        userId: req.query.userId as string | undefined,
        blockchain: req.query.blockchain as string | undefined,
        page,
        limit,
      };
      const { data, total } = walletService.getWallets(filter);
      res.json({
        success: true,
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }
);

walletRoutes.get(
  '/:address',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const wallet = walletService.getWallet(String(req.params.address));
      if (!wallet) {
        res.status(404).json({
          success: false,
          error: { message: 'Wallet not found' },
        });
        return;
      }
      res.json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  }
);

walletRoutes.patch(
  '/:address/risk-score',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { score } = req.body;
      if (score === undefined || typeof score !== 'number') {
        res.status(400).json({ success: false, error: { message: 'score (number) is required' } });
        return;
      }
      const wallet = walletService.updateRiskScore(String(req.params.address), score);
      res.json({ success: true, data: wallet });
    } catch (err) {
      next(err);
    }
  }
);

walletRoutes.get(
  '/:address/sanctions',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = walletService.checkSanctions(String(req.params.address));
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);
