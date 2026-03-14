import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/notifications';
import { Notification, NotificationPriority } from '../types';

const POLL_INTERVAL_MS = 30_000;

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
    case NotificationPriority.CRITICAL: return 'var(--danger)';
    case NotificationPriority.HIGH: return 'var(--risk-high)';
    case NotificationPriority.MEDIUM: return 'var(--warning)';
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

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      const res = await notificationsApi.stats();
      setUnreadCount(res.data.data?.unread ?? 0);
    } catch {
      // Silently fail stats polling
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list({ pageSize: 10 });
      setNotifications(res.data.data ?? []);
      setUnreadCount(
        (res.data.data ?? []).filter((n) => !n.isRead).length
      );
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  // Poll stats every 30 seconds
  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      void fetchNotifications();
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.isRead) {
      try {
        await notificationsApi.markAsRead(n.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Silently fail
      }
    }
    const url = getReferenceUrl(n);
    if (url) {
      setIsOpen(false);
      navigate(url);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '6px',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          fontSize: '18px',
          lineHeight: 1,
          transition: 'color var(--transition)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: 'var(--danger)',
              color: '#fff',
              borderRadius: '50%',
              width: '16px',
              height: '16px',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '360px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              Notifications
              {unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: '8px',
                    background: 'var(--danger)',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '1px 7px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    fontSize: '12px',
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {loading ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => void handleNotificationClick(n)}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    padding: '12px 16px',
                    cursor: getReferenceUrl(n) ? 'pointer' : 'default',
                    borderBottom: '1px solid var(--border)',
                    background: n.isRead ? 'transparent' : 'var(--accent-glow)',
                    transition: 'background var(--transition)',
                  }}
                  onMouseEnter={(e) => {
                    if (getReferenceUrl(n)) {
                      (e.currentTarget as HTMLDivElement).style.background =
                        'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = n.isRead
                      ? 'transparent'
                      : 'var(--accent-glow)';
                  }}
                >
                  <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '2px' }}>
                    {notificationIcon(n.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: n.isRead ? 400 : 600,
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        marginBottom: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {n.title}
                    </div>
                    <div
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '12px',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {n.message}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          color: priorityColor(n.priority),
                          fontWeight: 600,
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
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent)',
                fontSize: '13px',
              }}
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
