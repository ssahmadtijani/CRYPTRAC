// Mirror of backend src/types/index.ts

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
  timestamp: string;
  riskLevel: RiskLevel;
  riskScore: number;
  complianceStatus: ComplianceStatus;
  userId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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
  firstSeen: string;
  lastSeen: string;
  transactionCount: number;
  totalVolumeUSD: number;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceReport {
  id: string;
  reportType: ReportType;
  transactionId: string;
  status: ComplianceStatus;
  filedBy?: string;
  filedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  narrative: string;
  findings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
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

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CreateTransactionRequest {
  txHash: string;
  type: TransactionType;
  senderAddress: string;
  receiverAddress: string;
  asset: string;
  amount: number;
  amountUSD: number;
  fee: number;
  feeUSD: number;
  network: string;
  timestamp: string;
  blockNumber?: number;
  metadata?: Record<string, unknown>;
}

export interface RegisterWalletRequest {
  address: string;
  network: string;
  label?: string;
}
