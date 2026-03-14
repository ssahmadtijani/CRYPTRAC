import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authorityApi } from '../api/authority';
import {
  TaxAuthorityDashboard,
  TaxpayerSummary,
  TaxAssessment,
  TaxableEvent,
  ExchangeTaxBreakdown,
} from '../types';
import StatsCard from '../components/StatsCard';

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtNGN = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

// ---------------------------------------------------------------------------
// Sub-pages
// ---------------------------------------------------------------------------

function AuthorityDashboardPage() {
  const [data, setData] = useState<TaxAuthorityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    authorityApi.getDashboard().then((res) => {
      setData(res.data.data ?? null);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-spinner" />;
  if (!data) return <div className="alert alert-error">Failed to load dashboard</div>;

  const maxExchangeTax = Math.max(...data.byExchange.map((e) => e.totalTaxNGN), 1);
  const maxQuarterTax = Math.max(...data.byQuarter.map((q) => q.taxNGN), 1);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(16,185,129,0.08) 100%)',
          borderRadius: 'var(--radius)',
          padding: '1.5rem 2rem',
          marginBottom: '1.5rem',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '2.5rem' }}>🏛️</span>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Federal Inland Revenue Service (FIRS)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              CRYPTRAC Tax Authority Portal
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Custodian Dashboard — Crypto Tax Compliance Overview
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <StatsCard
          title="Total Registered Taxpayers"
          value={data.totalTaxpayers.toLocaleString()}
          subtitle="crypto traders on record"
          accent="default"
        />
        <StatsCard
          title="Total Tax Liability"
          value={fmtNGN(data.totalTaxLiabilityNGN)}
          subtitle={`≈ ${fmtUSD(data.totalTaxLiabilityUSD)}`}
          accent="warning"
        />
        <StatsCard
          title="Tax Collected"
          value={fmtNGN(data.taxCollectedNGN)}
          subtitle={`Outstanding: ${fmtNGN(data.taxOutstandingNGN)}`}
          accent="success"
        />
        <StatsCard
          title="Flagged / High-Value"
          value={data.flaggedAssessments}
          subtitle="assessments > ₦10M"
          accent="danger"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
        {/* Exchange Bar Chart */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 600 }}>
            Tax Liability by Exchange
          </h3>
          {data.byExchange.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No data yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.byExchange.map((ex) => (
                <div key={ex.exchangeName}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 500 }}>{ex.exchangeName}</span>
                    <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                      {fmtNGN(ex.totalTaxNGN)}
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-base)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${(ex.totalTaxNGN / maxExchangeTax) * 100}%`,
                        background: 'var(--accent)',
                        borderRadius: '4px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {ex.transactionCount.toLocaleString()} txns · {fmtUSD(ex.totalVolumeUSD)} volume
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quarterly Chart */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 600 }}>
            Tax Liability by Quarter
          </h3>
          {data.byQuarter.every((q) => q.taxNGN === 0) ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No quarterly data yet
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '120px' }}>
              {data.byQuarter.filter((q) => q.taxNGN > 0).map((q) => (
                <div key={q.period} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    {fmtNGN(q.taxNGN).replace('₦', '').replace(',000', 'k').replace(',000,000', 'M')}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: `${(q.taxNGN / maxQuarterTax) * 90}px`,
                      background: 'linear-gradient(to top, var(--accent), rgba(59,130,246,0.4))',
                      borderRadius: '4px 4px 0 0',
                      minHeight: '4px',
                    }}
                  />
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.25rem', textAlign: 'center' }}>
                    {q.period.replace('2025-', '')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent High-Value Assessments */}
      {data.recentHighValueAssessments.length > 0 && (
        <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>High-Value Assessments</h3>
            <Link to="/authority/taxpayers" style={{ fontSize: '0.875rem', color: 'var(--accent)' }}>
              View All Taxpayers →
            </Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Period</th>
                <th>Events</th>
                <th>Net Gain</th>
                <th>Tax Liability (NGN)</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.recentHighValueAssessments.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {a.userId.slice(0, 12)}…
                  </td>
                  <td>{a.taxYear} {a.period}</td>
                  <td>{a.totalTaxableEvents}</td>
                  <td style={{ color: a.netCapitalGainUSD >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {fmtUSD(a.netCapitalGainUSD)}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--warning)' }}>
                    {fmtNGN(a.totalTaxLiabilityNGN)}
                  </td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      background: 'rgba(59,130,246,0.12)',
                      color: 'var(--accent)',
                    }}>
                      {a.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => navigate(`/authority/taxpayers/${a.userId}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginTop: '1.5rem' }}>
        <StatsCard
          title="Transactions Processed"
          value={data.totalTransactionsProcessed.toLocaleString()}
          subtitle="total exchange transactions"
          accent="default"
        />
        <StatsCard
          title="Exchange Coverage"
          value={`${data.byExchange.length} Exchanges`}
          subtitle="Binance · Luno · Quidax"
          accent="default"
        />
        <StatsCard
          title="Tax Rate Applied"
          value="10%"
          subtitle="Nigerian crypto flat rate"
          accent="default"
        />
      </div>
    </div>
  );
}

