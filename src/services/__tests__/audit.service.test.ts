/**
 * Audit Service Tests for CRYPTRAC
 */

import {
  logAction,
  getAuditLog,
  getAuditEntryById,
  getAuditStats,
  getAllAuditEntries,
  _auditLogStore,
} from '../audit.service';
import { AuditAction, UserRole } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStore(): void {
  _auditLogStore.clear();
}

function makeLogActionInput(overrides?: Partial<Parameters<typeof logAction>[0]>): Parameters<typeof logAction>[0] {
  return {
    userId: 'user-1',
    userEmail: 'admin@test.com',
    userRole: UserRole.ADMIN,
    action: AuditAction.USER_LOGIN,
    entityType: 'User',
    entityId: 'user-1',
    description: 'User logged in',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Audit Service', () => {
  beforeEach(clearStore);

  // -----------------------------------------------------------------------
  // logAction
  // -----------------------------------------------------------------------

  describe('logAction', () => {
    it('should create an audit entry with a UUID and timestamp', () => {
      const entry = logAction(makeLogActionInput());

      expect(entry.id).toBeDefined();
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it('should store all provided fields correctly', () => {
      const input = makeLogActionInput({
        userId: 'user-42',
        userEmail: 'officer@cryptrac.io',
        userRole: UserRole.COMPLIANCE_OFFICER,
        action: AuditAction.CASE_CREATED,
        entityType: 'Case',
        entityId: 'case-99',
        description: 'Case created by compliance officer',
        metadata: { caseNumber: 'CASE-2024-00001' },
      });

      const entry = logAction(input);

      expect(entry.userId).toBe('user-42');
      expect(entry.userEmail).toBe('officer@cryptrac.io');
      expect(entry.userRole).toBe(UserRole.COMPLIANCE_OFFICER);
      expect(entry.action).toBe(AuditAction.CASE_CREATED);
      expect(entry.entityType).toBe('Case');
      expect(entry.entityId).toBe('case-99');
      expect(entry.description).toBe('Case created by compliance officer');
      expect(entry.metadata).toEqual({ caseNumber: 'CASE-2024-00001' });
    });

    it('should default metadata to an empty object when not provided', () => {
      const entry = logAction(makeLogActionInput({ metadata: undefined }));
      expect(entry.metadata).toEqual({});
    });

    it('should persist entry in the in-memory store', () => {
      const entry = logAction(makeLogActionInput());
      expect(_auditLogStore.has(entry.id)).toBe(true);
    });

    it('should create unique IDs for each entry', () => {
      const e1 = logAction(makeLogActionInput());
      const e2 = logAction(makeLogActionInput());
      expect(e1.id).not.toBe(e2.id);
    });
  });

  // -----------------------------------------------------------------------
  // getAuditEntryById
  // -----------------------------------------------------------------------

  describe('getAuditEntryById', () => {
    it('should return the entry by ID', () => {
      const entry = logAction(makeLogActionInput());
      const found = getAuditEntryById(entry.id);
      expect(found.id).toBe(entry.id);
    });

    it('should throw 404 for unknown ID', () => {
      expect(() => getAuditEntryById('non-existent')).toThrow();
      try {
        getAuditEntryById('non-existent');
      } catch (err) {
        expect((err as Error & { statusCode: number }).statusCode).toBe(404);
      }
    });
  });

  // -----------------------------------------------------------------------
  // getAuditLog – filtering
  // -----------------------------------------------------------------------

  describe('getAuditLog', () => {
    beforeEach(() => {
      logAction(makeLogActionInput({ action: AuditAction.USER_LOGIN, userId: 'user-1', entityType: 'User' }));
      logAction(makeLogActionInput({ action: AuditAction.CASE_CREATED, userId: 'user-2', entityType: 'Case', entityId: 'case-1' }));
      logAction(makeLogActionInput({ action: AuditAction.TRANSACTION_CREATED, userId: 'user-1', entityType: 'Transaction', entityId: 'tx-1' }));
    });

    it('should return all entries when no filter provided', () => {
      const result = getAuditLog({});
      expect(result.total).toBe(3);
    });

    it('should filter by userId', () => {
      const result = getAuditLog({ userId: 'user-1' });
      expect(result.total).toBe(2);
      result.data.forEach((e) => expect(e.userId).toBe('user-1'));
    });

    it('should filter by action', () => {
      const result = getAuditLog({ action: AuditAction.CASE_CREATED });
      expect(result.total).toBe(1);
      expect(result.data[0].action).toBe(AuditAction.CASE_CREATED);
    });

    it('should filter by entityType', () => {
      const result = getAuditLog({ entityType: 'Transaction' });
      expect(result.total).toBe(1);
    });

    it('should filter by entityId', () => {
      const result = getAuditLog({ entityId: 'case-1' });
      expect(result.total).toBe(1);
    });

    it('should apply pagination correctly', () => {
      const result = getAuditLog({ page: 1, pageSize: 2 });
      expect(result.data.length).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.total).toBe(3);
    });

    it('should return entries newest-first', () => {
      const result = getAuditLog({});
      const timestamps = result.data.map((e) => e.timestamp.getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });

    it('should filter by date range', () => {
      clearStore();
      const past = new Date('2020-01-01');
      const future = new Date('2099-12-31');

      const e = logAction(makeLogActionInput());

      const inRange = getAuditLog({ startDate: past, endDate: future });
      expect(inRange.total).toBe(1);

      const beforeEntry = getAuditLog({ endDate: new Date(e.timestamp.getTime() - 1) });
      expect(beforeEntry.total).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // getAuditStats
  // -----------------------------------------------------------------------

  describe('getAuditStats', () => {
    beforeEach(() => {
      logAction(makeLogActionInput({ action: AuditAction.USER_LOGIN, userId: 'user-1' }));
      logAction(makeLogActionInput({ action: AuditAction.USER_LOGIN, userId: 'user-1' }));
      logAction(makeLogActionInput({ action: AuditAction.CASE_CREATED, userId: 'user-2', entityType: 'Case' }));
    });

    it('should return total count', () => {
      const stats = getAuditStats();
      expect(stats.total).toBe(3);
    });

    it('should count actions by type', () => {
      const stats = getAuditStats();
      expect(stats.byAction[AuditAction.USER_LOGIN]).toBe(2);
      expect(stats.byAction[AuditAction.CASE_CREATED]).toBe(1);
    });

    it('should count by entity type', () => {
      const stats = getAuditStats();
      expect(stats.byEntityType['User']).toBe(2);
      expect(stats.byEntityType['Case']).toBe(1);
    });

    it('should count by user', () => {
      const stats = getAuditStats();
      expect(stats.byUser['user-1']).toBe(2);
      expect(stats.byUser['user-2']).toBe(1);
    });

    it('should filter stats by userId', () => {
      const stats = getAuditStats('user-1');
      expect(stats.total).toBe(2);
      expect(stats.byUser['user-2']).toBeUndefined();
    });

    it('should include recentActivity (up to 10 entries)', () => {
      clearStore();
      for (let i = 0; i < 15; i++) {
        logAction(makeLogActionInput({ entityId: `entity-${i}` }));
      }
      const stats = getAuditStats();
      expect(stats.recentActivity.length).toBe(10);
    });
  });

  // -----------------------------------------------------------------------
  // getAllAuditEntries
  // -----------------------------------------------------------------------

  describe('getAllAuditEntries', () => {
    beforeEach(() => {
      logAction(makeLogActionInput({ userId: 'user-1', entityType: 'User' }));
      logAction(makeLogActionInput({ userId: 'user-2', entityType: 'Case' }));
      logAction(makeLogActionInput({ userId: 'user-1', entityType: 'Transaction' }));
    });

    it('should return all entries when no filter', () => {
      const entries = getAllAuditEntries();
      expect(entries.length).toBe(3);
    });

    it('should filter by userId', () => {
      const entries = getAllAuditEntries({ userId: 'user-1' });
      expect(entries.length).toBe(2);
    });

    it('should return entries newest-first', () => {
      const entries = getAllAuditEntries();
      const timestamps = entries.map((e) => e.timestamp.getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });
  });
});
