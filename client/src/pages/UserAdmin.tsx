import { useEffect, useState, FormEvent } from 'react';
import { userAdminApi } from '../api/user-admin';
import { UserProfile, UserAdminStats, UserRole, UserStatus, ApiResponse } from '../types';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: UserRole }) {
  const cls: Record<UserRole, string> = {
    [UserRole.ADMIN]: 'badge role-badge-admin',
    [UserRole.COMPLIANCE_OFFICER]: 'badge role-badge-co',
    [UserRole.ANALYST]: 'badge role-badge-analyst',
    [UserRole.AUDITOR]: 'badge role-badge-auditor',
    [UserRole.USER]: 'badge role-badge-viewer',
  };
  const labels: Record<UserRole, string> = {
    [UserRole.ADMIN]: 'Admin',
    [UserRole.COMPLIANCE_OFFICER]: 'CO',
    [UserRole.ANALYST]: 'Analyst',
    [UserRole.AUDITOR]: 'Auditor',
    [UserRole.USER]: 'Viewer',
  };
  return <span className={cls[role]}>{labels[role]}</span>;
}

function StatusBadge({ status }: { status: UserStatus }) {
  const cls: Record<UserStatus, string> = {
    [UserStatus.ACTIVE]: 'badge status-badge-active',
    [UserStatus.SUSPENDED]: 'badge status-badge-suspended',
    [UserStatus.LOCKED]: 'badge status-badge-locked',
    [UserStatus.PENDING]: 'badge status-badge-pending',
    [UserStatus.DEACTIVATED]: 'badge status-badge-deactivated',
  };
  return <span className={cls[status]}>{status}</span>;
}

// ---------------------------------------------------------------------------
// Create User Modal
// ---------------------------------------------------------------------------

interface CreateUserForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department: string;
  phone: string;
}

function emptyForm(): CreateUserForm {
  return { email: '', password: '', firstName: '', lastName: '', role: UserRole.ANALYST, department: '', phone: '' };
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateUserForm>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await userAdminApi.createUser({
        ...form,
        department: form.department || undefined,
        phone: form.phone || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      const ax = err as AxiosError<ApiResponse<unknown>>;
      setError(ax.response?.data?.error?.message ?? 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3>Create New User</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input className="form-control" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input className="form-control" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-control" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Role</label>
              <select className="form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                {Object.values(UserRole).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Department</label>
              <input className="form-control" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Dropdown
// ---------------------------------------------------------------------------

function ActionDropdown({ user, onRefresh, onToast }: {
  user: UserProfile;
  onRefresh: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const [open, setOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspendInput, setShowSuspendInput] = useState(false);

  async function handle(action: () => Promise<void>, msg: string) {
    setOpen(false);
    try {
      await action();
      onToast(msg, 'success');
      onRefresh();
    } catch {
      onToast('Action failed', 'error');
    }
  }

  return (
    <div className="action-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
      <button className="btn btn-sm btn-ghost" onClick={() => setOpen(!open)}>⋮ Actions</button>
      {open && (
        <div className="action-dropdown-menu">
          {user.status !== UserStatus.ACTIVE && (
            <button onClick={() => handle(() => userAdminApi.reactivateUser(user.id).then(() => {}), 'User reactivated')}>
              ✅ Reactivate
            </button>
          )}
          {user.status === UserStatus.ACTIVE && (
            <button onClick={() => setShowSuspendInput(true)}>⏸ Suspend</button>
          )}
          {user.status !== UserStatus.LOCKED && (
            <button onClick={() => handle(() => userAdminApi.lockUser(user.id).then(() => {}), 'User locked')}>
              🔒 Lock
            </button>
          )}
          {user.status === UserStatus.LOCKED && (
            <button onClick={() => handle(() => userAdminApi.unlockUser(user.id).then(() => {}), 'User unlocked')}>
              🔓 Unlock
            </button>
          )}
          <button className="danger" onClick={() => handle(() => userAdminApi.deactivateUser(user.id).then(() => {}), 'User deactivated')}>
            ⛔ Deactivate
          </button>
          <button onClick={() => handle(() => userAdminApi.terminateAllSessions(user.id).then(() => {}), 'Sessions terminated')}>
            💻 Terminate Sessions
          </button>
        </div>
      )}
      {showSuspendInput && (
        <div className="modal-overlay" onClick={() => setShowSuspendInput(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header"><h3>Suspend User</h3><button className="modal-close" onClick={() => setShowSuspendInput(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label>Reason for suspension</label>
                <textarea className="form-control" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} rows={3} required />
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowSuspendInput(false)}>Cancel</button>
                <button className="btn btn-warning" onClick={() => {
                  setShowSuspendInput(false);
                  handle(() => userAdminApi.suspendUser(user.id, suspendReason).then(() => {}), 'User suspended');
                }}>Suspend</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function UserAdmin() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<UserAdminStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const pageSize = 20;

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        userAdminApi.getUsers({
          page,
          pageSize,
          role: roleFilter as UserRole || undefined,
          status: statusFilter as UserStatus || undefined,
          search: search || undefined,
        }),
        userAdminApi.getStats(),
      ]);
      setUsers(usersRes.data.data ?? []);
      setTotal(usersRes.data.meta?.total ?? 0);
      setStats(statsRes.data.data ?? null);
    } catch {
      setToast({ message: 'Failed to load users', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [page, roleFilter, statusFilter, search]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>User Administration</h1>
          <p className="text-muted">Manage user accounts, roles, and access</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New User</button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Users</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Today</div>
            <div className="stat-value">{stats.activeToday}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">New This Month</div>
            <div className="stat-value">{stats.newThisMonth}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label admin-indicator">Locked Accounts</div>
            <div className="stat-value">{stats.lockedAccounts}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <input
          className="form-control"
          placeholder="Search users…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: '260px' }}
        />
        <select className="form-control" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} style={{ maxWidth: '180px' }}>
          <option value="">All Roles</option>
          {Object.values(UserRole).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="form-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ maxWidth: '180px' }}>
          <option value="">All Statuses</option>
          {Object.values(UserStatus).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Users table */}
      <div className="card">
        {loading ? (
          <div className="loading-state">Loading users…</div>
        ) : (
          <table className="user-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Department</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No users found</td></tr>
              ) : users.map((user) => (
                <tr key={user.id}>
                  <td>{user.firstName} {user.lastName}</td>
                  <td>{user.email}</td>
                  <td><RoleBadge role={user.role} /></td>
                  <td><StatusBadge status={user.status} /></td>
                  <td>{user.department ?? '—'}</td>
                  <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '—'}</td>
                  <td>
                    <ActionDropdown
                      user={user}
                      onRefresh={loadData}
                      onToast={(msg, type) => setToast({ message: msg, type })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-sm btn-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-sm btn-ghost" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={loadData}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
