/**
 * Analytics Service Tests for CRYPTRAC
 */

import {
  getKPIs,
  getTransactionTimeSeries,
  getRiskDistribution,
  getAssetBreakdown,
  getNetworkBreakdown,
  getTopWallets,
  getComplianceOverview,
} from '../analytics.service';
import { RiskLevel, ComplianceStatus } from '../../types';
import { prisma } from '../../lib/prisma';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

jest.mock('../../lib/prisma', () => ({
  prisma: {
    transaction: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    wallet: {
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock Case Service (in-memory)
// ---------------------------------------------------------------------------

jest.mock('../case.service', () => ({
  getCases: jest.fn().mockReturnValue({ data: [] }),
}));

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockTxCount = prisma.transaction.count as jest.Mock;
const mockTxAggregate = prisma.transaction.aggregate as jest.Mock;
const mockTxGroupBy = prisma.transaction.groupBy as jest.Mock;
const mockTxFindMany = prisma.transaction.findMany as jest.Mock;
const mockWalletCount = prisma.wallet.count as jest.Mock;
const mockWalletFindMany = prisma.wallet.findMany as jest.Mock;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getKPIs
  // -----------------------------------------------------------------------

  describe('getKPIs', () => {
    beforeEach(() => {
      mockTxCount
        .mockResolvedValueOnce(100)  // totalTransactions
        .mockResolvedValueOnce(5)    // last24h
        .mockResolvedValueOnce(30);  // last7d
      mockTxAggregate
        .mockResolvedValueOnce({ _sum: { amountUSD: 1_000_000 } })   // total volume
        .mockResolvedValueOnce({ _sum: { amountUSD: 50_000 } })      // last24h volume
        .mockResolvedValueOnce({ _sum: { amountUSD: 300_000 } })     // last7d volume
        .mockResolvedValueOnce({ _avg: { riskScore: 35.5 } });       // avg risk
      mockTxGroupBy.mockResolvedValue([
        { complianceStatus: ComplianceStatus.APPROVED, _count: { _all: 60 } },
        { complianceStatus: ComplianceStatus.PENDING, _count: { _all: 40 } },
      ]);
      mockWalletCount
        .mockResolvedValueOnce(20)   // activeWallets
        .mockResolvedValueOnce(5)    // flaggedWallets
        .mockResolvedValueOnce(1);   // sanctionedWallets
    });

    it('returns total transaction counts', async () => {
      const kpis = await getKPIs();
      expect(kpis.totalTransactions).toBe(100);
      expect(kpis.totalTransactionsLast24h).toBe(5);
      expect(kpis.totalTransactionsLast7d).toBe(30);
    });

    it('returns volume aggregates', async () => {
      const kpis = await getKPIs();
      expect(kpis.totalVolumeUSD).toBe(1_000_000);
      expect(kpis.volumeLast24h).toBe(50_000);
      expect(kpis.volumeLast7d).toBe(300_000);
    });

    it('calculates compliance rate correctly', async () => {
      const kpis = await getKPIs();
      // 60 approved / 100 total = 60%
      expect(kpis.complianceRate).toBe(60);
    });

    it('returns wallet counts', async () => {
      const kpis = await getKPIs();
      expect(kpis.activeWallets).toBe(20);
      expect(kpis.flaggedWallets).toBe(5);
      expect(kpis.sanctionedWallets).toBe(1);
    });

    it('returns average risk score', async () => {
      const kpis = await getKPIs();
      expect(kpis.averageRiskScore).toBe(35.5);
    });

    it('returns zero compliance rate when no transactions', async () => {
      jest.clearAllMocks();
      mockTxCount.mockResolvedValue(0);
      mockTxAggregate.mockResolvedValue({ _sum: { amountUSD: 0 }, _avg: { riskScore: 0 } });
      mockTxGroupBy.mockResolvedValue([]);
      mockWalletCount.mockResolvedValue(0);

      const kpis = await getKPIs();
      expect(kpis.complianceRate).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // getTransactionTimeSeries
  // -----------------------------------------------------------------------

  describe('getTransactionTimeSeries', () => {
    it('buckets transactions by day', async () => {
      const now = new Date('2024-06-15T12:00:00Z');
      const yesterday = new Date('2024-06-14T10:00:00Z');
      mockTxFindMany.mockResolvedValue([
        { timestamp: yesterday, amountUSD: 5000, riskLevel: RiskLevel.LOW },
        { timestamp: now, amountUSD: 15000, riskLevel: RiskLevel.HIGH },
        { timestamp: now, amountUSD: 7000, riskLevel: RiskLevel.MEDIUM },
      ]);

      const result = await getTransactionTimeSeries('day', 30);
      expect(result.length).toBeGreaterThan(0);
      for (const point of result) {
        expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('counts flagged transactions correctly', async () => {
      const ts = new Date('2024-06-15T12:00:00Z');
      mockTxFindMany.mockResolvedValue([
        { timestamp: ts, amountUSD: 5000, riskLevel: RiskLevel.HIGH },
        { timestamp: ts, amountUSD: 5000, riskLevel: RiskLevel.CRITICAL },
        { timestamp: ts, amountUSD: 5000, riskLevel: RiskLevel.LOW },
      ]);

      const result = await getTransactionTimeSeries('day', 30);
      const day = result[0];
      expect(day.count).toBe(3);
      expect(day.flaggedCount).toBe(2); // HIGH + CRITICAL
    });

    it('buckets transactions by month', async () => {
      const ts = new Date('2024-06-15T12:00:00Z');
      mockTxFindMany.mockResolvedValue([
        { timestamp: ts, amountUSD: 1000, riskLevel: RiskLevel.LOW },
      ]);

      const result = await getTransactionTimeSeries('month', 6);
      expect(result[0].date).toMatch(/^\d{4}-\d{2}$/);
    });

    it('returns empty array when no transactions', async () => {
      mockTxFindMany.mockResolvedValue([]);
      const result = await getTransactionTimeSeries('day', 7);
      expect(result).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getRiskDistribution
  // -----------------------------------------------------------------------

  describe('getRiskDistribution', () => {
    it('returns all four risk levels', async () => {
      mockTxGroupBy.mockResolvedValue([
        { riskLevel: RiskLevel.LOW, _count: { _all: 50 } },
        { riskLevel: RiskLevel.MEDIUM, _count: { _all: 30 } },
        { riskLevel: RiskLevel.HIGH, _count: { _all: 15 } },
        { riskLevel: RiskLevel.CRITICAL, _count: { _all: 5 } },
      ]);

      const result = await getRiskDistribution();
      expect(result).toHaveLength(4);
      expect(result.map((r) => r.level)).toEqual([
        RiskLevel.LOW,
        RiskLevel.MEDIUM,
        RiskLevel.HIGH,
        RiskLevel.CRITICAL,
      ]);
    });

    it('calculates percentages correctly', async () => {
      mockTxGroupBy.mockResolvedValue([
        { riskLevel: RiskLevel.LOW, _count: { _all: 80 } },
        { riskLevel: RiskLevel.MEDIUM, _count: { _all: 20 } },
      ]);

      const result = await getRiskDistribution();
      const low = result.find((r) => r.level === RiskLevel.LOW)!;
      const medium = result.find((r) => r.level === RiskLevel.MEDIUM)!;
      expect(low.percentage).toBe(80);
      expect(medium.percentage).toBe(20);
    });

    it('returns zero percentages when no data', async () => {
      mockTxGroupBy.mockResolvedValue([]);
      const result = await getRiskDistribution();
      expect(result.every((r) => r.percentage === 0)).toBe(true);
    });

    it('totals add up to 100%', async () => {
      mockTxGroupBy.mockResolvedValue([
        { riskLevel: RiskLevel.LOW, _count: { _all: 25 } },
        { riskLevel: RiskLevel.MEDIUM, _count: { _all: 25 } },
        { riskLevel: RiskLevel.HIGH, _count: { _all: 25 } },
        { riskLevel: RiskLevel.CRITICAL, _count: { _all: 25 } },
      ]);

      const result = await getRiskDistribution();
      const total = result.reduce((sum, r) => sum + r.percentage, 0);
      expect(total).toBe(100);
    });
  });

  // -----------------------------------------------------------------------
  // getAssetBreakdown
  // -----------------------------------------------------------------------

  describe('getAssetBreakdown', () => {
    it('returns asset breakdown sorted by volume', async () => {
      mockTxGroupBy.mockResolvedValue([
        { asset: 'BTC', _count: { _all: 10 }, _sum: { amountUSD: 500_000 } },
        { asset: 'ETH', _count: { _all: 20 }, _sum: { amountUSD: 300_000 } },
        { asset: 'USDT', _count: { _all: 50 }, _sum: { amountUSD: 200_000 } },
      ]);

      const result = await getAssetBreakdown();
      expect(result).toHaveLength(3);
      expect(result[0].asset).toBe('BTC');
      expect(result[0].volumeUSD).toBe(500_000);
    });

    it('calculates percentage of total volume', async () => {
      mockTxGroupBy.mockResolvedValue([
        { asset: 'BTC', _count: { _all: 1 }, _sum: { amountUSD: 600_000 } },
        { asset: 'ETH', _count: { _all: 1 }, _sum: { amountUSD: 400_000 } },
      ]);

      const result = await getAssetBreakdown();
      expect(result[0].percentage).toBe(60);
      expect(result[1].percentage).toBe(40);
    });
  });

  // -----------------------------------------------------------------------
  // getNetworkBreakdown
  // -----------------------------------------------------------------------

  describe('getNetworkBreakdown', () => {
    it('returns network breakdown', async () => {
      mockTxGroupBy.mockResolvedValue([
        { network: 'ethereum', _count: { _all: 100 }, _sum: { amountUSD: 1_000_000 } },
        { network: 'bitcoin', _count: { _all: 50 }, _sum: { amountUSD: 500_000 } },
      ]);

      const result = await getNetworkBreakdown();
      expect(result).toHaveLength(2);
      expect(result[0].network).toBe('ethereum');
      expect(result[0].count).toBe(100);
    });
  });

  // -----------------------------------------------------------------------
  // getTopWallets
  // -----------------------------------------------------------------------

  describe('getTopWallets', () => {
    it('returns top wallets by volume', async () => {
      mockWalletFindMany.mockResolvedValue([
        {
          address: '0xabc',
          network: 'ethereum',
          riskScore: 30,
          riskLevel: RiskLevel.MEDIUM,
          transactionCount: 10,
          totalVolumeUSD: 500_000,
          isSanctioned: false,
        },
      ]);

      const result = await getTopWallets(10, 'volume');
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe('0xabc');
      expect(result[0].totalVolumeUSD).toBe(500_000);
    });
  });

  // -----------------------------------------------------------------------
  // getComplianceOverview
  // -----------------------------------------------------------------------

  describe('getComplianceOverview', () => {
    it('returns all five compliance statuses', async () => {
      mockTxGroupBy.mockResolvedValue([
        { complianceStatus: ComplianceStatus.PENDING, _count: { _all: 40 } },
        { complianceStatus: ComplianceStatus.APPROVED, _count: { _all: 50 } },
        { complianceStatus: ComplianceStatus.FLAGGED, _count: { _all: 5 } },
        { complianceStatus: ComplianceStatus.REJECTED, _count: { _all: 3 } },
        { complianceStatus: ComplianceStatus.UNDER_REVIEW, _count: { _all: 2 } },
      ]);

      const result = await getComplianceOverview();
      expect(result).toHaveLength(5);
      const approved = result.find((r) => r.status === ComplianceStatus.APPROVED)!;
      expect(approved.count).toBe(50);
      expect(approved.percentage).toBe(50);
    });
  });
});
