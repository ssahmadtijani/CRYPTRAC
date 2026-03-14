/**
 * Case Service Tests for CRYPTRAC
 */

import {
  createCase,
  getCaseById,
  getCases,
  updateCaseStatus,
  assignCase,
  addCaseNote,
  linkTransaction,
  linkWallet,
  updateCasePriority,
  getCaseTimeline,
  getDashboardMetrics,
  autoCreateCase,
  getRelatedCases,
  _casesStore,
  _caseNotesStore,
  _caseTimelineStore,
} from '../case.service';
import {
  CaseStatus,
  CasePriority,
  CaseCategory,
  RiskLevel,
  TransactionType,
  ComplianceStatus,
  Transaction,
} from '../../types';
import { CreateCaseInput } from '../../validators/schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStores(): void {
  _casesStore.clear();
  _caseNotesStore.clear();
  _caseTimelineStore.clear();
}

function makeCreateCaseInput(overrides?: Partial<CreateCaseInput>): CreateCaseInput {
  return {
    title: 'Test Suspicious Transaction',
    description: 'A suspicious transaction was detected requiring investigation.',
    category: CaseCategory.SUSPICIOUS_TRANSACTION,
    transactionIds: [],
    walletAddresses: [],
    tags: [],
    ...overrides,
  };
}

function makeTransaction(overrides?: Partial<Transaction>): Transaction {
  const now = new Date();
  return {
    id: 'tx-' + Math.random().toString(36).slice(2),
    txHash: '0x' + 'a'.repeat(64),
    type: TransactionType.TRANSFER,
    senderAddress: '0xSender',
    receiverAddress: '0xReceiver',
    asset: 'ETH',
    amount: 10,
    amountUSD: 120_000,
    fee: 0.01,
    feeUSD: 12,
    network: 'ethereum',
    timestamp: now,
    riskLevel: RiskLevel.HIGH,
    riskScore: 80,
    complianceStatus: ComplianceStatus.FLAGGED,
    userId: 'user-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearStores();
});

// ---------------------------------------------------------------------------
// Case creation
// ---------------------------------------------------------------------------

describe('createCase', () => {
  it('creates a case with an auto-generated case number', () => {
    const input = makeCreateCaseInput();
    const newCase = createCase(input, 'user-1');

    expect(newCase.id).toBeDefined();
    expect(newCase.caseNumber).toMatch(/^CASE-\d{4}-\d{5}$/);
    expect(newCase.title).toBe(input.title);
    expect(newCase.status).toBe(CaseStatus.OPEN);
    expect(newCase.createdById).toBe('user-1');
  });

  it('generates sequential case numbers', () => {
    const case1 = createCase(makeCreateCaseInput(), 'user-1');
    const case2 = createCase(makeCreateCaseInput(), 'user-1');

    const num1 = parseInt(case1.caseNumber.split('-')[2], 10);
    const num2 = parseInt(case2.caseNumber.split('-')[2], 10);
    expect(num2).toBeGreaterThan(num1);
  });

  it('auto-determines priority from risk level when not specified', () => {
    const critical = createCase(
      makeCreateCaseInput({ riskLevel: RiskLevel.CRITICAL }),
      'user-1'
    );
    expect(critical.priority).toBe(CasePriority.CRITICAL);

    const high = createCase(makeCreateCaseInput({ riskLevel: RiskLevel.HIGH }), 'user-1');
    expect(high.priority).toBe(CasePriority.HIGH);

    const medium = createCase(makeCreateCaseInput({ riskLevel: RiskLevel.MEDIUM }), 'user-1');
    expect(medium.priority).toBe(CasePriority.MEDIUM);

    const low = createCase(makeCreateCaseInput({ riskLevel: RiskLevel.LOW }), 'user-1');
    expect(low.priority).toBe(CasePriority.LOW);
  });

  it('uses explicit priority when provided', () => {
    const newCase = createCase(
      makeCreateCaseInput({ priority: CasePriority.CRITICAL, riskLevel: RiskLevel.LOW }),
      'user-1'
    );
    expect(newCase.priority).toBe(CasePriority.CRITICAL);
  });

  it('records a CASE_CREATED timeline entry', () => {
    const newCase = createCase(makeCreateCaseInput(), 'user-1');
    const timeline = getCaseTimeline(newCase.id);

    expect(timeline).toHaveLength(1);
    expect(timeline[0].action).toBe('CASE_CREATED');
    expect(timeline[0].performedById).toBe('user-1');
  });
});

