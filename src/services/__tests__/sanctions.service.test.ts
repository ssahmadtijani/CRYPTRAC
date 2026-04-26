/**
 * Sanctions Service Tests for CRYPTRAC
 * Tests the in-memory CSV parsing and address-checking logic.
 */

import {
  checkAddress,
  getSanctionsListStatus,
  getAllSanctionedAddresses,
  refreshSanctionsList,
} from '../sanctions.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the logger so it does not try to write log files
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// CSV fixtures
// ---------------------------------------------------------------------------

/** Minimal OFAC SDN CSV: entity 12345 named "ACME LAUNDROMAT" */
const SDN_CSV = `12345,-0- ACME LAUNDROMAT,SDN,,,,,,,,,\n`;

/** Minimal OFAC ALT CSV: ETH digital currency address linked to entity 12345 */
const ALT_CSV = `12345,99999,Digital Currency Address - ETH,0xdeadbeef1234567890,\n`;

// ---------------------------------------------------------------------------
// Helper: mock https.get to return a fake HTTP response with CSV content
// ---------------------------------------------------------------------------

function mockHttpsResponse(csvContent: string): void {
  const https = require('https');
  https.get.mockImplementation((_url: string, callback: (res: NodeJS.EventEmitter & { statusCode: number; headers: Record<string, string> }) => void) => {
    const EventEmitter = require('events');
    const res = new EventEmitter() as NodeJS.EventEmitter & { statusCode: number; headers: Record<string, string> };
    res.statusCode = 200;
    res.headers = {};

    callback(res);

    // Emit data and end asynchronously
    setImmediate(() => {
      res.emit('data', Buffer.from(csvContent));
      res.emit('end');
    });

    const reqEmitter = new EventEmitter();
    return reqEmitter;
  });
}

// Mock https/http — both call mockImplementation inside each test
jest.mock('https', () => ({ get: jest.fn() }));
jest.mock('http', () => ({ get: jest.fn() }));

// ---------------------------------------------------------------------------
// Helper: load fixture via mocked https
// ---------------------------------------------------------------------------

let callCount = 0;

async function loadFixture(): Promise<void> {
  const https = require('https');
  callCount = 0;
  https.get.mockImplementation((_url: string, callback: (res: NodeJS.EventEmitter & { statusCode: number; headers: Record<string, string> }) => void) => {
    const EventEmitter = require('events');
    const res = new EventEmitter() as NodeJS.EventEmitter & { statusCode: number; headers: Record<string, string> };
    res.statusCode = 200;
    res.headers = {};

    callback(res);

    // First call → SDN CSV, second call → ALT CSV
    const data = callCount === 0 ? SDN_CSV : ALT_CSV;
    callCount++;

    setImmediate(() => {
      res.emit('data', Buffer.from(data));
      res.emit('end');
    });

    const reqEmitter = new EventEmitter();
    return reqEmitter;
  });

  await refreshSanctionsList();
}

// ---------------------------------------------------------------------------
// checkAddress
// ---------------------------------------------------------------------------

describe('checkAddress (before list is loaded)', () => {
  it('returns isSanctioned: false for any address when list is empty', () => {
    const result = checkAddress('0xsomerandomaddress');
    expect(result.isSanctioned).toBe(false);
    expect(result.entries).toHaveLength(0);
  });
});

describe('checkAddress (after list is loaded)', () => {
  beforeAll(async () => {
    await loadFixture();
  });

  it('returns isSanctioned: true for a known sanctioned address', () => {
    const result = checkAddress('0xdeadbeef1234567890');
    expect(result.isSanctioned).toBe(true);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries[0].source).toBe('OFAC');
  });

  it('returns isSanctioned: true regardless of address casing', () => {
    const result = checkAddress('0xDEADBEEF1234567890');
    expect(result.isSanctioned).toBe(true);
  });

  it('returns isSanctioned: false for an unknown address', () => {
    const result = checkAddress('0xcleanaddress');
    expect(result.isSanctioned).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSanctionsListStatus
// ---------------------------------------------------------------------------

describe('getSanctionsListStatus', () => {
  it('reports isLoaded: true after refresh', () => {
    const status = getSanctionsListStatus();
    expect(status.isLoaded).toBe(true);
    expect(status.lastRefreshed).toBeInstanceOf(Date);
    expect(status.entryCount).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// getAllSanctionedAddresses
// ---------------------------------------------------------------------------

describe('getAllSanctionedAddresses', () => {
  it('returns a Map of all sanctioned addresses', () => {
    const map = getAllSanctionedAddresses();
    expect(map instanceof Map).toBe(true);
    expect(map.has('0xdeadbeef1234567890')).toBe(true);
  });

  it('returns a copy (mutation does not affect internal state)', () => {
    const map = getAllSanctionedAddresses();
    map.clear();
    const map2 = getAllSanctionedAddresses();
    expect(map2.size).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// refreshSanctionsList — error handling
// ---------------------------------------------------------------------------

describe('refreshSanctionsList error handling', () => {
  it('throws when HTTPS request emits an error', async () => {
    const https = require('https');
    https.get.mockImplementation((_url: string, _callback: unknown) => {
      const EventEmitter = require('events');
      const reqEmitter = new EventEmitter();
      setImmediate(() => reqEmitter.emit('error', new Error('Network failure')));
      return reqEmitter;
    });

    await expect(refreshSanctionsList()).rejects.toThrow();
  });
});
