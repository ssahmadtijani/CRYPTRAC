import { useEffect, useState } from 'react';
import { rolePermissionApi } from '../api/role-permission';
import { Permission, UserRole, UserPermissionOverride, ApiResponse } from '../types';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';

// Group permissions into categories for better display
const PERMISSION_CATEGORIES: { label: string; permissions: Permission[] }[] = [
  { label: 'Core', permissions: [Permission.VIEW_DASHBOARD, Permission.VIEW_TRANSACTIONS, Permission.CREATE_TRANSACTION, Permission.VIEW_WALLETS, Permission.MANAGE_WALLETS] },
  { label: 'Compliance', permissions: [Permission.VIEW_COMPLIANCE, Permission.MANAGE_COMPLIANCE, Permission.VIEW_CASES, Permission.CREATE_CASES, Permission.MANAGE_CASES] },
  { label: 'Risk', permissions: [Permission.VIEW_RISK, Permission.MANAGE_RISK, Permission.VIEW_ANALYTICS, Permission.EXPORT_DATA] },
  { label: 'Audit', permissions: [Permission.VIEW_AUDIT_LOGS, Permission.VIEW_ALERTS, Permission.MANAGE_ALERT_RULES] },
  { label: 'STR/SAR', permissions: [Permission.VIEW_STR_SAR, Permission.CREATE_STR_SAR, Permission.APPROVE_STR_SAR, Permission.FILE_STR_SAR] },
  { label: 'Travel Rule', permissions: [Permission.VIEW_TRAVEL_RULE, Permission.MANAGE_TRAVEL_RULE] },
  { label: 'Filings', permissions: [Permission.VIEW_FILINGS, Permission.MANAGE_FILINGS] },
  { label: 'Tax', permissions: [Permission.VIEW_TAX, Permission.MANAGE_TAX] },
  { label: 'Admin', permissions: [Permission.VIEW_USERS, Permission.MANAGE_USERS, Permission.MANAGE_ROLES, Permission.MANAGE_SYSTEM, Permission.VIEW_SYSTEM_HEALTH] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.COMPLIANCE_OFFICER]: 'Compliance Officer',
  [UserRole.ANALYST]: 'Analyst',
  [UserRole.AUDITOR]: 'Auditor',
  [UserRole.USER]: 'Viewer',
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RoleManagement() {
  const [matrix, setMatrix] = useState<Record<UserRole, Permission[]> | null>(null);
  const [pendingMatrix, setPendingMatrix] = useState<Record<UserRole, Permission[]> | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'matrix' | 'overrides'>('matrix');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // User override section
  const [overrideUserId, setOverrideUserId] = useState('');
  const [overrideRole, setOverrideRole] = useState<UserRole>(UserRole.ANALYST);
  const [overrideData, setOverrideData] = useState<{ userId: string; permissions: Permission[]; overrides: UserPermissionOverride | null } | null>(null);
  const [grantPerm, setGrantPerm] = useState<Permission>(Permission.VIEW_DASHBOARD);

  async function loadMatrix() {
    try {
      const res = await rolePermissionApi.getAllRolePermissions();
      setMatrix(res.data.data ?? null);
      setPendingMatrix(res.data.data ? { ...res.data.data } : null);
    } catch {
      setToast({ message: 'Failed to load permissions', type: 'error' });
    }
  }

  useEffect(() => { loadMatrix(); }, []);

  function togglePermission(role: UserRole, permission: Permission) {
    if (role === UserRole.ADMIN) return; // ADMIN locked
    if (!pendingMatrix) return;
    const current = pendingMatrix[role] ?? [];
    const updated = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    setPendingMatrix({ ...pendingMatrix, [role]: updated });
  }

  async function saveMatrix() {
    if (!pendingMatrix) return;
    setSaving(true);
    try {
      for (const role of Object.values(UserRole).filter((r) => r !== UserRole.ADMIN)) {
        await rolePermissionApi.updateRolePermissions(role, pendingMatrix[role] ?? []);
      }
      setMatrix({ ...pendingMatrix });
      setToast({ message: 'Permissions saved', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save permissions', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function lookupUserPermissions() {
    if (!overrideUserId) return;
    try {
      const res = await rolePermissionApi.getUserEffectivePermissions(overrideUserId, overrideRole);
      setOverrideData(res.data.data ?? null);
    } catch {
      setToast({ message: 'Failed to load user permissions', type: 'error' });
    }
  }

  async function handleGrant() {
    if (!overrideUserId) return;
    try {
      await rolePermissionApi.grantPermission(overrideUserId, grantPerm);
      setToast({ message: `Permission ${grantPerm} granted`, type: 'success' });
      await lookupUserPermissions();
    } catch {
      setToast({ message: 'Grant failed', type: 'error' });
    }
  }

  async function handleRevoke(perm: Permission) {
    if (!overrideUserId) return;
    try {
      await rolePermissionApi.revokePermission(overrideUserId, perm);
      setToast({ message: `Permission ${perm} revoked`, type: 'success' });
      await lookupUserPermissions();
    } catch {
      setToast({ message: 'Revoke failed', type: 'error' });
    }
  }

  async function handleClearOverrides() {
    if (!overrideUserId) return;
    try {
      await rolePermissionApi.clearPermissionOverrides(overrideUserId);
      setToast({ message: 'Overrides cleared', type: 'success' });
      await lookupUserPermissions();
    } catch (err) {
      const ax = err as AxiosError<ApiResponse<unknown>>;
      setToast({ message: ax.response?.data?.error?.message ?? 'Clear failed', type: 'error' });
    }
  }

  const isDirty = JSON.stringify(matrix) !== JSON.stringify(pendingMatrix);

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Role Management</h1>
          <p className="text-muted">Configure role permissions and user-level overrides</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn${activeTab === 'matrix' ? ' active' : ''}`} onClick={() => setActiveTab('matrix')}>Permission Matrix</button>
        <button className={`tab-btn${activeTab === 'overrides' ? ' active' : ''}`} onClick={() => setActiveTab('overrides')}>User Overrides</button>
      </div>

      {activeTab === 'matrix' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Permission Matrix</h3>
            {isDirty && (
              <button className="btn btn-primary" onClick={saveMatrix} disabled={saving}>
                {saving ? 'Saving…' : '💾 Save Changes'}
              </button>
            )}
          </div>
          {pendingMatrix && (
            <table className="permission-grid">
              <thead>
                <tr>
                  <th>Permission</th>
                  {Object.values(UserRole).map((role) => (
                    <th key={role}>
                      <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>
                        {ROLE_LABELS[role]}
                        {role === UserRole.ADMIN && <span className="admin-indicator"> 🔒</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_CATEGORIES.map((cat) => (
                  <>
                    <tr key={`cat-${cat.label}`} className="category-row">
                      <td colSpan={Object.values(UserRole).length + 1} style={{ background: 'var(--surface)', fontWeight: 600, padding: '0.4rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {cat.label.toUpperCase()}
                      </td>
                    </tr>
                    {cat.permissions.map((perm) => (
                      <tr key={perm}>
                        <td className="permission-cell permission-name">{perm.replace(/_/g, ' ')}</td>
                        {Object.values(UserRole).map((role) => {
                          const checked = (pendingMatrix[role] ?? []).includes(perm);
                          const isAdmin = role === UserRole.ADMIN;
                          return (
                            <td key={role} className="permission-cell" style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isAdmin}
                                onChange={() => togglePermission(role, perm)}
                                style={{ cursor: isAdmin ? 'not-allowed' : 'pointer' }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'overrides' && (
        <div className="card">
          <div className="card-header"><h3>User Permission Overrides</h3></div>
          <div style={{ padding: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>User ID</label>
              <input className="form-control" value={overrideUserId} onChange={(e) => setOverrideUserId(e.target.value)} placeholder="Enter user ID" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>User Role</label>
              <select className="form-control" value={overrideRole} onChange={(e) => setOverrideRole(e.target.value as UserRole)}>
                {Object.values(UserRole).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={lookupUserPermissions} disabled={!overrideUserId}>
              🔍 Look Up
            </button>
          </div>

          {overrideData && (
            <div style={{ padding: '1rem' }}>
              <h4>Effective Permissions ({overrideData.permissions.length})</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                {overrideData.permissions.map((p) => (
                  <span key={p} className="badge status-badge-active" style={{ cursor: 'pointer' }} onClick={() => handleRevoke(p)} title="Click to revoke">
                    {p.replace(/_/g, ' ')} ×
                  </span>
                ))}
              </div>

              {overrideData.overrides && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4>Current Overrides</h4>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong>Granted:</strong> {overrideData.overrides.granted.length === 0 ? 'None' : overrideData.overrides.granted.map((p) => (
                        <span key={p} className="badge status-badge-active" style={{ margin: '0 0.2rem' }}>{p.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                    <div>
                      <strong>Revoked:</strong> {overrideData.overrides.revoked.length === 0 ? 'None' : overrideData.overrides.revoked.map((p) => (
                        <span key={p} className="badge status-badge-suspended" style={{ margin: '0 0.2rem' }}>{p.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Grant Permission</label>
                  <select className="form-control" value={grantPerm} onChange={(e) => setGrantPerm(e.target.value as Permission)}>
                    {Object.values(Permission).map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={handleGrant}>✅ Grant</button>
                {overrideData.overrides && (
                  <button className="btn btn-danger" onClick={handleClearOverrides}>🗑 Clear All Overrides</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
