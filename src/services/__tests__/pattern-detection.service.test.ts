/**
 * Pattern Detection Service Tests for CRYPTRAC
 */

import {
  detectStructuring,
  detectRapidMovement,
  detectLayering,
  detectRoundTripping,
  detectAllPatterns,
  getPatternHistory,
  _patternHistoryStore,
} from '../pattern-detection.service';
import { RiskLevel, ComplianceStatus, TransactionType } from '../../types';
import type { Transaction } from '../../types';
import { prisma } from '../../lib/prisma';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

jest.mock('../../lib/prisma', () => ({
  prisma: {
    transaction: {
      findMany: jest.fn(),
    },
  },
}));

const mockFindMany = prisma.transaction.findMany as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let txCounter = 0;
function makeTx(overrides?: Partial<Transaction>): Transaction {
  txCounter++;
  const now = new Date('2024-06-15T12:00:00Z');
  return {
    id: `tx-${txCounter}`,
    txHash: `0x${'a'.repeat(64)}`,
    type: TransactionType.TRANSFER,
    senderAddress: '0xSender',
    receiverAddress: '0xReceiver',
    asset: 'USDT',
    amount: 9000,
    amountUSD: 9000,
    fee: 5,
    feeUSD: 5,
    network: 'ethereum',
    timestamp: now,
    riskLevel: RiskLevel.MEDIUM,
    riskScore: 30,
    complianceStatus: ComplianceStatus.PENDING,
    userId: 'user-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  txCounter = 0;
  _patternHistoryStore.splice(0, _patternHistoryStore.length);
});

// ---------------------------------------------------------------------------
// Structuring Detection
// ---------------------------------------------------------------------------

