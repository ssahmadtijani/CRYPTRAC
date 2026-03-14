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

export interface TransactionFilter {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Exchange Connector Types
// ---------------------------------------------------------------------------

export type ExchangeTransactionType =
  | 'BUY'
  | 'SELL'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'SWAP'
  | 'STAKING_REWARD'
  | 'MINING_REWARD'
  | 'AIRDROP';

export interface ExchangeTransaction {
  exchangeId: string;
  exchangeName: string;
  externalTxId: string;
  type: ExchangeTransactionType;
  asset: string;
  amount: number;
  pricePerUnit: number;
  totalValueUSD: number;
  fee: number;
  feeUSD: number;
  counterAsset?: string;
  counterAmount?: number;
  walletAddress?: string;
  timestamp: Date;
}

export interface ExchangeBalance {
  asset: string;
  amount: number;
  valueUSD: number;
}

export interface ExchangeConnection {
  userId: string;
  exchangeName: string;
  connectedAt: Date;
  lastSyncedAt?: Date;
  status: 'ACTIVE' | 'SYNCING' | 'ERROR';
  transactionCount: number;
}

// ---------------------------------------------------------------------------
// Tax Engine Types
// ---------------------------------------------------------------------------

export interface CostBasisLot {
  asset: string;
  amount: number;
  costPerUnit: number;
  totalCost: number;
  acquiredAt: Date;
  exchange: string;
}

export interface TaxableEvent {
  id: string;
  userId: string;
  type: TaxEventType;
  asset: string;
  amount: number;
  proceedsUSD: number;
  costBasisUSD: number;
  gainLossUSD: number;
  holdingPeriodDays: number;
  isLongTerm: boolean;
  exchange: string;
  sourceTransaction: string;
  timestamp: Date;
  taxRate: number;
  taxAmountUSD: number;
  taxAmountNGN: number;
  isFlagged: boolean;
}

// ---------------------------------------------------------------------------
// Tax Assessment Types
// ---------------------------------------------------------------------------

export interface ExchangeTaxBreakdown {
  exchangeName: string;
  transactionCount: number;
  totalVolumeUSD: number;
  totalGainLossUSD: number;
  totalTaxUSD: number;
  totalTaxNGN: number;
}

export interface WalletTaxBreakdown {
  walletAddress: string;
  network: string;
  transactionCount: number;
  totalVolumeUSD: number;
  totalGainLossUSD: number;
  totalTaxUSD: number;
  totalTaxNGN: number;
}

export type AssessmentPeriod = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'ANNUAL';
export type AssessmentStatus = 'DRAFT' | 'CALCULATED' | 'REVIEWED' | 'FILED' | 'PAID';

export interface TaxAssessment {
  id: string;
  userId: string;
  taxYear: number;
  period: AssessmentPeriod;

  totalTransactions: number;
  totalTaxableEvents: number;

  totalProceedsUSD: number;
  totalCostBasisUSD: number;
  netCapitalGainUSD: number;
  shortTermGainUSD: number;
  longTermGainUSD: number;

  stakingIncomeUSD: number;
  miningIncomeUSD: number;
  airdropIncomeUSD: number;
  totalIncomeUSD: number;

  capitalGainsTaxUSD: number;
  incomeTaxUSD: number;
  totalTaxLiabilityUSD: number;
  totalTaxLiabilityNGN: number;

  exchangeBreakdown: ExchangeTaxBreakdown[];
  walletBreakdown: WalletTaxBreakdown[];

