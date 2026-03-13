/**
 * Compliance Service for CRYPTRAC
 * FATF Travel Rule, SAR, CTR, and AML/CFT compliance checks
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Transaction,
  ComplianceReport,
  TravelRuleData,
  ReportType,
  ComplianceStatus,
  RiskLevel,
} from '../types';
import { logger } from '../utils/logger';

// In-memory compliance report store (replace with Prisma in production)
const complianceReports: Map<string, ComplianceReport> = new Map();
const travelRuleRecords: Map<string, TravelRuleData> = new Map();

// ---------------------------------------------------------------------------
// Regulatory thresholds (USD)
// ---------------------------------------------------------------------------
/** FinCEN / FINTRAC Suspicious Activity Report threshold */
const SAR_THRESHOLD_USD = 10_000;
/** FinCEN Currency Transaction Report threshold */
const CTR_THRESHOLD_USD = 10_000;
/** FATF Recommendation 16 Travel Rule threshold */
const TRAVEL_RULE_THRESHOLD_USD = 1_000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ComplianceCheckResult {
  sarRequired: boolean;
  ctrRequired: boolean;
  travelRuleRequired: boolean;
  riskLevel: RiskLevel;
  reports: ComplianceReport[];
}

/**
 * Runs all applicable compliance checks for a transaction.
 */
export async function checkCompliance(
  transaction: Transaction
): Promise<ComplianceCheckResult> {
  const reports: ComplianceReport[] = [];

  const sarRequired = transaction.amountUSD >= SAR_THRESHOLD_USD;
  const ctrRequired = transaction.amountUSD >= CTR_THRESHOLD_USD;
  const travelRuleRequired = transaction.amountUSD >= TRAVEL_RULE_THRESHOLD_USD;

  if (sarRequired) {
    const sar = await generateSAR(transaction);
    reports.push(sar);
  }

  if (ctrRequired) {
    const ctr = await generateCTR(transaction);
    reports.push(ctr);
  }

  if (travelRuleRequired) {
    const travelRule = await checkTravelRule(transaction);
    reports.push(travelRule);
  }

  logger.info('Compliance check completed', {
    transactionId: transaction.id,
    sarRequired,
    ctrRequired,
    travelRuleRequired,
  });

  return {
    sarRequired,
    ctrRequired,
    travelRuleRequired,
    riskLevel: transaction.riskLevel,
    reports,
  };
}

/**
 * Generates a Suspicious Activity Report (SAR) for a transaction.
 */
export async function generateSAR(transaction: Transaction): Promise<ComplianceReport> {
  const now = new Date();
  const report: ComplianceReport = {
    id: uuidv4(),
    reportType: ReportType.SAR,
    transactionId: transaction.id,
    status: ComplianceStatus.PENDING,
    narrative: buildSARNarrative(transaction),
    findings: {
      transactionId: transaction.id,
      txHash: transaction.txHash,
      amount: transaction.amountUSD,
      threshold: SAR_THRESHOLD_USD,
      senderAddress: transaction.senderAddress,
      receiverAddress: transaction.receiverAddress,
      asset: transaction.asset,
      network: transaction.network,
      riskScore: transaction.riskScore,
      riskLevel: transaction.riskLevel,
      detectedAt: now.toISOString(),
    },
    createdAt: now,
    updatedAt: now,
  };

  complianceReports.set(report.id, report);

  logger.info('SAR generated', {
    reportId: report.id,
    transactionId: transaction.id,
    amount: transaction.amountUSD,
  });

  return report;
}

/**
 * Generates a Currency Transaction Report (CTR) for a transaction.
 */
export async function generateCTR(transaction: Transaction): Promise<ComplianceReport> {
  const now = new Date();
  const report: ComplianceReport = {
    id: uuidv4(),
    reportType: ReportType.CTR,
    transactionId: transaction.id,
    status: ComplianceStatus.PENDING,
    narrative: buildCTRNarrative(transaction),
    findings: {
      transactionId: transaction.id,
      txHash: transaction.txHash,
      amount: transaction.amountUSD,
      threshold: CTR_THRESHOLD_USD,
      senderAddress: transaction.senderAddress,
      receiverAddress: transaction.receiverAddress,
      asset: transaction.asset,
      network: transaction.network,
      reportedAt: now.toISOString(),
    },
    createdAt: now,
    updatedAt: now,
  };

  complianceReports.set(report.id, report);

  logger.info('CTR generated', {
    reportId: report.id,
    transactionId: transaction.id,
    amount: transaction.amountUSD,
  });

  return report;
}

/**
 * Checks FATF Recommendation 16 Travel Rule compliance and generates a report.
 */
