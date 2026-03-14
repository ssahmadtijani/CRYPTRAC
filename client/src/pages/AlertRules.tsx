import { useState, useEffect } from 'react';
import { alertsApi } from '../api/notifications';
import {
  AlertRule,
  AlertRuleCondition,
  NotificationType,
  NotificationPriority,
  UserRole,
  CreateAlertRuleRequest,
} from '../types';
import { useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function conditionLabel(c: AlertRuleCondition): string {
  switch (c) {
    case AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS: return 'Transaction Amount Exceeds';
    case AlertRuleCondition.RISK_LEVEL_IS: return 'Risk Level Is';
    case AlertRuleCondition.COMPLIANCE_STATUS_IS: return 'Compliance Status Is';
    case AlertRuleCondition.SANCTIONS_HIT: return 'Sanctions Hit';
    case AlertRuleCondition.CASE_ESCALATED: return 'Case Escalated';
    case AlertRuleCondition.CASE_UNASSIGNED_DURATION: return 'Case Unassigned Duration';
    default: return c;
  }
}

function priorityColor(p: string): string {
  switch (p) {
    case 'CRITICAL': return 'var(--danger)';
    case 'HIGH': return 'var(--risk-high)';
    case 'MEDIUM': return 'var(--warning)';
    default: return 'var(--text-muted)';
  }
}

const EMPTY_FORM: CreateAlertRuleRequest = {
  name: '',
  description: '',
  condition: AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS,
  threshold: undefined,
  value: '',
  notificationType: NotificationType.THRESHOLD_EXCEEDED,
  priority: NotificationPriority.HIGH,
  targetRoles: [UserRole.COMPLIANCE_OFFICER, UserRole.ADMIN],
  isActive: true,
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AlertRulesPage() {
  const { user } = useAuth();
  const isAuthorized =
    user?.role === UserRole.ADMIN || user?.role === UserRole.COMPLIANCE_OFFICER;

  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [formData, setFormData] = useState<CreateAlertRuleRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchRules = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await alertsApi.listRules();
      setRules(res.data.data ?? []);
    } catch {
      setError('Failed to load alert rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      void fetchRules();
    }
  }, [isAuthorized]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handleToggle = async (rule: AlertRule) => {
    try {
      const res = await alertsApi.toggleRule(rule.id);
      const updated = res.data.data;
      if (updated) {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? updated : r))
        );
      }
    } catch {
      setError('Failed to toggle rule.');
    }
  };

  const handleDelete = async (rule: AlertRule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await alertsApi.deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch {
      setError('Failed to delete rule.');
    }
  };

  const openCreate = () => {
    setEditingRule(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description,
      condition: rule.condition,
      threshold: rule.threshold,
      value: rule.value ?? '',
      notificationType: rule.notificationType,
      priority: rule.priority,
      targetRoles: rule.targetRoles,
      isActive: rule.isActive,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      setFormError('Name and description are required.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (editingRule) {
        const res = await alertsApi.updateRule(editingRule.id, formData);
        const updated = res.data.data;
        if (updated) {
          setRules((prev) =>
            prev.map((r) => (r.id === editingRule.id ? updated : r))
          );
        }
      } else {
        const res = await alertsApi.createRule(formData);
        const created = res.data.data;
        if (created) {
          setRules((prev) => [created, ...prev]);
        }
      }
      setShowForm(false);
    } catch {
      setFormError('Failed to save rule. Please check all fields.');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: UserRole) => {
    const has = formData.targetRoles.includes(role);
    setFormData({
      ...formData,
      targetRoles: has
        ? formData.targetRoles.filter((r) => r !== role)
        : [...formData.targetRoles, role],
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!isAuthorized) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Alert Rules</h1>
        </div>
        <div className="alert alert-error">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Alert Rules</h1>
        <p className="page-subtitle">Configure rules that trigger compliance notifications</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '16px',
        }}
      >
        <button className="btn btn-primary" onClick={openCreate}>
          + New Rule
        </button>
      </div>

      {/* Rules list */}
      {loading ? (
        <div
          className="card"
          style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}
        >
          Loading rules…
        </div>
      ) : rules.length === 0 ? (
        <div
          className="card"
          style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}
        >
          No alert rules found. Click <strong>+ New Rule</strong> to create one.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Condition</th>
                <th>Notification</th>
                <th>Priority</th>
                <th>Target Roles</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {rule.name}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                      }}
                    >
                      {rule.description.slice(0, 80)}
                      {rule.description.length > 80 ? '…' : ''}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {conditionLabel(rule.condition)}
                      {rule.threshold !== undefined && (
                        <span style={{ color: 'var(--accent)' }}>
                          {' '}
                          ${rule.threshold.toLocaleString()}
                        </span>
                      )}
                      {rule.value && (
                        <span style={{ color: 'var(--accent)' }}> {rule.value}</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {rule.notificationType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '12px',
                        color: priorityColor(rule.priority),
                      }}
                    >
                      {rule.priority}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {rule.targetRoles.map((r) => (
                        <span
                          key={r}
                          style={{
                            background: 'var(--bg-hover)',
                            color: 'var(--text-secondary)',
                            borderRadius: '3px',
                            padding: '1px 6px',
                            fontSize: '11px',
                          }}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {/* Toggle switch */}
                    <button
                      onClick={() => void handleToggle(rule)}
                      style={{
                        background: rule.isActive ? 'var(--success)' : 'var(--bg-hover)',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '4px 12px',
                        cursor: 'pointer',
                        color: rule.isActive ? '#fff' : 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: 600,
                        transition: 'background var(--transition)',
                      }}
                    >
                      {rule.isActive ? 'ON' : 'OFF'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => openEdit(rule)}
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => void handleDelete(rule)}
                        style={{
                          fontSize: '12px',
                          padding: '4px 10px',
                          color: 'var(--danger)',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
            }}
          >
            <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>
              {editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}
            </h3>

            {formError && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Name */}
              <div>
                <label className="label">Name *</label>
                <input
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Rule name"
                />
              </div>

              {/* Description */}
              <div>
                <label className="label">Description *</label>
                <textarea
                  className="input"
                  rows={2}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe when this rule triggers"
                />
              </div>

              {/* Condition */}
              <div>
                <label className="label">Condition</label>
                <select
                  className="input"
                  value={formData.condition}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      condition: e.target.value as AlertRuleCondition,
                    })
                  }
                >
                  {Object.values(AlertRuleCondition).map((c) => (
                    <option key={c} value={c}>
                      {conditionLabel(c)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Threshold (for TRANSACTION_AMOUNT_EXCEEDS) */}
              {formData.condition === AlertRuleCondition.TRANSACTION_AMOUNT_EXCEEDS && (
                <div>
                  <label className="label">Threshold (USD)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={formData.threshold ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        threshold: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="e.g. 10000"
                  />
                </div>
              )}

              {/* Value (for RISK_LEVEL_IS, COMPLIANCE_STATUS_IS) */}
              {(formData.condition === AlertRuleCondition.RISK_LEVEL_IS ||
                formData.condition === AlertRuleCondition.COMPLIANCE_STATUS_IS) && (
                <div>
                  <label className="label">Value</label>
                  <input
                    className="input"
                    value={formData.value ?? ''}
                    onChange={(e) =>
                      setFormData({ ...formData, value: e.target.value })
                    }
                    placeholder={
                      formData.condition === AlertRuleCondition.RISK_LEVEL_IS
                        ? 'e.g. HIGH or CRITICAL'
                        : 'e.g. FLAGGED or PENDING'
                    }
                  />
                </div>
              )}

              {/* Notification Type */}
              <div>
                <label className="label">Notification Type</label>
                <select
                  className="input"
                  value={formData.notificationType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      notificationType: e.target.value as NotificationType,
                    })
                  }
                >
                  {Object.values(NotificationType).map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="label">Priority</label>
                <select
                  className="input"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value as NotificationPriority,
                    })
                  }
                >
                  {Object.values(NotificationPriority).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Roles */}
              <div>
                <label className="label">Target Roles</label>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {Object.values(UserRole).map((role) => (
                    <label
                      key={role}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: formData.targetRoles.includes(role)
                          ? 'var(--accent-glow)'
                          : 'transparent',
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.targetRoles.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      {role}
                    </label>
                  ))}
                </div>
              </div>

              {/* Active */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.isActive ?? true}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                />
                Active (rule will trigger notifications)
              </label>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '24px',
              }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Saving…' : editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
