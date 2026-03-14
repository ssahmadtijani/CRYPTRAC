/**
 * XML Exchange Report Import Service for CRYPTRAC
 * Parses and validates exchange periodic reports in the CRYPTRAC XML format,
 * then persists them as ExchangeReportSubmission records.
 */

import { XMLParser } from 'fast-xml-parser';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { ExchangeTransaction } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ImportResult {
  submissionId: string;
  exchangeName: string;
  reportingPeriod: string;
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  validationErrors: ValidationError[];
  transactions: NormalisedExchangeTransaction[];
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  processedAt: Date;
}

export interface ImportRecord {
  id: string;
  exchangeName: string;
  reportingPeriod: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  validationErrors: ValidationError[] | null;
  submittedBy?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type NormalisedExchangeTransaction = ExchangeTransaction & {
  accountId: string;
  kycStatus: string;
  notes?: string;
};

// ---------------------------------------------------------------------------
// XML Parser configuration
// ---------------------------------------------------------------------------

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  trimValues: true,
  // Prevent entity expansion DoS attacks
  processEntities: false,
  htmlEntities: false,
};

function createParser(): XMLParser {
  return new XMLParser(parserOptions);
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const REQUIRED_TRANSACTION_FIELDS = [
  'TransactionID',
  'Type',
  'Asset',
  'Amount',
  'UnitPriceUSD',
  'TotalValueUSD',
  'Fee',
  'FeeUSD',
  'Timestamp',
];

const VALID_TRANSACTION_TYPES = new Set([
  'BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'SWAP', 'STAKING', 'MINING', 'AIRDROP',
]);

const VALID_KYC_STATUSES = new Set([
  'VERIFIED', 'PENDING', 'UNVERIFIED', 'ENHANCED', 'SUSPENDED',
]);

function validateReportingEntity(
  entity: Record<string, unknown>,
  errors: ValidationError[]
): void {
  const required = [
    'ExchangeName',
    'Jurisdiction',
    'LicenseNumber',
    'ReportingPeriod',
    'PeriodStart',
    'PeriodEnd',
  ];
  for (const field of required) {
    if (!entity[field]) {
      errors.push({ field: `ReportingEntity.${field}`, message: `${field} is required` });
    }
  }

  if (entity['PeriodStart'] && entity['PeriodEnd']) {
    const start = new Date(entity['PeriodStart'] as string);
    const end = new Date(entity['PeriodEnd'] as string);
    if (isNaN(start.getTime())) {
      errors.push({ field: 'ReportingEntity.PeriodStart', message: 'Invalid date format' });
    }
    if (isNaN(end.getTime())) {
      errors.push({ field: 'ReportingEntity.PeriodEnd', message: 'Invalid date format' });
    }
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
      errors.push({
        field: 'ReportingEntity.PeriodEnd',
        message: 'PeriodEnd must be after PeriodStart',
      });
    }
  }
}

function validateAccountHolder(
  holder: Record<string, unknown>,
  index: number,
  errors: ValidationError[]
): void {
  const prefix = `AccountHolders.AccountHolder[${index}]`;

  if (!holder['FullName']) {
    errors.push({ field: `${prefix}.FullName`, message: 'FullName is required' });
  }
  if (!holder['IDType']) {
    errors.push({ field: `${prefix}.IDType`, message: 'IDType is required' });
  }
  if (!holder['IDNumber']) {
    errors.push({ field: `${prefix}.IDNumber`, message: 'IDNumber is required' });
  }
  if (!holder['AccountID']) {
    errors.push({ field: `${prefix}.AccountID`, message: 'AccountID is required' });
  }
  if (!holder['KYCStatus']) {
    errors.push({ field: `${prefix}.KYCStatus`, message: 'KYCStatus is required' });
  } else if (!VALID_KYC_STATUSES.has(holder['KYCStatus'] as string)) {
    errors.push({
      field: `${prefix}.KYCStatus`,
      message: `KYCStatus must be one of: ${[...VALID_KYC_STATUSES].join(', ')}`,
    });
  }
}

