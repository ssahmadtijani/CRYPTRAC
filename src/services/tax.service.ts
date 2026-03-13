import { v4 as uuidv4 } from 'uuid';
import {
  Transaction,
  TaxEvent,
  TaxEventType,
  TaxSummary,
  TransactionType,
} from '../types';
import { transactionService } from './transaction.service';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const taxService = {
  classifyHoldingPeriod(acquiredDate: Date, disposedDate: Date): 'SHORT' | 'LONG' {
    return disposedDate.getTime() - acquiredDate.getTime() > ONE_YEAR_MS
      ? 'LONG'
      : 'SHORT';
  },

  calculateCostBasis(
    acquisitions: Array<{ quantity: number; costPerUnit: number; date: Date }>
  ): Array<{ quantity: number; costBasis: number; acquiredDate: Date }> {
    return acquisitions
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((a) => ({
        quantity: a.quantity,
        costBasis: a.quantity * a.costPerUnit,
        acquiredDate: a.date,
      }));
  },

  calculateTaxEvents(userId: string, taxYear: number): TaxEvent[] {
    const { data: userTx } = transactionService.getTransactions({
      userId,
      limit: 1000,
    });

    const yearStart = new Date(taxYear, 0, 1);
    const yearEnd = new Date(taxYear + 1, 0, 1);

    const yearTx = userTx.filter(
      (t) => t.timestamp >= yearStart && t.timestamp < yearEnd
    );

    const events: TaxEvent[] = [];

    const acquisitions: Map<
      string,
      Array<{ quantity: number; costPerUnit: number; date: Date; txId: string }>
    > = new Map();

    for (const tx of userTx) {
      if (
        tx.type === TransactionType.DEPOSIT ||
        tx.type === TransactionType.TRANSFER
      ) {
        if (!acquisitions.has(tx.currency)) {
          acquisitions.set(tx.currency, []);
        }
        acquisitions.get(tx.currency)!.push({
          quantity: tx.amount,
          costPerUnit: tx.amount > 0 ? tx.amountUSD / tx.amount : 0,
          date: tx.timestamp,
          txId: tx.id,
        });
      }
    }

    for (const tx of yearTx) {
      const now = new Date();

      if (
        tx.type === TransactionType.TRADE ||
        tx.type === TransactionType.SWAP ||
        tx.type === TransactionType.WITHDRAWAL
      ) {
        const acqList = acquisitions.get(tx.currency) || [];
        let remaining = tx.amount;
        let totalCostBasis = 0;

        for (const acq of acqList) {
          if (remaining <= 0) break;
          const used = Math.min(remaining, acq.quantity);
          totalCostBasis += used * acq.costPerUnit;
          acq.quantity -= used;
          remaining -= used;
        }

        const proceeds = tx.amountUSD;
        const gain = proceeds - totalCostBasis;

        const acqDate =
          acqList.length > 0 ? acqList[0].date : tx.timestamp;
        const isLongTerm =
          this.classifyHoldingPeriod(acqDate, tx.timestamp) === 'LONG';

        events.push({
          id: uuidv4(),
          userId,
          transactionId: tx.id,
          type: isLongTerm
            ? TaxEventType.CAPITAL_GAIN_LONG
            : TaxEventType.CAPITAL_GAIN_SHORT,
          acquiredDate: acqDate,
          disposedDate: tx.timestamp,
          costBasis: totalCostBasis,
          proceeds,
          gain,
          currency: tx.currency,
          quantity: tx.amount,
          taxYear,
          isLongTerm,
          createdAt: now,
        });
      }

      if (tx.type === TransactionType.MINING) {
        events.push({
          id: uuidv4(),
          userId,
          transactionId: tx.id,
          type: TaxEventType.MINING_INCOME,
          acquiredDate: tx.timestamp,
          costBasis: 0,
          proceeds: tx.amountUSD,
          gain: tx.amountUSD,
          currency: tx.currency,
          quantity: tx.amount,
          taxYear,
          isLongTerm: false,
          createdAt: new Date(),
        });
      }

      if (tx.type === TransactionType.STAKING) {
        events.push({
          id: uuidv4(),
          userId,
          transactionId: tx.id,
          type: TaxEventType.STAKING_REWARD,
          acquiredDate: tx.timestamp,
          costBasis: 0,
          proceeds: tx.amountUSD,
          gain: tx.amountUSD,
          currency: tx.currency,
          quantity: tx.amount,
          taxYear,
          isLongTerm: false,
          createdAt: new Date(),
        });
      }

      if (tx.type === TransactionType.AIRDROP) {
        events.push({
          id: uuidv4(),
          userId,
          transactionId: tx.id,
          type: TaxEventType.AIRDROP_INCOME,
          acquiredDate: tx.timestamp,
          costBasis: 0,
          proceeds: tx.amountUSD,
          gain: tx.amountUSD,
          currency: tx.currency,
          quantity: tx.amount,
          taxYear,
          isLongTerm: false,
          createdAt: new Date(),
        });
      }
    }

    return events;
  },

  generateTaxSummary(userId: string, taxYear: number): TaxSummary {
    const events = this.calculateTaxEvents(userId, taxYear);

    let shortTermGains = 0;
    let longTermGains = 0;
    let miningIncome = 0;
    let stakingIncome = 0;
    let airdropIncome = 0;

    for (const event of events) {
      switch (event.type) {
        case TaxEventType.CAPITAL_GAIN_SHORT:
          shortTermGains += event.gain;
          break;
        case TaxEventType.CAPITAL_GAIN_LONG:
          longTermGains += event.gain;
          break;
        case TaxEventType.MINING_INCOME:
          miningIncome += event.gain;
          break;
        case TaxEventType.STAKING_REWARD:
          stakingIncome += event.gain;
          break;
        case TaxEventType.AIRDROP_INCOME:
          airdropIncome += event.gain;
          break;
      }
    }

    const totalGains = shortTermGains + longTermGains;
    const totalIncome = miningIncome + stakingIncome + airdropIncome;
    const totalTaxableAmount = totalGains + totalIncome;

    return {
      userId,
      taxYear,
      shortTermGains,
      longTermGains,
      totalGains,
      totalIncome,
      miningIncome,
      stakingIncome,
      airdropIncome,
      totalTaxableAmount,
      events,
    };
  },
};
/**
 * Tax Service for CRYPTRAC
 * Capital gains/losses calculation (FIFO), tax event classification,
 * and tax summary generation
 */

