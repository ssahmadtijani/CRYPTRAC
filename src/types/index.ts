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

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  fromAddress: string;
  toAddress: string;
  amount: number;
  currency: string;
  amountUSD: number;
  fee: number;
  feeUSD: number;
  txHash?: string;
  blockchain: string;
  riskLevel: RiskLevel;
  complianceStatus: ComplianceStatus;
  travelRuleRequired: boolean;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Wallet {
  id: string;
  address: string;
  blockchain: string;
  userId?: string;
  label?: string;
  riskScore: number;
  isSanctioned: boolean;
  lastChecked?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceReport {
  id: string;
  type: ReportType;
  transactionId: string;
  status: ComplianceStatus;
  riskLevel: RiskLevel;
  reportData: Record<string, unknown>;
  reviewerId?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxEvent {
  id: string;
  userId: string;
  transactionId: string;
  type: TaxEventType;
  acquiredDate: Date;
  disposedDate?: Date;
  costBasis: number;
  proceeds: number;
  gain: number;
  currency: string;
  quantity: number;
  taxYear: number;
  isLongTerm: boolean;
  createdAt: Date;
}

export interface TravelRuleData {
  id: string;
  transactionId: string;
  originatorName: string;
  originatorAccount: string;
  originatorVASP: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  beneficiaryVASP: string;
  amount: number;
  currency: string;
  compliant: boolean;
  threshold: number;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
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
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface TransactionFilter extends Partial<PaginationParams> {
  userId?: string;
  type?: TransactionType;
  riskLevel?: RiskLevel;
  complianceStatus?: ComplianceStatus;
  blockchain?: string;
  fromDate?: Date;
  toDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface TaxSummary {
  userId: string;
  taxYear: number;
  shortTermGains: number;
  longTermGains: number;
  totalGains: number;
  totalIncome: number;
  miningIncome: number;
  stakingIncome: number;
  airdropIncome: number;
  totalTaxableAmount: number;
  events: TaxEvent[];
}
