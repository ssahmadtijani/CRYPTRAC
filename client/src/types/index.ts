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

// ---------------------------------------------------------------------------
// Analytics Types
// ---------------------------------------------------------------------------

export interface AnalyticsKPIs {
  totalTransactions: number;
  totalTransactionsLast24h: number;
  totalTransactionsLast7d: number;
  totalVolumeUSD: number;
  volumeLast24h: number;
  volumeLast7d: number;
  activeWallets: number;
  flaggedWallets: number;
  sanctionedWallets: number;
  openCases: number;
  criticalCases: number;
  complianceRate: number;
  averageRiskScore: number;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
  volumeUSD: number;
  flaggedCount: number;
}

export interface RiskDistributionItem {
  level: RiskLevel;
  count: number;
  percentage: number;
}

export interface AssetBreakdownItem {
  asset: string;
  count: number;
  volumeUSD: number;
  percentage: number;
}

export interface NetworkBreakdownItem {
  network: string;
  count: number;
  volumeUSD: number;
}

export interface TopWalletItem {
  address: string;
  network: string;
  riskScore: number;
  riskLevel: RiskLevel;
  transactionCount: number;
  totalVolumeUSD: number;
  isSanctioned: boolean;
}

export interface ComplianceOverviewItem {
  status: ComplianceStatus;
  count: number;
  percentage: number;
}

export interface GeographicBreakdownItem {
  region: string;
  count: number;
  volumeUSD: number;
}

// ---------------------------------------------------------------------------
// Pattern Detection Types
// ---------------------------------------------------------------------------

export interface StructuringPattern {
  walletAddress: string;
  transactions: Transaction[];
  totalAmount: number;
  timeWindowHours: number;
  detectedAt: string;
}

export interface RapidMovementPattern {
  walletAddress: string;
  inboundTransaction: Transaction;
  outboundTransaction: Transaction;
  timeDeltaMinutes: number;
  amountUSD: number;
  detectedAt: string;
}

export interface LayeringPattern {
  chain: Transaction[];
  originAddress: string;
  finalAddress: string;
  hops: number;
  totalVolumeUSD: number;
  detectedAt: string;
}

export interface RoundTripPattern {
  originAddress: string;
  transactions: Transaction[];
  totalVolumeUSD: number;
  roundTripMinutes: number;
  detectedAt: string;
}

export interface PatternDetectionResult {
  structuring: StructuringPattern[];
  rapidMovement: RapidMovementPattern[];
  layering: LayeringPattern[];
  roundTripping: RoundTripPattern[];
  summary: {
    totalPatterns: number;
    structuringCount: number;
    rapidMovementCount: number;
    layeringCount: number;
    roundTrippingCount: number;
    detectedAt: string;
  };
}

export interface PatternHistoryEntry {
  id: string;
  patternType: 'STRUCTURING' | 'RAPID_MOVEMENT' | 'LAYERING' | 'ROUND_TRIPPING';
  walletAddress: string;
  transactionCount: number;
  totalVolumeUSD: number;
  detectedAt: string;
}

// ---------------------------------------------------------------------------
// Network Analysis Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  label?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  isSanctioned: boolean;
  transactionCount: number;
  totalVolumeUSD: number;
  type: 'sender' | 'receiver' | 'both';
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  transactionCount: number;
  assets: string[];
  latestTimestamp: string;
}

export interface TransactionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    densityScore: number;
    highRiskNodes: number;
    clusters: number;
  };
}

export interface WalletCluster {
  clusterId: string;
  addresses: string[];
  totalVolume: number;
  riskLevel: RiskLevel;
  transactionCount: number;
}

export interface RiskPath {
  path: string[];
  edges: GraphEdge[];
  totalVolumeUSD: number;
  maxRiskLevel: RiskLevel;
  containsSanctioned: boolean;
}

// ---------------------------------------------------------------------------
// Travel Rule Types (FATF Recommendation 16)
// ---------------------------------------------------------------------------

export enum TravelRuleStatus {
  PENDING = 'PENDING',
  ORIGINATOR_INFO_COLLECTED = 'ORIGINATOR_INFO_COLLECTED',
  BENEFICIARY_INFO_REQUESTED = 'BENEFICIARY_INFO_REQUESTED',
  BENEFICIARY_INFO_RECEIVED = 'BENEFICIARY_INFO_RECEIVED',
  COMPLIANT = 'COMPLIANT',
  NON_COMPLIANT = 'NON_COMPLIANT',
  EXEMPT = 'EXEMPT',
  EXPIRED = 'EXPIRED',
}

