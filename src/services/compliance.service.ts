/**
 * Compliance Service for CRYPTRAC
 * FATF Travel Rule, SAR, CTR, and AML/CFT compliance checks
 */

import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import {
  Transaction,
  ComplianceReport,
  ReportType,
  ComplianceStatus,
  RiskLevel,
  UserRole,
  NotificationType,
  NotificationPriority,
  WSEventType,
} from '../types';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { broadcastToRoles } from './notification.service';
import { evaluateTransaction } from './alert.service';
import { eventBus } from '../utils/eventBus';

// ---------------------------------------------------------------------------
// Regulatory thresholds (USD)
// ---------------------------------------------------------------------------
const SAR_THRESHOLD_USD = 10_000;
const CTR_THRESHOLD_USD = 10_000;
const TRAVEL_RULE_THRESHOLD_USD = 1_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapPrismaReport(r: {
  id: string;
  reportType: string;
  transactionId: string;
  status: string;
  narrative: string | null;
  findings: unknown;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ComplianceReport {
  return {
    id: r.id,
    reportType: r.reportType as ReportType,
    transactionId: r.transactionId,
    status: r.status as ComplianceStatus,
    narrative: r.narrative ?? '',
    findings: (r.findings as Record<string, unknown>) ?? {},
    reviewedBy: r.reviewedById ?? undefined,
    reviewedAt: r.reviewedAt ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

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
    reports.push(await generateSAR(transaction));
  }
  if (ctrRequired) {
    reports.push(await generateCTR(transaction));
  }
  if (travelRuleRequired) {
    reports.push(await checkTravelRule(transaction));
  }

  logger.info('Compliance check completed', {
    transactionId: transaction.id,
    sarRequired,
    ctrRequired,
    travelRuleRequired,
  });

  // Evaluate transaction against alert rules
  evaluateTransaction(transaction).catch((err) =>
    logger.error('Failed to evaluate transaction alert rules', { error: err })
  );

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
  const narrative = buildSARNarrative(transaction);
  const findings = {
    transactionId: transaction.id,
    txHash: transaction.txHash,
    amount: transaction.amountUSD,
    threshold: SAR_THRESHOLD_USD,
    riskLevel: transaction.riskLevel,
    riskScore: transaction.riskScore,
    senderAddress: transaction.senderAddress,
    receiverAddress: transaction.receiverAddress,
    asset: transaction.asset,
    network: transaction.network,
    reportedAt: new Date().toISOString(),
  };

  const record = await prisma.complianceReport.create({
    data: {
      reportType: ReportType.SAR,
      transactionId: transaction.id,
      status: ComplianceStatus.PENDING,
      narrative,
      findings,
    },
  });

  logger.info('SAR generated', { reportId: record.id, transactionId: transaction.id });

  // Notify compliance officers and admins about the new SAR
  broadcastToRoles([UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN], {
    type: NotificationType.COMPLIANCE_ALERT,
    priority: NotificationPriority.HIGH,
    title: 'SAR Generated',
    message: `A Suspicious Activity Report has been filed for transaction ${transaction.txHash || transaction.id}. Amount: $${transaction.amountUSD.toLocaleString()} USD.`,
    referenceId: record.id,
    referenceType: 'COMPLIANCE_REPORT',
  }).catch((err) => logger.error('Failed to broadcast SAR notification', { error: err }));

  // Emit WebSocket compliance alert
  eventBus.emit('ws:broadcast', {
    type: WSEventType.COMPLIANCE_ALERT,
    payload: {
      reportId: record.id,
      reportType: ReportType.SAR,
      transactionId: transaction.id,
      amountUSD: transaction.amountUSD,
    },
    timestamp: new Date(),
  });

  return mapPrismaReport(record);
}

/**
 * Generates a Currency Transaction Report (CTR) for a transaction.
 */
export async function generateCTR(transaction: Transaction): Promise<ComplianceReport> {
  const narrative = buildCTRNarrative(transaction);
  const findings = {
    transactionId: transaction.id,
    txHash: transaction.txHash,
    amount: transaction.amountUSD,
    threshold: CTR_THRESHOLD_USD,
    asset: transaction.asset,
    network: transaction.network,
    senderAddress: transaction.senderAddress,
    receiverAddress: transaction.receiverAddress,
    reportedAt: new Date().toISOString(),
  };

  const record = await prisma.complianceReport.create({
    data: {
      reportType: ReportType.CTR,
      transactionId: transaction.id,
      status: ComplianceStatus.PENDING,
      narrative,
      findings,
    },
  });

  logger.info('CTR generated', { reportId: record.id, transactionId: transaction.id });
  return mapPrismaReport(record);
}

/**
 * Generates a Travel Rule compliance report for a transaction.
 */
export async function checkTravelRule(
  transaction: Transaction
): Promise<ComplianceReport> {
  const isCompliant = false; // Requires VASP counterparty data in production
  const findings = {
    transactionId: transaction.id,
    txHash: transaction.txHash,
    amount: transaction.amountUSD,
    threshold: TRAVEL_RULE_THRESHOLD_USD,
    fatfRecommendation: 'Recommendation 16',
    isCompliant,
    senderAddress: transaction.senderAddress,
    receiverAddress: transaction.receiverAddress,
    note: 'VASP originator/beneficiary information required for full compliance',
  };

  const record = await prisma.complianceReport.create({
    data: {
      reportType: ReportType.TRAVEL_RULE,
      transactionId: transaction.id,
      status: ComplianceStatus.UNDER_REVIEW,
      narrative: buildTravelRuleNarrative(transaction),
      findings,
    },
  });

  logger.info('Travel Rule check completed', {
    reportId: record.id,
    transactionId: transaction.id,
    isCompliant,
  });
  return mapPrismaReport(record);
}

export interface ComplianceReportFilter {
  transactionId?: string;
  reportType?: ReportType;
  status?: ComplianceStatus;
  page?: number;
  pageSize?: number;
}

/**
 * Returns compliance reports with optional filtering and pagination.
 */
export async function getComplianceReports(filter?: ComplianceReportFilter): Promise<{
  data: ComplianceReport[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = filter?.page ?? 1;
  const pageSize = filter?.pageSize ?? 20;

  const where: Prisma.ComplianceReportWhereInput = {};
  if (filter?.transactionId) where.transactionId = filter.transactionId;
  if (filter?.reportType) where.reportType = filter.reportType;
  if (filter?.status) where.status = filter.status;

  const [total, records] = await Promise.all([
    prisma.complianceReport.count({ where }),
    prisma.complianceReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { data: records.map(mapPrismaReport), total, page, pageSize };
}

/**
 * Returns a single compliance report by ID, or null if not found.
 */
export async function getComplianceReportById(
  id: string
): Promise<ComplianceReport | null> {
  const found = await prisma.complianceReport.findUnique({ where: { id } });
  return found ? mapPrismaReport(found) : null;
}

// ---------------------------------------------------------------------------
// Narrative builders
// ---------------------------------------------------------------------------

function buildSARNarrative(tx: Transaction): string {
  return (
    `Suspicious Activity Report — Transaction ${tx.txHash} flagged for ` +
    `suspicious activity. Amount: $${tx.amountUSD.toLocaleString()} USD. ` +
    `Sender: ${tx.senderAddress}. Receiver: ${tx.receiverAddress}. ` +
    `Risk Level: ${tx.riskLevel}. Network: ${tx.network}.`
  );
}

function buildCTRNarrative(tx: Transaction): string {
  return (
    `Currency Transaction Report — Transaction ${tx.txHash} exceeded the ` +
    `reporting threshold of $${CTR_THRESHOLD_USD.toLocaleString()} USD. ` +
    `Amount: $${tx.amountUSD.toLocaleString()} USD. Asset: ${tx.asset}. ` +
    `Network: ${tx.network}.`
  );
}

function buildTravelRuleNarrative(tx: Transaction): string {
  return (
    `FATF Recommendation 16 Travel Rule — Transaction ${tx.txHash} exceeds ` +
    `the $${TRAVEL_RULE_THRESHOLD_USD.toLocaleString()} USD threshold. ` +
    `VASP originator and beneficiary information required. ` +
    `Amount: $${tx.amountUSD.toLocaleString()} USD.`
  );
}
