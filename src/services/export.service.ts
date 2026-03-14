/**
 * Export Service for CRYPTRAC
 * Provides CSV, JSON, and PDF export capabilities for all major data types.
 */

import PDFDocument from 'pdfkit';
import { Writable } from 'stream';
import {
  Transaction,
  ComplianceReport,
  TaxAssessment,
  Case,
  AuditEntry,
} from '../types';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'csv' | 'json' | 'pdf';

export type ExportResourceType =
  | 'transactions'
  | 'compliance-reports'
  | 'tax-assessments'
  | 'cases'
  | 'audit-logs';

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsv).join(',');
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export function exportTransactionsCsv(transactions: Transaction[]): string {
  const headers = [
    'ID',
    'TX Hash',
    'Type',
    'Sender Address',
    'Receiver Address',
    'Asset',
    'Amount',
    'Amount USD',
    'Fee',
    'Fee USD',
    'Network',
    'Risk Level',
    'Risk Score',
    'Compliance Status',
    'Timestamp',
    'Created At',
  ];

  const rows = transactions.map((t) =>
    buildCsvRow([
      t.id,
      t.txHash,
      t.type,
      t.senderAddress,
      t.receiverAddress,
      t.asset,
      t.amount,
      t.amountUSD,
      t.fee,
      t.feeUSD,
      t.network,
      t.riskLevel,
      t.riskScore,
      t.complianceStatus,
      t.timestamp.toISOString(),
      t.createdAt.toISOString(),
    ])
  );

  return [buildCsvRow(headers), ...rows].join('\n');
}

export function exportTransactionsPdf(transactions: Transaction[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        cb();
      },
    });
    doc.pipe(stream);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('CRYPTRAC – Transaction Export', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();

    // Summary
    doc.fontSize(12).font('Helvetica-Bold').text(`Total Records: ${transactions.length}`);
    doc.moveDown();

    // Table rows
    for (const t of transactions) {
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`TX: ${t.txHash ?? t.id}`, { continued: false });
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(
          `Type: ${t.type}  |  Asset: ${t.asset}  |  Amount: ${t.amount} (${t.amountUSD} USD)  |  Network: ${t.network}`
        )
        .text(
          `Risk: ${t.riskLevel} (${t.riskScore})  |  Compliance: ${t.complianceStatus}  |  Date: ${t.timestamp.toISOString()}`
        )
        .text(`Sender: ${t.senderAddress}  →  Receiver: ${t.receiverAddress}`);
      doc.moveDown(0.5);
    }

    doc.end();
    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Compliance Reports
// ---------------------------------------------------------------------------

export function exportComplianceReportsCsv(reports: ComplianceReport[]): string {
  const headers = [
    'ID',
    'Report Type',
    'Transaction ID',
    'Status',
    'Filed By',
    'Filed At',
    'Reviewed By',
    'Reviewed At',
    'Narrative',
    'Created At',
  ];

  const rows = reports.map((r) =>
    buildCsvRow([
      r.id,
      r.reportType,
      r.transactionId,
      r.status,
      r.filedBy ?? '',
      r.filedAt ? r.filedAt.toISOString() : '',
      r.reviewedBy ?? '',
      r.reviewedAt ? r.reviewedAt.toISOString() : '',
      r.narrative,
      r.createdAt.toISOString(),
    ])
  );

  return [buildCsvRow(headers), ...rows].join('\n');
}