import { v4 as uuidv4 } from 'uuid';
import { Transaction, TaxEvent, TaxEventType, TaxSummary, TransactionType } from '../types';
import { logger } from '../utils/logger';

// In-memory tax event store (replace with Prisma in production)
const taxEvents: Map<string, TaxEvent> = new Map();

// ---------------------------------------------------------------------------
// Tax rate constants (configurable via environment in production)
// ---------------------------------------------------------------------------
const SHORT_TERM_RATE = parseFloat(process.env.TAX_SHORT_TERM_RATE ?? '0.37');
const LONG_TERM_RATE = parseFloat(process.env.TAX_LONG_TERM_RATE ?? '0.20');
const INCOME_RATE = parseFloat(process.env.TAX_INCOME_RATE ?? '0.30');
const LONG_TERM_THRESHOLD_DAYS = 365;

// ---------------------------------------------------------------------------
// FIFO cost basis tracking
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
      // Income events: proceeds = fair market value, costBasis = 0
      costBasis = 0;
      gainLoss = proceeds;
      proceeds = tx.amountUSD;

      // Record incoming assets as new lots
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

    taxEvents.set(taxEvent.id, taxEvent);
    events.push(taxEvent);
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
      // Disposals trigger capital gains/losses
      return TaxEventType.CAPITAL_GAIN_SHORT; // refined by holding period later

    case TransactionType.TRANSFER:
    case TransactionType.WITHDRAWAL:
      // Pure transfers between own wallets are generally not taxable
      return null;

    case TransactionType.DEPOSIT:
      // Receiving assets — record lot, not a taxable event itself
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

  // Determine processing order based on method
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
 * Call this when receiving/buying assets.
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
