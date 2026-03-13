import { useEffect, useState, FormEvent } from 'react';
import apiClient from '../api/client';
import {
  ComplianceReport,
  ApiResponse,
  ReportType,
  ComplianceStatus,
} from '../types';
import { StatusBadge } from '../components/Badges';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';

export default function Compliance() {
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionId, setTransactionId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  );

  const fetchReports = async () => {
    try {
      const res = await apiClient.get<ApiResponse<ComplianceReport[]>>(
        '/compliance/reports',
      );
      setReports(res.data.data ?? []);
    } catch {
      setToast({ message: 'Failed to load compliance reports.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const runAction = async (
    action: 'check' | 'sar' | 'travel-rule',
    e: FormEvent,
  ) => {
    e.preventDefault();
    if (!transactionId.trim()) return;
    setActionLoading(true);
    try {
      const endpoint =
        action === 'check'
          ? `/compliance/check/${transactionId}`
          : action === 'sar'
            ? `/compliance/sar/${transactionId}`
            : `/compliance/travel-rule/${transactionId}`;

      await apiClient.post(endpoint);
      setToast({
        message: `${action.toUpperCase()} action completed successfully.`,
        type: 'success',
      });
      setTransactionId('');
      fetchReports();
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message:
          axiosErr.response?.data?.error?.message ?? `${action} action failed.`,
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const reportTypeColor: Record<ReportType, string> = {
    [ReportType.SAR]: 'risk-high',
    [ReportType.CTR]: 'risk-medium',
    [ReportType.TRAVEL_RULE]: 'risk-low',
    [ReportType.TAX_SUMMARY]: 'accent-default',
  };

  return (
    <div className="page">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="page-header">
        <h1 className="page-title">Compliance</h1>
        <p className="page-subtitle">
          Run compliance checks, generate SARs, and manage reports
        </p>
      </div>

      {/* Actions Panel */}
      <div className="card compliance-actions">
        <h2 className="card-title">Run Compliance Action</h2>
        <p className="card-subtitle">Enter a transaction ID to trigger an action</p>
        <div className="form-group">
          <label>Transaction ID</label>
          <input
            className="form-control"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="Enter transaction UUID"
          />
        </div>
        <div className="action-buttons">
          <button
            className="btn btn-secondary"
            disabled={!transactionId.trim() || actionLoading}
            onClick={(e) => runAction('check', e)}
          >
            {actionLoading ? '…' : 'Run Compliance Check'}
          </button>
          <button
            className="btn btn-warning"
            disabled={!transactionId.trim() || actionLoading}
            onClick={(e) => runAction('sar', e)}
          >
            {actionLoading ? '…' : 'Generate SAR'}
          </button>
          <button
            className="btn btn-secondary"
            disabled={!transactionId.trim() || actionLoading}
            onClick={(e) => runAction('travel-rule', e)}
          >
            {actionLoading ? '…' : 'Travel Rule Check'}
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="section">
        <h2 className="section-title">Compliance Reports</h2>
        {loading ? (
          <div className="loading-row">
            <div className="spinner" />
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state">No compliance reports yet.</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Transaction</th>
                  <th>Status</th>
                  <th>Filed At</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="monospace">{r.id.slice(0, 10)}…</td>
                    <td>
                      <span className={`badge ${reportTypeColor[r.reportType]}`}>
                        {r.reportType}
                      </span>
                    </td>
                    <td className="monospace">
                      {r.transactionId.slice(0, 10)}…
                    </td>
                    <td>
                      <StatusBadge status={r.status as ComplianceStatus} />
                    </td>
                    <td>
                      {r.filedAt
                        ? new Date(r.filedAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
