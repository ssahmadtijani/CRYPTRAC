/**
 * Pattern Detection Service for CRYPTRAC
 * Detects suspicious transaction patterns using in-memory analysis of
 * Prisma transaction data.
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import {
  Transaction,
  RiskLevel,
  ComplianceStatus,
  TransactionType,
  StructuringPattern,
  RapidMovementPattern,
  LayeringPattern,
  RoundTripPattern,
  PatternDetectionResult,
  PatternHistoryEntry,
} from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** CTR threshold in USD — transactions just below this are suspicious */
const CTR_THRESHOLD = 10_000;

/** Amount considered "just below" the CTR threshold */
const STRUCTURING_LOWER_BOUND = CTR_THRESHOLD * 0.7;

/** Time window for structuring detection (hours) */
const STRUCTURING_WINDOW_HOURS = 24;

/** Maximum time delta (minutes) for rapid movement */
const RAPID_MOVEMENT_WINDOW_MINUTES = 60;

/** Minimum hops for layering detection */
const LAYERING_MIN_HOPS = 3;

/** Time window for layering detection (hours) */
const LAYERING_WINDOW_HOURS = 48;

// ---------------------------------------------------------------------------
// History store (in-memory)
// ---------------------------------------------------------------------------

const patternHistory: PatternHistoryEntry[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapPrismaToTransaction(t: {
  id: string;
  userId: string;
  type: string;
  txHash: string | null;
  senderAddress: string;
  receiverAddress: string;
  asset: string;
  amount: number;
  amountUSD: number;
  fee: number;
  feeUSD: number;
  blockNumber: number | null;
  network: string;
  riskLevel: string;
  riskScore: number;
  complianceStatus: string;
  metadata: unknown;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}): Transaction {
  return {
    id: t.id,
    userId: t.userId,
    type: t.type as TransactionType,
    txHash: t.txHash ?? '',
    senderAddress: t.senderAddress,
    receiverAddress: t.receiverAddress,
    asset: t.asset,
    amount: t.amount,
    amountUSD: t.amountUSD,
    fee: t.fee,
    feeUSD: t.feeUSD,
    blockNumber: t.blockNumber ?? undefined,
    network: t.network,
    riskLevel: t.riskLevel as RiskLevel,
    riskScore: t.riskScore,
    complianceStatus: t.complianceStatus as ComplianceStatus,
    metadata: t.metadata as Record<string, unknown> | undefined,
    timestamp: t.timestamp,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

async function fetchTransactions(userId?: string): Promise<Transaction[]> {
  const records = await prisma.transaction.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { timestamp: 'asc' },
  });
  return records.map(mapPrismaToTransaction);
}

function recordHistory(
  patternType: PatternHistoryEntry['patternType'],
  walletAddress: string,
  transactionCount: number,
  totalVolumeUSD: number
): void {
  patternHistory.push({
    id: uuidv4(),
    patternType,
    walletAddress,
    transactionCount,
    totalVolumeUSD,
    detectedAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Structuring / Smurfing Detection
// ---------------------------------------------------------------------------

export async function detectStructuring(userId?: string): Promise<StructuringPattern[]> {
  const transactions = await fetchTransactions(userId);
  const patterns: StructuringPattern[] = [];

  // Group transactions by sender address
  const bySender = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const group = bySender.get(tx.senderAddress) ?? [];
    group.push(tx);
    bySender.set(tx.senderAddress, group);
  }

  const windowMs = STRUCTURING_WINDOW_HOURS * 60 * 60 * 1000;

  for (const [address, txs] of bySender) {
    // Look for groups within time windows where multiple transactions
    // are in the range [STRUCTURING_LOWER_BOUND, CTR_THRESHOLD)
    const suspiciousTxs = txs.filter(
      (tx) => tx.amountUSD >= STRUCTURING_LOWER_BOUND && tx.amountUSD < CTR_THRESHOLD
    );

    if (suspiciousTxs.length < 2) continue;

    // Sliding window check
    for (let i = 0; i < suspiciousTxs.length; i++) {
      const windowStart = suspiciousTxs[i].timestamp.getTime();
      const windowEnd = windowStart + windowMs;
      const inWindow = suspiciousTxs.filter(
        (tx) =>
          tx.timestamp.getTime() >= windowStart && tx.timestamp.getTime() <= windowEnd
      );

      if (inWindow.length >= 2) {
        const totalAmount = inWindow.reduce((sum, tx) => sum + tx.amountUSD, 0);
        // Avoid duplicate patterns for same wallet in same window
        const isDuplicate = patterns.some(
          (p) =>
            p.walletAddress === address &&
            p.transactions.some((t) => inWindow.some((tx) => tx.id === t.id))
        );
        if (!isDuplicate) {
          patterns.push({
            walletAddress: address,
            transactions: inWindow,
            totalAmount,
            timeWindowHours: STRUCTURING_WINDOW_HOURS,
            detectedAt: new Date(),
          });
          recordHistory('STRUCTURING', address, inWindow.length, totalAmount);
        }
        break;
      }
    }
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Rapid Movement Detection
// ---------------------------------------------------------------------------

export async function detectRapidMovement(userId?: string): Promise<RapidMovementPattern[]> {
  const transactions = await fetchTransactions(userId);
  const patterns: RapidMovementPattern[] = [];
  const windowMs = RAPID_MOVEMENT_WINDOW_MINUTES * 60 * 1000;

  // Group by wallet address (both as sender and receiver)
  const walletActivity = new Map<string, { inbound: Transaction[]; outbound: Transaction[] }>();

  for (const tx of transactions) {
    // Inbound to receiver
    const receiverActivity = walletActivity.get(tx.receiverAddress) ?? {
      inbound: [],
      outbound: [],
    };
    receiverActivity.inbound.push(tx);
    walletActivity.set(tx.receiverAddress, receiverActivity);

    // Outbound from sender
    const senderActivity = walletActivity.get(tx.senderAddress) ?? {
      inbound: [],
      outbound: [],
    };
    senderActivity.outbound.push(tx);
    walletActivity.set(tx.senderAddress, senderActivity);
  }

  for (const [address, activity] of walletActivity) {
    for (const inbound of activity.inbound) {
      for (const outbound of activity.outbound) {
        const delta = outbound.timestamp.getTime() - inbound.timestamp.getTime();
        if (delta > 0 && delta <= windowMs) {
          const timeDeltaMinutes = Math.round(delta / 60000);
          // Avoid duplicates
          const isDuplicate = patterns.some(
            (p) =>
              p.walletAddress === address &&
              p.inboundTransaction.id === inbound.id &&
              p.outboundTransaction.id === outbound.id
          );
          if (!isDuplicate) {
            const amountUSD = Math.min(inbound.amountUSD, outbound.amountUSD);
            patterns.push({
              walletAddress: address,
              inboundTransaction: inbound,
              outboundTransaction: outbound,
              timeDeltaMinutes,
              amountUSD,
              detectedAt: new Date(),
            });
            recordHistory('RAPID_MOVEMENT', address, 2, amountUSD);
          }
        }
      }
    }
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Layering Detection
// ---------------------------------------------------------------------------

export async function detectLayering(userId?: string): Promise<LayeringPattern[]> {
  const transactions = await fetchTransactions(userId);
  const patterns: LayeringPattern[] = [];
  const windowMs = LAYERING_WINDOW_HOURS * 60 * 60 * 1000;

  // Build adjacency map: address -> outbound transactions
  const outboundMap = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const group = outboundMap.get(tx.senderAddress) ?? [];
    group.push(tx);
    outboundMap.set(tx.senderAddress, group);
  }

  // DFS to find chains of 3+ hops within time window
  // currentChain grows as we add edges; currentAddress is the wallet we're currently at
  function findChains(
    currentAddress: string,
    currentChain: Transaction[],
    startTime: number,
    visited: Set<string>
  ): void {
    if (currentChain.length >= LAYERING_MIN_HOPS) {
      const totalVolumeUSD = currentChain.reduce((sum, tx) => sum + tx.amountUSD, 0);
      // Amounts should be decreasing (typical layering)
      let isDecreasing = true;
      for (let i = 1; i < currentChain.length; i++) {
        if (currentChain[i].amountUSD >= currentChain[i - 1].amountUSD) {
          isDecreasing = false;
          break;
        }
      }
      if (isDecreasing) {
        patterns.push({
          chain: [...currentChain],
          originAddress: currentChain[0].senderAddress,
          finalAddress: currentChain[currentChain.length - 1].receiverAddress,
          hops: currentChain.length,
          totalVolumeUSD,
          detectedAt: new Date(),
        });
        recordHistory(
          'LAYERING',
          currentChain[0].senderAddress,
          currentChain.length,
          totalVolumeUSD
        );
      }
      return; // Don't extend chains beyond minimum hops to avoid explosion
    }

    const outbound = outboundMap.get(currentAddress) ?? [];
    for (const tx of outbound) {
      if (visited.has(tx.receiverAddress)) continue;
      const txTime = tx.timestamp.getTime();
      if (txTime < startTime || txTime > startTime + windowMs) continue;

      visited.add(tx.receiverAddress);
      currentChain.push(tx);
      findChains(tx.receiverAddress, currentChain, startTime, visited);
      currentChain.pop();
      visited.delete(tx.receiverAddress);
    }
  }

  // Start DFS from each unique sender address with an empty chain
  const seenOrigins = new Set<string>();
  for (const tx of transactions) {
    if (!seenOrigins.has(tx.senderAddress)) {
      seenOrigins.add(tx.senderAddress);
      const visited = new Set<string>([tx.senderAddress]);
      findChains(tx.senderAddress, [], tx.timestamp.getTime(), visited);
    }
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Round-Tripping Detection
// ---------------------------------------------------------------------------

export async function detectRoundTripping(userId?: string): Promise<RoundTripPattern[]> {
  const transactions = await fetchTransactions(userId);
  const patterns: RoundTripPattern[] = [];

  // Build adjacency map
  const outboundMap = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const group = outboundMap.get(tx.senderAddress) ?? [];
    group.push(tx);
    outboundMap.set(tx.senderAddress, group);
  }

  // For each address, check if funds eventually return
  for (const [originAddress, originTxs] of outboundMap) {
    for (const firstTx of originTxs) {
      // BFS to find if funds return to origin within depth 5
      const queue: Array<{ address: string; chain: Transaction[] }> = [
        { address: firstTx.receiverAddress, chain: [firstTx] },
      ];
      const visited = new Set<string>([originAddress]);

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.chain.length > 5) continue;

        const nextTxs = outboundMap.get(current.address) ?? [];
        for (const nextTx of nextTxs) {
          if (nextTx.timestamp <= current.chain[current.chain.length - 1].timestamp) continue;

          if (nextTx.receiverAddress === originAddress) {
            // Round trip found!
            const fullChain = [...current.chain, nextTx];
            const totalVolumeUSD = fullChain.reduce((sum, t) => sum + t.amountUSD, 0);
            const roundTripMinutes = Math.round(
              (nextTx.timestamp.getTime() - firstTx.timestamp.getTime()) / 60000
            );
            // Avoid duplicates
            const isDuplicate = patterns.some(
              (p) =>
                p.originAddress === originAddress &&
                p.transactions[0].id === firstTx.id
            );
            if (!isDuplicate) {
              patterns.push({
                originAddress,
                transactions: fullChain,
                totalVolumeUSD,
                roundTripMinutes,
                detectedAt: new Date(),
              });
              recordHistory('ROUND_TRIPPING', originAddress, fullChain.length, totalVolumeUSD);
            }
            break;
          }

          if (!visited.has(nextTx.receiverAddress)) {
            visited.add(nextTx.receiverAddress);
            queue.push({
              address: nextTx.receiverAddress,
              chain: [...current.chain, nextTx],
            });
          }
        }
      }
    }
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// All Patterns
// ---------------------------------------------------------------------------

export async function detectAllPatterns(userId?: string): Promise<PatternDetectionResult> {
  const [structuring, rapidMovement, layering, roundTripping] = await Promise.all([
    detectStructuring(userId),
    detectRapidMovement(userId),
    detectLayering(userId),
    detectRoundTripping(userId),
  ]);

  return {
    structuring,
    rapidMovement,
    layering,
    roundTripping,
    summary: {
      totalPatterns:
        structuring.length + rapidMovement.length + layering.length + roundTripping.length,
      structuringCount: structuring.length,
      rapidMovementCount: rapidMovement.length,
      layeringCount: layering.length,
      roundTrippingCount: roundTripping.length,
      detectedAt: new Date(),
    },
  };
}

// ---------------------------------------------------------------------------
// Pattern History
// ---------------------------------------------------------------------------

export function getPatternHistory(): PatternHistoryEntry[] {
  return [...patternHistory].sort(
    (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()
  );
}

/** Exported for testing */
export const _patternHistoryStore = patternHistory;
