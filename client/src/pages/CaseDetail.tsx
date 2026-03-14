import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { casesApi } from '../api/cases';
import {
  Case,
  CaseNote,
  CaseTimelineEntry,
  CaseStatus,
  CasePriority,
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

type Tab = 'timeline' | 'notes';

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [timeline, setTimeline] = useState<CaseTimelineEntry[]>([]);
  const [relatedCases, setRelatedCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('timeline');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Status update
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<CaseStatus>(CaseStatus.OPEN);
  const [resolution, setResolution] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  // Assign
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Note form
  const [noteContent, setNoteContent] = useState('');
  const [noteInternal, setNoteInternal] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);

  const fetchCase = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [caseRes, notesRes, timelineRes, relatedRes] = await Promise.all([
        casesApi.getCaseById(id),
        casesApi.getCaseNotes(id),
        casesApi.getCaseTimeline(id),
        casesApi.getRelatedCases(id),
      ]);
      setCaseData(caseRes.data.data ?? null);
      setNotes(notesRes.data.data ?? []);
      setTimeline(timelineRes.data.data ?? []);
      setRelatedCases(relatedRes.data.data ?? []);
    } catch {
      setToast({ message: 'Failed to load case.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleStatusUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setStatusLoading(true);
    try {
      await casesApi.updateCaseStatus(id, newStatus, resolution || undefined);
      setToast({ message: 'Status updated.', type: 'success' });
      setShowStatusModal(false);
      setResolution('');
      fetchCase();
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message: axiosErr.response?.data?.error?.message ?? 'Failed to update status.',
        type: 'error',
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !assignee.trim()) return;
    setAssignLoading(true);
    try {
      await casesApi.assignCase(id, assignee.trim());
      setToast({ message: 'Case assigned.', type: 'success' });
      setShowAssignModal(false);
      setAssignee('');
      fetchCase();
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message: axiosErr.response?.data?.error?.message ?? 'Failed to assign case.',
        type: 'error',
      });
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !noteContent.trim()) return;
    setNoteLoading(true);
    try {
      await casesApi.addCaseNote(id, noteContent.trim(), noteInternal);
      setToast({ message: 'Note added.', type: 'success' });
      setNoteContent('');
      setNoteInternal(false);
      const notesRes = await casesApi.getCaseNotes(id);
      setNotes(notesRes.data.data ?? []);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message: axiosErr.response?.data?.error?.message ?? 'Failed to add note.',
        type: 'error',
      });
    } finally {
      setNoteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-row"><div className="spinner" /></div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="page">
        <div className="alert alert-error">Case not found.</div>
        <button className="btn btn-ghost" onClick={() => navigate('/cases')}>
          ← Back to Cases
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Back link */}
      <div style={{ marginBottom: '1rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/cases')}>
          ← Back to Cases
        </button>
      </div>

      {/* Case header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>{caseData.caseNumber}</h1>
            <CaseStatusBadge status={caseData.status} />
            <CasePriorityBadge priority={caseData.priority} />
            <span className="badge accent-default">{caseData.category.replace(/_/g, ' ')}</span>
          </div>
          <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>{caseData.title}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => { setNewStatus(caseData.status); setShowStatusModal(true); }}
          >
            Update Status
          </button>
          <button className="btn btn-secondary" onClick={() => setShowAssignModal(true)}>
            Assign
          </button>
        </div>
      </div>

      {/* Info grid */}
      <div className="form-row" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Left: description & details */}
        <div className="card" style={{ flex: 2 }}>
          <h2 className="card-title">Details</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{caseData.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Risk Score</div>
              <div style={{ fontWeight: 600 }}>{caseData.riskScore}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Assigned To</div>
              <div style={{ fontWeight: 600 }}>{caseData.assignedTo ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Created By</div>
              <div style={{ fontWeight: 600 }}>{caseData.createdBy}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Created</div>
              <div style={{ fontWeight: 600 }}>{new Date(caseData.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Last Updated</div>
              <div style={{ fontWeight: 600 }}>{new Date(caseData.updatedAt).toLocaleString()}</div>
            </div>
            {caseData.closedAt && (
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Closed At</div>
                <div style={{ fontWeight: 600 }}>{new Date(caseData.closedAt).toLocaleString()}</div>
              </div>
            )}
            {caseData.resolution && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Resolution</div>
                <div>{caseData.resolution}</div>
              </div>
            )}
          </div>
        </div>

        {/* Right: linked data */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Linked Transactions */}
          <div className="card">
            <h2 className="card-title">Linked Transactions ({caseData.transactionIds.length})</h2>
            {caseData.transactionIds.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>None</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {caseData.transactionIds.map((txId) => (
                  <li key={txId} style={{ marginBottom: '0.25rem' }}>
                    <Link
                      to={`/transactions/${txId}`}
                      className="link monospace"
                      style={{ fontSize: '0.8rem' }}
                    >
                      {txId.slice(0, 16)}…
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Linked Wallets */}
          <div className="card">
            <h2 className="card-title">Linked Wallets ({caseData.walletAddresses.length})</h2>
            {caseData.walletAddresses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>None</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {caseData.walletAddresses.map((addr) => (
                  <li key={addr} style={{ marginBottom: '0.25rem' }}>
                    <Link
                      to={`/wallets`}
                      className="link monospace"
                      style={{ fontSize: '0.8rem' }}
                    >
                      {addr.slice(0, 16)}…
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: Timeline / Notes */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
          {(['timeline', 'notes'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.5rem 1rem',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--color-primary, #3b82f6)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--color-primary, #3b82f6)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab ? 600 : 400,
                cursor: 'pointer',
                fontSize: '0.9rem',
                textTransform: 'capitalize',
              }}
            >
              {tab === 'timeline' ? `Timeline (${timeline.length})` : `Notes (${notes.length})`}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {activeTab === 'timeline' && (
          <div>
            {timeline.length === 0 ? (
              <div className="empty-state">No timeline events yet.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {timeline.map((entry) => (
                  <li
                    key={entry.id}
                    style={{
                      display: 'flex',
                      gap: '1rem',
                      padding: '0.75rem 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        width: '0.5rem',
                        height: '0.5rem',
                        borderRadius: '50%',
                        background: 'var(--color-primary, #3b82f6)',
                        marginTop: '0.35rem',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{entry.action}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {entry.description}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.25rem',
                        }}
                      >
                        by {entry.performedBy} · {new Date(entry.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Notes */}
        {activeTab === 'notes' && (
          <div>
            {/* Add note form */}
            <form onSubmit={handleAddNote} style={{ marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label>Add Note</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write a note…"
                  required
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={noteInternal}
                    onChange={(e) => setNoteInternal(e.target.checked)}
                  />
                  Internal note
                </label>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={noteLoading || !noteContent.trim()}
                >
                  {noteLoading ? '…' : 'Add Note'}
                </button>
              </div>
            </form>

            {notes.length === 0 ? (
              <div className="empty-state">No notes yet.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {notes.map((note) => (
                  <li
                    key={note.id}
                    style={{
                      padding: '0.75rem',
                      border: '1px solid var(--border)',
                      borderRadius: '0.5rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        by {note.authorId} · {new Date(note.createdAt).toLocaleString()}
                      </span>
                      {note.isInternal && (
                        <span className="badge badge-priority-high" style={{ fontSize: '0.7rem' }}>
                          Internal
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{note.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Related Cases */}
      {relatedCases.length > 0 && (
        <div className="card">
          <h2 className="card-title">Related Cases ({relatedCases.length})</h2>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Case #</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {relatedCases.map((rc) => (
                  <tr
                    key={rc.id}
                    className="clickable-row"
                    onClick={() => navigate(`/cases/${rc.id}`)}
                  >
                    <td className="monospace">{rc.caseNumber}</td>
                    <td>{rc.title}</td>
                    <td><CaseStatusBadge status={rc.status} /></td>
                    <td><CasePriorityBadge priority={rc.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showStatusModal && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Status</h2>
              <button className="modal-close" onClick={() => setShowStatusModal(false)}>×</button>
            </div>
            <form onSubmit={handleStatusUpdate} className="modal-form">
              <div className="form-group">
                <label>New Status</label>
                <select
                  className="form-control"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as CaseStatus)}
                >
                  {Object.values(CaseStatus).map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              {(newStatus === CaseStatus.RESOLVED || newStatus === CaseStatus.CLOSED) && (
                <div className="form-group">
                  <label>Resolution</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Describe the resolution…"
                  />
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowStatusModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={statusLoading}>
                  {statusLoading ? '…' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Case</h2>
              <button className="modal-close" onClick={() => setShowAssignModal(false)}>×</button>
            </div>
            <form onSubmit={handleAssign} className="modal-form">
              <div className="form-group">
                <label>Assign To (user ID or email)</label>
                <input
                  className="form-control"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="User ID or email"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={assignLoading}>
                  {assignLoading ? '…' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
