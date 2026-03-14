import { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { taxApi } from '../api/tax';
import {
  TaxAssessment,
  TaxableEvent,
  TaxEventType,
  AssessmentPeriod,
  ApiResponse,
} from '../types';
import StatsCard from '../components/StatsCard';
import Toast from '../components/Toast';
import ExportButton from '../components/ExportButton';

// USD_TO_NGN mirrors the backend constant (src/services/tax-engine.service.ts).
// Both must be updated together if the rate changes.
const USD_TO_NGN = 1550;

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

const fmtNGN = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

const EVENT_TYPE_LABELS: Record<TaxEventType, string> = {
  [TaxEventType.CAPITAL_GAIN_SHORT]: 'Short-Term Gain',
  [TaxEventType.CAPITAL_GAIN_LONG]: 'Long-Term Gain',
  [TaxEventType.INCOME]: 'Income',
  [TaxEventType.MINING_INCOME]: 'Mining Income',
  [TaxEventType.STAKING_REWARD]: 'Staking Reward',
  [TaxEventType.AIRDROP_INCOME]: 'Airdrop',
};

const PERIODS: AssessmentPeriod[] = ['Q1', 'Q2', 'Q3', 'Q4', 'ANNUAL'];

export default function Tax() {
  const [assessments, setAssessments] = useState<TaxAssessment[]>([]);
  const [events, setEvents] = useState<TaxableEvent[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<TaxAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [taxYear, setTaxYear] = useState(2025);
  const [period, setPeriod] = useState<AssessmentPeriod>('ANNUAL');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    try {
      const [assessRes, eventsRes] = await Promise.all([
        taxApi.getAssessments(),
        taxApi.getEvents(),
      ]);
      setAssessments(assessRes.data.data ?? []);
      setEvents(eventsRes.data.data ?? []);
    } catch {
      /* no-op on initial empty state */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await taxApi.process();
      const d = res.data.data;
      setToast({
        message: `Processed ${d?.processed ?? 0} transactions → ${d?.taxableEvents ?? 0} taxable events`,
        type: 'success',
      });
      await fetchData();
    } catch (err) {
      const axErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message: axErr.response?.data?.error?.message ?? 'Processing failed',
        type: 'error',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateAssessment = async () => {
    setGenerating(true);
    try {
      const res = await taxApi.generateAssessment(taxYear, period);
      const assessment = res.data.data!;
      setToast({
        message: `Assessment generated: ${fmtNGN(assessment.totalTaxLiabilityNGN)} tax liability`,
        type: 'success',
      });
      await fetchData();
      setSelectedAssessment(assessment);
    } catch (err) {
      const axErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message: axErr.response?.data?.error?.message ?? 'Assessment failed',
        type: 'error',
      });
    } finally {
      setGenerating(false);
    }
  };

  const totalTaxNGN = assessments.reduce((s, a) => s + a.totalTaxLiabilityNGN, 0);
  const totalTaxUSD = assessments.reduce((s, a) => s + a.totalTaxLiabilityUSD, 0);
  const totalGains = assessments.reduce((s, a) => s + a.netCapitalGainUSD, 0);
  const totalIncome = assessments.reduce((s, a) => s + a.totalIncomeUSD, 0);

  const display = selectedAssessment ?? assessments[assessments.length - 1] ?? null;

  return (
    <div className="page">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Tax Summary</h1>
          <p className="page-subtitle">
            Calculate your Nigerian crypto tax liability — Capital gains (10%) + Income (10%)
          </p>
        </div>
        <ExportButton endpoint="/export/tax-assessments" filename="tax-assessments" />
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={handleProcess}
          disabled={processing}
        >
          {processing ? 'Processing…' : '⚙️ Process Transactions'}
        </button>

        <select
          className="form-select"
          value={taxYear}
          onChange={(e) => setTaxYear(Number(e.target.value))}
          style={{ width: 'auto' }}
        >
          <option value={2024}>2024</option>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </select>

        <select
          className="form-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value as AssessmentPeriod)}
          style={{ width: 'auto' }}
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <button
          className="btn btn-secondary"
          onClick={handleGenerateAssessment}
          disabled={generating}
        >
          {generating ? 'Calculating…' : '📊 Calculate Tax'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <StatsCard
          title="Total Tax Liability (NGN)"
          value={fmtNGN(totalTaxNGN)}
          subtitle={`≈ ${fmtUSD(totalTaxUSD)} USD`}
          accent="danger"
        />
        <StatsCard
          title="Net Capital Gains"
          value={fmtUSD(totalGains)}
          subtitle={`at 10% Nigerian rate`}
          accent={totalGains >= 0 ? 'success' : 'warning'}
        />
        <StatsCard
          title="Total Income"
          value={fmtUSD(totalIncome)}
          subtitle="Staking + Mining + Airdrops"
          accent="default"
        />
        <StatsCard
          title="Taxable Events"
          value={events.length}
          subtitle={`from ${assessments.length} assessment(s)`}
          accent="default"
        />
      </div>

      {/* Selected Assessment Detail */}
      {!loading && display && (
        <>
          <div className="page-header" style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              Assessment: {display.taxYear} {display.period}
              <span
                style={{
                  marginLeft: '0.75rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '99px',
                  fontSize: '0.75rem',
                  background: 'rgba(59,130,246,0.15)',
                  color: 'var(--accent)',
                }}
              >
                {display.status}
              </span>
            </h2>
          </div>

          {/* Big NGN liability */}
          <div
            className="card"
            style={{
              padding: '2rem',
              marginBottom: '1.5rem',
              borderLeft: '4px solid var(--danger)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Total Tax Liability
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--danger)' }}>
                {fmtNGN(display.totalTaxLiabilityNGN)}
              </div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                ≈ {fmtUSD(display.totalTaxLiabilityUSD)}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Capital Gains Tax</div>
                <div style={{ fontWeight: 600 }}>{fmtNGN(display.capitalGainsTaxUSD * USD_TO_NGN)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Income Tax</div>
                <div style={{ fontWeight: 600 }}>{fmtNGN(display.incomeTaxUSD * USD_TO_NGN)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Total Proceeds</div>
                <div style={{ fontWeight: 600 }}>{fmtUSD(display.totalProceedsUSD)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Cost Basis</div>
                <div style={{ fontWeight: 600 }}>{fmtUSD(display.totalCostBasisUSD)}</div>
              </div>
            </div>
          </div>

          {/* Exchange Breakdown */}
          {display.exchangeBreakdown.length > 0 && (
            <>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600 }}>
                Breakdown by Exchange
              </h3>
              <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Exchange</th>
                      <th>Transactions</th>
                      <th>Volume (USD)</th>
                      <th>Gain / Loss</th>
                      <th>Tax (NGN)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {display.exchangeBreakdown.map((eb) => (
                      <tr key={eb.exchangeName}>
                        <td style={{ fontWeight: 600 }}>{eb.exchangeName}</td>
                        <td>{eb.transactionCount}</td>
                        <td>{fmtUSD(eb.totalVolumeUSD)}</td>
                        <td style={{ color: eb.totalGainLossUSD >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {eb.totalGainLossUSD >= 0 ? '+' : ''}{fmtUSD(eb.totalGainLossUSD)}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--warning)' }}>
                          {fmtNGN(eb.totalTaxNGN)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* Taxable Events */}
      {events.length > 0 && (
        <>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600 }}>
            Taxable Events ({events.length})
          </h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Asset</th>
                  <th>Exchange</th>
                  <th>Proceeds</th>
                  <th>Cost Basis</th>
                  <th>Gain/Loss</th>
                  <th>Tax (NGN)</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(-30).reverse().map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          background:
                            e.type.includes('GAIN')
                              ? 'rgba(59,130,246,0.12)'
                              : 'rgba(245,158,11,0.12)',
                          color: e.type.includes('GAIN') ? 'var(--accent)' : 'var(--warning)',
                        }}
                      >
                        {EVENT_TYPE_LABELS[e.type]}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{e.asset}</td>
                    <td>{e.exchange}</td>
                    <td>{fmtUSD(e.proceedsUSD)}</td>
                    <td>{fmtUSD(e.costBasisUSD)}</td>
                    <td
                      style={{
                        color: e.gainLossUSD >= 0 ? 'var(--success)' : 'var(--danger)',
                        fontWeight: 600,
                      }}
                    >
                      {e.gainLossUSD >= 0 ? '+' : ''}{fmtUSD(e.gainLossUSD)}
                    </td>
                    <td style={{ color: 'var(--warning)', fontWeight: 500 }}>
                      {fmtNGN(e.taxAmountNGN)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(e.timestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Previous Assessments */}
      {assessments.length > 1 && (
        <>
          <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600 }}>
            Previous Assessments
          </h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Period</th>
                  <th>Taxable Events</th>
                  <th>Net Gain</th>
                  <th>Total Income</th>
                  <th>Tax Liability (NGN)</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...assessments].reverse().map((a) => (
                  <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedAssessment(a)}>
                    <td>{a.taxYear}</td>
                    <td>{a.period}</td>
                    <td>{a.totalTaxableEvents}</td>
                    <td style={{ color: a.netCapitalGainUSD >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {fmtUSD(a.netCapitalGainUSD)}
                    </td>
                    <td>{fmtUSD(a.totalIncomeUSD)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--warning)' }}>
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
                      <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && assessments.length === 0 && events.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', marginTop: '1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            No tax data yet
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Connect your exchanges, then click "Process Transactions" to calculate your tax liability
          </div>
        </div>
      )}
    </div>
  );
}
