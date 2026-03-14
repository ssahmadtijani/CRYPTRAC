/**
 * Risk Engine Service for CRYPTRAC
 * Pattern-based heuristic risk scoring for transactions and addresses.
 */

import { Transaction, RiskLevel } from '../types';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import * as sanctionsService from './sanctions.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeuristicResult {
  name: string;
  score: number;
  weight: number;
  triggered: boolean;
  detail?: string;
}

export interface RiskAssessmentResult {
  compositeScore: number;
  riskLevel: RiskLevel;
  heuristics: HeuristicResult[];
  assessedAt: Date;
}

export interface HeuristicConfig {
  name: string;
  description: string;
  weight: number;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Configurable heuristic weights (mutable at runtime via the route)
// ---------------------------------------------------------------------------

const heuristicWeights: Record<string, number> = {
  structuring: 0.30,
  rapidMovement: 0.25,
  highFrequency: 0.20,
  roundAmount: 0.10,
  sanctionedAddress: 0.15,
};

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const REPORTING_THRESHOLD_USD = 10_000;
const STRUCTURING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const STRUCTURING_TX_MIN = 3;
const RAPID_MOVEMENT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const HIGH_FREQ_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const HIGH_FREQ_TX_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Individual heuristics
// ---------------------------------------------------------------------------

/**
 * Structuring detection: multiple transactions from same address just below
 * the reporting threshold within the last 24 hours.
 */
async function detectStructuring(
  transaction: Pick<Transaction, 'senderAddress' | 'amountUSD' | 'timestamp'>
): Promise<HeuristicResult> {
  const name = 'structuring';
  const threshold = REPORTING_THRESHOLD_USD;
  const windowStart = new Date(
    transaction.timestamp.getTime() - STRUCTURING_WINDOW_MS
  );

  // Look for transactions from this sender in the 80–99% range of the threshold
  const lowerBound = threshold * 0.8;
  const upperBound = threshold * 0.99;

  let count = 0;
  try {
    count = await prisma.transaction.count({
      where: {
        senderAddress: {
          equals: transaction.senderAddress.toLowerCase(),
          mode: 'insensitive',
        },
        amountUSD: { gte: lowerBound, lte: upperBound },
        timestamp: { gte: windowStart },
      },
    });
  } catch {
    // DB may not be reachable; return neutral score
  }

  const triggered = count >= STRUCTURING_TX_MIN;
  const score = triggered ? Math.min(100, 40 + (count - STRUCTURING_TX_MIN) * 10) : 0;

  return {
    name,
    score,
    weight: heuristicWeights[name] ?? 0,
    triggered,
    detail: triggered
      ? `${count} transactions from same address near reporting threshold in 24h window`
      : undefined,
  };
}

/**
 * Rapid movement: funds received and sent out within a short time window
 * for the same address.
 */
async function detectRapidMovement(
  transaction: Pick<Transaction, 'receiverAddress' | 'timestamp'>
): Promise<HeuristicResult> {
  const name = 'rapidMovement';
  const windowStart = new Date(
    transaction.timestamp.getTime() - RAPID_MOVEMENT_WINDOW_MS
  );
  const windowEnd = new Date(
    transaction.timestamp.getTime() + RAPID_MOVEMENT_WINDOW_MS
  );

  let inboundCount = 0;
  let outboundCount = 0;

  try {
    [inboundCount, outboundCount] = await Promise.all([
      prisma.transaction.count({
        where: {
          receiverAddress: {
            equals: transaction.receiverAddress.toLowerCase(),
            mode: 'insensitive',
          },
          timestamp: { gte: windowStart, lte: windowEnd },
        },
      }),
      prisma.transaction.count({
        where: {
          senderAddress: {
            equals: transaction.receiverAddress.toLowerCase(),
            mode: 'insensitive',
          },
          timestamp: { gte: windowStart, lte: windowEnd },
        },
      }),
    ]);
  } catch {
    // DB not reachable
  }

  const triggered = inboundCount > 0 && outboundCount > 0;
  const score = triggered ? 70 : 0;

  return {
    name,
    score,
    weight: heuristicWeights[name] ?? 0,
    triggered,
    detail: triggered
      ? `Address received and sent funds within ${RAPID_MOVEMENT_WINDOW_MS / 60000} minute window`
      : undefined,
  };
}

/**
 * High frequency: unusually high transaction count from a single address
 * in a 1-hour window.
 */
async function detectHighFrequency(
  transaction: Pick<Transaction, 'senderAddress' | 'timestamp'>
): Promise<HeuristicResult> {
  const name = 'highFrequency';
  const windowStart = new Date(
    transaction.timestamp.getTime() - HIGH_FREQ_WINDOW_MS
  );

  let count = 0;
  try {
    count = await prisma.transaction.count({
      where: {
        senderAddress: {
          equals: transaction.senderAddress.toLowerCase(),
          mode: 'insensitive',
        },
        timestamp: { gte: windowStart },
      },
    });
  } catch {
    // DB not reachable
  }

  const triggered = count >= HIGH_FREQ_TX_THRESHOLD;
  const score = triggered ? Math.min(100, 30 + (count - HIGH_FREQ_TX_THRESHOLD) * 5) : 0;

  return {
    name,
    score,
    weight: heuristicWeights[name] ?? 0,
    triggered,
    detail: triggered
      ? `${count} transactions from same address in 1-hour window (threshold: ${HIGH_FREQ_TX_THRESHOLD})`
      : undefined,
  };
}

/**
 * Round amounts: suspicious round-number transactions above a minimum threshold.
 */
function detectRoundAmount(
  transaction: Pick<Transaction, 'amountUSD'>
): HeuristicResult {
  const name = 'roundAmount';
  const amt = transaction.amountUSD;

  const isRound =
    amt >= 5_000 &&
    (amt % 10_000 === 0 ||
      amt % 5_000 === 0 ||
      amt % 1_000 === 0);

  return {
    name,
    score: isRound ? 40 : 0,
    weight: heuristicWeights[name] ?? 0,
    triggered: isRound,
    detail: isRound ? `Round amount detected: $${amt.toLocaleString()}` : undefined,
  };
}

/**
 * Sanctioned address: interaction with OFAC-sanctioned addresses.
 */
function detectSanctionedAddress(
  transaction: Pick<Transaction, 'senderAddress' | 'receiverAddress'>
): HeuristicResult {
  const name = 'sanctionedAddress';

  const senderResult = sanctionsService.checkAddress(transaction.senderAddress);
  const receiverResult = sanctionsService.checkAddress(transaction.receiverAddress);

  const triggered = senderResult.isSanctioned || receiverResult.isSanctioned;
  const details: string[] = [];
  if (senderResult.isSanctioned) details.push('sender is sanctioned');
  if (receiverResult.isSanctioned) details.push('receiver is sanctioned');

  return {
    name,
    score: triggered ? 100 : 0,
    weight: heuristicWeights[name] ?? 0,
    triggered,
    detail: details.join('; ') || undefined,
  };
}

// ---------------------------------------------------------------------------
// Composite scoring
// ---------------------------------------------------------------------------

function buildComposite(results: HeuristicResult[]): {
  compositeScore: number;
  riskLevel: RiskLevel;
} {
  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
  const weighted = results.reduce(
    (sum, r) => sum + r.score * r.weight,
    0
  );
  const compositeScore =
    totalWeight > 0 ? Math.min(100, Math.round(weighted / totalWeight)) : 0;

  let riskLevel: RiskLevel;
  if (compositeScore >= 75) riskLevel = RiskLevel.CRITICAL;
  else if (compositeScore >= 50) riskLevel = RiskLevel.HIGH;
  else if (compositeScore >= 25) riskLevel = RiskLevel.MEDIUM;
  else riskLevel = RiskLevel.LOW;

  return { compositeScore, riskLevel };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs all heuristics against a transaction and returns a composite risk score.
 */
export async function assessTransactionRisk(
  transaction: Transaction
): Promise<RiskAssessmentResult> {
  const [structuringResult, rapidResult, highFreqResult] = await Promise.all([
    detectStructuring(transaction),
    detectRapidMovement(transaction),
    detectHighFrequency(transaction),
  ]);

  const roundResult = detectRoundAmount(transaction);
  const sanctionResult = detectSanctionedAddress(transaction);

  const heuristics = [
    structuringResult,
    rapidResult,
    highFreqResult,
    roundResult,
    sanctionResult,
  ];

  const { compositeScore, riskLevel } = buildComposite(heuristics);

  logger.info('Transaction risk assessed', {
    transactionId: transaction.id,
    compositeScore,
    riskLevel,
  });

  return {
    compositeScore,
    riskLevel,
    heuristics,
    assessedAt: new Date(),
  };
}

/**
 * Runs heuristics for a given address by constructing a synthetic context
 * from recent activity.
 */
export async function assessAddressRisk(
  address: string
): Promise<RiskAssessmentResult> {
  const normalised = address.toLowerCase();

  // Build a synthetic transaction context based on the most recent transaction
  // from this address, or use defaults if no history exists.
  let syntheticTx: Transaction;
  try {
    const latest = await prisma.transaction.findFirst({
      where: {
        OR: [
          { senderAddress: { equals: normalised, mode: 'insensitive' } },
          { receiverAddress: { equals: normalised, mode: 'insensitive' } },
        ],
      },
      orderBy: { timestamp: 'desc' },
    });

    if (latest) {
      syntheticTx = {
        id: latest.id,
        txHash: latest.txHash ?? '',
        type: latest.type as Transaction['type'],
        senderAddress: latest.senderAddress,
        receiverAddress: latest.receiverAddress,
        asset: latest.asset,
        amount: latest.amount,
        amountUSD: latest.amountUSD,
        fee: latest.fee,
        feeUSD: latest.feeUSD,
        blockNumber: latest.blockNumber ?? undefined,
        network: latest.network,
        timestamp: latest.timestamp,
        riskLevel: latest.riskLevel as RiskLevel,
        riskScore: latest.riskScore,
        complianceStatus: latest.complianceStatus as Transaction['complianceStatus'],
        userId: latest.userId,
        createdAt: latest.createdAt,
        updatedAt: latest.updatedAt,
      };
    } else {
      // No history — build a minimal context
      syntheticTx = {
        id: '',
        txHash: '',
        type: 'TRANSFER' as Transaction['type'],
        senderAddress: normalised,
        receiverAddress: normalised,
        asset: 'ETH',
        amount: 0,
        amountUSD: 0,
        fee: 0,
        feeUSD: 0,
        network: 'ethereum',
        timestamp: new Date(),
        riskLevel: RiskLevel.LOW,
        riskScore: 0,
        complianceStatus: 'PENDING' as Transaction['complianceStatus'],
        userId: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  } catch {
    syntheticTx = {
      id: '',
      txHash: '',
      type: 'TRANSFER' as Transaction['type'],
      senderAddress: normalised,
      receiverAddress: normalised,
      asset: 'ETH',
      amount: 0,
      amountUSD: 0,
      fee: 0,
      feeUSD: 0,
      network: 'ethereum',
      timestamp: new Date(),
      riskLevel: RiskLevel.LOW,
      riskScore: 0,
      complianceStatus: 'PENDING' as Transaction['complianceStatus'],
      userId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  return assessTransactionRisk(syntheticTx);
}

/**
 * Returns the list of available heuristics and their current weights.
 */
export function getRiskHeuristics(): HeuristicConfig[] {
  return [
    {
      name: 'structuring',
      description:
        'Detects multiple transactions just below the reporting threshold from the same address within 24 hours',
      weight: heuristicWeights['structuring'] ?? 0,
      enabled: true,
    },
    {
      name: 'rapidMovement',
      description:
        'Detects funds received and immediately sent out within a 30-minute window (layering indicator)',
      weight: heuristicWeights['rapidMovement'] ?? 0,
      enabled: true,
    },
    {
      name: 'highFrequency',
      description:
        'Detects an unusually high number of transactions from a single address in a 1-hour window',
      weight: heuristicWeights['highFrequency'] ?? 0,
      enabled: true,
    },
    {
      name: 'roundAmount',
      description:
        'Flags suspiciously round transaction amounts (e.g., exactly $10,000 or $50,000)',
      weight: heuristicWeights['roundAmount'] ?? 0,
      enabled: true,
    },
    {
      name: 'sanctionedAddress',
      description:
        'Checks whether either party is on the OFAC SDN sanctions list',
      weight: heuristicWeights['sanctionedAddress'] ?? 0,
      enabled: true,
    },
  ];
}

/**
 * Updates the weight for one or more heuristics.
 * Weights will be normalised to sum to 1.0.
 */
export function updateHeuristicWeights(
  updates: Record<string, number>
): HeuristicConfig[] {
  for (const [name, weight] of Object.entries(updates)) {
    if (name in heuristicWeights) {
      heuristicWeights[name] = Math.max(0, Math.min(1, weight));
    }
  }
  logger.info('Heuristic weights updated', { weights: heuristicWeights });
  return getRiskHeuristics();
}
