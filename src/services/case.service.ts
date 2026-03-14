/**
 * Case Management Service for CRYPTRAC
 * Handles investigation workflows, case lifecycle, and compliance escalation
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Case,
  CaseNote,
  CaseTimelineEntry,
  CaseFilter,
  CaseDashboardMetrics,
  CaseStatus,
  CasePriority,
  CaseCategory,
  RiskLevel,
  Transaction,
} from '../types';
import { CreateCaseInput } from '../validators/schemas';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const cases = new Map<string, Case>();
const caseNotes = new Map<string, CaseNote>();
const caseTimeline = new Map<string, CaseTimelineEntry>();

// Sequential counter for case number generation
let caseCounter = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateCaseNumber(): string {
  caseCounter += 1;
  const year = new Date().getFullYear();
  const seq = String(caseCounter).padStart(5, '0');
  return `CASE-${year}-${seq}`;
}

function priorityFromRiskLevel(riskLevel: RiskLevel): CasePriority {
  switch (riskLevel) {
    case RiskLevel.CRITICAL:
      return CasePriority.CRITICAL;
    case RiskLevel.HIGH:
      return CasePriority.HIGH;
    case RiskLevel.MEDIUM:
      return CasePriority.MEDIUM;
    default:
      return CasePriority.LOW;
  }
}

function recordTimeline(
  caseId: string,
  action: string,
  performedById: string,
  options: {
    previousValue?: string;
    newValue?: string;
    metadata?: Record<string, unknown>;
  } = {}
): CaseTimelineEntry {
  const entry: CaseTimelineEntry = {
    id: uuidv4(),
    caseId,
    action,
    performedById,
    previousValue: options.previousValue,
    newValue: options.newValue,
    metadata: options.metadata,
    timestamp: new Date(),
  };
  caseTimeline.set(entry.id, entry);
  return entry;
}

function getNotesForCase(caseId: string): CaseNote[] {
  return Array.from(caseNotes.values()).filter((n) => n.caseId === caseId);
}

function getTimelineForCase(caseId: string): CaseTimelineEntry[] {
  return Array.from(caseTimeline.values())
    .filter((e) => e.caseId === caseId)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new investigation case.
 */
