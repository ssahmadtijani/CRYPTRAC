/**
 * LiveActivityFeed — Real-time event feed using WebSocket.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWebSocket, type WSEvent, type WSEventType } from '../hooks/useWebSocket';
import ConnectionStatus from './ConnectionStatus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVENT_ICONS: Record<WSEventType, string> = {
  TRANSACTION_CREATED: '📊',
  TRANSACTION_FLAGGED: '⚠️',
  COMPLIANCE_ALERT: '🔔',
  RISK_LEVEL_CHANGED: '📈',
  CASE_CREATED: '📁',
  CASE_STATUS_CHANGED: '🔄',
  PATTERN_DETECTED: '🔍',
  KPI_UPDATE: '📉',
  WALLET_SANCTIONED: '🚫',
  SYSTEM_ALERT: '⚡',
};

const EVENT_LABELS: Record<WSEventType, string> = {
  TRANSACTION_CREATED: 'Transaction',
  TRANSACTION_FLAGGED: 'Flagged',
  COMPLIANCE_ALERT: 'Compliance',
  RISK_LEVEL_CHANGED: 'Risk Changed',
  CASE_CREATED: 'New Case',
  CASE_STATUS_CHANGED: 'Case Updated',
  PATTERN_DETECTED: 'Pattern',
  KPI_UPDATE: 'KPI Update',
  WALLET_SANCTIONED: 'Sanctioned',
  SYSTEM_ALERT: 'System',
};

const EVENT_BADGE_CLASS: Record<WSEventType, string> = {
  TRANSACTION_CREATED: 'badge-info',
  TRANSACTION_FLAGGED: 'badge-warning',
  COMPLIANCE_ALERT: 'badge-danger',
  RISK_LEVEL_CHANGED: 'badge-warning',
  CASE_CREATED: 'badge-info',
  CASE_STATUS_CHANGED: 'badge-secondary',
  PATTERN_DETECTED: 'badge-danger',
  KPI_UPDATE: 'badge-success',
  WALLET_SANCTIONED: 'badge-danger',
  SYSTEM_ALERT: 'badge-secondary',
};

function relativeTime(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function describeEvent(event: WSEvent): string {
  const p = event.payload as Record<string, unknown>;
  switch (event.type) {
    case 'TRANSACTION_CREATED':
    case 'TRANSACTION_FLAGGED': {
      const asset = p.asset as string | undefined;
      const amountUSD = p.amountUSD as number | undefined;
      const risk = p.riskLevel as string | undefined;
      return `${asset ?? 'TX'} ${amountUSD != null ? `$${amountUSD.toLocaleString()}` : ''}${risk ? ` — ${risk}` : ''}`;
    }
    case 'COMPLIANCE_ALERT':
      return `Report ${(p.reportType as string | undefined) ?? ''} filed`;
    case 'CASE_CREATED':
      return `${(p.caseNumber as string | undefined) ?? 'New case'} — ${(p.category as string | undefined) ?? ''}`;
    case 'CASE_STATUS_CHANGED':
      return `${(p.caseNumber as string | undefined) ?? ''}: ${(p.previousStatus as string | undefined) ?? ''} → ${(p.newStatus as string | undefined) ?? ''}`;
    case 'PATTERN_DETECTED': {
      const summary = p.summary as Record<string, unknown> | undefined;
      return `${(summary?.totalPatterns as number | undefined) ?? 0} pattern(s) detected`;
    }
    case 'SYSTEM_ALERT':
      return (p.message as string | undefined) ?? 'System notification';
    default:
      return event.type.replace(/_/g, ' ').toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_DISPLAY = 50;

export default function LiveActivityFeed() {
  const { events, connectionStatus } = useWebSocket();
  const [tick, setTick] = useState(0);

  // Refresh relative timestamps every 10s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  void tick; // suppress unused warning — used to trigger re-render

  const display = events.slice(0, MAX_DISPLAY);

  return (
    <div className="card live-feed-card">
      <div className="card-header">
        <div className="live-feed-header">
          <span className="card-title">Live Activity</span>
          <ConnectionStatus status={connectionStatus} />
        </div>
      </div>

      <div className="live-feed">
        {display.length === 0 ? (
          <div className="live-feed-empty">
            {connectionStatus === 'connected'
              ? 'Waiting for events…'
              : connectionStatus === 'connecting'
              ? 'Connecting to live feed…'
              : 'Not connected to live feed'}
          </div>
        ) : (
          display.map((event, idx) => (
            <div
              key={`${event.timestamp}-${idx}`}
              className="live-feed-event live-feed-event-enter"
            >
              <span className="lfe-icon">{EVENT_ICONS[event.type] ?? '•'}</span>
              <div className="lfe-body">
                <div className="lfe-top">
                  <span className={`badge ${EVENT_BADGE_CLASS[event.type] ?? 'badge-secondary'}`}>
                    {EVENT_LABELS[event.type] ?? event.type}
                  </span>
                  <span className="lfe-time">{relativeTime(event.timestamp)}</span>
                </div>
                <div className="lfe-desc">{describeEvent(event)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {events.length > MAX_DISPLAY && (
        <div className="live-feed-footer">
          <Link to="/audit" className="btn btn-ghost btn-sm">
            View all ({events.length})
          </Link>
        </div>
      )}
    </div>
  );
}
