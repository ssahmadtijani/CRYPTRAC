/**
 * Travel Rule Compliance Service for CRYPTRAC
 * Implements FATF Recommendation 16 — Virtual Asset Travel Rule
 */

import { v4 as uuidv4 } from 'uuid';
import {
  TravelRuleRecord,
  TravelRuleStatus,
  VASPInfo,
  OriginatorInfo,
  BeneficiaryInfo,
  WSEventType,
} from '../types';
import { logger } from '../utils/logger';
import { eventBus } from '../utils/eventBus';

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const travelRuleRecords = new Map<string, TravelRuleRecord>();
const vaspRegistry = new Map<string, VASPInfo>();

// FATF threshold in USD (configurable)
const THRESHOLD_USD = Number(process.env.TRAVEL_RULE_THRESHOLD_USD ?? 1000);
// 72-hour expiry per FATF guidelines
const EXPIRY_HOURS = 72;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowPlusHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initiates a travel rule record for a transaction.
 * If the amount is below the threshold, the record is marked EXEMPT.
 */
export function initiateTravelRule(
  transactionId: string,
  originatorInfo: OriginatorInfo,
  beneficiaryInfo: BeneficiaryInfo,
  amount: number,
  amountUSD: number,
  asset: string,
  network: string
): TravelRuleRecord {
  const isAboveThreshold = amountUSD >= THRESHOLD_USD;
  const now = new Date();

  const record: TravelRuleRecord = {
    id: uuidv4(),
    transactionId,
    originatorInfo,
    beneficiaryInfo,
    amount,
    amountUSD,
    asset,
    network,
    status: isAboveThreshold ? TravelRuleStatus.PENDING : TravelRuleStatus.EXEMPT,
    thresholdApplied: THRESHOLD_USD,
    isAboveThreshold,
    complianceNotes: [],
    requestedAt: now,
    expiresAt: nowPlusHours(EXPIRY_HOURS),
    createdAt: now,
    updatedAt: now,
  };

  if (!isAboveThreshold) {
    record.complianceNotes.push(
      `Transaction amount $${amountUSD.toFixed(2)} is below the $${THRESHOLD_USD} threshold — exempt from Travel Rule.`
    );
  }

  travelRuleRecords.set(record.id, record);

  logger.info('Travel rule record initiated', {
    id: record.id,
    transactionId,
    amountUSD,
    status: record.status,
  });

  return record;
}

/**
 * Updates the status of an existing travel rule record.
 */
