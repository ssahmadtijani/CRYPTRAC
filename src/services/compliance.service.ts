import { v4 as uuidv4 } from 'uuid';
import {
  ComplianceReport,
  ReportType,
  ComplianceStatus,
  RiskLevel,
} from '../types';
import { transactionService } from './transaction.service';

const TRAVEL_RULE_THRESHOLD = 1000;

const reports: ComplianceReport[] = [];

export const complianceService = {
  generateSAR(transactionId: string): ComplianceReport {
    const transaction = transactionService.getTransactionById(transactionId);
    if (!transaction) {
      const err = new Error(`Transaction ${transactionId} not found`) as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    const report: ComplianceReport = {
      id: uuidv4(),
      type: ReportType.SAR,
      transactionId,
      status: ComplianceStatus.PENDING,
      riskLevel: transaction.riskLevel,
      reportData: {
        reportType: 'Suspicious Activity Report',
        filingDate: now.toISOString(),
        subjectTransaction: {
          id: transaction.id,
          amount: transaction.amount,
          amountUSD: transaction.amountUSD,
          currency: transaction.currency,
          blockchain: transaction.blockchain,
          fromAddress: transaction.fromAddress,
          toAddress: transaction.toAddress,
          timestamp: transaction.timestamp,
        },
        suspiciousIndicators: getSuspiciousIndicators(transaction.riskLevel),
        narrative: `Suspicious activity detected on transaction ${transactionId}. Risk level: ${transaction.riskLevel}.`,
      },
      createdAt: now,
      updatedAt: now,
    };

    reports.push(report);
    return report;
  },

  generateCTR(transactionId: string): ComplianceReport {
    const transaction = transactionService.getTransactionById(transactionId);
    if (!transaction) {
      const err = new Error(`Transaction ${transactionId} not found`) as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    if (transaction.amountUSD < 10000) {
      const err = new Error(
        'CTR requires transaction amount >= $10,000 USD'
      ) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const report: ComplianceReport = {
      id: uuidv4(),
      type: ReportType.CTR,
      transactionId,
      status: ComplianceStatus.PENDING,
      riskLevel: transaction.riskLevel,
      reportData: {
        reportType: 'Currency Transaction Report',
        filingDate: now.toISOString(),
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          amountUSD: transaction.amountUSD,
          currency: transaction.currency,
          blockchain: transaction.blockchain,
          fromAddress: transaction.fromAddress,
          toAddress: transaction.toAddress,
          timestamp: transaction.timestamp,
        },
        threshold: 10000,
        currency: 'USD',
      },
      createdAt: now,
      updatedAt: now,
    };

    reports.push(report);
    return report;
  },

  checkTravelRule(
    transactionId: string
  ): { compliant: boolean; report: ComplianceReport } {
    const transaction = transactionService.getTransactionById(transactionId);
    if (!transaction) {
      const err = new Error(`Transaction ${transactionId} not found`) as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    const requiresTravelRule = transaction.amountUSD >= TRAVEL_RULE_THRESHOLD;
    const compliant = !requiresTravelRule || transaction.travelRuleRequired;

    const now = new Date();
    const report: ComplianceReport = {
      id: uuidv4(),
      type: ReportType.TRAVEL_RULE,
      transactionId,
      status: compliant ? ComplianceStatus.APPROVED : ComplianceStatus.FLAGGED,
      riskLevel: compliant ? RiskLevel.LOW : RiskLevel.HIGH,
      reportData: {
        reportType: 'FATF Travel Rule Check',
        threshold: TRAVEL_RULE_THRESHOLD,
        amountUSD: transaction.amountUSD,
        requiresTravelRule,
        compliant,
        checkedAt: now.toISOString(),
        originatorInfo: compliant ? 'Provided' : 'Missing',
        beneficiaryInfo: compliant ? 'Provided' : 'Missing',
      },
      createdAt: now,
      updatedAt: now,
    };

    reports.push(report);
    return { compliant, report };
  },

  getReports(
    filter: { type?: ReportType; status?: ComplianceStatus; page?: number; limit?: number } = {}
  ): { data: ComplianceReport[]; total: number } {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    let filtered = reports.filter((r) => {
      if (filter.type && r.type !== filter.type) return false;
      if (filter.status && r.status !== filter.status) return false;
      return true;
    });

    const total = filtered.length;
    filtered = filtered.slice((page - 1) * limit, page * limit);

    return { data: filtered, total };
  },

  reviewReport(
    reportId: string,
    status: ComplianceStatus,
    reviewerId: string,
    reviewNotes?: string
  ): ComplianceReport {
    const report = reports.find((r) => r.id === reportId);
    if (!report) {
      const err = new Error(`Report ${reportId} not found`) as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    report.status = status;
    report.reviewerId = reviewerId;
    report.reviewedAt = new Date();
    report.reviewNotes = reviewNotes;
    report.updatedAt = new Date();

    return report;
  },
};

function getSuspiciousIndicators(riskLevel: RiskLevel): string[] {
  const indicators: string[] = [];
  if (riskLevel === RiskLevel.CRITICAL) {
    indicators.push('Address matches OFAC/sanctions list');
    indicators.push('High-risk jurisdiction involvement');
  }
  if (riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL) {
    indicators.push('Transaction amount exceeds reporting threshold');
    indicators.push('Unusual transaction pattern');
  }
  if (riskLevel === RiskLevel.MEDIUM) {
    indicators.push('Moderate risk profile');
  }
  return indicators;
}
