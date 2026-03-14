/**
 * STR/SAR Service Tests for CRYPTRAC
 */

import {
  createSTRSAR,
  updateSTRSAR,
  submitForReview,
  approveReport,
  rejectReport,
  fileReport,
  acknowledgeReport,
  amendReport,
  getSTRSARs,
  getSTRSARStats,
  autoGenerateSTR,
  _strSarStore,
} from '../str-sar.service';
import { STRSARType, STRSARStatus, SuspicionCategory } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStore(): void {
  _strSarStore.clear();
}

function makeInput(overrides?: Partial<Parameters<typeof createSTRSAR>[0]>): Parameters<typeof createSTRSAR>[0] {
  return {
    type: STRSARType.STR,
    subjectName: 'John Doe',
    subjectWalletAddresses: ['0xABC'],
    suspicionCategories: [SuspicionCategory.MONEY_LAUNDERING],
    narrativeSummary: 'This is a test suspicious activity narrative for testing purposes.',
    indicatorsOfSuspicion: ['Large unusual transfer', 'Structuring pattern'],
    totalAmountUSD: 50000,
    dateRangeStart: new Date('2026-01-01'),
    dateRangeEnd: new Date('2026-01-31'),
    filingOfficerUserId: 'user-1',
    regulatoryAuthority: 'NFIU',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('STR/SAR Service', () => {
  beforeEach(clearStore);

  // -----------------------------------------------------------------------
  // createSTRSAR
  // -----------------------------------------------------------------------

  describe('createSTRSAR', () => {
    it('should create a report with DRAFT status', () => {
      const report = createSTRSAR(makeInput(), 'Officer Alice');
      expect(report.id).toBeDefined();
      expect(report.status).toBe(STRSARStatus.DRAFT);
      expect(report.filingOfficer).toBe('Officer Alice');
    });

    it('should generate a sequential report number', () => {
      const r1 = createSTRSAR(makeInput(), 'Officer Alice');
      const r2 = createSTRSAR(makeInput(), 'Officer Alice');
      expect(r1.reportNumber).toMatch(/^STR-\d{4}-\d{6}$/);
      expect(r2.reportNumber).not.toBe(r1.reportNumber);
    });

    it('should generate SAR report numbers with SAR prefix', () => {
      const report = createSTRSAR(makeInput({ type: STRSARType.SAR }), 'Officer Alice');
      expect(report.reportNumber).toMatch(/^SAR-/);
    });
  });

  // -----------------------------------------------------------------------
  // Status transitions
  // -----------------------------------------------------------------------

  describe('status transitions: DRAFT → UNDER_REVIEW → APPROVED → FILED → ACKNOWLEDGED', () => {
    it('should transition DRAFT to UNDER_REVIEW via submitForReview', () => {
      const report = createSTRSAR(makeInput(), 'Alice');
      const reviewed = submitForReview(report.id);
      expect(reviewed.status).toBe(STRSARStatus.UNDER_REVIEW);
    });

    it('should transition UNDER_REVIEW to APPROVED via approveReport', () => {
      const report = createSTRSAR(makeInput(), 'Alice');
      submitForReview(report.id);
      const approved = approveReport(report.id, 'reviewer-1', 'Looks good');
      expect(approved.status).toBe(STRSARStatus.APPROVED);
      expect(approved.reviewedBy).toBe('reviewer-1');
    });

    it('should transition APPROVED to FILED via fileReport', () => {
      const report = createSTRSAR(makeInput(), 'Alice');
      submitForReview(report.id);
      approveReport(report.id, 'reviewer-1');
      const filed = fileReport(report.id);
      expect(filed.status).toBe(STRSARStatus.FILED);
      expect(filed.submittedAt).toBeInstanceOf(Date);
    });

    it('should transition FILED to ACKNOWLEDGED via acknowledgeReport', () => {
      const report = createSTRSAR(makeInput(), 'Alice');
      submitForReview(report.id);
      approveReport(report.id, 'reviewer-1');
      fileReport(report.id);
      const acked = acknowledgeReport(report.id);
      expect(acked.status).toBe(STRSARStatus.ACKNOWLEDGED);
      expect(acked.acknowledgedAt).toBeInstanceOf(Date);
    });

    it('should reject a report in UNDER_REVIEW status', () => {
      const report = createSTRSAR(makeInput(), 'Alice');
      submitForReview(report.id);
      const rejected = rejectReport(report.id, 'reviewer-1', 'Insufficient evidence');
      expect(rejected.status).toBe(STRSARStatus.REJECTED);
      expect(rejected.reviewNotes).toBe('Insufficient evidence');
    });
  });

  // -----------------------------------------------------------------------
  // Invalid status transitions
  // -----------------------------------------------------------------------

  describe('invalid transitions', () => {
    it('should throw when submitting a non-DRAFT report for review', () => {
      const report = createSTRSAR(makeInput(), 'Alice');
      submitForReview(report.id);
      expect(() => submitForReview(report.id)).toThrow();
    });

    it('should throw when approving a DRAFT report', () => {
      const report = createSTRSAR(makeInput(), 'Alice');
      expect(() => approveReport(report.id, 'reviewer-1')).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // updateSTRSAR
  // -----------------------------------------------------------------------

  describe('updateSTRSAR', () => {
    it('should update fields on a DRAFT report', () => {
      const report = createSTRSAR(makeInput(), 'Alice');
      const updated = updateSTRSAR(report.id, { subjectName: 'Jane Doe', totalAmountUSD: 99999 });
      expect(updated.subjectName).toBe('Jane Doe');
      expect(updated.totalAmountUSD).toBe(99999);
    });

    it('should throw when updating a non-DRAFT report', () => {
      const report = createSTRSAR(makeInput(), 'Alice');
      submitForReview(report.id);
      expect(() => updateSTRSAR(report.id, { subjectName: 'Jane Doe' })).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // amendReport
  // -----------------------------------------------------------------------

  describe('amendReport', () => {
    it('should create a new report linked to the original', () => {
      const original = createSTRSAR(makeInput(), 'Alice');
      submitForReview(original.id);
      approveReport(original.id, 'reviewer-1');
      fileReport(original.id);
      acknowledgeReport(original.id);

      const amendment = amendReport(original.id, 'user-2', 'Officer Bob', 'Correcting amount');
      expect(amendment.amendmentOf).toBe(original.id);
      expect(amendment.amendmentReason).toBe('Correcting amount');
      expect(amendment.status).toBe(STRSARStatus.DRAFT);
    });

    it('should mark the original report as AMENDED', () => {
      const original = createSTRSAR(makeInput(), 'Alice');
      submitForReview(original.id);
      approveReport(original.id, 'reviewer-1');
      fileReport(original.id);
      acknowledgeReport(original.id);

      amendReport(original.id, 'user-2', 'Officer Bob', 'Correcting amount');
      const refreshed = _strSarStore.get(original.id)!;
      expect(refreshed.status).toBe(STRSARStatus.AMENDED);
    });
  });

  // -----------------------------------------------------------------------
  // getSTRSARStats
  // -----------------------------------------------------------------------

  describe('getSTRSARStats', () => {
    it('should return accurate statistics', () => {
      const r1 = createSTRSAR(makeInput({ type: STRSARType.STR }), 'Alice');
      submitForReview(r1.id);
      approveReport(r1.id, 'reviewer-1');
      fileReport(r1.id);

      createSTRSAR(makeInput({ type: STRSARType.SAR }), 'Bob');

      const stats = getSTRSARStats();
      expect(stats.totalReports).toBe(2);
      expect(stats.byType[STRSARType.STR]).toBe(1);
      expect(stats.byType[STRSARType.SAR]).toBe(1);
      expect(stats.byStatus[STRSARStatus.FILED]).toBe(1);
      expect(stats.byStatus[STRSARStatus.DRAFT]).toBe(1);
    });

    it('should count pending review reports', () => {
      const r1 = createSTRSAR(makeInput(), 'Alice');
      submitForReview(r1.id);

      const stats = getSTRSARStats();
      expect(stats.pendingReview).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // autoGenerateSTR
  // -----------------------------------------------------------------------

  describe('autoGenerateSTR', () => {
    it('should create a draft STR from transaction IDs', () => {
      const report = autoGenerateSTR(['tx-1', 'tx-2'], 'case-123');
      expect(report.status).toBe(STRSARStatus.DRAFT);
      expect(report.type).toBe(STRSARType.STR);
      expect(report.linkedTransactionIds).toEqual(['tx-1', 'tx-2']);
      expect(report.linkedCaseIds).toContain('case-123');
    });

    it('should include transaction count in narrative', () => {
      const report = autoGenerateSTR(['tx-1', 'tx-2', 'tx-3']);
      expect(report.narrativeSummary).toContain('3');
    });
  });

  // -----------------------------------------------------------------------
  // getSTRSARs pagination and filtering
  // -----------------------------------------------------------------------

  describe('getSTRSARs', () => {
    beforeEach(() => {
      createSTRSAR(makeInput({ type: STRSARType.STR, filingOfficerUserId: 'user-A' }), 'Alice');
      createSTRSAR(makeInput({ type: STRSARType.SAR, filingOfficerUserId: 'user-A' }), 'Alice');
      createSTRSAR(makeInput({ type: STRSARType.CTR, filingOfficerUserId: 'user-B' }), 'Bob');
    });

    it('should return all reports without filters', () => {
      const result = getSTRSARs();
      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(3);
    });

    it('should filter by type', () => {
      const result = getSTRSARs({ type: STRSARType.STR });
      expect(result.total).toBe(1);
      expect(result.data[0].type).toBe(STRSARType.STR);
    });

    it('should filter by filingOfficerUserId', () => {
      const result = getSTRSARs({ filingOfficerUserId: 'user-A' });
      expect(result.total).toBe(2);
    });

    it('should paginate results', () => {
      const page1 = getSTRSARs({ page: 1, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(3);

      const page2 = getSTRSARs({ page: 2, pageSize: 2 });
      expect(page2.data).toHaveLength(1);
    });
  });
});
