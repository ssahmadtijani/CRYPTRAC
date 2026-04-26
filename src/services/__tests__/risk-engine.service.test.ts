/**
 * Risk Engine Service Tests for CRYPTRAC
 * Tests the heuristic scoring engine, composite scoring, and config API.
 */

import {
  assessTransactionRisk,
  assessAddressRisk,
  getRiskHeuristics,
  updateHeuristicWeights,
  RiskAssessmentResult,
} from '../risk-engine.service';
import { RiskLevel, ComplianceStatus } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../lib/prisma', () => ({
  prisma: {
    transaction: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  },
}));

// Sanctions service — default to clean addresses
jest.mock('../sanctions.service', () => ({
  checkAddress: jest.fn().mockReturnValue({ isSanctioned: false, entries: [] }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTransaction(overrides: Partial<{
  id: string;
  txHash: string;
  type: string;
  senderAddress: string;
  receiverAddress: string;
  asset: string;
  amount: number;
  amountUSD: number;
  fee: number;
  feeUSD: number;
  blockNumber?: number;
  network: string;
  timestamp: Date;
  riskLevel: string;
  riskScore: number;
  complianceStatus: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  const now = new Date();
  return {
    id: 'tx-001',
    txHash: '0xabc',
    type: 'TRANSFER',
    senderAddress: '0xsender',
    receiverAddress: '0xreceiver',
    asset: 'ETH',
    amount: 1,
    amountUSD: 500,
    fee: 0,
    feeUSD: 0,
    network: 'ethereum',
    timestamp: now,
    riskLevel: RiskLevel.LOW,
    riskScore: 0,
    complianceStatus: ComplianceStatus.PENDING,
    userId: 'user-001',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// assessTransactionRisk (full heuristic engine)
// ---------------------------------------------------------------------------

describe('assessTransactionRisk (heuristics)', () => {
  it('returns a valid RiskAssessmentResult for a clean transaction', async () => {
    const tx = makeTransaction();
    const result: RiskAssessmentResult = await assessTransactionRisk(tx as never);

    expect(result).toHaveProperty('compositeScore');
    expect(result).toHaveProperty('riskLevel');
    expect(result).toHaveProperty('heuristics');
    expect(result).toHaveProperty('assessedAt');
    expect(result.heuristics).toHaveLength(5);
    expect(result.assessedAt).toBeInstanceOf(Date);
  });

  it('gives LOW risk score for a small, clean transaction', async () => {
    const tx = makeTransaction({ amountUSD: 100 });
    const result = await assessTransactionRisk(tx as never);

    expect(result.compositeScore).toBeLessThan(25);
    expect(result.riskLevel).toBe(RiskLevel.LOW);
  });

  it('triggers roundAmount heuristic for $10,000 round transaction', async () => {
    const tx = makeTransaction({ amountUSD: 10_000 });
    const result = await assessTransactionRisk(tx as never);

    const roundHeuristic = result.heuristics.find((h) => h.name === 'roundAmount');
    expect(roundHeuristic?.triggered).toBe(true);
    expect(roundHeuristic?.score).toBe(40);
  });

  it('does not trigger roundAmount for small amounts below $5,000', async () => {
    const tx = makeTransaction({ amountUSD: 4_000 });
    const result = await assessTransactionRisk(tx as never);

    const roundHeuristic = result.heuristics.find((h) => h.name === 'roundAmount');
    expect(roundHeuristic?.triggered).toBe(false);
  });

  it('triggers sanctionedAddress heuristic when sender is sanctioned', async () => {
    const { checkAddress } = require('../sanctions.service');
    checkAddress.mockImplementationOnce(() => ({ isSanctioned: true, entries: [{ name: 'BadActor' }] }));
    checkAddress.mockImplementationOnce(() => ({ isSanctioned: false, entries: [] }));

    const tx = makeTransaction({ senderAddress: '0xevil' });
    const result = await assessTransactionRisk(tx as never);

    const sanctionHeuristic = result.heuristics.find((h) => h.name === 'sanctionedAddress');
    expect(sanctionHeuristic?.triggered).toBe(true);
    expect(sanctionHeuristic?.score).toBe(100);
  });

  it('triggers structuring heuristic when Prisma returns >= 3 near-threshold transactions', async () => {
    const { prisma } = require('../../lib/prisma');
    // structuring count (first call), rapidMovement inbound (second), outbound (third), highFreq (fourth)
    prisma.transaction.count
      .mockResolvedValueOnce(3)  // structuring
      .mockResolvedValueOnce(0)  // rapid inbound
      .mockResolvedValueOnce(0)  // rapid outbound
      .mockResolvedValueOnce(2); // highFreq

    const tx = makeTransaction({ amountUSD: 9_500 });
    const result = await assessTransactionRisk(tx as never);

    const structuringHeuristic = result.heuristics.find((h) => h.name === 'structuring');
    expect(structuringHeuristic?.triggered).toBe(true);
  });

  it('triggers rapidMovement heuristic when address has both inbound and outbound', async () => {
    const { prisma } = require('../../lib/prisma');
    prisma.transaction.count
      .mockResolvedValueOnce(0)  // structuring
      .mockResolvedValueOnce(2)  // rapid inbound
      .mockResolvedValueOnce(1)  // rapid outbound
      .mockResolvedValueOnce(0); // highFreq

    const tx = makeTransaction();
    const result = await assessTransactionRisk(tx as never);

    const rapidHeuristic = result.heuristics.find((h) => h.name === 'rapidMovement');
    expect(rapidHeuristic?.triggered).toBe(true);
    expect(rapidHeuristic?.score).toBe(70);
  });
});

// ---------------------------------------------------------------------------
// assessAddressRisk
// ---------------------------------------------------------------------------

describe('assessAddressRisk', () => {
  it('returns a valid result for an address with no prior history', async () => {
    const result = await assessAddressRisk('0xnewaddress');
    expect(result).toHaveProperty('compositeScore');
    expect(result.heuristics).toHaveLength(5);
  });

  it('uses the most recent transaction as context when history exists', async () => {
    const { prisma } = require('../../lib/prisma');
    const now = new Date();
    prisma.transaction.findFirst.mockResolvedValueOnce({
      id: 'tx-history',
      txHash: '0xhash',
      type: 'TRANSFER',
      senderAddress: '0xknown',
      receiverAddress: '0xother',
      asset: 'ETH',
      amount: 5,
      amountUSD: 15_000,
      fee: 0,
      feeUSD: 0,
      blockNumber: null,
      network: 'ethereum',
      timestamp: now,
      riskLevel: 'MEDIUM',
      riskScore: 25,
      complianceStatus: 'PENDING',
      userId: 'user-001',
      createdAt: now,
      updatedAt: now,
    });

    const result = await assessAddressRisk('0xknown');
    expect(result).not.toBeNull();
    expect(result.assessedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// getRiskHeuristics
// ---------------------------------------------------------------------------

describe('getRiskHeuristics', () => {
  it('returns exactly 5 named heuristic configs', () => {
    const heuristics = getRiskHeuristics();
    expect(heuristics).toHaveLength(5);
    const names = heuristics.map((h) => h.name);
    expect(names).toContain('structuring');
    expect(names).toContain('rapidMovement');
    expect(names).toContain('highFrequency');
    expect(names).toContain('roundAmount');
    expect(names).toContain('sanctionedAddress');
  });

  it('all heuristics have a weight between 0 and 1', () => {
    const heuristics = getRiskHeuristics();
    for (const h of heuristics) {
      expect(h.weight).toBeGreaterThanOrEqual(0);
      expect(h.weight).toBeLessThanOrEqual(1);
    }
  });

  it('all heuristics are enabled by default', () => {
    const heuristics = getRiskHeuristics();
    for (const h of heuristics) {
      expect(h.enabled).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// updateHeuristicWeights
// ---------------------------------------------------------------------------

describe('updateHeuristicWeights', () => {
  it('updates the weight for a known heuristic', () => {
    updateHeuristicWeights({ structuring: 0.5 });
    const heuristics = getRiskHeuristics();
    const structuring = heuristics.find((h) => h.name === 'structuring');
    expect(structuring?.weight).toBe(0.5);
  });

  it('clamps weight to 0 when given a negative value', () => {
    updateHeuristicWeights({ roundAmount: -1 });
    const heuristics = getRiskHeuristics();
    const roundAmount = heuristics.find((h) => h.name === 'roundAmount');
    expect(roundAmount?.weight).toBe(0);
  });

  it('clamps weight to 1 when given a value > 1', () => {
    updateHeuristicWeights({ rapidMovement: 999 });
    const heuristics = getRiskHeuristics();
    const rapid = heuristics.find((h) => h.name === 'rapidMovement');
    expect(rapid?.weight).toBe(1);
  });

  it('ignores unknown heuristic names gracefully', () => {
    expect(() => updateHeuristicWeights({ nonexistent: 0.5 })).not.toThrow();
  });
});
