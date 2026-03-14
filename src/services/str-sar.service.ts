/**
 * STR/SAR Report Generation Service for CRYPTRAC
 * Automates creation of Suspicious Transaction Reports (STRs) and
 * Suspicious Activity Reports (SARs) per NFIU/FinCEN requirements.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  STRSARReport,
  STRSARStatus,
  STRSARType,
  STRSARFilter,
  STRSARStats,
  SuspicionCategory,
} from '../types';
import { logger } from '../utils/logger';
import { eventBus } from '../utils/eventBus';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const strSarReports = new Map<string, STRSARReport>();

// Sequential counters per type
const reportCounters: Record<STRSARType, number> = {
  [STRSARType.STR]: 0,
  [STRSARType.SAR]: 0,
  [STRSARType.CTR]: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateReportNumber(type: STRSARType): string {
  reportCounters[type] += 1;
  const year = new Date().getFullYear();
  const seq = String(reportCounters[type]).padStart(6, '0');
  return `${type}-${year}-${seq}`;
}

function throwNotFound(id: string): never {
  const err = new Error(`STR/SAR report ${id} not found`) as Error & { statusCode: number };
  err.statusCode = 404;
  throw err;
}

function assertStatus(report: STRSARReport, allowed: STRSARStatus[]): void {
  if (!allowed.includes(report.status)) {
    const err = new Error(
      `Report ${report.reportNumber} is in status ${report.status}; expected one of: ${allowed.join(', ')}`
    ) as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createSTRSAR(
  input: {
    type: STRSARType;
    subjectName: string;
    subjectWalletAddresses: string[];
    suspicionCategories: SuspicionCategory[];
    narrativeSummary: string;
    indicatorsOfSuspicion: string[];
    linkedTransactionIds?: string[];
    linkedCaseIds?: string[];
    linkedWalletAddresses?: string[];
    totalAmountUSD: number;
    dateRangeStart: Date;
    dateRangeEnd: Date;
    filingOfficerUserId: string;
    regulatoryAuthority?: string;
    subjectIdentification?: string;
    subjectCountry?: string;
  },
  filingOfficerName: string
): STRSARReport {
  const now = new Date();

  const report: STRSARReport = {
    id: uuidv4(),
    reportNumber: generateReportNumber(input.type),
    type: input.type,
    status: STRSARStatus.DRAFT,
    subjectName: input.subjectName,
    subjectWalletAddresses: input.subjectWalletAddresses,
    subjectIdentification: input.subjectIdentification,
    subjectCountry: input.subjectCountry,
    suspicionCategories: input.suspicionCategories,
    narrativeSummary: input.narrativeSummary,
    indicatorsOfSuspicion: input.indicatorsOfSuspicion,
    linkedTransactionIds: input.linkedTransactionIds ?? [],
    linkedCaseIds: input.linkedCaseIds ?? [],
    linkedWalletAddresses: input.linkedWalletAddresses ?? [],
    totalAmountUSD: input.totalAmountUSD,
    dateRangeStart: input.dateRangeStart,
    dateRangeEnd: input.dateRangeEnd,
    filingInstitution: 'CRYPTRAC',
    filingOfficer: filingOfficerName,
    filingOfficerUserId: input.filingOfficerUserId,
    regulatoryAuthority: input.regulatoryAuthority ?? 'NFIU',
    createdAt: now,
    updatedAt: now,
  };

  strSarReports.set(report.id, report);

  logger.info('STR/SAR report created', {
    id: report.id,
    reportNumber: report.reportNumber,
    type: report.type,
  });

  eventBus.emit('str-sar:created', report);

  return report;
}

export function updateSTRSAR(
  id: string,
  updates: Partial<
    Pick<
      STRSARReport,
      | 'narrativeSummary'
      | 'indicatorsOfSuspicion'
      | 'suspicionCategories'
      | 'linkedTransactionIds'
      | 'linkedCaseIds'
      | 'linkedWalletAddresses'
      | 'totalAmountUSD'
      | 'subjectName'
      | 'subjectWalletAddresses'
      | 'subjectIdentification'
      | 'subjectCountry'
    >
  >
): STRSARReport {
  const report = strSarReports.get(id);
  if (!report) throwNotFound(id);
  assertStatus(report, [STRSARStatus.DRAFT]);

  Object.assign(report, updates, { updatedAt: new Date() });
  strSarReports.set(id, report);

  logger.info('STR/SAR report updated', { id, reportNumber: report.reportNumber });

  return report;
}

export function submitForReview(id: string): STRSARReport {
  const report = strSarReports.get(id);
  if (!report) throwNotFound(id);
  assertStatus(report, [STRSARStatus.DRAFT]);

  // Validate required fields
  if (!report.narrativeSummary || report.narrativeSummary.trim().length < 10) {
    const err = new Error('Narrative summary must be at least 10 characters.') as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }
  if (report.suspicionCategories.length === 0) {
    const err = new Error('At least one suspicion category is required.') as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  report.status = STRSARStatus.UNDER_REVIEW;
  report.updatedAt = new Date();
  strSarReports.set(id, report);

  logger.info('STR/SAR submitted for review', { id, reportNumber: report.reportNumber });

  return report;
}

export function approveReport(id: string, reviewerUserId: string, reviewNotes?: string): STRSARReport {
  const report = strSarReports.get(id);
  if (!report) throwNotFound(id);
  assertStatus(report, [STRSARStatus.UNDER_REVIEW]);

  report.status = STRSARStatus.APPROVED;
  report.reviewedBy = reviewerUserId;
  report.reviewNotes = reviewNotes;
  report.updatedAt = new Date();
  strSarReports.set(id, report);

  logger.info('STR/SAR report approved', { id, reportNumber: report.reportNumber, reviewerUserId });

  return report;
}

export function rejectReport(id: string, reviewerUserId: string, reviewNotes: string): STRSARReport {
  const report = strSarReports.get(id);
  if (!report) throwNotFound(id);
  assertStatus(report, [STRSARStatus.UNDER_REVIEW]);

  report.status = STRSARStatus.REJECTED;
  report.reviewedBy = reviewerUserId;
  report.reviewNotes = reviewNotes;
  report.updatedAt = new Date();
  strSarReports.set(id, report);

  logger.info('STR/SAR report rejected', { id, reportNumber: report.reportNumber, reviewerUserId });

  return report;
}

export function fileReport(id: string): STRSARReport {
  const report = strSarReports.get(id);
  if (!report) throwNotFound(id);
  assertStatus(report, [STRSARStatus.APPROVED]);

  report.status = STRSARStatus.FILED;
  report.submittedAt = new Date();
  report.updatedAt = new Date();
  strSarReports.set(id, report);

  logger.info('STR/SAR report filed', { id, reportNumber: report.reportNumber });

  eventBus.emit('str-sar:filed', report);

  return report;
}

export function acknowledgeReport(id: string): STRSARReport {
  const report = strSarReports.get(id);
  if (!report) throwNotFound(id);
  assertStatus(report, [STRSARStatus.FILED]);

  report.status = STRSARStatus.ACKNOWLEDGED;
  report.acknowledgedAt = new Date();
  report.updatedAt = new Date();
  strSarReports.set(id, report);

  logger.info('STR/SAR report acknowledged', { id, reportNumber: report.reportNumber });

  return report;
}

export function amendReport(
  originalId: string,
  filingOfficerUserId: string,
  filingOfficerName: string,
  reason: string
): STRSARReport {
  const original = strSarReports.get(originalId);
  if (!original) throwNotFound(originalId);

  const amendment = createSTRSAR(
    {
      type: original.type,
      subjectName: original.subjectName,
      subjectWalletAddresses: [...original.subjectWalletAddresses],
      subjectIdentification: original.subjectIdentification,
      subjectCountry: original.subjectCountry,
      suspicionCategories: [...original.suspicionCategories],
      narrativeSummary: original.narrativeSummary,
      indicatorsOfSuspicion: [...original.indicatorsOfSuspicion],
      linkedTransactionIds: [...original.linkedTransactionIds],
      linkedCaseIds: [...original.linkedCaseIds],
      linkedWalletAddresses: [...original.linkedWalletAddresses],
      totalAmountUSD: original.totalAmountUSD,
      dateRangeStart: original.dateRangeStart,
      dateRangeEnd: original.dateRangeEnd,
      filingOfficerUserId,
      regulatoryAuthority: original.regulatoryAuthority,
    },
    filingOfficerName
  );

  amendment.amendmentOf = originalId;
  amendment.amendmentReason = reason;
  amendment.updatedAt = new Date();
  strSarReports.set(amendment.id, amendment);

  // Mark original as amended
  original.status = STRSARStatus.AMENDED;
  original.updatedAt = new Date();
  strSarReports.set(originalId, original);

  logger.info('STR/SAR amendment created', {
    amendmentId: amendment.id,
    originalId,
    reason,
  });

  return amendment;
}

export function getSTRSAR(id: string): STRSARReport | undefined {
  return strSarReports.get(id);
}

export function getSTRSARByNumber(reportNumber: string): STRSARReport | undefined {
  return Array.from(strSarReports.values()).find((r) => r.reportNumber === reportNumber);
}

export function getSTRSARs(filters?: STRSARFilter): {
  data: STRSARReport[];
  total: number;
  page: number;
  pageSize: number;
} {
  let reports = Array.from(strSarReports.values());

  if (filters) {
    if (filters.type !== undefined) {
      reports = reports.filter((r) => r.type === filters.type);
    }
    if (filters.status !== undefined) {
      reports = reports.filter((r) => r.status === filters.status);
    }
    if (filters.suspicionCategory !== undefined) {
      reports = reports.filter((r) => r.suspicionCategories.includes(filters.suspicionCategory!));
    }
    if (filters.filingOfficerUserId !== undefined) {
      reports = reports.filter((r) => r.filingOfficerUserId === filters.filingOfficerUserId);
    }
    if (filters.startDate !== undefined) {
      reports = reports.filter((r) => r.createdAt >= filters.startDate!);
    }
    if (filters.endDate !== undefined) {
      reports = reports.filter((r) => r.createdAt <= filters.endDate!);
    }
  }

  reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = reports.length;
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const start = (page - 1) * pageSize;
  const data = reports.slice(start, start + pageSize);

  return { data, total, page, pageSize };
}

export function getSTRSARStats(): STRSARStats {
  const reports = Array.from(strSarReports.values());
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const byType = {
    [STRSARType.STR]: 0,
    [STRSARType.SAR]: 0,
    [STRSARType.CTR]: 0,
  };
  const byStatus = {
    [STRSARStatus.DRAFT]: 0,
    [STRSARStatus.UNDER_REVIEW]: 0,
    [STRSARStatus.APPROVED]: 0,
    [STRSARStatus.FILED]: 0,
    [STRSARStatus.ACKNOWLEDGED]: 0,
    [STRSARStatus.REJECTED]: 0,
    [STRSARStatus.AMENDED]: 0,
  };
  const byCategory: Partial<Record<SuspicionCategory, number>> = {};

  let totalProcessingDays = 0;
  let processedCount = 0;
  let filedThisMonth = 0;
  let filedThisYear = 0;

  for (const r of reports) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

    for (const cat of r.suspicionCategories) {
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }

    if (r.submittedAt) {
      const processingMs = r.submittedAt.getTime() - r.createdAt.getTime();
      totalProcessingDays += processingMs / (1000 * 60 * 60 * 24);
      processedCount++;

      if (
        r.submittedAt.getMonth() === thisMonth &&
        r.submittedAt.getFullYear() === thisYear
      ) {
        filedThisMonth++;
      }
      if (r.submittedAt.getFullYear() === thisYear) {
        filedThisYear++;
      }
    }
  }

  const averageProcessingDays =
    processedCount > 0 ? Math.round(totalProcessingDays / processedCount) : 0;

  const pendingReview = byStatus[STRSARStatus.UNDER_REVIEW];

  return {
    totalReports: reports.length,
    byType,
    byStatus,
    byCategory,
    averageProcessingDays,
    filedThisMonth,
    filedThisYear,
    pendingReview,
  };
}

/**
 * Automatically generates a draft STR from a list of transaction IDs.
 */
export function autoGenerateSTR(
  transactionIds: string[],
  caseId?: string
): STRSARReport {
  const now = new Date();
  const dateRangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  const narrativeSummary =
    `Automatically generated STR based on ${transactionIds.length} suspicious transaction(s).` +
    (caseId ? ` Linked to case ${caseId}.` : '') +
    ' Please review and update with detailed narrative before filing.';

  const report = createSTRSAR(
    {
      type: STRSARType.STR,
      subjectName: 'UNKNOWN — Review Required',
      subjectWalletAddresses: [],
      suspicionCategories: [SuspicionCategory.UNUSUAL_PATTERN],
      narrativeSummary,
      indicatorsOfSuspicion: ['Automated detection — manual review required'],
      linkedTransactionIds: transactionIds,
      linkedCaseIds: caseId ? [caseId] : [],
      totalAmountUSD: 0,
      dateRangeStart,
      dateRangeEnd: now,
      filingOfficerUserId: 'system',
      regulatoryAuthority: 'NFIU',
    },
    'System (Auto-Generated)'
  );

  return report;
}

// Exported for testing
export { strSarReports as _strSarStore };
