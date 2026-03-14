/**
 * Enhanced Audit Service Tests for CRYPTRAC
 */

import {
  classifySeverity,
  getEnhancedAuditLogs,
  getAuditDashboardMetrics,
  getAuditTimeline,
  getAuditLogById,
  generateComplianceReport,
  getSecurityEvents,
  getUserAuditTrail,
  logEnhancedAction,
} from '../audit-enhanced.service';
import { _auditLogStore } from '../audit.service';
import { AuditAction, UserRole } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearAuditLog(): void {
  _auditLogStore.clear();
}

function makeEntry(overrides: Partial<Parameters<typeof logEnhancedAction>[0]> = {}) {
  return logEnhancedAction({
    userId: 'user-1',
    userEmail: 'user@test.com',
    userRole: UserRole.ANALYST,
    action: AuditAction.DATA_ACCESSED,
    entityType: 'Transaction',
    entityId: 'tx-1',
    description: 'Test entry',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Audit Enhanced Service', () => {
  beforeEach(clearAuditLog);

  // -------------------------------------------------------------------------
  // classifySeverity
  // -------------------------------------------------------------------------

  describe('classifySeverity', () => {
    it('should classify USER_SUSPENDED as CRITICAL', () => {
      expect(classifySeverity(AuditAction.USER_SUSPENDED)).toBe('CRITICAL');
    });

    it('should classify USER_LOCKED as WARNING', () => {
      expect(classifySeverity(AuditAction.USER_LOCKED)).toBe('WARNING');
    });

    it('should classify DATA_ACCESSED as INFO', () => {
      expect(classifySeverity(AuditAction.DATA_ACCESSED)).toBe('INFO');
    });
  });

  // -------------------------------------------------------------------------
  // logEnhancedAction
  // -------------------------------------------------------------------------

  describe('logEnhancedAction', () => {
    it('should return entry with severity field', () => {
      const entry = makeEntry({ action: AuditAction.SETTINGS_CHANGED });
      expect(entry.severity).toBe('CRITICAL');
      expect(entry.id).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // getEnhancedAuditLogs
  // -------------------------------------------------------------------------

  describe('getEnhancedAuditLogs', () => {
    it('should return paginated results', () => {
      makeEntry();
      makeEntry();
      const result = getEnhancedAuditLogs({ page: 1, pageSize: 10 });
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('should filter by userId', () => {
      makeEntry({ userId: 'u1' });
      makeEntry({ userId: 'u2' });
      const result = getEnhancedAuditLogs({ userId: 'u1' });
      expect(result.data.every((e) => e.userId === 'u1')).toBe(true);
    });

    it('should filter by severity', () => {
      makeEntry({ action: AuditAction.USER_SUSPENDED });
      makeEntry({ action: AuditAction.DATA_ACCESSED });
      const result = getEnhancedAuditLogs({ severity: 'CRITICAL' });
      expect(result.data.every((e) => e.severity === 'CRITICAL')).toBe(true);
    });

    it('should filter by search term', () => {
      makeEntry({ description: 'Important event' });
      makeEntry({ description: 'Routine check' });
      const result = getEnhancedAuditLogs({ search: 'important' });
      expect(result.total).toBe(1);
    });

    it('should sort by timestamp asc', () => {
      makeEntry({ action: AuditAction.DATA_ACCESSED });
      makeEntry({ action: AuditAction.USER_LOGIN });
      const result = getEnhancedAuditLogs({ sortBy: 'timestamp', sortOrder: 'asc' });
      expect(result.data).toHaveLength(2);
      expect(result.data[0].timestamp.getTime()).toBeLessThanOrEqual(result.data[1].timestamp.getTime());
    });
  });

  // -------------------------------------------------------------------------
  // getAuditDashboardMetrics
  // -------------------------------------------------------------------------

  describe('getAuditDashboardMetrics', () => {
    it('should return correct metrics structure', () => {
      makeEntry();
      makeEntry({ action: AuditAction.USER_SUSPENDED });
      const metrics = getAuditDashboardMetrics();
      expect(metrics.totalLogs).toBe(2);
      expect(metrics.criticalEvents).toBe(1);
      expect(metrics.uniqueUsers).toBeGreaterThan(0);
      expect(metrics.topActions.length).toBeGreaterThan(0);
      expect(metrics.activityByHour).toHaveLength(24);
      expect(metrics.activityByDay).toHaveLength(7);
    });
  });

  // -------------------------------------------------------------------------
  // getAuditTimeline
  // -------------------------------------------------------------------------

  describe('getAuditTimeline', () => {
    it('should return entries sorted ascending by timestamp', () => {
      makeEntry();
      makeEntry();
      const timeline = getAuditTimeline();
      if (timeline.length >= 2) {
        expect(timeline[0].timestamp.getTime()).toBeLessThanOrEqual(timeline[1].timestamp.getTime());
      }
    });

    it('should respect limit', () => {
      for (let i = 0; i < 10; i++) makeEntry();
      const timeline = getAuditTimeline(undefined, undefined, 5);
      expect(timeline.length).toBeLessThanOrEqual(5);
    });
  });

  // -------------------------------------------------------------------------
  // getAuditLogById
  // -------------------------------------------------------------------------

  describe('getAuditLogById', () => {
    it('should return entry with severity', () => {
      const entry = makeEntry();
      const found = getAuditLogById(entry.id);
      expect(found.id).toBe(entry.id);
      expect(found.severity).toBeDefined();
    });

    it('should throw 404 for unknown id', () => {
      expect(() => getAuditLogById('nonexistent')).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // generateComplianceReport
  // -------------------------------------------------------------------------

  describe('generateComplianceReport', () => {
    it('should generate a report with correct counts', () => {
      makeEntry({ action: AuditAction.USER_SUSPENDED });
      makeEntry({ action: AuditAction.DATA_ACCESSED });
      const start = new Date(Date.now() - 60_000);
      const end = new Date(Date.now() + 60_000);
      const report = generateComplianceReport(start, end, 'admin-1');
      expect(report.totalEvents).toBe(2);
      expect(report.criticalEvents).toBe(1);
      expect(report.userSummary.length).toBeGreaterThan(0);
      expect(report.securityEvents).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // getSecurityEvents
  // -------------------------------------------------------------------------

  describe('getSecurityEvents', () => {
    it('should return only CRITICAL events', () => {
      makeEntry({ action: AuditAction.USER_SUSPENDED });
      makeEntry({ action: AuditAction.DATA_ACCESSED });
      const events = getSecurityEvents();
      expect(events.every((e) => e.severity === 'CRITICAL')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getUserAuditTrail
  // -------------------------------------------------------------------------

  describe('getUserAuditTrail', () => {
    it('should return only entries for the given user', () => {
      makeEntry({ userId: 'u-trail' });
      makeEntry({ userId: 'u-other' });
      const result = getUserAuditTrail('u-trail');
      expect(result.data.every((e) => e.userId === 'u-trail')).toBe(true);
    });
  });
});
