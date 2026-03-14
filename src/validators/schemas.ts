/**
 * Zod Validation Schemas for CRYPTRAC
 */

import { z } from 'zod';
import {
  TransactionType,
  RiskLevel,
  ComplianceStatus,
  UserRole,
  CaseStatus,
  CasePriority,
  CaseCategory,
  AuditAction,
  UserStatus,
  Permission,
} from '../types';

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

// ---------------------------------------------------------------------------
// Case Management Schemas
// ---------------------------------------------------------------------------

export const createCaseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  category: z.nativeEnum(CaseCategory),
  priority: z.nativeEnum(CasePriority).optional(),
  transactionIds: z.array(z.string().uuid()).optional().default([]),
  walletAddresses: z.array(z.string()).optional().default([]),
  riskLevel: z.nativeEnum(RiskLevel).optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).optional().default([]),
});

export const updateCaseStatusSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  resolution: z.string().min(10).max(5000).optional(),
});

export const assignCaseSchema = z.object({
  assigneeId: z.string().uuid('Valid user ID required'),
});

export const addCaseNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(10000),
  noteType: z
    .enum(['INVESTIGATION', 'EVIDENCE', 'ESCALATION', 'RESOLUTION', 'GENERAL'])
    .optional()
    .default('GENERAL'),
  attachments: z.array(z.string()).optional().default([]),
});

export const linkTransactionSchema = z.object({
  transactionId: z.string().uuid('Valid transaction ID required'),
});

export const linkWalletSchema = z.object({
  walletAddress: z.string().min(1, 'Wallet address is required'),
});

export const updateCasePrioritySchema = z.object({
  priority: z.nativeEnum(CasePriority),
});

export const caseFilterSchema = z.object({
  status: z.nativeEnum(CaseStatus).optional(),
  priority: z.nativeEnum(CasePriority).optional(),
  category: z.nativeEnum(CaseCategory).optional(),
  assigneeId: z.string().uuid().optional(),
  riskLevel: z.nativeEnum(RiskLevel).optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type CaseFilterInput = z.infer<typeof caseFilterSchema>;

// ---------------------------------------------------------------------------
// Notification & Alert Schemas
// ---------------------------------------------------------------------------

import {
  NotificationType,
  NotificationPriority,
  AlertRuleCondition,
} from '../types';

export const createAlertRuleSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
  condition: z.nativeEnum(AlertRuleCondition),
  threshold: z.number().nonnegative().optional(),
  value: z.string().max(200).optional(),
  notificationType: z.nativeEnum(NotificationType),
  priority: z.nativeEnum(NotificationPriority),
  targetRoles: z.array(z.nativeEnum(UserRole)).min(1, 'At least one target role required'),
  isActive: z.boolean().default(true),
});

export const updateAlertRuleSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  description: z.string().min(10).max(1000).optional(),
  condition: z.nativeEnum(AlertRuleCondition).optional(),
  threshold: z.number().nonnegative().optional(),
  value: z.string().max(200).optional(),
  notificationType: z.nativeEnum(NotificationType).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  targetRoles: z.array(z.nativeEnum(UserRole)).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const notificationPreferencesSchema = z.object({
  enabledTypes: z.array(z.nativeEnum(NotificationType)).optional(),
  emailNotifications: z.boolean().optional(),
  highPriorityOnly: z.boolean().optional(),
});

export const notificationFilterSchema = z.object({
  type: z.nativeEnum(NotificationType).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  isRead: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;
export type UpdateAlertRuleInput = z.infer<typeof updateAlertRuleSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;

// ---------------------------------------------------------------------------
// Audit Schemas
// ---------------------------------------------------------------------------

export const auditFilterSchema = z.object({
  userId: z.string().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type AuditFilterInput = z.infer<typeof auditFilterSchema>;

// ---------------------------------------------------------------------------
// Export Schemas
// ---------------------------------------------------------------------------

export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'json', 'pdf']).default('json'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  userId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Phase 3D — User Admin Schemas
// ---------------------------------------------------------------------------

export const createUserAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.nativeEnum(UserRole),
  department: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
});

export const updateUserProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  department: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
});

export const changeUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const suspendUserSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

export const lockUserSchema = z.object({
  durationMs: z.number().int().positive().optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const userFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  department: z.string().optional(),
  search: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Phase 3D — Role-Permission Schemas
// ---------------------------------------------------------------------------

export const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.nativeEnum(Permission)),
});

export const grantRevokePermissionSchema = z.object({
  permission: z.nativeEnum(Permission),
});

// ---------------------------------------------------------------------------
// Phase 3D — Enhanced Audit Schemas
// ---------------------------------------------------------------------------

export const auditEnhancedFilterSchema = z.object({
  userId: z.string().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.string().optional(),
  severity: z.enum(['CRITICAL', 'WARNING', 'INFO']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['timestamp', 'action', 'severity']).default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateUserAdminInput = z.infer<typeof createUserAdminSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type AuditEnhancedFilterInput = z.infer<typeof auditEnhancedFilterSchema>;
