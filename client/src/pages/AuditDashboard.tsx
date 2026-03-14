import { useEffect, useState } from 'react';
import { auditEnhancedApi } from '../api/audit-enhanced';
import { AuditLogEntry, AuditDashboardMetrics, AuditComplianceReport, AuditSeverity } from '../types';
import Toast from '../components/Toast';

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const cls: Record<AuditSeverity, string> = {
    CRITICAL: 'badge severity-badge-critical',
    WARNING: 'badge severity-badge-warning',
    INFO: 'badge severity-badge-info',
  };
  return <span className={cls[severity]}>{severity}</span>;
}

// ---------------------------------------------------------------------------
// CSS Bar Chart
// ---------------------------------------------------------------------------

function BarChart({ data, labelKey, valueKey, title }: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  title: string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);
  return (
    <div className="bar-chart">
      <h4>{title}</h4>
      <div className="bar-chart-content">
        {data.map((item, i) => {
          const value = Number(item[valueKey]);
          const pct = (value / max) * 100;
          return (
            <div key={i} className="bar-chart-row">
              <span className="bar-chart-label">{String(item[labelKey])}</span>
              <div className="bar-chart-bar-wrap">
                <div className="bar-chart-bar" style={{ width: `${pct}%` }} />
              </div>
              <span className="bar-chart-value">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AuditDashboard() {
  const [metrics, setMetrics] = useState<AuditDashboardMetrics | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [securityEvents, setSecurityEvents] = useState<AuditLogEntry[]>([]);
  const [report, setReport] = useState<AuditComplianceReport | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'security' | 'compliance'>('dashboard');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters for audit logs tab
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [userId, setUserId] = useState('');

  // Compliance report date range
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);

  const pageSize = 20;

  async function loadMetrics() {
    try {
      const res = await auditEnhancedApi.getDashboardMetrics();
      setMetrics(res.data.data ?? null);
    } catch {
      // ignore
    }
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await auditEnhancedApi.getAuditLogs({
        page,
        pageSize,
        search: search || undefined,
        severity: severity as AuditSeverity || undefined,
        userId: userId || undefined,
        sortOrder,
      });
      setLogs(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
    } catch {
      setToast({ message: 'Failed to load audit logs', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function loadSecurityEvents() {
    try {
      const res = await auditEnhancedApi.getSecurityEvents(100);
      setSecurityEvents(res.data.data ?? []);
    } catch {
      setToast({ message: 'Failed to load security events', type: 'error' });
    }
  }

  async function generateReport() {
    setGeneratingReport(true);
    try {
      const res = await auditEnhancedApi.getComplianceReport({
        startDate: reportStart || undefined,
        endDate: reportEnd || undefined,
      });
      setReport(res.data.data ?? null);
    } catch {
      setToast({ message: 'Failed to generate report', type: 'error' });
    } finally {
      setGeneratingReport(false);
    }
  }

  useEffect(() => { loadMetrics(); }, []);
  useEffect(() => { if (activeTab === 'logs') loadLogs(); }, [activeTab, page, search, severity, sortOrder, userId]);
  useEffect(() => { if (activeTab === 'security') loadSecurityEvents(); }, [activeTab]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="admin-page audit-dashboard">
      <div className="page-header">
        <div>
          <h1>Audit Dashboard</h1>
          <p className="text-muted">Monitor system activity, security events, and compliance</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn${activeTab === 'dashboard' ? ' active' : ''}`} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button className={`tab-btn${activeTab === 'logs' ? ' active' : ''}`} onClick={() => setActiveTab('logs')}>📋 Audit Logs</button>
        <button className={`tab-btn${activeTab === 'security' ? ' active' : ''}`} onClick={() => setActiveTab('security')}>🔐 Security Events</button>
        <button className={`tab-btn${activeTab === 'compliance' ? ' active' : ''}`} onClick={() => setActiveTab('compliance')}>📄 Compliance Report</button>
      </div>

      {/* Dashboard tab */}
      {activeTab === 'dashboard' && metrics && (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Total Logs</div>
              <div className="stat-value">{metrics.totalLogs.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Today</div>
              <div className="stat-value">{metrics.todayLogs}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label admin-indicator">Critical Events</div>
              <div className="stat-value">{metrics.criticalEvents}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Unique Users</div>
              <div className="stat-value">{metrics.uniqueUsers}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="card">
              <BarChart
                data={metrics.activityByDay}
                labelKey="date"
                valueKey="count"
                title="Activity Last 7 Days"
              />
            </div>
            <div className="card">
              <BarChart
                data={metrics.activityByHour.filter((_, i) => i % 3 === 0)}
                labelKey="hour"
                valueKey="count"
                title="Activity by Hour (Last 24h)"
              />
            </div>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-header"><h3>Top Actions</h3></div>
            <table className="user-table">
              <thead>
                <tr><th>Action</th><th>Count</th></tr>
              </thead>
              <tbody>
                {metrics.topActions.map((a) => (
                  <tr key={a.action}>
                    <td>{a.action.replace(/_/g, ' ')}</td>
                    <td>{a.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Audit Logs tab */}
      {activeTab === 'logs' && (
        <div className="card">
          <div className="filter-bar" style={{ padding: '1rem' }}>
            <input
              className="form-control"
              placeholder="Search…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ maxWidth: '220px' }}
            />
            <input
              className="form-control"
              placeholder="User ID filter"
              value={userId}
              onChange={(e) => { setUserId(e.target.value); setPage(1); }}
              style={{ maxWidth: '200px' }}
            />
            <select className="form-control" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} style={{ maxWidth: '160px' }}>
              <option value="">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="WARNING">Warning</option>
              <option value="INFO">Info</option>
            </select>
            <select className="form-control" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')} style={{ maxWidth: '160px' }}>
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>

          {loading ? (
            <div className="loading-state">Loading…</div>
          ) : (
            <table className="user-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Severity</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">No audit logs found</td></tr>
                ) : logs.map((log) => (
                  <tr key={log.id} className={`audit-row severity-${log.severity.toLowerCase()}`}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td style={{ fontSize: '0.8rem' }}>{log.userEmail}</td>
                    <td style={{ fontSize: '0.8rem' }}>{log.action.replace(/_/g, ' ')}</td>
                    <td style={{ fontSize: '0.8rem' }}>{log.entityType}: {log.entityId.slice(0, 8)}…</td>
                    <td><SeverityBadge severity={log.severity} /></td>
                    <td style={{ fontSize: '0.8rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-sm btn-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button className="btn btn-sm btn-ghost" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* Security Events tab */}
      {activeTab === 'security' && (
        <div className="card">
          <div className="card-header"><h3>Critical Security Events</h3></div>
          <table className="user-table">
            <thead>
              <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Description</th></tr>
            </thead>
            <tbody>
              {securityEvents.length === 0 ? (
                <tr><td colSpan={5} className="empty-state">No security events</td></tr>
              ) : securityEvents.map((evt) => (
                <tr key={evt.id} className="security-event-row">
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{new Date(evt.timestamp).toLocaleString()}</td>
                  <td style={{ fontSize: '0.8rem' }}>{evt.userEmail}</td>
                  <td style={{ fontSize: '0.8rem' }}>{evt.action.replace(/_/g, ' ')}</td>
                  <td style={{ fontSize: '0.8rem' }}>{evt.entityType}</td>
                  <td style={{ fontSize: '0.8rem' }}>{evt.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Compliance Report tab */}
      {activeTab === 'compliance' && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header"><h3>Generate Compliance Report</h3></div>
            <div style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Start Date</label>
                <input type="date" className="form-control" value={reportStart} onChange={(e) => setReportStart(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>End Date</label>
                <input type="date" className="form-control" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={generateReport} disabled={generatingReport}>
                {generatingReport ? 'Generating…' : '📄 Generate Report'}
              </button>
            </div>
          </div>

          {report && (
            <div className="compliance-report-card">
              <div className="card" style={{ marginBottom: '1rem' }}>
                <div className="card-header"><h3>Report Summary</h3></div>
                <div style={{ padding: '1rem' }}>
                  <div className="stats-row">
                    <div className="stat-card">
                      <div className="stat-label">Total Events</div>
                      <div className="stat-value">{report.totalEvents}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label admin-indicator">Critical Events</div>
                      <div className="stat-value">{report.criticalEvents}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Unique Users</div>
                      <div className="stat-value">{report.userSummary.length}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Period</div>
                      <div className="stat-value" style={{ fontSize: '0.9rem' }}>{new Date(report.startDate).toLocaleDateString()} – {new Date(report.endDate).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div>
                      <h4>Top Actions</h4>
                      <table className="user-table">
                        <thead><tr><th>Action</th><th>Count</th></tr></thead>
                        <tbody>
                          {report.actionSummary.slice(0, 10).map((a) => (
                            <tr key={a.action}><td>{a.action.replace(/_/g, ' ')}</td><td>{a.count}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <h4>User Activity</h4>
                      <table className="user-table">
                        <thead><tr><th>User</th><th>Events</th></tr></thead>
                        <tbody>
                          {report.userSummary.slice(0, 10).map((u) => (
                            <tr key={u.userId}><td>{u.email}</td><td>{u.eventCount}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {report.securityEvents.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4>Critical Security Events ({report.securityEvents.length})</h4>
                      <table className="user-table">
                        <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Description</th></tr></thead>
                        <tbody>
                          {report.securityEvents.map((e) => (
                            <tr key={e.id} className="security-event-row">
                              <td style={{ fontSize: '0.8rem' }}>{new Date(e.timestamp).toLocaleString()}</td>
                              <td style={{ fontSize: '0.8rem' }}>{e.userEmail}</td>
                              <td style={{ fontSize: '0.8rem' }}>{e.action.replace(/_/g, ' ')}</td>
                              <td style={{ fontSize: '0.8rem' }}>{e.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
