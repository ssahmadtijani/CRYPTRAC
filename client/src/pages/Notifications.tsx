import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/notifications';
import {
  Notification,
  NotificationPreferences,
  NotificationStats,
  NotificationType,
  NotificationPriority,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function notificationIcon(type: string): string {
  switch (type) {
    case 'CASE_CREATED': return '🗂️';
    case 'CASE_ASSIGNED': return '👤';
    case 'CASE_ESCALATED': return '🚨';
    case 'CASE_STATUS_CHANGED': return '🔄';
    case 'CASE_NOTE_ADDED': return '📝';
    case 'COMPLIANCE_ALERT': return '📋';
    case 'HIGH_RISK_TRANSACTION': return '⚠️';
    case 'SANCTIONS_HIT': return '🚫';
    case 'THRESHOLD_EXCEEDED': return '💰';
    case 'SYSTEM_ALERT': return '🔔';
    default: return '🔔';
  }
}

function priorityColor(priority: string): string {
  switch (priority) {
    case 'CRITICAL': return 'var(--danger)';
    case 'HIGH': return 'var(--risk-high)';
    case 'MEDIUM': return 'var(--warning)';
    default: return 'var(--text-muted)';
  }
}

function getReferenceUrl(n: Notification): string | null {
  if (!n.referenceId) return null;
  switch (n.referenceType) {
    case 'CASE': return `/cases/${n.referenceId}`;
    case 'TRANSACTION': return `/transactions/${n.referenceId}`;
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  const navigate = useNavigate();

  // Notifications list state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState<NotificationType | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<NotificationPriority | ''>('');
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  // Preferences state
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsError, setPrefsError] = useState('');

  // Tab
  const [activeTab, setActiveTab] = useState<'list' | 'preferences'>('list');

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params: Parameters<typeof notificationsApi.list>[0] = {
        page,
        pageSize,
        type: typeFilter || undefined,
        priority: priorityFilter || undefined,
        isRead:
          readFilter === 'read' ? true : readFilter === 'unread' ? false : undefined,
      };

      const [notifRes, statsRes] = await Promise.all([
        notificationsApi.list(params),
        notificationsApi.stats(),
      ]);

      setNotifications(notifRes.data.data ?? []);
      setStats(statsRes.data.data ?? null);
      const meta = notifRes.data.meta;
      if (meta?.totalPages) setTotalPages(meta.totalPages);
    } catch {
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrefs = async () => {
    try {
      const res = await notificationsApi.getPreferences();
      setPrefs(res.data.data ?? null);
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    void fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, typeFilter, priorityFilter, readFilter]);

  useEffect(() => {
    void fetchPrefs();
  }, []);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handleMarkAsRead = async (n: Notification) => {
    if (n.isRead) return;
    try {
      await notificationsApi.markAsRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
      );
      if (stats) setStats({ ...stats, unread: Math.max(0, stats.unread - 1) });
    } catch {
      // Silently fail
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      if (stats) setStats({ ...stats, unread: 0 });
    } catch {
      setError('Failed to mark all as read.');
    }
  };

  const handleDelete = async (n: Notification) => {
    try {
      await notificationsApi.delete(n.id);
      setNotifications((prev) => prev.filter((item) => item.id !== n.id));
      if (!n.isRead && stats) {
        setStats({ ...stats, unread: Math.max(0, stats.unread - 1), total: stats.total - 1 });
      }
    } catch {
      setError('Failed to delete notification.');
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    await handleMarkAsRead(n);
    const url = getReferenceUrl(n);
    if (url) navigate(url);
  };

  const handleSavePrefs = async () => {
    if (!prefs) return;
    setSavingPrefs(true);
    setPrefsError('');
    try {
      const res = await notificationsApi.updatePreferences({
        enabledTypes: prefs.enabledTypes,
        emailNotifications: prefs.emailNotifications,
        highPriorityOnly: prefs.highPriorityOnly,
      });
      setPrefs(res.data.data ?? prefs);
    } catch {
      setPrefsError('Failed to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const toggleType = (type: NotificationType) => {
    if (!prefs) return;
    const enabled = prefs.enabledTypes.includes(type);
    setPrefs({
      ...prefs,
      enabledTypes: enabled
        ? prefs.enabledTypes.filter((t) => t !== type)
        : [...prefs.enabledTypes, type],
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Notifications</h1>
        <p className="page-subtitle">Manage your alerts and notification preferences</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Stats bar */}
      {stats && (
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}
        >
          {[
            { label: 'Total', value: stats.total, color: 'var(--text-secondary)' },
            { label: 'Unread', value: stats.unread, color: 'var(--accent)' },
          ].map((s) => (
            <div
              key={s.label}
              className="card"
              style={{ padding: '12px 20px', minWidth: '120px', textAlign: 'center' }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: s.color }}>
                {s.value}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
        {(['list', 'preferences'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
            style={{ textTransform: 'capitalize' }}
          >
            {tab === 'list' ? '🔔 Notifications' : '⚙️ Preferences'}
          </button>
        ))}
      </div>

      {/* ── Notifications List Tab ── */}
      {activeTab === 'list' && (
        <>
          {/* Filters + Actions */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '16px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <select
              className="input"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as NotificationType | '');
                setPage(1);
              }}
              style={{ width: 'auto' }}
            >
              <option value="">All types</option>
              {Object.values(NotificationType).map((t) => (
                <option key={t} value={t}>
                  {notificationIcon(t)} {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as NotificationPriority | '');
                setPage(1);
              }}
              style={{ width: 'auto' }}
            >
              <option value="">All priorities</option>
              {Object.values(NotificationPriority).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={readFilter}
              onChange={(e) => {
                setReadFilter(e.target.value as 'all' | 'read' | 'unread');
                setPage(1);
              }}
              style={{ width: 'auto' }}
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>

            <div style={{ marginLeft: 'auto' }}>
              {(stats?.unread ?? 0) > 0 && (
                <button
                  className="btn btn-secondary"
                  onClick={() => void handleMarkAllRead()}
                >
                  ✓ Mark all as read
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          {loading ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading notifications…
            </div>
          ) : notifications.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No notifications found.
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              {notifications.map((n, i) => (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '14px 16px',
                    borderBottom:
                      i < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                    background: n.isRead ? 'transparent' : 'var(--accent-glow)',
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '2px' }}>
                    {notificationIcon(n.type)}
                  </span>

                  <div
                    style={{ flex: 1, minWidth: 0, cursor: getReferenceUrl(n) ? 'pointer' : 'default' }}
                    onClick={() => void handleNotificationClick(n)}
                  >
                    <div
                      style={{
                        fontWeight: n.isRead ? 400 : 600,
                        color: 'var(--text-primary)',
                        marginBottom: '4px',
                      }}
                    >
                      {n.title}
                    </div>
                    <div
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '13px',
                        marginBottom: '6px',
                      }}
                    >
                      {n.message}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: priorityColor(n.priority),
                        }}
                      >
                        {n.priority}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {timeAgo(n.createdAt)}
                      </span>
                      {!n.isRead && (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: 'var(--accent)',
                          }}
                        />
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {!n.isRead && (
                      <button
                        onClick={() => void handleMarkAsRead(n)}
                        title="Mark as read"
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          color: 'var(--accent)',
                          padding: '4px 8px',
                          fontSize: '12px',
                        }}
                      >
                        ✓
                      </button>
                    )}
                    <button
                      onClick={() => void handleDelete(n)}
                      title="Delete"
                      style={{
                        background: 'none',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        color: 'var(--danger)',
                        padding: '4px 8px',
                        fontSize: '12px',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
                marginTop: '16px',
              }}
            >
              <button
                className="btn btn-secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span
                style={{
                  padding: '8px 16px',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                }}
              >
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-secondary"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Preferences Tab ── */}
      {activeTab === 'preferences' && prefs && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <div style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>
              Notification Preferences
            </h3>

            {prefsError && (
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                {prefsError}
              </div>
            )}

            {/* Global toggles */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={prefs.emailNotifications}
                  onChange={(e) =>
                    setPrefs({ ...prefs, emailNotifications: e.target.checked })
                  }
                />
                <span style={{ color: 'var(--text-primary)' }}>Email notifications</span>
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={prefs.highPriorityOnly}
                  onChange={(e) =>
                    setPrefs({ ...prefs, highPriorityOnly: e.target.checked })
                  }
                />
                <span style={{ color: 'var(--text-primary)' }}>
                  High priority only (hide LOW and MEDIUM notifications)
                </span>
              </label>
            </div>

            {/* Enabled types */}
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '12px',
                }}
              >
                Enabled Notification Types
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                }}
              >
                {Object.values(NotificationType).map((type) => (
                  <label
                    key={type}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: prefs.enabledTypes.includes(type)
                        ? 'var(--accent-glow)'
                        : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={prefs.enabledTypes.includes(type)}
                      onChange={() => toggleType(type)}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                      {notificationIcon(type)} {type.replace(/_/g, ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => void handleSavePrefs()}
              disabled={savingPrefs}
            >
              {savingPrefs ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
