/**
 * Tax Service for CRYPTRAC
 * Capital gains/losses calculation (FIFO), tax event classification,
 * and tax summary generation
 */

import { v4 as uuidv4 } from 'uuid';
import { Transaction, TaxEvent, TaxEventType, TaxSummary, TransactionType } from '../types';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

// ---------------------------------------------------------------------------
// Tax rate constants (configurable via environment in production)
// ---------------------------------------------------------------------------
const SHORT_TERM_RATE = parseFloat(process.env.TAX_SHORT_TERM_RATE ?? '0.37');
const LONG_TERM_RATE = parseFloat(process.env.TAX_LONG_TERM_RATE ?? '0.20');
const INCOME_RATE = parseFloat(process.env.TAX_INCOME_RATE ?? '0.30');
const LONG_TERM_THRESHOLD_DAYS = 365;

// ---------------------------------------------------------------------------
// FIFO cost basis tracking (in-memory, scoped per calculateTaxEvents call)
// ---------------------------------------------------------------------------

interface CostBasisLot {
  amount: number;
  costPerUnit: number;
  acquiredAt: Date;
}

// Asset → ordered queue of lots (FIFO)
const costBasisLots: Map<string, CostBasisLot[]> = new Map();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculates tax events for a user for a given tax year, using FIFO method.
 * Stores resulting events to the database.
 */
export async function calculateTaxEvents(
  userId: string,
  taxYear: number,
  transactions: Transaction[]
): Promise<TaxEvent[]> {
  const yearTransactions = transactions
    .filter((t) => t.userId === userId && t.timestamp.getFullYear() === taxYear)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const events: TaxEvent[] = [];

  for (const tx of yearTransactions) {
    const event = classifyTaxEvent(tx);
    if (!event) continue;

    let gainLoss = 0;
    let costBasis = 0;
    let proceeds = tx.amountUSD;
    let holdingPeriodDays = 0;

    if (
      event === TaxEventType.CAPITAL_GAIN_SHORT ||
      event === TaxEventType.CAPITAL_GAIN_LONG
    ) {
      const result = calculateCostBasis(tx.asset, tx.amount, 'FIFO');
      costBasis = result.totalCost;
      holdingPeriodDays = result.holdingPeriodDays;
      gainLoss = proceeds - costBasis;
    } else {
      costBasis = 0;
      gainLoss = proceeds;
      proceeds = tx.amountUSD;
      addToLots(tx.asset, tx.amount, tx.amountUSD / tx.amount, tx.timestamp);
    }

    const isShortTerm = holdingPeriodDays < LONG_TERM_THRESHOLD_DAYS;
    const taxRate = isIncomeTaxEvent(event)
      ? INCOME_RATE
      : isShortTerm
      ? SHORT_TERM_RATE
      : LONG_TERM_RATE;

    const taxableAmount = Math.max(gainLoss, 0);
    const taxOwed = taxableAmount * taxRate;

    const taxEvent: TaxEvent = {
      id: uuidv4(),
      userId,
      transactionId: tx.id,
      eventType: event,
      asset: tx.asset,
      amount: tx.amount,
      costBasis,
      proceeds,
      gainLoss,
      holdingPeriodDays,
      taxYear,
      taxableAmount,
      taxRate,
      taxOwed,
      createdAt: new Date(),
    };

    events.push(taxEvent);
  }

  // Persist tax events
  if (events.length > 0) {
    await prisma.taxEvent.createMany({
      data: events.map((e) => ({
        id: e.id,
        userId: e.userId,
        transactionId: e.transactionId,
        eventType: e.eventType,
        asset: e.asset,
        amount: e.amount,
        costBasis: e.costBasis,
        proceeds: e.proceeds,
        gainLoss: e.gainLoss,
        holdingPeriodDays: e.holdingPeriodDays,
        taxYear: e.taxYear,
        taxableAmount: e.taxableAmount,
        taxRate: e.taxRate,
        taxOwed: e.taxOwed,
      })),
    });
  }

  logger.info('Tax events calculated', {
    userId,
    taxYear,
    eventCount: events.length,
  });

  return events;
}

/**
 * Aggregates tax events into a summary for a user and tax year.
 */
