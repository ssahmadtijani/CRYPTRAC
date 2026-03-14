/**
 * Tax Engine Service for CRYPTRAC
 * FIFO cost basis calculation, taxable event classification, and NGN conversion
 */

import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import {
  ExchangeTransaction,
  TaxableEvent,
  TaxEventType,
  CostBasisLot,
} from '../types';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const USD_TO_NGN = 1550;
const NIGERIAN_TAX_RATE = 0.10;
const LONG_TERM_THRESHOLD_DAYS = 365;
const HIGH_VALUE_NGN_THRESHOLD = 10_000_000;
const MIN_LOT_AMOUNT = 0.000001; // Epsilon for floating-point lot consumption

// ---------------------------------------------------------------------------
// Helpers: map Prisma records to app types
// ---------------------------------------------------------------------------

function mapPrismaTaxableEvent(e: {
  id: string;
  userId: string;
  type: string;
  asset: string;
  amount: number;
  proceedsUSD: number;
  costBasisUSD: number;
  gainLossUSD: number;
  holdingPeriodDays: number;
  isLongTerm: boolean;
  exchange: string;
  sourceTransaction: string;
  timestamp: Date;
  taxRate: number;
  taxAmountUSD: number;
  taxAmountNGN: number;
  isFlagged: boolean;
  createdAt: Date;
}): TaxableEvent {
  return {
    id: e.id,
    userId: e.userId,
    type: e.type as TaxEventType,
    asset: e.asset,
    amount: e.amount,
    proceedsUSD: e.proceedsUSD,
    costBasisUSD: e.costBasisUSD,
    gainLossUSD: e.gainLossUSD,
    holdingPeriodDays: e.holdingPeriodDays,
    isLongTerm: e.isLongTerm,
    exchange: e.exchange,
    sourceTransaction: e.sourceTransaction,
    timestamp: e.timestamp,
    taxRate: e.taxRate,
    taxAmountUSD: e.taxAmountUSD,
    taxAmountNGN: e.taxAmountNGN,
    isFlagged: e.isFlagged,
  };
}

// ---------------------------------------------------------------------------
// FIFO lot management via Prisma
// ---------------------------------------------------------------------------

type LotWithId = CostBasisLot & { id: string };

async function getUserLots(
  userId: string,
  asset: string
): Promise<LotWithId[]> {
  const records = await prisma.costBasisLot.findMany({
    where: { userId, asset: asset.toUpperCase() },
    orderBy: { acquiredAt: 'asc' },
  });
  return records.map((r): LotWithId => ({
    id: r.id,
    asset: r.asset,
    amount: r.amount,
    costPerUnit: r.costPerUnit,
    totalCost: r.totalCost,
    acquiredAt: r.acquiredAt,
    exchange: r.exchange,
  }));
}