export function createCase(data: CreateCaseInput, createdById: string): Case {
  const riskLevel = data.riskLevel ?? RiskLevel.MEDIUM;
  const priority = data.priority ?? priorityFromRiskLevel(riskLevel);

  const newCase: Case = {
    id: uuidv4(),
    caseNumber: generateCaseNumber(),
    title: data.title,
    description: data.description,
    category: data.category,
    status: CaseStatus.OPEN,
    priority,
    createdById,
    transactionIds: data.transactionIds ?? [],
    walletAddresses: data.walletAddresses ?? [],
    riskLevel,
    tags: data.tags ?? [],
    dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  cases.set(newCase.id, newCase);

  recordTimeline(newCase.id, 'CASE_CREATED', createdById, {
    newValue: newCase.caseNumber,
    metadata: { category: newCase.category, priority: newCase.priority },
  });

  logger.info('Case created', {
    caseId: newCase.id,
    caseNumber: newCase.caseNumber,
    category: newCase.category,
    priority: newCase.priority,
  });

  return newCase;
}

/**
 * Returns a case with its notes and timeline, or null if not found.
 */
export function getCaseById(id: string): (Case & { notes: CaseNote[]; timeline: CaseTimelineEntry[] }) | null {
  const found = cases.get(id);
  if (!found) return null;
  return {
    ...found,
    notes: getNotesForCase(id),
    timeline: getTimelineForCase(id),
  };
}

/**
 * Returns a paginated, filterable list of cases.
 */
export function getCases(filter: CaseFilter): {
  data: Case[];
  total: number;
  page: number;
  pageSize: number;
} {
  let results = Array.from(cases.values());

  if (filter.status) results = results.filter((c) => c.status === filter.status);
  if (filter.priority) results = results.filter((c) => c.priority === filter.priority);
  if (filter.category) results = results.filter((c) => c.category === filter.category);
  if (filter.assigneeId) results = results.filter((c) => c.assigneeId === filter.assigneeId);
  if (filter.riskLevel) results = results.filter((c) => c.riskLevel === filter.riskLevel);

  if (filter.startDate) {
    const start = new Date(filter.startDate);
    results = results.filter((c) => c.createdAt >= start);
  }
  if (filter.endDate) {
    const end = new Date(filter.endDate);
    results = results.filter((c) => c.createdAt <= end);
  }

  if (filter.search) {
    const search = filter.search.toLowerCase();
    results = results.filter(
      (c) =>
        c.title.toLowerCase().includes(search) ||
        c.description.toLowerCase().includes(search) ||
        c.caseNumber.toLowerCase().includes(search)
    );
  }

  // Sort newest first
  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const total = results.length;
  const data = results.slice((page - 1) * pageSize, page * pageSize);

  return { data, total, page, pageSize };
}

/**
 * Updates the status of a case and records a timeline entry.
 */
export function updateCaseStatus(
  caseId: string,
  newStatus: CaseStatus,
  performedById: string,
  resolution?: string
): Case {
  const existing = cases.get(caseId);
  if (!existing) {
    throw new Error(`Case not found: ${caseId}`);
  }

  if (newStatus === CaseStatus.RESOLVED && !resolution) {
    throw new Error('Resolution text is required when resolving a case');
  }

  const previousStatus = existing.status;
  const now = new Date();

  const updated: Case = {
    ...existing,
    status: newStatus,
    updatedAt: now,
    ...(newStatus === CaseStatus.RESOLVED && {
      resolution,
      resolvedById: performedById,
      resolvedAt: now,
    }),
    ...(newStatus === CaseStatus.ESCALATED && {
      escalatedAt: now,
    }),
  };

  cases.set(caseId, updated);

  recordTimeline(caseId, 'STATUS_CHANGED', performedById, {
    previousValue: previousStatus,
    newValue: newStatus,
    metadata: resolution ? { resolution } : undefined,
  });

  logger.info('Case status updated', { caseId, previousStatus, newStatus });

  return updated;
}

/**
 * Assigns a case to a compliance officer.
 */
export function assignCase(caseId: string, assigneeId: string, performedById: string): Case {
  const existing = cases.get(caseId);
  if (!existing) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const previousAssignee = existing.assigneeId;
  const updated: Case = {
    ...existing,
    assigneeId,
    updatedAt: new Date(),
  };

  cases.set(caseId, updated);

  recordTimeline(caseId, 'ASSIGNED', performedById, {
    previousValue: previousAssignee,
    newValue: assigneeId,
  });

  logger.info('Case assigned', { caseId, assigneeId });

  return updated;
}

/**
 * Adds an investigation note to a case.
 */
export function addCaseNote(
  caseId: string,
  authorId: string,
  content: string,
  noteType: CaseNote['noteType'],
  attachments?: string[]
): CaseNote {
  if (!cases.has(caseId)) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const note: CaseNote = {
    id: uuidv4(),
    caseId,
    authorId,
    content,
    noteType,
    attachments: attachments ?? [],
    createdAt: new Date(),
  };

  caseNotes.set(note.id, note);

  // Update case updatedAt
  const existing = cases.get(caseId)!;
  cases.set(caseId, { ...existing, updatedAt: new Date() });

  recordTimeline(caseId, 'NOTE_ADDED', authorId, {
    newValue: note.id,
    metadata: { noteType },
  });

  return note;
}

/**
 * Links a transaction ID to an existing case.
 */
export function linkTransaction(caseId: string, transactionId: string, performedById: string): Case {
  const existing = cases.get(caseId);
  if (!existing) {
    throw new Error(`Case not found: ${caseId}`);
  }

  if (existing.transactionIds.includes(transactionId)) {
    return existing;
  }

  const updated: Case = {
    ...existing,
    transactionIds: [...existing.transactionIds, transactionId],
    updatedAt: new Date(),
  };

  cases.set(caseId, updated);

  recordTimeline(caseId, 'TRANSACTION_LINKED', performedById, {
    newValue: transactionId,
  });

  return updated;
}

/**
 * Links a wallet address to an existing case.
 */
export function linkWallet(caseId: string, walletAddress: string, performedById: string): Case {
  const existing = cases.get(caseId);
  if (!existing) {
    throw new Error(`Case not found: ${caseId}`);
  }

  if (existing.walletAddresses.includes(walletAddress)) {
    return existing;
  }

  const updated: Case = {
    ...existing,
    walletAddresses: [...existing.walletAddresses, walletAddress],
    updatedAt: new Date(),
  };

  cases.set(caseId, updated);

  recordTimeline(caseId, 'WALLET_LINKED', performedById, {
    newValue: walletAddress,
  });

  return updated;
}

/**
 * Updates the priority of a case.
 */
export function updateCasePriority(
  caseId: string,
  priority: CasePriority,
  performedById: string
): Case {
  const existing = cases.get(caseId);
  if (!existing) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const previousPriority = existing.priority;
  const updated: Case = {
    ...existing,
    priority,
    updatedAt: new Date(),
  };

  cases.set(caseId, updated);

  recordTimeline(caseId, 'PRIORITY_CHANGED', performedById, {
    previousValue: previousPriority,
    newValue: priority,
  });

  return updated;
}

/**
 * Returns all timeline entries for a case, sorted by timestamp.
 */
export function getCaseTimeline(caseId: string): CaseTimelineEntry[] {
  if (!cases.has(caseId)) {
    throw new Error(`Case not found: ${caseId}`);
  }
  return getTimelineForCase(caseId);
}

/**
 * Returns aggregate dashboard metrics across all cases.
 */
export function getDashboardMetrics(): CaseDashboardMetrics {
  const allCases = Array.from(cases.values());
  const now = new Date();

  const totalOpen = allCases.filter((c) => c.status === CaseStatus.OPEN).length;
  const totalInvestigating = allCases.filter((c) => c.status === CaseStatus.INVESTIGATING).length;
  const totalEscalated = allCases.filter((c) => c.status === CaseStatus.ESCALATED).length;
  const totalResolved = allCases.filter((c) => c.status === CaseStatus.RESOLVED).length;
  const totalClosed = allCases.filter((c) => c.status === CaseStatus.CLOSED).length;

  // Average resolution time in hours for resolved cases
  const resolvedCases = allCases.filter((c) => c.status === CaseStatus.RESOLVED && c.resolvedAt);
  const avgResolutionTimeHours =
    resolvedCases.length > 0
      ? resolvedCases.reduce((sum, c) => {
          const ms = (c.resolvedAt!.getTime() - c.createdAt.getTime());
          return sum + ms / (1000 * 60 * 60);
        }, 0) / resolvedCases.length
      : 0;

  // Counts by category
  const casesByCategory: Record<string, number> = {};
  for (const c of allCases) {
    casesByCategory[c.category] = (casesByCategory[c.category] ?? 0) + 1;
  }

  // Counts by priority
  const casesByPriority: Record<string, number> = {};
  for (const c of allCases) {
    casesByPriority[c.priority] = (casesByPriority[c.priority] ?? 0) + 1;
  }

  // Overdue: open/investigating cases past their due date
  const overdueCount = allCases.filter(
    (c) =>
      c.dueDate &&
      c.dueDate < now &&
      c.status !== CaseStatus.RESOLVED &&
      c.status !== CaseStatus.CLOSED
  ).length;

  const unassignedCount = allCases.filter(
    (c) =>
      !c.assigneeId &&
      c.status !== CaseStatus.RESOLVED &&
      c.status !== CaseStatus.CLOSED
  ).length;

  return {
    totalOpen,
    totalInvestigating,
    totalEscalated,
    totalResolved,
    totalClosed,
    avgResolutionTimeHours,
    casesByCategory,
    casesByPriority,
    overdueCount,
    unassignedCount,
  };
}

/**
 * Auto-creates a case when a transaction is flagged by the risk engine or
 * sanctions service. Uses 'SYSTEM' as the creator.
 */
export function autoCreateCase(
  transaction: Transaction,
  reason: string,
  category: CaseCategory
): Case {
  const priority = priorityFromRiskLevel(transaction.riskLevel);

  const newCase: Case = {
    id: uuidv4(),
    caseNumber: generateCaseNumber(),
    title: `[AUTO] ${category.replace(/_/g, ' ')} — ${transaction.txHash || transaction.id}`,
    description: reason,
    category,
    status: CaseStatus.OPEN,
    priority,
    createdById: 'SYSTEM',
    transactionIds: [transaction.id],
    walletAddresses: [transaction.senderAddress, transaction.receiverAddress].filter(Boolean),
    riskLevel: transaction.riskLevel,
    tags: ['auto-generated'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  cases.set(newCase.id, newCase);

  recordTimeline(newCase.id, 'CASE_CREATED', 'SYSTEM', {
    newValue: newCase.caseNumber,
    metadata: {
      reason,
      category,
      transactionId: transaction.id,
      riskScore: transaction.riskScore,
    },
  });

  logger.warn('Auto-case created from flagged transaction', {
    caseId: newCase.id,
    caseNumber: newCase.caseNumber,
    transactionId: transaction.id,
    category,
    priority,
  });

  return newCase;
}

/**
 * Finds cases that share transaction IDs or wallet addresses with the given case.
 */
export function getRelatedCases(caseId: string): Case[] {
  const source = cases.get(caseId);
  if (!source) {
    throw new Error(`Case not found: ${caseId}`);
  }

  const txSet = new Set(source.transactionIds);
  const walletSet = new Set(source.walletAddresses);

  return Array.from(cases.values()).filter((c) => {
    if (c.id === caseId) return false;
    const sharedTx = c.transactionIds.some((id) => txSet.has(id));
    const sharedWallet = c.walletAddresses.some((addr) => walletSet.has(addr));
    return sharedTx || sharedWallet;
  });
}

// Exported for testing purposes
export { cases as _casesStore, caseNotes as _caseNotesStore, caseTimeline as _caseTimelineStore };