export async function checkTravelRule(
  transaction: Transaction
): Promise<ComplianceReport> {
  const now = new Date();

  // Build travel rule data record
  const travelRule: TravelRuleData = {
    id: uuidv4(),
    transactionId: transaction.id,
    originatorName: 'Unknown Originator',
    originatorAddress: transaction.senderAddress,
    originatorVASP: 'Unknown VASP',
    originatorVASPId: 'VASP-UNKNOWN',
    beneficiaryName: 'Unknown Beneficiary',
    beneficiaryAddress: transaction.receiverAddress,
    beneficiaryVASP: 'Unknown VASP',
    beneficiaryVASPId: 'VASP-UNKNOWN',
    transferAmount: transaction.amount,
    transferAsset: transaction.asset,
    transferAmountUSD: transaction.amountUSD,
    isCompliant: false,
    complianceNotes:
      'Originator and beneficiary information pending VASP verification',
    createdAt: now,
  };

  travelRuleRecords.set(travelRule.id, travelRule);

  const report: ComplianceReport = {
    id: uuidv4(),
    reportType: ReportType.TRAVEL_RULE,
    transactionId: transaction.id,
    status: ComplianceStatus.UNDER_REVIEW,
    narrative: buildTravelRuleNarrative(transaction, travelRule),
    findings: {
      travelRuleId: travelRule.id,
      transactionId: transaction.id,
      transferAmountUSD: transaction.amountUSD,
      threshold: TRAVEL_RULE_THRESHOLD_USD,
      originatorAddress: travelRule.originatorAddress,
      beneficiaryAddress: travelRule.beneficiaryAddress,
      isCompliant: travelRule.isCompliant,
      fatfRecommendation: 'Recommendation 16',
      checkedAt: now.toISOString(),
    },
    createdAt: now,
    updatedAt: now,
  };

  complianceReports.set(report.id, report);

  logger.info('Travel Rule check completed', {
    reportId: report.id,
    transactionId: transaction.id,
    isCompliant: travelRule.isCompliant,
  });

  return report;
}

/**
 * Returns a paginated list of compliance reports.
 */
export async function getComplianceReports(filter: {
  page?: number;
  pageSize?: number;
  transactionId?: string;
  reportType?: ReportType;
  status?: ComplianceStatus;
}): Promise<{
  data: ComplianceReport[];
  total: number;
  page: number;
  pageSize: number;
}> {
  let results = Array.from(complianceReports.values());

  if (filter.transactionId) {
    results = results.filter((r) => r.transactionId === filter.transactionId);
  }
  if (filter.reportType) {
    results = results.filter((r) => r.reportType === filter.reportType);
  }
  if (filter.status) {
    results = results.filter((r) => r.status === filter.status);
  }

  results.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const total = results.length;
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const start = (page - 1) * pageSize;

  return {
    data: results.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

/**
 * Returns a single compliance report by ID.
 */
export async function getComplianceReportById(
  id: string
): Promise<ComplianceReport | null> {
  return complianceReports.get(id) ?? null;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function buildSARNarrative(transaction: Transaction): string {
  return (
    `Suspicious Activity Report: Transaction ${transaction.txHash} ` +
    `involving ${transaction.asset} transfer of $${transaction.amountUSD.toFixed(2)} USD ` +
    `from ${transaction.senderAddress} to ${transaction.receiverAddress} ` +
    `on ${transaction.network} network. ` +
    `Risk score: ${transaction.riskScore}. Risk level: ${transaction.riskLevel}. ` +
    `Transaction amount exceeds SAR threshold of $${SAR_THRESHOLD_USD} USD.`
  );
}

function buildCTRNarrative(transaction: Transaction): string {
  return (
    `Currency Transaction Report: Cash-equivalent transaction ${transaction.txHash} ` +
    `for $${transaction.amountUSD.toFixed(2)} USD in ${transaction.asset} ` +
    `on ${transaction.network}. ` +
    `Amount exceeds CTR threshold of $${CTR_THRESHOLD_USD} USD.`
  );
}

function buildTravelRuleNarrative(
  transaction: Transaction,
  travelRule: TravelRuleData
): string {
  return (
    `FATF Travel Rule Check (Recommendation 16): Transfer of ` +
    `${transaction.amount} ${transaction.asset} ($${transaction.amountUSD.toFixed(2)} USD) ` +
    `from ${travelRule.originatorAddress} (${travelRule.originatorVASP}) ` +
    `to ${travelRule.beneficiaryAddress} (${travelRule.beneficiaryVASP}). ` +
    `Transfer amount exceeds Travel Rule threshold of $${TRAVEL_RULE_THRESHOLD_USD} USD. ` +
    `Compliance status: ${travelRule.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT — pending VASP verification'}.`
  );
}