async function addLot(userId: string, lot: CostBasisLot): Promise<void> {
  await prisma.costBasisLot.create({
    data: {
      userId,
      asset: lot.asset.toUpperCase(),
      amount: lot.amount,
      costPerUnit: lot.costPerUnit,
      totalCost: lot.totalCost,
      acquiredAt: lot.acquiredAt,
      exchange: lot.exchange,
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function classifyTransaction(tx: ExchangeTransaction): TaxEventType | null {
  switch (tx.type) {
    case 'BUY':
    case 'DEPOSIT':
      return null;
    case 'SELL':
    case 'SWAP':
      return TaxEventType.CAPITAL_GAIN_SHORT;
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
 * Calculates FIFO cost basis for a disposal using Prisma lot records.
 */
export async function calculateCostBasis(
  userId: string,
  asset: string,
  amount: number,
  disposalDate: Date
): Promise<{ totalCost: number; holdingPeriodDays: number }> {
  const lots = await getUserLots(userId, asset);

  if (lots.length === 0) {
    return { totalCost: 0, holdingPeriodDays: 0 };
  }

  let remaining = amount;
  let totalCost = 0;
  let earliestDate: Date | null = null;

  for (const lot of lots) {
    if (remaining <= 0) break;

    const used = Math.min(remaining, lot.amount);
    totalCost += used * lot.costPerUnit;
    if (!earliestDate) earliestDate = lot.acquiredAt;

    const newAmount = lot.amount - used;
    if (newAmount <= MIN_LOT_AMOUNT) {
      await prisma.costBasisLot.delete({ where: { id: lot.id } });
    } else {
      await prisma.costBasisLot.update({
        where: { id: lot.id },
        data: { amount: newAmount, totalCost: newAmount * lot.costPerUnit },
      });
    }

    remaining -= used;
  }

  const holdingPeriodDays = earliestDate
    ? Math.floor(
        (disposalDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  return { totalCost, holdingPeriodDays };
}

export function computeGainLoss(proceeds: number, costBasis: number): number {
  return proceeds - costBasis;
}

export function calculateTax(event: Partial<TaxableEvent>): TaxableEvent {
  const gainLoss = event.gainLossUSD ?? 0;
  const taxableAmount = Math.max(gainLoss, 0);
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
 * Clears existing lots/events for this user and reprocesses from scratch.
 */
export async function processAllTransactions(
  userId: string,
  transactions: ExchangeTransaction[]
): Promise<TaxableEvent[]> {
  // Reset state for this user
  await prisma.costBasisLot.deleteMany({ where: { userId } });
  await prisma.taxableEvent.deleteMany({ where: { userId } });

  const events: TaxableEvent[] = [];
  const sorted = [...transactions].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  for (const tx of sorted) {
    if (tx.type === 'BUY' || tx.type === 'DEPOSIT') {
      await addLot(userId, {
        asset: tx.asset,
        amount: tx.amount,
        costPerUnit: tx.pricePerUnit,
        totalCost: tx.totalValueUSD,
        acquiredAt: tx.timestamp,
        exchange: tx.exchangeName,
      });
      continue;
    }

    if (
      tx.type === 'STAKING_REWARD' ||
      tx.type === 'MINING_REWARD' ||
      tx.type === 'AIRDROP'
    ) {
      await addLot(userId, {
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
      const { totalCost, holdingPeriodDays } = await calculateCostBasis(
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

  // Persist taxable events
  if (events.length > 0) {
    await prisma.taxableEvent.createMany({
      data: events.map((e) => ({
        id: e.id,
        userId: e.userId,
        type: e.type,
        asset: e.asset,
        amount: e.amount,
        proceedsUSD: e.proceedsUSD,
        costBasisUSD: e.costBasisUSD,
        gainLossUSD: e.gainLossUSD,
        holdingPeriodDays: e.holdingPeriodDays,
        isLongTerm: e.isLongTerm,
        exchange: e.exchange,
        sourceTransaction: e.sourceTransaction,
        timestamp: e.timestamp,
        taxRate: e.taxRate,
        taxAmountUSD: e.taxAmountUSD,
        taxAmountNGN: e.taxAmountNGN,
        isFlagged: e.isFlagged,
      })),
    });
  }

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

export async function getTaxableEvents(
  userId: string,
  filters?: TaxableEventFilter
): Promise<TaxableEvent[]> {
  const where: Prisma.TaxableEventWhereInput = { userId };

  if (filters?.type) where.type = filters.type;
  if (filters?.asset) where.asset = { equals: filters.asset, mode: 'insensitive' };
  if (filters?.exchange)
    where.exchange = { equals: filters.exchange, mode: 'insensitive' };
  if (filters?.taxYear) {
    const year = filters.taxYear;
    where.timestamp = {
      gte: new Date(`${year}-01-01`),
      lt: new Date(`${year + 1}-01-01`),
    };
  } else if (filters?.startDate || filters?.endDate) {
    where.timestamp = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };
  }

  const records = await prisma.taxableEvent.findMany({
    where,
    orderBy: { timestamp: 'asc' },
  });
  return records.map(mapPrismaTaxableEvent);
}
