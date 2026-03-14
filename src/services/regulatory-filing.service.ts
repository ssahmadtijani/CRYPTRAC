/**
 * Regulatory Filing Service for CRYPTRAC
 * Manages regulatory filing deadlines and calendar for compliance officers.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  RegulatoryFiling,
  FilingType,
  FilingStatus,
  FilingCalendarEntry,
  FilingDashboardMetrics,
} from '../types';
import { logger } from '../utils/logger';
import { eventBus } from '../utils/eventBus';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const filingDeadlines = new Map<string, RegulatoryFiling>();

// Days threshold for DUE_SOON
const DUE_SOON_DAYS = 7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStatus(dueDate: Date, currentStatus: FilingStatus): FilingStatus {
  // Filed/Cancelled stay as-is
  if (currentStatus === FilingStatus.FILED || currentStatus === FilingStatus.CANCELLED) {
    return currentStatus;
  }

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / msPerDay);

  if (daysUntilDue < 0) return FilingStatus.OVERDUE;
  if (daysUntilDue <= DUE_SOON_DAYS) return FilingStatus.DUE_SOON;
  return FilingStatus.UPCOMING;
}

function toCalendarEntry(filing: RegulatoryFiling): FilingCalendarEntry {
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilDue = Math.ceil((filing.dueDate.getTime() - now.getTime()) / msPerDay);
  const status = computeStatus(filing.dueDate, filing.status);

  return {
    id: filing.id,
    filingType: filing.filingType,
    title: filing.title,
    dueDate: filing.dueDate,
    status,
    daysUntilDue,
    assignedTo: filing.assignedTo,
  };
}

function throwNotFound(id: string): never {
  const err = new Error(`Filing ${id} not found`) as Error & { statusCode: number };
  err.statusCode = 404;
  throw err;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createFiling(input: {
  filingType: FilingType;
  title: string;
  description: string;
  regulatoryAuthority: string;
  dueDate: Date;
  assignedTo?: string;
  linkedReportIds?: string[];
}): RegulatoryFiling {
  const now = new Date();
  const status = computeStatus(input.dueDate, FilingStatus.UPCOMING);

  const filing: RegulatoryFiling = {
    id: uuidv4(),
    filingType: input.filingType,
    title: input.title,
    description: input.description,
    regulatoryAuthority: input.regulatoryAuthority,
    dueDate: input.dueDate,
    status,
    assignedTo: input.assignedTo,
    linkedReportIds: input.linkedReportIds ?? [],
    notes: [],
    createdAt: now,
    updatedAt: now,
  };

  filingDeadlines.set(filing.id, filing);

  logger.info('Regulatory filing created', {
    id: filing.id,
    title: filing.title,
    dueDate: filing.dueDate,
    status: filing.status,
  });

  return filing;
}

export function updateFiling(
  id: string,
  updates: Partial<
    Pick<RegulatoryFiling, 'title' | 'description' | 'dueDate' | 'assignedTo' | 'linkedReportIds' | 'notes'>
  >
): RegulatoryFiling {
  const filing = filingDeadlines.get(id);
  if (!filing) throwNotFound(id);

  Object.assign(filing, updates, { updatedAt: new Date() });

  // Recompute status if dueDate changed
  if (updates.dueDate !== undefined) {
    filing.status = computeStatus(filing.dueDate, filing.status);
  }

  filingDeadlines.set(id, filing);

  logger.info('Regulatory filing updated', { id, title: filing.title });

  return filing;
}

export function markAsFiled(id: string, filingReference?: string): RegulatoryFiling {
  const filing = filingDeadlines.get(id);
  if (!filing) throwNotFound(id);

  filing.status = FilingStatus.FILED;
  filing.filedAt = new Date();
  filing.filingReference = filingReference;
  filing.updatedAt = new Date();
  filingDeadlines.set(id, filing);

  logger.info('Regulatory filing marked as filed', { id, filingReference });

  return filing;
}

export function cancelFiling(id: string, reason: string): RegulatoryFiling {
  const filing = filingDeadlines.get(id);
  if (!filing) throwNotFound(id);

  filing.status = FilingStatus.CANCELLED;
  filing.notes = [...filing.notes, `Cancelled: ${reason}`];
  filing.updatedAt = new Date();
  filingDeadlines.set(id, filing);

  logger.info('Regulatory filing cancelled', { id, reason });

  return filing;
}

export function getFiling(id: string): RegulatoryFiling | undefined {
  return filingDeadlines.get(id);
}

export function getFilings(filters?: {
  filingType?: FilingType;
  status?: FilingStatus;
  assignedTo?: string;
  startDate?: Date;
  endDate?: Date;
}): RegulatoryFiling[] {
  let filings = Array.from(filingDeadlines.values());

  // Refresh statuses before filtering
  filings.forEach((f) => {
    const refreshed = computeStatus(f.dueDate, f.status);
    if (refreshed !== f.status) {
      f.status = refreshed;
      f.updatedAt = new Date();
      filingDeadlines.set(f.id, f);
    }
  });

  if (filters) {
    if (filters.filingType !== undefined) {
      filings = filings.filter((f) => f.filingType === filters.filingType);
    }
    if (filters.status !== undefined) {
      filings = filings.filter((f) => f.status === filters.status);
    }
    if (filters.assignedTo !== undefined) {
      filings = filings.filter((f) => f.assignedTo === filters.assignedTo);
    }
    if (filters.startDate !== undefined) {
      filings = filings.filter((f) => f.dueDate >= filters.startDate!);
    }
    if (filters.endDate !== undefined) {
      filings = filings.filter((f) => f.dueDate <= filters.endDate!);
    }
  }

  return filings.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export function getFilingCalendar(daysAhead = 90): FilingCalendarEntry[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return Array.from(filingDeadlines.values())
    .filter((f) => f.status !== FilingStatus.CANCELLED && f.dueDate <= cutoff)
    .map(toCalendarEntry)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export function getFilingDashboard(): FilingDashboardMetrics {
  const all = Array.from(filingDeadlines.values());

  // Refresh statuses
  all.forEach((f) => {
    const refreshed = computeStatus(f.dueDate, f.status);
    if (refreshed !== f.status) {
      f.status = refreshed;
      f.updatedAt = new Date();
      filingDeadlines.set(f.id, f);
    }
  });

  const totalFilings = all.length;
  const upcoming = all.filter((f) => f.status === FilingStatus.UPCOMING).length;
  const dueSoon = all.filter((f) => f.status === FilingStatus.DUE_SOON).length;
  const overdue = all.filter((f) => f.status === FilingStatus.OVERDUE).length;
  const filed = all.filter((f) => f.status === FilingStatus.FILED).length;

  const eligible = all.filter((f) => f.status !== FilingStatus.CANCELLED).length;
  const complianceScore = eligible > 0 ? Math.round((filed / eligible) * 100) : 100;

  const calendar = getFilingCalendar();
  const nextDeadline =
    calendar.find((e) => e.status !== FilingStatus.FILED && e.status !== FilingStatus.CANCELLED) ?? undefined;

  const overdueFilings = all
    .filter((f) => f.status === FilingStatus.OVERDUE)
    .map(toCalendarEntry)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  return {
    totalFilings,
    upcoming,
    dueSoon,
    overdue,
    filed,
    complianceScore,
    nextDeadline,
    overdueFilings,
  };
}

export function checkOverdueFilings(): RegulatoryFiling[] {
  const now = new Date();
  const overdueFilings: RegulatoryFiling[] = [];

  filingDeadlines.forEach((filing) => {
    if (
      filing.status !== FilingStatus.FILED &&
      filing.status !== FilingStatus.CANCELLED &&
      filing.dueDate < now
    ) {
      filing.status = FilingStatus.OVERDUE;
      filing.updatedAt = now;
      filingDeadlines.set(filing.id, filing);
      overdueFilings.push(filing);
      eventBus.emit('filing:overdue', filing);
    }
  });

  if (overdueFilings.length > 0) {
    logger.warn(`Found ${overdueFilings.length} overdue regulatory filings`);
  }

  return overdueFilings;
}

// Exported for testing
export { filingDeadlines as _filingStore };
