import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesApi } from '../api/cases';
import {
  Case,
  CaseStatus,
  CasePriority,
  CaseCategory,
  CaseDashboardMetrics,
  CreateCaseRequest,
} from '../types';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';
import { ApiResponse } from '../types';

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const cls: Record<CaseStatus, string> = {
    [CaseStatus.OPEN]: 'badge-case-open',
    [CaseStatus.IN_PROGRESS]: 'badge-case-inprogress',
    [CaseStatus.ESCALATED]: 'badge-case-escalated',
    [CaseStatus.RESOLVED]: 'badge-case-resolved',
    [CaseStatus.CLOSED]: 'badge-case-closed',
  };
  return (
    <span className={`badge ${cls[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function CasePriorityBadge({ priority }: { priority: CasePriority }) {
  const cls: Record<CasePriority, string> = {
    [CasePriority.LOW]: 'badge-priority-low',
    [CasePriority.MEDIUM]: 'badge-priority-medium',
    [CasePriority.HIGH]: 'badge-priority-high',
    [CasePriority.CRITICAL]: 'badge-priority-critical',
  };
  return <span className={`badge ${cls[priority]}`}>{priority}</span>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Cases() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [metrics, setMetrics] = useState<CaseDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 20;

  // New case form
  const [form, setForm] = useState<CreateCaseRequest>({
    title: '',
    description: '',
    priority: CasePriority.MEDIUM,
    category: CaseCategory.MANUAL_REVIEW,
    transactionIds: [],
    walletAddresses: [],
    riskScore: 0,
  });

  const fetchData = async (p = page) => {
    setLoading(true);
    try {
      const [casesRes, metricsRes] = await Promise.all([
        casesApi.getCases({
          status: filterStatus ? (filterStatus as CaseStatus) : undefined,
          priority: filterPriority ? (filterPriority as CasePriority) : undefined,
          category: filterCategory ? (filterCategory as CaseCategory) : undefined,
          page: p,
          pageSize: PAGE_SIZE,
        }),
        casesApi.getCaseDashboard(),
      ]);
      setCases(casesRes.data.data ?? []);
      setTotalPages(casesRes.data.meta?.totalPages ?? 1);
      setMetrics(metricsRes.data.data ?? null);
    } catch {
      setToast({ message: 'Failed to load cases.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterPriority, filterCategory, page]);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await casesApi.createCase({
        ...form,
        riskScore: Number(form.riskScore),
      });
      setToast({ message: 'Case created successfully.', type: 'success' });
      setShowModal(false);
      setForm({
        title: '',
        description: '',
        priority: CasePriority.MEDIUM,
        category: CaseCategory.MANUAL_REVIEW,
        transactionIds: [],
        walletAddresses: [],
        riskScore: 0,
      });
      fetchData(1);
      setPage(1);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message: axiosErr.response?.data?.error?.message ?? 'Failed to create case.',
        type: 'error',
      });
    }
  };

  const filteredCases = cases.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.caseNumber.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Cases</h1>
          <p className="page-subtitle">Manage compliance cases and investigations</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Case
        </button>
      </div>

      {/* Metrics cards */}
      {metrics && (
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stats-card">
            <div className="stats-card-value">{metrics.totalCases}</div>
            <div className="stats-card-title">Total Cases</div>
          </div>
          <div className="stats-card">
            <div className="stats-card-value" style={{ color: '#3b82f6' }}>
              {metrics.openCases}
            </div>
            <div className="stats-card-title">Open</div>
          </div>
          <div className="stats-card">
            <div className="stats-card-value" style={{ color: '#f59e0b' }}>
              {metrics.inProgressCases}
            </div>
            <div className="stats-card-title">In Progress</div>
          </div>
          <div className="stats-card">
            <div className="stats-card-value" style={{ color: '#ef4444' }}>
              {metrics.escalatedCases}
            </div>
            <div className="stats-card-title">Escalated</div>
          </div>
          <div className="stats-card">
            <div className="stats-card-value" style={{ color: '#ef4444' }}>
              {metrics.criticalPriorityCases}
            </div>
            <div className="stats-card-title">Critical Priority</div>
          </div>
          <div className="stats-card">
            <div className="stats-card-value">
              {metrics.averageResolutionTimeHours.toFixed(1)}h
            </div>
            <div className="stats-card-title">Avg Resolution Time</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label>Search</label>
            <input
              className="form-control"
              placeholder="Case number or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              className="form-control"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              {Object.values(CaseStatus).map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select
              className="form-control"
              value={filterPriority}
              onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }}
            >
              <option value="">All Priorities</option>
              {Object.values(CasePriority).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Category</label>
            <select
              className="form-control"
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
            >
              <option value="">All Categories</option>
              {Object.values(CaseCategory).map((c) => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-row">
          <div className="spinner" />
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="empty-state">
          No cases found.{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(true)}>
            Create one
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Case #</th>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Category</th>
                <th>Risk Score</th>
                <th>Assigned To</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c) => (
                <tr
                  key={c.id}
                  className="clickable-row"
                  onClick={() => navigate(`/cases/${c.id}`)}
                >
                  <td className="monospace">{c.caseNumber}</td>
                  <td>{c.title}</td>
                  <td><CaseStatusBadge status={c.status} /></td>
                  <td><CasePriorityBadge priority={c.priority} /></td>
                  <td>
                    <span className="badge accent-default">
                      {c.category.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>{c.riskScore}</td>
                  <td>{c.assignedTo ?? '—'}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* New Case Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Case</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Title</label>
                <input
                  name="title"
                  className="form-control"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="Case title"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  className="form-control"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Describe the case…"
                  rows={3}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    name="priority"
                    className="form-control"
                    value={form.priority}
                    onChange={handleFormChange}
                  >
                    {Object.values(CasePriority).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    name="category"
                    className="form-control"
                    value={form.category}
                    onChange={handleFormChange}
                  >
                    {Object.values(CaseCategory).map((c) => (
                      <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Risk Score (0–100)</label>
                  <input
                    name="riskScore"
                    type="number"
                    min={0}
                    max={100}
                    className="form-control"
                    value={form.riskScore}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="form-group">
                  <label>Assign To (user ID)</label>
                  <input
                    name="assignedTo"
                    className="form-control"
                    value={form.assignedTo ?? ''}
                    onChange={handleFormChange}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
