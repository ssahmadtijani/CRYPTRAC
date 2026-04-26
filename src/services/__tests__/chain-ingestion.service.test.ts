/**
 * Chain Ingestion Service Tests for CRYPTRAC
 * Tests the watch-list and status management (pure/in-memory functions).
 * The full block-polling loop requires a live RPC and is excluded.
 */

import {
  getIngestionStatus,
  addWatchedAddress,
  removeWatchedAddress,
  getWatchedAddresses,
  stopIngestion,
} from '../chain-ingestion.service';

// Mock ethers so no real RPC calls are made during import
jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn(),
    id: jest.fn().mockReturnValue('0xmocktopic'),
    Interface: jest.fn(),
  },
}));

// Mock Prisma — ingestion service reads/writes BlockSyncState and Transaction
jest.mock('../../lib/prisma', () => ({
  prisma: {
    blockSyncState: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    watchedAddress: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    transaction: {
      create: jest.fn().mockResolvedValue({ id: 'tx-ingested' }),
    },
  },
}));

// ---------------------------------------------------------------------------
// getIngestionStatus
// ---------------------------------------------------------------------------

describe('getIngestionStatus', () => {
  it('returns a valid BlockSyncState object', () => {
    const status = getIngestionStatus();
    expect(status).toHaveProperty('network');
    expect(status).toHaveProperty('lastBlock');
    expect(status).toHaveProperty('isRunning');
    expect(status).toHaveProperty('updatedAt');
  });

  it('is not running before startIngestion is called', () => {
    const status = getIngestionStatus();
    expect(status.isRunning).toBe(false);
  });

  it('returns a copy (mutation does not affect internal state)', () => {
    const status = getIngestionStatus();
    status.isRunning = true;
    expect(getIngestionStatus().isRunning).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addWatchedAddress
// ---------------------------------------------------------------------------

describe('addWatchedAddress', () => {
  beforeEach(() => {
    // Clean up any addresses added in previous tests
    const existing = getWatchedAddresses();
    existing.forEach((a) => removeWatchedAddress(a.address));
  });

  it('adds an address to the watch list', () => {
    addWatchedAddress('0xWatchMe', { label: 'Test Address', network: 'ethereum' });
    const list = getWatchedAddresses();
    expect(list.some((a) => a.address === '0xwatchme')).toBe(true);
  });

  it('normalises addresses to lowercase', () => {
    addWatchedAddress('0xABCDEF', { network: 'ethereum' });
    const list = getWatchedAddresses();
    expect(list.some((a) => a.address === '0xabcdef')).toBe(true);
    expect(list.some((a) => a.address === '0xABCDEF')).toBe(false);
  });

  it('stores the label when provided', () => {
    addWatchedAddress('0xlabelled', { label: 'My Label', network: 'ethereum' });
    const list = getWatchedAddresses();
    const entry = list.find((a) => a.address === '0xlabelled');
    expect(entry?.label).toBe('My Label');
  });

  it('defaults network to "ethereum" when not provided', () => {
    addWatchedAddress('0xdefaultnet');
    const list = getWatchedAddresses();
    const entry = list.find((a) => a.address === '0xdefaultnet');
    expect(entry?.network).toBe('ethereum');
  });
});

// ---------------------------------------------------------------------------
// removeWatchedAddress
// ---------------------------------------------------------------------------

describe('removeWatchedAddress', () => {
  it('removes a previously added address and returns true', () => {
    addWatchedAddress('0xToRemove', { network: 'ethereum' });
    const removed = removeWatchedAddress('0xToRemove');
    expect(removed).toBe(true);
    const list = getWatchedAddresses();
    expect(list.some((a) => a.address === '0xtoremove')).toBe(false);
  });

  it('returns false when address does not exist', () => {
    const removed = removeWatchedAddress('0xnonexistent');
    expect(removed).toBe(false);
  });

  it('is case-insensitive', () => {
    addWatchedAddress('0xCaseTest', { network: 'ethereum' });
    const removed = removeWatchedAddress('0xcasetest');
    expect(removed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getWatchedAddresses
// ---------------------------------------------------------------------------

describe('getWatchedAddresses', () => {
  beforeEach(() => {
    const existing = getWatchedAddresses();
    existing.forEach((a) => removeWatchedAddress(a.address));
  });

  it('returns an empty array when no addresses are watched', () => {
    const list = getWatchedAddresses();
    expect(list).toHaveLength(0);
  });

  it('returns all added addresses with correct shape', () => {
    addWatchedAddress('0xaddr1', { label: 'A1', network: 'bsc' });
    addWatchedAddress('0xaddr2', { label: 'A2', network: 'polygon' });

    const list = getWatchedAddresses();
    expect(list).toHaveLength(2);

    const a1 = list.find((a) => a.address === '0xaddr1');
    expect(a1).toEqual({ address: '0xaddr1', label: 'A1', network: 'bsc' });

    const a2 = list.find((a) => a.address === '0xaddr2');
    expect(a2).toEqual({ address: '0xaddr2', label: 'A2', network: 'polygon' });
  });
});

// ---------------------------------------------------------------------------
// stopIngestion
// ---------------------------------------------------------------------------

describe('stopIngestion', () => {
  it('does not throw when called while not running', () => {
    expect(() => stopIngestion()).not.toThrow();
  });

  it('sets isRunning to false', () => {
    stopIngestion();
    expect(getIngestionStatus().isRunning).toBe(false);
  });
});
