/**
 * Tax Assessment Service for CRYPTRAC
 * Aggregates tax engine output into per-user and authority-level summaries
 */

import { v4 as uuidv4 } from 'uuid';
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
import { USD_TO_NGN, getTaxableEvents, processAllTransactions } from './tax-engine.service';
import { getAllExchangeTransactions, getConnectedExchanges } from './exchange.service';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const assessmentStore: Map<string, TaxAssessment> = new Map(); // assessmentId → assessment
const userAssessmentIndex: Map<string, string[]> = new Map(); // userId → assessmentId[]

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
    const month = e.timestamp.getMonth() + 1; // 1-based
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateAssessment(
  userId: string,
  taxYear: number,
  period: AssessmentPeriod,
  allUsers?: Map<string, User>
): Promise<TaxAssessment> {
  // Ensure latest transactions are processed
  const txs = getAllExchangeTransactions(userId);
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
  const capitalGainsTaxUSD = periodEvents
    .filter(
      (e) =>
        e.type === TaxEventType.CAPITAL_GAIN_SHORT ||
        e.type === TaxEventType.CAPITAL_GAIN_LONG
    )
    .reduce((sum, e) => sum + e.taxAmountUSD, 0);
  const incomeTaxUSD = periodEvents
    .filter(
      (e) =>
        e.type === TaxEventType.STAKING_REWARD ||
        e.type === TaxEventType.MINING_INCOME ||
        e.type === TaxEventType.AIRDROP_INCOME
    )
    .reduce((sum, e) => sum + e.taxAmountUSD, 0);

  const totalTaxLiabilityUSD = capitalGainsTaxUSD + incomeTaxUSD;
  const totalTaxLiabilityNGN = totalTaxLiabilityUSD * USD_TO_NGN;

  const exchangeBreakdown = buildExchangeBreakdown(periodEvents);

  // Build wallet breakdown from exchange transactions
  const walletBreakdown: WalletTaxBreakdown[] = [];
  const walletMap = new Map<string, WalletTaxBreakdown>();
  for (const e of periodEvents) {
    // Use exchange as wallet proxy when no explicit address
    const walletKey = `${e.exchange}-wallet`;
    if (!walletMap.has(walletKey)) {
      walletMap.set(walletKey, {
        walletAddress: walletKey,
        network: 'Multi-chain',
        transactionCount: 0,
        totalVolumeUSD: 0,
        totalGainLossUSD: 0,
        totalTaxUSD: 0,
        totalTaxNGN: 0,
      });
    }
    const wb = walletMap.get(walletKey)!;
    wb.transactionCount++;
    wb.totalVolumeUSD += e.proceedsUSD;
    wb.totalGainLossUSD += e.gainLossUSD;
    wb.totalTaxUSD += e.taxAmountUSD;
    wb.totalTaxNGN += e.taxAmountNGN;
  }
  walletBreakdown.push(...walletMap.values());

  const assessment: TaxAssessment = {
    id: uuidv4(),
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
    exchangeBreakdown,
    walletBreakdown,
    status: 'CALCULATED' as AssessmentStatus,
    generatedAt: new Date(),
  };

  assessmentStore.set(assessment.id, assessment);
  const userIds = userAssessmentIndex.get(userId) ?? [];
  userIds.push(assessment.id);
  userAssessmentIndex.set(userId, userIds);

  logger.info('Tax assessment generated', {
    userId,
    taxYear,
    period,
    totalTaxLiabilityNGN,
  });

  return assessment;
}

export function getAssessment(assessmentId: string): TaxAssessment | undefined {
  return assessmentStore.get(assessmentId);
}

export function getUserAssessments(userId: string): TaxAssessment[] {
  const ids = userAssessmentIndex.get(userId) ?? [];
  return ids.map((id) => assessmentStore.get(id)).filter(Boolean) as TaxAssessment[];
}

export interface AssessmentFilter {
  userId?: string;
  taxYear?: number;
  period?: AssessmentPeriod;
  status?: AssessmentStatus;
  minTaxNGN?: number;
}

