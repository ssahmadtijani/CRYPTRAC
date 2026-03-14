import { useEffect, useState, FormEvent } from 'react';
import { strSarApi } from '../api/str-sar';
import {
  STRSARReport,
  STRSARStats,
  STRSARType,
  STRSARStatus,
  SuspicionCategory,
} from '../types';
import StatsCard from '../components/StatsCard';
import Toast from '../components/Toast';
import ExportButton from '../components/ExportButton';
import { AxiosError } from 'axios';
import { ApiResponse } from '../types';

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function STRSARStatusBadge({ status }: { status: STRSARStatus }) {
  const cls: Record<STRSARStatus, string> = {
    [STRSARStatus.DRAFT]: 'badge str-sar-badge-draft',
    [STRSARStatus.UNDER_REVIEW]: 'badge str-sar-badge-under-review',
    [STRSARStatus.APPROVED]: 'badge str-sar-badge-approved',
    [STRSARStatus.FILED]: 'badge str-sar-badge-filed',
    [STRSARStatus.ACKNOWLEDGED]: 'badge str-sar-badge-acknowledged',
    [STRSARStatus.REJECTED]: 'badge str-sar-badge-rejected',
    [STRSARStatus.AMENDED]: 'badge str-sar-badge-amended',
  };
  return <span className={cls[status]}>{status.replace('_', ' ')}</span>;
}

function TypeBadge({ type }: { type: STRSARType }) {
  const colors: Record<STRSARType, string> = {
    [STRSARType.STR]: 'badge badge-warning',
    [STRSARType.SAR]: 'badge badge-danger',
    [STRSARType.CTR]: 'badge badge-info',
  };
  return <span className={colors[type]}>{type}</span>;
}


// ---------------------------------------------------------------------------
// Default form state
// ---------------------------------------------------------------------------

interface CreateForm {
  type: STRSARType;
  subjectName: string;
  subjectWalletAddresses: string[];
  walletInput: string;
  suspicionCategories: SuspicionCategory[];
  narrativeSummary: string;
  indicatorsOfSuspicion: string[];
  indicatorInput: string;
  linkedTransactionIds: string;
  linkedCaseIds: string;
  totalAmountUSD: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  regulatoryAuthority: string;
  subjectCountry: string;
}

