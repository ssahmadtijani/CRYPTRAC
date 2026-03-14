/**
 * Enhanced Export Service Tests
 */

// Mock all external dependencies
jest.mock('../../services/analytics.service', () => ({
  getKPIs: jest.fn().mockResolvedValue({
    totalTransactions: 100,
    totalTransactionsLast24h: 10,
    totalTransactionsLast7d: 50,
    totalVolumeUSD: 500000,
    volumeLast24h: 10000,
    volumeLast7d: 75000,
    activeWallets: 25,
    flaggedWallets: 5,
    sanctionedWallets: 1,
    openCases: 3,
    criticalCases: 1,
    complianceRate: 0.95,
    averageRiskScore: 42,
  }),
  getTransactionTimeSeries: jest.fn().mockResolvedValue([
    { date: '2026-01-01', count: 10, volumeUSD: 50000, flaggedCount: 2 },
    { date: '2026-01-02', count: 15, volumeUSD: 75000, flaggedCount: 1 },
  ]),
  getRiskDistribution: jest.fn().mockResolvedValue([
    { level: 'LOW', count: 60, percentage: 60 },
    { level: 'MEDIUM', count: 25, percentage: 25 },
    { level: 'HIGH', count: 10, percentage: 10 },
    { level: 'CRITICAL', count: 5, percentage: 5 },
  ]),
  getAssetBreakdown: jest.fn().mockResolvedValue([
    { asset: 'ETH', count: 50, volumeUSD: 250000, percentage: 50 },
    { asset: 'BTC', count: 30, volumeUSD: 150000, percentage: 30 },
  ]),
}));

jest.mock('../../services/pattern-detection.service', () => ({
  detectAllPatterns: jest.fn().mockResolvedValue({
    structuring: [
      {
        walletAddress: '0xabc123',
        transactions: [{ id: 'tx1' }, { id: 'tx2' }],
        totalAmount: 18000,
        timeWindowHours: 24,
        detectedAt: new Date('2026-01-01'),
      },
    ],
    rapidMovement: [],
    layering: [],
    roundTripping: [],
    summary: {
      totalPatterns: 1,
      structuringCount: 1,
      rapidMovementCount: 0,
      layeringCount: 0,
      roundTrippingCount: 0,
      detectedAt: new Date('2026-01-01'),
    },
  }),
}));

jest.mock('../../services/network-analysis.service', () => ({
  buildTransactionGraph: jest.fn().mockResolvedValue({
    nodes: [{ id: '0xabc', label: 'Wallet A', riskScore: 30, riskLevel: 'LOW', isSanctioned: false, transactionCount: 5, totalVolumeUSD: 25000, type: 'both' }],
    edges: [{ source: '0xabc', target: '0xdef', weight: 3, transactionCount: 3, assets: ['ETH'], latestTimestamp: new Date() }],
    stats: { totalNodes: 1, totalEdges: 1, densityScore: 0.5, highRiskNodes: 0, clusters: 1 },
  }),
}));

jest.mock('../../services/audit.service', () => ({
  getAuditLog: jest.fn().mockReturnValue({
    data: [
      {
        id: 'audit-1',
        timestamp: new Date('2026-01-01'),
        userId: 'user-1',
        userEmail: 'admin@test.com',
        userRole: 'ADMIN',
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: 'user-1',
        description: 'User logged in',
        metadata: {},
      },
    ],
    total: 1,
    page: 1,
    pageSize: 10000,
  }),
}));

