/**
 * Role-Permission Service Tests for CRYPTRAC
 */

import {
  getRolePermissions,
  getAllRolePermissions,
  updateRolePermissions,
  getUserEffectivePermissions,
  checkPermission,
  grantUserPermission,
  revokeUserPermission,
  getUserPermissionOverrides,
  clearUserPermissionOverrides,
  getPermissionsList,
  _roleMatrix,
  _overridesStore,
} from '../role-permission.service';
import { UserRole, Permission } from '../../types';

jest.mock('../audit.service', () => ({
  logAction: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStores(): void {
  // Reset role matrix to defaults by re-importing the module is not easily possible,
  // so we test idempotent operations and restore after mutation tests.
  _overridesStore.clear();
}

const actorCtx = {
  actorId: 'admin-1',
  actorEmail: 'admin@test.com',
  actorRole: UserRole.ADMIN,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Role-Permission Service', () => {
  beforeEach(resetStores);

  // -------------------------------------------------------------------------
  // getRolePermissions
  // -------------------------------------------------------------------------

  describe('getRolePermissions', () => {
    it('should return permissions for ADMIN (all permissions)', () => {
      const perms = getRolePermissions(UserRole.ADMIN);
      expect(perms.length).toBe(Object.values(Permission).length);
    });

    it('should return permissions for ANALYST', () => {
      const perms = getRolePermissions(UserRole.ANALYST);
      expect(perms).toContain(Permission.VIEW_DASHBOARD);
      expect(perms).toContain(Permission.VIEW_TRANSACTIONS);
    });

    it('should return permissions for USER (viewer)', () => {
      const perms = getRolePermissions(UserRole.USER);
      expect(perms).toContain(Permission.VIEW_DASHBOARD);
      expect(perms).not.toContain(Permission.MANAGE_USERS);
    });
  });

  // -------------------------------------------------------------------------
  // getAllRolePermissions
  // -------------------------------------------------------------------------

  describe('getAllRolePermissions', () => {
    it('should return matrix for all roles', () => {
      const matrix = getAllRolePermissions();
      for (const role of Object.values(UserRole)) {
        expect(matrix[role]).toBeDefined();
        expect(Array.isArray(matrix[role])).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // updateRolePermissions
  // -------------------------------------------------------------------------

  describe('updateRolePermissions', () => {
    it('should update permissions for ANALYST', () => {
      const newPerms = [Permission.VIEW_DASHBOARD, Permission.VIEW_TRANSACTIONS];
      const updated = updateRolePermissions(UserRole.ANALYST, newPerms, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(updated).toEqual(newPerms);
      // restore
      updateRolePermissions(UserRole.ANALYST, getRolePermissions(UserRole.ANALYST), actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
    });

    it('should throw 403 when trying to modify ADMIN permissions', () => {
      expect(() =>
        updateRolePermissions(UserRole.ADMIN, [], actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole)
      ).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getUserEffectivePermissions
  // -------------------------------------------------------------------------

  describe('getUserEffectivePermissions', () => {
    it('should return base role permissions when no overrides', () => {
      const perms = getUserEffectivePermissions('user-1', UserRole.ANALYST);
      expect(perms).toEqual(getRolePermissions(UserRole.ANALYST));
    });

    it('should include granted overrides', () => {
      grantUserPermission('user-1', Permission.MANAGE_USERS, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      const perms = getUserEffectivePermissions('user-1', UserRole.ANALYST);
      expect(perms).toContain(Permission.MANAGE_USERS);
    });

    it('should exclude revoked permissions', () => {
      revokeUserPermission('user-2', Permission.VIEW_DASHBOARD, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      const perms = getUserEffectivePermissions('user-2', UserRole.ANALYST);
      expect(perms).not.toContain(Permission.VIEW_DASHBOARD);
    });
  });

  // -------------------------------------------------------------------------
  // checkPermission
  // -------------------------------------------------------------------------

  describe('checkPermission', () => {
    it('should return true for a permission in role', () => {
      expect(checkPermission('u1', UserRole.ADMIN, Permission.MANAGE_USERS)).toBe(true);
    });

    it('should return false for a permission not in role', () => {
      expect(checkPermission('u1', UserRole.USER, Permission.MANAGE_USERS)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // grantUserPermission / revokeUserPermission
  // -------------------------------------------------------------------------

  describe('grantUserPermission', () => {
    it('should add permission to granted list', () => {
      const override = grantUserPermission('u-grant', Permission.EXPORT_DATA, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(override.granted).toContain(Permission.EXPORT_DATA);
    });

    it('should not duplicate permissions', () => {
      grantUserPermission('u-dedup', Permission.EXPORT_DATA, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      const override = grantUserPermission('u-dedup', Permission.EXPORT_DATA, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      const count = override.granted.filter((p) => p === Permission.EXPORT_DATA).length;
      expect(count).toBe(1);
    });
  });

  describe('revokeUserPermission', () => {
    it('should add permission to revoked list', () => {
      const override = revokeUserPermission('u-revoke', Permission.VIEW_DASHBOARD, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(override.revoked).toContain(Permission.VIEW_DASHBOARD);
    });

    it('should remove from granted when revoked', () => {
      grantUserPermission('u-cross', Permission.VIEW_ANALYTICS, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      const override = revokeUserPermission('u-cross', Permission.VIEW_ANALYTICS, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(override.granted).not.toContain(Permission.VIEW_ANALYTICS);
    });
  });

  // -------------------------------------------------------------------------
  // getUserPermissionOverrides
  // -------------------------------------------------------------------------

  describe('getUserPermissionOverrides', () => {
    it('should return null when no overrides exist', () => {
      expect(getUserPermissionOverrides('no-override')).toBeNull();
    });

    it('should return override after grant', () => {
      grantUserPermission('u-ov', Permission.VIEW_TAX, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      const ov = getUserPermissionOverrides('u-ov');
      expect(ov).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // clearUserPermissionOverrides
  // -------------------------------------------------------------------------

  describe('clearUserPermissionOverrides', () => {
    it('should clear all overrides', () => {
      grantUserPermission('u-clear', Permission.MANAGE_TAX, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      clearUserPermissionOverrides('u-clear', actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(getUserPermissionOverrides('u-clear')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getPermissionsList
  // -------------------------------------------------------------------------

  describe('getPermissionsList', () => {
    it('should return all 32 permissions', () => {
      const list = getPermissionsList();
      expect(list).toHaveLength(Object.values(Permission).length);
    });

    it('should include description for each permission', () => {
      const list = getPermissionsList();
      for (const item of list) {
        expect(item.description).toBeTruthy();
      }
    });
  });
});
