import { useEffect, useState, FormEvent } from 'react';
import { travelRuleApi } from '../api/travel-rule';
import {
  TravelRuleRecord,
  TravelRuleStats,
  VASPInfo,
  TravelRuleStatus,
  OriginatorInfo,
  BeneficiaryInfo,
} from '../types';
import StatsCard from '../components/StatsCard';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';
import { ApiResponse } from '../types';

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function TravelRuleStatusBadge({ status }: { status: TravelRuleStatus }) {
  const cls: Record<TravelRuleStatus, string> = {
    [TravelRuleStatus.COMPLIANT]: 'badge compliance-badge-compliant',
    [TravelRuleStatus.NON_COMPLIANT]: 'badge compliance-badge-non-compliant',
    [TravelRuleStatus.PENDING]: 'badge compliance-badge-pending',
    [TravelRuleStatus.EXEMPT]: 'badge compliance-badge-exempt',
    [TravelRuleStatus.EXPIRED]: 'badge compliance-badge-expired',
    [TravelRuleStatus.ORIGINATOR_INFO_COLLECTED]: 'badge compliance-badge-pending',
    [TravelRuleStatus.BENEFICIARY_INFO_REQUESTED]: 'badge compliance-badge-pending',
    [TravelRuleStatus.BENEFICIARY_INFO_RECEIVED]: 'badge compliance-badge-pending',
  };
  return <span className={cls[status]}>{status.replace(/_/g, ' ')}</span>;
}

// ---------------------------------------------------------------------------
// Default form state helpers
// ---------------------------------------------------------------------------

function emptyOriginator(): OriginatorInfo {
  return { name: '', accountNumber: '', country: '', institutionName: '' };
}

