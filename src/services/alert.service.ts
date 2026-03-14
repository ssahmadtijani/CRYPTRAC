/**
 * Alert Rules Service for CRYPTRAC
 * Manages configurable alert rules that trigger notifications
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AlertRule,
  AlertRuleCondition,
  NotificationType,
  NotificationPriority,
  UserRole,
  Transaction,
  Case,
  CaseStatus,
  RiskLevel,
  ComplianceStatus,
} from '../types';
import { CreateAlertRuleInput, UpdateAlertRuleInput } from '../validators/schemas';
import { logger } from '../utils/logger';
import { broadcastToRoles } from './notification.service';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const alertRules = new Map<string, AlertRule>();
let defaultsSeeded = false;

// ---------------------------------------------------------------------------
// Default rules
// ---------------------------------------------------------------------------

export function getDefaultRules(): Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>[] {
  return [
    {
      name: 'SAR Threshold Exceeded',
      description: 'Triggers when a transaction amount exceeds the SAR reporting threshold of $10,000 USD.',
      condition: AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS,
      threshold: 10_000,
      notificationType: NotificationType.THRESHOLD_EXCEEDED,
      priority: NotificationPriority.HIGH,
      targetRoles: [UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN],
      isActive: true,
      createdBy: 'SYSTEM',
    },
    {
      name: 'High Risk Transaction',
      description: 'Triggers when a transaction is scored HIGH or CRITICAL risk.',
      condition: AlertRuleCondition.RISK_LEVEL_IS,
      value: RiskLevel.HIGH,
      notificationType: NotificationType.HIGH_RISK_TRANSACTION,
      priority: NotificationPriority.HIGH,
      targetRoles: [UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN, UserRole.ANALYST],
      isActive: true,
      createdBy: 'SYSTEM',
    },
    {
      name: 'Sanctions Hit',
      description: 'Triggers when a transaction involves a sanctioned address.',
      condition: AlertRuleCondition.SANCTIONS_HIT,
      notificationType: NotificationType.SANCTIONS_HIT,
      priority: NotificationPriority.CRITICAL,
      targetRoles: [UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN],
      isActive: true,
      createdBy: 'SYSTEM',
    },
    {
      name: 'Case Escalation',
      description: 'Triggers when a case is escalated requiring immediate attention.',
      condition: AlertRuleCondition.CASE_ESCALATED,
      notificationType: NotificationType.CASE_ESCALATED,
      priority: NotificationPriority.CRITICAL,
      targetRoles: [UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN],
      isActive: true,
      createdBy: 'SYSTEM',
    },
  ];
}

/**
 * Seeds default alert rules on first access.
 */
