/**
 * Travel Rule Routes for CRYPTRAC
 * Mounted at /api/v1/travel-rule
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import * as travelRuleService from '../services/travel-rule.service';
import * as auditService from '../services/audit.service';
import { UserRole, AuditAction, TravelRuleStatus } from '../types';

export const travelRuleRoutes = Router();

travelRuleRoutes.use(apiRateLimiter);

/**
 * POST /api/v1/travel-rule
 * Initiate a travel rule record
 */
travelRuleRoutes.post(
  '/',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { transactionId, originatorInfo, beneficiaryInfo, amount, amountUSD, asset, network } = req.body;

      if (!transactionId || !originatorInfo || !beneficiaryInfo || amountUSD === undefined || !asset || !network) {
        res.status(400).json({ success: false, error: { message: 'Missing required fields: transactionId, originatorInfo, beneficiaryInfo, amountUSD, asset, network' } });
        return;
      }

      const record = travelRuleService.initiateTravelRule(
        transactionId,
        originatorInfo,
        beneficiaryInfo,
        amount ?? 0,
        amountUSD,
        asset,
        network
      );

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.TRAVEL_RULE_INITIATED,
        entityType: 'TravelRule',
        entityId: record.id,
        description: `Travel rule initiated for transaction ${transactionId}`,
        metadata: { transactionId, amountUSD, status: record.status },
      });

      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/travel-rule
 * List travel rule records with filters
 */
travelRuleRoutes.get(
  '/',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST, UserRole.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, transactionId, startDate, endDate, isAboveThreshold } = req.query;

      const filters: {
        status?: TravelRuleStatus;
        transactionId?: string;
        startDate?: Date;
        endDate?: Date;
        isAboveThreshold?: boolean;
      } = {};

      if (status) filters.status = status as TravelRuleStatus;
      if (transactionId) filters.transactionId = transactionId as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (isAboveThreshold !== undefined) filters.isAboveThreshold = isAboveThreshold === 'true';

      const records = travelRuleService.getTravelRuleRecords(filters);
      res.json({ success: true, data: records, total: records.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/travel-rule/stats
 * Travel rule compliance statistics
 */
travelRuleRoutes.get(
  '/stats',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = travelRuleService.getTravelRuleStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/travel-rule/expire-stale
 * Manually trigger expiration of stale records
 */
travelRuleRoutes.post(
  '/expire-stale',
  authenticate,
  authorize(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const count = travelRuleService.expireStaleRecords();
      res.json({ success: true, data: { expiredCount: count } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/travel-rule/vasps
 * Register a new VASP
 */
travelRuleRoutes.post(
  '/vasps',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, registrationNumber, country, regulatoryAuthority, isVerified, supportedNetworks, leiCode, apiEndpoint, publicKey } = req.body;

      if (!name || !registrationNumber || !country || !regulatoryAuthority) {
        res.status(400).json({ success: false, error: { message: 'Missing required fields: name, registrationNumber, country, regulatoryAuthority' } });
        return;
      }

      const vasp = travelRuleService.registerVASP({
        name,
        registrationNumber,
        country,
        regulatoryAuthority,
        isVerified: isVerified ?? false,
        supportedNetworks: supportedNetworks ?? [],
        leiCode,
        apiEndpoint,
        publicKey,
      });

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.VASP_REGISTERED,
        entityType: 'VASP',
        entityId: vasp.id,
        description: `VASP registered: ${vasp.name} (${vasp.country})`,
        metadata: { vaspId: vasp.id, name: vasp.name, country: vasp.country },
      });

      res.status(201).json({ success: true, data: vasp });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/travel-rule/vasps
 * List registered VASPs
 */
travelRuleRoutes.get(
  '/vasps',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { country, isVerified } = req.query;
      const filters: { country?: string; isVerified?: boolean } = {};
      if (country) filters.country = country as string;
      if (isVerified !== undefined) filters.isVerified = isVerified === 'true';

      const vasps = travelRuleService.getVASPs(filters);
      res.json({ success: true, data: vasps, total: vasps.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/travel-rule/vasps/:id
 * Get VASP details
 */
travelRuleRoutes.get(
  '/vasps/:id',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vasp = travelRuleService.getVASPById(req.params.id as string);
      if (!vasp) {
        res.status(404).json({ success: false, error: { message: 'VASP not found' } });
        return;
      }
      res.json({ success: true, data: vasp });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/travel-rule/:id
 * Get single travel rule record
 */
travelRuleRoutes.get(
  '/:id',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST, UserRole.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const record = travelRuleService.getTravelRuleRecord(req.params.id as string);
      if (!record) {
        res.status(404).json({ success: false, error: { message: 'Travel rule record not found' } });
        return;
      }
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/travel-rule/:id/status
 * Update travel rule status
 */
travelRuleRoutes.patch(
  '/:id/status',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, notes } = req.body;
      if (!status) {
        res.status(400).json({ success: false, error: { message: 'status is required' } });
        return;
      }

      const record = travelRuleService.updateTravelRuleStatus(req.params.id as string, status as TravelRuleStatus, notes);

      auditService.logAction({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: AuditAction.TRAVEL_RULE_STATUS_UPDATED,
        entityType: 'TravelRule',
        entityId: record.id,
        description: `Travel rule status updated to ${status}`,
        metadata: { status, notes },
      });

      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/travel-rule/:id/beneficiary
 * Submit beneficiary information
 */
travelRuleRoutes.patch(
  '/:id/beneficiary',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { beneficiaryInfo } = req.body;
      if (!beneficiaryInfo) {
        res.status(400).json({ success: false, error: { message: 'beneficiaryInfo is required' } });
        return;
      }

      const record = travelRuleService.submitBeneficiaryInfo(req.params.id as string, beneficiaryInfo);
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/travel-rule/:id/compliance-check
 * Run compliance check on a travel rule record
 */
travelRuleRoutes.get(
  '/:id/compliance-check',
  authenticate,
  authorize(UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = travelRuleService.checkTravelRuleCompliance(req.params.id as string);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);
