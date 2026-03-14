/**
 * Wallet Service for CRYPTRAC
 * Wallet registration, risk scoring, and sanctions checking
 */

import { Wallet, RiskLevel } from '../types';
import { WalletInput } from '../validators/schemas';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import * as sanctionsService from './sanctions.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapPrismaWallet(w: {
  id: string;
  address: string;
  network: string;
  label: string | null;
  riskScore: number;
  riskLevel: string;
  isSanctioned: boolean;
  sanctionDetails: string | null;
  userId: string;
  firstSeen: Date;
  lastSeen: Date;
  transactionCount: number;
  totalVolumeUSD: number;
  createdAt: Date;
  updatedAt: Date;
}): Wallet {
  return {
    id: w.id,
    address: w.address,
    network: w.network,
    label: w.label ?? undefined,
    riskScore: w.riskScore,
    riskLevel: w.riskLevel as RiskLevel,
    isSanctioned: w.isSanctioned,
    sanctionDetails: w.sanctionDetails ?? undefined,
    userId: w.userId,
    firstSeen: w.firstSeen,
    lastSeen: w.lastSeen,
    transactionCount: w.transactionCount,
    totalVolumeUSD: w.totalVolumeUSD,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers a new wallet with initial risk scoring, or returns existing.
 */
export async function registerWallet(
  data: WalletInput,
  userId: string
): Promise<Wallet> {
  const address = data.address.toLowerCase();

  // Check against the live sanctions service (falls back gracefully if list not yet loaded)
  const sanctionCheck = sanctionsService.checkAddress(address);
  const isSanctioned = sanctionCheck.isSanctioned;
  const sanctionDetails =
    sanctionCheck.entries.length > 0
      ? sanctionCheck.entries.map((e) => e.details ?? e.name).join('; ')
      : undefined;

  const riskScore = calculateInitialRiskScore(address, isSanctioned);
  const riskLevel = scoreToRiskLevel(riskScore);

  const record = await prisma.wallet.upsert({
    where: { address },
    create: {
      address,
      network: data.network,
      label: data.label,
      riskScore,
      riskLevel,
      isSanctioned,
      sanctionDetails: sanctionDetails ?? null,
      userId,
    },
    update: {},
  });

  logger.info('Wallet registered', {
    walletId: record.id,
    address: record.address,
    isSanctioned,
    riskLevel,
  });

  return mapPrismaWallet(record);
}

/**
 * Returns a wallet by address, or null if not found.
 */
export async function getWalletByAddress(address: string): Promise<Wallet | null> {
  const found = await prisma.wallet.findUnique({
    where: { address: address.toLowerCase() },
  });
  return found ? mapPrismaWallet(found) : null;
}

/**
 * Recalculates and updates the risk score for a wallet.
 */
export async function updateWalletRiskScore(address: string): Promise<Wallet | null> {
  const existing = await prisma.wallet.findUnique({
    where: { address: address.toLowerCase() },
  });
  if (!existing) return null;

  const wallet = mapPrismaWallet(existing);
  const riskScore = calculateDynamicRiskScore(wallet);
  const riskLevel = scoreToRiskLevel(riskScore);

  const updated = await prisma.wallet.update({
    where: { address: address.toLowerCase() },
    data: { riskScore, riskLevel },
  });

  logger.info('Wallet risk score updated', {
    address: updated.address,
    riskScore,
    riskLevel,
  });

  return mapPrismaWallet(updated);
}

/**
 * Checks whether an address appears on the sanctions list.
 */
export async function checkSanctionsList(
  address: string
): Promise<{ isSanctioned: boolean; details?: string }> {
  // First check the live sanctions service
  const liveCheck = sanctionsService.checkAddress(address);
  if (liveCheck.isSanctioned) {
    const details = liveCheck.entries.map((e) => e.details ?? e.name).join('; ');
    logger.info('Sanctions check performed', { address, isSanctioned: true, source: 'live' });
    return { isSanctioned: true, details };
  }

  // Also check persisted wallet record for any stored sanctions data
  const stored = await prisma.wallet.findUnique({
    where: { address: address.toLowerCase() },
    select: { isSanctioned: true, sanctionDetails: true },
  });

  const isSanctioned = stored?.isSanctioned ?? false;
  const details = stored?.sanctionDetails ?? undefined;

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
  if (isSanctioned) score += 80;
  if (address.length < 10) score += 20;
  return Math.min(score, 100);
}

function calculateDynamicRiskScore(wallet: Wallet): number {
  let score = 0;
  if (wallet.isSanctioned) score += 80;
  if (wallet.totalVolumeUSD >= 1_000_000) score += 20;
  else if (wallet.totalVolumeUSD >= 100_000) score += 10;
  if (wallet.transactionCount >= 1000) score += 10;
  else if (wallet.transactionCount >= 100) score += 5;
  return Math.min(score, 100);
}

function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 75) return RiskLevel.CRITICAL;
  if (score >= 50) return RiskLevel.HIGH;
  if (score >= 25) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}
