import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import {
  Transaction,
  ComplianceReport,
  ApiResponse,
  RiskLevel,
  ComplianceStatus,
} from '../types';
import StatsCard from '../components/StatsCard';
import { RiskBadge, StatusBadge } from '../components/Badges';
import LiveActivityFeed from '../components/LiveActivityFeed';

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [txRes, reportRes] = await Promise.all([
          apiClient.get<ApiResponse<Transaction[]>>('/transactions'),
          apiClient.get<ApiResponse<ComplianceReport[]>>('/compliance/reports'),
        ]);
        setTransactions(txRes.data.data ?? []);
        setReports(reportRes.data.data ?? []);
      } catch {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const flaggedCount = transactions.filter(
    (t) =>
      t.riskLevel === RiskLevel.HIGH || t.riskLevel === RiskLevel.CRITICAL,
  ).length;

  const pendingReports = reports.filter(
    (r) =>
      r.status === ComplianceStatus.PENDING ||
      r.status === ComplianceStatus.UNDER_REVIEW,
  ).length;

  const recent = transactions.slice(0, 8);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Crypto Transaction Reporting & Compliance Overview</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-row">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <StatsCard
              title="Total Transactions"
              value={transactions.length}
              subtitle="All time"
            />
            <StatsCard
              title="Flagged"
              value={flaggedCount}
              subtitle="HIGH or CRITICAL risk"
              accent="danger"
            />
            <StatsCard
              title="Compliance Reports"
              value={reports.length}
              subtitle="Total reports filed"
              accent="success"
            />
            <StatsCard
              title="Pending Reports"
              value={pendingReports}
              subtitle="Awaiting review"
              accent="warning"
            />
          </div>

          <div className="dashboard-main-grid">
            <div className="dashboard-main-content">
              <div className="section">
                <div className="section-header">
                  <h2 className="section-title">Recent Transactions</h2>
                  <Link to="/transactions" className="btn btn-ghost btn-sm">
                    View all →
                  </Link>
                </div>

                {recent.length === 0 ? (
                  <div className="empty-state">No transactions yet.</div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Hash</th>
                          <th>Type</th>
                          <th>Asset</th>
                          <th>Amount USD</th>
                          <th>Risk</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent.map((tx) => (
                          <tr key={tx.id}>
                            <td>
                              <Link to={`/transactions/${tx.id}`} className="link">
                                {tx.txHash.slice(0, 10)}…
                              </Link>
                            </td>
                            <td>{tx.type}</td>
                            <td>{tx.asset}</td>
                            <td>${tx.amountUSD.toLocaleString()}</td>
                            <td>
                              <RiskBadge level={tx.riskLevel} />
                            </td>
                            <td>
                              <StatusBadge status={tx.complianceStatus} />
                            </td>
                            <td>
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="quick-links">
                <Link to="/transactions" className="quick-link-card">
                  <span className="quick-link-icon">↔</span>
                  <span>Transactions</span>
                </Link>
                <Link to="/wallets" className="quick-link-card">
                  <span className="quick-link-icon">🔑</span>
                  <span>Wallets</span>
                </Link>
                <Link to="/compliance" className="quick-link-card">
                  <span className="quick-link-icon">📋</span>
                  <span>Compliance</span>
                </Link>
              </div>
            </div>

            <div className="dashboard-sidebar">
              <LiveActivityFeed />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
