/**
 * Tax Engine Service for CRYPTRAC
 * FIFO cost basis calculation, taxable event classification, and NGN conversion
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ExchangeTransaction,
  TaxableEvent,
  TaxEventType,
  CostBasisLot,
} from '../types';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const USD_TO_NGN = 1550;
const NIGERIAN_TAX_RATE = 0.10; // 10% flat rate
const LONG_TERM_THRESHOLD_DAYS = 365;
const HIGH_VALUE_NGN_THRESHOLD = 10_000_000; // ₦10M

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

// userId → asset → FIFO lot queue
const costBasisStore: Map<string, Map<string, CostBasisLot[]>> = new Map();

// userId → taxable events
const taxableEventStore: Map<string, TaxableEvent[]> = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserLots(userId: string, asset: string): CostBasisLot[] {
  if (!costBasisStore.has(userId)) {
    costBasisStore.set(userId, new Map());
  }
  const userMap = costBasisStore.get(userId)!;
  const key = asset.toUpperCase();
  if (!userMap.has(key)) {
    userMap.set(key, []);
  }
  return userMap.get(key)!;
}

function addLot(userId: string, lot: CostBasisLot): void {
  const lots = getUserLots(userId, lot.asset);
  lots.push(lot);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determines whether an exchange transaction is a taxable event.
 */
export function classifyTransaction(tx: ExchangeTransaction): TaxEventType | null {
  switch (tx.type) {
    case 'BUY':
      // Buying is not itself taxable; it creates a new cost basis lot
      return null;
    case 'SELL':
    case 'SWAP':
      // Disposing of an asset triggers capital gains
      return TaxEventType.CAPITAL_GAIN_SHORT; // refined later by holding period
    case 'DEPOSIT':
    case 'WITHDRAWAL':
      // Own-wallet transfers not taxable
      return null;
    case 'STAKING_REWARD':
      return TaxEventType.STAKING_REWARD;
    case 'MINING_REWARD':
      return TaxEventType.MINING_INCOME;
    case 'AIRDROP':
      return TaxEventType.AIRDROP_INCOME;
    default:
      return null;
  }
}

/**
 * Calculates FIFO cost basis for a disposal.
 * Returns the cost basis and average holding period, and mutates the lot queue.
 */
