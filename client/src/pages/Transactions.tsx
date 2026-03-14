import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import {
  Transaction,
  ApiResponse,
  TransactionType,
  CreateTransactionRequest,
} from '../types';
import { RiskBadge, StatusBadge } from '../components/Badges';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  );

  const [form, setForm] = useState<CreateTransactionRequest>({
    txHash: '',
    type: TransactionType.TRANSFER,
    senderAddress: '',
    receiverAddress: '',
    asset: 'ETH',
    amount: 0,
    amountUSD: 0,
    fee: 0,
    feeUSD: 0,
    network: 'ethereum',
    timestamp: new Date().toISOString(),
  });

  const fetchTransactions = async () => {
    try {
      const res = await apiClient.get<ApiResponse<Transaction[]>>('/transactions');
      setTransactions(res.data.data ?? []);
    } catch {
      setToast({ message: 'Failed to load transactions.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post<ApiResponse<Transaction>>('/transactions', {
        ...form,
        amount: parseFloat(String(form.amount)),
        amountUSD: parseFloat(String(form.amountUSD)),
        fee: parseFloat(String(form.fee)),
        feeUSD: parseFloat(String(form.feeUSD)),
      });
      setToast({ message: 'Transaction created successfully.', type: 'success' });
      setShowModal(false);
      fetchTransactions();
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message:
          axiosErr.response?.data?.error?.message ?? 'Failed to create transaction.',
        type: 'error',
      });
    }
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
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">All recorded crypto transactions</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Transaction
        </button>
      </div>

      {loading ? (
        <div className="loading-row">
          <div className="spinner" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          No transactions yet.{' '}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(true)}>
            Add one
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Tx Hash</th>
                <th>Type</th>
                <th>Asset</th>
                <th>Amount</th>
                <th>Amount USD</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="clickable-row"
                  onClick={() => navigate(`/transactions/${tx.id}`)}
                >
                  <td className="monospace">{tx.txHash.slice(0, 12)}…</td>
                  <td>{tx.type}</td>
                  <td>{tx.asset}</td>
                  <td>{tx.amount.toLocaleString()}</td>
                  <td>${tx.amountUSD.toLocaleString()}</td>
                  <td>
                    <RiskBadge level={tx.riskLevel} />
                  </td>
                  <td>
                    <StatusBadge status={tx.complianceStatus} />
                  </td>
                  <td>{new Date(tx.timestamp).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Transaction Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Transaction</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Tx Hash</label>
                  <input
                    name="txHash"
                    className="form-control"
                    value={form.txHash}
                    onChange={handleFormChange}
                    placeholder="0x..."
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    name="type"
                    className="form-control"
                    value={form.type}
                    onChange={handleFormChange}
                  >
                    {Object.values(TransactionType).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Sender Address</label>
                  <input
                    name="senderAddress"
                    className="form-control"
                    value={form.senderAddress}
                    onChange={handleFormChange}
                    placeholder="0x..."
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Receiver Address</label>
                  <input
                    name="receiverAddress"
                    className="form-control"
                    value={form.receiverAddress}
                    onChange={handleFormChange}
                    placeholder="0x..."
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Asset</label>
                  <input
                    name="asset"
                    className="form-control"
                    value={form.asset}
                    onChange={handleFormChange}
                    placeholder="ETH"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Network</label>
                  <input
                    name="network"
                    className="form-control"
                    value={form.network}
                    onChange={handleFormChange}
                    placeholder="ethereum"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Amount</label>
                  <input
                    name="amount"
                    type="number"
                    step="any"
                    className="form-control"
                    value={form.amount}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Amount (USD)</label>
                  <input
                    name="amountUSD"
                    type="number"
                    step="any"
                    className="form-control"
                    value={form.amountUSD}
                    onChange={handleFormChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fee</label>
                  <input
                    name="fee"
                    type="number"
                    step="any"
                    className="form-control"
                    value={form.fee}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fee (USD)</label>
                  <input
                    name="feeUSD"
                    type="number"
                    step="any"
                    className="form-control"
                    value={form.feeUSD}
                    onChange={handleFormChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Timestamp</label>
                <input
                  name="timestamp"
                  type="datetime-local"
                  className="form-control"
                  value={form.timestamp.slice(0, 16)}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      timestamp: new Date(e.target.value).toISOString(),
                    }))
                  }
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