export async function generateTaxSummary(
  userId: string,
  taxYear: number,
  transactions: Transaction[]
): Promise<TaxSummary> {
  const events = await calculateTaxEvents(userId, taxYear, transactions);

  const summary: TaxSummary = {
    userId,
    taxYear,
    totalShortTermGains: 0,
    totalLongTermGains: 0,
    totalIncome: 0,
    totalMiningIncome: 0,
    totalStakingRewards: 0,
    totalAirdropIncome: 0,
    totalTaxableIncome: 0,
    estimatedTaxOwed: 0,
    events,
    generatedAt: new Date(),
  };

  for (const event of events) {
    switch (event.eventType) {
      case TaxEventType.CAPITAL_GAIN_SHORT:
        summary.totalShortTermGains += event.gainLoss;
        break;
      case TaxEventType.CAPITAL_GAIN_LONG:
        summary.totalLongTermGains += event.gainLoss;
        break;
      case TaxEventType.INCOME:
        summary.totalIncome += event.taxableAmount;
        break;
      case TaxEventType.MINING_INCOME:
        summary.totalMiningIncome += event.taxableAmount;
        break;
      case TaxEventType.STAKING_REWARD:
        summary.totalStakingRewards += event.taxableAmount;
        break;
      case TaxEventType.AIRDROP_INCOME:
        summary.totalAirdropIncome += event.taxableAmount;
        break;
    }

    summary.estimatedTaxOwed += event.taxOwed;
  }

  summary.totalTaxableIncome =
    Math.max(summary.totalShortTermGains, 0) +
    Math.max(summary.totalLongTermGains, 0) +
    summary.totalIncome +
    summary.totalMiningIncome +
    summary.totalStakingRewards +
    summary.totalAirdropIncome;

  logger.info('Tax summary generated', {
    userId,
    taxYear,
    totalTaxableIncome: summary.totalTaxableIncome,
    estimatedTaxOwed: summary.estimatedTaxOwed,
  });

  return summary;
}

/**
 * Classifies a transaction as a specific TaxEventType, or null if not taxable.
 */
export function classifyTaxEvent(transaction: Transaction): TaxEventType | null {
  switch (transaction.type) {
    case TransactionType.TRADE:
    case TransactionType.SWAP:
      return TaxEventType.CAPITAL_GAIN_SHORT;

    case TransactionType.TRANSFER:
    case TransactionType.WITHDRAWAL:
      return null;

    case TransactionType.DEPOSIT:
      return null;

    case TransactionType.MINING:
      return TaxEventType.MINING_INCOME;

    case TransactionType.STAKING:
      return TaxEventType.STAKING_REWARD;

    case TransactionType.AIRDROP:
      return TaxEventType.AIRDROP_INCOME;

    default:
      return null;
  }
}

/**
 * Calculates cost basis using FIFO for a given asset and disposal amount.
 * Uses the module-level costBasisLots Map (maintained across calls within a session).
 */
export function calculateCostBasis(
  asset: string,
  amount: number,
  method: 'FIFO' | 'LIFO' | 'HIFO' = 'FIFO'
): { totalCost: number; holdingPeriodDays: number } {
  const lots = costBasisLots.get(asset.toUpperCase()) ?? [];

  if (lots.length === 0) {
    return { totalCost: 0, holdingPeriodDays: 0 };
  }

  let remaining = amount;
  let totalCost = 0;
  let earliestAcquisitionDate: Date | null = null;

  const processLots = method === 'FIFO' ? [...lots] : [...lots].reverse();

  for (const lot of processLots) {
    if (remaining <= 0) break;

    const usedAmount = Math.min(remaining, lot.amount);
    totalCost += usedAmount * lot.costPerUnit;

    if (earliestAcquisitionDate === null) {
      earliestAcquisitionDate = lot.acquiredAt;
    }

    remaining -= usedAmount;
  }

  const holdingPeriodDays =
    earliestAcquisitionDate !== null
      ? Math.floor(
          (Date.now() - earliestAcquisitionDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0;

  return { totalCost, holdingPeriodDays };
}

/**
 * Adds a new lot to the FIFO queue for an asset.
 */
export function addToLots(
  asset: string,
  amount: number,
  costPerUnit: number,
  acquiredAt: Date
): void {
  const key = asset.toUpperCase();
  if (!costBasisLots.has(key)) {
    costBasisLots.set(key, []);
  }
  costBasisLots.get(key)!.push({ amount, costPerUnit, acquiredAt });
}

/**
 * Clears all stored lots (useful for testing).
 */
export function clearLots(): void {
  costBasisLots.clear();
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function isIncomeTaxEvent(eventType: TaxEventType): boolean {
  return [
    TaxEventType.INCOME,
    TaxEventType.MINING_INCOME,
    TaxEventType.STAKING_REWARD,
    TaxEventType.AIRDROP_INCOME,
  ].includes(eventType);
}
