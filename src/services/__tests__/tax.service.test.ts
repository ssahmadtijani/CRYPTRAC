import { taxService } from '../tax.service';
import { transactionService } from '../transaction.service';
import { TransactionType, RiskLevel, ComplianceStatus } from '../../types';

jest.mock('../transaction.service', () => ({
  transactionService: {
    getTransactions: jest.fn(),
  },
}));

const mockGetTransactions = transactionService.getTransactions as jest.MockedFunction<
  typeof transactionService.getTransactions
>;

const BASE_TX = {
  id: 'tx-1',
  userId: 'user-1',
  fromAddress: '0xaaa',
  toAddress: '0xbbb',
  blockchain: 'ethereum',
  fee: 0,
  feeUSD: 0,
  riskLevel: RiskLevel.LOW,
  complianceStatus: ComplianceStatus.PENDING,
  travelRuleRequired: false,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
};

describe('taxService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyHoldingPeriod', () => {
    it('returns SHORT for holdings held less than one year', () => {
      const acquired = new Date('2023-01-01');
      const disposed = new Date('2023-06-01');
      expect(taxService.classifyHoldingPeriod(acquired, disposed)).toBe('SHORT');
    });

    it('returns LONG for holdings held more than one year', () => {
      const acquired = new Date('2022-01-01');
      const disposed = new Date('2023-06-01');
      expect(taxService.classifyHoldingPeriod(acquired, disposed)).toBe('LONG');
    });

    it('returns SHORT for exactly one year (boundary)', () => {
      const acquired = new Date('2022-01-01');
      const disposed = new Date('2023-01-01');
      expect(taxService.classifyHoldingPeriod(acquired, disposed)).toBe('SHORT');
    });
  });

  describe('calculateCostBasis', () => {
    it('calculates cost basis for acquisitions in FIFO order', () => {
      const acquisitions = [
        { quantity: 1, costPerUnit: 10000, date: new Date('2023-01-02') },
        { quantity: 2, costPerUnit: 5000, date: new Date('2023-01-01') },
      ];
      const result = taxService.calculateCostBasis(acquisitions);
      expect(result).toHaveLength(2);
      expect(result[0].acquiredDate).toEqual(new Date('2023-01-01'));
      expect(result[0].costBasis).toBe(10000);
      expect(result[1].acquiredDate).toEqual(new Date('2023-01-02'));
      expect(result[1].costBasis).toBe(10000);
    });

    it('returns empty array for empty acquisitions', () => {
      expect(taxService.calculateCostBasis([])).toEqual([]);
    });
  });

  describe('calculateTaxEvents', () => {
    it('returns empty array when no transactions exist', () => {
      mockGetTransactions.mockReturnValue({ data: [], total: 0 });
      const events = taxService.calculateTaxEvents('user-1', 2023);
      expect(events).toEqual([]);
    });

    it('classifies a TRADE as a capital gain event', () => {
      const deposit = {
        ...BASE_TX,
        id: 'tx-deposit',
        type: TransactionType.DEPOSIT,
        currency: 'BTC',
        amount: 1,
        amountUSD: 20000,
        timestamp: new Date('2022-06-01'),
      };
      const trade = {
        ...BASE_TX,
        id: 'tx-trade',
        type: TransactionType.TRADE,
        currency: 'BTC',
        amount: 1,
        amountUSD: 30000,
        timestamp: new Date('2023-08-01'),
      };
      mockGetTransactions.mockReturnValue({ data: [deposit, trade], total: 2 });

      const events = taxService.calculateTaxEvents('user-1', 2023);
      expect(events).toHaveLength(1);
      expect(events[0].gain).toBe(10000);
      expect(events[0].isLongTerm).toBe(true);
    });

    it('classifies mining income correctly', () => {
      const mining = {
        ...BASE_TX,
        id: 'tx-mine',
        type: TransactionType.MINING,
        currency: 'BTC',
        amount: 0.1,
        amountUSD: 2500,
        timestamp: new Date('2023-03-01'),
      };
      mockGetTransactions.mockReturnValue({ data: [mining], total: 1 });

      const events = taxService.calculateTaxEvents('user-1', 2023);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('MINING_INCOME');
      expect(events[0].gain).toBe(2500);
    });

    it('classifies staking reward correctly', () => {
      const staking = {
        ...BASE_TX,
        id: 'tx-stake',
        type: TransactionType.STAKING,
        currency: 'ETH',
        amount: 0.5,
        amountUSD: 1000,
        timestamp: new Date('2023-05-01'),
      };
      mockGetTransactions.mockReturnValue({ data: [staking], total: 1 });

      const events = taxService.calculateTaxEvents('user-1', 2023);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('STAKING_REWARD');
      expect(events[0].gain).toBe(1000);
    });

    it('classifies airdrop income correctly', () => {
      const airdrop = {
        ...BASE_TX,
        id: 'tx-airdrop',
        type: TransactionType.AIRDROP,
        currency: 'TOKEN',
        amount: 100,
        amountUSD: 500,
        timestamp: new Date('2023-07-01'),
      };
      mockGetTransactions.mockReturnValue({ data: [airdrop], total: 1 });

      const events = taxService.calculateTaxEvents('user-1', 2023);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('AIRDROP_INCOME');
      expect(events[0].gain).toBe(500);
    });
  });

  describe('generateTaxSummary', () => {
    it('returns zero summary when no transactions exist', () => {
      mockGetTransactions.mockReturnValue({ data: [], total: 0 });
      const summary = taxService.generateTaxSummary('user-1', 2023);
      expect(summary.shortTermGains).toBe(0);
      expect(summary.longTermGains).toBe(0);
      expect(summary.totalGains).toBe(0);
      expect(summary.totalIncome).toBe(0);
      expect(summary.totalTaxableAmount).toBe(0);
      expect(summary.events).toHaveLength(0);
    });

    it('aggregates income types correctly', () => {
      const mining = {
        ...BASE_TX,
        id: 'tx-mine',
        type: TransactionType.MINING,
        currency: 'BTC',
        amount: 0.1,
        amountUSD: 3000,
        timestamp: new Date('2023-01-10'),
      };
      const staking = {
        ...BASE_TX,
        id: 'tx-stake',
        type: TransactionType.STAKING,
        currency: 'ETH',
        amount: 1,
        amountUSD: 2000,
        timestamp: new Date('2023-02-10'),
      };
      mockGetTransactions.mockReturnValue({ data: [mining, staking], total: 2 });

      const summary = taxService.generateTaxSummary('user-1', 2023);
      expect(summary.miningIncome).toBe(3000);
      expect(summary.stakingIncome).toBe(2000);
      expect(summary.totalIncome).toBe(5000);
      expect(summary.totalTaxableAmount).toBe(5000);
    });
/**
 * Tax Service Tests for CRYPTRAC
 */

import {
  calculateTaxEvents,
  generateTaxSummary,
  classifyTaxEvent,
  calculateCostBasis,
  addToLots,
  clearLots,
} from '../tax.service';
import {
  Transaction,
  TransactionType,
  RiskLevel,
  ComplianceStatus,
  TaxEventType,
} from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTransaction(
  overrides: Partial<Transaction> & { type: TransactionType }
): Transaction {
  const now = new Date('2023-06-15T10:00:00Z');
  const defaults: Transaction = {
    id: 'tx-' + Math.random().toString(36).slice(2),
    txHash: '0xabc' + Math.random().toString(36).slice(2),
    type: TransactionType.TRANSFER,
    senderAddress: '0xSender',
    receiverAddress: '0xReceiver',
    asset: 'BTC',
    amount: 1,
    amountUSD: 30_000,
    fee: 0,
    feeUSD: 0,
    network: 'ethereum',
    timestamp: now,
    riskLevel: RiskLevel.LOW,
    riskScore: 0,
    complianceStatus: ComplianceStatus.PENDING,
    userId: 'user-1',
    createdAt: now,
    updatedAt: now,
  };
  return { ...defaults, ...overrides };
}

// ---------------------------------------------------------------------------
// classifyTaxEvent
// ---------------------------------------------------------------------------

describe('classifyTaxEvent', () => {
  it('classifies TRADE as CAPITAL_GAIN_SHORT', () => {
    const tx = makeTransaction({ type: TransactionType.TRADE });
    expect(classifyTaxEvent(tx)).toBe(TaxEventType.CAPITAL_GAIN_SHORT);
  });

  it('classifies SWAP as CAPITAL_GAIN_SHORT', () => {
    const tx = makeTransaction({ type: TransactionType.SWAP });
    expect(classifyTaxEvent(tx)).toBe(TaxEventType.CAPITAL_GAIN_SHORT);
  });

  it('classifies MINING as MINING_INCOME', () => {
    const tx = makeTransaction({ type: TransactionType.MINING });
    expect(classifyTaxEvent(tx)).toBe(TaxEventType.MINING_INCOME);
  });

  it('classifies STAKING as STAKING_REWARD', () => {
    const tx = makeTransaction({ type: TransactionType.STAKING });
    expect(classifyTaxEvent(tx)).toBe(TaxEventType.STAKING_REWARD);
  });

  it('classifies AIRDROP as AIRDROP_INCOME', () => {
    const tx = makeTransaction({ type: TransactionType.AIRDROP });
    expect(classifyTaxEvent(tx)).toBe(TaxEventType.AIRDROP_INCOME);
  });

  it('returns null for TRANSFER (non-taxable)', () => {
    const tx = makeTransaction({ type: TransactionType.TRANSFER });
    expect(classifyTaxEvent(tx)).toBeNull();
  });

  it('returns null for DEPOSIT (non-taxable)', () => {
    const tx = makeTransaction({ type: TransactionType.DEPOSIT });
    expect(classifyTaxEvent(tx)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// calculateCostBasis — FIFO
// ---------------------------------------------------------------------------

describe('calculateCostBasis (FIFO)', () => {
  beforeEach(() => {
    clearLots();
  });

  it('returns zero cost when no lots exist', () => {
    const result = calculateCostBasis('ETH', 1, 'FIFO');
    expect(result.totalCost).toBe(0);
    expect(result.holdingPeriodDays).toBe(0);
  });

  it('returns correct cost for a single lot', () => {
    const acquiredAt = new Date('2023-01-01');
    addToLots('ETH', 2, 1500, acquiredAt);

    const result = calculateCostBasis('ETH', 1, 'FIFO');
    expect(result.totalCost).toBe(1500);
  });

  it('uses FIFO ordering across multiple lots', () => {
    // Lot 1: 1 ETH at $1,000 (older)
    addToLots('BTC', 1, 1_000, new Date('2022-01-01'));
    // Lot 2: 1 BTC at $2,000 (newer)
    addToLots('BTC', 1, 2_000, new Date('2023-01-01'));

    // Selling 1.5 BTC should use 1 from lot 1 ($1,000) + 0.5 from lot 2 ($1,000)
    const result = calculateCostBasis('BTC', 1.5, 'FIFO');
    expect(result.totalCost).toBeCloseTo(2_000, 2);
  });

  it('handles partial lot consumption', () => {
    addToLots('SOL', 10, 100, new Date('2023-01-01'));

    const result = calculateCostBasis('SOL', 4, 'FIFO');
    expect(result.totalCost).toBe(400);
  });

  it('calculates holding period in days', () => {
    const acquiredAt = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    addToLots('MATIC', 5, 1, acquiredAt);

    const result = calculateCostBasis('MATIC', 5, 'FIFO');
    expect(result.holdingPeriodDays).toBeGreaterThanOrEqual(399);
  });

  it('identifies short-term holding (< 365 days)', () => {
    const acquiredAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    addToLots('ADA', 10, 0.5, acquiredAt);

    const result = calculateCostBasis('ADA', 10, 'FIFO');
    expect(result.holdingPeriodDays).toBeLessThan(365);
  });

  it('identifies long-term holding (>= 365 days)', () => {
    const acquiredAt = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    addToLots('LINK', 10, 5, acquiredAt);

    const result = calculateCostBasis('LINK', 10, 'FIFO');
    expect(result.holdingPeriodDays).toBeGreaterThanOrEqual(365);
  });
});

// ---------------------------------------------------------------------------
// calculateTaxEvents
// ---------------------------------------------------------------------------

describe('calculateTaxEvents', () => {
  beforeEach(() => {
    clearLots();
  });

  it('returns empty array when no transactions match the tax year', async () => {
    const tx = makeTransaction({
      type: TransactionType.TRADE,
      timestamp: new Date('2021-03-01'),
    });
    const events = await calculateTaxEvents('user-1', 2023, [tx]);
    expect(events).toHaveLength(0);
  });

  it('generates tax events for trades in the correct year', async () => {
    // First add a lot so there is a cost basis
    addToLots('BTC', 2, 25_000, new Date('2022-01-01'));

    const tx = makeTransaction({
      type: TransactionType.TRADE,
      userId: 'user-1',
      timestamp: new Date('2023-06-01'),
      asset: 'BTC',
      amount: 1,
      amountUSD: 30_000,
    });

    const events = await calculateTaxEvents('user-1', 2023, [tx]);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].taxYear).toBe(2023);
  });

  it('generates mining income events', async () => {
    const tx = makeTransaction({
      type: TransactionType.MINING,
      userId: 'user-1',
      timestamp: new Date('2023-08-01'),
      asset: 'BTC',
      amount: 0.5,
      amountUSD: 15_000,
    });

    const events = await calculateTaxEvents('user-1', 2023, [tx]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(TaxEventType.MINING_INCOME);
    expect(events[0].taxableAmount).toBe(15_000);
  });

  it('generates staking reward events', async () => {
    const tx = makeTransaction({
      type: TransactionType.STAKING,
      userId: 'user-1',
      timestamp: new Date('2023-04-01'),
      asset: 'ETH',
      amount: 0.1,
      amountUSD: 200,
    });

    const events = await calculateTaxEvents('user-1', 2023, [tx]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(TaxEventType.STAKING_REWARD);
  });

  it('generates airdrop income events', async () => {
    const tx = makeTransaction({
      type: TransactionType.AIRDROP,
      userId: 'user-1',
      timestamp: new Date('2023-07-15'),
      asset: 'UNI',
      amount: 100,
      amountUSD: 500,
    });

    const events = await calculateTaxEvents('user-1', 2023, [tx]);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(TaxEventType.AIRDROP_INCOME);
  });

  it('skips non-taxable transactions', async () => {
    const transfer = makeTransaction({
      type: TransactionType.TRANSFER,
      userId: 'user-1',
      timestamp: new Date('2023-05-01'),
    });
    const deposit = makeTransaction({
      type: TransactionType.DEPOSIT,
      userId: 'user-1',
      timestamp: new Date('2023-06-01'),
    });

    const events = await calculateTaxEvents('user-1', 2023, [transfer, deposit]);
    expect(events).toHaveLength(0);
  });

  it('filters by userId', async () => {
    const txUser1 = makeTransaction({
      type: TransactionType.MINING,
      userId: 'user-1',
      timestamp: new Date('2023-01-01'),
      amountUSD: 1_000,
    });
    const txUser2 = makeTransaction({
      type: TransactionType.MINING,
      userId: 'user-2',
      timestamp: new Date('2023-01-01'),
      amountUSD: 2_000,
    });

    const events = await calculateTaxEvents('user-1', 2023, [txUser1, txUser2]);
    expect(events).toHaveLength(1);
    expect(events[0].userId).toBe('user-1');
  });
});

// ---------------------------------------------------------------------------
// generateTaxSummary
// ---------------------------------------------------------------------------

describe('generateTaxSummary', () => {
  beforeEach(() => {
    clearLots();
  });

  it('returns a summary with correct totals for income events', async () => {
    const mining = makeTransaction({
      type: TransactionType.MINING,
      userId: 'user-1',
      timestamp: new Date('2023-02-01'),
      asset: 'BTC',
      amount: 0.5,
      amountUSD: 10_000,
    });
    const staking = makeTransaction({
      type: TransactionType.STAKING,
      userId: 'user-1',
      timestamp: new Date('2023-03-01'),
      asset: 'ETH',
      amount: 1,
      amountUSD: 2_000,
    });

    const summary = await generateTaxSummary('user-1', 2023, [mining, staking]);

    expect(summary.userId).toBe('user-1');
    expect(summary.taxYear).toBe(2023);
    expect(summary.totalMiningIncome).toBe(10_000);
    expect(summary.totalStakingRewards).toBe(2_000);
    expect(summary.totalTaxableIncome).toBe(12_000);
    expect(summary.estimatedTaxOwed).toBeGreaterThan(0);
  });

  it('returns zero totals when there are no taxable events', async () => {
    const summary = await generateTaxSummary('user-1', 2023, []);

    expect(summary.totalTaxableIncome).toBe(0);
    expect(summary.estimatedTaxOwed).toBe(0);
    expect(summary.events).toHaveLength(0);
  });

  it('includes all events in the summary', async () => {
    const airdrop = makeTransaction({
      type: TransactionType.AIRDROP,
      userId: 'user-1',
      timestamp: new Date('2023-11-01'),
      asset: 'ARB',
      amount: 500,
      amountUSD: 750,
    });

    const summary = await generateTaxSummary('user-1', 2023, [airdrop]);
    expect(summary.events).toHaveLength(1);
    expect(summary.totalAirdropIncome).toBe(750);
  });
});
