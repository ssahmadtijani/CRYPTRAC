import { z } from 'zod';
import { TransactionType, RiskLevel, ComplianceStatus, UserRole } from '../types';

export const createTransactionSchema = z.object({
  userId: z.string().uuid(),
  type: z.nativeEnum(TransactionType),
  fromAddress: z.string().min(1),
  toAddress: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1).max(20),
  amountUSD: z.number().nonnegative(),
  fee: z.number().nonnegative().default(0),
  feeUSD: z.number().nonnegative().default(0),
  txHash: z.string().optional(),
  blockchain: z.string().min(1),
  travelRuleRequired: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

export const transactionFilterSchema = z.object({
  userId: z.string().uuid().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  riskLevel: z.nativeEnum(RiskLevel).optional(),
  complianceStatus: z.nativeEnum(ComplianceStatus).optional(),
  blockchain: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  minAmount: z.coerce.number().nonnegative().optional(),
  maxAmount: z.coerce.number().nonnegative().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const walletSchema = z.object({
  address: z.string().min(1),
  blockchain: z.string().min(1),
  userId: z.string().uuid().optional(),
  label: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;
export type WalletInput = z.infer<typeof walletSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
