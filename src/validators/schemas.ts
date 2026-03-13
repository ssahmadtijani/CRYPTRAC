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
/**
 * Zod Validation Schemas for CRYPTRAC
 */

import { z } from 'zod';
import { TransactionType, RiskLevel, ComplianceStatus, UserRole } from '../types';

// ---------------------------------------------------------------------------
// Transaction Schemas
// ---------------------------------------------------------------------------

export const createTransactionSchema = z.object({
  txHash: z
    .string()
    .min(1, 'Transaction hash is required')
    .max(255, 'Transaction hash too long'),
  type: z.nativeEnum(TransactionType),
  senderAddress: z
    .string()
    .min(1, 'Sender address is required')
    .max(255, 'Sender address too long'),
  receiverAddress: z
    .string()
    .min(1, 'Receiver address is required')
    .max(255, 'Receiver address too long'),
  asset: z.string().min(1, 'Asset is required').max(50, 'Asset symbol too long'),
  amount: z.number().positive('Amount must be positive'),
  amountUSD: z.number().nonnegative('USD amount must be non-negative'),
  fee: z.number().nonnegative('Fee must be non-negative').default(0),
  feeUSD: z.number().nonnegative('Fee USD must be non-negative').default(0),
  blockNumber: z.number().int().positive().optional(),
  network: z.string().min(1, 'Network is required').max(50, 'Network name too long'),
  timestamp: z.coerce.date(),
  metadata: z.record(z.unknown()).optional(),
});

export const transactionFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z
    .enum(['timestamp', 'amountUSD', 'riskScore', 'createdAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
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

  asset: z.string().optional(),
  network: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minAmountUSD: z.coerce.number().nonnegative().optional(),
  maxAmountUSD: z.coerce.number().nonnegative().optional(),
  senderAddress: z.string().optional(),
  receiverAddress: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Wallet Schema
// ---------------------------------------------------------------------------

export const walletSchema = z.object({
  address: z
    .string()
    .min(1, 'Wallet address is required')
    .max(255, 'Wallet address too long'),
  network: z
    .string()
    .min(1, 'Network is required')
    .max(50, 'Network name too long'),
  label: z.string().max(100, 'Label too long').optional(),
});

// ---------------------------------------------------------------------------
// Auth Schemas
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    ),
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name too long'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name too long'),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;
export type WalletInput = z.infer<typeof walletSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
