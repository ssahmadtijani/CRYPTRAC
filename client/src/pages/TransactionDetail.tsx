import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { Transaction, ApiResponse } from '../types';
import { RiskBadge, StatusBadge } from '../components/Badges';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';

interface RiskAssessment {
  riskLevel: string;
  riskScore: number;
  factors: string[];
}

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  );

  useEffect(() => {
    if (!id) return;
    apiClient
      .get<ApiResponse<Transaction>>(`/transactions/${id}`)
      .then((res) => setTx(res.data.data ?? null))
      .catch(() => setToast({ message: 'Transaction not found.', type: 'error' }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAssess = async () => {
    if (!id) return;
    setAssessing(true);
    try {
      const res = await apiClient.post<ApiResponse<RiskAssessment>>(
        `/transactions/${id}/assess`,
      );
      setAssessment(res.data.data ?? null);
      setToast({ message: 'Risk assessment completed.', type: 'success' });
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message:
          axiosErr.response?.data?.error?.message ?? 'Assessment failed.',
        type: 'error',
      });
    } finally {
      setAssessing(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-row">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="page">
        <div className="alert alert-error">Transaction not found.</div>
        <button className="btn btn-ghost" onClick={() => navigate('/transactions')}>
          ← Back to Transactions
        </button>
      </div>
    );
  }

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
        <div>
          <button
            className="btn btn-ghost btn-sm back-btn"
            onClick={() => navigate('/transactions')}
          >
            ← Back
          </button>
          <h1 className="page-title">Transaction Detail</h1>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleAssess}
          disabled={assessing}
        >
          {assessing ? 'Assessing…' : 'Run Risk Assessment'}
        </button>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h3 className="detail-card-title">Transaction Info</h3>
          <dl className="detail-list">
            <dt>ID</dt>
            <dd className="monospace">{tx.id}</dd>

            <dt>Tx Hash</dt>
            <dd className="monospace">{tx.txHash}</dd>

            <dt>Type</dt>
            <dd>{tx.type}</dd>

            <dt>Network</dt>
            <dd>{tx.network}</dd>

            <dt>Asset</dt>
            <dd>{tx.asset}</dd>

            <dt>Amount</dt>
            <dd>
              {tx.amount.toLocaleString()} {tx.asset}
            </dd>

            <dt>Amount (USD)</dt>
            <dd>${tx.amountUSD.toLocaleString()}</dd>

            <dt>Fee</dt>
            <dd>
              {tx.fee} {tx.asset} (${tx.feeUSD})
            </dd>

            {tx.blockNumber && (
              <>
                <dt>Block</dt>
                <dd>{tx.blockNumber}</dd>
              </>
            )}

            <dt>Timestamp</dt>
            <dd>{new Date(tx.timestamp).toLocaleString()}</dd>

            <dt>Created</dt>
            <dd>{new Date(tx.createdAt).toLocaleString()}</dd>
          </dl>
        </div>

        <div className="detail-card">
          <h3 className="detail-card-title">Parties</h3>
          <dl className="detail-list">
            <dt>Sender</dt>
            <dd className="monospace">{tx.senderAddress}</dd>

            <dt>Receiver</dt>
            <dd className="monospace">{tx.receiverAddress}</dd>
          </dl>

          <h3 className="detail-card-title" style={{ marginTop: '1.5rem' }}>
            Compliance
          </h3>
          <dl className="detail-list">
            <dt>Risk Level</dt>
            <dd>
              <RiskBadge level={tx.riskLevel} />
            </dd>

            <dt>Risk Score</dt>
            <dd>{tx.riskScore}</dd>

            <dt>Status</dt>
            <dd>
              <StatusBadge status={tx.complianceStatus} />
            </dd>
          </dl>
        </div>
      </div>

      {assessment && (
        <div className="detail-card" style={{ marginTop: '1.5rem' }}>
          <h3 className="detail-card-title">Risk Assessment Result</h3>
          <dl className="detail-list">
            <dt>Risk Level</dt>
            <dd>{assessment.riskLevel}</dd>
            <dt>Risk Score</dt>
            <dd>{assessment.riskScore}</dd>
            <dt>Factors</dt>
            <dd>
              <ul className="factor-list">
                {assessment.factors.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </dd>
          </dl>
        </div>
      )}
    </div>
  );
}
