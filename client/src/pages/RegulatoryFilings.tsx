import { useEffect, useState, FormEvent } from 'react';
import { regulatoryFilingApi } from '../api/regulatory-filings';
import {
  RegulatoryFiling,
  FilingCalendarEntry,
  FilingDashboardMetrics,
  FilingType,
  FilingStatus,
} from '../types';
import StatsCard from '../components/StatsCard';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';
import { ApiResponse } from '../types';

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function FilingStatusBadge({ status }: { status: FilingStatus }) {
  const cls: Record<FilingStatus, string> = {
    [FilingStatus.UPCOMING]: 'badge filing-status-upcoming',
    [FilingStatus.DUE_SOON]: 'badge filing-status-due-soon',
    [FilingStatus.OVERDUE]: 'badge filing-status-overdue',
    [FilingStatus.FILED]: 'badge filing-status-filed',
    [FilingStatus.CANCELLED]: 'badge filing-status-cancelled',
  };
  return <span className={cls[status]}>{status.replace('_', ' ')}</span>;
}

function FilingTypeBadge({ type }: { type: FilingType }) {
  const labels: Record<FilingType, string> = {
    [FilingType.STR_SAR]: 'STR/SAR',
    [FilingType.CTR]: 'CTR',
    [FilingType.TRAVEL_RULE]: 'Travel Rule',
    [FilingType.PERIODIC_REPORT]: 'Periodic',
    [FilingType.TAX_REPORT]: 'Tax',
    [FilingType.SANCTIONS_REPORT]: 'Sanctions',
  };
  return <span className="badge badge-secondary">{labels[type]}</span>;
}

// ---------------------------------------------------------------------------
// Calendar View
// ---------------------------------------------------------------------------