function validateTransaction(
  tx: Record<string, unknown>,
  holderIndex: number,
  txIndex: number,
  errors: ValidationError[]
): void {
  const prefix = `AccountHolders.AccountHolder[${holderIndex}].Transactions.Transaction[${txIndex}]`;

  for (const field of REQUIRED_TRANSACTION_FIELDS) {
    if (tx[field] === undefined || tx[field] === null || tx[field] === '') {
      errors.push({ field: `${prefix}.${field}`, message: `${field} is required` });
    }
  }

  if (tx['Type'] && !VALID_TRANSACTION_TYPES.has(tx['Type'] as string)) {
    errors.push({
      field: `${prefix}.Type`,
      message: `Type must be one of: ${[...VALID_TRANSACTION_TYPES].join(', ')}`,
    });
  }

  if (tx['Timestamp']) {
    const ts = new Date(tx['Timestamp'] as string);
    if (isNaN(ts.getTime())) {
      errors.push({ field: `${prefix}.Timestamp`, message: 'Invalid ISO 8601 date-time' });
    }
  }

  for (const numField of ['Amount', 'UnitPriceUSD', 'TotalValueUSD', 'Fee', 'FeeUSD']) {
    const val = parseFloat(String(tx[numField] ?? ''));
    if (tx[numField] !== undefined && isNaN(val)) {
      errors.push({ field: `${prefix}.${numField}`, message: `${numField} must be a number` });
    }
    if (numField === 'Amount' && !isNaN(val) && val <= 0) {
      errors.push({ field: `${prefix}.Amount`, message: 'Amount must be positive' });
    }
  }
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function toArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function normaliseTxType(
  raw: string
): ExchangeTransaction['type'] {
  const upper = raw.toUpperCase();
  const map: Record<string, ExchangeTransaction['type']> = {
    BUY: 'BUY',
    SELL: 'SELL',
    DEPOSIT: 'DEPOSIT',
    WITHDRAWAL: 'WITHDRAWAL',
    SWAP: 'SWAP',
    STAKING: 'STAKING_REWARD',
    MINING: 'MINING_REWARD',
    AIRDROP: 'AIRDROP',
  };
  return map[upper] ?? 'BUY';
}

function normaliseTransaction(
  tx: Record<string, unknown>,
  exchangeName: string,
  accountId: string,
  kycStatus: string
): NormalisedExchangeTransaction {
  return {
    exchangeId: `${exchangeName}-${tx['TransactionID'] as string}`,
    exchangeName,
    externalTxId: String(tx['TransactionID'] ?? ''),
    type: normaliseTxType(String(tx['Type'] ?? '')),
    asset: String(tx['Asset'] ?? ''),
    amount: parseFloat(String(tx['Amount'] ?? '0')),
    pricePerUnit: parseFloat(String(tx['UnitPriceUSD'] ?? '0')),
    totalValueUSD: parseFloat(String(tx['TotalValueUSD'] ?? '0')),
    fee: parseFloat(String(tx['Fee'] ?? '0')),
    feeUSD: parseFloat(String(tx['FeeUSD'] ?? '0')),
    counterAsset: tx['CounterAsset'] ? String(tx['CounterAsset']) : undefined,
    counterAmount: tx['CounterAmount']
      ? parseFloat(String(tx['CounterAmount']))
      : undefined,
    walletAddress: tx['WalletAddress'] ? String(tx['WalletAddress']) : undefined,
    timestamp: new Date(String(tx['Timestamp'] ?? '')),
    accountId,
    kycStatus,
    notes: tx['Notes'] ? String(tx['Notes']) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Core parse + validate
// ---------------------------------------------------------------------------

/**
 * Parses XML and validates its structure without persisting anything.
 */
export function validateExchangeReport(xmlContent: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  let parsed: Record<string, unknown>;
  try {
    const parser = createParser();
    parsed = parser.parse(xmlContent) as Record<string, unknown>;
  } catch (err) {
    return {
      isValid: false,
      errors: [
        {
          field: 'root',
          message: `XML parsing failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      warnings,
    };
  }

  const root = parsed['ExchangeReport'] as Record<string, unknown> | undefined;
  if (!root) {
    return {
      isValid: false,
      errors: [{ field: 'root', message: 'Root element <ExchangeReport> not found' }],
      warnings,
    };
  }

  // Validate ReportingEntity
  const entity = root['ReportingEntity'] as Record<string, unknown> | undefined;
  if (!entity) {
    errors.push({ field: 'ReportingEntity', message: '<ReportingEntity> element is required' });
  } else {
    validateReportingEntity(entity, errors);
  }

  // Validate AccountHolders
  const holdersWrapper = root['AccountHolders'] as Record<string, unknown> | undefined;
  if (!holdersWrapper) {
    errors.push({ field: 'AccountHolders', message: '<AccountHolders> element is required' });
  } else {
    const holders = toArray(
      holdersWrapper['AccountHolder'] as Record<string, unknown> | Record<string, unknown>[]
    );
    holders.forEach((holder, i) => {
      validateAccountHolder(holder, i, errors);
      const txWrapper = holder['Transactions'] as Record<string, unknown> | undefined;
      const txs = txWrapper
        ? toArray(
            txWrapper['Transaction'] as
              | Record<string, unknown>
              | Record<string, unknown>[]
          )
        : [];
      txs.forEach((tx, j) => validateTransaction(tx, i, j, errors));
    });
  }

  // Validate Summary
  const summary = root['Summary'] as Record<string, unknown> | undefined;
  if (!summary) {
    warnings.push('<Summary> element is missing — aggregate validation skipped');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Import (validate + persist)
// ---------------------------------------------------------------------------

/**
 * Validates and imports an XML exchange report.
 * Persists an ExchangeReportSubmission record with all outcome metadata.
 */
export async function importExchangeReport(
  xmlContent: string,
  submittedBy?: string
): Promise<ImportResult> {
  const validation = validateExchangeReport(xmlContent);

  if (!validation.isValid) {
    // Persist failed submission
    const record = await prisma.exchangeReportSubmission.create({
      data: {
        exchangeName: 'UNKNOWN',
        reportingPeriod: 'UNKNOWN',
        periodStart: new Date(),
        periodEnd: new Date(),
        status: 'FAILED',
        validationErrors: validation.errors as object,
        submittedBy,
      },
    });

    return {
      submissionId: record.id,
      exchangeName: 'UNKNOWN',
      reportingPeriod: 'UNKNOWN',
      totalRecords: 0,
      validRecords: 0,
      errorRecords: 0,
      validationErrors: validation.errors,
      transactions: [],
      status: 'FAILED',
      processedAt: record.createdAt,
    };
  }

  const parser = createParser();
  const parsed = parser.parse(xmlContent) as Record<string, unknown>;
  const root = parsed['ExchangeReport'] as Record<string, unknown>;
  const entity = root['ReportingEntity'] as Record<string, unknown>;
  const holdersWrapper = root['AccountHolders'] as Record<string, unknown>;

  const exchangeName = String(entity['ExchangeName'] ?? '');
  const reportingPeriod = String(entity['ReportingPeriod'] ?? '');
  const periodStart = new Date(String(entity['PeriodStart'] ?? ''));
  const periodEnd = new Date(String(entity['PeriodEnd'] ?? ''));

  const holders = toArray(
    holdersWrapper['AccountHolder'] as
      | Record<string, unknown>
      | Record<string, unknown>[]
  );

  const normalisedTransactions: NormalisedExchangeTransaction[] = [];
  const rowErrors: ValidationError[] = [];

  for (const holder of holders) {
    const accountId = String(holder['AccountID'] ?? '');
    const kycStatus = String(holder['KYCStatus'] ?? 'UNVERIFIED');
    const txWrapper = holder['Transactions'] as Record<string, unknown> | undefined;
    const txs = txWrapper
      ? toArray(
          txWrapper['Transaction'] as
            | Record<string, unknown>
            | Record<string, unknown>[]
        )
      : [];

    for (const tx of txs) {
      try {
        normalisedTransactions.push(
          normaliseTransaction(tx, exchangeName, accountId, kycStatus)
        );
      } catch (err) {
        rowErrors.push({
          field: `Transaction[${tx['TransactionID'] as string}]`,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const validRecords = normalisedTransactions.length;
  const errorRecords = rowErrors.length;
  const totalRecords = validRecords + errorRecords;
  const status = errorRecords === 0 ? 'COMPLETED' : 'PARTIAL';

  const record = await prisma.exchangeReportSubmission.create({
    data: {
      exchangeName,
      reportingPeriod,
      periodStart,
      periodEnd,
      status,
      totalRecords,
      validRecords,
      errorRecords,
      validationErrors: rowErrors.length > 0 ? (rowErrors as object) : undefined,
      submittedBy,
      processedAt: new Date(),
    },
  });

  logger.info('Exchange report imported', {
    submissionId: record.id,
    exchangeName,
    reportingPeriod,
    totalRecords,
    validRecords,
    errorRecords,
    status,
  });

  return {
    submissionId: record.id,
    exchangeName,
    reportingPeriod,
    totalRecords,
    validRecords,
    errorRecords,
    validationErrors: rowErrors,
    transactions: normalisedTransactions,
    status: status as 'COMPLETED' | 'PARTIAL' | 'FAILED',
    processedAt: record.processedAt ?? record.createdAt,
  };
}

/**
 * Returns a list of all past import submissions (most recent first).
 */
export async function getImportHistory(
  page = 1,
  pageSize = 20
): Promise<{ data: ImportRecord[]; total: number; page: number; pageSize: number }> {
  const [total, records] = await Promise.all([
    prisma.exchangeReportSubmission.count(),
    prisma.exchangeReportSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const data: ImportRecord[] = records.map((r) => ({
    id: r.id,
    exchangeName: r.exchangeName,
    reportingPeriod: r.reportingPeriod,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    status: r.status,
    totalRecords: r.totalRecords,
    validRecords: r.validRecords,
    errorRecords: r.errorRecords,
    validationErrors: r.validationErrors
      ? (r.validationErrors as unknown as ValidationError[])
      : null,
    submittedBy: r.submittedBy ?? undefined,
    processedAt: r.processedAt ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return { data, total, page, pageSize };
}

/**
 * Returns the details of a specific import submission by ID.
 */
export async function getImportById(id: string): Promise<ImportRecord | null> {
  const record = await prisma.exchangeReportSubmission.findUnique({
    where: { id },
  });

  if (!record) return null;

  return {
    id: record.id,
    exchangeName: record.exchangeName,
    reportingPeriod: record.reportingPeriod,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    status: record.status,
    totalRecords: record.totalRecords,
    validRecords: record.validRecords,
    errorRecords: record.errorRecords,
    validationErrors: record.validationErrors
      ? (record.validationErrors as unknown as ValidationError[])
      : null,
    submittedBy: record.submittedBy ?? undefined,
    processedAt: record.processedAt ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