function emptyForm(): CreateForm {
  return {
    type: STRSARType.STR,
    subjectName: '',
    subjectWalletAddresses: [],
    walletInput: '',
    suspicionCategories: [],
    narrativeSummary: '',
    indicatorsOfSuspicion: [],
    indicatorInput: '',
    linkedTransactionIds: '',
    linkedCaseIds: '',
    totalAmountUSD: '',
    dateRangeStart: '',
    dateRangeEnd: '',
    regulatoryAuthority: 'NFIU',
    subjectCountry: '',
  };
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function STRSARReports() {
  const [reports, setReports] = useState<STRSARReport[]>([]);
  const [stats, setStats] = useState<STRSARStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAutoGenModal, setShowAutoGenModal] = useState(false);
  const [autoGenTxIds, setAutoGenTxIds] = useState('');
  const [autoGenCaseId, setAutoGenCaseId] = useState('');

  // Review modals
  const [reviewAction, setReviewAction] = useState<{ id: string; action: 'approve' | 'reject' | 'amend' } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const [form, setForm] = useState<CreateForm>(emptyForm());

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async (p = page) => {
    setLoading(true);
    try {
      const [reportsRes, statsRes] = await Promise.all([
        strSarApi.getReports({
          type: filterType as STRSARType || undefined,
          status: filterStatus as STRSARStatus || undefined,
          suspicionCategory: filterCategory as SuspicionCategory || undefined,
          page: p,
          pageSize: PAGE_SIZE,
        }),
        strSarApi.getStats(),
      ]);
      setReports(reportsRes.data.data);
      setTotal(reportsRes.data.total);
      setStats(statsRes.data.data ?? null);
    } catch {
      showToast('Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterStatus, filterCategory]);

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        type: form.type,
        subjectName: form.subjectName,
        subjectWalletAddresses: form.subjectWalletAddresses,
        suspicionCategories: form.suspicionCategories,
        narrativeSummary: form.narrativeSummary,
        indicatorsOfSuspicion: form.indicatorsOfSuspicion,
        linkedTransactionIds: form.linkedTransactionIds ? form.linkedTransactionIds.split(',').map((s) => s.trim()).filter(Boolean) : [],
        linkedCaseIds: form.linkedCaseIds ? form.linkedCaseIds.split(',').map((s) => s.trim()).filter(Boolean) : [],
        totalAmountUSD: parseFloat(form.totalAmountUSD),
        dateRangeStart: form.dateRangeStart,
        dateRangeEnd: form.dateRangeEnd,
        regulatoryAuthority: form.regulatoryAuthority,
        subjectCountry: form.subjectCountry,
      };

      if (editingId) {
        await strSarApi.update(editingId, payload);
        showToast('Report updated', 'success');
      } else {
        await strSarApi.create(payload);
        showToast('Report created', 'success');
      }
      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm());
      fetchData(1);
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse<unknown>>).response?.data?.error?.toString() || 'Failed to save report';
      showToast(msg, 'error');
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      switch (action) {
        case 'submit': await strSarApi.submit(id); showToast('Submitted for review', 'success'); break;
        case 'file': await strSarApi.file(id); showToast('Report filed', 'success'); break;
        case 'acknowledge': await strSarApi.acknowledge(id); showToast('Report acknowledged', 'success'); break;
      }
      fetchData(page);
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse<unknown>>).response?.data?.error?.toString() || `Failed to ${action}`;
      showToast(msg, 'error');
    }
  };

  const handleReviewSubmit = async () => {
    if (!reviewAction) return;
    try {
      if (reviewAction.action === 'approve') {
        await strSarApi.approve(reviewAction.id, reviewNotes);
        showToast('Report approved', 'success');
      } else if (reviewAction.action === 'reject') {
        await strSarApi.reject(reviewAction.id, reviewNotes);
        showToast('Report rejected', 'success');
      } else if (reviewAction.action === 'amend') {
        await strSarApi.amend(reviewAction.id, reviewNotes);
        showToast('Amendment created', 'success');
      }
      setReviewAction(null);
      setReviewNotes('');
      fetchData(page);
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse<unknown>>).response?.data?.error?.toString() || 'Action failed';
      showToast(msg, 'error');
    }
  };

  const handleAutoGenerate = async () => {
    try {
      const txIds = autoGenTxIds.split(',').map((s) => s.trim()).filter(Boolean);
      if (txIds.length === 0) { showToast('Enter at least one transaction ID', 'error'); return; }
      await strSarApi.autoGenerate(txIds, autoGenCaseId || undefined);
      showToast('STR auto-generated successfully', 'success');
      setShowAutoGenModal(false);
      setAutoGenTxIds('');
      setAutoGenCaseId('');
      fetchData(1);
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse<unknown>>).response?.data?.error?.toString() || 'Auto-generate failed';
      showToast(msg, 'error');
    }
  };

  const toggleCategory = (cat: SuspicionCategory) => {
    setForm((f) => ({
      ...f,
      suspicionCategories: f.suspicionCategories.includes(cat)
        ? f.suspicionCategories.filter((c) => c !== cat)
        : [...f.suspicionCategories, cat],
    }));
  };

  const addWallet = () => {
    const w = form.walletInput.trim();
    if (w && !form.subjectWalletAddresses.includes(w)) {
      setForm((f) => ({ ...f, subjectWalletAddresses: [...f.subjectWalletAddresses, w], walletInput: '' }));
    }
  };

  const addIndicator = () => {
    const ind = form.indicatorInput.trim();
    if (ind) {
      setForm((f) => ({ ...f, indicatorsOfSuspicion: [...f.indicatorsOfSuspicion, ind], indicatorInput: '' }));
    }
  };

  return (
    <div className="str-sar-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">STR/SAR Reports</h1>
          <p className="page-subtitle">Suspicious Transaction &amp; Activity Reports</p>
        </div>
        <div className="page-header-actions">
          <ExportButton endpoint="/export/compliance" filename="str-sar-reports" />
          <button className="btn btn-ghost" onClick={() => setShowAutoGenModal(true)}>Auto-Generate STR</button>
          <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm(emptyForm()); setShowModal(true); }}>
            + New Report
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <StatsCard title="Total Reports" value={stats.totalReports} />
          <StatsCard title="Pending Review" value={stats.pendingReview} />
          <StatsCard title="Filed This Month" value={stats.filedThisMonth} />
          <StatsCard title="Filed This Year" value={stats.filedThisYear} />
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <select className="input" style={{ width: 'auto' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {Object.values(STRSARType).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {Object.values(STRSARStatus).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {Object.values(SuspicionCategory).map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="loading-spinner" />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Report #</th>
                    <th>Type</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Categories</th>
                    <th>Amount (USD)</th>
                    <th>Filed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No reports found
                      </td>
                    </tr>
                  ) : (
                    reports.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.reportNumber}</td>
                        <td><TypeBadge type={r.type} /></td>
                        <td>{r.subjectName}</td>
                        <td><STRSARStatusBadge status={r.status} /></td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {r.suspicionCategories.slice(0, 2).map((c) => (
                              <span key={c} className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                                {c.replace(/_/g, ' ')}
                              </span>
                            ))}
                            {r.suspicionCategories.length > 2 && (
                              <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>+{r.suspicionCategories.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td>${r.totalAmountUSD.toLocaleString()}</td>
                        <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                            {r.status === STRSARStatus.DRAFT && (
                              <>
                                <button className="btn btn-sm btn-ghost" onClick={() => handleAction(r.id, 'submit')}>Submit</button>
                              </>
                            )}
                            {r.status === STRSARStatus.UNDER_REVIEW && (
                              <>
                                <button className="btn btn-sm btn-primary" onClick={() => { setReviewAction({ id: r.id, action: 'approve' }); setReviewNotes(''); }}>Approve</button>
                                <button className="btn btn-sm btn-danger" onClick={() => { setReviewAction({ id: r.id, action: 'reject' }); setReviewNotes(''); }}>Reject</button>
                              </>
                            )}
                            {r.status === STRSARStatus.APPROVED && (
                              <button className="btn btn-sm btn-primary" onClick={() => handleAction(r.id, 'file')}>File</button>
                            )}
                            {r.status === STRSARStatus.FILED && (
                              <button className="btn btn-sm btn-ghost" onClick={() => handleAction(r.id, 'acknowledge')}>Acknowledge</button>
                            )}
                            {r.status === STRSARStatus.ACKNOWLEDGED && (
                              <button className="btn btn-sm btn-ghost" onClick={() => { setReviewAction({ id: r.id, action: 'amend' }); setReviewNotes(''); }}>Amend</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
                <button className="btn btn-sm btn-ghost" disabled={page <= 1} onClick={() => { setPage(page - 1); fetchData(page - 1); }}>← Prev</button>
                <span style={{ padding: '0.375rem 0.75rem', color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
                <button className="btn btn-sm btn-ghost" disabled={page >= totalPages} onClick={() => { setPage(page + 1); fetchData(page + 1); }}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Report' : 'New STR/SAR Report'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleCreateSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Type *</label>
                  <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as STRSARType })}>
                    {Object.values(STRSARType).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Regulatory Authority *</label>
                  <select className="input" value={form.regulatoryAuthority} onChange={(e) => setForm({ ...form, regulatoryAuthority: e.target.value })}>
                    <option value="NFIU">NFIU (Nigeria)</option>
                    <option value="FinCEN">FinCEN (USA)</option>
                    <option value="FCA">FCA (UK)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Subject Name *</label>
                  <input className="input" required value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Subject Country</label>
                  <input className="input" value={form.subjectCountry} onChange={(e) => setForm({ ...form, subjectCountry: e.target.value })} placeholder="e.g. NG" />
                </div>
              </div>

              {/* Wallet addresses */}
              <div className="form-group">
                <label className="form-label">Wallet Addresses</label>
                <div className="multi-input">
                  {form.subjectWalletAddresses.map((w) => (
                    <span key={w} className="multi-input-tag">
                      {w.slice(0, 10)}…
                      <button type="button" onClick={() => setForm((f) => ({ ...f, subjectWalletAddresses: f.subjectWalletAddresses.filter((a) => a !== w) }))}>×</button>
                    </span>
                  ))}
                  <input
                    className="multi-input-inner"
                    value={form.walletInput}
                    onChange={(e) => setForm({ ...form, walletInput: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWallet(); } }}
                    placeholder="Enter address, press Enter"
                  />
                </div>
              </div>

              {/* Suspicion categories */}
              <div className="form-group">
                <label className="form-label">Suspicion Categories *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {Object.values(SuspicionCategory).map((cat) => (
                    <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.suspicionCategories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cat.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Narrative */}
              <div className="form-group">
                <label className="form-label">Narrative Summary *</label>
                <textarea
                  className="input narrative-textarea"
                  required
                  value={form.narrativeSummary}
                  onChange={(e) => setForm({ ...form, narrativeSummary: e.target.value })}
                  placeholder="Describe the suspicious activity in detail..."
                  rows={5}
                />
              </div>

              {/* Indicators */}
              <div className="form-group">
                <label className="form-label">Indicators of Suspicion</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {form.indicatorsOfSuspicion.map((ind, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>• {ind}</span>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm((f) => ({ ...f, indicatorsOfSuspicion: f.indicatorsOfSuspicion.filter((_, j) => j !== i) }))}>✕</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="input"
                      value={form.indicatorInput}
                      onChange={(e) => setForm({ ...form, indicatorInput: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIndicator(); } }}
                      placeholder="Add indicator, press Enter"
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="btn btn-ghost" onClick={addIndicator}>Add</button>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Total Amount (USD) *</label>
                  <input className="input" type="number" required value={form.totalAmountUSD} onChange={(e) => setForm({ ...form, totalAmountUSD: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date Range Start *</label>
                  <input className="input" type="date" required value={form.dateRangeStart} onChange={(e) => setForm({ ...form, dateRangeStart: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date Range End *</label>
                  <input className="input" type="date" required value={form.dateRangeEnd} onChange={(e) => setForm({ ...form, dateRangeEnd: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Linked Transaction IDs</label>
                  <input className="input" value={form.linkedTransactionIds} onChange={(e) => setForm({ ...form, linkedTransactionIds: e.target.value })} placeholder="tx-1, tx-2 (comma-separated)" />
                </div>
                <div className="form-group">
                  <label className="form-label">Linked Case IDs</label>
                  <input className="input" value={form.linkedCaseIds} onChange={(e) => setForm({ ...form, linkedCaseIds: e.target.value })} placeholder="case-1, case-2 (comma-separated)" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Save Changes' : 'Create Report'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-Generate Modal */}
      {showAutoGenModal && (
        <div className="modal-overlay" onClick={() => setShowAutoGenModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Auto-Generate STR</h2>
              <button className="modal-close" onClick={() => setShowAutoGenModal(false)}>✕</button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Transaction IDs * (comma-separated)</label>
                <textarea
                  className="input narrative-textarea"
                  rows={3}
                  value={autoGenTxIds}
                  onChange={(e) => setAutoGenTxIds(e.target.value)}
                  placeholder="tx-abc123, tx-def456"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Case ID (optional)</label>
                <input className="input" value={autoGenCaseId} onChange={(e) => setAutoGenCaseId(e.target.value)} placeholder="case-..." />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setShowAutoGenModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAutoGenerate}>Generate</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Action Modal (Approve/Reject/Amend) */}
      {reviewAction && (
        <div className="modal-overlay" onClick={() => setReviewAction(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ textTransform: 'capitalize' }}>{reviewAction.action} Report</h2>
              <button className="modal-close" onClick={() => setReviewAction(null)}>✕</button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">
                  {reviewAction.action === 'amend' ? 'Amendment Reason *' : 'Review Notes'}
                  {reviewAction.action === 'reject' ? ' *' : ''}
                </label>
                <textarea
                  className="input narrative-textarea"
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={reviewAction.action === 'approve' ? 'Optional notes...' : 'Required notes...'}
                  required={reviewAction.action !== 'approve'}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setReviewAction(null)}>Cancel</button>
                <button
                  className={`btn ${reviewAction.action === 'reject' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={handleReviewSubmit}
                >
                  Confirm {reviewAction.action}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
