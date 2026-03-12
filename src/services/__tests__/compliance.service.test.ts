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
  });
});
