/**
 * Demo Seeder Service for CRYPTRAC
 * Populates realistic data for the Tax Authority Portal demonstration
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { UserRole, ExchangeTransaction } from '../types';
import { prisma } from '../lib/prisma';
import { connectExchange } from './exchange.service';
import { processAllTransactions } from './tax-engine.service';
import { generateAssessment } from './tax-assessment.service';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMO_USERS: Array<{
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  exchanges: string[];
  activityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}> = [
  {
    firstName: 'Emeka',
    lastName: 'Okonkwo',
    email: 'emeka.okonkwo@demo.cryptrac.ng',
    role: UserRole.USER,
    exchanges: ['Binance', 'Luno'],
    activityLevel: 'HIGH',
  },
  {
    firstName: 'Fatima',
    lastName: 'Abdullahi',
    email: 'fatima.abdullahi@demo.cryptrac.ng',
    role: UserRole.USER,
    exchanges: ['Luno', 'Quidax'],
    activityLevel: 'MEDIUM',
  },
  {
    firstName: 'Chidi',
    lastName: 'Nwosu',
    email: 'chidi.nwosu@demo.cryptrac.ng',
    role: UserRole.USER,
    exchanges: ['Binance', 'Quidax'],
    activityLevel: 'HIGH',
  },
  {
    firstName: 'Ngozi',
    lastName: 'Okafor',
    email: 'ngozi.okafor@demo.cryptrac.ng',
    role: UserRole.USER,
    exchanges: ['Quidax'],
    activityLevel: 'LOW',
  },
  {
    firstName: 'Bello',
    lastName: 'Usman',
    email: 'bello.usman@demo.cryptrac.ng',
    role: UserRole.USER,
    exchanges: ['Luno'],
    activityLevel: 'MEDIUM',
  },
  {
    firstName: 'Adaeze',
    lastName: 'Eze',
    email: 'adaeze.eze@demo.cryptrac.ng',
    role: UserRole.USER,
    exchanges: ['Binance', 'Luno', 'Quidax'],
    activityLevel: 'HIGH',
  },
  {
    firstName: 'FIRS',
    lastName: 'Auditor',
    email: 'auditor@firs.gov.ng',
    role: UserRole.AUDITOR,
    exchanges: [],
    activityLevel: 'LOW',
  },
  {
    firstName: 'Compliance',
    lastName: 'Officer',
    email: 'compliance@cryptrac.ng',
    role: UserRole.COMPLIANCE_OFFICER,
    exchanges: [],
    activityLevel: 'LOW',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ExchangeTransactionType =
  | 'BUY'
  | 'SELL'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'SWAP'
  | 'STAKING_REWARD'
  | 'MINING_REWARD'
  | 'AIRDROP';

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const assetPrices: Record<string, number> = {
  BTC: 65000,
  ETH: 3200,
  BNB: 580,
  USDT: 1,
  SOL: 170,
};

function generateTxsForExchange(
  userId: string,
  exchangeName: string,
  count: number,
  startDate: Date,
  endDate: Date
): ExchangeTransaction[] {
  const assets = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB'];
  const types: ExchangeTransactionType[] = [
    'BUY', 'BUY', 'BUY', 'SELL', 'SELL',
    'DEPOSIT', 'WITHDRAWAL', 'SWAP',
    'STAKING_REWARD', 'AIRDROP',
  ];
  const exchangeIdMap: Record<string, string> = {
    Binance: 'binance',
    Luno: 'luno',
    Quidax: 'quidax',
  };

  const txs: ExchangeTransaction[] = [];

  for (let i = 0; i < count; i++) {
    const asset = pickRandom(assets);
    const type = pickRandom(types);
    const basePrice = assetPrices[asset] ?? 1;
    const pricePerUnit = basePrice * randomBetween(0.92, 1.08);
    const amount = randomBetween(0.005, 3.5);
    const totalValueUSD = amount * pricePerUnit;
    const fee = totalValueUSD * 0.0012;

    txs.push({
      exchangeId: exchangeIdMap[exchangeName] ?? exchangeName.toLowerCase(),
      exchangeName,
      externalTxId: `${exchangeName.slice(0, 3).toUpperCase()}-${uuidv4().slice(0, 10).toUpperCase()}`,
      type,
      asset,
      amount,
      pricePerUnit,
      totalValueUSD,
      fee: fee / pricePerUnit,
      feeUSD: fee,
      counterAsset: 'USDT',
      counterAmount: totalValueUSD,
      walletAddress: `${exchangeName.toLowerCase()}-${userId.slice(0, 8)}`,
      timestamp: randomDate(startDate, endDate),
    });
  }

  return txs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

let seeded = false;
let seededUserIds: string[] = [];

export function isDemoSeeded(): boolean {
  return seeded;
}

export function getSeededUserIds(): string[] {
  return seededUserIds;
}

export async function seedDemoData(): Promise<{
  usersCreated: number;
  assessmentsGenerated: number;
}> {
  if (seeded) {
    return { usersCreated: seededUserIds.length, assessmentsGenerated: 0 };
  }

  logger.info('Starting demo data seed...');

  const startOf2025 = new Date('2025-01-01');
  const endOf2025 = new Date('2025-12-31');

  let assessmentsGenerated = 0;
  const createdUserIds: string[] = [];

  // Clean up existing demo users to allow re-seeding
  await cleanupDemoData();

  const demoPassword = await bcrypt.hash('Demo@2025!', 10);

  for (const profile of DEMO_USERS) {
    const userId = uuidv4();

    await prisma.user.create({
      data: {
        id: userId,
        email: profile.email,
        passwordHash: demoPassword,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: profile.role,
        isActive: true,
      },
    });

    createdUserIds.push(userId);

    const txCountMap: Record<'LOW' | 'MEDIUM' | 'HIGH', number> = {
      LOW: 15,
      MEDIUM: 40,
      HIGH: 80,
    };
    const txCount = txCountMap[profile.activityLevel];

    for (const exchangeName of profile.exchanges) {
      await connectExchange(userId, exchangeName);

      const txs = generateTxsForExchange(
        userId,
        exchangeName,
        Math.floor(txCount / profile.exchanges.length),
        startOf2025,
        endOf2025
      );

      await prisma.exchangeTransaction.createMany({
        data: txs.map((tx) => ({
          userId,
          exchangeId: tx.exchangeId,
          exchangeName: tx.exchangeName,
          externalTxId: tx.externalTxId,
          type: tx.type,
          asset: tx.asset,
          amount: tx.amount,
          pricePerUnit: tx.pricePerUnit,
          totalValueUSD: tx.totalValueUSD,
          fee: tx.fee ?? 0,
          feeUSD: tx.feeUSD ?? 0,
          counterAsset: tx.counterAsset ?? null,
          counterAmount: tx.counterAmount ?? null,
          walletAddress: tx.walletAddress ?? null,
          timestamp: tx.timestamp,
        })),
      });
    }

    if (profile.exchanges.length > 0) {
      try {
        await generateAssessment(userId, 2025, 'Q1');
        await generateAssessment(userId, 2025, 'Q2');
        await generateAssessment(userId, 2025, 'Q3');
        await generateAssessment(userId, 2025, 'ANNUAL');
        assessmentsGenerated += 4;
      } catch (err) {
        logger.warn('Assessment generation error during seed', { userId, err });
      }
    }
  }

  seeded = true;
  seededUserIds = createdUserIds;

  logger.info('Demo data seed complete', {
    usersCreated: createdUserIds.length,
    assessmentsGenerated,
  });

  return { usersCreated: createdUserIds.length, assessmentsGenerated };
}

/**
 * Removes all demo users and their associated data in the correct FK order.
 */
async function cleanupDemoData(): Promise<void> {
  const demoEmails = DEMO_USERS.map((u) => u.email);
  const demoUsers = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((u) => u.id);

  if (demoUserIds.length === 0) return;

  await prisma.taxAssessment.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.taxableEvent.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.costBasisLot.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.taxEvent.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.exchangeTransaction.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.exchangeConnection.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.complianceReport.deleteMany({ where: { reviewedById: { in: demoUserIds } } });
  await prisma.complianceReport.deleteMany({
    where: {
      transaction: { userId: { in: demoUserIds } },
    },
  });
  await prisma.transaction.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
}
