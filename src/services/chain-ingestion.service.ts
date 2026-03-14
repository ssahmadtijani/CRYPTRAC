/**
 * Chain Ingestion Service for CRYPTRAC
 * Scans Ethereum blocks for ETH transfers and ERC-20 Transfer events
 * involving watched addresses, and persists them as Transaction records.
 */

import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { TransactionType, RiskLevel, ComplianceStatus } from '../types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com';
const BATCH_SIZE = parseInt(process.env.INGESTION_BATCH_SIZE || '10', 10);
const POLL_INTERVAL_MS = parseInt(
  process.env.INGESTION_POLL_INTERVAL_MS || '15000',
  10
);
const NETWORK_NAME = 'ethereum';

// ERC-20 Transfer event topic hash
const ERC20_TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

// ERC-20 minimal ABI for decoding Transfer events
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface BlockSyncState {
  network: string;
  lastBlock: number;
  targetBlock: number | null;
  isRunning: boolean;
  lastError: string | null;
  updatedAt: Date;
}

/** In-memory sync state (replace with Prisma persistence in production) */
const syncState: BlockSyncState = {
  network: NETWORK_NAME,
  lastBlock: 0,
  targetBlock: null,
  isRunning: false,
  lastError: null,
  updatedAt: new Date(),
};

/** Watched addresses (lowercase) */
const watchedAddresses = new Map<string, { label?: string; network: string }>();

let provider: ethers.JsonRpcProvider | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return provider;
}

// ---------------------------------------------------------------------------
// ERC-20 token symbol cache
// ---------------------------------------------------------------------------

const tokenSymbolCache = new Map<string, string>();

async function getTokenSymbol(
  tokenAddress: string,
  prov: ethers.JsonRpcProvider
): Promise<string> {
  const cached = tokenSymbolCache.get(tokenAddress);
  if (cached) return cached;

  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, prov);
    const symbol: string = await (contract.symbol as () => Promise<string>)();
    tokenSymbolCache.set(tokenAddress, symbol);
    return symbol;
  } catch {
    return 'UNKNOWN';
  }
}

// ---------------------------------------------------------------------------
// Block processing
// ---------------------------------------------------------------------------

async function processBlock(
  blockNumber: number,
  prov: ethers.JsonRpcProvider
): Promise<void> {
  const block = await prov.getBlock(blockNumber, true);
  if (!block || !block.transactions) return;

  const watchedSet = new Set(watchedAddresses.keys());

  // ---- Native ETH transfers ----
  for (const txHash of block.transactions) {
    const tx = await prov.getTransaction(txHash as string);
    if (!tx) continue;

    const from = tx.from?.toLowerCase() ?? '';
    const to = tx.to?.toLowerCase() ?? '';

    if (!watchedSet.has(from) && !watchedSet.has(to)) continue;

    await upsertTransaction({
      txHash: tx.hash,
      type: TransactionType.TRANSFER,
      senderAddress: tx.from ?? '',
      receiverAddress: tx.to ?? '',
      asset: 'ETH',
      amount: parseFloat(ethers.formatEther(tx.value)),
      amountUSD: 0, // Price feed integration needed for live USD value
      fee: 0,
      feeUSD: 0,
      blockNumber: blockNumber,
      network: NETWORK_NAME,
      timestamp: new Date((block.timestamp as number) * 1000),
    });
  }

  // ---- ERC-20 Transfer events ----
  const logs = await prov.getLogs({
    fromBlock: blockNumber,
    toBlock: blockNumber,
    topics: [ERC20_TRANSFER_TOPIC],
  });

  for (const log of logs) {
    if (log.topics.length < 3) continue;

    const from = '0x' + log.topics[1].slice(26);
    const to = '0x' + log.topics[2].slice(26);

    if (!watchedSet.has(from.toLowerCase()) && !watchedSet.has(to.toLowerCase())) {
      continue;
    }

    const tokenAddress = log.address.toLowerCase();
    const iface = new ethers.Interface(ERC20_ABI);
    let amount = 0;
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed) {
        amount = parseFloat(ethers.formatUnits(parsed.args[2] as bigint, 18));
      }
    } catch {
      // If decoding fails, skip this log
      continue;
    }

    const symbol = await getTokenSymbol(log.address, prov);

    await upsertTransaction({
      txHash: log.transactionHash,
      type: TransactionType.TRANSFER,
      senderAddress: from,
      receiverAddress: to,
      asset: symbol,
      amount,
      amountUSD: 0,
      fee: 0,
      feeUSD: 0,
      blockNumber: blockNumber,
      network: NETWORK_NAME,
      metadata: { tokenAddress },
      timestamp: new Date((block.timestamp as number) * 1000),
    });
  }
}