function emptyBeneficiary(): BeneficiaryInfo {
  return { name: '', accountNumber: '', country: '' };
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TravelRule() {
  const [activeTab, setActiveTab] = useState<'records' | 'vasps'>('records');
  const [records, setRecords] = useState<TravelRuleRecord[]>([]);
  const [stats, setStats] = useState<TravelRuleStats | null>(null);
  const [vasps, setVasps] = useState<VASPInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAbove, setFilterAbove] = useState('');

  // Modals
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [showVASPModal, setShowVASPModal] = useState(false);

  // Initiate form
  const [initiateForm, setInitiateForm] = useState({
    transactionId: '',
    amount: '',
    amountUSD: '',
    asset: '',
    network: '',
    originator: emptyOriginator(),
    beneficiary: emptyBeneficiary(),
  });

  // VASP form
  const [vaspForm, setVaspForm] = useState({
    name: '',
    registrationNumber: '',
    country: '',
    regulatoryAuthority: '',
    isVerified: false,
    supportedNetworks: '',
    leiCode: '',
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: { status?: TravelRuleStatus; isAboveThreshold?: boolean } = {};
      if (filterStatus) params.status = filterStatus as TravelRuleStatus;
      if (filterAbove !== '') params.isAboveThreshold = filterAbove === 'true';

      const [recRes, statsRes, vaspsRes] = await Promise.all([
        travelRuleApi.getRecords(params),
        travelRuleApi.getStats(),
        travelRuleApi.getVASPs(),
      ]);

      setRecords(recRes.data.data as unknown as TravelRuleRecord[]);
      setStats(statsRes.data.data ?? null);
      setVasps(vaspsRes.data.data as unknown as VASPInfo[]);
    } catch {
      showToast('Failed to load travel rule data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterAbove]);

  const handleInitiateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await travelRuleApi.initiate({
        transactionId: initiateForm.transactionId,
        amount: parseFloat(initiateForm.amount) || 0,
        amountUSD: parseFloat(initiateForm.amountUSD),
        asset: initiateForm.asset,
        network: initiateForm.network,
        originatorInfo: initiateForm.originator,
        beneficiaryInfo: initiateForm.beneficiary,
      });
      showToast('Travel rule initiated successfully', 'success');
      setShowInitiateModal(false);
      setInitiateForm({ transactionId: '', amount: '', amountUSD: '', asset: '', network: '', originator: emptyOriginator(), beneficiary: emptyBeneficiary() });
      fetchData();
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse<unknown>>).response?.data?.error?.toString() || 'Failed to initiate travel rule';
      showToast(msg, 'error');
    }
  };

  const handleVASPSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await travelRuleApi.registerVASP({
        name: vaspForm.name,
        registrationNumber: vaspForm.registrationNumber,
        country: vaspForm.country,
        regulatoryAuthority: vaspForm.regulatoryAuthority,
        isVerified: vaspForm.isVerified,
        supportedNetworks: vaspForm.supportedNetworks.split(',').map((s) => s.trim()).filter(Boolean),
        leiCode: vaspForm.leiCode || undefined,
      });
      showToast('VASP registered successfully', 'success');
      setShowVASPModal(false);
      fetchData();
    } catch (err) {
      const msg = (err as AxiosError<ApiResponse<unknown>>).response?.data?.error?.toString() || 'Failed to register VASP';
      showToast(msg, 'error');
    }
  };

  const handleComplianceCheck = async (id: string) => {
    try {
      const res = await travelRuleApi.complianceCheck(id);
      const result = res.data.data;
      if (!result) {
        showToast('Compliance check failed', 'error');
        return;
      }
      if (result.isCompliant) {
        showToast('✅ Record is compliant', 'success');
      } else {
        showToast(`⚠️ Non-compliant: Missing ${result.missingFields.join(', ')}`, 'error');
      }
    } catch {
      showToast('Failed to run compliance check', 'error');
    }
  };

  return (
    <div className="travel-rule-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Travel Rule Compliance</h1>
          <p className="page-subtitle">FATF Recommendation 16 — VASP information exchange</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowInitiateModal(true)}>
            + Initiate Travel Rule
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <StatsCard title="Total Records" value={stats.total} />
          <StatsCard title="Compliance Rate" value={`${stats.complianceRate}%`} />
          <StatsCard title="Pending" value={stats.pending} />
          <StatsCard title="Non-Compliant" value={stats.nonCompliant} />
        </div>
      )}

      {/* Tabs */}
      <div className="tab-nav">
        <button
          className={`tab-nav-btn${activeTab === 'records' ? ' active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          Records
        </button>
        <button
          className={`tab-nav-btn${activeTab === 'vasps' ? ' active' : ''}`}
          onClick={() => setActiveTab('vasps')}
        >
          VASP Directory
        </button>
      </div>

      {/* Records Tab */}
      {activeTab === 'records' && (
        <div className="card">
          {/* Filters */}
          <div className="filter-bar" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <select
              className="input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="">All Statuses</option>
              {Object.values(TravelRuleStatus).map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              className="input"
              value={filterAbove}
              onChange={(e) => setFilterAbove(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="">All Amounts</option>
              <option value="true">Above Threshold</option>
              <option value="false">Below Threshold</option>
            </select>
          </div>

          {loading ? (
            <div className="loading-spinner" />
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Transaction</th>
                    <th>Amount (USD)</th>
                    <th>Status</th>
                    <th>Originator</th>
                    <th>Beneficiary</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No travel rule records found
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => (
                      <tr key={r.id} className={r.status === TravelRuleStatus.NON_COMPLIANT ? 'overdue-highlight' : ''}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.id.slice(0, 8)}…</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.transactionId.slice(0, 8)}…</td>
                        <td>${r.amountUSD.toLocaleString()}</td>
                        <td><TravelRuleStatusBadge status={r.status} /></td>
                        <td>{r.originatorInfo.name}</td>
                        <td>{r.beneficiaryInfo.name}</td>
                        <td>{new Date(r.expiresAt).toLocaleDateString()}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleComplianceCheck(r.id)}
                          >
                            Check
                          </button>
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

      {/* VASP Directory Tab */}
      {activeTab === 'vasps' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setShowVASPModal(true)}>
              + Register VASP
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Country</th>
                  <th>LEI Code</th>
                  <th>Authority</th>
                  <th>Verified</th>
                  <th>Networks</th>
                </tr>
              </thead>
              <tbody>
                {vasps.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No VASPs registered
                    </td>
                  </tr>
                ) : (
                  vasps.map((v) => (
                    <tr key={v.id}>
                      <td>{v.name}</td>
                      <td>{v.country}</td>
                      <td>{v.leiCode || '—'}</td>
                      <td>{v.regulatoryAuthority}</td>
                      <td>{v.isVerified ? '✅' : '✗'}</td>
                      <td>{v.supportedNetworks.join(', ') || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Initiate Travel Rule Modal */}
      {showInitiateModal && (
        <div className="modal-overlay" onClick={() => setShowInitiateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Initiate Travel Rule</h2>
              <button className="modal-close" onClick={() => setShowInitiateModal(false)}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleInitiateSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Transaction ID *</label>
                  <input
                    className="input"
                    required
                    value={initiateForm.transactionId}
                    onChange={(e) => setInitiateForm({ ...initiateForm, transactionId: e.target.value })}
                    placeholder="Transaction ID"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount USD *</label>
                  <input
                    className="input"
                    type="number"
                    required
                    value={initiateForm.amountUSD}
                    onChange={(e) => setInitiateForm({ ...initiateForm, amountUSD: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Asset *</label>
                  <input className="input" required value={initiateForm.asset} onChange={(e) => setInitiateForm({ ...initiateForm, asset: e.target.value })} placeholder="e.g. BTC" />
                </div>
                <div className="form-group">
                  <label className="form-label">Network *</label>
                  <input className="input" required value={initiateForm.network} onChange={(e) => setInitiateForm({ ...initiateForm, network: e.target.value })} placeholder="e.g. bitcoin" />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Originator Information</h4>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="input" required value={initiateForm.originator.name} onChange={(e) => setInitiateForm({ ...initiateForm, originator: { ...initiateForm.originator, name: e.target.value } })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Wallet Address *</label>
                  <input className="input" required value={initiateForm.originator.accountNumber} onChange={(e) => setInitiateForm({ ...initiateForm, originator: { ...initiateForm.originator, accountNumber: e.target.value } })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Country *</label>
                  <input className="input" required value={initiateForm.originator.country} onChange={(e) => setInitiateForm({ ...initiateForm, originator: { ...initiateForm.originator, country: e.target.value } })} placeholder="e.g. NG" />
                </div>
                <div className="form-group">
                  <label className="form-label">Institution</label>
                  <input className="input" value={initiateForm.originator.institutionName || ''} onChange={(e) => setInitiateForm({ ...initiateForm, originator: { ...initiateForm.originator, institutionName: e.target.value } })} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Beneficiary Information</h4>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="input" required value={initiateForm.beneficiary.name} onChange={(e) => setInitiateForm({ ...initiateForm, beneficiary: { ...initiateForm.beneficiary, name: e.target.value } })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Wallet Address *</label>
                  <input className="input" required value={initiateForm.beneficiary.accountNumber} onChange={(e) => setInitiateForm({ ...initiateForm, beneficiary: { ...initiateForm.beneficiary, accountNumber: e.target.value } })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input className="input" value={initiateForm.beneficiary.country || ''} onChange={(e) => setInitiateForm({ ...initiateForm, beneficiary: { ...initiateForm.beneficiary, country: e.target.value } })} placeholder="e.g. US" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowInitiateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Initiate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register VASP Modal */}
      {showVASPModal && (
        <div className="modal-overlay" onClick={() => setShowVASPModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register VASP</h2>
              <button className="modal-close" onClick={() => setShowVASPModal(false)}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleVASPSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="input" required value={vaspForm.name} onChange={(e) => setVaspForm({ ...vaspForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Registration Number *</label>
                  <input className="input" required value={vaspForm.registrationNumber} onChange={(e) => setVaspForm({ ...vaspForm, registrationNumber: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Country *</label>
                  <input className="input" required value={vaspForm.country} onChange={(e) => setVaspForm({ ...vaspForm, country: e.target.value })} placeholder="e.g. NG" />
                </div>
                <div className="form-group">
                  <label className="form-label">Regulatory Authority *</label>
                  <input className="input" required value={vaspForm.regulatoryAuthority} onChange={(e) => setVaspForm({ ...vaspForm, regulatoryAuthority: e.target.value })} placeholder="e.g. CBN, FinCEN" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">LEI Code</label>
                  <input className="input" value={vaspForm.leiCode} onChange={(e) => setVaspForm({ ...vaspForm, leiCode: e.target.value })} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Networks (comma-separated)</label>
                  <input className="input" value={vaspForm.supportedNetworks} onChange={(e) => setVaspForm({ ...vaspForm, supportedNetworks: e.target.value })} placeholder="bitcoin, ethereum" />
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={vaspForm.isVerified} onChange={(e) => setVaspForm({ ...vaspForm, isVerified: e.target.checked })} />
                  <span className="form-label" style={{ margin: 0 }}>Verified VASP</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowVASPModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
