/**
 * Tax Engine Service Tests for CRYPTRAC
 * Tests classifyTransaction, computeGainLoss, calculateTax, and USD_TO_NGN constants.
 */

import {
  classifyTransaction,
  computeGainLoss,
  calculateTax,
  calculateCostBasis,
  getTaxableEvents,
  USD_TO_NGN,
  VAT_RATE,
  INCOME_TAX_RATE,
} from '../tax-engine.service';
import { TaxEventType, TaxableEvent } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// FIFO lot store — kept in-memory by the service via Prisma
jest.mock('../../lib/prisma', () => {
  const lots: Array<{ id: string; userId: string; asset: string; amount: number; costPerUnit: number; totalCost: number; acquiredAt: Date; exchange: string }> = [];
  let nextId = 1;

  return {
    prisma: {
      costBasisLot: {
        findMany: jest.fn(async ({ where }: { where: { userId: string; asset: string } }) => {
          return lots
            .filter((l) => l.userId === where.userId && l.asset === where.asset)
            .sort((a, b) => a.acquiredAt.getTime() - b.acquiredAt.getTime())
            .map((l) => ({ ...l }));
        }),
        create: jest.fn(async ({ data }: { data: { userId: string; asset: string; amount: number; costPerUnit: number; totalCost: number; acquiredAt: Date; exchange: string } }) => {
          const lot = { ...data, id: String(nextId++) };
          lots.push(lot);
          return lot;
        }),
        delete: jest.fn(async ({ where }: { where: { id: string } }) => {
          const idx = lots.findIndex((l) => l.id === where.id);
          if (idx !== -1) lots.splice(idx, 1);
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: { amount: number; totalCost: number } }) => {
          const lot = lots.find((l) => l.id === where.id);
          if (lot) {
            lot.amount = data.amount;
            lot.totalCost = data.totalCost;
          }
          return lot;
        }),
        deleteMany: jest.fn(async ({ where }: { where: { userId: string } }) => {
          const before = lots.length;
          const after = lots.filter((l) => l.userId !== where.userId);
          lots.length = 0;
          lots.push(...after);
          return { count: before - lots.length };
        }),
      },
      taxableEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    },
  };
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Tax Engine constants', () => {
  it('USD_TO_NGN is 1550', () => {
    expect(USD_TO_NGN).toBe(1550);
  });

  it('VAT_RATE is 7.5%', () => {
    expect(VAT_RATE).toBeCloseTo(0.075);
  });

  it('INCOME_TAX_RATE is 15%', () => {
    expect(INCOME_TAX_RATE).toBeCloseTo(0.15);
  });
});

// ---------------------------------------------------------------------------
// classifyTransaction
// ---------------------------------------------------------------------------