function ensureDefaultsSeeded(): void {
  if (defaultsSeeded) return;
  defaultsSeeded = true;

  const now = new Date();
  for (const rule of getDefaultRules()) {
    const id = uuidv4();
    alertRules.set(id, { ...rule, id, createdAt: now, updatedAt: now });
  }

  logger.info('Default alert rules seeded', { count: alertRules.size });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new alert rule.
 */
export function createAlertRule(data: CreateAlertRuleInput, createdBy: string): AlertRule {
  ensureDefaultsSeeded();

  const now = new Date();
  const rule: AlertRule = {
    id: uuidv4(),
    name: data.name,
    description: data.description,
    condition: data.condition,
    threshold: data.threshold,
    value: data.value,
    notificationType: data.notificationType,
    priority: data.priority,
    targetRoles: data.targetRoles as UserRole[],
    isActive: data.isActive ?? true,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  alertRules.set(rule.id, rule);

  logger.info('Alert rule created', { ruleId: rule.id, name: rule.name, createdBy });

  return rule;
}

/**
 * Returns all alert rules, optionally filtered by active state.
 */
export function getAlertRules(filter?: { isActive?: boolean }): AlertRule[] {
  ensureDefaultsSeeded();

  let results = Array.from(alertRules.values());
  if (filter?.isActive !== undefined) {
    results = results.filter((r) => r.isActive === filter.isActive);
  }
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Returns a single alert rule by ID.
 */
export function getAlertRule(id: string): AlertRule | null {
  ensureDefaultsSeeded();
  return alertRules.get(id) ?? null;
}

/**
 * Updates an alert rule.
 */
export function updateAlertRule(id: string, data: UpdateAlertRuleInput): AlertRule {
  ensureDefaultsSeeded();

  const existing = alertRules.get(id);
  if (!existing) {
    const err = new Error(`Alert rule not found: ${id}`) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const updated: AlertRule = {
    ...existing,
    ...(data.name !== undefined && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.condition !== undefined && { condition: data.condition }),
    ...(data.threshold !== undefined && { threshold: data.threshold }),
    ...(data.value !== undefined && { value: data.value }),
    ...(data.notificationType !== undefined && { notificationType: data.notificationType }),
    ...(data.priority !== undefined && { priority: data.priority }),
    ...(data.targetRoles !== undefined && { targetRoles: data.targetRoles as UserRole[] }),
    ...(data.isActive !== undefined && { isActive: data.isActive }),
    updatedAt: new Date(),
  };

  alertRules.set(id, updated);

  logger.info('Alert rule updated', { ruleId: id });

  return updated;
}

/**
 * Toggles the active state of an alert rule.
 */
export function toggleAlertRule(id: string): AlertRule {
  ensureDefaultsSeeded();

  const existing = alertRules.get(id);
  if (!existing) {
    const err = new Error(`Alert rule not found: ${id}`) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  const updated: AlertRule = {
    ...existing,
    isActive: !existing.isActive,
    updatedAt: new Date(),
  };

  alertRules.set(id, updated);

  logger.info('Alert rule toggled', { ruleId: id, isActive: updated.isActive });

  return updated;
}

/**
 * Deletes an alert rule.
 */
export function deleteAlertRule(id: string): void {
  ensureDefaultsSeeded();

  if (!alertRules.has(id)) {
    const err = new Error(`Alert rule not found: ${id}`) as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  alertRules.delete(id);
  logger.info('Alert rule deleted', { ruleId: id });
}

/**
 * Evaluates a transaction against all active alert rules and fires notifications.
 */
export async function evaluateTransaction(transaction: Transaction): Promise<void> {
  ensureDefaultsSeeded();

  const activeRules = Array.from(alertRules.values()).filter((r) => r.isActive);

  for (const rule of activeRules) {
    try {
      let matches = false;

      switch (rule.condition) {
        case AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS:
          matches =
            rule.threshold !== undefined && transaction.amountUSD > rule.threshold;
          break;

        case AlertRuleCondition.RISK_LEVEL_IS:
          matches =
            rule.value !== undefined &&
            (transaction.riskLevel === rule.value ||
              // Also match CRITICAL when rule targets HIGH
              (rule.value === RiskLevel.HIGH && transaction.riskLevel === RiskLevel.CRITICAL));
          break;

        case AlertRuleCondition.COMPLIANCE_STATUS_IS:
          matches =
            rule.value !== undefined &&
            transaction.complianceStatus === (rule.value as ComplianceStatus);
          break;

        case AlertRuleCondition.SANCTIONS_HIT:
          // Detected externally — this rule is triggered via evaluateCase
          matches = false;
          break;

        default:
          matches = false;
      }

      if (matches) {
        await broadcastToRoles(rule.targetRoles, {
          type: rule.notificationType,
          priority: rule.priority,
          title: rule.name,
          message: buildTransactionMessage(rule, transaction),
          referenceId: transaction.id,
          referenceType: 'TRANSACTION',
        });

        logger.info('Alert rule triggered for transaction', {
          ruleId: rule.id,
          ruleName: rule.name,
          transactionId: transaction.id,
        });
      }
    } catch (err) {
      logger.error('Error evaluating alert rule for transaction', {
        ruleId: rule.id,
        transactionId: transaction.id,
        error: err,
      });
    }
  }
}

/**
 * Evaluates case events against active alert rules and fires notifications.
 */
export async function evaluateCase(
  caseData: Case,
  event: 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'NOTE_ADDED' | 'ESCALATED'
): Promise<void> {
  ensureDefaultsSeeded();

  const activeRules = Array.from(alertRules.values()).filter((r) => r.isActive);

  for (const rule of activeRules) {
    try {
      let matches = false;

      switch (rule.condition) {
        case AlertRuleCondition.CASE_ESCALATED:
          matches =
            event === 'ESCALATED' || caseData.status === CaseStatus.ESCALATED;
          break;

        case AlertRuleCondition.CASE_UNASSIGNED_DURATION:
          matches = event === 'CREATED' && !caseData.assigneeId;
          break;

        default:
          matches = false;
      }

      if (matches) {
        await broadcastToRoles(rule.targetRoles, {
          type: rule.notificationType,
          priority: rule.priority,
          title: rule.name,
          message: buildCaseMessage(rule, caseData, event),
          referenceId: caseData.id,
          referenceType: 'CASE',
        });

        logger.info('Alert rule triggered for case', {
          ruleId: rule.id,
          ruleName: rule.name,
          caseId: caseData.id,
          event,
        });
      }
    } catch (err) {
      logger.error('Error evaluating alert rule for case', {
        ruleId: rule.id,
        caseId: caseData.id,
        error: err,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

function buildTransactionMessage(rule: AlertRule, tx: Transaction): string {
  switch (rule.condition) {
    case AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS:
      return (
        `Transaction ${tx.txHash || tx.id} of $${tx.amountUSD.toLocaleString()} USD ` +
        `exceeded the threshold of $${rule.threshold?.toLocaleString()} USD. ` +
        `Risk level: ${tx.riskLevel}.`
      );
    case AlertRuleCondition.RISK_LEVEL_IS:
      return (
        `Transaction ${tx.txHash || tx.id} has been scored ${tx.riskLevel} risk ` +
        `(score: ${tx.riskScore}). Amount: $${tx.amountUSD.toLocaleString()} USD on ${tx.network}.`
      );
    case AlertRuleCondition.COMPLIANCE_STATUS_IS:
      return (
        `Transaction ${tx.txHash || tx.id} compliance status is ${tx.complianceStatus}. ` +
        `Amount: $${tx.amountUSD.toLocaleString()} USD.`
      );
    default:
      return `Alert triggered for transaction ${tx.id}.`;
  }
}

function buildCaseMessage(rule: AlertRule, c: Case, event: string): string {
  switch (rule.condition) {
    case AlertRuleCondition.CASE_ESCALATED:
      return (
        `Case ${c.caseNumber} has been escalated. ` +
        `Category: ${c.category}. Priority: ${c.priority}.`
      );
    case AlertRuleCondition.CASE_UNASSIGNED_DURATION:
      return (
        `Case ${c.caseNumber} was created without an assignee. ` +
        `Please assign it to a compliance officer.`
      );
    default:
      return `Alert triggered for case ${c.caseNumber} — event: ${event}.`;
  }
}

// Exported for testing
export { alertRules as _alertRulesStore, defaultsSeeded as _defaultsSeeded };
