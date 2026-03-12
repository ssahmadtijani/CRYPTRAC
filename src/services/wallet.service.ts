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
