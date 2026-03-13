import { v4 as uuidv4 } from 'uuid';
import { Wallet } from '../types';
import { WalletInput } from '../validators/schemas';

const MOCK_SANCTIONED_ADDRESSES = new Set([
  '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  '0x0000000000000000000000000000000000000001',
]);

const wallets: Wallet[] = [];

export const walletService = {
  registerWallet(input: WalletInput): Wallet {
    const existing = wallets.find(
      (w) =>
        w.address.toLowerCase() === input.address.toLowerCase() &&
        w.blockchain === input.blockchain
    );
    if (existing) {
      const err = new Error(
        `Wallet ${input.address} already registered on ${input.blockchain}`
      ) as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    }

    const isSanctioned = MOCK_SANCTIONED_ADDRESSES.has(
      input.address.toLowerCase()
    );
    const now = new Date();

    const wallet: Wallet = {
      id: uuidv4(),
      address: input.address,
      blockchain: input.blockchain,
      userId: input.userId,
      label: input.label,
      riskScore: isSanctioned ? 100 : 0,
      isSanctioned,
      lastChecked: now,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    wallets.push(wallet);
    return wallet;
  },

  getWallet(address: string): Wallet | undefined {
    return wallets.find(
      (w) => w.address.toLowerCase() === address.toLowerCase()
    );
  },

  getWallets(
    filter: { userId?: string; blockchain?: string; page?: number; limit?: number } = {}
  ): { data: Wallet[]; total: number } {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    let filtered = wallets.filter((w) => {
      if (filter.userId && w.userId !== filter.userId) return false;
      if (filter.blockchain && w.blockchain !== filter.blockchain) return false;
      return true;
    });

    const total = filtered.length;
    filtered = filtered.slice((page - 1) * limit, page * limit);

    return { data: filtered, total };
  },

  updateRiskScore(address: string, score: number): Wallet {
    const wallet = wallets.find(
      (w) => w.address.toLowerCase() === address.toLowerCase()
    );
    if (!wallet) {
      const err = new Error(`Wallet ${address} not found`) as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    wallet.riskScore = score;
    wallet.updatedAt = new Date();
    return wallet;
  },

  checkSanctions(
    address: string
  ): { address: string; isSanctioned: boolean; checkedAt: Date } {
    const isSanctioned = MOCK_SANCTIONED_ADDRESSES.has(address.toLowerCase());
    const checkedAt = new Date();

    const wallet = wallets.find(
      (w) => w.address.toLowerCase() === address.toLowerCase()
    );
    if (wallet) {
      wallet.isSanctioned = isSanctioned;
      wallet.lastChecked = checkedAt;
      wallet.updatedAt = checkedAt;
    }

    return { address, isSanctioned, checkedAt };
  },
};
/**
 * Wallet Service for CRYPTRAC
 * Wallet registration, risk scoring, and sanctions checking
 */

import { v4 as uuidv4 } from 'uuid';
import { Wallet, RiskLevel } from '../types';
import { WalletInput } from '../validators/schemas';
import { logger } from '../utils/logger';

// In-memory wallet store (replace with Prisma in production)
const wallets: Map<string, Wallet> = new Map();

// ---------------------------------------------------------------------------
// Stub sanctions list (replace with live OFAC/UN/EU list integration)
// ---------------------------------------------------------------------------
const SANCTIONED_ADDRESSES: Map<string, string> = new Map([
  [
    '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    'OFAC SDN List — suspected money laundering',
  ],
  [
    '0x0000000000000000000000000000000000000001',
    'UN Security Council Consolidated List',
  ],
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers a new wallet with initial risk scoring.
 */
export async function registerWallet(
  data: WalletInput,
  userId: string
): Promise<Wallet> {
  const existing = wallets.get(data.address.toLowerCase());
  if (existing) {
    return existing;
  }

  const sanctionDetails = SANCTIONED_ADDRESSES.get(data.address.toLowerCase());
  const isSanctioned = sanctionDetails !== undefined;

  const riskScore = calculateInitialRiskScore(data.address, isSanctioned);
  const riskLevel = scoreToRiskLevel(riskScore);

  const now = new Date();
  const wallet: Wallet = {
    id: uuidv4(),
    address: data.address.toLowerCase(),
    network: data.network,
    label: data.label,
    riskScore,
    riskLevel,
    isSanctioned,
    sanctionDetails: sanctionDetails ?? undefined,
    userId,
    firstSeen: now,
    lastSeen: now,
    transactionCount: 0,
    totalVolumeUSD: 0,
    createdAt: now,
    updatedAt: now,
  };

  wallets.set(wallet.address, wallet);

  logger.info('Wallet registered', {
    walletId: wallet.id,
    address: wallet.address,
    isSanctioned,
    riskLevel,
  });

  return wallet;
}

/**
 * Returns a wallet by address, or null if not found.
 */
export async function getWalletByAddress(address: string): Promise<Wallet | null> {
  return wallets.get(address.toLowerCase()) ?? null;
}

/**
 * Recalculates and updates the risk score for a wallet.
 */
export async function updateWalletRiskScore(address: string): Promise<Wallet | null> {
  const wallet = wallets.get(address.toLowerCase());
  if (!wallet) return null;

  const riskScore = calculateDynamicRiskScore(wallet);
  const riskLevel = scoreToRiskLevel(riskScore);

  wallet.riskScore = riskScore;
  wallet.riskLevel = riskLevel;
  wallet.updatedAt = new Date();

  logger.info('Wallet risk score updated', {
    address: wallet.address,
    riskScore,
    riskLevel,
  });

  return wallet;
}

/**
 * Checks whether an address appears on the sanctions list.
 */
export async function checkSanctionsList(
  address: string
): Promise<{ isSanctioned: boolean; details?: string }> {
  const details = SANCTIONED_ADDRESSES.get(address.toLowerCase());
  const isSanctioned = details !== undefined;

  logger.info('Sanctions check performed', { address, isSanctioned });

  return { isSanctioned, details };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function calculateInitialRiskScore(
  address: string,
  isSanctioned: boolean
): number {
  let score = 0;

  if (isSanctioned) {
    score += 80;
  }

  // Heuristic: contract-like addresses (very short or specific patterns)
  if (address.length < 10) {
    score += 20;
  }

  return Math.min(score, 100);
}

function calculateDynamicRiskScore(wallet: Wallet): number {
  let score = 0;

  if (wallet.isSanctioned) {
    score += 80;
  }

  // High transaction volume raises risk
  if (wallet.totalVolumeUSD >= 1_000_000) {
    score += 20;
  } else if (wallet.totalVolumeUSD >= 100_000) {
    score += 10;
  }

  // High transaction frequency raises risk
  if (wallet.transactionCount >= 1000) {
    score += 10;
  } else if (wallet.transactionCount >= 100) {
    score += 5;
  }

  return Math.min(score, 100);
}

function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 75) return RiskLevel.CRITICAL;
  if (score >= 50) return RiskLevel.HIGH;
  if (score >= 25) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}
