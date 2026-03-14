/**
 * User Admin Service Tests for CRYPTRAC
 */

import {
  createUser,
  getUserById,
  getUsers,
  updateUserProfile,
  changeUserRole,
  suspendUser,
  reactivateUser,
  lockUser,
  unlockUser,
  deactivateUser,
  resetUserPassword,
  getUserSessions,
  terminateSession,
  terminateAllSessions,
  trackLogin,
  trackFailedLogin,
  getUserActivity,
  getUserAdminStats,
  _usersStore,
  _sessionsStore,
  _activityLogStore,
} from '../user-admin.service';
import { UserRole, UserStatus } from '../../types';

jest.mock('../audit.service', () => ({
  logAction: jest.fn(),
}));

jest.mock('../../utils/eventBus', () => ({
  eventBus: { emit: jest.fn(), on: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStores(): void {
  _usersStore.clear();
  _sessionsStore.clear();
  _activityLogStore.clear();
}

const actorCtx = {
  actorId: 'admin-1',
  actorEmail: 'admin@test.com',
  actorRole: UserRole.ADMIN,
};

async function makeUser(overrides: Partial<Parameters<typeof createUser>[0]> = {}) {
  return createUser({
    email: `user-${Date.now()}@example.com`,
    password: 'Password1!',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.ANALYST,
    createdById: actorCtx.actorId,
    createdByEmail: actorCtx.actorEmail,
    createdByRole: actorCtx.actorRole,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('User Admin Service', () => {
  beforeEach(clearStores);

  // -------------------------------------------------------------------------
  // createUser
  // -------------------------------------------------------------------------

  describe('createUser', () => {
    it('should create a user with ACTIVE status', async () => {
      const user = await makeUser();
      expect(user.id).toBeDefined();
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.failedLoginCount).toBe(0);
    });

    it('should reject duplicate email', async () => {
      await makeUser({ email: 'dup@example.com' });
      await expect(makeUser({ email: 'dup@example.com' })).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // -------------------------------------------------------------------------
  // getUserById
  // -------------------------------------------------------------------------

  describe('getUserById', () => {
    it('should return a user by id', async () => {
      const created = await makeUser();
      const found = getUserById(created.id);
      expect(found.id).toBe(created.id);
    });

    it('should throw 404 for unknown id', () => {
      expect(() => getUserById('nonexistent')).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getUsers
  // -------------------------------------------------------------------------

  describe('getUsers', () => {
    it('should return paginated results', async () => {
      await makeUser({ email: 'a@example.com' });
      await makeUser({ email: 'b@example.com' });
      const result = getUsers({ page: 1, pageSize: 10 });
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('should filter by role', async () => {
      await makeUser({ email: 'admin@example.com', role: UserRole.ADMIN });
      await makeUser({ email: 'analyst@example.com', role: UserRole.ANALYST });
      const result = getUsers({ role: UserRole.ADMIN });
      expect(result.data.every((u) => u.role === UserRole.ADMIN)).toBe(true);
    });

    it('should filter by search', async () => {
      await makeUser({ email: 'alice@example.com', firstName: 'Alice' });
      await makeUser({ email: 'bob@example.com', firstName: 'Bob' });
      const result = getUsers({ search: 'alice' });
      expect(result.data).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // updateUserProfile
  // -------------------------------------------------------------------------

  describe('updateUserProfile', () => {
    it('should update profile fields', async () => {
      const user = await makeUser();
      const updated = updateUserProfile(user.id, { firstName: 'Updated', department: 'Finance' }, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(updated.firstName).toBe('Updated');
      expect(updated.department).toBe('Finance');
    });
  });

  // -------------------------------------------------------------------------
  // changeUserRole
  // -------------------------------------------------------------------------

  describe('changeUserRole', () => {
    it('should change user role', async () => {
      const user = await makeUser({ role: UserRole.ANALYST });
      const updated = changeUserRole(user.id, UserRole.AUDITOR, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(updated.role).toBe(UserRole.AUDITOR);
    });
  });

  // -------------------------------------------------------------------------
  // suspendUser / reactivateUser
  // -------------------------------------------------------------------------

  describe('suspendUser / reactivateUser', () => {
    it('should suspend a user', async () => {
      const user = await makeUser();
      const suspended = suspendUser(user.id, 'Policy violation', actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(suspended.status).toBe(UserStatus.SUSPENDED);
      expect(suspended.suspendedReason).toBe('Policy violation');
    });

    it('should reactivate a suspended user', async () => {
      const user = await makeUser();
      suspendUser(user.id, 'test', actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      const reactivated = reactivateUser(user.id, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(reactivated.status).toBe(UserStatus.ACTIVE);
      expect(reactivated.failedLoginCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // lockUser / unlockUser
  // -------------------------------------------------------------------------

  describe('lockUser / unlockUser', () => {
    it('should lock a user', async () => {
      const user = await makeUser();
      const locked = lockUser(user.id, 60_000, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(locked.status).toBe(UserStatus.LOCKED);
      expect(locked.lockedUntil).toBeDefined();
    });

    it('should unlock a user', async () => {
      const user = await makeUser();
      lockUser(user.id, 60_000, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      const unlocked = unlockUser(user.id, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(unlocked.status).toBe(UserStatus.ACTIVE);
      expect(unlocked.lockedUntil).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // deactivateUser
  // -------------------------------------------------------------------------

  describe('deactivateUser', () => {
    it('should deactivate a user', async () => {
      const user = await makeUser();
      const deactivated = deactivateUser(user.id, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(deactivated.status).toBe(UserStatus.DEACTIVATED);
      expect(deactivated.deactivatedAt).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  describe('sessions', () => {
    it('should track login and create a session', async () => {
      const user = await makeUser();
      const session = trackLogin(user.id, '127.0.0.1', 'TestAgent');
      expect(session.id).toBeDefined();
      expect(session.userId).toBe(user.id);
    });

    it('should list user sessions', async () => {
      const user = await makeUser();
      trackLogin(user.id, '127.0.0.1', 'Agent1');
      trackLogin(user.id, '10.0.0.1', 'Agent2');
      const sessions = getUserSessions(user.id);
      expect(sessions).toHaveLength(2);
    });

    it('should terminate all sessions', async () => {
      const user = await makeUser();
      trackLogin(user.id, '127.0.0.1', 'Agent1');
      trackLogin(user.id, '10.0.0.1', 'Agent2');
      const count = terminateAllSessions(user.id, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(count).toBe(2);
      expect(getUserSessions(user.id)).toHaveLength(0);
    });

    it('should terminate a specific session', async () => {
      const user = await makeUser();
      const session = trackLogin(user.id, '127.0.0.1', 'Agent1');
      terminateSession(user.id, session.id, actorCtx.actorId, actorCtx.actorEmail, actorCtx.actorRole);
      expect(getUserSessions(user.id)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // trackFailedLogin (auto-lock)
  // -------------------------------------------------------------------------

  describe('trackFailedLogin', () => {
    it('should auto-lock after 5 failures', async () => {
      const user = await makeUser();
      for (let i = 0; i < 5; i++) {
        trackFailedLogin(user.id, '127.0.0.1');
      }
      const updated = getUserById(user.id);
      expect(updated.status).toBe(UserStatus.LOCKED);
      expect(updated.lockedUntil).toBeDefined();
    });

    it('should be silent for unknown userId', () => {
      expect(() => trackFailedLogin('unknown', '127.0.0.1')).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getUserAdminStats
  // -------------------------------------------------------------------------

  describe('getUserAdminStats', () => {
    it('should return correct counts', async () => {
      await makeUser({ role: UserRole.ADMIN });
      await makeUser({ role: UserRole.ANALYST });
      const stats = getUserAdminStats();
      expect(stats.total).toBe(2);
      expect(stats.byRole[UserRole.ADMIN]).toBe(1);
      expect(stats.byRole[UserRole.ANALYST]).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // getUserActivity
  // -------------------------------------------------------------------------

  describe('getUserActivity', () => {
    it('should return activity entries after login', async () => {
      const user = await makeUser();
      trackLogin(user.id, '127.0.0.1', 'Agent');
      const result = getUserActivity(user.id);
      expect(result.total).toBeGreaterThan(0);
    });
  });
});