export function exportComplianceReportsPdf(reports: ComplianceReport[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        cb();
      },
    });
    doc.pipe(stream);

    doc.fontSize(18).font('Helvetica-Bold').text('CRYPTRAC – Compliance Report Export', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold').text(`Total Records: ${reports.length}`);
    doc.moveDown();

    for (const r of reports) {
      doc.fontSize(10).font('Helvetica-Bold').text(`Report ID: ${r.id}`);
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Type: ${r.reportType}  |  Status: ${r.status}  |  Transaction: ${r.transactionId}`)
        .text(`Filed By: ${r.filedBy ?? 'N/A'}  |  Filed At: ${r.filedAt?.toISOString() ?? 'N/A'}`)
        .text(`Reviewed By: ${r.reviewedBy ?? 'N/A'}  |  Reviewed At: ${r.reviewedAt?.toISOString() ?? 'N/A'}`)
        .text(`Narrative: ${r.narrative}`);
      doc.moveDown(0.5);
    }

    doc.end();
    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Tax Assessments
// ---------------------------------------------------------------------------

export function exportTaxAssessmentsCsv(assessments: TaxAssessment[]): string {
  const headers = [
    'ID',
    'User ID',
    'Tax Year',
    'Period',
    'Status',
    'Total Transactions',
    'Net Capital Gain USD',
    'Short Term Gain USD',
    'Long Term Gain USD',
    'Total Income USD',
    'Capital Gains Tax USD',
    'Income Tax USD',
    'Total Tax Liability USD',
    'Total Tax Liability NGN',
    'Generated At',
  ];

  const rows = assessments.map((a) =>
    buildCsvRow([
      a.id,
      a.userId,
      a.taxYear,
      a.period,
      a.status,
      a.totalTransactions,
      a.netCapitalGainUSD,
      a.shortTermGainUSD,
      a.longTermGainUSD,
      a.totalIncomeUSD,
      a.capitalGainsTaxUSD,
      a.incomeTaxUSD,
      a.totalTaxLiabilityUSD,
      a.totalTaxLiabilityNGN,
      a.generatedAt.toISOString(),
    ])
  );

  return [buildCsvRow(headers), ...rows].join('\n');
}

export function exportTaxAssessmentsPdf(assessments: TaxAssessment[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        cb();
      },
    });
    doc.pipe(stream);

    doc.fontSize(18).font('Helvetica-Bold').text('CRYPTRAC – Tax Assessment Export', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold').text(`Total Records: ${assessments.length}`);
    doc.moveDown();

    for (const a of assessments) {
      doc.fontSize(10).font('Helvetica-Bold').text(`Assessment ID: ${a.id}`);
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`User: ${a.userId}  |  Year: ${a.taxYear}  |  Period: ${a.period}  |  Status: ${a.status}`)
        .text(`Net Capital Gain: $${a.netCapitalGainUSD.toFixed(2)} USD`)
        .text(`Short-term: $${a.shortTermGainUSD.toFixed(2)}  |  Long-term: $${a.longTermGainUSD.toFixed(2)}`)
        .text(`Total Income: $${a.totalIncomeUSD.toFixed(2)} USD`)
        .text(`Tax Liability: $${a.totalTaxLiabilityUSD.toFixed(2)} USD / ₦${a.totalTaxLiabilityNGN.toFixed(2)} NGN`);
      doc.moveDown(0.5);
    }

    doc.end();
    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export function exportCasesCsv(cases: Case[]): string {
  const headers = [
    'ID',
    'Case Number',
    'Title',
    'Category',
    'Status',
    'Priority',
    'Assignee ID',
    'Created By',
    'Risk Level',
    'Transaction Count',
    'Wallet Count',
    'Created At',
    'Updated At',
  ];

  const rows = cases.map((c) =>
    buildCsvRow([
      c.id,
      c.caseNumber,
      c.title,
      c.category,
      c.status,
      c.priority,
      c.assigneeId ?? '',
      c.createdById,
      c.riskLevel,
      c.transactionIds.length,
      c.walletAddresses.length,
      c.createdAt.toISOString(),
      c.updatedAt.toISOString(),
    ])
  );

  return [buildCsvRow(headers), ...rows].join('\n');
}

export function exportCasesPdf(cases: Case[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        cb();
      },
    });
    doc.pipe(stream);

    doc.fontSize(18).font('Helvetica-Bold').text('CRYPTRAC – Case Export', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold').text(`Total Records: ${cases.length}`);
    doc.moveDown();

    for (const c of cases) {
      doc.fontSize(10).font('Helvetica-Bold').text(`${c.caseNumber}: ${c.title}`);
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Category: ${c.category}  |  Status: ${c.status}  |  Priority: ${c.priority}  |  Risk: ${c.riskLevel}`)
        .text(`Assignee: ${c.assigneeId ?? 'Unassigned'}  |  Created By: ${c.createdById}`)
        .text(`Transactions: ${c.transactionIds.length}  |  Wallets: ${c.walletAddresses.length}`)
        .text(`Created: ${c.createdAt.toISOString()}  |  Updated: ${c.updatedAt.toISOString()}`);
      if (c.description) {
        doc.text(`Description: ${c.description}`);
      }
      doc.moveDown(0.5);
    }

    doc.end();
    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

