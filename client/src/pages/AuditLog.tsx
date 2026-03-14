import { useEffect, useState } from 'react';
import { auditApi, exportApi, downloadFile, ExportFormat } from '../api/audit';
import { AuditEntry, AuditStats, AuditFilterParams, AuditAction } from '../types';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actionBadgeClass(action: AuditAction): string {
  if (action.startsWith('USER')) return 'badge-priority-low';
  if (action.startsWith('CASE')) return 'badge-case-escalated';
  if (action.startsWith('TRANSACTION')) return 'badge-priority-high';
  if (action.startsWith('COMPLIANCE')) return 'badge-priority-medium';
  if (action.startsWith('EXPORT')) return 'badge-case-resolved';
  if (action.startsWith('SANCTIONS')) return 'badge-priority-critical';
  return 'badge-case-open';
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

// ---------------------------------------------------------------------------
// Export Button component
// ---------------------------------------------------------------------------

function ExportButton({
  onExport,
  loading,
}: {
  onExport: (format: ExportFormat) => void;
  loading: boolean;
}) {
  return (
    <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Export:</span>
      {(['csv', 'json', 'pdf'] as ExportFormat[]).map((fmt) => (
        <button
          key={fmt}
          className="btn btn-sm btn-ghost"
          onClick={() => onExport(fmt)}
          disabled={loading}
          style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}
        >
          {fmt}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 20;

  const fetchData = async (p = page) => {
    setLoading(true);
    try {
      const params: AuditFilterParams = {
        page: p,
        pageSize: PAGE_SIZE,
      };
      if (filterAction) params.action = filterAction as AuditAction;
      if (filterEntityType) params.entityType = filterEntityType;
      if (filterUserId) params.userId = filterUserId;
      if (filterStartDate) params.startDate = filterStartDate;
      if (filterEndDate) params.endDate = filterEndDate;

      const [logRes, statsRes] = await Promise.all([
        auditApi.getAuditLog(params),
        auditApi.getAuditStats(),
      ]);

      setEntries(logRes.data.data ?? []);
      setTotalPages(logRes.data.meta?.totalPages ?? 1);
      setStats(statsRes.data.data ?? null);
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
      setToast({
        message: axiosErr.response?.data?.error?.message ?? 'Failed to load audit log.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAction, filterEntityType, filterUserId, filterStartDate, filterEndDate]);

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const mimeTypes: Record<ExportFormat, string> = {
        csv: 'text/csv',
        json: 'application/json',
        pdf: 'application/pdf',
      };
      const extensions: Record<ExportFormat, string> = { csv: 'csv', json: 'json', pdf: 'pdf' };

      const res = await exportApi.exportAuditLogs(format, {
        userId: filterUserId || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
      });

      downloadFile(res.data, `audit-log.${extensions[format]}`, mimeTypes[format]);
      setToast({ message: `Audit log exported as ${format.toUpperCase()}.`, type: 'success' });
    } catch {
      setToast({ message: 'Export failed. Please try again.', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page-container">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">
            Comprehensive record of all significant system actions.
          </p>
        </div>
        <ExportButton onExport={handleExport} loading={exporting} />
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stats-card">
            <div className="stats-value">{stats.total.toLocaleString()}</div>
            <div className="stats-label">Total Events</div>
          </div>
          <div className="stats-card">
            <div className="stats-value">{Object.keys(stats.byAction).length}</div>
            <div className="stats-label">Action Types</div>
          </div>
          <div className="stats-card">
            <div className="stats-value">{Object.keys(stats.byUser).length}</div>
            <div className="stats-label">Active Users</div>
          </div>
          <div className="stats-card">
            <div className="stats-value">{Object.keys(stats.byEntityType).length}</div>
            <div className="stats-label">Entity Types</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <select
          className="input input-sm"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          style={{ minWidth: '180px' }}
        >
          <option value="">All Actions</option>
          {Object.values(AuditAction).map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <input
          className="input input-sm"
          placeholder="Entity Type (e.g. Case)"
          value={filterEntityType}
          onChange={(e) => setFilterEntityType(e.target.value)}
          style={{ minWidth: '160px' }}
        />

        <input
          className="input input-sm"
          placeholder="User ID"
          value={filterUserId}
          onChange={(e) => setFilterUserId(e.target.value)}
          style={{ minWidth: '160px' }}
        />

        <input
          type="date"
          className="input input-sm"
          value={filterStartDate}
          onChange={(e) => setFilterStartDate(e.target.value)}
          style={{ minWidth: '140px' }}
        />

        <input
          type="date"
          className="input input-sm"
          value={filterEndDate}
          onChange={(e) => setFilterEndDate(e.target.value)}
          style={{ minWidth: '140px' }}
        />

        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setFilterAction('');
            setFilterEntityType('');
            setFilterUserId('');
            setFilterStartDate('');
            setFilterEndDate('');
          }}
        >
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state">Loading audit log…</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <p>No audit events found.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>User</th>
                <th>Entity</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td>
                    <span className={`badge ${actionBadgeClass(entry.action)}`} style={{ fontSize: '0.7rem' }}>
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>{entry.userEmail}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{entry.userRole}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>{entry.entityType}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {entry.entityId.length > 20 ? `${entry.entityId.slice(0, 20)}…` : entry.entityId}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem', maxWidth: '320px' }}>{entry.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button
            className="btn btn-sm btn-ghost"
            disabled={page === 1}
            onClick={() => {
              const prev = page - 1;
              setPage(prev);
              void fetchData(prev);
            }}
          >
            Previous
          </button>
          <span style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-sm btn-ghost"
            disabled={page === totalPages}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              void fetchData(next);
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