describe('classifyTransaction', () => {
  const base = {
    id: 'etx-001',
    userId: 'user-001',
    exchangeId: 'ex-001',
    exchangeName: 'Binance',
    externalTxId: 'ext-001',
    asset: 'ETH',
    amount: 1,
    pricePerUnit: 2000,
    totalValueUSD: 2000,
    fee: 0,
    feeUSD: 0,
    timestamp: new Date(),
    createdAt: new Date(),
  };

  it('returns null for BUY (acquisition, not taxable)', () => {
    expect(classifyTransaction({ ...base, type: 'BUY' })).toBeNull();
  });

  it('returns null for DEPOSIT (non-taxable)', () => {
    expect(classifyTransaction({ ...base, type: 'DEPOSIT' })).toBeNull();
  });

  it('returns CAPITAL_GAIN_SHORT for SELL', () => {
    expect(classifyTransaction({ ...base, type: 'SELL' })).toBe(TaxEventType.CAPITAL_GAIN_SHORT);
  });

  it('returns CAPITAL_GAIN_SHORT for SWAP', () => {
    expect(classifyTransaction({ ...base, type: 'SWAP' })).toBe(TaxEventType.CAPITAL_GAIN_SHORT);
  });

  it('returns STAKING_REWARD for STAKING_REWARD', () => {
    expect(classifyTransaction({ ...base, type: 'STAKING_REWARD' })).toBe(TaxEventType.STAKING_REWARD);
  });

  it('returns MINING_INCOME for MINING_REWARD', () => {
    expect(classifyTransaction({ ...base, type: 'MINING_REWARD' })).toBe(TaxEventType.MINING_INCOME);
  });

  it('returns AIRDROP_INCOME for AIRDROP', () => {
    expect(classifyTransaction({ ...base, type: 'AIRDROP' })).toBe(TaxEventType.AIRDROP_INCOME);
  });

  it('returns null for unknown types', () => {
    expect(classifyTransaction({ ...base, type: 'WITHDRAWAL' as never })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeGainLoss
// ---------------------------------------------------------------------------

describe('computeGainLoss', () => {
  it('returns positive gain when proceeds > cost basis', () => {
    expect(computeGainLoss(3000, 2000)).toBe(1000);
  });

  it('returns negative loss when proceeds < cost basis', () => {
    expect(computeGainLoss(1000, 2000)).toBe(-1000);
  });

  it('returns zero when proceeds equal cost basis', () => {
    expect(computeGainLoss(1500, 1500)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateTax
// ---------------------------------------------------------------------------

describe('calculateTax', () => {
  const baseEvent: Partial<TaxableEvent> = {
    id: 'event-001',
    userId: 'user-001',
    asset: 'ETH',
    amount: 1,
    proceedsUSD: 3000,
    costBasisUSD: 2000,
    holdingPeriodDays: 100,
    isLongTerm: false,
    exchange: 'Binance',
    sourceTransaction: 'ext-001',
    timestamp: new Date(),
  };

  it('calculates capital gains tax at VAT_RATE for CAPITAL_GAIN_SHORT', () => {
    const event = calculateTax({
      ...baseEvent,
      type: TaxEventType.CAPITAL_GAIN_SHORT,
      gainLossUSD: 1000,
    });
    expect(event.taxRate).toBe(VAT_RATE);
    expect(event.taxAmountUSD).toBeCloseTo(1000 * VAT_RATE);
  });

  it('calculates capital gains tax for CAPITAL_GAIN_LONG', () => {
    const event = calculateTax({
      ...baseEvent,
      type: TaxEventType.CAPITAL_GAIN_LONG,
      gainLossUSD: 5000,
    });
    expect(event.taxRate).toBe(VAT_RATE);
    expect(event.taxAmountUSD).toBeCloseTo(5000 * VAT_RATE);
  });

  it('calculates income tax at INCOME_TAX_RATE for MINING_INCOME', () => {
    const event = calculateTax({
      ...baseEvent,
      type: TaxEventType.MINING_INCOME,
      gainLossUSD: 4000,
    });
    expect(event.taxRate).toBe(INCOME_TAX_RATE);
    expect(event.taxAmountUSD).toBeCloseTo(4000 * INCOME_TAX_RATE);
  });

  it('calculates income tax for STAKING_REWARD', () => {
    const event = calculateTax({
      ...baseEvent,
      type: TaxEventType.STAKING_REWARD,
      gainLossUSD: 200,
    });
    expect(event.taxRate).toBe(INCOME_TAX_RATE);
    expect(event.taxAmountUSD).toBeCloseTo(200 * INCOME_TAX_RATE);
  });

  it('calculates income tax for AIRDROP_INCOME', () => {
    const event = calculateTax({
      ...baseEvent,
      type: TaxEventType.AIRDROP_INCOME,
      gainLossUSD: 500,
    });
    expect(event.taxRate).toBe(INCOME_TAX_RATE);
    expect(event.taxAmountUSD).toBeCloseTo(500 * INCOME_TAX_RATE);
  });

  it('converts tax amount to NGN correctly', () => {
    const event = calculateTax({
      ...baseEvent,
      type: TaxEventType.CAPITAL_GAIN_SHORT,
      gainLossUSD: 1000,
    });
    expect(event.taxAmountNGN).toBeCloseTo(event.taxAmountUSD * USD_TO_NGN);
  });

  it('flags events with taxAmountNGN > 10,000,000 NGN', () => {
    const event = calculateTax({
      ...baseEvent,
      type: TaxEventType.CAPITAL_GAIN_SHORT,
      gainLossUSD: 100_000,
    });
    // 100000 * 0.075 * 1550 = 11,625,000 NGN > 10,000,000 → should be flagged
    expect(event.isFlagged).toBe(true);
  });

  it('does not flag events below the NGN threshold', () => {
    const event = calculateTax({
      ...baseEvent,
      type: TaxEventType.CAPITAL_GAIN_SHORT,
      gainLossUSD: 100,
    });
    // 100 * 0.075 * 1550 = 11,625 NGN < 10,000,000 → not flagged
    expect(event.isFlagged).toBe(false);
  });

  it('does not tax losses (clamps negative capital gains to 0)', () => {
    const event = calculateTax({
      ...baseEvent,
      type: TaxEventType.CAPITAL_GAIN_SHORT,
      gainLossUSD: -500,
    });
    expect(event.taxAmountUSD).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateCostBasis (FIFO via Prisma mock)
// ---------------------------------------------------------------------------

describe('calculateCostBasis (FIFO via Prisma mock)', () => {
  it('returns zero cost when no lots exist for user', async () => {
    const result = await calculateCostBasis('user-empty', 'BTC', 1, new Date());
    expect(result.totalCost).toBe(0);
    expect(result.holdingPeriodDays).toBe(0);
  });
});