export function exportAuditLogCsv(entries: AuditEntry[]): string {
  const headers = [
    'ID',
    'Timestamp',
    'User ID',
    'User Email',
    'User Role',
    'Action',
    'Entity Type',
    'Entity ID',
    'Description',
  ];

  const rows = entries.map((e) =>
    buildCsvRow([
      e.id,
      e.timestamp.toISOString(),
      e.userId,
      e.userEmail,
      e.userRole,
      e.action,
      e.entityType,
      e.entityId,
      e.description,
    ])
  );

  return [buildCsvRow(headers), ...rows].join('\n');
}

export function exportAuditLogPdf(entries: AuditEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        cb();
      },
    });
    doc.pipe(stream);

    doc.fontSize(18).font('Helvetica-Bold').text('CRYPTRAC – Audit Log Export', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica-Bold').text(`Total Records: ${entries.length}`);
    doc.moveDown();

    for (const e of entries) {
      doc.fontSize(9).font('Helvetica-Bold').text(`${e.timestamp.toISOString()}  |  ${e.action}`);
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`User: ${e.userEmail} (${e.userRole})`)
        .text(`Entity: ${e.entityType} / ${e.entityId}`)
        .text(`Description: ${e.description}`);
      doc.moveDown(0.4);
    }

    doc.end();
    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Generic dispatcher
// ---------------------------------------------------------------------------

export interface ExportResult {
  contentType: string;
  filename: string;
  data: Buffer | string;
}

export async function exportData(
  resourceType: ExportResourceType,
  format: ExportFormat,
  data: (Transaction | ComplianceReport | TaxAssessment | Case | AuditEntry)[]
): Promise<ExportResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `${resourceType}-${timestamp}`;

  logger.info('Generating export', { resourceType, format, count: data.length });

  if (format === 'json') {
    return {
      contentType: 'application/json',
      filename: `${baseName}.json`,
      data: JSON.stringify(data, null, 2),
    };
  }

  if (format === 'csv') {
    let csv = '';
    switch (resourceType) {
      case 'transactions':
        csv = exportTransactionsCsv(data as Transaction[]);
        break;
      case 'compliance-reports':
        csv = exportComplianceReportsCsv(data as ComplianceReport[]);
        break;
      case 'tax-assessments':
        csv = exportTaxAssessmentsCsv(data as TaxAssessment[]);
        break;
      case 'cases':
        csv = exportCasesCsv(data as Case[]);
        break;
      case 'audit-logs':
        csv = exportAuditLogCsv(data as AuditEntry[]);
        break;
    }
    return {
      contentType: 'text/csv',
      filename: `${baseName}.csv`,
      data: csv,
    };
  }

  // PDF
  let pdfBuffer: Buffer;
  switch (resourceType) {
    case 'transactions':
      pdfBuffer = await exportTransactionsPdf(data as Transaction[]);
      break;
    case 'compliance-reports':
      pdfBuffer = await exportComplianceReportsPdf(data as ComplianceReport[]);
      break;
    case 'tax-assessments':
      pdfBuffer = await exportTaxAssessmentsPdf(data as TaxAssessment[]);
      break;
    case 'cases':
      pdfBuffer = await exportCasesPdf(data as Case[]);
      break;
    case 'audit-logs':
      pdfBuffer = await exportAuditLogPdf(data as AuditEntry[]);
      break;
    default:
      throw new Error(`Unsupported resource type: ${resourceType as string}`);
  }

  return {
    contentType: 'application/pdf',
    filename: `${baseName}.pdf`,
    data: pdfBuffer,
  };
}

