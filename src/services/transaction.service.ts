/**
 * Transaction Service for CRYPTRAC
 * Handles transaction creation, retrieval, and risk assessment
 */

import { Prisma } from '@prisma/client';
import {
  Transaction,
  TransactionFilter,
  RiskLevel,
  ComplianceStatus,
  ApiResponse,
  CaseCategory,
} from '../types';
import { CreateTransactionInput } from '../validators/schemas';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { autoCreateCase } from './case.service';

// ---------------------------------------------------------------------------
// Risk scoring thresholds (USD)
// ---------------------------------------------------------------------------
const RISK_THRESHOLDS = {
  LOW: 1_000,
  MEDIUM: 10_000,
  HIGH: 100_000,
};

// Stub sanctioned addresses list (replace with OFAC/UN list in production)
const SANCTIONED_ADDRESSES = new Set([
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  '0x0000000000000000000000000000000000000001',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapPrismaTransaction(t: {
  id: string;
  userId: string;
  type: string;
  txHash: string | null;
  senderAddress: string;
  receiverAddress: string;
  asset: string;
  amount: number;
  amountUSD: number;
  fee: number;
  feeUSD: number;
  blockNumber: number | null;
  network: string;
  riskLevel: string;
  riskScore: number;
  complianceStatus: string;
  metadata: unknown;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}): Transaction {
  return {
    id: t.id,
    userId: t.userId,
    type: t.type as Transaction['type'],
    txHash: t.txHash ?? '',
    senderAddress: t.senderAddress,
    receiverAddress: t.receiverAddress,
    asset: t.asset,
    amount: t.amount,
    amountUSD: t.amountUSD,
    fee: t.fee,
    feeUSD: t.feeUSD,
    blockNumber: t.blockNumber ?? undefined,
    network: t.network,
    riskLevel: t.riskLevel as RiskLevel,
    riskScore: t.riskScore,
    complianceStatus: t.complianceStatus as ComplianceStatus,
    metadata: t.metadata as Record<string, unknown> | undefined,
    timestamp: t.timestamp,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new transaction record and auto-triggers risk assessment.
 */
export async function createTransaction(
  data: CreateTransactionInput,
  userId: string
): Promise<Transaction> {
  // Calculate risk before saving
  const { riskLevel, riskScore } = assessTransactionRisk({
    senderAddress: data.senderAddress,
    receiverAddress: data.receiverAddress,
    amountUSD: data.amountUSD,
    type: data.type as Transaction['type'],
  } as Transaction);

  const created = await prisma.transaction.create({
    data: {
      userId,
      type: data.type,
      txHash: data.txHash,
      senderAddress: data.senderAddress,
      receiverAddress: data.receiverAddress,
      asset: data.asset,
      amount: data.amount,
      amountUSD: data.amountUSD,
      fee: data.fee,
      feeUSD: data.feeUSD,
      blockNumber: data.blockNumber,
      network: data.network,
      timestamp: data.timestamp,
      riskLevel,
      riskScore,
      complianceStatus: ComplianceStatus.PENDING,
      metadata: data.metadata as object | undefined,
    },
  });

  const transaction = mapPrismaTransaction(created);

  logger.info('Transaction created', {
    transactionId: transaction.id,
    txHash: transaction.txHash,
    riskLevel,
    riskScore,
  });

  // Auto-create an investigation case for high-risk transactions
  if (riskScore >= 75 || riskLevel === RiskLevel.CRITICAL || riskLevel === RiskLevel.HIGH) {
    // Check if the risk is specifically due to a sanctioned address
    const senderSanctioned = SANCTIONED_ADDRESSES.has(data.senderAddress.toLowerCase());
    const receiverSanctioned = SANCTIONED_ADDRESSES.has(data.receiverAddress.toLowerCase());
    const isSanctionsHit = senderSanctioned || receiverSanctioned;

    const category = isSanctionsHit
      ? CaseCategory.SANCTIONS_HIT
      : CaseCategory.SUSPICIOUS_TRANSACTION;

    const sanctionsDetail = isSanctionsHit
      ? ` Sanctioned address detected: ${senderSanctioned ? 'sender' : 'receiver'}.`
      : '';

    const reason =
      `Transaction flagged automatically. Risk score: ${riskScore}, Risk level: ${riskLevel}.` +
      `${sanctionsDetail} Amount: $${transaction.amountUSD} USD on ${transaction.network}.`;
    try {
      autoCreateCase(transaction, reason, category);
    } catch (err) {
      logger.error('Failed to auto-create case for high-risk transaction', { error: err });
    }
  }

  return transaction;
}

/**
 * Returns a paginated, filtered list of transactions.
 */
export async function getTransactions(
  filter: TransactionFilter
): Promise<ApiResponse<Transaction[]>> {
  const where: Prisma.TransactionWhereInput = {};

  if (filter.userId) where.userId = filter.userId;
  if (filter.type) where.type = filter.type;
  if (filter.riskLevel) where.riskLevel = filter.riskLevel;
  if (filter.complianceStatus) where.complianceStatus = filter.complianceStatus;
  if (filter.network) where.network = { equals: filter.network, mode: 'insensitive' };
  if (filter.senderAddress)
    where.senderAddress = { equals: filter.senderAddress, mode: 'insensitive' };
  if (filter.receiverAddress)
    where.receiverAddress = { equals: filter.receiverAddress, mode: 'insensitive' };
  if (filter.asset)
    where.asset = { contains: filter.asset, mode: 'insensitive' };
  if (filter.minAmountUSD !== undefined || filter.maxAmountUSD !== undefined) {
    where.amountUSD = {
      ...(filter.minAmountUSD !== undefined ? { gte: filter.minAmountUSD } : {}),
      ...(filter.maxAmountUSD !== undefined ? { lte: filter.maxAmountUSD } : {}),
    };
  }
  if (filter.startDate || filter.endDate) {
    where.timestamp = {
      ...(filter.startDate ? { gte: filter.startDate } : {}),
      ...(filter.endDate ? { lte: filter.endDate } : {}),
    };
  }

  const sortBy = (filter.sortBy ?? 'createdAt') as string;
  const sortOrder = filter.sortOrder ?? 'desc';
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;

  const [total, records] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    success: true,
    data: records.map(mapPrismaTransaction),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Returns a single transaction by ID, or null if not found.
 */
export async function getTransactionById(id: string): Promise<Transaction | null> {
  const found = await prisma.transaction.findUnique({ where: { id } });
  return found ? mapPrismaTransaction(found) : null;
}

/**
 * Performs risk scoring on a transaction.
 * Returns a risk level and numeric score (0-100).
 */
export function assessTransactionRisk(
  transaction: Pick<Transaction, 'amountUSD' | 'senderAddress' | 'receiverAddress' | 'type'>
): { riskLevel: RiskLevel; riskScore: number } {
  let score = 0;

  // Amount-based scoring
  if (transaction.amountUSD >= RISK_THRESHOLDS.HIGH) {
    score += 40;
  } else if (transaction.amountUSD >= RISK_THRESHOLDS.MEDIUM) {
    score += 25;
  } else if (transaction.amountUSD >= RISK_THRESHOLDS.LOW) {
    score += 10;
  }

  // Sanctioned address check
  const senderSanctioned = SANCTIONED_ADDRESSES.has(
    transaction.senderAddress.toLowerCase()
  );
  const receiverSanctioned = SANCTIONED_ADDRESSES.has(
    transaction.receiverAddress.toLowerCase()
  );

  if (senderSanctioned || receiverSanctioned) {
    score += 50;
  }

  // Round-number amounts can indicate structuring
  if (
    transaction.amountUSD > 0 &&
    transaction.amountUSD % 1000 === 0 &&
    transaction.amountUSD >= 5_000
  ) {
    score += 5;
  }

  score = Math.min(score, 100);

  let riskLevel: RiskLevel;
  if (score >= 75) {
    riskLevel = RiskLevel.CRITICAL;
  } else if (score >= 50) {
    riskLevel = RiskLevel.HIGH;
  } else if (score >= 25) {
    riskLevel = RiskLevel.MEDIUM;
  } else {
    riskLevel = RiskLevel.LOW;
  }

  return { riskLevel, riskScore: score };
}