function CalendarView({ entries }: { entries: FilingCalendarEntry[] }) {
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Build an array of calendar cells (nulls for padding)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const entriesByDay: Record<number, FilingCalendarEntry[]> = {};
  entries.forEach((e) => {
    const d = new Date(e.dueDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      entriesByDay[day] = entriesByDay[day] ?? [];
      entriesByDay[day].push(e);
    }
  });

  const eventCls: Record<FilingStatus, string> = {
    [FilingStatus.UPCOMING]: 'calendar-event-upcoming',
    [FilingStatus.DUE_SOON]: 'calendar-event-due-soon',
    [FilingStatus.OVERDUE]: 'calendar-event-overdue',
    [FilingStatus.FILED]: 'calendar-event-filed',
    [FilingStatus.CANCELLED]: '',
  };

  const monthName = calMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button className="btn btn-sm btn-ghost" onClick={() => setCalMonth(new Date(year, month - 1, 1))}>←</button>
        <h3 style={{ flex: 1, textAlign: 'center', color: 'var(--text-primary)' }}>{monthName}</h3>
        <button className="btn btn-sm btn-ghost" onClick={() => setCalMonth(new Date(year, month + 1, 1))}>→</button>
      </div>
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="calendar-day-header">{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`pad-${idx}`} className="calendar-day other-month" />;
          }
          const isToday =
            today.getDate() === day &&
            today.getMonth() === month &&
            today.getFullYear() === year;
          const dayEntries = entriesByDay[day] ?? [];
          return (
            <div key={day} className={`calendar-day${isToday ? ' today' : ''}`}>
              <div className="calendar-day-number">{day}</div>
              {dayEntries.map((e) => (
                <div
                  key={e.id}
                  className={`calendar-event ${eventCls[e.status]}`}
                  title={e.title}
                >
                  {e.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RegulatoryFilings() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filings, setFilings] = useState<RegulatoryFiling[]>([]);
  const [calendar, setCalendar] = useState<FilingCalendarEntry[]>([]);
  const [dashboard, setDashboard] = useState<FilingDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [fileTarget, setFileTarget] = useState<string | null>(null);
  const [fileReference, setFileReference] = useState('');

  // Create form
  const [form, setForm] = useState({
    filingType: FilingType.STR_SAR,
    title: '',
    description: '',
    regulatoryAuthority: 'NFIU',
    dueDate: '',
    assignedTo: '',
    linkedReportIds: '',
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [filingsRes, calRes, dashRes] = await Promise.all([
        regulatoryFilingApi.getFilings({
          filingType: filterType as FilingType || undefined,
          status: filterStatus as FilingStatus || undefined,
        }),
        regulatoryFilingApi.getCalendar(90),
        regulatoryFilingApi.getDashboard(),
      ]);
      setFilings(filingsRes.data.data as unknown as RegulatoryFiling[]);
      setCalendar(calRes.data.data as unknown as FilingCalendarEntry[]);
      setDashboard(dashRes.data.data ?? null);
    } catch {
      showToast('Failed to load filings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterStatus]);

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await regulatoryFilingApi.create({
        filingType: form.filingType,
        title: form.title,
        description: form.description,
        regulatoryAuthority: form.regulatoryAuthority,
        dueDate: new Date(form.dueDate).toISOString(),
        assignedTo: form.assignedTo || undefined,
        linkedReportIds: form.linkedReportIds ? form.linkedReportIds.split(',').map((s) => s.trim()).filter(Boolean) : [],
      });
      showToast('Filing created', 'success');
      setShowModal(false);
      setForm({ filingType: FilingType.STR_SAR, title: '', description: '', regulatoryAuthority: 'NFIU', dueDate: '', assignedTo: '', linkedReportIds: '' });
      fetchData();
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse<unknown>>).response?.data?.error?.toString() || 'Failed to create filing';
      showToast(msg, 'error');
    }
  };

  const handleMarkFiled = async () => {
    if (!fileTarget) return;
    try {
      await regulatoryFilingApi.markAsFiled(fileTarget, fileReference || undefined);
      showToast('Filing marked as filed', 'success');
      setFileTarget(null);
      setFileReference('');
      fetchData();
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse<unknown>>).response?.data?.error?.toString() || 'Failed to mark as filed';
      showToast(msg, 'error');
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) { showToast('Reason is required', 'error'); return; }
    try {
      await regulatoryFilingApi.cancel(cancelTarget, cancelReason);
      showToast('Filing cancelled', 'success');
      setCancelTarget(null);
      setCancelReason('');
      fetchData();
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse<unknown>>).response?.data?.error?.toString() || 'Failed to cancel';
      showToast(msg, 'error');
    }
  };

  return (
    <div className="filings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Regulatory Filings</h1>
          <p className="page-subtitle">Filing calendar &amp; deadline management</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Filing</button>
        </div>
      </div>

      {/* Dashboard Metrics */}
      {dashboard && (
        <div className="stats-grid">
          <StatsCard title="Total Filings" value={dashboard.totalFilings} />
          <StatsCard title="Due Soon" value={dashboard.dueSoon} />
          <StatsCard title="Overdue" value={dashboard.overdue} />
          <StatsCard title="Compliance Score" value={`${dashboard.complianceScore}%`} />
        </div>
      )}

      {/* Next Deadline Banner */}
      {dashboard?.nextDeadline && dashboard.nextDeadline.status !== FilingStatus.FILED && (
        <div className="card" style={{ borderLeft: `4px solid ${dashboard.nextDeadline.status === FilingStatus.OVERDUE ? 'var(--danger)' : dashboard.nextDeadline.status === FilingStatus.DUE_SOON ? 'var(--warning)' : 'var(--accent)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Next Deadline</div>
              <div style={{ fontWeight: 600 }}>{dashboard.nextDeadline.title}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Due: {new Date(dashboard.nextDeadline.dueDate).toLocaleDateString()} ({dashboard.nextDeadline.daysUntilDue} days)
              </div>
            </div>
            <FilingStatusBadge status={dashboard.nextDeadline.status} />
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="tab-nav">
        <button className={`tab-nav-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>List View</button>
        <button className={`tab-nav-btn${view === 'calendar' ? ' active' : ''}`} onClick={() => setView('calendar')}>Calendar View</button>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className="card">
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <select className="input" style={{ width: 'auto' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {Object.values(FilingType).map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            <select className="input" style={{ width: 'auto' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {Object.values(FilingStatus).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="loading-spinner" />
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Authority</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filings.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No filings found
                      </td>
                    </tr>
                  ) : (
                    filings.map((f) => (
                      <tr
                        key={f.id}
                        className={f.status === FilingStatus.OVERDUE ? 'overdue-highlight' : ''}
                      >
                        <td>{f.title}</td>
                        <td><FilingTypeBadge type={f.filingType} /></td>
                        <td>{f.regulatoryAuthority}</td>
                        <td>{new Date(f.dueDate).toLocaleDateString()}</td>
                        <td><FilingStatusBadge status={f.status} /></td>
                        <td>{f.assignedTo || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            {f.status !== FilingStatus.FILED && f.status !== FilingStatus.CANCELLED && (
                              <button className="btn btn-sm btn-primary" onClick={() => { setFileTarget(f.id); setFileReference(''); }}>
                                Mark Filed
                              </button>
                            )}
                            {f.status !== FilingStatus.CANCELLED && f.status !== FilingStatus.FILED && (
                              <button className="btn btn-sm btn-ghost" onClick={() => { setCancelTarget(f.id); setCancelReason(''); }}>
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="card">
          <CalendarView entries={calendar} />
        </div>
      )}

      {/* Create Filing Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Regulatory Filing</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleCreateSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Filing Type *</label>
                  <select className="input" value={form.filingType} onChange={(e) => setForm({ ...form, filingType: e.target.value as FilingType })}>
                    {Object.values(FilingType).map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Regulatory Authority *</label>
                  <input className="input" required value={form.regulatoryAuthority} onChange={(e) => setForm({ ...form, regulatoryAuthority: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea className="input" required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Due Date *</label>
                  <input className="input" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Assign To</label>
                  <input className="input" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="User ID" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Linked Report IDs (comma-separated)</label>
                <input className="input" value={form.linkedReportIds} onChange={(e) => setForm({ ...form, linkedReportIds: e.target.value })} placeholder="STR-2026-000001, ..." />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Filing</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark as Filed Modal */}
      {fileTarget && (
        <div className="modal-overlay" onClick={() => setFileTarget(null)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Mark as Filed</h2>
              <button className="modal-close" onClick={() => setFileTarget(null)}>✕</button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Filing Reference (optional)</label>
                <input className="input" value={fileReference} onChange={(e) => setFileReference(e.target.value)} placeholder="External reference number" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setFileTarget(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleMarkFiled}>Confirm Filed</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Filing Modal */}
      {cancelTarget && (
        <div className="modal-overlay" onClick={() => setCancelTarget(null)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cancel Filing</h2>
              <button className="modal-close" onClick={() => setCancelTarget(null)}>✕</button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Reason *</label>
                <textarea className="input" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required placeholder="Reason for cancellation..." />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setCancelTarget(null)}>Back</button>
                <button className="btn btn-danger" onClick={handleCancel}>Cancel Filing</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
