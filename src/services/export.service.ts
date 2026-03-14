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
