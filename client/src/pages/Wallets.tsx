import { useState, FormEvent } from 'react';
import apiClient from '../api/client';
import { Wallet, ApiResponse, RegisterWalletRequest } from '../types';
import { RiskBadge } from '../components/Badges';
import Toast from '../components/Toast';
import { AxiosError } from 'axios';

interface SanctionsResult {
  isSanctioned: boolean;
  details?: string;
}

export default function Wallets() {
  const [walletAddress, setWalletAddress] = useState('');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [sanctions, setSanctions] = useState<SanctionsResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [registerForm, setRegisterForm] = useState<RegisterWalletRequest>({
    address: '',
    network: 'ethereum',
    label: '',
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registeredWallet, setRegisteredWallet] = useState<Wallet | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null,
  );

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    setWallet(null);
    setSanctions(null);
    setLookupLoading(true);
    try {
      const [walletRes, sanctionsRes] = await Promise.all([
        apiClient.get<ApiResponse<Wallet>>(`/wallets/${walletAddress}`),
        apiClient.get<ApiResponse<SanctionsResult>>(
          `/wallets/${walletAddress}/sanctions`,
        ),
      ]);
      setWallet(walletRes.data.data ?? null);
      setSanctions(sanctionsRes.data.data ?? null);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message:
          axiosErr.response?.data?.error?.message ?? 'Wallet not found.',
        type: 'error',
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);
    try {
      const res = await apiClient.post<ApiResponse<Wallet>>('/wallets', {
        address: registerForm.address,
        network: registerForm.network,
        label: registerForm.label || undefined,
      });
      setRegisteredWallet(res.data.data ?? null);
      setToast({ message: 'Wallet registered successfully.', type: 'success' });
      setRegisterForm({ address: '', network: 'ethereum', label: '' });
    } catch (err) {
      const axiosErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message:
          axiosErr.response?.data?.error?.message ?? 'Failed to register wallet.',
        type: 'error',
      });
    } finally {
      setRegisterLoading(false);
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
        <h1 className="page-title">Wallets</h1>
        <p className="page-subtitle">Manage and monitor crypto wallet addresses</p>
      </div>

      <div className="wallets-grid">
        {/* Register Wallet */}
        <div className="card">
          <h2 className="card-title">Register Wallet</h2>
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Address</label>
              <input
                className="form-control"
                value={registerForm.address}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="0x..."
                required
              />
            </div>
            <div className="form-group">
              <label>Network</label>
              <input
                className="form-control"
                value={registerForm.network}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, network: e.target.value }))
                }
                placeholder="ethereum"
                required
              />
            </div>
            <div className="form-group">
              <label>Label (optional)</label>
              <input
                className="form-control"
                value={registerForm.label}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, label: e.target.value }))
                }
                placeholder="My hot wallet"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={registerLoading}
            >
              {registerLoading ? 'Registering…' : 'Register Wallet'}
            </button>
          </form>

          {registeredWallet && (
            <div className="wallet-result">
              <div className="wallet-result-title">Registered</div>
              <dl className="detail-list">
                <dt>Address</dt>
                <dd className="monospace">{registeredWallet.address}</dd>
                <dt>Network</dt>
                <dd>{registeredWallet.network}</dd>
                <dt>Risk Level</dt>
                <dd>
                  <RiskBadge level={registeredWallet.riskLevel} />
                </dd>
              </dl>
            </div>
          )}
        </div>

        {/* Lookup Wallet */}
        <div className="card">
          <h2 className="card-title">Lookup Wallet</h2>
          <form onSubmit={handleLookup}>
            <div className="form-group">
              <label>Wallet Address</label>
              <input
                className="form-control"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={lookupLoading}
            >
              {lookupLoading ? 'Looking up…' : 'Lookup'}
            </button>
          </form>

          {wallet && (
            <div className="wallet-result">
              <div className="wallet-result-title">Wallet Info</div>
              <dl className="detail-list">
                <dt>Address</dt>
                <dd className="monospace">{wallet.address}</dd>
                <dt>Network</dt>
                <dd>{wallet.network}</dd>
                {wallet.label && (
                  <>
                    <dt>Label</dt>
                    <dd>{wallet.label}</dd>
                  </>
                )}
                <dt>Risk Level</dt>
                <dd>
                  <RiskBadge level={wallet.riskLevel} />
                </dd>
                <dt>Risk Score</dt>
                <dd>{wallet.riskScore}</dd>
                <dt>Tx Count</dt>
                <dd>{wallet.transactionCount}</dd>
                <dt>Volume (USD)</dt>
                <dd>${wallet.totalVolumeUSD.toLocaleString()}</dd>
              </dl>
            </div>
          )}

          {sanctions && (
            <div
              className={`wallet-result sanctions-result ${
                sanctions.isSanctioned ? 'sanctioned' : 'clean'
              }`}
            >
              <div className="wallet-result-title">Sanctions Check</div>
              <p>
                {sanctions.isSanctioned ? (
                  <span className="badge risk-critical">⚠ SANCTIONED</span>
                ) : (
                  <span className="badge risk-low">✓ Clear</span>
                )}
              </p>
              {sanctions.details && <p>{sanctions.details}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
