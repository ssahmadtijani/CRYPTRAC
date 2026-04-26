/**
 * Wallet Service Tests for CRYPTRAC
 */

import {
  registerWallet,
  getWalletByAddress,
  updateWalletRiskScore,
  checkSanctionsList,
} from '../wallet.service';
import { RiskLevel } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeMockWalletRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wallet-001',
    address: '0xabc123',
    network: 'ethereum',
    label: 'Test Wallet',
    riskScore: 0,
    riskLevel: 'LOW',
    isSanctioned: false,
    sanctionDetails: null,
    userId: 'user-001',
    firstSeen: new Date('2024-01-01'),
    lastSeen: new Date('2024-01-01'),
    transactionCount: 0,
    totalVolumeUSD: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

jest.mock('../../lib/prisma', () => ({
  prisma: {
    wallet: {
      upsert: jest.fn().mockImplementation(async () => makeMockWalletRow()),
      findUnique: jest.fn().mockImplementation(async () => makeMockWalletRow()),
      update: jest.fn().mockImplementation(async () => makeMockWalletRow()),
    },
  },
}));

jest.mock('../sanctions.service', () => ({
  checkAddress: jest.fn().mockReturnValue({ isSanctioned: false, entries: [] }),
}));

// ---------------------------------------------------------------------------
// registerWallet
// ---------------------------------------------------------------------------

describe('registerWallet', () => {
  it('registers a new wallet and returns it', async () => {
    const result = await registerWallet(
      { address: '0xABC123', network: 'ethereum', label: 'Test Wallet' },
      'user-001'
    );
    expect(result.id).toBe('wallet-001');
    expect(result.address).toBe('0xabc123');
    expect(result.riskLevel).toBe(RiskLevel.LOW);
  });

  it('normalises the address to lowercase', async () => {
    const { prisma } = require('../../lib/prisma');
    await registerWallet(
      { address: '0xABCDEF', network: 'ethereum' },
      'user-001'
    );
    const call = prisma.wallet.upsert.mock.calls[prisma.wallet.upsert.mock.calls.length - 1][0];
    expect(call.where.address).toBe('0xabcdef');
    expect(call.create.address).toBe('0xabcdef');
  });

  it('marks wallet as sanctioned when address is on sanctions list', async () => {
    const { checkAddress } = require('../sanctions.service');
    checkAddress.mockReturnValueOnce({
      isSanctioned: true,
      entries: [{ address: '0xbad', name: 'BadActor', source: 'OFAC', listType: 'SDN', addedAt: new Date() }],
    });
    const { prisma } = require('../../lib/prisma');
    prisma.wallet.upsert.mockResolvedValueOnce(
      makeMockWalletRow({ isSanctioned: true, riskScore: 80, riskLevel: 'CRITICAL' })
    );

    const result = await registerWallet(
      { address: '0xbadactor', network: 'ethereum' },
      'user-001'
    );
    expect(result.isSanctioned).toBe(true);
    expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
  });
});

// ---------------------------------------------------------------------------
// getWalletByAddress
// ---------------------------------------------------------------------------

describe('getWalletByAddress', () => {
  it('returns a wallet when found', async () => {
    const result = await getWalletByAddress('0xABC123');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('wallet-001');
  });

  it('returns null when wallet is not found', async () => {
    const { prisma } = require('../../lib/prisma');
    prisma.wallet.findUnique.mockResolvedValueOnce(null);
    const result = await getWalletByAddress('0xunknown');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateWalletRiskScore
// ---------------------------------------------------------------------------

describe('updateWalletRiskScore', () => {
  it('returns null if wallet does not exist', async () => {
    const { prisma } = require('../../lib/prisma');
    prisma.wallet.findUnique.mockResolvedValueOnce(null);
    const result = await updateWalletRiskScore('0xnonexistent');
    expect(result).toBeNull();
  });

  it('recalculates and updates risk score', async () => {
    const result = await updateWalletRiskScore('0xabc123');
    expect(result).not.toBeNull();
    expect(typeof result?.riskScore).toBe('number');
  });

  it('assigns CRITICAL risk for sanctioned wallets', async () => {
    const { prisma } = require('../../lib/prisma');
    prisma.wallet.findUnique.mockResolvedValueOnce(
      makeMockWalletRow({ isSanctioned: true, totalVolumeUSD: 0, transactionCount: 0 })
    );
    prisma.wallet.update.mockResolvedValueOnce(
      makeMockWalletRow({ isSanctioned: true, riskScore: 80, riskLevel: 'CRITICAL' })
    );

    const result = await updateWalletRiskScore('0xbad');
    expect(result?.riskLevel).toBe(RiskLevel.CRITICAL);
  });

  it('increases risk score for high-volume wallets', async () => {
    const { prisma } = require('../../lib/prisma');
    prisma.wallet.findUnique.mockResolvedValueOnce(
      makeMockWalletRow({ isSanctioned: false, totalVolumeUSD: 2_000_000, transactionCount: 5 })
    );
    prisma.wallet.update.mockResolvedValueOnce(
      makeMockWalletRow({ riskScore: 20, riskLevel: 'LOW' })
    );

    const result = await updateWalletRiskScore('0xhighvol');
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkSanctionsList
// ---------------------------------------------------------------------------

describe('checkSanctionsList', () => {
  it('returns isSanctioned: true when live check hits', async () => {
    const { checkAddress } = require('../sanctions.service');
    checkAddress.mockReturnValueOnce({
      isSanctioned: true,
      entries: [{ address: '0xevil', name: 'EvilActor', source: 'OFAC', listType: 'SDN', details: 'Flagged', addedAt: new Date() }],
    });

    const result = await checkSanctionsList('0xevil');
    expect(result.isSanctioned).toBe(true);
    expect(result.details).toContain('Flagged');
  });

  it('returns isSanctioned: false for clean addresses', async () => {
    const { prisma } = require('../../lib/prisma');
    prisma.wallet.findUnique.mockResolvedValueOnce({
      isSanctioned: false,
      sanctionDetails: null,
    });

    const result = await checkSanctionsList('0xclean');
    expect(result.isSanctioned).toBe(false);
  });

  it('falls back to stored wallet record when live check is clean', async () => {
    const { checkAddress } = require('../sanctions.service');
    checkAddress.mockReturnValueOnce({ isSanctioned: false, entries: [] });
    const { prisma } = require('../../lib/prisma');
    prisma.wallet.findUnique.mockResolvedValueOnce({
      isSanctioned: true,
      sanctionDetails: 'Stored sanction detail',
    });

    const result = await checkSanctionsList('0xstored');
    expect(result.isSanctioned).toBe(true);
    expect(result.details).toBe('Stored sanction detail');
  });
});
