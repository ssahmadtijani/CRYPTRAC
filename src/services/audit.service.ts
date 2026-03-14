/**
 * Audit Service for CRYPTRAC
 * Provides comprehensive audit logging for all significant system actions.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AuditAction,
  AuditEntry,
  AuditFilter,
  AuditStats,
  UserRole,
} from '../types';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const auditLog = new Map<string, AuditEntry>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Records an audit entry for a significant system action.
 */
export function logAction(data: {
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
}): AuditEntry {
  const entry: AuditEntry = {
    id: uuidv4(),
    timestamp: new Date(),
    userId: data.userId,
    userEmail: data.userEmail,
    userRole: data.userRole,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    description: data.description,
    metadata: data.metadata ?? {},
  };

  auditLog.set(entry.id, entry);

  logger.info('Audit event recorded', {
    auditId: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    userId: entry.userId,
  });

  return entry;
}

/**
 * Returns a paginated, filtered list of audit entries (newest first).
 */
export function getAuditLog(filter: AuditFilter): {
  data: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
} {
  let results = Array.from(auditLog.values());

  if (filter.userId) results = results.filter((e) => e.userId === filter.userId);
  if (filter.action) results = results.filter((e) => e.action === filter.action);
  if (filter.entityType) results = results.filter((e) => e.entityType === filter.entityType);
  if (filter.entityId) results = results.filter((e) => e.entityId === filter.entityId);
  if (filter.startDate) {
    const start = filter.startDate instanceof Date ? filter.startDate : new Date(filter.startDate);
    results = results.filter((e) => e.timestamp >= start);
  }
  if (filter.endDate) {
    const end = filter.endDate instanceof Date ? filter.endDate : new Date(filter.endDate);
    results = results.filter((e) => e.timestamp <= end);
  }

  // Sort newest first
  results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const total = results.length;
  const data = results.slice((page - 1) * pageSize, page * pageSize);

  return { data, total, page, pageSize };
}

/**
 * Returns a single audit entry by ID.
 */
export function getAuditEntryById(id: string): AuditEntry {
  const entry = auditLog.get(id);
  if (!entry) {
    const err = new Error(`Audit entry not found: ${id}`) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }
  return entry;
}

/**
 * Returns aggregate statistics about audit activity.
 */
export function getAuditStats(userId?: string): AuditStats {
  let entries = Array.from(auditLog.values());
  if (userId) entries = entries.filter((e) => e.userId === userId);

  const byAction: Record<string, number> = {};
  const byEntityType: Record<string, number> = {};
  const byUser: Record<string, number> = {};

  for (const e of entries) {
    byAction[e.action] = (byAction[e.action] ?? 0) + 1;
    byEntityType[e.entityType] = (byEntityType[e.entityType] ?? 0) + 1;
    byUser[e.userId] = (byUser[e.userId] ?? 0) + 1;
  }

  // 10 most recent entries
  const recentActivity = [...entries]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10);

  return {
    total: entries.length,
    byAction,
    byEntityType,
    byUser,
    recentActivity,
  };
}

/**
 * Returns all audit entries for export (unfiltered, newest-first).
 * Accepts an optional filter to narrow the export scope.
 */
export function getAllAuditEntries(filter?: Omit<AuditFilter, 'page' | 'pageSize'>): AuditEntry[] {
  let results = Array.from(auditLog.values());

  if (filter?.userId) results = results.filter((e) => e.userId === filter.userId);
  if (filter?.action) results = results.filter((e) => e.action === filter.action);
  if (filter?.entityType) results = results.filter((e) => e.entityType === filter.entityType);
  if (filter?.entityId) results = results.filter((e) => e.entityId === filter.entityId);
  if (filter?.startDate) {
    const start =
      filter.startDate instanceof Date ? filter.startDate : new Date(filter.startDate);
    results = results.filter((e) => e.timestamp >= start);
  }
  if (filter?.endDate) {
    const end = filter.endDate instanceof Date ? filter.endDate : new Date(filter.endDate);
    results = results.filter((e) => e.timestamp <= end);
  }

  return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Exported for testing
export { auditLog as _auditLogStore };
