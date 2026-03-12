import { v4 as uuidv4 } from 'uuid';
import {
  Transaction,
  TransactionType,
  RiskLevel,
  ComplianceStatus,
  TransactionFilter,
} from '../types';
import { CreateTransactionInput } from '../validators/schemas';

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
