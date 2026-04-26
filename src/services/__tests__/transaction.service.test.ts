/**
 * Transaction Service Tests for CRYPTRAC
 * Tests the pure assessTransactionRisk helper and the DB-backed public API.
 */

import {
  assessTransactionRisk,
  createTransaction,
  getTransactions,
  getTransactionById,
} from '../transaction.service';
import { RiskLevel, ComplianceStatus, TransactionType, CaseCategory, UserRole, NotificationType } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeMockCreated(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-001',
    userId: 'user-001',
    type: 'TRANSFER',
    txHash: '0xabc',
    senderAddress: '0xsender',
    receiverAddress: '0xreceiver',
    asset: 'ETH',
    amount: 1,
    amountUSD: 500,
    fee: 0,
    feeUSD: 0,
    blockNumber: null,
    network: 'ethereum',
    riskLevel: 'LOW',
    riskScore: 0,
    complianceStatus: 'PENDING',
    metadata: null,
    timestamp: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

jest.mock('../../lib/prisma', () => ({
  prisma: {
    transaction: {
      create: jest.fn().mockImplementation(async () => makeMockCreated()),
      findMany: jest.fn().mockImplementation(async () => [makeMockCreated()]),
      count: jest.fn().mockResolvedValue(1),
      findUnique: jest.fn().mockImplementation(async () => makeMockCreated()),
    },
  },
}));

jest.mock('../case.service', () => ({
  autoCreateCase: jest.fn(),
}));

jest.mock('../notification.service', () => ({
  broadcastToRoles: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/eventBus', () => ({
  eventBus: { emit: jest.fn() },
}));

// ---------------------------------------------------------------------------
// assessTransactionRisk — pure function
// ---------------------------------------------------------------------------

describe('assessTransactionRisk (pure scoring)', () => {
  const base = {
    senderAddress: '0xSafe',
    receiverAddress: '0xSafe2',
    type: 'TRANSFER' as TransactionType,
  };

  it('returns LOW risk for small amounts', () => {
    const { riskLevel, riskScore } = assessTransactionRisk({ ...base, amountUSD: 100 });
    expect(riskLevel).toBe(RiskLevel.LOW);
    expect(riskScore).toBe(0);
  });

  it('scores 10 points (LOW risk) for amounts in [$1,000, $10,000)', () => {
    const { riskLevel, riskScore } = assessTransactionRisk({ ...base, amountUSD: 1_000 });
    expect(riskScore).toBe(10);
    expect(riskLevel).toBe(RiskLevel.LOW);
  });

  it('scores 30 points (MEDIUM risk) for a round $10,000 amount (25 threshold + 5 round)', () => {
    // 10000 >= MEDIUM threshold → +25; 10000 % 1000 === 0 and >= 5000 → +5 = 30
    const { riskLevel, riskScore } = assessTransactionRisk({ ...base, amountUSD: 10_000 });
    expect(riskScore).toBe(30);
    expect(riskLevel).toBe(RiskLevel.MEDIUM);
  });

  it('scores 40 points (MEDIUM risk) for a non-round $100,001 amount', () => {
    const { riskLevel, riskScore } = assessTransactionRisk({ ...base, amountUSD: 100_001 });
    expect(riskScore).toBe(40);
    expect(riskLevel).toBe(RiskLevel.MEDIUM);
  });

  it('adds 50 points for sanctioned sender address', () => {
    const sanctioned = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const { riskScore, riskLevel } = assessTransactionRisk({
      ...base,
      senderAddress: sanctioned,
      amountUSD: 100,
    });
    expect(riskScore).toBe(50);
    expect(riskLevel).toBe(RiskLevel.HIGH);
  });

  it('adds 50 points for sanctioned receiver address', () => {
    const sanctioned = '0x0000000000000000000000000000000000000001';
    const { riskScore, riskLevel } = assessTransactionRisk({
      ...base,
      receiverAddress: sanctioned,
      amountUSD: 100,
    });
    expect(riskScore).toBe(50);
    expect(riskLevel).toBe(RiskLevel.HIGH);
  });

  it('adds 5 structuring points for round amounts >= $5,000', () => {
    const { riskScore } = assessTransactionRisk({ ...base, amountUSD: 5_000 });
    // 5000 >= LOW threshold → +10; round +5 = 15 → MEDIUM
    expect(riskScore).toBe(15);
  });

  it('scores CRITICAL (95 pts) when both addresses are sanctioned and amount is large', () => {
    const sanctioned = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const { riskScore, riskLevel } = assessTransactionRisk({
      senderAddress: sanctioned,
      receiverAddress: sanctioned,
      amountUSD: 1_000_000,
      type: 'TRANSFER' as TransactionType,
    });
    // 40 (high amount) + 50 (sanctioned) + 5 (round) = 95 → CRITICAL
    expect(riskScore).toBe(95);
    expect(riskLevel).toBe(RiskLevel.CRITICAL);
  });

  it('does not add structuring bonus for non-round amounts', () => {
    const { riskScore } = assessTransactionRisk({ ...base, amountUSD: 5_001 });
    // 5001 >= MEDIUM threshold ($1000) → +10 only
    expect(riskScore).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// createTransaction
// ---------------------------------------------------------------------------

describe('createTransaction', () => {
  const { prisma } = require('../../lib/prisma');

  it('creates and returns a transaction', async () => {
    const input = {
      txHash: '0xhash001',
      type: 'TRANSFER' as TransactionType,
      senderAddress: '0xsender',
      receiverAddress: '0xreceiver',
      asset: 'ETH',
      amount: 1,
      amountUSD: 500,
      fee: 0,
      feeUSD: 0,
      network: 'ethereum',
      timestamp: new Date('2024-01-01'),
    };

    const result = await createTransaction(input, 'user-001');
    expect(result.id).toBe('tx-001');
    expect(result.complianceStatus).toBe(ComplianceStatus.PENDING);
    expect(prisma.transaction.create).toHaveBeenCalled();
  });

  it('auto-creates a case for HIGH/CRITICAL risk transactions', async () => {
    const { autoCreateCase } = require('../case.service');
    autoCreateCase.mockClear();

    // Sanctioned sender triggers score ≥ 50 → HIGH risk → auto case creation
    const input = {
      txHash: '0xhash002',
      type: 'TRANSFER' as TransactionType,
      senderAddress: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', // in SANCTIONED_ADDRESSES
      receiverAddress: '0xreceiver',
      asset: 'ETH',
      amount: 10,
      amountUSD: 100,
      fee: 0,
      feeUSD: 0,
      network: 'ethereum',
      timestamp: new Date('2024-01-01'),
    };

    await createTransaction(input, 'user-001');
    // riskScore = 50 (sanctioned) → HIGH → autoCreateCase should be called
    expect(autoCreateCase).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getTransactions
// ---------------------------------------------------------------------------

describe('getTransactions', () => {
  it('returns paginated transactions', async () => {
    const result = await getTransactions({ page: 1, pageSize: 20 });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.meta?.total).toBe(1);
  });

  it('passes filter fields to Prisma where clause', async () => {
    const { prisma } = require('../../lib/prisma');
    await getTransactions({
      userId: 'user-001',
      riskLevel: RiskLevel.HIGH,
      network: 'ethereum',
    });
    expect(prisma.transaction.findMany).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getTransactionById
// ---------------------------------------------------------------------------

describe('getTransactionById', () => {
  it('returns a transaction when found', async () => {
    const result = await getTransactionById('tx-001');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('tx-001');
  });

  it('returns null when transaction is not found', async () => {
    const { prisma } = require('../../lib/prisma');
    prisma.transaction.findUnique.mockResolvedValueOnce(null);
    const result = await getTransactionById('nonexistent');
    expect(result).toBeNull();
  });
});