export interface OriginatorInfo {
  name: string;
  accountNumber: string;
  institutionName?: string;
  institutionId?: string;
  address?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationalId?: string;
  country: string;
}

export interface BeneficiaryInfo {
  name: string;
  accountNumber: string;
  institutionName?: string;
  institutionId?: string;
  country?: string;
}

export interface TravelRuleRecord {
  id: string;
  transactionId: string;
  originatorInfo: OriginatorInfo;
  beneficiaryInfo: BeneficiaryInfo;
  amount: number;
  amountUSD: number;
  asset: string;
  network: string;
  status: TravelRuleStatus;
  thresholdApplied: number;
  isAboveThreshold: boolean;
  vaspOriginatorId?: string;
  vaspBeneficiaryId?: string;
  complianceNotes: string[];
  requestedAt: string;
  completedAt?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface VASPInfo {
  id: string;
  name: string;
  leiCode?: string;
  registrationNumber: string;
  country: string;
  regulatoryAuthority: string;
  isVerified: boolean;
  supportedNetworks: string[];
  apiEndpoint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravelRuleStats {
  total: number;
  compliant: number;
  nonCompliant: number;
  pending: number;
  exempt: number;
  expired: number;
  complianceRate: number;
}

// ---------------------------------------------------------------------------
// STR/SAR Report Types
// ---------------------------------------------------------------------------

export enum STRSARStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  FILED = 'FILED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  REJECTED = 'REJECTED',
  AMENDED = 'AMENDED',
}

export enum STRSARType {
  STR = 'STR',
  SAR = 'SAR',
  CTR = 'CTR',
}

export enum SuspicionCategory {
  MONEY_LAUNDERING = 'MONEY_LAUNDERING',
  TERRORIST_FINANCING = 'TERRORIST_FINANCING',
  FRAUD = 'FRAUD',
  TAX_EVASION = 'TAX_EVASION',
  SANCTIONS_VIOLATION = 'SANCTIONS_VIOLATION',
  STRUCTURING = 'STRUCTURING',
  LAYERING = 'LAYERING',
  UNUSUAL_PATTERN = 'UNUSUAL_PATTERN',
  DARKNET_ACTIVITY = 'DARKNET_ACTIVITY',
  RANSOMWARE = 'RANSOMWARE',
  OTHER = 'OTHER',
}

export interface STRSARReport {
  id: string;
  reportNumber: string;
  type: STRSARType;
  status: STRSARStatus;
  subjectName: string;
  subjectWalletAddresses: string[];
  subjectIdentification?: string;
  subjectCountry?: string;
  suspicionCategories: SuspicionCategory[];
  narrativeSummary: string;
  indicatorsOfSuspicion: string[];
  linkedTransactionIds: string[];
  linkedCaseIds: string[];
  linkedWalletAddresses: string[];
  totalAmountUSD: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  filingInstitution: string;
  filingOfficer: string;
  filingOfficerUserId: string;
  regulatoryAuthority: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  acknowledgedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  amendmentOf?: string;
  amendmentReason?: string;
}

export interface STRSARStats {
  totalReports: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  averageProcessingDays: number;
  filedThisMonth: number;
  filedThisYear: number;
  pendingReview: number;
}

// ---------------------------------------------------------------------------
// Regulatory Filing Types
// ---------------------------------------------------------------------------

export enum FilingType {
  STR_SAR = 'STR_SAR',
  CTR = 'CTR',
  TRAVEL_RULE = 'TRAVEL_RULE',
  PERIODIC_REPORT = 'PERIODIC_REPORT',
  TAX_REPORT = 'TAX_REPORT',
  SANCTIONS_REPORT = 'SANCTIONS_REPORT',
}

export enum FilingStatus {
  UPCOMING = 'UPCOMING',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
  FILED = 'FILED',
  CANCELLED = 'CANCELLED',
}

export interface RegulatoryFiling {
  id: string;
  filingType: FilingType;
  title: string;
  description: string;
  regulatoryAuthority: string;
  dueDate: string;
  status: FilingStatus;
  assignedTo?: string;
  filedAt?: string;
  filingReference?: string;
  linkedReportIds: string[];
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FilingCalendarEntry {
  id: string;
  filingType: FilingType;
  title: string;
  dueDate: string;
  status: FilingStatus;
  daysUntilDue: number;
  assignedTo?: string;
}

export interface FilingDashboardMetrics {
  totalFilings: number;
  upcoming: number;
  dueSoon: number;
  overdue: number;
  filed: number;
  complianceScore: number;
  nextDeadline?: FilingCalendarEntry;
  overdueFilings: FilingCalendarEntry[];
}

// ---------------------------------------------------------------------------
// Phase 3D — User Administration Types
// ---------------------------------------------------------------------------

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  LOCKED = 'LOCKED',
  PENDING = 'PENDING',
  DEACTIVATED = 'DEACTIVATED',
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  phone?: string;
  lastLogin?: string;
  failedLoginCount: number;
  lockedUntil?: string;
  suspendedAt?: string;
  suspendedReason?: string;
  deactivatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  description: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface UserAdminStats {
  total: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
  activeToday: number;
  newThisMonth: number;
  lockedAccounts: number;
}

// ---------------------------------------------------------------------------
// Phase 3D — Permission Types
// ---------------------------------------------------------------------------

export enum Permission {
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  VIEW_TRANSACTIONS = 'VIEW_TRANSACTIONS',
  CREATE_TRANSACTION = 'CREATE_TRANSACTION',
  VIEW_WALLETS = 'VIEW_WALLETS',
  MANAGE_WALLETS = 'MANAGE_WALLETS',
  VIEW_COMPLIANCE = 'VIEW_COMPLIANCE',
  MANAGE_COMPLIANCE = 'MANAGE_COMPLIANCE',
  VIEW_CASES = 'VIEW_CASES',
  CREATE_CASES = 'CREATE_CASES',
  MANAGE_CASES = 'MANAGE_CASES',
  VIEW_RISK = 'VIEW_RISK',
  MANAGE_RISK = 'MANAGE_RISK',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  EXPORT_DATA = 'EXPORT_DATA',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',
  VIEW_ALERTS = 'VIEW_ALERTS',
  MANAGE_ALERT_RULES = 'MANAGE_ALERT_RULES',
  VIEW_STR_SAR = 'VIEW_STR_SAR',
  CREATE_STR_SAR = 'CREATE_STR_SAR',
  APPROVE_STR_SAR = 'APPROVE_STR_SAR',
  FILE_STR_SAR = 'FILE_STR_SAR',
  VIEW_TRAVEL_RULE = 'VIEW_TRAVEL_RULE',
  MANAGE_TRAVEL_RULE = 'MANAGE_TRAVEL_RULE',
  VIEW_FILINGS = 'VIEW_FILINGS',
  MANAGE_FILINGS = 'MANAGE_FILINGS',
  VIEW_TAX = 'VIEW_TAX',
  MANAGE_TAX = 'MANAGE_TAX',
  VIEW_USERS = 'VIEW_USERS',
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_ROLES = 'MANAGE_ROLES',
  MANAGE_SYSTEM = 'MANAGE_SYSTEM',
  VIEW_SYSTEM_HEALTH = 'VIEW_SYSTEM_HEALTH',
}

export interface UserPermissionOverride {
  userId: string;
  granted: Permission[];
  revoked: Permission[];
  updatedAt: string;
  updatedBy: string;
}

// ---------------------------------------------------------------------------
// Phase 3D — Enhanced Audit Types
// ---------------------------------------------------------------------------

export type AuditSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata: Record<string, unknown>;
  severity: AuditSeverity;
}

export interface AuditDashboardMetrics {
  totalLogs: number;
  todayLogs: number;
  criticalEvents: number;
  uniqueUsers: number;
  topActions: { action: string; count: number }[];
  activityByHour: { hour: number; count: number }[];
  activityByDay: { date: string; count: number }[];
}

export interface AuditComplianceReport {
  id: string;
  generatedAt: string;
  generatedBy: string;
  startDate: string;
  endDate: string;
  totalEvents: number;
  criticalEvents: number;
  userSummary: { userId: string; email: string; eventCount: number }[];
  actionSummary: { action: string; count: number }[];
  securityEvents: AuditLogEntry[];
}
