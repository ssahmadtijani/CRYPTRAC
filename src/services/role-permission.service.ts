/**
 * Role-Permission Service for CRYPTRAC
 * Manages the permission matrix for all roles and user-specific permission overrides.
 */

import {
  UserRole,
  Permission,
  RolePermissionMatrix,
  UserPermissionOverride,
  AuditAction,
} from '../types';
import * as auditService from './audit.service';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Default permission matrix
// ---------------------------------------------------------------------------

const ALL_PERMISSIONS = Object.values(Permission);

const VIEW_ONLY: Permission[] = [
  Permission.VIEW_DASHBOARD,
  Permission.VIEW_TRANSACTIONS,
  Permission.VIEW_WALLETS,
  Permission.VIEW_COMPLIANCE,
  Permission.VIEW_CASES,
  Permission.VIEW_RISK,
  Permission.VIEW_ANALYTICS,
  Permission.VIEW_ALERTS,
  Permission.VIEW_STR_SAR,
  Permission.VIEW_TRAVEL_RULE,
  Permission.VIEW_FILINGS,
  Permission.VIEW_TAX,
  Permission.VIEW_SYSTEM_HEALTH,
];

const COMPLIANCE_OFFICER_PERMISSIONS: Permission[] = [
  Permission.VIEW_DASHBOARD,
  Permission.VIEW_TRANSACTIONS,
  Permission.VIEW_WALLETS,
  Permission.VIEW_COMPLIANCE,
  Permission.MANAGE_COMPLIANCE,
  Permission.VIEW_CASES,
  Permission.CREATE_CASES,
  Permission.MANAGE_CASES,
  Permission.VIEW_RISK,
  Permission.VIEW_ANALYTICS,
  Permission.EXPORT_DATA,
  Permission.VIEW_AUDIT_LOGS,
  Permission.VIEW_ALERTS,
  Permission.MANAGE_ALERT_RULES,
  Permission.VIEW_STR_SAR,
  Permission.CREATE_STR_SAR,
  Permission.APPROVE_STR_SAR,
  Permission.FILE_STR_SAR,
  Permission.VIEW_TRAVEL_RULE,
  Permission.MANAGE_TRAVEL_RULE,
  Permission.VIEW_FILINGS,
  Permission.MANAGE_FILINGS,
  Permission.VIEW_TAX,
  Permission.VIEW_SYSTEM_HEALTH,
];

const ANALYST_PERMISSIONS: Permission[] = [
  Permission.VIEW_DASHBOARD,
  Permission.VIEW_TRANSACTIONS,
  Permission.CREATE_TRANSACTION,
  Permission.VIEW_WALLETS,
  Permission.VIEW_COMPLIANCE,
  Permission.VIEW_CASES,
  Permission.CREATE_CASES,
  Permission.VIEW_RISK,
  Permission.VIEW_ANALYTICS,
  Permission.VIEW_ALERTS,
  Permission.VIEW_STR_SAR,
  Permission.CREATE_STR_SAR,
  Permission.VIEW_TRAVEL_RULE,
  Permission.VIEW_FILINGS,
  Permission.VIEW_TAX,
  Permission.VIEW_SYSTEM_HEALTH,
];

const AUDITOR_PERMISSIONS: Permission[] = [
  Permission.VIEW_DASHBOARD,
  Permission.VIEW_TRANSACTIONS,
  Permission.VIEW_WALLETS,
  Permission.VIEW_COMPLIANCE,
  Permission.VIEW_CASES,
  Permission.VIEW_RISK,
  Permission.VIEW_ANALYTICS,
  Permission.EXPORT_DATA,
  Permission.VIEW_AUDIT_LOGS,
  Permission.VIEW_ALERTS,
  Permission.VIEW_STR_SAR,
  Permission.VIEW_TRAVEL_RULE,
  Permission.VIEW_FILINGS,
  Permission.VIEW_TAX,
  Permission.VIEW_SYSTEM_HEALTH,
];

const defaultMatrix: RolePermissionMatrix = {
  [UserRole.ADMIN]: [...ALL_PERMISSIONS],
  [UserRole.COMPLIANCE_OFFICER]: COMPLIANCE_OFFICER_PERMISSIONS,
  [UserRole.ANALYST]: ANALYST_PERMISSIONS,
  [UserRole.AUDITOR]: AUDITOR_PERMISSIONS,
  [UserRole.USER]: VIEW_ONLY,
};

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

// Mutable copy of the role matrix (ADMIN is always frozen to ALL_PERMISSIONS)
const roleMatrix = new Map<UserRole, Permission[]>(
  Object.entries(defaultMatrix).map(([role, perms]) => [role as UserRole, [...perms]])
);

const overrides = new Map<string, UserPermissionOverride>(); // userId -> override

// ---------------------------------------------------------------------------
// Role Permissions
// ---------------------------------------------------------------------------

export function getRolePermissions(role: UserRole): Permission[] {
  return [...(roleMatrix.get(role) ?? [])];
}

export function getAllRolePermissions(): RolePermissionMatrix {
  const result = {} as RolePermissionMatrix;
  for (const role of Object.values(UserRole)) {
    result[role] = getRolePermissions(role);
  }
  return result;
}

export function updateRolePermissions(
  role: UserRole,
  permissions: Permission[],
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): Permission[] {
  if (role === UserRole.ADMIN) {
    const err = new Error('Cannot modify ADMIN role permissions') as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  roleMatrix.set(role, [...permissions]);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: 'RolePermissions',
    entityId: role,
    description: `Permissions updated for role ${role}`,
    metadata: { role, permissions },
  });

  logger.info('Role permissions updated', { role, count: permissions.length });
  return getRolePermissions(role);
}

