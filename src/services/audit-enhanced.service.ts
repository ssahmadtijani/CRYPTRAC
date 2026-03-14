/**
 * Enhanced Audit Service for CRYPTRAC
 * Wraps the base audit.service with richer filtering, metrics, and compliance reporting.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AuditAction,
  AuditEntry,
  AuditLogFilter,
  AuditLogEntry,
  AuditDashboardMetrics,
  AuditComplianceReport,
  AuditSeverity,
  UserRole,
} from '../types';
import * as baseAudit from './audit.service';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Severity classification
// ---------------------------------------------------------------------------

const CRITICAL_ACTIONS: AuditAction[] = [
  AuditAction.USER_SUSPENDED,
  AuditAction.USER_DEACTIVATED,
  AuditAction.USER_ROLE_CHANGED,
  AuditAction.USER_PASSWORD_RESET,
  AuditAction.PERMISSION_GRANTED,
  AuditAction.PERMISSION_REVOKED,
  AuditAction.SESSION_TERMINATED,
  AuditAction.STR_SAR_FILED,
  AuditAction.STR_SAR_APPROVED,
  AuditAction.SETTINGS_CHANGED,
];

const WARNING_ACTIONS: AuditAction[] = [
  AuditAction.USER_LOCKED,
  AuditAction.USER_UNLOCKED,
  AuditAction.USER_CREATED,
  AuditAction.STR_SAR_CREATED,
  AuditAction.STR_SAR_SUBMITTED,
  AuditAction.STR_SAR_AMENDED,
  AuditAction.FILING_FILED,
  AuditAction.CASE_STATUS_CHANGED,
  AuditAction.COMPLIANCE_REPORT_FILED,
  AuditAction.SANCTIONS_CHECK,
];

export function classifySeverity(action: AuditAction): AuditSeverity {
  if (CRITICAL_ACTIONS.includes(action)) return 'CRITICAL';
  if (WARNING_ACTIONS.includes(action)) return 'WARNING';
  return 'INFO';
}

function enrichEntry(entry: AuditEntry): AuditLogEntry {
  return { ...entry, severity: classifySeverity(entry.action) };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function applyFilter(entries: AuditEntry[], filter: AuditLogFilter): AuditEntry[] {
  let results = [...entries];

  if (filter.userId) results = results.filter((e) => e.userId === filter.userId);
  if (filter.action) results = results.filter((e) => e.action === filter.action);
  if (filter.entityType) results = results.filter((e) => e.entityType === filter.entityType);
  if (filter.startDate) {
    const d = filter.startDate instanceof Date ? filter.startDate : new Date(filter.startDate);
    results = results.filter((e) => e.timestamp >= d);
  }
  if (filter.endDate) {
    const d = filter.endDate instanceof Date ? filter.endDate : new Date(filter.endDate);
    results = results.filter((e) => e.timestamp <= d);
  }
  if (filter.search) {
    const q = filter.search.toLowerCase();
    results = results.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.userEmail.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q)
    );
  }
  if (filter.severity) {
    results = results.filter((e) => classifySeverity(e.action) === filter.severity);
  }

  return results;
}

function sortEntries(entries: AuditEntry[], sortBy: AuditLogFilter['sortBy'], sortOrder: 'asc' | 'desc'): AuditEntry[] {
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    if (sortBy === 'action') return dir * a.action.localeCompare(b.action);
    if (sortBy === 'severity') {
      const order = { CRITICAL: 3, WARNING: 2, INFO: 1 };
      return dir * (order[classifySeverity(a.action)] - order[classifySeverity(b.action)]);
    }
    // default: timestamp
    return dir * (a.timestamp.getTime() - b.timestamp.getTime());
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getEnhancedAuditLogs(filter: AuditLogFilter): {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
} {
  const all = baseAudit.getAllAuditEntries();
  let results = applyFilter(all, filter);
  results = sortEntries(results, filter.sortBy ?? 'timestamp', filter.sortOrder ?? 'desc');

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const total = results.length;
  const data = results
    .slice((page - 1) * pageSize, page * pageSize)
    .map(enrichEntry);

  return { data, total, page, pageSize };
}

export function getAuditDashboardMetrics(): AuditDashboardMetrics {
  const all = baseAudit.getAllAuditEntries();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const todayLogs = all.filter((e) => e.timestamp >= todayStart).length;
  const criticalEvents = all.filter((e) => classifySeverity(e.action) === 'CRITICAL').length;

  const uniqueUsers = new Set(all.map((e) => e.userId)).size;

  // Top actions
  const actionCounts: Record<string, number> = {};
  for (const e of all) {
    actionCounts[e.action] = (actionCounts[e.action] ?? 0) + 1;
  }
  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([action, count]) => ({ action, count }));

  // Activity by hour (last 24h)
  const activityByHour: { hour: number; count: number }[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }));
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  for (const e of all) {
    if (e.timestamp >= dayAgo) {
      activityByHour[e.timestamp.getHours()].count++;
    }
  }

  // Activity by day (last 7 days)
  const activityByDay: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const nextD = new Date(d);
    nextD.setDate(d.getDate() + 1);
    const count = all.filter((e) => e.timestamp >= d && e.timestamp < nextD).length;
    activityByDay.push({ date: d.toISOString().split('T')[0], count });
  }

  return {
    totalLogs: all.length,
    todayLogs,
    criticalEvents,
    uniqueUsers,
    topActions,
    activityByHour,
    activityByDay,
  };
}

export function getAuditTimeline(
  startDate?: Date,
  endDate?: Date,
  limit = 50
): AuditLogEntry[] {
  const all = baseAudit.getAllAuditEntries();
  let results = all;
  if (startDate) results = results.filter((e) => e.timestamp >= startDate);
  if (endDate) results = results.filter((e) => e.timestamp <= endDate);
  return results
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .slice(0, limit)
    .map(enrichEntry);
}

export function getAuditLogById(id: string): AuditLogEntry {
  const entry = baseAudit.getAuditEntryById(id);
  return enrichEntry(entry);
}

export function generateComplianceReport(
  startDate: Date,
  endDate: Date,
  generatedBy: string
): AuditComplianceReport {
  const all = baseAudit.getAllAuditEntries();
  const entries = all.filter((e) => e.timestamp >= startDate && e.timestamp <= endDate);
  const enriched = entries.map(enrichEntry);

  const criticalEvents = enriched.filter((e) => e.severity === 'CRITICAL');

  // User summary
  const userMap: Record<string, { email: string; count: number }> = {};
  for (const e of entries) {
    if (!userMap[e.userId]) userMap[e.userId] = { email: e.userEmail, count: 0 };
    userMap[e.userId].count++;
  }
  const userSummary = Object.entries(userMap).map(([userId, v]) => ({
    userId,
    email: v.email,
    eventCount: v.count,
  }));

  // Action summary
  const actionMap: Record<string, number> = {};
  for (const e of entries) {
    actionMap[e.action] = (actionMap[e.action] ?? 0) + 1;
  }
  const actionSummary = Object.entries(actionMap).map(([action, count]) => ({ action, count }));

  const report: AuditComplianceReport = {
    id: uuidv4(),
    generatedAt: new Date(),
    generatedBy,
    startDate,
    endDate,
    totalEvents: entries.length,
    criticalEvents: criticalEvents.length,
    userSummary,
    actionSummary,
    securityEvents: criticalEvents,
  };

  logger.info('Compliance report generated', {
    reportId: report.id,
    totalEvents: report.totalEvents,
    startDate,
    endDate,
  });

  return report;
}

export function getSecurityEvents(limit = 100): AuditLogEntry[] {
  const all = baseAudit.getAllAuditEntries();
  return all
    .filter((e) => classifySeverity(e.action) === 'CRITICAL')
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
    .map(enrichEntry);
}

export function getUserAuditTrail(userId: string, page = 1, pageSize = 20): {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
} {
  return getEnhancedAuditLogs({ userId, page, pageSize });
}

export function logEnhancedAction(data: {
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
}): AuditLogEntry {
  const entry = baseAudit.logAction(data);
  return enrichEntry(entry);
}