export function calculateCostBasis(
  userId: string,
  asset: string,
  amount: number,
  disposalDate: Date
): { totalCost: number; holdingPeriodDays: number } {
  const lots = getUserLots(userId, asset);

  if (lots.length === 0) {
    return { totalCost: 0, holdingPeriodDays: 0 };
  }

  let remaining = amount;
  let totalCost = 0;
  let earliestDate: Date | null = null;

  // FIFO: consume from the front
  while (remaining > 0 && lots.length > 0) {
    const lot = lots[0];
    const used = Math.min(remaining, lot.amount);

    totalCost += used * lot.costPerUnit;
    if (!earliestDate) earliestDate = lot.acquiredAt;

    lot.amount -= used;
    lot.totalCost = lot.amount * lot.costPerUnit;
    remaining -= used;

    if (lot.amount <= 0.000001) {
      lots.shift(); // lot exhausted
    }
  }

  const holdingPeriodDays = earliestDate
    ? Math.floor((disposalDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return { totalCost, holdingPeriodDays };
}

/**
 * Computes gain/loss given proceeds and cost basis.
 */
export function computeGainLoss(proceeds: number, costBasis: number): number {
  return proceeds - costBasis;
}

/**
 * Applies Nigerian crypto tax rates to produce a TaxableEvent.
 */
export function calculateTax(event: Partial<TaxableEvent>): TaxableEvent {
  const gainLoss = event.gainLossUSD ?? 0;
  const taxableAmount = Math.max(gainLoss, 0); // losses give zero tax
  const taxAmountUSD = taxableAmount * NIGERIAN_TAX_RATE;
  const taxAmountNGN = taxAmountUSD * USD_TO_NGN;

  const isFlagged = taxAmountNGN > HIGH_VALUE_NGN_THRESHOLD;

  return {
    ...event,
    taxRate: NIGERIAN_TAX_RATE,
    taxAmountUSD,
    taxAmountNGN,
    isFlagged,
  } as TaxableEvent;
}

/**
 * Processes all exchange transactions for a user into TaxableEvents.
 * Re-runs from scratch each time (idempotent via replacement).
 */
export async function processAllTransactions(
  userId: string,
  transactions: ExchangeTransaction[]
): Promise<TaxableEvent[]> {
  // Reset state for this user
  costBasisStore.delete(userId);
  const events: TaxableEvent[] = [];

  // Process in chronological order
  const sorted = [...transactions].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  for (const tx of sorted) {
    if (tx.type === 'BUY' || tx.type === 'DEPOSIT') {
      // Record cost basis lot
      addLot(userId, {
        asset: tx.asset,
        amount: tx.amount,
        costPerUnit: tx.pricePerUnit,
        totalCost: tx.totalValueUSD,
        acquiredAt: tx.timestamp,
        exchange: tx.exchangeName,
      });
      continue;
    }

    if (tx.type === 'STAKING_REWARD' || tx.type === 'MINING_REWARD' || tx.type === 'AIRDROP') {
      // Income events: fair-market value at receipt = proceeds, cost basis = 0
      addLot(userId, {
        asset: tx.asset,
        amount: tx.amount,
        costPerUnit: tx.pricePerUnit,
        totalCost: tx.totalValueUSD,
        acquiredAt: tx.timestamp,
        exchange: tx.exchangeName,
      });

      const eventTypeMap: Record<string, TaxEventType> = {
        STAKING_REWARD: TaxEventType.STAKING_REWARD,
        MINING_REWARD: TaxEventType.MINING_INCOME,
        AIRDROP: TaxEventType.AIRDROP_INCOME,
      };

      const partial: Partial<TaxableEvent> = {
        id: uuidv4(),
        userId,
        type: eventTypeMap[tx.type],
        asset: tx.asset,
        amount: tx.amount,
        proceedsUSD: tx.totalValueUSD,
        costBasisUSD: 0,
        gainLossUSD: tx.totalValueUSD,
        holdingPeriodDays: 0,
        isLongTerm: false,
        exchange: tx.exchangeName,
        sourceTransaction: tx.externalTxId,
        timestamp: tx.timestamp,
      };

      events.push(calculateTax(partial));
      continue;
    }

    if (tx.type === 'SELL' || tx.type === 'SWAP') {
      const { totalCost, holdingPeriodDays } = calculateCostBasis(
        userId,
        tx.asset,
        tx.amount,
        tx.timestamp
      );

      const proceedsUSD = tx.totalValueUSD;
      const gainLossUSD = computeGainLoss(proceedsUSD, totalCost);
      const isLongTerm = holdingPeriodDays >= LONG_TERM_THRESHOLD_DAYS;
      const type = isLongTerm
        ? TaxEventType.CAPITAL_GAIN_LONG
        : TaxEventType.CAPITAL_GAIN_SHORT;

      const partial: Partial<TaxableEvent> = {
        id: uuidv4(),
        userId,
        type,
        asset: tx.asset,
        amount: tx.amount,
        proceedsUSD,
        costBasisUSD: totalCost,
        gainLossUSD,
        holdingPeriodDays,
        isLongTerm,
        exchange: tx.exchangeName,
        sourceTransaction: tx.externalTxId,
        timestamp: tx.timestamp,
      };

      events.push(calculateTax(partial));
    }
  }

  taxableEventStore.set(userId, events);

  logger.info('Transactions processed into taxable events', {
    userId,
    inputCount: transactions.length,
    eventCount: events.length,
  });

  return events;
}

export interface TaxableEventFilter {
  type?: TaxEventType;
  asset?: string;
  exchange?: string;
  taxYear?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Returns taxable events for a user with optional filters.
 */
export function getTaxableEvents(
  userId: string,
  filters?: TaxableEventFilter
): TaxableEvent[] {
  let events = taxableEventStore.get(userId) ?? [];

  if (!filters) return events;

  if (filters.type) {
    events = events.filter((e) => e.type === filters.type);
  }
  if (filters.asset) {
    events = events.filter((e) => e.asset.toUpperCase() === filters.asset!.toUpperCase());
  }
  if (filters.exchange) {
    events = events.filter((e) =>
      e.exchange.toLowerCase() === filters.exchange!.toLowerCase()
    );
  }
  if (filters.taxYear) {
    events = events.filter((e) => e.timestamp.getFullYear() === filters.taxYear);
  }
  if (filters.startDate) {
    events = events.filter((e) => e.timestamp >= filters.startDate!);
  }
  if (filters.endDate) {
    events = events.filter((e) => e.timestamp <= filters.endDate!);
  }

  return events;
}

/** Direct injection of taxable events (used by demo seeder) */
export function injectTaxableEvents(userId: string, events: TaxableEvent[]): void {
  const existing = taxableEventStore.get(userId) ?? [];
  taxableEventStore.set(userId, [...existing, ...events]);
}
