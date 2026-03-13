/**
 * Core Type Definitions for CRYPTRAC
 * Crypto Transaction Reporting and Compliance System (NCTMTCS)
 * Aligned with FATF Recommendation 16 (Travel Rule) and AML/CFT Standards
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum TransactionType {
  TRANSFER = 'TRANSFER',
  TRADE = 'TRADE',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  SWAP = 'SWAP',
  STAKING = 'STAKING',
  MINING = 'MINING',
  AIRDROP = 'AIRDROP',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ComplianceStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  FLAGGED = 'FLAGGED',
  REJECTED = 'REJECTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
}

export enum ReportType {
  SAR = 'SAR',
  CTR = 'CTR',
  TRAVEL_RULE = 'TRAVEL_RULE',
  TAX_SUMMARY = 'TAX_SUMMARY',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  COMPLIANCE_OFFICER = 'COMPLIANCE_OFFICER',
  ANALYST = 'ANALYST',
  AUDITOR = 'AUDITOR',
  USER = 'USER',
}

export enum TaxEventType {
  CAPITAL_GAIN_SHORT = 'CAPITAL_GAIN_SHORT',
  CAPITAL_GAIN_LONG = 'CAPITAL_GAIN_LONG',
  INCOME = 'INCOME',
  MINING_INCOME = 'MINING_INCOME',
  STAKING_REWARD = 'STAKING_REWARD',
  AIRDROP_INCOME = 'AIRDROP_INCOME',
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string;
  txHash: string;
  type: TransactionType;
  senderAddress: string;
  receiverAddress: string;
  asset: string;
  amount: number;
  amountUSD: number;
  fee: number;
  feeUSD: number;
  blockNumber?: number;
  network: string;
  timestamp: Date;
  riskLevel: RiskLevel;
  riskScore: number;
  complianceStatus: ComplianceStatus;
  userId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Wallet {
  id: string;
  address: string;
  network: string;
  label?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  isSanctioned: boolean;
  sanctionDetails?: string;
  userId: string;
  firstSeen: Date;
  lastSeen: Date;
  transactionCount: number;
  totalVolumeUSD: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceReport {
  id: string;
  reportType: ReportType;
  transactionId: string;
  status: ComplianceStatus;
  filedBy?: string;
  filedAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  narrative: string;
  findings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxEvent {
  id: string;
  userId: string;
  transactionId: string;
  eventType: TaxEventType;
  asset: string;
  amount: number;
  costBasis: number;
  proceeds: number;
  gainLoss: number;
  holdingPeriodDays: number;
  taxYear: number;
  taxableAmount: number;
  taxRate: number;
  taxOwed: number;
  createdAt: Date;
}

export interface TravelRuleData {
  id: string;
  transactionId: string;
  originatorName: string;
  originatorAddress: string;
  originatorVASP: string;
  originatorVASPId: string;
  beneficiaryName: string;
  beneficiaryAddress: string;
  beneficiaryVASP: string;
  beneficiaryVASPId: string;
  transferAmount: number;
  transferAsset: string;
  transferAmountUSD: number;
  isCompliant: boolean;
  complianceNotes?: string;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionFilter extends PaginationParams {
  userId?: string;
  type?: TransactionType;
  riskLevel?: RiskLevel;
  complianceStatus?: ComplianceStatus;
  asset?: string;
  network?: string;
  startDate?: Date;
  endDate?: Date;
  minAmountUSD?: number;
  maxAmountUSD?: number;
  senderAddress?: string;
  receiverAddress?: string;
}

export interface TaxSummary {
  userId: string;
  taxYear: number;
  totalShortTermGains: number;
  totalLongTermGains: number;
  totalIncome: number;
  totalMiningIncome: number;
  totalStakingRewards: number;
  totalAirdropIncome: number;
  totalTaxableIncome: number;
  estimatedTaxOwed: number;
  events: TaxEvent[];
  generatedAt: Date;
}
