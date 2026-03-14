/**
 * useWebSocket — Custom React hook for WebSocket connection management
 * Provides real-time event streaming from CRYPTRAC backend.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Event types (mirror of backend WSEventType)
// ---------------------------------------------------------------------------

export type WSEventType =
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_FLAGGED'
  | 'COMPLIANCE_ALERT'
  | 'RISK_LEVEL_CHANGED'
  | 'CASE_CREATED'
  | 'CASE_STATUS_CHANGED'
  | 'PATTERN_DETECTED'
  | 'KPI_UPDATE'
  | 'WALLET_SANCTIONED'
  | 'SYSTEM_ALERT';

export interface WSEvent {
  type: WSEventType;
  payload: unknown;
  timestamp: string;
  userId?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const MAX_EVENTS = 100;
const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWebSocket() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<WSEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const subscribersRef = useRef<Map<WSEventType, Set<(event: WSEvent) => void>>>(new Map());

  const getToken = () => localStorage.getItem('token');

  const isTokenValid = (token: string): boolean => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
      if (payload.exp && payload.exp * 1000 < Date.now()) return false;
      return true;
    } catch {
      return false;
    }
  };

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    const token = getToken();
    if (!token || !isTokenValid(token)) {
      setConnectionStatus('disconnected');
      return;
    }

    // Build WebSocket URL from VITE_API_URL or fallback
    const apiUrl = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL;
    const wsBase = apiUrl
      ? apiUrl.replace(/^http/, 'ws')
      : `ws://${window.location.host}`;
    const url = `${wsBase}?token=${encodeURIComponent(token)}`;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return; // already connected
    }

    setConnectionStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('connected');
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!isMountedRef.current) return;
      try {
        const wsEvent = JSON.parse(event.data as string) as WSEvent;
        setLastEvent(wsEvent);
        setEvents((prev) => {
          const next = [wsEvent, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });

        // Notify type subscribers
        const subs = subscribersRef.current.get(wsEvent.type);
        if (subs) {
          subs.forEach((fn) => fn(wsEvent));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('disconnected');
      wsRef.current = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      if (!isMountedRef.current) return;
      setConnectionStatus('error');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleReconnect = useCallback(() => {
    const token = getToken();
    if (!token || !isTokenValid(token)) return; // don't reconnect if token is expired

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    reconnectTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      reconnectDelayRef.current = Math.min(
        reconnectDelayRef.current * 2,
        MAX_RECONNECT_DELAY_MS
      );
      connect();
    }, reconnectDelayRef.current);
  }, [connect]);

  // Subscribe to a specific event type
  const subscribe = useCallback((type: WSEventType, handler: (event: WSEvent) => void) => {
    if (!subscribersRef.current.has(type)) {
      subscribersRef.current.set(type, new Set());
    }
    subscribersRef.current.get(type)!.add(handler);

    return () => {
      subscribersRef.current.get(type)?.delete(handler);
    };
  }, []);

  // Filter events by type
  const getEventsByType = useCallback((type: WSEventType): WSEvent[] => {
    return events.filter((e) => e.type === type);
  }, [events]);

  // Disconnect manually
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected: connectionStatus === 'connected',
    connectionStatus,
    events,
    lastEvent,
    subscribe,
    getEventsByType,
    disconnect,
    reconnect: connect,
  };
}
