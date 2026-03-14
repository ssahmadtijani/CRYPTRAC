/**
 * Analytics Aggregation Service for CRYPTRAC
 * Provides pre-computed KPIs, time-series, and distribution data.
 */

import { prisma } from '../lib/prisma';
import {
  RiskLevel,
  ComplianceStatus,
  AnalyticsKPIs,
  TimeSeriesPoint,
  RiskDistributionItem,
  AssetBreakdownItem,
  NetworkBreakdownItem,
  TopWalletItem,
  ComplianceOverviewItem,
  GeographicBreakdownItem,
} from '../types';
import { getCases } from './case.service';
import { CaseStatus, CasePriority } from '../types';

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export async function getKPIs(): Promise<AnalyticsKPIs> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalTransactions,
    totalTransactionsLast24h,
    totalTransactionsLast7d,
    volumeAgg,
    volumeLast24hAgg,
    volumeLast7dAgg,
    walletStats,
    avgRisk,
    complianceStats,
  ] = await Promise.all([
    prisma.transaction.count(),
    prisma.transaction.count({ where: { timestamp: { gte: last24h } } }),
    prisma.transaction.count({ where: { timestamp: { gte: last7d } } }),
    prisma.transaction.aggregate({ _sum: { amountUSD: true } }),
    prisma.transaction.aggregate({
      where: { timestamp: { gte: last24h } },
      _sum: { amountUSD: true },
    }),
    prisma.transaction.aggregate({
      where: { timestamp: { gte: last7d } },
      _sum: { amountUSD: true },
    }),
    prisma.wallet.aggregate({
      _count: { _all: true },
      where: {},
    }),
    prisma.transaction.aggregate({ _avg: { riskScore: true } }),
    prisma.transaction.groupBy({
      by: ['complianceStatus'],
      _count: { _all: true },
    }),
  ]);

  const [activeWallets, flaggedWallets, sanctionedWallets] = await Promise.all([
    prisma.wallet.count(),
    prisma.wallet.count({ where: { riskLevel: { in: [RiskLevel.HIGH, RiskLevel.CRITICAL] } } }),
    prisma.wallet.count({ where: { isSanctioned: true } }),
  ]);

  // Case metrics from in-memory case store
  const casesResult = getCases({});
  const allCases = casesResult.data ?? [];
  const openCases = allCases.filter(
    (c) => c.status === CaseStatus.OPEN || c.status === CaseStatus.INVESTIGATING
  ).length;
  const criticalCases = allCases.filter((c) => c.priority === CasePriority.CRITICAL).length;

  // Compliance rate: percentage of APPROVED transactions
  const totalWithStatus = complianceStats.reduce((sum, s) => sum + s._count._all, 0);
  const approvedCount =
    complianceStats.find((s) => s.complianceStatus === ComplianceStatus.APPROVED)?._count._all ?? 0;
  const complianceRate =
    totalWithStatus > 0 ? Math.round((approvedCount / totalWithStatus) * 100 * 100) / 100 : 0;

  return {
    totalTransactions,
    totalTransactionsLast24h,
    totalTransactionsLast7d,
    totalVolumeUSD: volumeAgg._sum.amountUSD ?? 0,
    volumeLast24h: volumeLast24hAgg._sum.amountUSD ?? 0,
    volumeLast7d: volumeLast7dAgg._sum.amountUSD ?? 0,
    activeWallets,
    flaggedWallets,
    sanctionedWallets,
    openCases,
    criticalCases,
    complianceRate,
    averageRiskScore: Math.round((avgRisk._avg.riskScore ?? 0) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Time Series
// ---------------------------------------------------------------------------

export async function getTransactionTimeSeries(
  period: 'day' | 'week' | 'month',
  range: number
): Promise<TimeSeriesPoint[]> {
  const now = new Date();

  // Determine the start date
  let startDate: Date;
  if (period === 'day') {
    startDate = new Date(now.getTime() - range * 24 * 60 * 60 * 1000);
  } else if (period === 'week') {
    startDate = new Date(now.getTime() - range * 7 * 24 * 60 * 60 * 1000);
  } else {
    startDate = new Date(now.getTime() - range * 30 * 24 * 60 * 60 * 1000);
  }

  const transactions = await prisma.transaction.findMany({
    where: { timestamp: { gte: startDate } },
    select: { timestamp: true, amountUSD: true, riskLevel: true },
    orderBy: { timestamp: 'asc' },
  });

  // Build buckets
  const buckets = new Map<string, { count: number; volumeUSD: number; flaggedCount: number }>();

  for (const tx of transactions) {
    const date = tx.timestamp;
    let key: string;
    if (period === 'day') {
      key = date.toISOString().slice(0, 10); // YYYY-MM-DD
    } else if (period === 'week') {
      // ISO week: get Monday of the week
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      key = d.toISOString().slice(0, 10);
    } else {
      key = date.toISOString().slice(0, 7); // YYYY-MM
    }

    const existing = buckets.get(key) ?? { count: 0, volumeUSD: 0, flaggedCount: 0 };
    existing.count += 1;
    existing.volumeUSD += tx.amountUSD;
    if (tx.riskLevel === RiskLevel.HIGH || tx.riskLevel === RiskLevel.CRITICAL) {
      existing.flaggedCount += 1;
    }
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));
}

// ---------------------------------------------------------------------------
// Risk Distribution
// ---------------------------------------------------------------------------

export async function getRiskDistribution(): Promise<RiskDistributionItem[]> {
  const groups = await prisma.transaction.groupBy({
    by: ['riskLevel'],
    _count: { _all: true },
  });

  const total = groups.reduce((sum, g) => sum + g._count._all, 0);

  const order: RiskLevel[] = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL];
  return order.map((level) => {
    const found = groups.find((g) => g.riskLevel === level);
    const count = found?._count._all ?? 0;
    return {
      level,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Asset Breakdown
// ---------------------------------------------------------------------------

export async function getAssetBreakdown(): Promise<AssetBreakdownItem[]> {
  const groups = await prisma.transaction.groupBy({
    by: ['asset'],
    _count: { _all: true },
    _sum: { amountUSD: true },
    orderBy: { _sum: { amountUSD: 'desc' } },
    take: 10,
  });

  const totalVolume = groups.reduce((sum, g) => sum + (g._sum.amountUSD ?? 0), 0);

  return groups.map((g) => ({
    asset: g.asset,
    count: g._count._all,
    volumeUSD: g._sum.amountUSD ?? 0,
    percentage:
      totalVolume > 0
        ? Math.round(((g._sum.amountUSD ?? 0) / totalVolume) * 100 * 100) / 100
        : 0,
  }));
}

// ---------------------------------------------------------------------------
// Network Breakdown
// ---------------------------------------------------------------------------

export async function getNetworkBreakdown(): Promise<NetworkBreakdownItem[]> {
  const groups = await prisma.transaction.groupBy({
    by: ['network'],
    _count: { _all: true },
    _sum: { amountUSD: true },
    orderBy: { _count: { network: 'desc' } },
  });

  return groups.map((g) => ({
    network: g.network,
    count: g._count._all,
    volumeUSD: g._sum.amountUSD ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Top Wallets
// ---------------------------------------------------------------------------

export async function getTopWallets(
  limit = 10,
  sortBy: 'volume' | 'risk' = 'volume'
): Promise<TopWalletItem[]> {
  const wallets = await prisma.wallet.findMany({
    orderBy:
      sortBy === 'volume'
        ? { totalVolumeUSD: 'desc' }
        : { riskScore: 'desc' },
    take: limit,
  });

  return wallets.map((w) => ({
    address: w.address,
    network: w.network,
    riskScore: w.riskScore,
    riskLevel: w.riskLevel as RiskLevel,
    transactionCount: w.transactionCount,
    totalVolumeUSD: w.totalVolumeUSD,
    isSanctioned: w.isSanctioned,
  }));
}

// ---------------------------------------------------------------------------
// Compliance Overview
// ---------------------------------------------------------------------------

export async function getComplianceOverview(): Promise<ComplianceOverviewItem[]> {
  const groups = await prisma.transaction.groupBy({
    by: ['complianceStatus'],
    _count: { _all: true },
  });

  const total = groups.reduce((sum, g) => sum + g._count._all, 0);
  const order: ComplianceStatus[] = [
    ComplianceStatus.PENDING,
    ComplianceStatus.APPROVED,
    ComplianceStatus.FLAGGED,
    ComplianceStatus.REJECTED,
    ComplianceStatus.UNDER_REVIEW,
  ];

  return order.map((status) => {
    const found = groups.find((g) => g.complianceStatus === status);
    const count = found?._count._all ?? 0;
    return {
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 100) / 100 : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Geographic Breakdown (stub: exchange-based geo mapping)
// ---------------------------------------------------------------------------

/**
 * Geographic breakdown stub: maps known exchange/network names to broad regions.
 * Blockchain network names (e.g., "ethereum", "bitcoin") that aren't in this map
 * will fall under "Other". Replace with a proper geo-lookup in production.
 */
const EXCHANGE_REGION_MAP: Record<string, string> = {
  Binance: 'Asia-Pacific',
  Coinbase: 'North America',
  Kraken: 'North America',
  Luno: 'Africa',
  Quidax: 'Africa',
  Bitstamp: 'Europe',
  Bitfinex: 'Europe',
};

export async function getGeographicBreakdown(): Promise<GeographicBreakdownItem[]> {
  const groups = await prisma.transaction.groupBy({
    by: ['network'],
    _count: { _all: true },
    _sum: { amountUSD: true },
  });

  const regionMap = new Map<string, { count: number; volumeUSD: number }>();

  for (const g of groups) {
    const region = EXCHANGE_REGION_MAP[g.network] ?? 'Other';
    const existing = regionMap.get(region) ?? { count: 0, volumeUSD: 0 };
    existing.count += g._count._all;
    existing.volumeUSD += g._sum.amountUSD ?? 0;
    regionMap.set(region, existing);
  }

  return Array.from(regionMap.entries())
    .map(([region, data]) => ({ region, ...data }))
    .sort((a, b) => b.volumeUSD - a.volumeUSD);
}
