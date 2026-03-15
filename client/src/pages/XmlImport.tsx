import { useEffect, useState, FormEvent } from 'react';
import { xmlImportApi, ImportRecord, ValidationResult, ImportResult } from '../api/xml-import';
import { ApiResponse } from '../types';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    COMPLETED: 'badge status-badge-active',
    PARTIAL: 'badge role-badge-analyst',
    FAILED: 'badge status-badge-suspended',
  };
  return <span className={cls[status] ?? 'badge'}>{status}</span>;
}

// ---------------------------------------------------------------------------
// Validation Result Panel
// ---------------------------------------------------------------------------

function ValidationPanel({ result }: { result: ValidationResult }) {
  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
        <h4 style={{ margin: 0 }}>
          Validation Result{' '}
          <span className={`badge ${result.isValid ? 'status-badge-active' : 'status-badge-suspended'}`}>
            {result.isValid ? 'Valid' : 'Invalid'}
          </span>
        </h4>
      </div>
      <div style={{ padding: '1rem 1.25rem' }}>
        {result.errors.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <strong style={{ color: 'var(--danger)' }}>Errors ({result.errors.length})</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
              {result.errors.map((e, i) => (
                <li key={i} style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <code>{e.field}</code>: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.warnings.length > 0 && (
          <div>
            <strong style={{ color: 'var(--warning, #f59e0b)' }}>Warnings ({result.warnings.length})</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
              {result.warnings.map((w, i) => (
                <li key={i} style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {result.errors.length === 0 && result.warnings.length === 0 && (
          <p style={{ color: 'var(--success, #10b981)', margin: 0 }}>✓ No errors or warnings found.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import Result Panel
// ---------------------------------------------------------------------------

function ImportResultPanel({ result }: { result: ImportResult }) {
  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
        <h4 style={{ margin: 0 }}>
          Import Result — <StatusBadge status={result.status} />
        </h4>
      </div>
      <div style={{ padding: '1rem 1.25rem' }}>
        <div className="stats-row" style={{ marginBottom: '1rem' }}>
          <div className="stat-card">
            <div className="stat-label">Submission ID</div>
            <div style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{result.submissionId}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Exchange</div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>{result.exchangeName}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Records</div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>{result.totalRecords}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Valid</div>
            <div className="stat-value" style={{ fontSize: '1.2rem', color: 'var(--success, #10b981)' }}>{result.validRecords}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Errors</div>
            <div className="stat-value" style={{ fontSize: '1.2rem', color: result.errorRecords > 0 ? 'var(--danger)' : undefined }}>{result.errorRecords}</div>
          </div>
        </div>

        {result.validationErrors.length > 0 && (
          <div>
            <strong style={{ color: 'var(--danger)' }}>Validation Errors</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
              {result.validationErrors.map((e, i) => (
                <li key={i} style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  <code>{e.field}</code>: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import Detail Modal
// ---------------------------------------------------------------------------

function ImportDetailModal({ record, onClose }: { record: ImportRecord; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>Import Detail</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Submission ID</td>
                <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{record.id}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Exchange</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{record.exchangeName}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Reporting Period</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{record.reportingPeriod}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Period Start</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(record.periodStart).toLocaleDateString()}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Period End</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(record.periodEnd).toLocaleDateString()}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Status</td>
                <td style={{ padding: '0.5rem 0.75rem' }}><StatusBadge status={record.status} /></td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Total Records</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{record.totalRecords}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Valid Records</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{record.validRecords}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Error Records</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{record.errorRecords}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Submitted By</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{record.submittedBy ?? '—'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Processed At</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{record.processedAt ? new Date(record.processedAt).toLocaleString() : '—'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Created At</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{new Date(record.createdAt).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          {record.validationErrors && record.validationErrors.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <strong style={{ color: 'var(--danger)' }}>Validation Errors</strong>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                {record.validationErrors.map((e, i) => (
                  <li key={i} style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <code>{e.field}</code>: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ padding: '1rem 1.25rem' }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// XML Sample Template
// ---------------------------------------------------------------------------

const XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<ExchangeReport>
  <Metadata>
    <ExchangeName>MyExchange</ExchangeName>
    <ReportingPeriod>2024-Q1</ReportingPeriod>
    <PeriodStart>2024-01-01</PeriodStart>
    <PeriodEnd>2024-03-31</PeriodEnd>
    <GeneratedAt>2024-04-01T00:00:00Z</GeneratedAt>
  </Metadata>
  <Transactions>
    <Transaction>
      <TransactionID>TXN-001</TransactionID>
      <AccountID>ACC-123</AccountID>
      <Type>BUY</Type>
      <Asset>BTC</Asset>
      <Amount>0.5</Amount>
      <UnitPriceUSD>45000</UnitPriceUSD>
      <TotalValueUSD>22500</TotalValueUSD>
      <Fee>10</Fee>
      <FeeUSD>10</FeeUSD>
      <Timestamp>2024-01-15T10:30:00Z</Timestamp>
      <KYCStatus>VERIFIED</KYCStatus>
    </Transaction>
  </Transactions>
</ExchangeReport>`;

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function XmlImport() {
  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');

  // Import / Validate tab state
  const [xmlContent, setXmlContent] = useState('');
  const [mode, setMode] = useState<'validate' | 'import'>('validate');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // History tab state
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ImportRecord | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const pageSize = 20;

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await xmlImportApi.getHistory({ page, pageSize });
      setHistory(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
    } catch {
      setToast({ message: 'Failed to load import history', type: 'error' });
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, page]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!xmlContent.trim()) {
      setSubmitError('Please enter XML content');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    setValidationResult(null);
    setImportResult(null);

    try {
      if (mode === 'validate') {
        const res = await xmlImportApi.validate(xmlContent);
        setValidationResult(res.data.data ?? null);
      } else {
        const res = await xmlImportApi.import(xmlContent);
        setImportResult(res.data.data ?? null);
        if (res.data.data?.status !== 'FAILED') {
          setToast({ message: 'Import submitted successfully', type: 'success' });
        }
      }
    } catch (err) {
      const ax = err as AxiosError<ApiResponse<unknown>>;
      setSubmitError(ax.response?.data?.error?.message ?? 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>XML Exchange Report Import</h1>
          <p className="text-muted">Validate and import exchange periodic reports in CRYPTRAC XML format</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)' }}>
        {(['import', 'history'] as const).map((tab) => (
          <button
            key={tab}
            className={`btn btn-ghost${activeTab === tab ? ' active' : ''}`}
            style={{
              borderRadius: '4px 4px 0 0',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-2px',
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'import' ? '📤 Import / Validate' : '📋 History'}
          </button>
        ))}
      </div>

      {/* Import / Validate Tab */}
      {activeTab === 'import' && (
        <div>
          <form onSubmit={handleSubmit}>
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
              {/* Mode selector */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mode"
                    value="validate"
                    checked={mode === 'validate'}
                    onChange={() => { setMode('validate'); setValidationResult(null); setImportResult(null); }}
                  />
                  Validate Only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mode"
                    value="import"
                    checked={mode === 'import'}
                    onChange={() => { setMode('import'); setValidationResult(null); setImportResult(null); }}
                  />
                  Validate &amp; Import
                </label>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ marginBottom: 0 }}>XML Content</label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setXmlContent(XML_SAMPLE); setValidationResult(null); setImportResult(null); }}
                  >
                    Load Sample
                  </button>
                </div>
                <textarea
                  className="form-control"
                  rows={14}
                  placeholder="Paste your XML exchange report here…"
                  value={xmlContent}
                  onChange={(e) => setXmlContent(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
                />
              </div>

              {submitError && <div className="alert alert-error">{submitError}</div>}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-primary" disabled={submitting || !xmlContent.trim()}>
                  {submitting
                    ? (mode === 'validate' ? 'Validating…' : 'Importing…')
                    : (mode === 'validate' ? '✓ Validate XML' : '📤 Import Report')}
                </button>
                {(xmlContent || validationResult || importResult) && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { setXmlContent(''); setValidationResult(null); setImportResult(null); setSubmitError(''); }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </form>

          {validationResult && <ValidationPanel result={validationResult} />}
          {importResult && <ImportResultPanel result={importResult} />}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="card">
          {historyLoading ? (
            <div className="loading-state">Loading history…</div>
          ) : (
            <>
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Exchange</th>
                    <th>Reporting Period</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Valid</th>
                    <th>Errors</th>
                    <th>Processed At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-state">No import submissions found.</td>
                    </tr>
                  ) : (
                    history.map((record) => (
                      <tr key={record.id}>
                        <td>{record.exchangeName}</td>
                        <td>{record.reportingPeriod}</td>
                        <td><StatusBadge status={record.status} /></td>
                        <td>{record.totalRecords}</td>
                        <td style={{ color: 'var(--success, #10b981)' }}>{record.validRecords}</td>
                        <td style={{ color: record.errorRecords > 0 ? 'var(--danger)' : undefined }}>{record.errorRecords}</td>
                        <td>{record.processedAt ? new Date(record.processedAt).toLocaleDateString() : '—'}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setSelectedRecord(record)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="pagination">
                  <button className="btn btn-sm btn-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>← Prev</button>
                  <span>Page {page} of {totalPages}</span>
                  <button className="btn btn-sm btn-ghost" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {selectedRecord && (
        <ImportDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
