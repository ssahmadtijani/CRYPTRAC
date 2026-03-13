import { complianceService } from '../compliance.service';
import { transactionService } from '../transaction.service';
import { ComplianceStatus, RiskLevel, TransactionType } from '../../types';

jest.mock('../transaction.service', () => ({
  transactionService: {
    getTransactionById: jest.fn(),
  },
}));

const mockGetById = transactionService.getTransactionById as jest.MockedFunction<
  typeof transactionService.getTransactionById
>;

const BASE_TX = {
  id: 'tx-001',
  userId: 'user-1',
  type: TransactionType.TRANSFER,
  fromAddress: '0xabc',
  toAddress: '0xdef',
  amount: 1,
  currency: 'BTC',
  amountUSD: 15000,
  fee: 0,
  feeUSD: 0,
  blockchain: 'bitcoin',
  riskLevel: RiskLevel.HIGH,
  complianceStatus: ComplianceStatus.FLAGGED,
  travelRuleRequired: true,
  timestamp: new Date('2023-06-01'),
  createdAt: new Date('2023-06-01'),
  updatedAt: new Date('2023-06-01'),
};

describe('complianceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSAR', () => {
    it('generates a SAR report for an existing transaction', () => {
      mockGetById.mockReturnValue(BASE_TX);

      const report = complianceService.generateSAR('tx-001');

      expect(report.type).toBe('SAR');
      expect(report.transactionId).toBe('tx-001');
      expect(report.status).toBe(ComplianceStatus.PENDING);
      expect(report.riskLevel).toBe(RiskLevel.HIGH);
      expect(report.reportData).toHaveProperty('narrative');
    });

    it('throws 404 when transaction not found', () => {
      mockGetById.mockReturnValue(undefined);

      expect(() => complianceService.generateSAR('nonexistent')).toThrow(
        'Transaction nonexistent not found'
      );
    });
  });

  describe('generateCTR', () => {
    it('generates a CTR for transactions >= $10,000', () => {
      mockGetById.mockReturnValue(BASE_TX);

      const report = complianceService.generateCTR('tx-001');

      expect(report.type).toBe('CTR');
      expect(report.transactionId).toBe('tx-001');
      expect(report.status).toBe(ComplianceStatus.PENDING);
    });

    it('throws 400 for transactions below $10,000', () => {
      mockGetById.mockReturnValue({ ...BASE_TX, amountUSD: 5000 });

      expect(() => complianceService.generateCTR('tx-001')).toThrow(
        'CTR requires transaction amount >= $10,000 USD'
      );
    });

    it('throws 404 when transaction not found', () => {
      mockGetById.mockReturnValue(undefined);

      expect(() => complianceService.generateCTR('nonexistent')).toThrow(
        'Transaction nonexistent not found'
      );
    });
  });

  describe('checkTravelRule', () => {
    it('returns compliant=true for amount < $1000 threshold', () => {
      mockGetById.mockReturnValue({
        ...BASE_TX,
        amountUSD: 500,
        travelRuleRequired: false,
      });

      const result = complianceService.checkTravelRule('tx-001');

      expect(result.compliant).toBe(true);
      expect(result.report.type).toBe('TRAVEL_RULE');
      expect(result.report.status).toBe(ComplianceStatus.APPROVED);
    });

    it('returns compliant=false when amount >= $1000 but travelRuleRequired is false', () => {
      mockGetById.mockReturnValue({
        ...BASE_TX,
        amountUSD: 1500,
        travelRuleRequired: false,
      });

      const result = complianceService.checkTravelRule('tx-001');

      expect(result.compliant).toBe(false);
      expect(result.report.status).toBe(ComplianceStatus.FLAGGED);
    });

    it('returns compliant=true when amount >= $1000 and travelRuleRequired is true', () => {
      mockGetById.mockReturnValue({
        ...BASE_TX,
        amountUSD: 2000,
        travelRuleRequired: true,
      });

      const result = complianceService.checkTravelRule('tx-001');

      expect(result.compliant).toBe(true);
    });

    it('throws 404 when transaction not found', () => {
      mockGetById.mockReturnValue(undefined);

      expect(() => complianceService.checkTravelRule('nonexistent')).toThrow(
        'Transaction nonexistent not found'
      );
    });
  });

  describe('reviewReport', () => {
    it('approves a report and records reviewer info', () => {
      mockGetById.mockReturnValue(BASE_TX);
      const report = complianceService.generateSAR('tx-001');

      const reviewed = complianceService.reviewReport(
        report.id,
        ComplianceStatus.APPROVED,
        'reviewer-1',
        'Looks clean'
      );

      expect(reviewed.status).toBe(ComplianceStatus.APPROVED);
      expect(reviewed.reviewerId).toBe('reviewer-1');
      expect(reviewed.reviewNotes).toBe('Looks clean');
      expect(reviewed.reviewedAt).toBeDefined();
    });

    it('rejects a report', () => {
      mockGetById.mockReturnValue(BASE_TX);
      const report = complianceService.generateSAR('tx-001');

      const reviewed = complianceService.reviewReport(
        report.id,
        ComplianceStatus.REJECTED,
        'reviewer-2'
      );

      expect(reviewed.status).toBe(ComplianceStatus.REJECTED);
    });

    it('throws 404 for unknown report id', () => {
      expect(() =>
        complianceService.reviewReport(
          'nonexistent-report',
          ComplianceStatus.APPROVED,
          'reviewer-1'
        )
      ).toThrow('Report nonexistent-report not found');
    });
  });

  describe('getReports', () => {
    it('returns paginated reports', () => {
      mockGetById.mockReturnValue(BASE_TX);
      complianceService.generateSAR('tx-001');
      complianceService.generateSAR('tx-001');

      const { data, total } = complianceService.getReports({ page: 1, limit: 10 });

      expect(Array.isArray(data)).toBe(true);
      expect(total).toBeGreaterThanOrEqual(2);
    });
/**
 * Compliance Service Tests for CRYPTRAC
 */

import {
  checkCompliance,
  generateSAR,
  generateCTR,
  checkTravelRule,
  getComplianceReports,
} from '../compliance.service';
import {
  Transaction,
  TransactionType,
  RiskLevel,
  ComplianceStatus,
  ReportType,
} from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTransaction(overrides?: Partial<Transaction>): Transaction {
  const now = new Date('2024-01-15T10:00:00Z');
  return {
    id: 'tx-' + Math.random().toString(36).slice(2),
    txHash: '0x' + Math.random().toString(36).slice(2).padStart(64, '0'),
    type: TransactionType.TRANSFER,
    senderAddress: '0xSenderAddress',
    receiverAddress: '0xReceiverAddress',
    asset: 'USDT',
    amount: 10_000,
    amountUSD: 10_000,
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
// SAR threshold detection
// ---------------------------------------------------------------------------

describe('SAR threshold detection', () => {
  it('generates a SAR for transactions >= $10,000', async () => {
    const tx = makeTransaction({ amountUSD: 10_000 });
    const sar = await generateSAR(tx);

    expect(sar.reportType).toBe(ReportType.SAR);
    expect(sar.transactionId).toBe(tx.id);
    expect(sar.status).toBe(ComplianceStatus.PENDING);
    expect(sar.narrative).toContain(tx.txHash);
  });

  it('includes amount and threshold in SAR findings', async () => {
    const tx = makeTransaction({ amountUSD: 25_000 });
    const sar = await generateSAR(tx);

    expect(sar.findings.amount).toBe(25_000);
    expect(sar.findings.threshold).toBe(10_000);
  });

  it('checkCompliance sets sarRequired=true for amounts >= $10,000', async () => {
    const tx = makeTransaction({ amountUSD: 15_000 });
    const result = await checkCompliance(tx);

    expect(result.sarRequired).toBe(true);
  });

  it('checkCompliance sets sarRequired=false for amounts below $10,000', async () => {
    const tx = makeTransaction({ amountUSD: 9_999 });
    const result = await checkCompliance(tx);

    expect(result.sarRequired).toBe(false);
  });

  it('includes risk level in compliance check result', async () => {
    const tx = makeTransaction({
      amountUSD: 20_000,
      riskLevel: RiskLevel.HIGH,
    });
    const result = await checkCompliance(tx);

    expect(result.riskLevel).toBe(RiskLevel.HIGH);
  });
});

// ---------------------------------------------------------------------------
// CTR threshold detection
// ---------------------------------------------------------------------------

describe('CTR threshold detection', () => {
  it('generates a CTR for transactions >= $10,000', async () => {
    const tx = makeTransaction({ amountUSD: 10_000 });
    const ctr = await generateCTR(tx);

    expect(ctr.reportType).toBe(ReportType.CTR);
    expect(ctr.transactionId).toBe(tx.id);
  });

  it('includes amount and threshold in CTR findings', async () => {
    const tx = makeTransaction({ amountUSD: 12_500 });
    const ctr = await generateCTR(tx);

    expect(ctr.findings.amount).toBe(12_500);
    expect(ctr.findings.threshold).toBe(10_000);
  });

  it('checkCompliance sets ctrRequired=true for amounts >= $10,000', async () => {
    const tx = makeTransaction({ amountUSD: 50_000 });
    const result = await checkCompliance(tx);

    expect(result.ctrRequired).toBe(true);
  });

  it('checkCompliance sets ctrRequired=false for amounts below $10,000', async () => {
    const tx = makeTransaction({ amountUSD: 500 });
    const result = await checkCompliance(tx);

    expect(result.ctrRequired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Travel Rule threshold detection
// ---------------------------------------------------------------------------

describe('Travel Rule threshold detection', () => {
  it('generates a Travel Rule report for transactions >= $1,000', async () => {
    const tx = makeTransaction({ amountUSD: 1_000 });
    const report = await checkTravelRule(tx);

    expect(report.reportType).toBe(ReportType.TRAVEL_RULE);
    expect(report.transactionId).toBe(tx.id);
    expect(report.status).toBe(ComplianceStatus.UNDER_REVIEW);
  });

  it('includes FATF Recommendation 16 in findings', async () => {
    const tx = makeTransaction({ amountUSD: 5_000 });
    const report = await checkTravelRule(tx);

    expect(report.findings.fatfRecommendation).toBe('Recommendation 16');
  });

  it('marks travel rule as non-compliant when VASP info is missing', async () => {
    const tx = makeTransaction({ amountUSD: 2_000 });
    const report = await checkTravelRule(tx);

    expect(report.findings.isCompliant).toBe(false);
  });

  it('checkCompliance sets travelRuleRequired=true for amounts >= $1,000', async () => {
    const tx = makeTransaction({ amountUSD: 1_000 });
    const result = await checkCompliance(tx);

    expect(result.travelRuleRequired).toBe(true);
  });

  it('checkCompliance sets travelRuleRequired=false for amounts below $1,000', async () => {
    const tx = makeTransaction({ amountUSD: 999 });
    const result = await checkCompliance(tx);

    expect(result.travelRuleRequired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Risk level assessment
// ---------------------------------------------------------------------------

describe('Risk level assessment via checkCompliance', () => {
  it('returns CRITICAL risk level for high-risk transactions', async () => {
    const tx = makeTransaction({
      amountUSD: 200_000,
      riskLevel: RiskLevel.CRITICAL,
      riskScore: 85,
    });
    const result = await checkCompliance(tx);

    expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
  });

  it('returns LOW risk level for low-risk transactions', async () => {
    const tx = makeTransaction({
      amountUSD: 100,
      riskLevel: RiskLevel.LOW,
      riskScore: 5,
    });
    const result = await checkCompliance(tx);

    expect(result.riskLevel).toBe(RiskLevel.LOW);
  });

  it('generates multiple reports for high-value transactions', async () => {
    const tx = makeTransaction({ amountUSD: 50_000 });
    const result = await checkCompliance(tx);

    // Should generate SAR + CTR + Travel Rule reports
    expect(result.reports.length).toBeGreaterThanOrEqual(3);
  });

  it('generates no reports for small transactions below all thresholds', async () => {
    const tx = makeTransaction({ amountUSD: 50 });
    const result = await checkCompliance(tx);

    expect(result.sarRequired).toBe(false);
    expect(result.ctrRequired).toBe(false);
    expect(result.travelRuleRequired).toBe(false);
    expect(result.reports).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getComplianceReports
// ---------------------------------------------------------------------------

describe('getComplianceReports', () => {
  it('returns paginated results', async () => {
    const result = await getComplianceReports({ page: 1, pageSize: 5 });

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('pageSize');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('filters by transactionId', async () => {
    const tx = makeTransaction({ amountUSD: 10_000 });
    await generateSAR(tx);

    const result = await getComplianceReports({ transactionId: tx.id });
    expect(result.data.every((r) => r.transactionId === tx.id)).toBe(true);
  });
});