// ---------------------------------------------------------------------------
// Enhanced Export: Analytics Report
// ---------------------------------------------------------------------------

import { v4 as uuidv4 } from 'uuid';
import {
  ExportJob,
  AuditFilter,
  PatternDetectionResult,
  TransactionGraph,
  AnalyticsKPIs,
  TimeSeriesPoint,
  RiskDistributionItem,
  AssetBreakdownItem,
} from '../types';
import * as analyticsService from './analytics.service';
import * as patternService from './pattern-detection.service';
import * as networkService from './network-analysis.service';
import * as auditService from './audit.service';
import { getCaseById } from './case.service';

// In-memory job store
const exportJobs = new Map<string, ExportJob>();

export interface AnalyticsReportData {
  kpis: AnalyticsKPIs;
  timeSeries: TimeSeriesPoint[];
  riskDistribution: RiskDistributionItem[];
  assetBreakdown: AssetBreakdownItem[];
  generatedAt: Date;
}

export async function exportAnalyticsReport(
  format: 'csv' | 'json' | 'pdf'
): Promise<ExportResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `analytics-report-${timestamp}`;

  const [kpis, timeSeries, riskDistribution, assetBreakdown] = await Promise.all([
    analyticsService.getKPIs(),
    analyticsService.getTransactionTimeSeries('day', 30),
    analyticsService.getRiskDistribution(),
    analyticsService.getAssetBreakdown(),
  ]);

  const data: AnalyticsReportData = {
    kpis,
    timeSeries,
    riskDistribution,
    assetBreakdown,
    generatedAt: new Date(),
  };

  logger.info('Generating analytics report', { format });

  if (format === 'json') {
    return {
      contentType: 'application/json',
      filename: `${baseName}.json`,
      data: JSON.stringify(data, null, 2),
    };
  }

  if (format === 'csv') {
    const kpiRows = Object.entries(kpis).map(([key, value]) =>
      buildCsvRow([key, String(value)])
    );
    const kpiSection = ['Metric,Value', ...kpiRows].join('\n');

    const tsHeaders = buildCsvRow(['Date', 'Count', 'Volume USD', 'Flagged Count']);
    const tsRows = timeSeries.map((p) =>
      buildCsvRow([p.date, p.count, p.volumeUSD, p.flaggedCount])
    );
    const tsSection = [tsHeaders, ...tsRows].join('\n');

    const csv = `CRYPTRAC Analytics Report\nGenerated: ${data.generatedAt.toISOString()}\n\nKPIs\n${kpiSection}\n\nTransaction Time Series\n${tsSection}`;
    return { contentType: 'text/csv', filename: `${baseName}.csv`, data: csv };
  }

  // PDF
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        cb();
      },
    });
    doc.pipe(stream);

    doc.fontSize(18).font('Helvetica-Bold').text('CRYPTRAC – Analytics Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${data.generatedAt.toISOString()}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold').text('Key Performance Indicators');
    doc.moveDown(0.5);
    for (const [key, value] of Object.entries(kpis)) {
      doc.fontSize(9).font('Helvetica').text(`${key}: ${String(value)}`);
    }
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold').text('Risk Distribution');
    doc.moveDown(0.5);
    for (const item of riskDistribution) {
      doc.fontSize(9).font('Helvetica').text(`${item.level}: ${item.count} (${item.percentage.toFixed(1)}%)`);
    }
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold').text('Asset Breakdown');
    doc.moveDown(0.5);
    for (const item of assetBreakdown) {
      doc.fontSize(9).font('Helvetica').text(`${item.asset}: ${item.count} txns, $${item.volumeUSD.toFixed(2)} USD (${item.percentage.toFixed(1)}%)`);
    }

    doc.end();
    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  return { contentType: 'application/pdf', filename: `${baseName}.pdf`, data: buffer };
}

