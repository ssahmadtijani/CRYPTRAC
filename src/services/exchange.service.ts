/**
 * Exchange Connector Service for CRYPTRAC
 * Mock adapters for Binance, Luno, and Quidax exchanges
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ExchangeTransaction,
  ExchangeBalance,
  ExchangeConnection,
  ExchangeTransactionType,
} from '../types';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXCHANGE_NAMES = ['Binance', 'Luno', 'Quidax'] as const;
export type ExchangeName = (typeof EXCHANGE_NAMES)[number];

const USD_TO_NGN = 1550;

// In-memory stores
const connections: Map<string, ExchangeConnection[]> = new Map();
const exchangeTransactions: Map<string, ExchangeTransaction[]> = new Map();

// ---------------------------------------------------------------------------
// Price reference table (approximate USD prices)
// ---------------------------------------------------------------------------

const assetPrices: Record<string, number> = {
  BTC: 65000,
  ETH: 3200,
  BNB: 580,
  USDT: 1,
  USDC: 1,
  SOL: 170,
  ADA: 0.45,
  NGN: 1 / USD_TO_NGN,
};

function getPrice(asset: string): number {
  return assetPrices[asset.toUpperCase()] ?? 1;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Mock Transaction Generators
// ---------------------------------------------------------------------------

function generateBinanceTransactions(
  userId: string,
  startDate: Date,
  endDate: Date,
  count = 30
): ExchangeTransaction[] {
  const pairs = [
    { asset: 'BTC', counter: 'USDT' },
    { asset: 'ETH', counter: 'USDT' },
    { asset: 'BNB', counter: 'USDT' },
    { asset: 'SOL', counter: 'USDT' },
    { asset: 'ADA', counter: 'USDT' },
  ];
  const txTypes: ExchangeTransactionType[] = ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'SWAP'];

  return Array.from({ length: count }, () => {
    const pair = pickRandom(pairs);
    const type = pickRandom(txTypes);
    const pricePerUnit = getPrice(pair.asset) * randomBetween(0.95, 1.05);
    const amount = randomBetween(0.01, 2.5);
    const totalValueUSD = amount * pricePerUnit;
    const fee = totalValueUSD * 0.001;

    return {
      exchangeId: 'binance',
      exchangeName: 'Binance',
      externalTxId: `BIN-${uuidv4().slice(0, 12).toUpperCase()}`,
      type,
      asset: pair.asset,
      amount,
      pricePerUnit,
      totalValueUSD,
      fee: fee / pricePerUnit,
      feeUSD: fee,
      counterAsset: pair.counter,
      counterAmount: totalValueUSD,
      walletAddress: `0x${userId.replace(/-/g, '').slice(0, 40)}`,
      timestamp: randomDate(startDate, endDate),
    };
  }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function generateLunoTransactions(
  userId: string,
  startDate: Date,
  endDate: Date,
  count = 25
): ExchangeTransaction[] {
  const pairs = [
    { asset: 'BTC', counter: 'NGN' },
    { asset: 'ETH', counter: 'NGN' },
    { asset: 'USDT', counter: 'NGN' },
    { asset: 'BTC', counter: 'USDT' },
  ];
  const txTypes: ExchangeTransactionType[] = ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'STAKING_REWARD'];

  return Array.from({ length: count }, () => {
    const pair = pickRandom(pairs);
    const type = pickRandom(txTypes);
    const pricePerUnit = getPrice(pair.asset) * randomBetween(0.96, 1.04);
    const amount = randomBetween(0.005, 1.5);
    const totalValueUSD = amount * pricePerUnit;
    const fee = totalValueUSD * 0.0015;

    return {
      exchangeId: 'luno',
      exchangeName: 'Luno',
      externalTxId: `LUN-${uuidv4().slice(0, 12).toUpperCase()}`,
      type,
      asset: pair.asset,
      amount,
      pricePerUnit,
      totalValueUSD,
      fee: fee / pricePerUnit,
      feeUSD: fee,
      counterAsset: pair.counter,
      counterAmount: pair.counter === 'NGN' ? totalValueUSD * USD_TO_NGN : totalValueUSD,
      walletAddress: `luno-${userId.slice(0, 12)}`,
      timestamp: randomDate(startDate, endDate),
    };
  }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function generateQuidaxTransactions(
  userId: string,
  startDate: Date,
  endDate: Date,
  count = 20
): ExchangeTransaction[] {
  const pairs = [
    { asset: 'BTC', counter: 'NGN' },
    { asset: 'ETH', counter: 'NGN' },
    { asset: 'USDT', counter: 'NGN' },
    { asset: 'SOL', counter: 'USDT' },
  ];
  const txTypes: ExchangeTransactionType[] = ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'AIRDROP', 'MINING_REWARD'];

  return Array.from({ length: count }, () => {
    const pair = pickRandom(pairs);
    const type = pickRandom(txTypes);
    const pricePerUnit = getPrice(pair.asset) * randomBetween(0.97, 1.03);
    const amount = randomBetween(0.01, 3.0);
    const totalValueUSD = amount * pricePerUnit;
    const fee = totalValueUSD * 0.002;

    return {
      exchangeId: 'quidax',
      exchangeName: 'Quidax',
      externalTxId: `QDX-${uuidv4().slice(0, 12).toUpperCase()}`,
      type,
      asset: pair.asset,
      amount,
      pricePerUnit,
      totalValueUSD,
      fee: fee / pricePerUnit,
      feeUSD: fee,
      counterAsset: pair.counter,
      counterAmount: pair.counter === 'NGN' ? totalValueUSD * USD_TO_NGN : totalValueUSD,
      walletAddress: `quidax-${userId.slice(0, 12)}`,
      timestamp: randomDate(startDate, endDate),
    };
  }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

// ---------------------------------------------------------------------------
// Exchange Adapter Interface
// ---------------------------------------------------------------------------

interface ExchangeAdapter {
  name: ExchangeName;
  fetchTransactions(userId: string, startDate: Date, endDate: Date): Promise<ExchangeTransaction[]>;
  fetchBalances(userId: string): Promise<ExchangeBalance[]>;
}

const adapters: Record<ExchangeName, ExchangeAdapter> = {
  Binance: {
    name: 'Binance',
    async fetchTransactions(userId, startDate, endDate) {
      return generateBinanceTransactions(userId, startDate, endDate, Math.floor(randomBetween(20, 40)));
    },
    async fetchBalances() {
      return [
        { asset: 'BTC', amount: randomBetween(0.1, 2), valueUSD: 0 },
        { asset: 'ETH', amount: randomBetween(1, 10), valueUSD: 0 },
        { asset: 'USDT', amount: randomBetween(500, 5000), valueUSD: 0 },
      ].map((b) => ({ ...b, valueUSD: b.amount * getPrice(b.asset) }));
    },
  },
  Luno: {
    name: 'Luno',
    async fetchTransactions(userId, startDate, endDate) {
      return generateLunoTransactions(userId, startDate, endDate, Math.floor(randomBetween(15, 30)));
    },
    async fetchBalances() {
      return [
        { asset: 'BTC', amount: randomBetween(0.05, 1.5), valueUSD: 0 },
        { asset: 'ETH', amount: randomBetween(0.5, 8), valueUSD: 0 },
        { asset: 'USDT', amount: randomBetween(200, 3000), valueUSD: 0 },
      ].map((b) => ({ ...b, valueUSD: b.amount * getPrice(b.asset) }));
    },
  },
  Quidax: {
    name: 'Quidax',
    async fetchTransactions(userId, startDate, endDate) {
      return generateQuidaxTransactions(userId, startDate, endDate, Math.floor(randomBetween(15, 25)));
    },
    async fetchBalances() {
      return [
        { asset: 'BTC', amount: randomBetween(0.02, 1), valueUSD: 0 },
        { asset: 'ETH', amount: randomBetween(0.5, 5), valueUSD: 0 },
        { asset: 'USDT', amount: randomBetween(100, 2000), valueUSD: 0 },
      ].map((b) => ({ ...b, valueUSD: b.amount * getPrice(b.asset) }));
    },
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function connectExchange(
  userId: string,
  exchangeName: string
): Promise<ExchangeConnection> {
  if (!EXCHANGE_NAMES.includes(exchangeName as ExchangeName)) {
    throw new Error(`Unknown exchange: ${exchangeName}`);
  }

  const userConnections = connections.get(userId) ?? [];
  const existing = userConnections.find((c) => c.exchangeName === exchangeName);
  if (existing) {
    return existing;
  }

  const connection: ExchangeConnection = {
    userId,
    exchangeName,
    connectedAt: new Date(),
    status: 'ACTIVE',
    transactionCount: 0,
  };

  userConnections.push(connection);
  connections.set(userId, userConnections);

  logger.info('Exchange connected', { userId, exchangeName });
  return connection;
}

export function getConnectedExchanges(userId: string): ExchangeConnection[] {
  return connections.get(userId) ?? [];
}

export async function syncExchangeData(
  userId: string,
  exchangeName: string
): Promise<{ synced: number; connection: ExchangeConnection }> {
  const userConnections = connections.get(userId) ?? [];
  const connection = userConnections.find((c) => c.exchangeName === exchangeName);

  if (!connection) {
    throw new Error(`Exchange ${exchangeName} is not connected for this user`);
  }

  connection.status = 'SYNCING';

  const adapter = adapters[exchangeName as ExchangeName];
  const startDate = new Date('2025-01-01');
  const endDate = new Date();

  const txs = await adapter.fetchTransactions(userId, startDate, endDate);

  const key = `${userId}:${exchangeName}`;
  exchangeTransactions.set(key, txs);

  connection.lastSyncedAt = new Date();
  connection.status = 'ACTIVE';
  connection.transactionCount = txs.length;

  logger.info('Exchange data synced', { userId, exchangeName, count: txs.length });

  return { synced: txs.length, connection };
}

export function getAllExchangeTransactions(userId: string): ExchangeTransaction[] {
  const userConnections = connections.get(userId) ?? [];
  const all: ExchangeTransaction[] = [];

  for (const conn of userConnections) {
    const key = `${userId}:${conn.exchangeName}`;
    const txs = exchangeTransactions.get(key) ?? [];
    all.push(...txs);
  }

  return all.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function getExchangeTransactions(
  userId: string,
  exchangeName: string
): ExchangeTransaction[] {
  const key = `${userId}:${exchangeName}`;
  return exchangeTransactions.get(key) ?? [];
}

export async function getExchangeBalances(
  userId: string,
  exchangeName: string
): Promise<ExchangeBalance[]> {
  const adapter = adapters[exchangeName as ExchangeName];
  if (!adapter) {
    throw new Error(`Unknown exchange: ${exchangeName}`);
  }
  return adapter.fetchBalances(userId);
}

/** Directly inject transactions (used by demo seeder) */
export function injectTransactions(
  userId: string,
  exchangeName: string,
  txs: ExchangeTransaction[]
): void {
  const key = `${userId}:${exchangeName}`;
  const existing = exchangeTransactions.get(key) ?? [];
  exchangeTransactions.set(key, [...existing, ...txs]);

  const userConnections = connections.get(userId) ?? [];
  const conn = userConnections.find((c) => c.exchangeName === exchangeName);
  if (conn) {
    conn.transactionCount = (exchangeTransactions.get(key) ?? []).length;
    conn.lastSyncedAt = new Date();
  }
}
