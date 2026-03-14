import { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { exchangeApi } from '../api/tax';
import { ExchangeConnection, ExchangeTransaction, ApiResponse } from '../types';
import StatsCard from '../components/StatsCard';
import Toast from '../components/Toast';

const SUPPORTED_EXCHANGES = [
  { name: 'Binance', icon: '🌐', description: 'International — BTC/ETH/BNB/USDT pairs' },
  { name: 'Luno', icon: '🦁', description: 'Nigeria popular — BTC/ETH/USDT/NGN pairs' },
  { name: 'Quidax', icon: '🇳🇬', description: 'Nigerian exchange — BTC/ETH/SOL/NGN pairs' },
];

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

export default function Exchanges() {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [transactions, setTransactions] = useState<ExchangeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    try {
      const [connRes, txRes] = await Promise.all([
        exchangeApi.list(),
        exchangeApi.getAllTransactions(),
      ]);
      setConnections(connRes.data.data ?? []);
      setTransactions(txRes.data.data ?? []);
    } catch {
      setToast({ message: 'Failed to load exchange data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConnect = async (exchangeName: string) => {
    setConnecting(exchangeName);
    try {
      await exchangeApi.connect(exchangeName);
      // Auto-sync after connecting
      await exchangeApi.sync(exchangeName);
      setToast({ message: `${exchangeName} connected and synced successfully!`, type: 'success' });
      await fetchData();
    } catch (err) {
      const axErr = err as AxiosError<ApiResponse<unknown>>;
      setToast({
        message: axErr.response?.data?.error?.message ?? `Failed to connect ${exchangeName}`,
        type: 'error',
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleSync = async (exchangeName: string) => {
    setSyncing(exchangeName);
    try {
      const res = await exchangeApi.sync(exchangeName);
      setToast({
        message: `Synced ${res.data.data?.synced ?? 0} transactions from ${exchangeName}`,
        type: 'success',
      });
      await fetchData();
    } catch {
      setToast({ message: `Sync failed for ${exchangeName}`, type: 'error' });
    } finally {
      setSyncing(null);
    }
  };

  const totalVolume = transactions.reduce((s, t) => s + t.totalValueUSD, 0);

  return (
    <div className="page">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="page-header">
        <h1 className="page-title">Exchange Connections</h1>
        <p className="page-subtitle">
          Connect your crypto exchange accounts to import transaction history for tax reporting
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatsCard
          title="Connected Exchanges"
          value={connections.length}
          subtitle={`of ${SUPPORTED_EXCHANGES.length} supported`}
          accent="default"
        />
        <StatsCard
          title="Total Transactions"
          value={transactions.length.toLocaleString()}
          subtitle="across all exchanges"
          accent="default"
        />
        <StatsCard
          title="Total Volume"
          value={fmtUSD(totalVolume)}
          subtitle="combined trading volume"
          accent="success"
        />
      </div>

      {/* Exchange Cards */}
      <div className="page-header" style={{ marginTop: '2rem' }}>
        <h2 className="page-title" style={{ fontSize: '1.2rem' }}>Supported Exchanges</h2>
      </div>

      <div className="stats-grid">
        {SUPPORTED_EXCHANGES.map((exchange) => {
          const connection = connections.find((c) => c.exchangeName === exchange.name);
          const connected = !!connection;
          const isSyncing = syncing === exchange.name;
          const isConnecting = connecting === exchange.name;
          const txCount = connection?.transactionCount ?? 0;

          return (
            <div key={exchange.name} className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>{exchange.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{exchange.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {exchange.description}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '99px',
                      fontSize: '0.75rem',
                      background: connected ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
                      color: connected ? 'var(--success)' : 'var(--text-muted)',
                    }}
                  >
                    {connected ? '● Connected' : '○ Not Connected'}
                  </span>
                </div>
              </div>

              {connected && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-base)', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Transactions</div>
                      <div style={{ fontWeight: 600 }}>{txCount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Last Synced</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {connection?.lastSyncedAt
                          ? new Date(connection.lastSyncedAt).toLocaleDateString()
                          : 'Never'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!connected ? (
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => handleConnect(exchange.name)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? 'Connecting…' : `Connect ${exchange.name}`}
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => handleSync(exchange.name)}
                    disabled={isSyncing}
                  >
                    {isSyncing ? 'Syncing…' : '🔄 Sync Now'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transaction Table */}
      {transactions.length > 0 && (
        <>
          <div className="page-header" style={{ marginTop: '2rem' }}>
            <h2 className="page-title" style={{ fontSize: '1.2rem' }}>
              Recent Transactions ({transactions.length})
            </h2>
          </div>

          {loading ? (
            <div className="loading-spinner" />
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Exchange</th>
                    <th>Type</th>
                    <th>Asset</th>
                    <th>Amount</th>
                    <th>Price (USD)</th>
                    <th>Total Value</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(-50).reverse().map((tx) => (
                    <tr key={tx.externalTxId}>
                      <td>
                        <span style={{ fontWeight: 500 }}>{tx.exchangeName}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            background:
                              tx.type === 'BUY'
                                ? 'rgba(16,185,129,0.15)'
                                : tx.type === 'SELL'
                                ? 'rgba(239,68,68,0.15)'
                                : 'rgba(100,116,139,0.15)',
                            color:
                              tx.type === 'BUY'
                                ? 'var(--success)'
                                : tx.type === 'SELL'
                                ? 'var(--danger)'
                                : 'var(--text-secondary)',
                          }}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{tx.asset}</td>
                      <td>{tx.amount.toFixed(6)}</td>
                      <td>{fmtUSD(tx.pricePerUnit)}</td>
                      <td style={{ fontWeight: 600 }}>{fmtUSD(tx.totalValueUSD)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!loading && connections.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', marginTop: '1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            No exchanges connected yet
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Connect an exchange above to start importing your transaction history
          </div>
        </div>
      )}
    </div>
  );
}
