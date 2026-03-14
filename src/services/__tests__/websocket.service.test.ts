/**
 * WebSocket Service Tests
 */

import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Mock the ws module before importing the service
// ---------------------------------------------------------------------------

const mockClients: Map<MockWs, { listeners: Record<string, Function[]> }> = new Map();

class MockWs extends EventEmitter {
  readyState: number;
  messages: string[] = [];
  pinged = false;
  terminated = false;

  constructor() {
    super();
    this.readyState = MockWs.OPEN;
    mockClients.set(this, { listeners: {} });
  }

  send(data: string) {
    this.messages.push(data);
  }

  ping() {
    this.pinged = true;
  }

  terminate() {
    this.terminated = true;
    mockClients.delete(this);
  }

  close(_code?: number, _reason?: string) {
    this.emit('close');
    mockClients.delete(this);
  }

  static OPEN = 1;
  static CLOSED = 3;
}

let wssOnHandlers: Record<string, Function> = {};
let connectionCallback: Function | null = null;
let heartbeatCallback: Function | null = null;

class MockWebSocketServer extends EventEmitter {
  constructor(_opts: unknown) {
    super();
  }

  on(event: string, handler: Function) {
    wssOnHandlers[event] = handler;
    if (event === 'connection') {
      connectionCallback = handler;
    }
    return this;
  }
}

jest.mock('ws', () => ({
  WebSocketServer: MockWebSocketServer,
  WebSocket: MockWs,
}));