describe('detectStructuring', () => {
  it('detects multiple transactions just below CTR threshold', async () => {
    const sender = '0xStructurer';
    const base = new Date('2024-06-15T08:00:00Z');
    const txs = [
      makeTx({
        senderAddress: sender,
        amountUSD: 8500,
        timestamp: new Date(base.getTime()),
      }),
      makeTx({
        senderAddress: sender,
        amountUSD: 9200,
        timestamp: new Date(base.getTime() + 2 * 60 * 60 * 1000), // +2h
      }),
    ];
    mockFindMany.mockResolvedValue(txs);

    const patterns = await detectStructuring();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].walletAddress).toBe(sender);
    expect(patterns[0].transactions).toHaveLength(2);
  });

  it('does not detect structuring for single transactions', async () => {
    mockFindMany.mockResolvedValue([
      makeTx({ senderAddress: '0xLoneSender', amountUSD: 9000 }),
    ]);
    const patterns = await detectStructuring();
    expect(patterns).toHaveLength(0);
  });

  it('does not flag amounts above CTR threshold', async () => {
    const sender = '0xHighSender';
    mockFindMany.mockResolvedValue([
      makeTx({ senderAddress: sender, amountUSD: 15_000 }),
      makeTx({ senderAddress: sender, amountUSD: 20_000 }),
    ]);
    const patterns = await detectStructuring();
    expect(patterns).toHaveLength(0);
  });

  it('records pattern to history', async () => {
    const sender = '0xStructurer';
    const base = new Date('2024-06-15T08:00:00Z');
    mockFindMany.mockResolvedValue([
      makeTx({ senderAddress: sender, amountUSD: 8500, timestamp: base }),
      makeTx({
        senderAddress: sender,
        amountUSD: 9200,
        timestamp: new Date(base.getTime() + 60 * 60 * 1000),
      }),
    ]);

    await detectStructuring();
    const history = getPatternHistory();
    expect(history.some((h) => h.patternType === 'STRUCTURING')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rapid Movement Detection
// ---------------------------------------------------------------------------

describe('detectRapidMovement', () => {
  it('detects funds in and out within 1 hour', async () => {
    const wallet = '0xRapidWallet';
    const t1 = new Date('2024-06-15T08:00:00Z');
    const t2 = new Date(t1.getTime() + 30 * 60 * 1000); // +30min

    const inbound = makeTx({
      receiverAddress: wallet,
      senderAddress: '0xExternal',
      timestamp: t1,
      amountUSD: 50_000,
    });
    const outbound = makeTx({
      senderAddress: wallet,
      receiverAddress: '0xExternal2',
      timestamp: t2,
      amountUSD: 49_000,
    });
    mockFindMany.mockResolvedValue([inbound, outbound]);

    const patterns = await detectRapidMovement();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].walletAddress).toBe(wallet);
    expect(patterns[0].timeDeltaMinutes).toBe(30);
  });

  it('does not detect when time gap is more than 1 hour', async () => {
    const wallet = '0xSlowWallet';
    const t1 = new Date('2024-06-15T08:00:00Z');
    const t2 = new Date(t1.getTime() + 2 * 60 * 60 * 1000); // +2h

    mockFindMany.mockResolvedValue([
      makeTx({ receiverAddress: wallet, timestamp: t1, amountUSD: 10_000 }),
      makeTx({ senderAddress: wallet, timestamp: t2, amountUSD: 9_000 }),
    ]);

    const patterns = await detectRapidMovement();
    expect(patterns).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Layering Detection
// ---------------------------------------------------------------------------

describe('detectLayering', () => {
  it('detects 3-hop chain with decreasing amounts', async () => {
    const a = '0xWalletA';
    const b = '0xWalletB';
    const c = '0xWalletC';
    const d = '0xWalletD';

    const base = new Date('2024-06-15T08:00:00Z');
    const txs = [
      makeTx({
        senderAddress: a,
        receiverAddress: b,
        amountUSD: 100_000,
        timestamp: base,
      }),
      makeTx({
        senderAddress: b,
        receiverAddress: c,
        amountUSD: 90_000,
        timestamp: new Date(base.getTime() + 60 * 60 * 1000),
      }),
      makeTx({
        senderAddress: c,
        receiverAddress: d,
        amountUSD: 80_000,
        timestamp: new Date(base.getTime() + 2 * 60 * 60 * 1000),
      }),
    ];
    mockFindMany.mockResolvedValue(txs);

    const patterns = await detectLayering();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].hops).toBe(3);
    expect(patterns[0].originAddress).toBe(a);
    expect(patterns[0].finalAddress).toBe(d);
  });

  it('does not detect chain with increasing amounts', async () => {
    const base = new Date('2024-06-15T08:00:00Z');
    const txs = [
      makeTx({
        senderAddress: '0xA',
        receiverAddress: '0xB',
        amountUSD: 10_000,
        timestamp: base,
      }),
      makeTx({
        senderAddress: '0xB',
        receiverAddress: '0xC',
        amountUSD: 20_000, // increasing
        timestamp: new Date(base.getTime() + 60 * 60 * 1000),
      }),
      makeTx({
        senderAddress: '0xC',
        receiverAddress: '0xD',
        amountUSD: 30_000, // increasing
        timestamp: new Date(base.getTime() + 2 * 60 * 60 * 1000),
      }),
    ];
    mockFindMany.mockResolvedValue(txs);

    const patterns = await detectLayering();
    expect(patterns).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Round-Tripping Detection
// ---------------------------------------------------------------------------

describe('detectRoundTripping', () => {
  it('detects funds returning to originator', async () => {
    const origin = '0xOrigin';
    const intermediate = '0xIntermediate';
    const base = new Date('2024-06-15T08:00:00Z');

    const txs = [
      makeTx({
        senderAddress: origin,
        receiverAddress: intermediate,
        amountUSD: 50_000,
        timestamp: base,
      }),
      makeTx({
        senderAddress: intermediate,
        receiverAddress: origin,
        amountUSD: 48_000,
        timestamp: new Date(base.getTime() + 30 * 60 * 1000),
      }),
    ];
    mockFindMany.mockResolvedValue(txs);

    const patterns = await detectRoundTripping();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].originAddress).toBe(origin);
  });

  it('does not detect when funds do not return', async () => {
    const txs = [
      makeTx({ senderAddress: '0xA', receiverAddress: '0xB', amountUSD: 50_000 }),
      makeTx({ senderAddress: '0xB', receiverAddress: '0xC', amountUSD: 45_000 }),
    ];
    mockFindMany.mockResolvedValue(txs);

    const patterns = await detectRoundTripping();
    expect(patterns).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detectAllPatterns
// ---------------------------------------------------------------------------

describe('detectAllPatterns', () => {
  it('returns all pattern types and summary counts', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await detectAllPatterns();
    expect(result).toHaveProperty('structuring');
    expect(result).toHaveProperty('rapidMovement');
    expect(result).toHaveProperty('layering');
    expect(result).toHaveProperty('roundTripping');
    expect(result).toHaveProperty('summary');
    expect(result.summary.totalPatterns).toBe(
      result.structuring.length +
      result.rapidMovement.length +
      result.layering.length +
      result.roundTripping.length
    );
  });

  it('aggregates counts correctly in summary', async () => {
    // Provide 0 transactions — no patterns expected
    mockFindMany.mockResolvedValue([]);
    const result = await detectAllPatterns();
    expect(result.summary.structuringCount).toBe(0);
    expect(result.summary.rapidMovementCount).toBe(0);
    expect(result.summary.layeringCount).toBe(0);
    expect(result.summary.roundTrippingCount).toBe(0);
  });

  it('summary.detectedAt is a Date', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await detectAllPatterns();
    expect(result.summary.detectedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// getPatternHistory
// ---------------------------------------------------------------------------

describe('getPatternHistory', () => {
  it('returns an empty array initially', async () => {
    expect(getPatternHistory()).toHaveLength(0);
  });

  it('returns entries after detection', async () => {
    const sender = '0xHistorySender';
    const base = new Date('2024-06-15T08:00:00Z');
    mockFindMany.mockResolvedValue([
      makeTx({ senderAddress: sender, amountUSD: 8500, timestamp: base }),
      makeTx({
        senderAddress: sender,
        amountUSD: 9200,
        timestamp: new Date(base.getTime() + 60 * 60 * 1000),
      }),
    ]);
    await detectStructuring();
    expect(getPatternHistory().length).toBeGreaterThan(0);
  });
});