jest.mock('../../services/case.service', () => ({
  getCaseById: jest.fn().mockReturnValue({
    id: 'case-1',
    caseNumber: 'CASE-2026-00001',
    title: 'Test Case',
    category: 'SUSPICIOUS_TRANSACTION',
    status: 'OPEN',
    priority: 'HIGH',
    riskLevel: 'HIGH',
    description: 'Test description',
    createdById: 'admin-1',
    assigneeId: null,
    transactionIds: ['tx-1'],
    walletAddresses: ['0xabc'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    notes: [
      {
        id: 'note-1',
        caseId: 'case-1',
        authorId: 'admin-1',
        content: 'Initial investigation note',
        isInternal: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ],
    timeline: [
      {
        id: 'tl-1',
        caseId: 'case-1',
        action: 'CASE_CREATED',
        performedById: 'admin-1',
        timestamp: new Date('2026-01-01'),
      },
    ],
  }),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import service under test after all mocks are in place
// ---------------------------------------------------------------------------

import * as exportService from '../../services/export.service';

describe('Enhanced Export Service', () => {
  // -------------------------------------------------------------------------
  // exportAnalyticsReport
  // -------------------------------------------------------------------------

  describe('exportAnalyticsReport', () => {
    it('should generate valid JSON output with expected structure', async () => {
      const result = await exportService.exportAnalyticsReport('json');

      expect(result.contentType).toBe('application/json');
      expect(result.filename).toMatch(/^analytics-report-.+\.json$/);

      const parsed = JSON.parse(result.data as string);
      expect(parsed.kpis).toBeDefined();
      expect(parsed.kpis.totalTransactions).toBe(100);
      expect(parsed.timeSeries).toHaveLength(2);
      expect(parsed.riskDistribution).toHaveLength(4);
    });

    it('should generate valid CSV output', async () => {
      const result = await exportService.exportAnalyticsReport('csv');
      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toMatch(/\.csv$/);
      expect(result.data as string).toContain('CRYPTRAC Analytics Report');
      expect(result.data as string).toContain('totalTransactions');
    });

    it('should generate PDF output', async () => {
      const result = await exportService.exportAnalyticsReport('pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(result.filename).toMatch(/\.pdf$/);
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect((result.data as Buffer).length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // exportCaseReport
  // -------------------------------------------------------------------------

  describe('exportCaseReport', () => {
    it('should generate JSON with notes and timeline', async () => {
      const result = await exportService.exportCaseReport('case-1', 'json');

      expect(result.contentType).toBe('application/json');
      const parsed = JSON.parse(result.data as string);
      expect(parsed.caseNumber).toBe('CASE-2026-00001');
      expect(parsed.notes).toHaveLength(1);
      expect(parsed.notes[0].content).toBe('Initial investigation note');
      expect(parsed.timeline).toHaveLength(1);
    });

    it('should generate CSV with case details', async () => {
      const result = await exportService.exportCaseReport('case-1', 'csv');
      expect(result.contentType).toBe('text/csv');
      expect(result.data as string).toContain('CASE-2026-00001');
      expect(result.data as string).toContain('Notes');
    });

    it('should throw if case not found', async () => {
      const { getCaseById } = require('../../services/case.service') as { getCaseById: jest.Mock };
      getCaseById.mockReturnValueOnce(null);
      await expect(exportService.exportCaseReport('nonexistent', 'json')).rejects.toThrow(
        'Case not found: nonexistent'
      );
    });
  });

  // -------------------------------------------------------------------------
  // exportAuditLog
  // -------------------------------------------------------------------------

  describe('exportAuditLog', () => {
    it('should respect date filters by passing them to getAuditLog', async () => {
      const { getAuditLog } = require('../../services/audit.service') as { getAuditLog: jest.Mock };
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      await exportService.exportAuditLog({ startDate, endDate }, 'json');

      expect(getAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ startDate, endDate })
      );
    });

    it('should generate CSV with audit entries', async () => {
      const result = await exportService.exportAuditLog({}, 'csv');
      expect(result.contentType).toBe('text/csv');
      expect(result.data as string).toContain('admin@test.com');
    });

    it('should generate JSON audit log', async () => {
      const result = await exportService.exportAuditLog({}, 'json');
      expect(result.contentType).toBe('application/json');
      const parsed = JSON.parse(result.data as string);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].userEmail).toBe('admin@test.com');
    });
  });

  // -------------------------------------------------------------------------
  // exportPatternReport
  // -------------------------------------------------------------------------

  describe('exportPatternReport', () => {
    it('should generate valid JSON pattern report', async () => {
      const result = await exportService.exportPatternReport('json');
      expect(result.contentType).toBe('application/json');
      const parsed = JSON.parse(result.data as string);
      expect(parsed.summary.totalPatterns).toBe(1);
      expect(parsed.structuring).toHaveLength(1);
    });

    it('should generate CSV with summary section', async () => {
      const result = await exportService.exportPatternReport('csv');
      expect(result.contentType).toBe('text/csv');
      expect(result.data as string).toContain('Summary');
      expect(result.data as string).toContain('Structuring');
    });
  });

  // -------------------------------------------------------------------------
  // scheduleExport / getExportJob / getExportHistory
  // -------------------------------------------------------------------------

  describe('scheduleExport', () => {
    it('should create a job with pending status', () => {
      const job = exportService.scheduleExport('user-test', 'analytics', 'json');
      expect(job.status).toBe('pending');
      expect(job.userId).toBe('user-test');
      expect(job.exportType).toBe('analytics');
      expect(job.format).toBe('json');
      expect(job.id).toBeDefined();
      expect(job.createdAt).toBeInstanceOf(Date);
    });

    it('should store the job with filters', () => {
      const filters = { startDate: '2026-01-01', endDate: '2026-01-31' };
      const job = exportService.scheduleExport('user-test', 'audit-log', 'csv', filters);
      expect(job.filters).toEqual(filters);
    });
  });

  describe('getExportJob', () => {
    it('should return the job by ID', () => {
      const job = exportService.scheduleExport('user-x', 'network-graph', 'json');
      const found = exportService.getExportJob(job.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(job.id);
    });

    it('should return undefined for unknown job ID', () => {
      expect(exportService.getExportJob('nonexistent-id')).toBeUndefined();
    });
  });

  describe('getExportHistory', () => {
    it('should return only jobs for the requesting user', () => {
      exportService.scheduleExport('user-a', 'analytics', 'json');
      exportService.scheduleExport('user-b', 'patterns', 'csv');
      exportService.scheduleExport('user-a', 'network-graph', 'json');

      const history = exportService.getExportHistory('user-a');
      expect(history.every((j) => j.userId === 'user-a')).toBe(true);
      // user-a has at least 2 jobs
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for user with no jobs', () => {
      const history = exportService.getExportHistory('no-such-user');
      expect(history).toEqual([]);
    });
  });
});
