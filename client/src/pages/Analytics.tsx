import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { analyticsApi } from '../api/analytics';
import { RiskBadge } from '../components/Badges';
import ExportButton from '../components/ExportButton';
import ConnectionStatus from '../components/ConnectionStatus';
import { useWebSocket } from '../hooks/useWebSocket';
import type {
  AnalyticsKPIs,
  TimeSeriesPoint,
  RiskDistributionItem,
  AssetBreakdownItem,
  PatternDetectionResult,
  TransactionGraph,
  TopWalletItem,
  ComplianceOverviewItem,
} from '../types/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Note: recharts requires concrete color values, not CSS variables.
// These are synchronized with the corresponding --risk-* CSS variables in App.css.
const RISK_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

const COMPLIANCE_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  APPROVED: '#10b981',
  FLAGGED: '#f97316',
  REJECTED: '#ef4444',
  UNDER_REVIEW: '#3b82f6',
};

function fmt(n: number | undefined, decimals = 0): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return decimals > 0 ? `$${n.toFixed(decimals)}` : n.toLocaleString();
}

function truncateAddress(addr: string) {
  if (!addr || addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={color ? { color } : {}}>
        {value}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Analytics() {
  const [kpis, setKpis] = useState<AnalyticsKPIs | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [riskDist, setRiskDist] = useState<RiskDistributionItem[]>([]);
  const [assetBreakdown, setAssetBreakdown] = useState<AssetBreakdownItem[]>([]);
  const [patterns, setPatterns] = useState<PatternDetectionResult | null>(null);
  const [graph, setGraph] = useState<TransactionGraph | null>(null);
  const [topWallets, setTopWallets] = useState<TopWalletItem[]>([]);
  const [compliance, setCompliance] = useState<ComplianceOverviewItem[]>([]);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newDataAvailable, setNewDataAvailable] = useState(false);

  const { connectionStatus, lastEvent } = useWebSocket();

  const loadTimeSeries = useCallback(async () => {
    try {
      const res = await analyticsApi.getTimeSeries(period, range);
      setTimeSeries(res.data.data ?? []);
    } catch (err) {
      console.error('Failed to load time series:', err);
    }
  }, [period, range]);

  useEffect(() => {
    loadTimeSeries();
  }, [loadTimeSeries]);

  // Show refresh banner when KPI or transaction events arrive via WebSocket
  useEffect(() => {
    if (!lastEvent) return;
    if (
      lastEvent.type === 'KPI_UPDATE' ||
      lastEvent.type === 'TRANSACTION_CREATED' ||
      lastEvent.type === 'TRANSACTION_FLAGGED'
    ) {
      setNewDataAvailable(true);
    }
  }, [lastEvent]);

  const handleRefresh = useCallback(async () => {
    setNewDataAvailable(false);
    setLoading(true);
    try {
      const [
        kpisRes,
        riskRes,
        assetRes,
        walletsRes,
        complianceRes,
      ] = await Promise.all([
        analyticsApi.getKPIs(),
        analyticsApi.getRiskDistribution(),
        analyticsApi.getAssetBreakdown(),
        analyticsApi.getTopWallets(10, 'risk'),
        analyticsApi.getComplianceOverview(),
      ]);
      setKpis(kpisRes.data.data ?? null);
      setRiskDist(riskRes.data.data ?? []);
      setAssetBreakdown(assetRes.data.data ?? []);
      setTopWallets(walletsRes.data.data ?? []);
      setCompliance(complianceRes.data.data ?? []);
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [
          kpisRes,
          riskRes,
          assetRes,
          patternsRes,
          graphRes,
          walletsRes,
          complianceRes,
        ] = await Promise.all([
          analyticsApi.getKPIs(),
          analyticsApi.getRiskDistribution(),
          analyticsApi.getAssetBreakdown(),
          analyticsApi.getAllPatterns(),
          analyticsApi.getTransactionGraph(),
          analyticsApi.getTopWallets(10, 'risk'),
          analyticsApi.getComplianceOverview(),
        ]);
        setKpis(kpisRes.data.data ?? null);
        setRiskDist(riskRes.data.data ?? []);
        setAssetBreakdown(assetRes.data.data ?? []);
        setPatterns(patternsRes.data.data ?? null);
        setGraph(graphRes.data.data ?? null);
        setTopWallets(walletsRes.data.data ?? []);
        setCompliance(complianceRes.data.data ?? []);
      } catch (err) {
        console.error('Analytics load error:', err);
        setError('Failed to load analytics data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const periodOptions: Array<{ label: string; value: 'day' | 'week' | 'month'; range: number }> = [
    { label: '7D', value: 'day', range: 7 },
    { label: '30D', value: 'day', range: 30 },
    { label: '90D', value: 'day', range: 90 },
    { label: '12W', value: 'week', range: 12 },
    { label: '12M', value: 'month', range: 12 },
  ];

  return (
    <div className="page analytics-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics Dashboard</h1>
          <p className="page-subtitle">Advanced metrics, pattern detection & network analysis</p>
        </div>
        <div className="page-header-actions">
          <ConnectionStatus status={connectionStatus} />
          <ExportButton endpoint="/export/analytics" filename="analytics-report" />
        </div>
      </div>

      {newDataAvailable && (
        <div className="refresh-banner" onClick={() => void handleRefresh()}>
          📊 New data available — <strong>Click to refresh</strong>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-spinner">Loading analytics…</div>
      ) : (
        <>
          {/* ── KPI Grid ─────────────────────────────────────────── */}
          <div className="kpi-grid">
            <KpiCard
              label="Total Transactions"
              value={(kpis?.totalTransactions ?? 0).toLocaleString()}
              sub={`+${kpis?.totalTransactionsLast24h ?? 0} last 24 h`}
            />
            <KpiCard
              label="Total Volume"
              value={fmt(kpis?.totalVolumeUSD)}
              sub={`${fmt(kpis?.volumeLast7d)} last 7 d`}
            />
            <KpiCard
              label="Active Wallets"
              value={(kpis?.activeWallets ?? 0).toLocaleString()}
              sub={`${kpis?.flaggedWallets ?? 0} flagged · ${kpis?.sanctionedWallets ?? 0} sanctioned`}
              color={kpis?.flaggedWallets ? 'var(--warning)' : undefined}
            />
            <KpiCard
              label="Compliance Rate"
              value={`${kpis?.complianceRate ?? 0}%`}
              color={
                (kpis?.complianceRate ?? 0) >= 80
                  ? 'var(--success)'
                  : (kpis?.complianceRate ?? 0) >= 60
                  ? 'var(--warning)'
                  : 'var(--danger)'
              }
            />
            <KpiCard
              label="Open Cases"
              value={(kpis?.openCases ?? 0).toLocaleString()}
              sub={`${kpis?.criticalCases ?? 0} critical`}
              color={kpis?.criticalCases ? 'var(--danger)' : undefined}
            />
            <KpiCard
              label="Avg Risk Score"
              value={(kpis?.averageRiskScore ?? 0).toFixed(1)}
              color={
                (kpis?.averageRiskScore ?? 0) >= 75
                  ? 'var(--risk-critical)'
                  : (kpis?.averageRiskScore ?? 0) >= 50
                  ? 'var(--risk-high)'
                  : (kpis?.averageRiskScore ?? 0) >= 25
                  ? 'var(--risk-medium)'
                  : 'var(--risk-low)'
              }
            />
          </div>

          {/* ── Time Series ───────────────────────────────────────── */}
          <div className="chart-card">
            <div className="chart-card-header">
              <h2 className="chart-title">Transaction Volume Over Time</h2>
              <div className="chart-period-selector">
                {periodOptions.map((opt) => (
                  <button
                    key={opt.label}
                    className={`period-btn${period === opt.value && range === opt.range ? ' active' : ''}`}
                    onClick={() => {
                      setPeriod(opt.value);
                      setRange(opt.range);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={timeSeries}>
                <defs>
                  <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="flaggedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v.toLocaleString()}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                  }}
                />
                <Legend
                  wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 12 }}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="volumeUSD"
                  name="Volume (USD)"
                  stroke="#3b82f6"
                  fill="url(#volumeGrad)"
                  strokeWidth={2}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="flaggedCount"
                  name="Flagged Txns"
                  stroke="#ef4444"
                  fill="url(#flaggedGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Row: Risk Distribution + Compliance Overview ─────── */}
          <div className="chart-row two-col">
            {/* Risk Distribution Pie */}
            <div className="chart-card">
              <div className="chart-card-header">
                <h2 className="chart-title">Risk Distribution</h2>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={riskDist}
                    dataKey="count"
                    nameKey="level"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ level, percentage }) => `${level} ${percentage}%`}
                    labelLine={{ stroke: 'var(--text-muted)' }}
                  >
                    {riskDist.map((entry) => (
                      <Cell
                        key={entry.level}
                        fill={RISK_COLORS[entry.level] ?? '#6366f1'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Compliance Overview Pie */}
            <div className="chart-card">
              <div className="chart-card-header">
                <h2 className="chart-title">Compliance Overview</h2>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={compliance}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ status, percentage }) => `${status} ${percentage}%`}
                    labelLine={{ stroke: 'var(--text-muted)' }}
                  >
                    {compliance.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={COMPLIANCE_COLORS[entry.status] ?? '#6366f1'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Asset Breakdown Bar Chart ─────────────────────────── */}
          <div className="chart-card">
            <div className="chart-card-header">
              <h2 className="chart-title">Asset Breakdown (Top 10 by Volume)</h2>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={assetBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="asset"
                  width={60}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, 'Volume USD']}
                />
                <Bar dataKey="volumeUSD" name="Volume USD" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Row: Pattern Summary + Network Summary ────────────── */}
          <div className="chart-row two-col">
            {/* Pattern Detection */}
            <div className="chart-card pattern-summary">
              <div className="chart-card-header">
                <h2 className="chart-title">Pattern Detection</h2>
              </div>
              {patterns ? (
                <div className="pattern-grid">
                  {[
                    {
                      label: 'Structuring',
                      count: patterns.summary.structuringCount,
                      color: 'var(--risk-high)',
                      desc: 'Multiple txns just below CTR threshold',
                    },
                    {
                      label: 'Rapid Movement',
                      count: patterns.summary.rapidMovementCount,
                      color: 'var(--warning)',
                      desc: 'Funds in & out within 1 hour',
                    },
                    {
                      label: 'Layering',
                      count: patterns.summary.layeringCount,
                      color: 'var(--risk-critical)',
                      desc: '3+ hop decreasing chain',
                    },
                    {
                      label: 'Round-Tripping',
                      count: patterns.summary.roundTrippingCount,
                      color: 'var(--risk-medium)',
                      desc: 'Funds return to originator',
                    },
                  ].map((p) => (
                    <div key={p.label} className="pattern-item">
                      <div className="pattern-count" style={{ color: p.color }}>
                        {p.count}
                      </div>
                      <div className="pattern-name">{p.label}</div>
                      <div className="pattern-desc">{p.desc}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No pattern data available.</p>
              )}
              {patterns && (
                <div className="pattern-total">
                  Total patterns detected:{' '}
                  <strong style={{ color: 'var(--accent)' }}>
                    {patterns.summary.totalPatterns}
                  </strong>
                </div>
              )}
            </div>

            {/* Network Analysis Summary */}
            <div className="chart-card network-summary">
              <div className="chart-card-header">
                <h2 className="chart-title">Network Analysis</h2>
              </div>
              {graph ? (
                <>
                  <div className="network-stats">
                    <div className="network-stat">
                      <span className="ns-label">Graph Nodes</span>
                      <span className="ns-value">{graph.stats.totalNodes.toLocaleString()}</span>
                    </div>
                    <div className="network-stat">
                      <span className="ns-label">Graph Edges</span>
                      <span className="ns-value">{graph.stats.totalEdges.toLocaleString()}</span>
                    </div>
                    <div className="network-stat">
                      <span className="ns-label">Clusters</span>
                      <span className="ns-value">{graph.stats.clusters}</span>
                    </div>
                    <div className="network-stat">
                      <span className="ns-label">High-Risk Nodes</span>
                      <span
                        className="ns-value"
                        style={{
                          color: graph.stats.highRiskNodes > 0 ? 'var(--danger)' : 'var(--success)',
                        }}
                      >
                        {graph.stats.highRiskNodes}
                      </span>
                    </div>
                    <div className="network-stat">
                      <span className="ns-label">Density Score</span>
                      <span className="ns-value">{graph.stats.densityScore.toFixed(3)}</span>
                    </div>
                  </div>

                  {graph.nodes.length > 0 && (
                    <>
                      <h3 className="network-sub-title">Top Connected Wallets</h3>
                      <div className="network-top-list">
                        {graph.nodes
                          .sort((a, b) => b.transactionCount - a.transactionCount)
                          .slice(0, 5)
                          .map((node) => (
                            <div key={node.id} className="network-top-item">
                              <span className="nt-addr">{truncateAddress(node.id)}</span>
                              <span className="nt-txn">{node.transactionCount} txns</span>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="text-muted">No network data available.</p>
              )}
            </div>
          </div>

          {/* ── Top Flagged Wallets Table ──────────────────────────── */}
          <div className="chart-card">
            <div className="chart-card-header">
              <h2 className="chart-title">Top Wallets by Risk Score</h2>
            </div>
            {topWallets.length === 0 ? (
              <p className="text-muted" style={{ padding: '1rem' }}>
                No wallet data available.
              </p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th>Network</th>
                      <th>Risk Score</th>
                      <th>Risk Level</th>
                      <th>Transactions</th>
                      <th>Volume (USD)</th>
                      <th>Sanctioned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topWallets.map((w) => (
                      <tr key={w.address}>
                        <td>
                          <code className="addr-code">{truncateAddress(w.address)}</code>
                        </td>
                        <td>{w.network}</td>
                        <td>
                          <span
                            style={{
                              color:
                                w.riskScore >= 75
                                  ? 'var(--risk-critical)'
                                  : w.riskScore >= 50
                                  ? 'var(--risk-high)'
                                  : w.riskScore >= 25
                                  ? 'var(--risk-medium)'
                                  : 'var(--risk-low)',
                              fontWeight: 600,
                            }}
                          >
                            {w.riskScore}
                          </span>
                        </td>
                        <td>
                          <RiskBadge level={w.riskLevel} />
                        </td>
                        <td>{w.transactionCount.toLocaleString()}</td>
                        <td>{fmt(w.totalVolumeUSD)}</td>
                        <td>
                          {w.isSanctioned ? (
                            <span className="badge badge-danger">YES</span>
                          ) : (
                            <span className="badge badge-success">NO</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