// ---------------------------------------------------------------------------
// User Effective Permissions (role + overrides)
// ---------------------------------------------------------------------------

export function getUserEffectivePermissions(userId: string, userRole: UserRole): Permission[] {
  const base = new Set(getRolePermissions(userRole));
  const override = overrides.get(userId);

  if (override) {
    for (const p of override.granted) base.add(p);
    for (const p of override.revoked) base.delete(p);
  }

  return [...base];
}

export function checkPermission(
  userId: string,
  userRole: UserRole,
  permission: Permission
): boolean {
  return getUserEffectivePermissions(userId, userRole).includes(permission);
}

// ---------------------------------------------------------------------------
// User Permission Overrides
// ---------------------------------------------------------------------------

export function grantUserPermission(
  userId: string,
  permission: Permission,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): UserPermissionOverride {
  const existing = overrides.get(userId) ?? {
    userId,
    granted: [],
    revoked: [],
    updatedAt: new Date(),
    updatedBy: actorId,
  };

  if (!existing.granted.includes(permission)) {
    existing.granted.push(permission);
  }
  // Remove from revoked if present
  existing.revoked = existing.revoked.filter((p) => p !== permission);
  existing.updatedAt = new Date();
  existing.updatedBy = actorId;
  overrides.set(userId, existing);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.PERMISSION_GRANTED,
    entityType: 'UserPermission',
    entityId: userId,
    description: `Permission ${permission} granted to user ${userId}`,
    metadata: { permission },
  });

  return { ...existing };
}

export function revokeUserPermission(
  userId: string,
  permission: Permission,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): UserPermissionOverride {
  const existing = overrides.get(userId) ?? {
    userId,
    granted: [],
    revoked: [],
    updatedAt: new Date(),
    updatedBy: actorId,
  };

  if (!existing.revoked.includes(permission)) {
    existing.revoked.push(permission);
  }
  // Remove from granted if present
  existing.granted = existing.granted.filter((p) => p !== permission);
  existing.updatedAt = new Date();
  existing.updatedBy = actorId;
  overrides.set(userId, existing);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.PERMISSION_REVOKED,
    entityType: 'UserPermission',
    entityId: userId,
    description: `Permission ${permission} revoked from user ${userId}`,
    metadata: { permission },
  });

  return { ...existing };
}

export function getUserPermissionOverrides(userId: string): UserPermissionOverride | null {
  return overrides.get(userId) ?? null;
}

export function clearUserPermissionOverrides(
  userId: string,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): void {
  overrides.delete(userId);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.SETTINGS_CHANGED,
    entityType: 'UserPermission',
    entityId: userId,
    description: `All permission overrides cleared for user ${userId}`,
  });
}

export function getPermissionsList(): { permission: Permission; description: string }[] {
  const descriptions: Record<Permission, string> = {
    [Permission.VIEW_DASHBOARD]: 'View main dashboard',
    [Permission.VIEW_TRANSACTIONS]: 'View transactions',
    [Permission.CREATE_TRANSACTION]: 'Create transactions',
    [Permission.VIEW_WALLETS]: 'View wallets',
    [Permission.MANAGE_WALLETS]: 'Manage wallets',
    [Permission.VIEW_COMPLIANCE]: 'View compliance reports',
    [Permission.MANAGE_COMPLIANCE]: 'Manage compliance',
    [Permission.VIEW_CASES]: 'View investigation cases',
    [Permission.CREATE_CASES]: 'Create cases',
    [Permission.MANAGE_CASES]: 'Manage cases',
    [Permission.VIEW_RISK]: 'View risk assessments',
    [Permission.MANAGE_RISK]: 'Manage risk settings',
    [Permission.VIEW_ANALYTICS]: 'View analytics',
    [Permission.EXPORT_DATA]: 'Export data',
    [Permission.VIEW_AUDIT_LOGS]: 'View audit logs',
    [Permission.VIEW_ALERTS]: 'View alerts',
    [Permission.MANAGE_ALERT_RULES]: 'Manage alert rules',
    [Permission.VIEW_STR_SAR]: 'View STR/SAR reports',
    [Permission.CREATE_STR_SAR]: 'Create STR/SAR reports',
    [Permission.APPROVE_STR_SAR]: 'Approve STR/SAR reports',
    [Permission.FILE_STR_SAR]: 'File STR/SAR reports',
    [Permission.VIEW_TRAVEL_RULE]: 'View travel rule records',
    [Permission.MANAGE_TRAVEL_RULE]: 'Manage travel rule',
    [Permission.VIEW_FILINGS]: 'View regulatory filings',
    [Permission.MANAGE_FILINGS]: 'Manage regulatory filings',
    [Permission.VIEW_TAX]: 'View tax assessments',
    [Permission.MANAGE_TAX]: 'Manage tax settings',
    [Permission.VIEW_USERS]: 'View user list',
    [Permission.MANAGE_USERS]: 'Manage users',
    [Permission.MANAGE_ROLES]: 'Manage role permissions',
    [Permission.MANAGE_SYSTEM]: 'Manage system settings',
    [Permission.VIEW_SYSTEM_HEALTH]: 'View system health',
  };

  return Object.values(Permission).map((p) => ({ permission: p, description: descriptions[p] }));
}

// ---------------------------------------------------------------------------
// Exported stores for testing
// ---------------------------------------------------------------------------

export { roleMatrix as _roleMatrix, overrides as _overridesStore };
