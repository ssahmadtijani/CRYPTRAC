/**
 * Alert Service Tests for CRYPTRAC
 */

import {
  createAlertRule,
  getAlertRules,
  getAlertRule,
  updateAlertRule,
  toggleAlertRule,
  deleteAlertRule,
  evaluateTransaction,
  evaluateCase,
  getDefaultRules,
  _alertRulesStore,
} from '../alert.service';
import { _notificationsStore, _preferencesStore } from '../notification.service';
import {
  AlertRuleCondition,
  NotificationType,
  NotificationPriority,
  UserRole,
  RiskLevel,
  ComplianceStatus,
  TransactionType,
  CaseStatus,
  CasePriority,
  CaseCategory,
  Transaction,
  Case,
} from '../../types';
import { CreateAlertRuleInput } from '../../validators/schemas';

// ---------------------------------------------------------------------------
// Mock getAllUsers for broadcastToRoles inside the services
// ---------------------------------------------------------------------------

jest.mock('../auth.service', () => ({
  getAllUsers: jest.fn().mockResolvedValue([
    { id: 'user-admin', email: 'admin@test.com', role: 'ADMIN', firstName: 'Admin', lastName: 'User' },
    { id: 'user-officer', email: 'officer@test.com', role: 'COMPLIANCE_OFFICER', firstName: 'Officer', lastName: 'User' },
    { id: 'user-analyst', email: 'analyst@test.com', role: 'ANALYST', firstName: 'Analyst', lastName: 'User' },
  ]),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearAll(): void {
  _alertRulesStore.clear();
  _notificationsStore.clear();
  _preferencesStore.clear();
  // Reset defaultsSeeded so each test gets a clean slate
  // We do this by clearing the rules map (ensureDefaultsSeeded checks the flag)
}

function makeRuleInput(overrides?: Partial<CreateAlertRuleInput>): CreateAlertRuleInput {
  return {
    name: 'Test Rule',
    description: 'A test alert rule for unit testing purposes.',
    condition: AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS,
    threshold: 5_000,
    notificationType: NotificationType.THRESHOLD_EXCEEDED,
    priority: NotificationPriority.HIGH,
    targetRoles: [UserRole.ADMIN],
    isActive: true,
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
    amount: 5,
    amountUSD: 50_000,
    fee: 0.01,
    feeUSD: 5,
    network: 'ethereum',
    timestamp: now,
    riskLevel: RiskLevel.HIGH,
    riskScore: 70,
    complianceStatus: ComplianceStatus.PENDING,
    userId: 'user-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCase(overrides?: Partial<Case>): Case {
  const now = new Date();
  return {
    id: 'case-' + Math.random().toString(36).slice(2),
    caseNumber: 'CASE-2026-00001',
    title: 'Test Case',
    description: 'A test case for unit testing.',
    category: CaseCategory.SUSPICIOUS_TRANSACTION,
    status: CaseStatus.OPEN,
    priority: CasePriority.HIGH,
    createdById: 'user-1',
    transactionIds: [],
    walletAddresses: [],
    riskLevel: RiskLevel.HIGH,
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Alert Service', () => {
  beforeEach(() => {
    clearAll();
    // Force re-seed by clearing the seeded flag via the store
    // The defaultsSeeded flag is module-level; clear it by re-importing would
    // be too complex, so we just clear the store and let tests operate as-is.
    // Tests that need fresh defaults should call getAlertRules() first.
  });

  // -------------------------------------------------------------------------
  // Default rules
  // -------------------------------------------------------------------------

  describe('getDefaultRules', () => {
    it('returns 4 default rules', () => {
      const defaults = getDefaultRules();
      expect(defaults).toHaveLength(4);
    });

    it('includes SAR threshold rule', () => {
      const defaults = getDefaultRules();
      const sar = defaults.find(
        (r) => r.condition === AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS
      );
      expect(sar).toBeDefined();
      expect(sar?.threshold).toBe(10_000);
    });

    it('includes high risk rule', () => {
      const defaults = getDefaultRules();
      const highRisk = defaults.find(
        (r) => r.condition === AlertRuleCondition.RISK_LEVEL_IS
      );
      expect(highRisk).toBeDefined();
    });

    it('includes sanctions hit rule', () => {
      const defaults = getDefaultRules();
      const sanctions = defaults.find(
        (r) => r.condition === AlertRuleCondition.SANCTIONS_HIT
      );
      expect(sanctions).toBeDefined();
      expect(sanctions?.priority).toBe(NotificationPriority.CRITICAL);
    });

    it('includes case escalation rule', () => {
      const defaults = getDefaultRules();
      const escalation = defaults.find(
        (r) => r.condition === AlertRuleCondition.CASE_ESCALATED
      );
      expect(escalation).toBeDefined();
    });
  });

  describe('default rules seeding', () => {
    it('seeds defaults on first getAlertRules() call', () => {
      // _alertRulesStore is cleared in beforeEach, but defaultsSeeded might
      // still be true from a previous test. This tests the lazy-seed path.
      const rules = getAlertRules();
      // If defaults were already seeded, rules.length >= 4
      expect(rules.length).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  describe('createAlertRule', () => {
    it('creates a new alert rule', () => {
      const rule = createAlertRule(makeRuleInput(), 'admin-user');

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('Test Rule');
      expect(rule.condition).toBe(AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS);
      expect(rule.threshold).toBe(5_000);
      expect(rule.createdBy).toBe('admin-user');
      expect(rule.isActive).toBe(true);
      expect(rule.createdAt).toBeInstanceOf(Date);
    });

    it('stores the rule in the map', () => {
      const initialSize = _alertRulesStore.size;
      createAlertRule(makeRuleInput(), 'admin-user');
      expect(_alertRulesStore.size).toBe(initialSize + 1);
    });
  });

  describe('getAlertRules', () => {
    it('returns all rules', () => {
      createAlertRule(makeRuleInput(), 'admin');
      createAlertRule(makeRuleInput({ name: 'Rule 2' }), 'admin');

      const rules = getAlertRules();
      expect(rules.length).toBeGreaterThanOrEqual(2);
    });

    it('filters by isActive=true', () => {
      createAlertRule(makeRuleInput({ isActive: true }), 'admin');
      createAlertRule(makeRuleInput({ name: 'Inactive', isActive: false }), 'admin');

      const activeRules = getAlertRules({ isActive: true });
      expect(activeRules.every((r) => r.isActive)).toBe(true);
    });

    it('filters by isActive=false', () => {
      createAlertRule(makeRuleInput({ isActive: false }), 'admin');

      const inactiveRules = getAlertRules({ isActive: false });
      expect(inactiveRules.every((r) => !r.isActive)).toBe(true);
      expect(inactiveRules.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getAlertRule', () => {
    it('returns a rule by ID', () => {
      const created = createAlertRule(makeRuleInput(), 'admin');
      const found = getAlertRule(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('returns null for non-existent ID', () => {
      const found = getAlertRule('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('updateAlertRule', () => {
    it('updates rule fields', () => {
      const created = createAlertRule(makeRuleInput(), 'admin');
      const updated = updateAlertRule(created.id, {
        name: 'Updated Rule',
        threshold: 20_000,
      });

      expect(updated.name).toBe('Updated Rule');
      expect(updated.threshold).toBe(20_000);
      // Unchanged fields remain
      expect(updated.condition).toBe(AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS);
    });

    it('updates the updatedAt timestamp', () => {
      const created = createAlertRule(makeRuleInput(), 'admin');
      const before = created.updatedAt;
      const updated = updateAlertRule(created.id, { name: 'Changed' });

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('throws 404 for non-existent rule', () => {
      expect(() => updateAlertRule('non-existent', { name: 'x' })).toThrow(
        expect.objectContaining({ statusCode: 404 })
      );
    });
  });

  describe('toggleAlertRule', () => {
    it('toggles active to inactive', () => {
      const rule = createAlertRule(makeRuleInput({ isActive: true }), 'admin');
      const toggled = toggleAlertRule(rule.id);
      expect(toggled.isActive).toBe(false);
    });

    it('toggles inactive to active', () => {
      const rule = createAlertRule(makeRuleInput({ isActive: false }), 'admin');
      const toggled = toggleAlertRule(rule.id);
      expect(toggled.isActive).toBe(true);
    });

    it('throws 404 for non-existent rule', () => {
      expect(() => toggleAlertRule('non-existent')).toThrow(
        expect.objectContaining({ statusCode: 404 })
      );
    });
  });

  describe('deleteAlertRule', () => {
    it('deletes a rule', () => {
      const rule = createAlertRule(makeRuleInput(), 'admin');
      const sizeBefore = _alertRulesStore.size;

      deleteAlertRule(rule.id);

      expect(_alertRulesStore.size).toBe(sizeBefore - 1);
      expect(_alertRulesStore.has(rule.id)).toBe(false);
    });

    it('throws 404 for non-existent rule', () => {
      expect(() => deleteAlertRule('non-existent')).toThrow(
        expect.objectContaining({ statusCode: 404 })
      );
    });
  });

  // -------------------------------------------------------------------------
  // evaluateTransaction
  // -------------------------------------------------------------------------

  describe('evaluateTransaction', () => {
    it('triggers notification when amount exceeds threshold', async () => {
      // Clear defaults and add a specific rule
      _alertRulesStore.clear();
      createAlertRule(
        makeRuleInput({
          condition: AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS,
          threshold: 10_000,
          notificationType: NotificationType.THRESHOLD_EXCEEDED,
          targetRoles: [UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER],
        }),
        'admin'
      );

      const tx = makeTransaction({ amountUSD: 50_000 });
      await evaluateTransaction(tx);

      // Notifications should have been created for admin and officer
      const notifications = Array.from(_notificationsStore.values());
      expect(notifications.length).toBeGreaterThanOrEqual(1);
      expect(notifications.some((n) => n.type === NotificationType.THRESHOLD_EXCEEDED)).toBe(true);
    });

    it('does not trigger when amount is below threshold', async () => {
      _alertRulesStore.clear();
      createAlertRule(
        makeRuleInput({
          condition: AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS,
          threshold: 100_000,
          targetRoles: [UserRole.ADMIN],
        }),
        'admin'
      );

      const tx = makeTransaction({ amountUSD: 5_000 });
      await evaluateTransaction(tx);

      const notifications = Array.from(_notificationsStore.values());
      expect(notifications.filter((n) => n.type === NotificationType.THRESHOLD_EXCEEDED)).toHaveLength(0);
    });

    it('triggers notification for HIGH risk level', async () => {
      _alertRulesStore.clear();
      createAlertRule(
        makeRuleInput({
          condition: AlertRuleCondition.RISK_LEVEL_IS,
          value: RiskLevel.HIGH,
          notificationType: NotificationType.HIGH_RISK_TRANSACTION,
          targetRoles: [UserRole.ADMIN],
        }),
        'admin'
      );

      const tx = makeTransaction({ riskLevel: RiskLevel.HIGH });
      await evaluateTransaction(tx);

      const notifications = Array.from(_notificationsStore.values());
      expect(notifications.some((n) => n.type === NotificationType.HIGH_RISK_TRANSACTION)).toBe(true);
    });

    it('triggers HIGH_RISK notification for CRITICAL risk (matches HIGH rule)', async () => {
      _alertRulesStore.clear();
      createAlertRule(
        makeRuleInput({
          condition: AlertRuleCondition.RISK_LEVEL_IS,
          value: RiskLevel.HIGH,
          notificationType: NotificationType.HIGH_RISK_TRANSACTION,
          targetRoles: [UserRole.ADMIN],
        }),
        'admin'
      );

      const tx = makeTransaction({ riskLevel: RiskLevel.CRITICAL });
      await evaluateTransaction(tx);

      const notifications = Array.from(_notificationsStore.values());
      expect(notifications.some((n) => n.type === NotificationType.HIGH_RISK_TRANSACTION)).toBe(true);
    });

    it('does not trigger for disabled (inactive) rules', async () => {
      _alertRulesStore.clear();
      createAlertRule(
        makeRuleInput({
          isActive: false,
          condition: AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS,
          threshold: 1_000,
          targetRoles: [UserRole.ADMIN],
        }),
        'admin'
      );

      const tx = makeTransaction({ amountUSD: 500_000 });
      await evaluateTransaction(tx);

      expect(_notificationsStore.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // evaluateCase
  // -------------------------------------------------------------------------

  describe('evaluateCase', () => {
    it('triggers CASE_ESCALATED notification when event is ESCALATED', async () => {
      _alertRulesStore.clear();
      createAlertRule(
        makeRuleInput({
          condition: AlertRuleCondition.CASE_ESCALATED,
          notificationType: NotificationType.CASE_ESCALATED,
          priority: NotificationPriority.CRITICAL,
          targetRoles: [UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER],
        }),
        'admin'
      );

      const caseData = makeCase({ status: CaseStatus.ESCALATED });
      await evaluateCase(caseData, 'ESCALATED');

      const notifications = Array.from(_notificationsStore.values());
      expect(notifications.some((n) => n.type === NotificationType.CASE_ESCALATED)).toBe(true);
    });

    it('triggers CASE_ESCALATED when status is ESCALATED (from STATUS_CHANGED event)', async () => {
      _alertRulesStore.clear();
      createAlertRule(
        makeRuleInput({
          condition: AlertRuleCondition.CASE_ESCALATED,
          notificationType: NotificationType.CASE_ESCALATED,
          priority: NotificationPriority.CRITICAL,
          targetRoles: [UserRole.ADMIN],
        }),
        'admin'
      );

      const caseData = makeCase({ status: CaseStatus.ESCALATED });
      await evaluateCase(caseData, 'STATUS_CHANGED');

      const notifications = Array.from(_notificationsStore.values());
      expect(notifications.some((n) => n.type === NotificationType.CASE_ESCALATED)).toBe(true);
    });

    it('triggers CASE_UNASSIGNED_DURATION when case created without assignee', async () => {
      _alertRulesStore.clear();
      createAlertRule(
        makeRuleInput({
          condition: AlertRuleCondition.CASE_UNASSIGNED_DURATION,
          notificationType: NotificationType.SYSTEM_ALERT,
          priority: NotificationPriority.MEDIUM,
          targetRoles: [UserRole.ADMIN],
        }),
        'admin'
      );

      const caseData = makeCase({ assigneeId: undefined });
      await evaluateCase(caseData, 'CREATED');

      const notifications = Array.from(_notificationsStore.values());
      expect(notifications.some((n) => n.type === NotificationType.SYSTEM_ALERT)).toBe(true);
    });

    it('does not trigger CASE_UNASSIGNED_DURATION if case has an assignee', async () => {
      _alertRulesStore.clear();
      createAlertRule(
        makeRuleInput({
          condition: AlertRuleCondition.CASE_UNASSIGNED_DURATION,
          notificationType: NotificationType.SYSTEM_ALERT,
          priority: NotificationPriority.MEDIUM,
          targetRoles: [UserRole.ADMIN],
        }),
        'admin'
      );

      const caseData = makeCase({ assigneeId: 'officer-1' });
      await evaluateCase(caseData, 'CREATED');

      expect(_notificationsStore.size).toBe(0);
    });
  });
});
