/**
 * Regulatory Filing Service Tests for CRYPTRAC
 */

import {
  createFiling,
  updateFiling,
  markAsFiled,
  cancelFiling,
  getFilingCalendar,
  getFilingDashboard,
  checkOverdueFilings,
  _filingStore,
} from '../regulatory-filing.service';
import { FilingType, FilingStatus } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStore(): void {
  _filingStore.clear();
}

function makeInput(overrides?: Partial<Parameters<typeof createFiling>[0]>): Parameters<typeof createFiling>[0] {
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  return {
    filingType: FilingType.STR_SAR,
    title: 'Monthly STR Filing',
    description: 'Monthly suspicious transaction report filing',
    regulatoryAuthority: 'NFIU',
    dueDate,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Regulatory Filing Service', () => {
  beforeEach(clearStore);

  // -----------------------------------------------------------------------
  // createFiling
  // -----------------------------------------------------------------------

  describe('createFiling', () => {
    it('should create a filing with UPCOMING status for a future due date', () => {
      const filing = createFiling(makeInput());
      expect(filing.id).toBeDefined();
      expect(filing.status).toBe(FilingStatus.UPCOMING);
      expect(filing.linkedReportIds).toEqual([]);
      expect(filing.notes).toEqual([]);
    });

    it('should create a DUE_SOON filing if due within 7 days', () => {
      const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
      const filing = createFiling(makeInput({ dueDate }));
      expect(filing.status).toBe(FilingStatus.DUE_SOON);
    });

    it('should create an OVERDUE filing if due date is in the past', () => {
      const dueDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const filing = createFiling(makeInput({ dueDate }));
      expect(filing.status).toBe(FilingStatus.OVERDUE);
    });
  });

  // -----------------------------------------------------------------------
  // markAsFiled
  // -----------------------------------------------------------------------

  describe('markAsFiled', () => {
    it('should transition filing to FILED status', () => {
      const filing = createFiling(makeInput());
      const filed = markAsFiled(filing.id, 'REF-001');
      expect(filed.status).toBe(FilingStatus.FILED);
      expect(filed.filedAt).toBeInstanceOf(Date);
      expect(filed.filingReference).toBe('REF-001');
    });

    it('should throw 404 for non-existent filing', () => {
      expect(() => markAsFiled('non-existent')).toThrow();
      try {
        markAsFiled('non-existent');
      } catch (err) {
        expect((err as Error & { statusCode: number }).statusCode).toBe(404);
      }
    });
  });

  // -----------------------------------------------------------------------
  // cancelFiling
  // -----------------------------------------------------------------------

  describe('cancelFiling', () => {
    it('should transition to CANCELLED with reason in notes', () => {
      const filing = createFiling(makeInput());
      const cancelled = cancelFiling(filing.id, 'No longer required');
      expect(cancelled.status).toBe(FilingStatus.CANCELLED);
      expect(cancelled.notes.some((n) => n.includes('No longer required'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getFilingCalendar
  // -----------------------------------------------------------------------

  describe('getFilingCalendar', () => {
    it('should return sorted entries with correct daysUntilDue', () => {
      const d1 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);  // 5 days
      const d2 = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days
      const d3 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

      createFiling(makeInput({ dueDate: d2, title: 'Mid Filing' }));
      createFiling(makeInput({ dueDate: d3, title: 'Far Filing' }));
      createFiling(makeInput({ dueDate: d1, title: 'Near Filing' }));

      const calendar = getFilingCalendar(90);
      expect(calendar[0].title).toBe('Near Filing');
      expect(calendar[1].title).toBe('Mid Filing');
      expect(calendar[2].title).toBe('Far Filing');
      expect(calendar[0].daysUntilDue).toBeLessThan(calendar[1].daysUntilDue);
    });

    it('should exclude filings beyond daysAhead', () => {
      createFiling(makeInput({ dueDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000) }));
      const calendar = getFilingCalendar(90);
      expect(calendar).toHaveLength(0);
    });

    it('should exclude cancelled filings', () => {
      const filing = createFiling(makeInput());
      cancelFiling(filing.id, 'Test cancellation');
      const calendar = getFilingCalendar(90);
      expect(calendar).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getFilingDashboard
  // -----------------------------------------------------------------------

  describe('getFilingDashboard', () => {
    it('should return accurate metrics', () => {
      createFiling(makeInput({ dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })); // upcoming
      const dueSoon = createFiling(makeInput({ dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) })); // due soon
      markAsFiled(dueSoon.id); // filed
      const overdueFiling = createFiling(makeInput({ dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) })); // overdue
      expect(overdueFiling.status).toBe(FilingStatus.OVERDUE);

      const dashboard = getFilingDashboard();
      expect(dashboard.totalFilings).toBe(3);
      expect(dashboard.filed).toBe(1);
      expect(dashboard.overdue).toBe(1);
      expect(dashboard.upcoming).toBeGreaterThanOrEqual(1);
    });

    it('should return 100% complianceScore when all eligible filings are filed', () => {
      const f1 = createFiling(makeInput());
      markAsFiled(f1.id);

      const dashboard = getFilingDashboard();
      expect(dashboard.complianceScore).toBe(100);
    });
  });

  // -----------------------------------------------------------------------
  // checkOverdueFilings
  // -----------------------------------------------------------------------

  describe('checkOverdueFilings', () => {
    it('should identify and mark overdue filings', () => {
      // Create a past-due filing directly with overdue date
      createFiling(makeInput({ dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })); // 2 days ago
      createFiling(makeInput({ dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })); // future

      const overdue = checkOverdueFilings();
      expect(overdue.length).toBeGreaterThanOrEqual(1);
      overdue.forEach((f) => {
        expect(f.status).toBe(FilingStatus.OVERDUE);
      });
    });

    it('should not mark filed filings as overdue', () => {
      const filing = createFiling(makeInput());
      markAsFiled(filing.id);

      // Move due date to past manually
      _filingStore.get(filing.id)!.dueDate = new Date(Date.now() - 1000);

      const overdue = checkOverdueFilings();
      const wasFiled = overdue.find((f) => f.id === filing.id);
      expect(wasFiled).toBeUndefined();
    });
  });
});