function TaxpayerDetailPage({ userId }: { userId: string }) {
  const [data, setData] = useState<{
    user: { id: string; email: string; firstName: string; lastName: string; role: string };
    summary: TaxpayerSummary;
    assessments: TaxAssessment[];
    recentEvents: TaxableEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    authorityApi.getTaxpayer(userId).then((res) => {
      setData(res.data.data ?? null);
    }).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="loading-spinner" />;
  if (!data) return <div className="alert alert-error">Taxpayer not found</div>;

  const { user, summary, assessments, recentEvents } = data;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/authority/taxpayers')}>
          ← Back
        </button>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            {user.firstName} {user.lastName}
          </h2>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {user.email} · {user.role}
          </div>
        </div>
        {summary.isFlagged && (
          <span style={{
            marginLeft: 'auto',
            padding: '0.3rem 0.8rem',
            background: 'rgba(239,68,68,0.15)',
            color: 'var(--danger)',
            borderRadius: '99px',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}>
            ⚠️ High-Value Taxpayer
          </span>
        )}
      </div>

      {/* Summary KPIs */}
      <div className="stats-grid">
        <StatsCard
          title="Tax Liability (NGN)"
          value={fmtNGN(summary.totalTaxLiabilityNGN)}
          subtitle={`≈ ${fmtUSD(summary.totalTaxLiabilityUSD)}`}
          accent="danger"
        />
        <StatsCard
          title="Total Volume"
          value={fmtUSD(summary.totalVolumeUSD)}
          subtitle="across all exchanges"
          accent="default"
        />
        <StatsCard
          title="Transactions"
          value={summary.totalTransactions}
          subtitle="processed"
          accent="default"
        />
        <StatsCard
          title="Connected Exchanges"
          value={summary.exchanges.join(', ') || 'None'}
          subtitle={`${summary.exchanges.length} exchange(s)`}
          accent="default"
        />
      </div>

      {/* Assessments */}
      {assessments.length > 0 && (
        <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
            Tax Assessments
          </h3>
          <table className="table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Period</th>
                <th>Events</th>
                <th>Proceeds</th>
                <th>Cost Basis</th>
                <th>Net Gain</th>
                <th>Tax (NGN)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id}>
                  <td>{a.taxYear}</td>
                  <td>{a.period}</td>
                  <td>{a.totalTaxableEvents}</td>
                  <td>{fmtUSD(a.totalProceedsUSD)}</td>
                  <td>{fmtUSD(a.totalCostBasisUSD)}</td>
                  <td style={{ color: a.netCapitalGainUSD >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {fmtUSD(a.netCapitalGainUSD)}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--warning)' }}>
                    {fmtNGN(a.totalTaxLiabilityNGN)}
                  </td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      background: 'rgba(59,130,246,0.12)',
                      color: 'var(--accent)',
                    }}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
            Recent Taxable Events
          </h3>
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Asset</th>
                <th>Exchange</th>
                <th>Proceeds</th>
                <th>Gain/Loss</th>
                <th>Tax (NGN)</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.slice(-15).reverse().map((e) => (
                <tr key={e.id}>
                  <td style={{ fontSize: '0.8rem' }}>{e.type.replace(/_/g, ' ')}</td>
                  <td style={{ fontWeight: 600 }}>{e.asset}</td>
                  <td>{e.exchange}</td>
                  <td>{fmtUSD(e.proceedsUSD)}</td>
                  <td style={{ color: e.gainLossUSD >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {e.gainLossUSD >= 0 ? '+' : ''}{fmtUSD(e.gainLossUSD)}
                  </td>
                  <td style={{ color: 'var(--warning)', fontWeight: 500 }}>
                    {fmtNGN(e.taxAmountNGN)}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {new Date(e.timestamp).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExchangesOverviewPage() {
  const [exchanges, setExchanges] = useState<ExchangeTaxBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authorityApi.getExchanges().then((res) => {
      setExchanges(res.data.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const totalTaxNGN = exchanges.reduce((s, e) => s + e.totalTaxNGN, 0);
  const totalVolume = exchanges.reduce((s, e) => s + e.totalVolumeUSD, 0);
  const totalTxns = exchanges.reduce((s, e) => s + e.transactionCount, 0);

  return (
    <div>
      <div className="page-header">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Exchange Overview</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Tax liability and activity breakdown by exchange
        </p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <StatsCard title="Total Tax (NGN)" value={fmtNGN(totalTaxNGN)} accent="warning" />
        <StatsCard title="Total Volume" value={fmtUSD(totalVolume)} accent="default" />
        <StatsCard title="Total Transactions" value={totalTxns.toLocaleString()} accent="default" />
      </div>

      {loading ? (
        <div className="loading-spinner" />
      ) : exchanges.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ color: 'var(--text-muted)' }}>No exchange data yet — seed demo data first</div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Exchange</th>
                <th>Transactions</th>
                <th>Total Volume (USD)</th>
                <th>Gain / Loss (USD)</th>
                <th>Tax (USD)</th>
                <th>Tax (NGN)</th>
                <th>% of Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {exchanges.map((ex) => (
                <tr key={ex.exchangeName}>
                  <td style={{ fontWeight: 600, fontSize: '1.05rem' }}>{ex.exchangeName}</td>
                  <td>{ex.transactionCount.toLocaleString()}</td>
                  <td>{fmtUSD(ex.totalVolumeUSD)}</td>
                  <td style={{ color: ex.totalGainLossUSD >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {ex.totalGainLossUSD >= 0 ? '+' : ''}{fmtUSD(ex.totalGainLossUSD)}
                  </td>
                  <td>{fmtUSD(ex.totalTaxUSD)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--warning)' }}>
                    {fmtNGN(ex.totalTaxNGN)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--bg-base)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${totalTaxNGN > 0 ? (ex.totalTaxNGN / totalTaxNGN) * 100 : 0}%`,
                            background: 'var(--accent)',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.8rem', minWidth: '2.5rem' }}>
                        {totalTaxNGN > 0 ? ((ex.totalTaxNGN / totalTaxNGN) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Authority component — acts as layout + router
// ---------------------------------------------------------------------------

export default function Authority() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'taxpayers' | 'exchanges'>('dashboard');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'taxpayers', label: '👥 Taxpayers' },
    { id: 'exchanges', label: '🏦 Exchanges' },
  ] as const;

  const handleTaxpayerSelect = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('taxpayers');
  };

  return (
    <div className="page">
      {/* Authority Portal Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">🏛️ Authority Portal</h1>
            <p className="page-subtitle">
              FIRS Custodian Dashboard — Read-only regulatory view of all crypto tax data
            </p>
          </div>
          <span
            style={{
              padding: '0.4rem 1rem',
              background: 'rgba(16,185,129,0.12)',
              color: 'var(--success)',
              borderRadius: '99px',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: '1px solid rgba(16,185,129,0.3)',
            }}
          >
            🔒 Authorized Access
          </span>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedUserId(null); }}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 600 : 400,
                fontSize: '0.9rem',
                marginBottom: '-1px',
                transition: 'var(--transition)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && (
        <AuthorityDashboardPage />
      )}
      {activeTab === 'taxpayers' && !selectedUserId && (
        <TaxpayersPageWithSelect onSelect={handleTaxpayerSelect} />
      )}
      {activeTab === 'taxpayers' && selectedUserId && (
        <TaxpayerDetailPage userId={selectedUserId} />
      )}
      {activeTab === 'exchanges' && (
        <ExchangesOverviewPage />
      )}
    </div>
  );
}

// Wrapper to pass onSelect prop
function TaxpayersPageWithSelect({ onSelect }: { onSelect: (id: string) => void }) {
  const [taxpayers, setTaxpayers] = useState<TaxpayerSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'tax' | 'volume' | 'name'>('tax');

  useEffect(() => {
    authorityApi.getTaxpayers().then((res) => {
      setTaxpayers(res.data.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = taxpayers
    .filter((t) => {
      const q = search.toLowerCase();
      return (
        t.email.toLowerCase().includes(q) ||
        t.firstName.toLowerCase().includes(q) ||
        t.lastName.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'tax') return b.totalTaxLiabilityNGN - a.totalTaxLiabilityNGN;
      if (sortBy === 'volume') return b.totalVolumeUSD - a.totalVolumeUSD;
      return a.lastName.localeCompare(b.lastName);
    });

  return (
    <div>
      <div className="page-header">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>All Taxpayers</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {taxpayers.length} registered crypto traders
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1', minWidth: '200px' }}
        />
        <select
          className="form-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'tax' | 'volume' | 'name')}
          style={{ width: 'auto' }}
        >
          <option value="tax">Sort by Tax Liability</option>
          <option value="volume">Sort by Volume</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-spinner" />
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ color: 'var(--text-muted)' }}>
            No taxpayers found{search ? ` matching "${search}"` : ' — seed demo data first'}
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Exchanges</th>
                <th>Transactions</th>
                <th>Total Volume</th>
                <th>Tax Liability (NGN)</th>
                <th>Status</th>
                <th>Flag</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.userId} style={{ cursor: 'pointer' }} onClick={() => onSelect(t.userId)}>
                  <td style={{ fontWeight: 500 }}>
                    {t.firstName} {t.lastName}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t.email}</td>
                  <td>{t.exchanges.join(', ') || '—'}</td>
                  <td>{t.totalTransactions}</td>
                  <td>{fmtUSD(t.totalVolumeUSD)}</td>
                  <td style={{ fontWeight: 700, color: t.totalTaxLiabilityNGN > 1_000_000 ? 'var(--warning)' : 'var(--text-primary)' }}>
                    {fmtNGN(t.totalTaxLiabilityNGN)}
                  </td>
                  <td>
                    {t.latestAssessmentStatus ? (
                      <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background: 'rgba(59,130,246,0.12)',
                        color: 'var(--accent)',
                      }}>
                        {t.latestAssessmentStatus}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td>
                    {t.isFlagged && (
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>⚠️</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      Details →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// TaxpayerDetailPage is used internally