// ---------------------------------------------------------------------------
// Case retrieval
// ---------------------------------------------------------------------------

describe('getCaseById', () => {
  it('returns null for a non-existent case', () => {
    const result = getCaseById('non-existent-id');
    expect(result).toBeNull();
  });

  it('returns a case with notes and timeline', () => {
    const newCase = createCase(makeCreateCaseInput(), 'user-1');
    const found = getCaseById(newCase.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(newCase.id);
    expect(Array.isArray(found!.notes)).toBe(true);
    expect(Array.isArray(found!.timeline)).toBe(true);
    expect(found!.timeline).toHaveLength(1); // CASE_CREATED
  });
});

describe('getCases', () => {
  it('returns an empty list when no cases exist', () => {
    const result = getCases({});
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('filters by status', () => {
    createCase(makeCreateCaseInput(), 'user-1');
    const c2 = createCase(makeCreateCaseInput(), 'user-1');
    updateCaseStatus(c2.id, CaseStatus.INVESTIGATING, 'user-1');

    const open = getCases({ status: CaseStatus.OPEN });
    expect(open.data.every((c) => c.status === CaseStatus.OPEN)).toBe(true);
    expect(open.total).toBe(1);

    const investigating = getCases({ status: CaseStatus.INVESTIGATING });
    expect(investigating.total).toBe(1);
  });

  it('filters by priority', () => {
    createCase(makeCreateCaseInput({ priority: CasePriority.CRITICAL }), 'user-1');
    createCase(makeCreateCaseInput({ priority: CasePriority.LOW }), 'user-1');

    const critical = getCases({ priority: CasePriority.CRITICAL });
    expect(critical.total).toBe(1);
    expect(critical.data[0].priority).toBe(CasePriority.CRITICAL);
  });

  it('filters by category', () => {
    createCase(makeCreateCaseInput({ category: CaseCategory.SANCTIONS_HIT }), 'user-1');
    createCase(makeCreateCaseInput({ category: CaseCategory.STRUCTURING }), 'user-1');

    const sanctioned = getCases({ category: CaseCategory.SANCTIONS_HIT });
    expect(sanctioned.total).toBe(1);
  });

  it('filters by assigneeId', () => {
    const c1 = createCase(makeCreateCaseInput(), 'user-1');
    createCase(makeCreateCaseInput(), 'user-1');
    assignCase(c1.id, 'officer-1', 'user-1');

    const assigned = getCases({ assigneeId: 'officer-1' });
    expect(assigned.total).toBe(1);
    expect(assigned.data[0].assigneeId).toBe('officer-1');
  });

  it('supports text search across title, description, and case number', () => {
    createCase(
      makeCreateCaseInput({ title: 'Unique XYZ case', description: 'Something happened here with XYZ.' }),
      'user-1'
    );
    createCase(makeCreateCaseInput({ title: 'Another case', description: 'Unrelated description.' }), 'user-1');

    const results = getCases({ search: 'XYZ' });
    expect(results.total).toBe(1);
    expect(results.data[0].title).toContain('XYZ');
  });

  it('supports pagination', () => {
    for (let i = 0; i < 5; i++) {
      createCase(makeCreateCaseInput({ title: `Case number ${i}`, description: 'Description for pagination test.' }), 'user-1');
    }

    const page1 = getCases({ page: 1, pageSize: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.total).toBe(5);

    const page2 = getCases({ page: 2, pageSize: 2 });
    expect(page2.data).toHaveLength(2);

    const page3 = getCases({ page: 3, pageSize: 2 });
    expect(page3.data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

describe('updateCaseStatus', () => {
  it('transitions case from OPEN to INVESTIGATING', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    const updated = updateCaseStatus(c.id, CaseStatus.INVESTIGATING, 'user-1');
    expect(updated.status).toBe(CaseStatus.INVESTIGATING);
  });

  it('transitions case to ESCALATED and sets escalatedAt', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    const updated = updateCaseStatus(c.id, CaseStatus.ESCALATED, 'user-1');
    expect(updated.status).toBe(CaseStatus.ESCALATED);
    expect(updated.escalatedAt).toBeDefined();
  });

  it('requires resolution text when resolving a case', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    expect(() => updateCaseStatus(c.id, CaseStatus.RESOLVED, 'user-1')).toThrow(
      'Resolution text is required'
    );
  });

  it('sets resolvedAt and resolvedById when resolved with resolution', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    const resolution = 'No suspicious activity found after full investigation.';
    const updated = updateCaseStatus(c.id, CaseStatus.RESOLVED, 'officer-1', resolution);

    expect(updated.status).toBe(CaseStatus.RESOLVED);
    expect(updated.resolution).toBe(resolution);
    expect(updated.resolvedById).toBe('officer-1');
    expect(updated.resolvedAt).toBeDefined();
  });

  it('records a STATUS_CHANGED timeline entry', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    updateCaseStatus(c.id, CaseStatus.INVESTIGATING, 'user-1');

    const timeline = getCaseTimeline(c.id);
    const statusEntry = timeline.find((e) => e.action === 'STATUS_CHANGED');
    expect(statusEntry).toBeDefined();
    expect(statusEntry!.previousValue).toBe(CaseStatus.OPEN);
    expect(statusEntry!.newValue).toBe(CaseStatus.INVESTIGATING);
  });

  it('throws for a non-existent case', () => {
    expect(() =>
      updateCaseStatus('non-existent', CaseStatus.CLOSED, 'user-1')
    ).toThrow('Case not found');
  });
});

// ---------------------------------------------------------------------------
// Case assignment
// ---------------------------------------------------------------------------

describe('assignCase', () => {
  it('assigns a case to an officer', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    const updated = assignCase(c.id, 'officer-1', 'user-1');
    expect(updated.assigneeId).toBe('officer-1');
  });

  it('records an ASSIGNED timeline entry', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    assignCase(c.id, 'officer-1', 'user-1');

    const timeline = getCaseTimeline(c.id);
    const entry = timeline.find((e) => e.action === 'ASSIGNED');
    expect(entry).toBeDefined();
    expect(entry!.newValue).toBe('officer-1');
  });

  it('throws for a non-existent case', () => {
    expect(() => assignCase('non-existent', 'officer-1', 'user-1')).toThrow('Case not found');
  });
});

// ---------------------------------------------------------------------------
// Adding notes
// ---------------------------------------------------------------------------

describe('addCaseNote', () => {
  it('adds a note to a case', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    const note = addCaseNote(c.id, 'user-1', 'Reviewed transaction history.', 'INVESTIGATION');

    expect(note.id).toBeDefined();
    expect(note.caseId).toBe(c.id);
    expect(note.content).toBe('Reviewed transaction history.');
    expect(note.noteType).toBe('INVESTIGATION');
  });

  it('appears in getCaseById notes', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    addCaseNote(c.id, 'user-1', 'First note.', 'GENERAL');
    addCaseNote(c.id, 'user-1', 'Second note.', 'EVIDENCE');

    const found = getCaseById(c.id);
    expect(found!.notes).toHaveLength(2);
  });

  it('records a NOTE_ADDED timeline entry', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    addCaseNote(c.id, 'user-1', 'Investigation note here.', 'INVESTIGATION');

    const timeline = getCaseTimeline(c.id);
    const noteEntry = timeline.find((e) => e.action === 'NOTE_ADDED');
    expect(noteEntry).toBeDefined();
  });

  it('throws for a non-existent case', () => {
    expect(() => addCaseNote('bad-id', 'user-1', 'note', 'GENERAL')).toThrow('Case not found');
  });
});

