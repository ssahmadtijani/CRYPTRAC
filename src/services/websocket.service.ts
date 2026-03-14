/**
 * WebSocket Service for CRYPTRAC
 * Provides real-time event streaming to authenticated frontend clients.
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { WSEvent, WSEventType, UserRole } from '../types';
import { JwtPayload } from '../middleware/auth';
import { logger } from '../utils/logger';
import { eventBus } from '../utils/eventBus';

// ---------------------------------------------------------------------------
// Client tracking
// ---------------------------------------------------------------------------

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  email: string;
  role: UserRole;
  connectedAt: Date;
  isAlive: boolean;
}

const clients = new Map<WebSocket, ConnectedClient>();

// ---------------------------------------------------------------------------
// Initialize WebSocket server
// ---------------------------------------------------------------------------

export function initializeWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    // Extract JWT from query parameter: ?token=xxx
    const url = new URL(req.url ?? '', `http://localhost`);
    const token = url.searchParams.get('token');

    if (!token) {
      logger.warn('WebSocket connection rejected: no token provided');
      ws.close(4001, 'Authentication required');
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('JWT_SECRET not configured');
      ws.close(4500, 'Server configuration error');
      return;
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, secret) as JwtPayload;
    } catch (err) {
      logger.warn('WebSocket connection rejected: invalid token', { err });
      ws.close(4001, 'Invalid or expired token');
      return;
    }

    const client: ConnectedClient = {
      ws,
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      connectedAt: new Date(),
      isAlive: true,
    };

    clients.set(ws, client);
    logger.info('WebSocket client connected', { userId: payload.userId, role: payload.role });

    // Acknowledge connection
    const ackEvent: WSEvent = {
      type: WSEventType.SYSTEM_ALERT,
      payload: { message: 'Connected to CRYPTRAC live feed' },
      timestamp: new Date(),
    };
    ws.send(JSON.stringify(ackEvent));

    // Heartbeat pong
    ws.on('pong', () => {
      const c = clients.get(ws);
      if (c) c.isAlive = true;
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info('WebSocket client disconnected', { userId: payload.userId });
    });

    ws.on('error', (err) => {
      logger.error('WebSocket client error', { userId: payload.userId, err });
      clients.delete(ws);
    });
  });

  // Heartbeat interval — ping all clients every 30 seconds
  const heartbeatInterval = setInterval(() => {
    clients.forEach((client, ws) => {
      if (!client.isAlive) {
        logger.info('Removing stale WebSocket connection', { userId: client.userId });
        clients.delete(ws);
        ws.terminate();
        return;
      }
      client.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  // Subscribe to eventBus and forward events to WebSocket clients
  eventBus.on('ws:broadcast', (event: WSEvent) => {
    broadcastEvent(event);
  });

  eventBus.on('ws:sendToUser', ({ userId, event }: { userId: string; event: WSEvent }) => {
    sendToUser(userId, event);
  });

  eventBus.on('ws:sendToRoles', ({ roles, event }: { roles: UserRole[]; event: WSEvent }) => {
    sendToRoles(roles, event);
  });

  logger.info('WebSocket server initialized');
  return wss;
}

// ---------------------------------------------------------------------------
// Send helpers
// ---------------------------------------------------------------------------

function safeSerialize(event: WSEvent): string {
  return JSON.stringify(event);
}

/**
 * Broadcast a WSEvent to all authenticated connected clients.
 */
export function broadcastEvent(event: WSEvent): void {
  const message = safeSerialize(event);
  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * Send a WSEvent to all connections belonging to a specific user.
 */
export function sendToUser(userId: string, event: WSEvent): void {
  const message = safeSerialize(event);
  clients.forEach((client, ws) => {
    if (client.userId === userId && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * Send a WSEvent to all connections whose user role matches one of the given roles.
 */
export function sendToRoles(roles: UserRole[], event: WSEvent): void {
  const message = safeSerialize(event);
  clients.forEach((client, ws) => {
    if (roles.includes(client.role) && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// ---------------------------------------------------------------------------
// Monitoring helpers
// ---------------------------------------------------------------------------

/**
 * Returns metadata for all currently connected authenticated clients.
 */
export function getConnectedClients(): { userId: string; role: UserRole; connectedAt: Date }[] {
  return Array.from(clients.values()).map((c) => ({
    userId: c.userId,
    role: c.role,
    connectedAt: c.connectedAt,
  }));
}

/**
 * Returns aggregate connection statistics.
 */
export function getConnectionStats(): {
  totalConnections: number;
  authenticatedConnections: number;
  connectionsByRole: Record<string, number>;
} {
  const connectionsByRole: Record<string, number> = {};
  clients.forEach((client) => {
    connectionsByRole[client.role] = (connectionsByRole[client.role] ?? 0) + 1;
  });

  return {
    totalConnections: clients.size,
    authenticatedConnections: clients.size,
    connectionsByRole,
  };
}
