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
// Mock Prisma
// ---------------------------------------------------------------------------

jest.mock('../../lib/prisma', () => ({
  prisma: {
    complianceReport: {
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'mock-report-id-' + Math.random().toString(36).slice(2),
        reportType: data.reportType,
        transactionId: data.transactionId,
        status: data.status,
        narrative: data.narrative ?? null,
        findings: data.findings ?? null,
        reviewedById: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  },
}));

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
});