// ---------------------------------------------------------------------------
// Linking transactions and wallets
// ---------------------------------------------------------------------------

describe('linkTransaction', () => {
  it('links a transaction ID to a case', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    const txId = '11111111-1111-1111-1111-111111111111';
    const updated = linkTransaction(c.id, txId, 'user-1');
    expect(updated.transactionIds).toContain(txId);
  });

  it('does not duplicate a transaction ID if already linked', () => {
    const c = createCase(
      makeCreateCaseInput({ transactionIds: ['11111111-1111-1111-1111-111111111111'] }),
      'user-1'
    );
    const updated = linkTransaction(c.id, '11111111-1111-1111-1111-111111111111', 'user-1');
    expect(updated.transactionIds.filter((id) => id === '11111111-1111-1111-1111-111111111111')).toHaveLength(1);
  });

  it('records a TRANSACTION_LINKED timeline entry', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    linkTransaction(c.id, '11111111-1111-1111-1111-111111111111', 'user-1');

    const timeline = getCaseTimeline(c.id);
    const entry = timeline.find((e) => e.action === 'TRANSACTION_LINKED');
    expect(entry).toBeDefined();
  });
});

describe('linkWallet', () => {
  it('links a wallet address to a case', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    const updated = linkWallet(c.id, '0xWalletAddress', 'user-1');
    expect(updated.walletAddresses).toContain('0xWalletAddress');
  });

  it('does not duplicate a wallet address', () => {
    const c = createCase(
      makeCreateCaseInput({ walletAddresses: ['0xWalletAddress'] }),
      'user-1'
    );
    const updated = linkWallet(c.id, '0xWalletAddress', 'user-1');
    expect(updated.walletAddresses.filter((a) => a === '0xWalletAddress')).toHaveLength(1);
  });

  it('records a WALLET_LINKED timeline entry', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    linkWallet(c.id, '0xNewWallet', 'user-1');

    const timeline = getCaseTimeline(c.id);
    const entry = timeline.find((e) => e.action === 'WALLET_LINKED');
    expect(entry).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Priority updates
// ---------------------------------------------------------------------------

describe('updateCasePriority', () => {
  it('updates the priority of a case', () => {
    const c = createCase(makeCreateCaseInput({ priority: CasePriority.LOW }), 'user-1');
    const updated = updateCasePriority(c.id, CasePriority.CRITICAL, 'user-1');
    expect(updated.priority).toBe(CasePriority.CRITICAL);
  });

  it('records a PRIORITY_CHANGED timeline entry', () => {
    const c = createCase(makeCreateCaseInput({ priority: CasePriority.LOW }), 'user-1');
    updateCasePriority(c.id, CasePriority.HIGH, 'user-1');

    const timeline = getCaseTimeline(c.id);
    const entry = timeline.find((e) => e.action === 'PRIORITY_CHANGED');
    expect(entry).toBeDefined();
    expect(entry!.previousValue).toBe(CasePriority.LOW);
    expect(entry!.newValue).toBe(CasePriority.HIGH);
  });
});

// ---------------------------------------------------------------------------
// Dashboard metrics
// ---------------------------------------------------------------------------

describe('getDashboardMetrics', () => {
  it('returns zero metrics when there are no cases', () => {
    const metrics = getDashboardMetrics();
    expect(metrics.totalOpen).toBe(0);
    expect(metrics.totalInvestigating).toBe(0);
    expect(metrics.totalResolved).toBe(0);
    expect(metrics.overdueCount).toBe(0);
    expect(metrics.unassignedCount).toBe(0);
  });

  it('counts cases by status', () => {
    createCase(makeCreateCaseInput(), 'user-1'); // OPEN
    const c2 = createCase(makeCreateCaseInput(), 'user-1');
    updateCaseStatus(c2.id, CaseStatus.INVESTIGATING, 'user-1');
    const c3 = createCase(makeCreateCaseInput(), 'user-1');
    updateCaseStatus(c3.id, CaseStatus.RESOLVED, 'user-1', 'Resolved after investigation.');

    const metrics = getDashboardMetrics();
    expect(metrics.totalOpen).toBe(1);
    expect(metrics.totalInvestigating).toBe(1);
    expect(metrics.totalResolved).toBe(1);
  });

  it('counts cases by category', () => {
    createCase(makeCreateCaseInput({ category: CaseCategory.SANCTIONS_HIT }), 'user-1');
    createCase(makeCreateCaseInput({ category: CaseCategory.SANCTIONS_HIT }), 'user-1');
    createCase(makeCreateCaseInput({ category: CaseCategory.STRUCTURING }), 'user-1');

    const metrics = getDashboardMetrics();
    expect(metrics.casesByCategory[CaseCategory.SANCTIONS_HIT]).toBe(2);
    expect(metrics.casesByCategory[CaseCategory.STRUCTURING]).toBe(1);
  });

  it('counts unassigned open cases', () => {
    const c1 = createCase(makeCreateCaseInput(), 'user-1');
    createCase(makeCreateCaseInput(), 'user-1');
    assignCase(c1.id, 'officer-1', 'user-1');

    const metrics = getDashboardMetrics();
    expect(metrics.unassignedCount).toBe(1);
  });

  it('counts overdue cases', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // yesterday
    createCase(makeCreateCaseInput({ dueDate: past }), 'user-1');
    createCase(makeCreateCaseInput(), 'user-1'); // no due date

    const metrics = getDashboardMetrics();
    expect(metrics.overdueCount).toBe(1);
  });

  it('calculates average resolution time for resolved cases', () => {
    const c1 = createCase(makeCreateCaseInput(), 'user-1');
    updateCaseStatus(c1.id, CaseStatus.RESOLVED, 'user-1', 'All clear after investigation.');

    const metrics = getDashboardMetrics();
    expect(metrics.avgResolutionTimeHours).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Auto-case creation
// ---------------------------------------------------------------------------

describe('autoCreateCase', () => {
  it('creates a case with SYSTEM as creator', () => {
    const tx = makeTransaction();
    const c = autoCreateCase(tx, 'High risk transaction detected.', CaseCategory.SUSPICIOUS_TRANSACTION);

    expect(c.createdById).toBe('SYSTEM');
    expect(c.transactionIds).toContain(tx.id);
    expect(c.category).toBe(CaseCategory.SUSPICIOUS_TRANSACTION);
    expect(c.tags).toContain('auto-generated');
  });

  it('determines priority from transaction risk level', () => {
    const criticalTx = makeTransaction({ riskLevel: RiskLevel.CRITICAL });
    const c = autoCreateCase(criticalTx, 'Reason.', CaseCategory.SUSPICIOUS_TRANSACTION);
    expect(c.priority).toBe(CasePriority.CRITICAL);

    clearStores();

    const lowTx = makeTransaction({ riskLevel: RiskLevel.LOW });
    const c2 = autoCreateCase(lowTx, 'Reason.', CaseCategory.UNUSUAL_PATTERN);
    expect(c2.priority).toBe(CasePriority.LOW);
  });

  it('creates a SANCTIONS_HIT case with correct category', () => {
    const tx = makeTransaction();
    const c = autoCreateCase(tx, 'Sanctioned address detected.', CaseCategory.SANCTIONS_HIT);
    expect(c.category).toBe(CaseCategory.SANCTIONS_HIT);
  });

  it('links both sender and receiver wallet addresses', () => {
    const tx = makeTransaction({ senderAddress: '0xSender', receiverAddress: '0xReceiver' });
    const c = autoCreateCase(tx, 'Reason.', CaseCategory.HIGH_RISK_WALLET);
    expect(c.walletAddresses).toContain('0xSender');
    expect(c.walletAddresses).toContain('0xReceiver');
  });

  it('records a CASE_CREATED timeline entry', () => {
    const tx = makeTransaction();
    const c = autoCreateCase(tx, 'Reason.', CaseCategory.SUSPICIOUS_TRANSACTION);
    const timeline = getCaseTimeline(c.id);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].action).toBe('CASE_CREATED');
    expect(timeline[0].performedById).toBe('SYSTEM');
  });
});

// ---------------------------------------------------------------------------
// Related case detection
// ---------------------------------------------------------------------------

describe('getRelatedCases', () => {
  it('returns an empty array when no related cases exist', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    expect(getRelatedCases(c.id)).toHaveLength(0);
  });

  it('finds cases sharing a transaction ID', () => {
    const txId = '22222222-2222-2222-2222-222222222222';
    const c1 = createCase(makeCreateCaseInput({ transactionIds: [txId] }), 'user-1');
    const c2 = createCase(makeCreateCaseInput({ transactionIds: [txId] }), 'user-1');
    createCase(makeCreateCaseInput(), 'user-1'); // unrelated

    const related = getRelatedCases(c1.id);
    expect(related).toHaveLength(1);
    expect(related[0].id).toBe(c2.id);
  });

  it('finds cases sharing a wallet address', () => {
    const wallet = '0xSharedWallet';
    const c1 = createCase(makeCreateCaseInput({ walletAddresses: [wallet] }), 'user-1');
    const c2 = createCase(makeCreateCaseInput({ walletAddresses: [wallet] }), 'user-1');

    const related = getRelatedCases(c1.id);
    expect(related).toHaveLength(1);
    expect(related[0].id).toBe(c2.id);
  });

  it('throws for a non-existent case', () => {
    expect(() => getRelatedCases('non-existent')).toThrow('Case not found');
  });
});

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

describe('getCaseTimeline', () => {
  it('returns timeline sorted by timestamp', () => {
    const c = createCase(makeCreateCaseInput(), 'user-1');
    updateCaseStatus(c.id, CaseStatus.INVESTIGATING, 'user-1');
    assignCase(c.id, 'officer-1', 'user-1');

    const timeline = getCaseTimeline(c.id);
    expect(timeline.length).toBeGreaterThanOrEqual(3);

    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        timeline[i - 1].timestamp.getTime()
      );
    }
  });

  it('throws for a non-existent case', () => {
    expect(() => getCaseTimeline('bad-id')).toThrow('Case not found');
  });
});