export function getAllAssessments(filters?: AssessmentFilter): TaxAssessment[] {
  let assessments = Array.from(assessmentStore.values());

  if (!filters) return assessments;

  if (filters.userId) {
    assessments = assessments.filter((a) => a.userId === filters.userId);
  }
  if (filters.taxYear) {
    assessments = assessments.filter((a) => a.taxYear === filters.taxYear);
  }
  if (filters.period) {
    assessments = assessments.filter((a) => a.period === filters.period);
  }
  if (filters.status) {
    assessments = assessments.filter((a) => a.status === filters.status);
  }
  if (filters.minTaxNGN) {
    assessments = assessments.filter(
      (a) => a.totalTaxLiabilityNGN >= filters.minTaxNGN!
    );
  }

  return assessments;
}

export function getAggregateStats(users: User[]): TaxAuthorityDashboard {
  const allAssessments = Array.from(assessmentStore.values());

  const totalTaxLiabilityUSD = allAssessments.reduce(
    (sum, a) => sum + a.totalTaxLiabilityUSD,
    0
  );
  const totalTaxLiabilityNGN = totalTaxLiabilityUSD * USD_TO_NGN;

  const flaggedAssessments = allAssessments.filter(
    (a) => a.totalTaxLiabilityNGN > 10_000_000
  ).length;

  const filedAssessments = allAssessments.filter(
    (a) => a.status === 'FILED' || a.status === 'PAID'
  );
  const taxCollectedNGN = filedAssessments.reduce(
    (sum, a) => sum + a.totalTaxLiabilityNGN,
    0
  );
  const taxOutstandingNGN = totalTaxLiabilityNGN - taxCollectedNGN;

  // Exchange aggregation
  const exchangeMap = new Map<string, ExchangeTaxBreakdown & { userSet: Set<string> }>();
  for (const assessment of allAssessments) {
    for (const eb of assessment.exchangeBreakdown) {
      if (!exchangeMap.has(eb.exchangeName)) {
        exchangeMap.set(eb.exchangeName, {
          ...eb,
          userSet: new Set([assessment.userId]),
        });
      } else {
        const existing = exchangeMap.get(eb.exchangeName)!;
        existing.transactionCount += eb.transactionCount;
        existing.totalVolumeUSD += eb.totalVolumeUSD;
        existing.totalGainLossUSD += eb.totalGainLossUSD;
        existing.totalTaxUSD += eb.totalTaxUSD;
        existing.totalTaxNGN += eb.totalTaxNGN;
        existing.userSet.add(assessment.userId);
      }
    }
  }

  const byExchange: ExchangeTaxBreakdown[] = Array.from(exchangeMap.values()).map(
    ({ userSet: _userSet, ...rest }) => rest
  );

  // Quarterly aggregation
  const quarterMap = new Map<string, { taxUSD: number; taxNGN: number }>();
  const quarters = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1'];
  for (const q of quarters) {
    quarterMap.set(q, { taxUSD: 0, taxNGN: 0 });
  }
  for (const assessment of allAssessments) {
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

  const recentHighValueAssessments = allAssessments
    .filter((a) => a.totalTaxLiabilityNGN > 1_000_000)
    .sort((a, b) => b.totalTaxLiabilityNGN - a.totalTaxLiabilityNGN)
    .slice(0, 10);

  const uniqueTaxpayers = new Set(allAssessments.map((a) => a.userId));
  const totalTransactionsProcessed = allAssessments.reduce(
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

export function getTaxpayerSummaries(users: User[]): TaxpayerSummary[] {
  return users.map((user) => {
    const userAssessments = getUserAssessments(user.id);
    const connections = getConnectedExchanges(user.id);
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
    const latest = userAssessments.sort(
      (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime()
    )[0];
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
  });
}

/** Directly inject a pre-built assessment (used by demo seeder) */
export function injectAssessment(assessment: TaxAssessment): void {
  assessmentStore.set(assessment.id, assessment);
  const userIds = userAssessmentIndex.get(assessment.userId) ?? [];
  if (!userIds.includes(assessment.id)) {
    userIds.push(assessment.id);
    userAssessmentIndex.set(assessment.userId, userIds);
  }
}
