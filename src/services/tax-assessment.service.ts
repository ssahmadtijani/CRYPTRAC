/**
 * Tax Assessment Service for CRYPTRAC
 * Aggregates tax engine output into per-user and authority-level summaries
 */

import { Prisma } from '@prisma/client';
import {
  TaxAssessment,
  TaxableEvent,
  TaxEventType,
  AssessmentPeriod,
  AssessmentStatus,
  ExchangeTaxBreakdown,
  WalletTaxBreakdown,
  TaxpayerSummary,
  TaxAuthorityDashboard,
  User,
} from '../types';
import { USD_TO_NGN, VAT_RATE, INCOME_TAX_RATE, getTaxableEvents, processAllTransactions } from './tax-engine.service';
import { getAllExchangeTransactions, getConnectedExchanges } from './exchange.service';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function periodMonths(period: AssessmentPeriod): { start: number; end: number } {
  const map: Record<AssessmentPeriod, { start: number; end: number }> = {
    Q1: { start: 1, end: 3 },
    Q2: { start: 4, end: 6 },
    Q3: { start: 7, end: 9 },
    Q4: { start: 10, end: 12 },
    ANNUAL: { start: 1, end: 12 },
  };
  return map[period];
}

function filterEventsByPeriod(
  events: TaxableEvent[],
  taxYear: number,
  period: AssessmentPeriod
): TaxableEvent[] {
  const { start, end } = periodMonths(period);
  return events.filter((e) => {
    const year = e.timestamp.getFullYear();
    const month = e.timestamp.getMonth() + 1;
    return year === taxYear && month >= start && month <= end;
  });
}

function buildExchangeBreakdown(events: TaxableEvent[]): ExchangeTaxBreakdown[] {
  const map = new Map<string, ExchangeTaxBreakdown>();

  for (const e of events) {
    if (!map.has(e.exchange)) {
      map.set(e.exchange, {
        exchangeName: e.exchange,
        transactionCount: 0,
        totalVolumeUSD: 0,
        totalGainLossUSD: 0,
        totalTaxUSD: 0,
        totalTaxNGN: 0,
      });
    }
    const b = map.get(e.exchange)!;
    b.transactionCount++;
    b.totalVolumeUSD += e.proceedsUSD;
    b.totalGainLossUSD += e.gainLossUSD;
    b.totalTaxUSD += e.taxAmountUSD;
    b.totalTaxNGN += e.taxAmountNGN;
  }

  return Array.from(map.values());
}