// ---------------------------------------------------------------------------
// Enhanced Export: Case Report
// ---------------------------------------------------------------------------

export async function exportCaseReport(
  caseId: string,
  format: 'csv' | 'json' | 'pdf'
): Promise<ExportResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `case-${caseId}-${timestamp}`;

  const details = getCaseById(caseId);
  if (!details) {
    throw new Error(`Case not found: ${caseId}`);
  }

  logger.info('Generating case report', { caseId, format });

  if (format === 'json') {
    return {
      contentType: 'application/json',
      filename: `${baseName}.json`,
      data: JSON.stringify(details, null, 2),
    };
  }

  if (format === 'csv') {
    const caseRow = buildCsvRow([
      details.id,
      details.caseNumber,
      details.title,
      details.category,
      details.status,
      details.priority,
      details.riskLevel,
      details.createdAt.toISOString(),
    ]);

    const notesSection = details.notes.length > 0
      ? ['Note ID,Author,Content,Created At', ...details.notes.map((n) =>
          buildCsvRow([n.id, n.authorId, n.content, n.createdAt.toISOString()])
        )].join('\n')
      : 'No notes';

    const timelineSection = details.timeline.length > 0
      ? ['Event,Performed By,Timestamp', ...details.timeline.map((t) =>
          buildCsvRow([t.action, t.performedById, t.timestamp.toISOString()])
        )].join('\n')
      : 'No timeline entries';

    const csv = `Case ID,Case Number,Title,Category,Status,Priority,Risk Level,Created At\n${caseRow}\n\nNotes\n${notesSection}\n\nTimeline\n${timelineSection}`;
    return { contentType: 'text/csv', filename: `${baseName}.csv`, data: csv };
  }

  // PDF
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        cb();
      },
    });
    doc.pipe(stream);

    const c = details;
    doc.fontSize(18).font('Helvetica-Bold').text(`CRYPTRAC – Case Report: ${c.caseNumber}`, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Case Details');
    doc.fontSize(9).font('Helvetica')
      .text(`Title: ${c.title}`)
      .text(`Category: ${c.category}  |  Status: ${c.status}  |  Priority: ${c.priority}  |  Risk: ${c.riskLevel}`)
      .text(`Assignee: ${c.assigneeId ?? 'Unassigned'}  |  Created By: ${c.createdById}`)
      .text(`Created: ${c.createdAt.toISOString()}`);
    if (c.description) doc.text(`Description: ${c.description}`);
    doc.moveDown();

    if (details.notes.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Notes');
      for (const note of details.notes) {
        doc.fontSize(9).font('Helvetica-Bold').text(`[${note.createdAt.toISOString()}] ${note.authorId}`);
        doc.fontSize(9).font('Helvetica').text(note.content);
        doc.moveDown(0.3);
      }
      doc.moveDown();
    }

    if (details.timeline.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Timeline');
      for (const entry of details.timeline) {
        doc.fontSize(9).font('Helvetica').text(`[${entry.timestamp.toISOString()}] ${entry.action} — ${entry.performedById}`);
      }
    }

    doc.end();
    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  return { contentType: 'application/pdf', filename: `${baseName}.pdf`, data: buffer };
}

// ---------------------------------------------------------------------------
// Enhanced Export: Audit Log with Filters
// ---------------------------------------------------------------------------

