/**
 * Role-Permission Routes for CRYPTRAC
 * ADMIN-only endpoints for managing role permissions and user overrides.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { apiRateLimiter } from '../middleware/rateLimiter';
import {
  updateRolePermissionsSchema,
  grantRevokePermissionSchema,
} from '../validators/schemas';
import * as rolePermissionService from '../services/role-permission.service';
import { UserRole, Permission } from '../types';

export const rolePermissionRoutes = Router();

rolePermissionRoutes.use(apiRateLimiter);
rolePermissionRoutes.use(authenticate);
rolePermissionRoutes.use(authorize(UserRole.ADMIN));

/**
 * GET /api/v1/admin/roles
 * Get all role-permission assignments
 */
rolePermissionRoutes.get(
  '/',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const matrix = rolePermissionService.getAllRolePermissions();
      res.json({ success: true, data: matrix });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/roles/permissions
 * Get full list of available permissions
 */
rolePermissionRoutes.get(
  '/permissions',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const permissions = rolePermissionService.getPermissionsList();
      res.json({ success: true, data: permissions });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/roles/:role
 * Get permissions for a specific role
 */
rolePermissionRoutes.get(
  '/:role',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const role = req.params.role as UserRole;
      if (!Object.values(UserRole).includes(role)) {
        res.status(400).json({ success: false, error: { message: 'Invalid role' } });
        return;
      }
      const permissions = rolePermissionService.getRolePermissions(role);
      res.json({ success: true, data: { role, permissions } });
    } catch (err) { next(err); }
  }
);

/**
 * PUT /api/v1/admin/roles/:role
 * Update permissions for a role (ADMIN role cannot be modified)
 */
rolePermissionRoutes.put(
  '/:role',
  validate(updateRolePermissionsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const role = req.params.role as UserRole;
      if (!Object.values(UserRole).includes(role)) {
        res.status(400).json({ success: false, error: { message: 'Invalid role' } });
        return;
      }
      const permissions = rolePermissionService.updateRolePermissions(
        role,
        req.body.permissions,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: { role, permissions } });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/roles/users/:userId/permissions
 * Get effective permissions for a user
 */
rolePermissionRoutes.get(
  '/users/:userId/permissions',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const roleParam = (Array.isArray(req.query.role) ? req.query.role[0] : req.query.role) as UserRole;
      if (!roleParam || !Object.values(UserRole).includes(roleParam)) {
        res.status(400).json({ success: false, error: { message: 'role query param required' } });
        return;
      }
      const permissions = rolePermissionService.getUserEffectivePermissions(userId, roleParam);
      const overrides = rolePermissionService.getUserPermissionOverrides(userId);
      res.json({ success: true, data: { userId, permissions, overrides } });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/admin/roles/users/:userId/permissions/grant
 * Grant a specific permission to a user (override)
 */
rolePermissionRoutes.post(
  '/users/:userId/permissions/grant',
  validate(grantRevokePermissionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const override = rolePermissionService.grantUserPermission(
        req.params.userId as string,
        req.body.permission as Permission,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: override });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/v1/admin/roles/users/:userId/permissions/revoke
 * Revoke a specific permission from a user (override)
 */
rolePermissionRoutes.post(
  '/users/:userId/permissions/revoke',
  validate(grantRevokePermissionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const override = rolePermissionService.revokeUserPermission(
        req.params.userId as string,
        req.body.permission as Permission,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: override });
    } catch (err) { next(err); }
  }
);

/**
 * DELETE /api/v1/admin/roles/users/:userId/permissions
 * Clear all permission overrides for a user
 */
rolePermissionRoutes.delete(
  '/users/:userId/permissions',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      rolePermissionService.clearUserPermissionOverrides(
        req.params.userId as string,
        req.user!.userId,
        req.user!.email,
        req.user!.role
      );
      res.json({ success: true, data: { message: 'Overrides cleared' } });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/v1/admin/roles/check/:userId/:permission
 * Check if a user has a specific permission
 */
rolePermissionRoutes.get(
  '/check/:userId/:permission',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId as string;
      const permission = req.params.permission as string;
      const roleParam = (Array.isArray(req.query.role) ? req.query.role[0] : req.query.role) as UserRole;
      if (!roleParam || !Object.values(UserRole).includes(roleParam)) {
        res.status(400).json({ success: false, error: { message: 'role query param required' } });
        return;
      }
      if (!Object.values(Permission).includes(permission as Permission)) {
        res.status(400).json({ success: false, error: { message: 'Invalid permission' } });
        return;
      }
      const hasPermission = rolePermissionService.checkPermission(userId, roleParam, permission as Permission);
      res.json({ success: true, data: { userId, permission, hasPermission } });
    } catch (err) { next(err); }
  }
);