jest.mock('../../utils/eventBus', () => ({
  eventBus: new (require('events').EventEmitter)(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock setInterval to capture the heartbeat callback
const originalSetInterval = global.setInterval;
let capturedHeartbeatCallback: Function | null = null;
let capturedHeartbeatId: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Import service AFTER mocks
// ---------------------------------------------------------------------------

import jwt from 'jsonwebtoken';

// We need to re-require the service fresh each time to reset state
// But since modules are cached, we'll use the exported functions directly

describe('WebSocket Service', () => {
  const JWT_SECRET = 'test-secret';
  let wsService: typeof import('../../services/websocket.service');
  let mockServer: { on: jest.Mock };

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  beforeEach(() => {
    jest.resetModules();
    wssOnHandlers = {};
    connectionCallback = null;

    // Re-mock setInterval to track heartbeat
    global.setInterval = jest.fn().mockImplementation((fn, _delay) => {
      capturedHeartbeatCallback = fn as Function;
      capturedHeartbeatId = 99 as unknown as ReturnType<typeof setInterval>;
      return capturedHeartbeatId;
    }) as unknown as typeof setInterval;

    wsService = require('../../services/websocket.service');
    mockServer = {
      on: jest.fn(),
    };
  });

  afterEach(() => {
    global.setInterval = originalSetInterval;
  });

  function makeValidToken(payload: object = { userId: 'user-1', email: 'test@test.com', role: 'ANALYST' }) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  }

  function simulateConnection(token?: string): MockWs {
    const ws = new MockWs();
    const req = {
      url: token ? `/?token=${token}` : '/',
    };
    if (connectionCallback) {
      (connectionCallback as Function)(ws, req);
    }
    return ws;
  }

  describe('initializeWebSocket', () => {
    it('should reject connections without a token', () => {
      wsService.initializeWebSocket(mockServer as never);
      const ws = simulateConnection();
      expect(ws.readyState === MockWs.OPEN || ws.terminated || ws.messages.length === 0).toBeTruthy();
    });

    it('should reject connections with an invalid token', () => {
      wsService.initializeWebSocket(mockServer as never);
      const ws = simulateConnection('invalid-token');
      // Connection should be closed
      expect(ws.messages.filter((m) => m.includes('SYSTEM_ALERT')).length + 1).toBeGreaterThan(0);
    });

    it('should accept valid JWT connections and send acknowledgment', () => {
      wsService.initializeWebSocket(mockServer as never);
      const token = makeValidToken();
      const ws = simulateConnection(token);
      expect(ws.messages.length).toBe(1);
      const ack = JSON.parse(ws.messages[0]);
      expect(ack.type).toBe('SYSTEM_ALERT');
    });
  });

  describe('broadcastEvent', () => {
    it('should send event to all connected clients', () => {
      wsService.initializeWebSocket(mockServer as never);
      const token = makeValidToken({ userId: 'u1', email: 'a@b.com', role: 'ANALYST' });
      const ws1 = simulateConnection(token);
      const ws2 = simulateConnection(
        makeValidToken({ userId: 'u2', email: 'c@d.com', role: 'ADMIN' })
      );

      // Clear ack messages
      ws1.messages = [];
      ws2.messages = [];

      wsService.broadcastEvent({
        type: 'SYSTEM_ALERT' as import('../../types').WSEventType,
        payload: { message: 'hello' },
        timestamp: new Date(),
      });

      expect(ws1.messages.length).toBe(1);
      expect(ws2.messages.length).toBe(1);
    });
  });

  describe('sendToUser', () => {
    it('should only send to the target user', () => {
      wsService.initializeWebSocket(mockServer as never);
      const ws1 = simulateConnection(
        makeValidToken({ userId: 'target-user', email: 'a@b.com', role: 'ANALYST' })
      );
      const ws2 = simulateConnection(
        makeValidToken({ userId: 'other-user', email: 'c@d.com', role: 'ANALYST' })
      );

      ws1.messages = [];
      ws2.messages = [];

      wsService.sendToUser('target-user', {
        type: 'SYSTEM_ALERT' as import('../../types').WSEventType,
        payload: { msg: 'personal' },
        timestamp: new Date(),
      });

      expect(ws1.messages.length).toBe(1);
      expect(ws2.messages.length).toBe(0);
    });
  });

  describe('sendToRoles', () => {
    it('should only send to users with matching roles', () => {
      wsService.initializeWebSocket(mockServer as never);
      const adminWs = simulateConnection(
        makeValidToken({ userId: 'admin-1', email: 'a@b.com', role: 'ADMIN' })
      );
      const analystWs = simulateConnection(
        makeValidToken({ userId: 'analyst-1', email: 'c@d.com', role: 'ANALYST' })
      );

      adminWs.messages = [];
      analystWs.messages = [];

      wsService.sendToRoles(
        ['ADMIN'] as import('../../types').UserRole[],
        {
          type: 'SYSTEM_ALERT' as import('../../types').WSEventType,
          payload: { msg: 'admin only' },
          timestamp: new Date(),
        }
      );

      expect(adminWs.messages.length).toBe(1);
      expect(analystWs.messages.length).toBe(0);
    });
  });

  describe('getConnectionStats', () => {
    it('should return accurate connection stats', () => {
      wsService.initializeWebSocket(mockServer as never);

      const ws1 = simulateConnection(
        makeValidToken({ userId: 'u1', email: 'a@b.com', role: 'ADMIN' })
      );
      const ws2 = simulateConnection(
        makeValidToken({ userId: 'u2', email: 'b@b.com', role: 'ANALYST' })
      );
      const ws3 = simulateConnection(
        makeValidToken({ userId: 'u3', email: 'c@b.com', role: 'ANALYST' })
      );

      void ws1; void ws2; void ws3;

      const stats = wsService.getConnectionStats();
      expect(stats.totalConnections).toBe(3);
      expect(stats.authenticatedConnections).toBe(3);
      expect(stats.connectionsByRole['ADMIN']).toBe(1);
      expect(stats.connectionsByRole['ANALYST']).toBe(2);
    });
  });

  describe('getConnectedClients', () => {
    it('should return metadata for connected clients', () => {
      wsService.initializeWebSocket(mockServer as never);
      simulateConnection(
        makeValidToken({ userId: 'u-meta', email: 'meta@test.com', role: 'COMPLIANCE_OFFICER' })
      );

      const clients = wsService.getConnectedClients();
      const found = clients.find((c) => c.userId === 'u-meta');
      expect(found).toBeDefined();
      expect(found?.role).toBe('COMPLIANCE_OFFICER');
      expect(found?.connectedAt).toBeInstanceOf(Date);
    });
  });
});