export async function exportAuditLog(
  filters: AuditFilter,
  format: 'csv' | 'json' | 'pdf'
): Promise<ExportResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `audit-log-${timestamp}`;

  const result = auditService.getAuditLog({
    ...filters,
    pageSize: 10_000,
  });
  const entries = result.data ?? [];

  logger.info('Generating audit log export', { format, count: entries.length });

  if (format === 'json') {
    return {
      contentType: 'application/json',
      filename: `${baseName}.json`,
      data: JSON.stringify(entries, null, 2),
    };
  }

  if (format === 'csv') {
    return {
      contentType: 'text/csv',
      filename: `${baseName}.csv`,
      data: exportAuditLogCsv(entries),
    };
  }

  return {
    contentType: 'application/pdf',
    filename: `${baseName}.pdf`,
    data: await exportAuditLogPdf(entries),
  };
}

// ---------------------------------------------------------------------------
// Enhanced Export: Pattern Report
// ---------------------------------------------------------------------------

export async function exportPatternReport(
  format: 'csv' | 'json' | 'pdf'
): Promise<ExportResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `pattern-report-${timestamp}`;

  const result: PatternDetectionResult = await patternService.detectAllPatterns();

  logger.info('Generating pattern report', { format, totalPatterns: result.summary.totalPatterns });

  if (format === 'json') {
    return {
      contentType: 'application/json',
      filename: `${baseName}.json`,
      data: JSON.stringify(result, null, 2),
    };
  }

  if (format === 'csv') {
    const summaryRows = [
      'Pattern Type,Count',
      buildCsvRow(['Structuring', result.summary.structuringCount]),
      buildCsvRow(['Rapid Movement', result.summary.rapidMovementCount]),
      buildCsvRow(['Layering', result.summary.layeringCount]),
      buildCsvRow(['Round Tripping', result.summary.roundTrippingCount]),
      buildCsvRow(['Total', result.summary.totalPatterns]),
    ].join('\n');

    const structRows = result.structuring.map((p) =>
      buildCsvRow([p.walletAddress, p.transactions.length, p.totalAmount, p.timeWindowHours, p.detectedAt.toISOString()])
    );
    const structSection = ['Wallet,TX Count,Total Amount,Window (h),Detected At', ...structRows].join('\n');

    const csv = `CRYPTRAC Pattern Detection Report\nGenerated: ${new Date().toISOString()}\n\nSummary\n${summaryRows}\n\nStructuring Patterns\n${structSection}`;
    return { contentType: 'text/csv', filename: `${baseName}.csv`, data: csv };
  }

  // PDF
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
        cb();
      },
    });
    doc.pipe(stream);

    doc.fontSize(18).font('Helvetica-Bold').text('CRYPTRAC – Pattern Detection Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Generated: ${result.summary.detectedAt.toISOString()}`, { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Summary');
    doc.fontSize(9).font('Helvetica')
      .text(`Total Patterns Detected: ${result.summary.totalPatterns}`)
      .text(`Structuring: ${result.summary.structuringCount}`)
      .text(`Rapid Movement: ${result.summary.rapidMovementCount}`)
      .text(`Layering: ${result.summary.layeringCount}`)
      .text(`Round Tripping: ${result.summary.roundTrippingCount}`);
    doc.moveDown();

    if (result.structuring.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Structuring Patterns');
      for (const p of result.structuring) {
        doc.fontSize(9).font('Helvetica')
          .text(`Wallet: ${p.walletAddress}  |  TXs: ${p.transactions.length}  |  Total: $${p.totalAmount.toFixed(2)}  |  Window: ${p.timeWindowHours}h`);
      }
      doc.moveDown();
    }

    if (result.rapidMovement.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Rapid Movement Patterns');
      for (const p of result.rapidMovement) {
        doc.fontSize(9).font('Helvetica')
          .text(`Wallet: ${p.walletAddress}  |  Delta: ${p.timeDeltaMinutes}m  |  Amount: $${p.amountUSD.toFixed(2)}`);
      }
      doc.moveDown();
    }

    if (result.layering.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Layering Patterns');
      for (const p of result.layering) {
        doc.fontSize(9).font('Helvetica')
          .text(`Origin: ${p.originAddress}  →  Final: ${p.finalAddress}  |  Hops: ${p.hops}  |  Volume: $${p.totalVolumeUSD.toFixed(2)}`);
      }
      doc.moveDown();
    }

    if (result.roundTripping.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Round Tripping Patterns');
      for (const p of result.roundTripping) {
        doc.fontSize(9).font('Helvetica')
          .text(`Origin: ${p.originAddress}  |  TXs: ${p.transactions.length}  |  Volume: $${p.totalVolumeUSD.toFixed(2)}  |  Duration: ${p.roundTripMinutes}m`);
      }
    }

    doc.end();
    stream.on('finish', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  return { contentType: 'application/pdf', filename: `${baseName}.pdf`, data: buffer };
}

