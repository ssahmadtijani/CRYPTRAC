// Mirror of backend src/types/index.ts

// ---------------------------------------------------------------------------
// Case Management Types
// ---------------------------------------------------------------------------

export enum CaseStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  ESCALATED = 'ESCALATED',
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
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  HIGH_RISK_TRANSACTION = 'HIGH_RISK_TRANSACTION',
  SANCTIONS_HIT = 'SANCTIONS_HIT',
  TRAVEL_RULE_VIOLATION = 'TRAVEL_RULE_VIOLATION',
  UNUSUAL_PATTERN = 'UNUSUAL_PATTERN',
  LARGE_TRANSACTION = 'LARGE_TRANSACTION',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
}

export interface Case {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  category: CaseCategory;
  assignedTo?: string;
  transactionIds: string[];
  walletAddresses: string[];
  riskScore: number;
  findings: Record<string, unknown>;
  resolution?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface CaseNote {
  id: string;
  caseId: string;
  authorId: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface CaseTimelineEntry {
  id: string;
  caseId: string;
  action: string;
  description: string;
  performedBy: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CaseDashboardMetrics {
  totalCases: number;
  openCases: number;
  inProgressCases: number;
  escalatedCases: number;
  resolvedCases: number;
  closedCases: number;
  criticalPriorityCases: number;
  highPriorityCases: number;
  averageResolutionTimeHours: number;
  casesByCategory: Record<string, number>;
}

export interface CreateCaseRequest {
  title: string;
  description: string;
  priority: CasePriority;
  category: CaseCategory;
  transactionIds?: string[];
  walletAddresses?: string[];
  riskScore?: number;
  assignedTo?: string;
}

export interface UpdateCaseRequest {
  title?: string;
  description?: string;
  priority?: CasePriority;
  category?: CaseCategory;
  assignedTo?: string;
  transactionIds?: string[];
  walletAddresses?: string[];
  riskScore?: number;
  resolution?: string;
}

export interface CaseFilterParams {
  status?: CaseStatus;
  priority?: CasePriority;
  category?: CaseCategory;
  assignedTo?: string;
  page?: number;
  pageSize?: number;
}

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

// ---------------------------------------------------------------------------
// Exchange & Tax Types (mirror of backend)
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
  timestamp: string;
}

export interface ExchangeBalance {
  asset: string;
  amount: number;
  valueUSD: number;
}

export interface ExchangeConnection {
  userId: string;
  exchangeName: string;
  connectedAt: string;
  lastSyncedAt?: string;
  status: 'ACTIVE' | 'SYNCING' | 'ERROR';
  transactionCount: number;
}

export enum TaxEventType {
  CAPITAL_GAIN_SHORT = 'CAPITAL_GAIN_SHORT',
  CAPITAL_GAIN_LONG = 'CAPITAL_GAIN_LONG',
  INCOME = 'INCOME',
  MINING_INCOME = 'MINING_INCOME',
  STAKING_REWARD = 'STAKING_REWARD',
  AIRDROP_INCOME = 'AIRDROP_INCOME',
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
  timestamp: string;
  taxRate: number;
  taxAmountUSD: number;
  taxAmountNGN: number;
  isFlagged: boolean;
}

export type AssessmentPeriod = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'ANNUAL';
export type AssessmentStatus = 'DRAFT' | 'CALCULATED' | 'REVIEWED' | 'FILED' | 'PAID';

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
  generatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  filedAt?: string;
}

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
  lastActivity?: string;
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
// Notification & Alert Types (client-side mirror)
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
  readAt?: string;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  enabledTypes: NotificationType[];
  emailNotifications: boolean;
  highPriorityOnly: boolean;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface CreateAlertRuleRequest {
  name: string;
  description: string;
  condition: AlertRuleCondition;
  threshold?: number;
  value?: string;
  notificationType: NotificationType;
  priority: NotificationPriority;
  targetRoles: UserRole[];
  isActive?: boolean;
}

export interface UpdateNotificationPreferencesRequest {
  enabledTypes?: NotificationType[];
  emailNotifications?: boolean;
  highPriorityOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Audit Trail Types
// ---------------------------------------------------------------------------

export enum AuditAction {
  USER_LOGIN = 'USER_LOGIN',
  USER_REGISTER = 'USER_REGISTER',
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_UPDATED = 'TRANSACTION_UPDATED',
  COMPLIANCE_REPORT_FILED = 'COMPLIANCE_REPORT_FILED',
  COMPLIANCE_REPORT_REVIEWED = 'COMPLIANCE_REPORT_REVIEWED',
  CASE_CREATED = 'CASE_CREATED',
  CASE_STATUS_CHANGED = 'CASE_STATUS_CHANGED',
  CASE_ASSIGNED = 'CASE_ASSIGNED',
  CASE_NOTE_ADDED = 'CASE_NOTE_ADDED',
  WALLET_REGISTERED = 'WALLET_REGISTERED',
  WALLET_RISK_UPDATED = 'WALLET_RISK_UPDATED',
  SANCTIONS_CHECK = 'SANCTIONS_CHECK',
  ALERT_RULE_CREATED = 'ALERT_RULE_CREATED',
  ALERT_RULE_UPDATED = 'ALERT_RULE_UPDATED',
  NOTIFICATION_SENT = 'NOTIFICATION_SENT',
  TAX_ASSESSMENT_GENERATED = 'TAX_ASSESSMENT_GENERATED',
  TAX_ASSESSMENT_REVIEWED = 'TAX_ASSESSMENT_REVIEWED',
  EXPORT_GENERATED = 'EXPORT_GENERATED',
  DATA_ACCESSED = 'DATA_ACCESSED',
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface AuditStats {
  total: number;
  byAction: Record<string, number>;
  byEntityType: Record<string, number>;
  byUser: Record<string, number>;
  recentActivity: AuditEntry[];
}

export interface AuditFilterParams {
  userId?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}