function mapPrismaAssessment(a: {
  id: string;
  userId: string;
  taxYear: number;
  period: string;
  totalTransactions: number;
  totalTaxableEvents: number;
  totalProceedsUSD: number;
  totalCostBasisUSD: number;
  netCapitalGainUSD: number;
  shortTermGainUSD: number;
  longTermGainUSD: number;
  stakingIncomeUSD: number;
  miningIncomeUSD: number;
  airdropIncomeUSD: number;
  totalIncomeUSD: number;
  capitalGainsTaxUSD: number;
  incomeTaxUSD: number;
  totalTaxLiabilityUSD: number;
  totalTaxLiabilityNGN: number;
  exchangeBreakdown: unknown;
  walletBreakdown: unknown;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  filedAt: Date | null;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): TaxAssessment {
  return {
    id: a.id,
    userId: a.userId,
    taxYear: a.taxYear,
    period: a.period as AssessmentPeriod,
    totalTransactions: a.totalTransactions,
    totalTaxableEvents: a.totalTaxableEvents,
    totalProceedsUSD: a.totalProceedsUSD,
    totalCostBasisUSD: a.totalCostBasisUSD,
    netCapitalGainUSD: a.netCapitalGainUSD,
    shortTermGainUSD: a.shortTermGainUSD,
    longTermGainUSD: a.longTermGainUSD,
    stakingIncomeUSD: a.stakingIncomeUSD,
    miningIncomeUSD: a.miningIncomeUSD,
    airdropIncomeUSD: a.airdropIncomeUSD,
    totalIncomeUSD: a.totalIncomeUSD,
    capitalGainsTaxUSD: a.capitalGainsTaxUSD,
    incomeTaxUSD: a.incomeTaxUSD,
    totalTaxLiabilityUSD: a.totalTaxLiabilityUSD,
    totalTaxLiabilityNGN: a.totalTaxLiabilityNGN,
    exchangeBreakdown: (a.exchangeBreakdown as ExchangeTaxBreakdown[]) ?? [],
    walletBreakdown: (a.walletBreakdown as WalletTaxBreakdown[]) ?? [],
    status: a.status as AssessmentStatus,
    generatedAt: a.generatedAt,
    reviewedBy: a.reviewedBy ?? undefined,
    reviewedAt: a.reviewedAt ?? undefined,
    filedAt: a.filedAt ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateAssessment(
  userId: string,
  taxYear: number,
  period: AssessmentPeriod
): Promise<TaxAssessment> {
  const txs = await getAllExchangeTransactions(userId);
  const allEvents = await processAllTransactions(userId, txs);
  const periodEvents = filterEventsByPeriod(allEvents, taxYear, period);

  let shortTermGainUSD = 0;
  let longTermGainUSD = 0;
  let stakingIncomeUSD = 0;
  let miningIncomeUSD = 0;
  let airdropIncomeUSD = 0;
  let totalProceedsUSD = 0;
  let totalCostBasisUSD = 0;

  for (const e of periodEvents) {
    totalProceedsUSD += e.proceedsUSD;
    totalCostBasisUSD += e.costBasisUSD;

    switch (e.type) {
      case TaxEventType.CAPITAL_GAIN_SHORT:
        shortTermGainUSD += e.gainLossUSD;
        break;
      case TaxEventType.CAPITAL_GAIN_LONG:
        longTermGainUSD += e.gainLossUSD;
        break;
      case TaxEventType.STAKING_REWARD:
        stakingIncomeUSD += e.gainLossUSD;
        break;
      case TaxEventType.MINING_INCOME:
        miningIncomeUSD += e.gainLossUSD;
        break;
      case TaxEventType.AIRDROP_INCOME:
        airdropIncomeUSD += e.gainLossUSD;
        break;
    }
  }

  const netCapitalGainUSD = shortTermGainUSD + longTermGainUSD;
  const totalIncomeUSD = stakingIncomeUSD + miningIncomeUSD + airdropIncomeUSD;
  const capitalGainsTaxUSD = Math.max(netCapitalGainUSD, 0) * VAT_RATE;
  const incomeTaxUSD = Math.max((totalIncomeUSD * INCOME_TAX_RATE) - capitalGainsTaxUSD, 0);

  const totalTaxLiabilityUSD = capitalGainsTaxUSD + incomeTaxUSD;
  const totalTaxLiabilityNGN = totalTaxLiabilityUSD * USD_TO_NGN;
  const exchangeBreakdown = buildExchangeBreakdown(periodEvents);

  const walletMap = new Map<string, WalletTaxBreakdown>();
  for (const e of periodEvents) {
    const key = `${e.exchange}-wallet`;
    if (!walletMap.has(key)) {
      walletMap.set(key, {
        walletAddress: key,
        network: 'Multi-chain',
        transactionCount: 0,
        totalVolumeUSD: 0,
        totalGainLossUSD: 0,
        totalTaxUSD: 0,
        totalTaxNGN: 0,
      });
    }
    const wb = walletMap.get(key)!;
    wb.transactionCount++;
    wb.totalVolumeUSD += e.proceedsUSD;
    wb.totalGainLossUSD += e.gainLossUSD;
    wb.totalTaxUSD += e.taxAmountUSD;
    wb.totalTaxNGN += e.taxAmountNGN;
  }
  const walletBreakdown = Array.from(walletMap.values());

  const record = await prisma.taxAssessment.upsert({
    where: { userId_taxYear_period: { userId, taxYear, period } },
    create: {
      userId,
      taxYear,
      period,
      totalTransactions: txs.length,
      totalTaxableEvents: periodEvents.length,
      totalProceedsUSD,
      totalCostBasisUSD,
      netCapitalGainUSD,
      shortTermGainUSD,
      longTermGainUSD,
      stakingIncomeUSD,
      miningIncomeUSD,
      airdropIncomeUSD,
      totalIncomeUSD,
      capitalGainsTaxUSD,
      incomeTaxUSD,
      totalTaxLiabilityUSD,
      totalTaxLiabilityNGN,
      exchangeBreakdown: exchangeBreakdown as object,
      walletBreakdown: walletBreakdown as object,
      status: 'CALCULATED',
    },
    update: {
      totalTransactions: txs.length,
      totalTaxableEvents: periodEvents.length,
      totalProceedsUSD,
      totalCostBasisUSD,
      netCapitalGainUSD,
      shortTermGainUSD,
      longTermGainUSD,
      stakingIncomeUSD,
      miningIncomeUSD,
      airdropIncomeUSD,
      totalIncomeUSD,
      capitalGainsTaxUSD,
      incomeTaxUSD,
      totalTaxLiabilityUSD,
      totalTaxLiabilityNGN,
      exchangeBreakdown: exchangeBreakdown as object,
      walletBreakdown: walletBreakdown as object,
      status: 'CALCULATED',
      generatedAt: new Date(),
    },
  });

  logger.info('Tax assessment generated', {
    userId,
    taxYear,
    period,
    totalTaxLiabilityNGN,
  });

  return mapPrismaAssessment(record);
}

export async function getAssessment(
  assessmentId: string
): Promise<TaxAssessment | undefined> {
  const found = await prisma.taxAssessment.findUnique({
    where: { id: assessmentId },
  });
  return found ? mapPrismaAssessment(found) : undefined;
}

export async function getUserAssessments(userId: string): Promise<TaxAssessment[]> {
  const records = await prisma.taxAssessment.findMany({
    where: { userId },
    orderBy: { generatedAt: 'desc' },
  });
  return records.map(mapPrismaAssessment);
}

export interface AssessmentFilter {
  userId?: string;
  taxYear?: number;
  period?: AssessmentPeriod;
  status?: AssessmentStatus;
  minTaxNGN?: number;
}

export async function getAllAssessments(
  filters?: AssessmentFilter
): Promise<TaxAssessment[]> {
  const where: Prisma.TaxAssessmentWhereInput = {};

  if (filters?.userId) where.userId = filters.userId;
  if (filters?.taxYear) where.taxYear = filters.taxYear;
  if (filters?.period) where.period = filters.period;
  if (filters?.status) where.status = filters.status;
  if (filters?.minTaxNGN !== undefined)
    where.totalTaxLiabilityNGN = { gte: filters.minTaxNGN };

  const records = await prisma.taxAssessment.findMany({ where });
  return records.map(mapPrismaAssessment);
}

export async function getAggregateStats(
  users: User[]
): Promise<TaxAuthorityDashboard> {
  const allAssessments = await prisma.taxAssessment.findMany();
  const mapped = allAssessments.map(mapPrismaAssessment);

  const totalTaxLiabilityUSD = mapped.reduce(
    (sum, a) => sum + a.totalTaxLiabilityUSD,
    0
  );
  const totalTaxLiabilityNGN = totalTaxLiabilityUSD * USD_TO_NGN;

  const flaggedAssessments = mapped.filter(
    (a) => a.totalTaxLiabilityNGN > 10_000_000
  ).length;

  const filedAssessments = mapped.filter(
    (a) => a.status === 'FILED' || a.status === 'PAID'
  );
  const taxCollectedNGN = filedAssessments.reduce(
    (sum, a) => sum + a.totalTaxLiabilityNGN,
    0
  );
  const taxOutstandingNGN = totalTaxLiabilityNGN - taxCollectedNGN;

  // Exchange aggregation
  const exchangeMap = new Map<string, ExchangeTaxBreakdown>();
  for (const assessment of mapped) {
    for (const eb of assessment.exchangeBreakdown) {
      if (!exchangeMap.has(eb.exchangeName)) {
        exchangeMap.set(eb.exchangeName, { ...eb });
      } else {
        const existing = exchangeMap.get(eb.exchangeName)!;
        existing.transactionCount += eb.transactionCount;
        existing.totalVolumeUSD += eb.totalVolumeUSD;
        existing.totalGainLossUSD += eb.totalGainLossUSD;
        existing.totalTaxUSD += eb.totalTaxUSD;
        existing.totalTaxNGN += eb.totalTaxNGN;
      }
    }
  }
  const byExchange = Array.from(exchangeMap.values());

  // Quarterly aggregation
  const quarterMap = new Map<string, { taxUSD: number; taxNGN: number }>();
  const quarters = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1'];
  for (const q of quarters) quarterMap.set(q, { taxUSD: 0, taxNGN: 0 });

  for (const assessment of mapped) {
    const key = `${assessment.taxYear}-${assessment.period}`;
    if (quarterMap.has(key)) {
      const entry = quarterMap.get(key)!;
      entry.taxUSD += assessment.totalTaxLiabilityUSD;
      entry.taxNGN += assessment.totalTaxLiabilityNGN;
    }
  }
  const byQuarter = Array.from(quarterMap.entries()).map(([period, vals]) => ({
    period,
    ...vals,
  }));

  const recentHighValueAssessments = mapped
    .filter((a) => a.totalTaxLiabilityNGN > 1_000_000)
    .sort((a, b) => b.totalTaxLiabilityNGN - a.totalTaxLiabilityNGN)
    .slice(0, 10);

  const uniqueTaxpayers = new Set(mapped.map((a) => a.userId));
  const totalTransactionsProcessed = mapped.reduce(
    (sum, a) => sum + a.totalTransactions,
    0
  );

  return {
    totalTaxpayers: uniqueTaxpayers.size || users.length,
    totalTaxLiabilityNGN,
    totalTaxLiabilityUSD,
    totalTransactionsProcessed,
    flaggedAssessments,
    taxCollectedNGN,
    taxOutstandingNGN,
    byExchange,
    byQuarter,
    recentHighValueAssessments,
  };
}

export async function getTaxpayerSummaries(
  users: User[]
): Promise<TaxpayerSummary[]> {
  return Promise.all(
    users.map(async (user) => {
      const userAssessments = await getUserAssessments(user.id);
      const connections = await getConnectedExchanges(user.id);
      const totalTaxLiabilityUSD = userAssessments.reduce(
        (sum, a) => sum + a.totalTaxLiabilityUSD,
        0
      );
      const totalTaxLiabilityNGN = totalTaxLiabilityUSD * USD_TO_NGN;
      const totalVolumeUSD = userAssessments.reduce(
        (sum, a) => sum + a.totalProceedsUSD,
        0
      );
      const totalTransactions = userAssessments.reduce(
        (sum, a) => sum + a.totalTransactions,
        0
      );
      const latest = userAssessments[0];
      const lastActivity = latest?.generatedAt;

      return {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        totalTransactions,
        totalVolumeUSD,
        totalTaxLiabilityUSD,
        totalTaxLiabilityNGN,
        exchanges: connections.map((c) => c.exchangeName),
        latestAssessmentStatus: latest?.status,
        isFlagged: totalTaxLiabilityNGN > 10_000_000,
        lastActivity,
      };
    })
  );
}