// ---------------------------------------------------------------------------
// Enhanced Export: Network Graph
// ---------------------------------------------------------------------------

export async function exportNetworkGraph(): Promise<ExportResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `network-graph-${timestamp}`;

  const graph: TransactionGraph = await networkService.buildTransactionGraph();

  logger.info('Generating network graph export', {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
  });

  return {
    contentType: 'application/json',
    filename: `${baseName}.json`,
    data: JSON.stringify(graph, null, 2),
  };
}

// ---------------------------------------------------------------------------
// Export Jobs
// ---------------------------------------------------------------------------

export function scheduleExport(
  userId: string,
  exportType: string,
  format: string,
  filters?: Record<string, unknown>
): ExportJob {
  const job: ExportJob = {
    id: uuidv4(),
    userId,
    exportType,
    format: format as ExportJob['format'],
    status: 'pending',
    filters,
    createdAt: new Date(),
  };
  exportJobs.set(job.id, job);

  logger.info('Export job scheduled', { jobId: job.id, exportType, format });

  // Process job asynchronously
  void processExportJob(job);

  // Return a snapshot (not a reference) so the initial 'pending' status is preserved
  return { ...job };
}

async function processExportJob(job: ExportJob): Promise<void> {
  // Yield once so that `scheduleExport` can return the 'pending' snapshot before
  // we transition the job to 'processing'.
  await Promise.resolve();

  const stored = exportJobs.get(job.id);
  if (!stored) return;

  stored.status = 'processing';
  exportJobs.set(job.id, stored);

  try {
    let result: ExportResult;
    const fmt = job.format as 'csv' | 'json' | 'pdf';

    switch (job.exportType) {
      case 'analytics':
        result = await exportAnalyticsReport(fmt);
        break;
      case 'patterns':
        result = await exportPatternReport(fmt);
        break;
      case 'network-graph':
        result = await exportNetworkGraph();
        break;
      case 'audit-log':
        result = await exportAuditLog(
          (job.filters ?? {}) as AuditFilter,
          fmt
        );
        break;
      default:
        throw new Error(`Unsupported export type: ${job.exportType}`);
    }

    const dataSize = Buffer.isBuffer(result.data)
      ? result.data.length
      : Buffer.byteLength(result.data as string);

    stored.status = 'completed';
    stored.completedAt = new Date();
    stored.fileSize = dataSize;
    exportJobs.set(job.id, stored);
    logger.info('Export job completed', { jobId: job.id, fileSize: dataSize });
  } catch (err) {
    stored.status = 'failed';
    stored.completedAt = new Date();
    stored.error = err instanceof Error ? err.message : String(err);
    exportJobs.set(job.id, stored);
    logger.error('Export job failed', { jobId: job.id, error: stored.error });
  }
}

export function getExportJob(jobId: string): ExportJob | undefined {
  return exportJobs.get(jobId);
}

export function getExportHistory(userId: string): ExportJob[] {
  return Array.from(exportJobs.values())
    .filter((j) => j.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