  status: AssessmentStatus;
  generatedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  filedAt?: Date;
}

// ---------------------------------------------------------------------------
// Case Management Types
// ---------------------------------------------------------------------------

export enum CaseStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  ESCALATED = 'ESCALATED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum CasePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum CaseCategory {
  SUSPICIOUS_TRANSACTION = 'SUSPICIOUS_TRANSACTION',
  SANCTIONS_HIT = 'SANCTIONS_HIT',
  HIGH_RISK_WALLET = 'HIGH_RISK_WALLET',
  TRAVEL_RULE_VIOLATION = 'TRAVEL_RULE_VIOLATION',
  STRUCTURING = 'STRUCTURING',
  UNUSUAL_PATTERN = 'UNUSUAL_PATTERN',
  MANUAL_REFERRAL = 'MANUAL_REFERRAL',
}

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  category: CaseCategory;
  status: CaseStatus;
  priority: CasePriority;
  assigneeId?: string;
  createdById: string;
  transactionIds: string[];
  walletAddresses: string[];
  riskLevel: RiskLevel;
  findings?: Record<string, unknown>;
  resolution?: string;
  resolvedById?: string;
  resolvedAt?: Date;
  escalatedTo?: string;
  escalatedAt?: Date;
  dueDate?: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseNote {
  id: string;
  caseId: string;
  authorId: string;
  content: string;
  noteType: 'INVESTIGATION' | 'EVIDENCE' | 'ESCALATION' | 'RESOLUTION' | 'GENERAL';
  attachments?: string[];
  createdAt: Date;
}

export interface CaseTimelineEntry {
  id: string;
  caseId: string;
  action: string;
  performedById: string;
  previousValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface CaseFilter {
  status?: CaseStatus;
  priority?: CasePriority;
  category?: CaseCategory;
  assigneeId?: string;
  riskLevel?: RiskLevel;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CaseDashboardMetrics {
  totalOpen: number;
  totalInvestigating: number;
  totalEscalated: number;
  totalResolved: number;
  totalClosed: number;
  avgResolutionTimeHours: number;
  casesByCategory: Record<string, number>;
  casesByPriority: Record<string, number>;
  overdueCount: number;
  unassignedCount: number;
}

// ---------------------------------------------------------------------------
// Tax Authority Portal Types
// ---------------------------------------------------------------------------

export interface TaxpayerSummary {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  totalTransactions: number;
  totalVolumeUSD: number;
  totalTaxLiabilityUSD: number;
  totalTaxLiabilityNGN: number;
  exchanges: string[];
  latestAssessmentStatus?: AssessmentStatus;
  isFlagged: boolean;
  lastActivity?: Date;
}

export interface TaxAuthorityDashboard {
  totalTaxpayers: number;
  totalTaxLiabilityNGN: number;
  totalTaxLiabilityUSD: number;
  totalTransactionsProcessed: number;
  flaggedAssessments: number;
  taxCollectedNGN: number;
  taxOutstandingNGN: number;
  byExchange: ExchangeTaxBreakdown[];
  byQuarter: { period: string; taxUSD: number; taxNGN: number }[];
  recentHighValueAssessments: TaxAssessment[];
}

// ---------------------------------------------------------------------------
// Notification & Alert Types
// ---------------------------------------------------------------------------

export enum NotificationType {
  CASE_CREATED = 'CASE_CREATED',
  CASE_ASSIGNED = 'CASE_ASSIGNED',
  CASE_ESCALATED = 'CASE_ESCALATED',
  CASE_STATUS_CHANGED = 'CASE_STATUS_CHANGED',
  CASE_NOTE_ADDED = 'CASE_NOTE_ADDED',
  COMPLIANCE_ALERT = 'COMPLIANCE_ALERT',
  HIGH_RISK_TRANSACTION = 'HIGH_RISK_TRANSACTION',
  SANCTIONS_HIT = 'SANCTIONS_HIT',
  THRESHOLD_EXCEEDED = 'THRESHOLD_EXCEEDED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertRuleCondition {
  TRANSACTION_AMOUNT_EXCEEDS = 'TRANSACTION_AMOUNT_EXCEEDS',
  RISK_LEVEL_IS = 'RISK_LEVEL_IS',
  COMPLIANCE_STATUS_IS = 'COMPLIANCE_STATUS_IS',
  SANCTIONS_HIT = 'SANCTIONS_HIT',
  CASE_ESCALATED = 'CASE_ESCALATED',
  CASE_UNASSIGNED_DURATION = 'CASE_UNASSIGNED_DURATION',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: 'CASE' | 'TRANSACTION' | 'COMPLIANCE_REPORT' | 'WALLET';
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  enabledTypes: NotificationType[];
  emailNotifications: boolean;
  highPriorityOnly: boolean;
  updatedAt: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertRuleCondition;
  threshold?: number;
  value?: string;
  notificationType: NotificationType;
  priority: NotificationPriority;
  targetRoles: UserRole[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationFilter {
  userId?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  isRead?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}