export function updateTravelRuleStatus(
  recordId: string,
  status: TravelRuleStatus,
  notes?: string
): TravelRuleRecord {
  const record = travelRuleRecords.get(recordId);
  if (!record) {
    const err = new Error(`Travel rule record ${recordId} not found`) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  record.status = status;
  record.updatedAt = new Date();

  if (notes) {
    record.complianceNotes.push(notes);
  }

  if (status === TravelRuleStatus.COMPLIANT || status === TravelRuleStatus.NON_COMPLIANT) {
    record.completedAt = new Date();
  }

  travelRuleRecords.set(record.id, record);

  logger.info('Travel rule status updated', { id: recordId, status });

  return record;
}

/**
 * Submits beneficiary information received from the counterparty VASP.
 */
export function submitBeneficiaryInfo(
  recordId: string,
  beneficiaryInfo: BeneficiaryInfo
): TravelRuleRecord {
  const record = travelRuleRecords.get(recordId);
  if (!record) {
    const err = new Error(`Travel rule record ${recordId} not found`) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  record.beneficiaryInfo = beneficiaryInfo;
  record.status = TravelRuleStatus.BENEFICIARY_INFO_RECEIVED;
  record.updatedAt = new Date();
  record.complianceNotes.push('Beneficiary information received from counterparty VASP.');

  travelRuleRecords.set(record.id, record);

  logger.info('Beneficiary info submitted', { id: recordId });

  return record;
}

/**
 * Validates that all required FATF R16 fields are present.
 */
export function checkTravelRuleCompliance(
  recordId: string
): { isCompliant: boolean; missingFields: string[]; warnings: string[] } {
  const record = travelRuleRecords.get(recordId);
  if (!record) {
    const err = new Error(`Travel rule record ${recordId} not found`) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!record.isAboveThreshold) {
    return { isCompliant: true, missingFields: [], warnings: ['Record is below threshold — exempt from Travel Rule.'] };
  }

  // Originator required fields (FATF R16)
  if (!record.originatorInfo.name) missingFields.push('originatorInfo.name');
  if (!record.originatorInfo.accountNumber) missingFields.push('originatorInfo.accountNumber');
  if (!record.originatorInfo.country) missingFields.push('originatorInfo.country');

  // Beneficiary required fields
  if (!record.beneficiaryInfo.name) missingFields.push('beneficiaryInfo.name');
  if (!record.beneficiaryInfo.accountNumber) missingFields.push('beneficiaryInfo.accountNumber');

  // Optional but recommended fields
  if (!record.originatorInfo.address && !record.originatorInfo.dateOfBirth && !record.originatorInfo.nationalId) {
    warnings.push('Originator identity verification data missing (address, date of birth, or national ID recommended).');
  }
  if (!record.originatorInfo.institutionName) {
    warnings.push('Originator institution name not provided.');
  }
  if (!record.beneficiaryInfo.country) {
    warnings.push('Beneficiary country not provided.');
  }

  // Check expiry
  if (record.expiresAt < new Date()) {
    warnings.push('Travel rule compliance window has expired.');
  }

  const isCompliant = missingFields.length === 0;

  if (!isCompliant) {
    eventBus.emit('travel-rule:compliance-check', record);
  }

  return { isCompliant, missingFields, warnings };
}

export function getTravelRuleRecord(id: string): TravelRuleRecord | undefined {
  return travelRuleRecords.get(id);
}

export function getTravelRuleRecords(filters?: {
  status?: TravelRuleStatus;
  transactionId?: string;
  startDate?: Date;
  endDate?: Date;
  isAboveThreshold?: boolean;
}): TravelRuleRecord[] {
  let records = Array.from(travelRuleRecords.values());

  if (filters) {
    if (filters.status !== undefined) {
      records = records.filter((r) => r.status === filters.status);
    }
    if (filters.transactionId !== undefined) {
      records = records.filter((r) => r.transactionId === filters.transactionId);
    }
    if (filters.startDate !== undefined) {
      records = records.filter((r) => r.createdAt >= filters.startDate!);
    }
    if (filters.endDate !== undefined) {
      records = records.filter((r) => r.createdAt <= filters.endDate!);
    }
    if (filters.isAboveThreshold !== undefined) {
      records = records.filter((r) => r.isAboveThreshold === filters.isAboveThreshold);
    }
  }

  return records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Marks all PENDING records past their expiry as EXPIRED.
 * Returns the count of newly expired records.
 */
export function expireStaleRecords(): number {
  const now = new Date();
  let count = 0;

  travelRuleRecords.forEach((record) => {
    if (
      record.status === TravelRuleStatus.PENDING &&
      record.expiresAt < now
    ) {
      record.status = TravelRuleStatus.EXPIRED;
      record.updatedAt = now;
      record.complianceNotes.push('Record expired: 72-hour compliance window exceeded.');
      travelRuleRecords.set(record.id, record);
      count++;
    }
  });

  if (count > 0) {
    logger.info(`Expired ${count} stale travel rule records`);
  }

  return count;
}

export function getTravelRuleStats(): {
  total: number;
  compliant: number;
  nonCompliant: number;
  pending: number;
  exempt: number;
  expired: number;
  complianceRate: number;
} {
  const records = Array.from(travelRuleRecords.values());
  const total = records.length;
  const compliant = records.filter((r) => r.status === TravelRuleStatus.COMPLIANT).length;
  const nonCompliant = records.filter((r) => r.status === TravelRuleStatus.NON_COMPLIANT).length;
  const pending = records.filter((r) => r.status === TravelRuleStatus.PENDING).length;
  const exempt = records.filter((r) => r.status === TravelRuleStatus.EXEMPT).length;
  const expired = records.filter((r) => r.status === TravelRuleStatus.EXPIRED).length;

  const eligible = records.filter((r) => r.isAboveThreshold).length;
  const complianceRate = eligible > 0 ? Math.round((compliant / eligible) * 100) : 100;

  return { total, compliant, nonCompliant, pending, exempt, expired, complianceRate };
}

export function registerVASP(
  info: Omit<VASPInfo, 'id' | 'createdAt' | 'updatedAt'>
): VASPInfo {
  const now = new Date();
  const vasp: VASPInfo = {
    ...info,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };

  vaspRegistry.set(vasp.id, vasp);

  logger.info('VASP registered', { id: vasp.id, name: vasp.name, country: vasp.country });

  return vasp;
}

export function getVASPs(filters?: { country?: string; isVerified?: boolean }): VASPInfo[] {
  let vasps = Array.from(vaspRegistry.values());

  if (filters) {
    if (filters.country !== undefined) {
      vasps = vasps.filter((v) => v.country === filters.country);
    }
    if (filters.isVerified !== undefined) {
      vasps = vasps.filter((v) => v.isVerified === filters.isVerified);
    }
  }

  return vasps;
}

export function getVASPById(id: string): VASPInfo | undefined {
  return vaspRegistry.get(id);
}

// Exported for testing
export { travelRuleRecords as _travelRuleStore, vaspRegistry as _vaspStore };
