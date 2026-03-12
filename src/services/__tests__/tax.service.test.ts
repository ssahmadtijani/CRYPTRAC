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
  });
});