async function upsertTransaction(data: {
  txHash: string;
  type: TransactionType;
  senderAddress: string;
  receiverAddress: string;
  asset: string;
  amount: number;
  amountUSD: number;
  fee: number;
  feeUSD: number;
  blockNumber: number;
  network: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Use the first admin/system user for ingested transactions, or a sentinel userId
    // In production, you'd have a dedicated system user
    const systemUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (!systemUser) {
      logger.warn('No admin user found for ingested transaction; skipping persist', {
        txHash: data.txHash,
      });
      return;
    }

    // Skip if we already have a transaction with this hash
    const existing = await prisma.transaction.findFirst({
      where: { txHash: data.txHash },
      select: { id: true },
    });
    if (existing) return;

    await prisma.transaction.create({
      data: {
        userId: systemUser.id,
        type: data.type,
        txHash: data.txHash,
        senderAddress: data.senderAddress.toLowerCase(),
        receiverAddress: data.receiverAddress?.toLowerCase() ?? '',
        asset: data.asset,
        amount: data.amount,
        amountUSD: data.amountUSD,
        fee: data.fee,
        feeUSD: data.feeUSD,
        blockNumber: data.blockNumber,
        network: data.network,
        timestamp: data.timestamp,
        riskLevel: RiskLevel.LOW,
        riskScore: 0,
        complianceStatus: ComplianceStatus.PENDING,
        metadata: data.metadata as object | undefined,
      },
    });

    logger.debug('Ingested transaction', { txHash: data.txHash, asset: data.asset });
  } catch (err) {
    logger.warn('Failed to upsert ingested transaction', {
      txHash: data.txHash,
      err,
    });
  }
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

async function pollOnce(): Promise<void> {
  if (!syncState.isRunning) return;

  const prov = getProvider();

  try {
    const latest = await prov.getBlockNumber();
    syncState.targetBlock = latest;

    if (syncState.lastBlock === 0) {
      // Start from recent blocks if no prior state
      syncState.lastBlock = Math.max(latest - BATCH_SIZE, 0);
    }

    const from = syncState.lastBlock + 1;
    const to = Math.min(from + BATCH_SIZE - 1, latest);

    if (from > to) {
      // Caught up — wait for next poll
      syncState.updatedAt = new Date();
      schedulePoll();
      return;
    }

    logger.info('Ingesting blocks', { from, to, network: NETWORK_NAME });

    for (let blockNum = from; blockNum <= to; blockNum++) {
      await processBlock(blockNum, prov);
      syncState.lastBlock = blockNum;
    }

    syncState.lastError = null;
    syncState.updatedAt = new Date();

    schedulePoll();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    syncState.lastError = message;
    syncState.updatedAt = new Date();
    logger.error('Ingestion poll error', { err });
    // Back off and retry
    pollTimer = setTimeout(pollOnce, POLL_INTERVAL_MS * 2);
  }
}

function schedulePoll(): void {
  if (!syncState.isRunning) return;
  pollTimer = setTimeout(pollOnce, POLL_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Starts the block ingestion loop.
 */
export async function startIngestion(): Promise<void> {
  if (syncState.isRunning) {
    logger.warn('Ingestion is already running');
    return;
  }

  syncState.isRunning = true;
  syncState.lastError = null;
  syncState.updatedAt = new Date();

  logger.info('Starting chain ingestion', {
    network: NETWORK_NAME,
    rpcUrl: RPC_URL,
  });

  // Fire immediately
  void pollOnce();
}

/**
 * Stops the ingestion loop gracefully.
 */
export function stopIngestion(): void {
  syncState.isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  logger.info('Chain ingestion stopped', { network: NETWORK_NAME });
}

/**
 * Returns the current ingestion status.
 */
export function getIngestionStatus(): BlockSyncState {
  return { ...syncState };
}

/**
 * Adds an address to the watch list.
 */
export function addWatchedAddress(
  address: string,
  options: { label?: string; network?: string } = {}
): void {
  const normalised = address.toLowerCase();
  watchedAddresses.set(normalised, {
    label: options.label,
    network: options.network ?? NETWORK_NAME,
  });
  logger.info('Watched address added', { address: normalised });
}

/**
 * Removes an address from the watch list.
 */
export function removeWatchedAddress(address: string): boolean {
  const normalised = address.toLowerCase();
  const existed = watchedAddresses.has(normalised);
  watchedAddresses.delete(normalised);
  if (existed) {
    logger.info('Watched address removed', { address: normalised });
  }
  return existed;
}

/**
 * Returns all currently watched addresses.
 */
export function getWatchedAddresses(): Array<{
  address: string;
  label?: string;
  network: string;
}> {
  return Array.from(watchedAddresses.entries()).map(([address, meta]) => ({
    address,
    label: meta.label,
    network: meta.network,
  }));
}
