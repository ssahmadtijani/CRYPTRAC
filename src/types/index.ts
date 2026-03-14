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
  TRAVEL_RULE_INITIATED = 'TRAVEL_RULE_INITIATED',
  TRAVEL_RULE_STATUS_UPDATED = 'TRAVEL_RULE_STATUS_UPDATED',
  VASP_REGISTERED = 'VASP_REGISTERED',
  STR_SAR_CREATED = 'STR_SAR_CREATED',
  STR_SAR_SUBMITTED = 'STR_SAR_SUBMITTED',
  STR_SAR_APPROVED = 'STR_SAR_APPROVED',
  STR_SAR_FILED = 'STR_SAR_FILED',
  STR_SAR_AMENDED = 'STR_SAR_AMENDED',
  FILING_CREATED = 'FILING_CREATED',
  FILING_UPDATED = 'FILING_UPDATED',
  FILING_FILED = 'FILING_FILED',
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface AuditFilter {
  userId?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface AuditStats {
  total: number;
  byAction: Record<string, number>;
  byEntityType: Record<string, number>;
  byUser: Record<string, number>;
  recentActivity: AuditEntry[];
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
  detectedAt: Date;
}

export interface RapidMovementPattern {
  walletAddress: string;
  inboundTransaction: Transaction;
  outboundTransaction: Transaction;
  timeDeltaMinutes: number;
  amountUSD: number;
  detectedAt: Date;
}

export interface LayeringPattern {
  chain: Transaction[];
  originAddress: string;
  finalAddress: string;
  hops: number;
  totalVolumeUSD: number;
  detectedAt: Date;
}

export interface RoundTripPattern {
  originAddress: string;
  transactions: Transaction[];
  totalVolumeUSD: number;
  roundTripMinutes: number;
  detectedAt: Date;
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
    detectedAt: Date;
  };
}

export interface PatternHistoryEntry {
  id: string;
  patternType: 'STRUCTURING' | 'RAPID_MOVEMENT' | 'LAYERING' | 'ROUND_TRIPPING';
  walletAddress: string;
  transactionCount: number;
  totalVolumeUSD: number;
  detectedAt: Date;
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
  latestTimestamp: Date;
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
// WebSocket Event Types
// ---------------------------------------------------------------------------

export enum WSEventType {
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_FLAGGED = 'TRANSACTION_FLAGGED',
  COMPLIANCE_ALERT = 'COMPLIANCE_ALERT',
  RISK_LEVEL_CHANGED = 'RISK_LEVEL_CHANGED',
  CASE_CREATED = 'CASE_CREATED',
  CASE_STATUS_CHANGED = 'CASE_STATUS_CHANGED',
  PATTERN_DETECTED = 'PATTERN_DETECTED',
  KPI_UPDATE = 'KPI_UPDATE',
  WALLET_SANCTIONED = 'WALLET_SANCTIONED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  TRAVEL_RULE_UPDATE = 'TRAVEL_RULE_UPDATE',
  STR_SAR_CREATED = 'STR_SAR_CREATED',
  STR_SAR_FILED = 'STR_SAR_FILED',
  FILING_OVERDUE = 'FILING_OVERDUE',
}

export interface WSEvent {
  type: WSEventType;
  payload: unknown;
  timestamp: Date;
  userId?: string;
}

// ---------------------------------------------------------------------------
// Export Job Types
// ---------------------------------------------------------------------------

export interface ExportJob {
  id: string;
  userId: string;
  exportType: string;
  format: 'csv' | 'json' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  filters?: Record<string, unknown>;
  resultUrl?: string;
  fileSize?: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
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
  requestedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
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
  publicKey?: string;
  createdAt: Date;
  updatedAt: Date;
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
  dateRangeStart: Date;
  dateRangeEnd: Date;
  filingInstitution: string;
  filingOfficer: string;
  filingOfficerUserId: string;
  regulatoryAuthority: string;
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  acknowledgedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  amendmentOf?: string;
  amendmentReason?: string;
}

export interface STRSARFilter {
  type?: STRSARType;
  status?: STRSARStatus;
  suspicionCategory?: SuspicionCategory;
  filingOfficerUserId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface STRSARStats {
  totalReports: number;
  byType: Record<STRSARType, number>;
  byStatus: Record<STRSARStatus, number>;
  byCategory: Partial<Record<SuspicionCategory, number>>;
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
  dueDate: Date;
  status: FilingStatus;
  assignedTo?: string;
  filedAt?: Date;
  filingReference?: string;
  linkedReportIds: string[];
  reminderSentAt?: Date;
  notes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FilingCalendarEntry {
  id: string;
  filingType: FilingType;
  title: string;
  dueDate: Date;
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
