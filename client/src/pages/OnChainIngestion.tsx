import { useEffect, useState, FormEvent } from 'react';
import { ingestionApi, BlockSyncState, WatchedAddress } from '../api/ingestion';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';
import { ApiResponse } from '../types';

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ isRunning }: { isRunning: boolean }) {
  return (
    <span className={`badge ${isRunning ? 'status-badge-active' : 'status-badge-suspended'}`}>
      {isRunning ? 'Running' : 'Stopped'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add Address Modal
// ---------------------------------------------------------------------------

interface AddAddressForm {
  address: string;
  label: string;
  network: string;
}

function AddAddressModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState<AddAddressForm>({ address: '', label: '', network: 'ethereum' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await ingestionApi.addWatchedAddress({
        address: form.address,
        label: form.label || undefined,
        network: form.network || undefined,
      });
      onAdded();
      onClose();
    } catch (err) {
      const ax = err as AxiosError<ApiResponse<unknown>>;
      setError(ax.response?.data?.error?.message ?? 'Failed to add address');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3>Add Watched Address</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Wallet Address</label>
            <input
              className="form-control"
              placeholder="0x…"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Label (optional)</label>
              <input
                className="form-control"
                placeholder="e.g. Exchange Hot Wallet"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Network</label>
              <select
                className="form-control"
                value={form.network}
                onChange={(e) => setForm({ ...form, network: e.target.value })}
              >
                <option value="ethereum">Ethereum</option>
                <option value="polygon">Polygon</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="optimism">Optimism</option>
                <option value="base">Base</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function OnChainIngestion() {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;
  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.COMPLIANCE_OFFICER;

  const [status, setStatus] = useState<BlockSyncState | null>(null);
  const [addresses, setAddresses] = useState<WatchedAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [statusRes, addressesRes] = await Promise.all([
        ingestionApi.getStatus(),
        ingestionApi.getWatchedAddresses(),
      ]);
      setStatus(statusRes.data.data ?? null);
      setAddresses(addressesRes.data.data ?? []);
    } catch {
      setToast({ message: 'Failed to load ingestion data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // Auto-refresh status every 15 seconds only when ingestion is running
    const interval = setInterval(() => {
      ingestionApi.getStatus()
        .then((res) => {
          const s = res.data.data ?? null;
          setStatus(s);
          // Stop polling if ingestion has stopped
          if (!s?.isRunning) clearInterval(interval);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleStart() {
    setActionLoading(true);
    try {
      const res = await ingestionApi.start();
      setStatus(res.data.data ?? null);
      setToast({ message: 'Ingestion started successfully', type: 'success' });
    } catch (err) {
      const ax = err as AxiosError<ApiResponse<unknown>>;
      setToast({ message: ax.response?.data?.error?.message ?? 'Failed to start ingestion', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    setActionLoading(true);
    try {
      const res = await ingestionApi.stop();
      setStatus(res.data.data ?? null);
      setToast({ message: 'Ingestion stopped', type: 'success' });
    } catch (err) {
      const ax = err as AxiosError<ApiResponse<unknown>>;
      setToast({ message: ax.response?.data?.error?.message ?? 'Failed to stop ingestion', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveAddress(address: string) {
    if (!window.confirm(`Remove address ${address} from watch list?`)) return;
    try {
      await ingestionApi.removeWatchedAddress(address);
      setAddresses((prev) => prev.filter((a) => a.address !== address));
      setToast({ message: 'Address removed', type: 'success' });
    } catch {
      setToast({ message: 'Failed to remove address', type: 'error' });
    }
  }

  const syncProgress =
    status && status.targetBlock && status.lastBlock && status.targetBlock > 0
      ? Math.min(100, Math.round((status.lastBlock / status.targetBlock) * 100))
      : null;

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>On-Chain Ingestion</h1>
          <p className="text-muted">Monitor and control real-time blockchain data ingestion</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
          {isAdmin && status && !status.isRunning && (
            <button className="btn btn-primary" onClick={handleStart} disabled={actionLoading}>
              {actionLoading ? 'Starting…' : '▶ Start Ingestion'}
            </button>
          )}
          {isAdmin && status?.isRunning && (
            <button className="btn btn-warning" onClick={handleStop} disabled={actionLoading}>
              {actionLoading ? 'Stopping…' : '⏹ Stop Ingestion'}
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Card */}
      {status && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Status</div>
            <div className="stat-value">
              <StatusBadge isRunning={status.isRunning} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Network</div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>{status.network}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Last Block</div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>
              {status.lastBlock > 0 ? status.lastBlock.toLocaleString() : '—'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Target Block</div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>
              {status.targetBlock ? status.targetBlock.toLocaleString() : '—'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Watched Addresses</div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>{status.watchedAddressCount}</div>
          </div>
        </div>
      )}

      {/* Sync Progress Bar */}
      {syncProgress !== null && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Sync Progress</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{syncProgress}%</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
              <div
                style={{
                  background: status?.isRunning ? 'var(--accent)' : 'var(--text-muted)',
                  height: '100%',
                  width: `${syncProgress}%`,
                  transition: 'width 0.3s ease',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Last Error */}
      {status?.lastError && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <strong>Last Error:</strong> {status.lastError}
        </div>
      )}

      {/* Watched Addresses */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0 }}>Watched Addresses</h3>
          {canManage && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              + Add Address
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-state">Loading addresses…</div>
        ) : (
          <table className="user-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Label</th>
                <th>Network</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {addresses.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className="empty-state">
                    No addresses being watched. Add an address to start monitoring on-chain activity.
                  </td>
                </tr>
              ) : (
                addresses.map((addr) => (
                  <tr key={addr.address}>
                    <td>
                      <code style={{ fontSize: '0.8rem', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {addr.address}
                      </code>
                    </td>
                    <td>{addr.label ?? <span className="text-muted">—</span>}</td>
                    <td>
                      <span className="badge role-badge-analyst">{addr.network}</span>
                    </td>
                    {canManage && (
                      <td>
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => handleRemoveAddress(addr.address)}
                        >
                          🗑 Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Last Updated */}
      {status?.updatedAt && (
        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.75rem', textAlign: 'right' }}>
          Last updated: {new Date(status.updatedAt).toLocaleString()}
        </p>
      )}

      {showAddModal && (
        <AddAddressModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            loadData();
            setToast({ message: 'Address added to watch list', type: 'success' });
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
