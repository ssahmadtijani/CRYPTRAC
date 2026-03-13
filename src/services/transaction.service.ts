import { v4 as uuidv4 } from 'uuid';
import {
  Transaction,
  TransactionType,
  RiskLevel,
  ComplianceStatus,
  TransactionFilter,
} from '../types';
import { CreateTransactionInput } from '../validators/schemas';

/**
 * Transaction Service for CRYPTRAC
 * Handles transaction creation, retrieval, and risk assessment
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Transaction,
  TransactionFilter,
  RiskLevel,
  ComplianceStatus,
  ApiResponse,
} from '../types';
import { CreateTransactionInput } from '../validators/schemas';
import { logger } from '../utils/logger';

// In-memory transaction store (replace with Prisma in production)
const transactions: Map<string, Transaction> = new Map();

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

const HIGH_RISK_AMOUNT_USD = 10000;
const TRAVEL_RULE_THRESHOLD_USD = 1000;

const transactions: Transaction[] = [];

function assessRisk(transaction: Partial<Transaction>): RiskLevel {
  if (
    SANCTIONED_ADDRESSES.has((transaction.fromAddress || '').toLowerCase()) ||
    SANCTIONED_ADDRESSES.has((transaction.toAddress || '').toLowerCase())
  ) {
    return RiskLevel.CRITICAL;
  }

  const amountUSD = transaction.amountUSD ?? 0;

  if (amountUSD >= HIGH_RISK_AMOUNT_USD) {
    return RiskLevel.HIGH;
  }

  if (
    transaction.type === TransactionType.TRANSFER &&
    amountUSD >= 5000
  ) {
    return RiskLevel.HIGH;
  }

  if (amountUSD >= 3000) {
    return RiskLevel.MEDIUM;
  }

  return RiskLevel.LOW;
}

export const transactionService = {
  createTransaction(input: CreateTransactionInput): Transaction {
    const now = new Date();
    const partial: Partial<Transaction> = {
      ...input,
      timestamp: input.timestamp ? new Date(input.timestamp) : now,
    };

    const riskLevel = assessRisk(partial);
    const travelRuleRequired =
      (input.amountUSD >= TRAVEL_RULE_THRESHOLD_USD) || input.travelRuleRequired;

    const complianceStatus =
      riskLevel === RiskLevel.CRITICAL || riskLevel === RiskLevel.HIGH
        ? ComplianceStatus.FLAGGED
        : ComplianceStatus.PENDING;

    const transaction: Transaction = {
      id: uuidv4(),
      userId: input.userId,
      type: input.type,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      amount: input.amount,
      currency: input.currency,
      amountUSD: input.amountUSD,
      fee: input.fee ?? 0,
      feeUSD: input.feeUSD ?? 0,
      txHash: input.txHash,
      blockchain: input.blockchain,
      riskLevel,
      complianceStatus,
      travelRuleRequired,
      metadata: input.metadata,
      timestamp: partial.timestamp as Date,
      createdAt: now,
      updatedAt: now,
    };

    transactions.push(transaction);
    return transaction;
  },

  getTransactions(
    filter: TransactionFilter = {}
  ): { data: Transaction[]; total: number } {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    let filtered = transactions.filter((t) => {
      if (filter.userId && t.userId !== filter.userId) return false;
      if (filter.type && t.type !== filter.type) return false;
      if (filter.riskLevel && t.riskLevel !== filter.riskLevel) return false;
      if (
        filter.complianceStatus &&
        t.complianceStatus !== filter.complianceStatus
      )
        return false;
      if (filter.blockchain && t.blockchain !== filter.blockchain) return false;
      if (filter.fromDate && t.timestamp < filter.fromDate) return false;
      if (filter.toDate && t.timestamp > filter.toDate) return false;
      if (filter.minAmount !== undefined && t.amountUSD < filter.minAmount)
        return false;
      if (filter.maxAmount !== undefined && t.amountUSD > filter.maxAmount)
        return false;
      return true;
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    filtered = filtered.slice(start, start + limit);

    return { data: filtered, total };
  },

  getTransactionById(id: string): Transaction | undefined {
    return transactions.find((t) => t.id === id);
  },

  assessRisk,
};
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
  const now = new Date();

  const transaction: Transaction = {
    id: uuidv4(),
    txHash: data.txHash,
    type: data.type,
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
    riskLevel: RiskLevel.LOW,
    riskScore: 0,
    complianceStatus: ComplianceStatus.PENDING,
    userId,
    metadata: data.metadata,
    createdAt: now,
    updatedAt: now,
  };

  // Perform risk assessment
  const { riskLevel, riskScore } = assessTransactionRisk(transaction);
  transaction.riskLevel = riskLevel;
  transaction.riskScore = riskScore;

  transactions.set(transaction.id, transaction);

  logger.info('Transaction created', {
    transactionId: transaction.id,
    txHash: transaction.txHash,
    riskLevel,
    riskScore,
  });

  return transaction;
}

/**
 * Returns a paginated, filtered list of transactions.
 */
export async function getTransactions(
  filter: TransactionFilter
): Promise<ApiResponse<Transaction[]>> {
  let results = Array.from(transactions.values());

  // Apply filters
  if (filter.userId) {
    results = results.filter((t) => t.userId === filter.userId);
  }
  if (filter.type) {
    results = results.filter((t) => t.type === filter.type);
  }
  if (filter.riskLevel) {
    results = results.filter((t) => t.riskLevel === filter.riskLevel);
  }
  if (filter.complianceStatus) {
    results = results.filter((t) => t.complianceStatus === filter.complianceStatus);
  }
  if (filter.asset) {
    results = results.filter((t) =>
      t.asset.toLowerCase().includes(filter.asset!.toLowerCase())
    );
  }
  if (filter.network) {
    results = results.filter((t) =>
      t.network.toLowerCase() === filter.network!.toLowerCase()
    );
  }
  if (filter.startDate) {
    results = results.filter((t) => t.timestamp >= filter.startDate!);
  }
  if (filter.endDate) {
    results = results.filter((t) => t.timestamp <= filter.endDate!);
  }
  if (filter.minAmountUSD !== undefined) {
    results = results.filter((t) => t.amountUSD >= filter.minAmountUSD!);
  }
  if (filter.maxAmountUSD !== undefined) {
    results = results.filter((t) => t.amountUSD <= filter.maxAmountUSD!);
  }
  if (filter.senderAddress) {
    results = results.filter((t) =>
      t.senderAddress.toLowerCase() === filter.senderAddress!.toLowerCase()
    );
  }
  if (filter.receiverAddress) {
    results = results.filter((t) =>
      t.receiverAddress.toLowerCase() === filter.receiverAddress!.toLowerCase()
    );
  }

  const total = results.length;

  // Sort
  const sortBy = (filter.sortBy as keyof Transaction) ?? 'createdAt';
  const sortOrder = filter.sortOrder ?? 'desc';
  results.sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (aVal === undefined || bVal === undefined) return 0;
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  // Paginate
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const start = (page - 1) * pageSize;
  const paginated = results.slice(start, start + pageSize);

  return {
    success: true,
    data: paginated,
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
  return transactions.get(id) ?? null;
}

/**
 * Performs risk scoring on a transaction.
 * Returns a risk level and numeric score (0–100).
 */
export function assessTransactionRisk(
  transaction: Transaction
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

  // High-risk transaction types
  const highRiskTypes = ['MIXING', 'TUMBLING'];
  if (highRiskTypes.includes(transaction.type)) {
    score += 20;
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
