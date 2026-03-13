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
