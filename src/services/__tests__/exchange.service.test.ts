/**
 * Exchange Service Tests for CRYPTRAC
 */

import {
  connectExchange,
  getConnectedExchanges,
  getExchangeTransactions,
  getAllExchangeTransactions,
} from '../exchange.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const now = new Date('2025-01-01T00:00:00Z');

function makeMockConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-001',
    userId: 'user-001',
    exchangeName: 'Binance',
    status: 'ACTIVE',
    lastSyncedAt: null,
    transactionCount: 0,
    connectedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMockExchangeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: 'etx-001',
    userId: 'user-001',
    exchangeId: 'ex-001',
    exchangeName: 'Binance',
    externalTxId: 'EXT-001',
    type: 'BUY',
    asset: 'BTC',
    amount: 0.5,
    pricePerUnit: 65000,
    totalValueUSD: 32500,
    fee: 5,
    feeUSD: 5,
    counterAsset: null,
    counterAmount: null,
    walletAddress: null,
    timestamp: now,
    createdAt: now,
    ...overrides,
  };
}

jest.mock('../../lib/prisma', () => ({
  prisma: {
    exchangeConnection: {
      upsert: jest.fn().mockImplementation(async () => makeMockConnection()),
      findMany: jest.fn().mockImplementation(async () => [makeMockConnection()]),
      findUnique: jest.fn().mockImplementation(async () => makeMockConnection()),
      update: jest.fn().mockImplementation(async () => makeMockConnection()),
    },
    exchangeTransaction: {
      findMany: jest.fn().mockImplementation(async () => [makeMockExchangeTx()]),
      createMany: jest.fn().mockResolvedValue({ count: 5 }),
    },
  },
}));

// ---------------------------------------------------------------------------
// connectExchange
// ---------------------------------------------------------------------------

describe('connectExchange', () => {
  it('connects a valid exchange and returns a connection', async () => {
    const conn = await connectExchange('user-001', 'Binance');
    expect(conn.exchangeName).toBe('Binance');
    expect(conn.userId).toBe('user-001');
    expect(conn.status).toBe('ACTIVE');
  });

  it('connects Luno successfully', async () => {
    const { prisma } = require('../../lib/prisma');
    prisma.exchangeConnection.upsert.mockResolvedValueOnce(
      makeMockConnection({ exchangeName: 'Luno' })
    );
    const conn = await connectExchange('user-001', 'Luno');
    expect(conn.exchangeName).toBe('Luno');
  });

  it('connects Quidax successfully', async () => {
    const { prisma } = require('../../lib/prisma');
    prisma.exchangeConnection.upsert.mockResolvedValueOnce(
      makeMockConnection({ exchangeName: 'Quidax' })
    );
    const conn = await connectExchange('user-001', 'Quidax');
    expect(conn.exchangeName).toBe('Quidax');
  });

  it('throws for an unknown exchange name', async () => {
    await expect(connectExchange('user-001', 'UnknownExchange')).rejects.toThrow(
      'Unknown exchange: UnknownExchange'
    );
  });
});

// ---------------------------------------------------------------------------
// getConnectedExchanges
// ---------------------------------------------------------------------------

describe('getConnectedExchanges', () => {
  it('returns a list of connected exchanges for a user', async () => {
    const exchanges = await getConnectedExchanges('user-001');
    expect(Array.isArray(exchanges)).toBe(true);
    expect(exchanges.length).toBeGreaterThanOrEqual(1);
    expect(exchanges[0].userId).toBe('user-001');
  });

  it('returns an empty array when user has no connections', async () => {
    const { prisma } = require('../../lib/prisma');
    prisma.exchangeConnection.findMany.mockResolvedValueOnce([]);
    const exchanges = await getConnectedExchanges('user-none');
    expect(exchanges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getExchangeTransactions
// ---------------------------------------------------------------------------

describe('getExchangeTransactions', () => {
  it('returns transactions for a user and exchange', async () => {
    const txs = await getExchangeTransactions('user-001', 'Binance');
    expect(Array.isArray(txs)).toBe(true);
    expect(txs[0].exchangeName).toBe('Binance');
    expect(txs[0].asset).toBe('BTC');
    expect(txs[0].amount).toBe(0.5);
  });

  it('returns empty array when no transactions exist', async () => {
    const { prisma } = require('../../lib/prisma');
    prisma.exchangeTransaction.findMany.mockResolvedValueOnce([]);
    const txs = await getExchangeTransactions('user-001', 'Quidax');
    expect(txs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getAllExchangeTransactions
// ---------------------------------------------------------------------------

describe('getAllExchangeTransactions', () => {
  it('returns all transactions for a user across all exchanges', async () => {
    const txs = await getAllExchangeTransactions('user-001');
    expect(Array.isArray(txs)).toBe(true);
    expect(txs.length).toBeGreaterThanOrEqual(1);
  });
});
