/**
 * User Administration Service for CRYPTRAC
 * Full user CRUD, account status management, session tracking, activity logging.
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import {
  UserRole,
  UserStatus,
  UserProfile,
  UserSession,
  UserActivity,
  UserFilter,
  UserAdminStats,
  AuditAction,
} from '../types';
import * as auditService from './audit.service';
import { eventBus } from '../utils/eventBus';
import { logger } from '../utils/logger';

const BCRYPT_ROUNDS = 12;
const AUTO_LOCK_FAILURES = 5;
const AUTO_LOCK_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const users = new Map<string, UserProfile>();
const sessions = new Map<string, UserSession>();
const activityLog = new Map<string, UserActivity>();
const passwordStore = new Map<string, string>(); // userId -> bcrypt hash

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function throwNotFound(id: string): never {
  const err = new Error(`User not found: ${id}`) as Error & { statusCode: number };
  err.statusCode = 404;
  throw err;
}

function getUser(id: string): UserProfile {
  const user = users.get(id);
  if (!user) throwNotFound(id);
  return user!;
}

function updateUser(user: UserProfile): UserProfile {
  user.updatedAt = new Date();
  users.set(user.id, user);
  return user;
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export function getUsers(filter: UserFilter): {
  data: UserProfile[];
  total: number;
  page: number;
  pageSize: number;
} {
  let results = Array.from(users.values());

  if (filter.role) results = results.filter((u) => u.role === filter.role);
  if (filter.status) results = results.filter((u) => u.status === filter.status);
  if (filter.department) results = results.filter((u) => u.department === filter.department);
  if (filter.search) {
    const q = filter.search.toLowerCase();
    results = results.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q)
    );
  }

  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const total = results.length;
  const data = results.slice((page - 1) * pageSize, page * pageSize);
  return { data, total, page, pageSize };
}

export function getUserById(id: string): UserProfile {
  return getUser(id);
}

// ---------------------------------------------------------------------------
// Create / Update
// ---------------------------------------------------------------------------

export async function createUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department?: string;
  phone?: string;
  createdById: string;
  createdByEmail: string;
  createdByRole: UserRole;
}): Promise<UserProfile> {
  const existing = Array.from(users.values()).find(
    (u) => u.email.toLowerCase() === data.email.toLowerCase()
  );
  if (existing) {
    const err = new Error('A user with this email already exists') as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  const hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const now = new Date();
  const user: UserProfile = {
    id: uuidv4(),
    email: data.email.toLowerCase(),
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
    status: UserStatus.ACTIVE,
    department: data.department,
    phone: data.phone,
    failedLoginCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  users.set(user.id, user);
  passwordStore.set(user.id, hash);

  auditService.logAction({
    userId: data.createdById,
    userEmail: data.createdByEmail,
    userRole: data.createdByRole,
    action: AuditAction.USER_CREATED,
    entityType: 'User',
    entityId: user.id,
    description: `User ${user.email} created with role ${user.role}`,
    metadata: { role: user.role, department: data.department },
  });

  logUserActivity(user.id, 'USER_CREATED', `Account created by admin`);
  logger.info('User created', { userId: user.id, email: user.email });
  return user;
}

export function updateUserProfile(
  id: string,
  updates: Partial<Pick<UserProfile, 'firstName' | 'lastName' | 'department' | 'phone'>>,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): UserProfile {
  const user = getUser(id);
  Object.assign(user, updates);
  updateUser(user);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.USER_UPDATED,
    entityType: 'User',
    entityId: id,
    description: `User profile updated for ${user.email}`,
    metadata: { updates },
  });

  return user;
}

export function changeUserRole(
  id: string,
  newRole: UserRole,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): UserProfile {
  const user = getUser(id);
  const oldRole = user.role;
  user.role = newRole;
  updateUser(user);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.USER_ROLE_CHANGED,
    entityType: 'User',
    entityId: id,
    description: `User ${user.email} role changed from ${oldRole} to ${newRole}`,
    metadata: { oldRole, newRole },
  });

  logUserActivity(id, 'ROLE_CHANGED', `Role changed from ${oldRole} to ${newRole}`);

  eventBus.emit('user:role-changed', { userId: id, email: user.email, oldRole, newRole });
  return user;
}

// ---------------------------------------------------------------------------
// Account Status Management
// ---------------------------------------------------------------------------

export function suspendUser(
  id: string,
  reason: string,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): UserProfile {
  const user = getUser(id);
  user.status = UserStatus.SUSPENDED;
  user.suspendedAt = new Date();
  user.suspendedReason = reason;
  updateUser(user);

  // Terminate all sessions
  terminateAllSessions(id, actorId, actorEmail, actorRole);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.USER_SUSPENDED,
    entityType: 'User',
    entityId: id,
    description: `User ${user.email} suspended. Reason: ${reason}`,
    metadata: { reason },
  });

  logUserActivity(id, 'ACCOUNT_SUSPENDED', `Account suspended: ${reason}`);
  eventBus.emit('user:suspended', { userId: id, email: user.email, reason });
  return user;
}

export function reactivateUser(
  id: string,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): UserProfile {
  const user = getUser(id);
  user.status = UserStatus.ACTIVE;
  user.suspendedAt = undefined;
  user.suspendedReason = undefined;
  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  updateUser(user);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.USER_REACTIVATED,
    entityType: 'User',
    entityId: id,
    description: `User ${user.email} reactivated`,
  });

  logUserActivity(id, 'ACCOUNT_REACTIVATED', 'Account reactivated by admin');
  return user;
}

export function lockUser(
  id: string,
  durationMs: number | undefined,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): UserProfile {
  const user = getUser(id);
  user.status = UserStatus.LOCKED;
  user.lockedUntil = new Date(Date.now() + (durationMs ?? DEFAULT_LOCK_DURATION_MS));
  updateUser(user);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.USER_LOCKED,
    entityType: 'User',
    entityId: id,
    description: `User ${user.email} locked until ${user.lockedUntil?.toISOString()}`,
    metadata: { lockedUntil: user.lockedUntil },
  });

  logUserActivity(id, 'ACCOUNT_LOCKED', 'Account locked by admin');
  return user;
}

export function unlockUser(
  id: string,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): UserProfile {
  const user = getUser(id);
  user.status = UserStatus.ACTIVE;
  user.lockedUntil = undefined;
  user.failedLoginCount = 0;
  updateUser(user);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.USER_UNLOCKED,
    entityType: 'User',
    entityId: id,
    description: `User ${user.email} unlocked`,
  });

  logUserActivity(id, 'ACCOUNT_UNLOCKED', 'Account unlocked by admin');
  return user;
}

export function deactivateUser(
  id: string,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): UserProfile {
  const user = getUser(id);
  user.status = UserStatus.DEACTIVATED;
  user.deactivatedAt = new Date();
  updateUser(user);

  terminateAllSessions(id, actorId, actorEmail, actorRole);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.USER_DEACTIVATED,
    entityType: 'User',
    entityId: id,
    description: `User ${user.email} deactivated`,
  });

  logUserActivity(id, 'ACCOUNT_DEACTIVATED', 'Account deactivated by admin');
  eventBus.emit('user:deactivated', { userId: id, email: user.email });
  return user;
}

export async function resetUserPassword(
  id: string,
  newPassword: string,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): Promise<void> {
  const user = getUser(id);
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  passwordStore.set(id, hash);

  // Terminate all existing sessions
  terminateAllSessions(id, actorId, actorEmail, actorRole);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.USER_PASSWORD_RESET,
    entityType: 'User',
    entityId: id,
    description: `Password reset for user ${user.email}`,
  });

  logUserActivity(id, 'PASSWORD_RESET', 'Password reset by admin');
}

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

export function getUserSessions(userId: string): UserSession[] {
  getUser(userId); // verify exists
  return Array.from(sessions.values()).filter((s) => s.userId === userId);
}

export function terminateSession(
  userId: string,
  sessionId: string,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): void {
  const session = sessions.get(sessionId);
  if (!session || session.userId !== userId) {
    const err = new Error(`Session not found: ${sessionId}`) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }
  sessions.delete(sessionId);

  auditService.logAction({
    userId: actorId,
    userEmail: actorEmail,
    userRole: actorRole,
    action: AuditAction.SESSION_TERMINATED,
    entityType: 'UserSession',
    entityId: sessionId,
    description: `Session ${sessionId} terminated for user ${userId}`,
  });
}

export function terminateAllSessions(
  userId: string,
  actorId: string,
  actorEmail: string,
  actorRole: UserRole
): number {
  const userSessions = Array.from(sessions.values()).filter((s) => s.userId === userId);
  for (const s of userSessions) {
    sessions.delete(s.id);
  }

  if (userSessions.length > 0) {
    auditService.logAction({
      userId: actorId,
      userEmail: actorEmail,
      userRole: actorRole,
      action: AuditAction.SESSION_TERMINATED,
      entityType: 'UserSession',
      entityId: userId,
      description: `All ${userSessions.length} sessions terminated for user ${userId}`,
      metadata: { count: userSessions.length },
    });
  }

  return userSessions.length;
}

// ---------------------------------------------------------------------------
// Login Tracking
// ---------------------------------------------------------------------------

export function trackLogin(userId: string, ipAddress: string, userAgent: string): UserSession {
  const user = getUser(userId);
  user.lastLogin = new Date();
  user.failedLoginCount = 0;
  updateUser(user);

  const session: UserSession = {
    id: uuidv4(),
    userId,
    ipAddress,
    userAgent,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  };
  sessions.set(session.id, session);

  logUserActivity(userId, 'LOGIN', `Login from ${ipAddress}`, { ipAddress, userAgent });
  return session;
}

export function trackFailedLogin(userId: string, ipAddress: string): void {
  const user = users.get(userId);
  if (!user) return; // silent — email may be wrong, avoid leaking info

  const now = Date.now();
  // Reset counter if last failure was > 30 minutes ago
  if (user.lastFailedLogin && now - user.lastFailedLogin.getTime() > AUTO_LOCK_WINDOW_MS) {
    user.failedLoginCount = 0;
  }

  user.lastFailedLogin = new Date();
  user.failedLoginCount += 1;

  if (user.failedLoginCount >= AUTO_LOCK_FAILURES && user.status === UserStatus.ACTIVE) {
    user.status = UserStatus.LOCKED;
    user.lockedUntil = new Date(now + DEFAULT_LOCK_DURATION_MS);
    logger.warn('Account auto-locked after failed logins', {
      userId,
      failedCount: user.failedLoginCount,
    });

    eventBus.emit('security:account-locked', {
      userId,
      email: user.email,
      lockedUntil: user.lockedUntil,
      failedCount: user.failedLoginCount,
    });

    logUserActivity(userId, 'ACCOUNT_LOCKED', `Auto-locked after ${user.failedLoginCount} failed logins`, { ipAddress });
  }

  updateUser(user);
  eventBus.emit('security:failed-login', { userId, email: user.email, ipAddress });
  logUserActivity(userId, 'FAILED_LOGIN', `Failed login attempt from ${ipAddress}`, { ipAddress });
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export function getUserActivity(userId: string, page = 1, pageSize = 20): {
  data: UserActivity[];
  total: number;
  page: number;
  pageSize: number;
} {
  const results = Array.from(activityLog.values())
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const total = results.length;
  const data = results.slice((page - 1) * pageSize, page * pageSize);
  return { data, total, page, pageSize };
}

export function logUserActivity(
  userId: string,
  action: string,
  description: string,
  metadata?: Record<string, unknown>
): UserActivity {
  const entry: UserActivity = {
    id: uuidv4(),
    userId,
    action,
    description,
    metadata,
    timestamp: new Date(),
  };
  activityLog.set(entry.id, entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function getUserAdminStats(): UserAdminStats {
  const all = Array.from(users.values());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const byRole = {} as Record<UserRole, number>;
  const byStatus = {} as Record<UserStatus, number>;

  for (const role of Object.values(UserRole)) byRole[role] = 0;
  for (const status of Object.values(UserStatus)) byStatus[status] = 0;

  let activeToday = 0;
  let newThisMonth = 0;
  let lockedAccounts = 0;

  for (const u of all) {
    byRole[u.role] = (byRole[u.role] ?? 0) + 1;
    byStatus[u.status] = (byStatus[u.status] ?? 0) + 1;
    if (u.lastLogin && u.lastLogin >= today) activeToday++;
    if (u.createdAt >= monthStart) newThisMonth++;
    if (u.status === UserStatus.LOCKED) lockedAccounts++;
  }

  return {
    total: all.length,
    byRole,
    byStatus,
    activeToday,
    newThisMonth,
    lockedAccounts,
  };
}

// ---------------------------------------------------------------------------
// Exported stores for testing
// ---------------------------------------------------------------------------

export { users as _usersStore, sessions as _sessionsStore, activityLog as _activityLogStore };
