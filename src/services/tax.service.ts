import { v4 as uuidv4 } from 'uuid';
import {
  Transaction,
  TaxEvent,
  TaxEventType,
  TaxSummary,
  TransactionType,
} from '../types';
import { transactionService } from './transaction.service';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const taxService = {
  classifyHoldingPeriod(acquiredDate: Date, disposedDate: Date): 'SHORT' | 'LONG' {
    return disposedDate.getTime() - acquiredDate.getTime() > ONE_YEAR_MS
      ? 'LONG'
      : 'SHORT';
  },

  calculateCostBasis(
    acquisitions: Array<{ quantity: number; costPerUnit: number; date: Date }>
  ): Array<{ quantity: number; costBasis: number; acquiredDate: Date }> {
    return acquisitions
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((a) => ({
        quantity: a.quantity,
        costBasis: a.quantity * a.costPerUnit,
        acquiredDate: a.date,
      }));
  },

  calculateTaxEvents(userId: string, taxYear: number): TaxEvent[] {
    const { data: userTx } = transactionService.getTransactions({
      userId,
      limit: 1000,
    });

    const yearStart = new Date(taxYear, 0, 1);
    const yearEnd = new Date(taxYear + 1, 0, 1);

    const yearTx = userTx.filter(
      (t) => t.timestamp >= yearStart && t.timestamp < yearEnd
    );

    const events: TaxEvent[] = [];

    const acquisitions: Map<
      string,
      Array<{ quantity: number; costPerUnit: number; date: Date; txId: string }>
    > = new Map();

    for (const tx of userTx) {
      if (
        tx.type === TransactionType.DEPOSIT ||
        tx.type === TransactionType.TRANSFER
      ) {
        if (!acquisitions.has(tx.currency)) {
          acquisitions.set(tx.currency, []);
        }
        acquisitions.get(tx.currency)!.push({
          quantity: tx.amount,
          costPerUnit: tx.amount > 0 ? tx.amountUSD / tx.amount : 0,
          date: tx.timestamp,
          txId: tx.id,
        });
      }
    }

    for (const tx of yearTx) {
      const now = new Date();

      if (
        tx.type === TransactionType.TRADE ||
        tx.type === TransactionType.SWAP ||
        tx.type === TransactionType.WITHDRAWAL
      ) {
        const acqList = acquisitions.get(tx.currency) || [];
        let remaining = tx.amount;
        let totalCostBasis = 0;

        for (const acq of acqList) {
          if (remaining <= 0) break;
          const used = Math.min(remaining, acq.quantity);
          totalCostBasis += used * acq.costPerUnit;
          acq.quantity -= used;
          remaining -= used;
        }

        const proceeds = tx.amountUSD;
        const gain = proceeds - totalCostBasis;

        const acqDate =
          acqList.length > 0 ? acqList[0].date : tx.timestamp;
        const isLongTerm =
          this.classifyHoldingPeriod(acqDate, tx.timestamp) === 'LONG';

        events.push({
          id: uuidv4(),
          userId,
          transactionId: tx.id,
          type: isLongTerm
            ? TaxEventType.CAPITAL_GAIN_LONG
            : TaxEventType.CAPITAL_GAIN_SHORT,
          acquiredDate: acqDate,
          disposedDate: tx.timestamp,
          costBasis: totalCostBasis,
          proceeds,
          gain,
          currency: tx.currency,
          quantity: tx.amount,
          taxYear,
          isLongTerm,
          createdAt: now,
        });
      }

      if (tx.type === TransactionType.MINING) {
        events.push({
          id: uuidv4(),
          userId,
          transactionId: tx.id,
          type: TaxEventType.MINING_INCOME,
          acquiredDate: tx.timestamp,
          costBasis: 0,
          proceeds: tx.amountUSD,
          gain: tx.amountUSD,
          currency: tx.currency,
          quantity: tx.amount,
          taxYear,
          isLongTerm: false,
          createdAt: new Date(),
        });
      }

      if (tx.type === TransactionType.STAKING) {
        events.push({
          id: uuidv4(),
          userId,
          transactionId: tx.id,
          type: TaxEventType.STAKING_REWARD,
          acquiredDate: tx.timestamp,
          costBasis: 0,
          proceeds: tx.amountUSD,
          gain: tx.amountUSD,
          currency: tx.currency,
          quantity: tx.amount,
          taxYear,
          isLongTerm: false,
          createdAt: new Date(),
        });
      }

      if (tx.type === TransactionType.AIRDROP) {
        events.push({
          id: uuidv4(),
          userId,
          transactionId: tx.id,
          type: TaxEventType.AIRDROP_INCOME,
          acquiredDate: tx.timestamp,
          costBasis: 0,
          proceeds: tx.amountUSD,
          gain: tx.amountUSD,
          currency: tx.currency,
          quantity: tx.amount,
          taxYear,
          isLongTerm: false,
          createdAt: new Date(),
        });
      }
    }

    return events;
  },

  generateTaxSummary(userId: string, taxYear: number): TaxSummary {
    const events = this.calculateTaxEvents(userId, taxYear);

    let shortTermGains = 0;
    let longTermGains = 0;
    let miningIncome = 0;
    let stakingIncome = 0;
    let airdropIncome = 0;

    for (const event of events) {
      switch (event.type) {
        case TaxEventType.CAPITAL_GAIN_SHORT:
          shortTermGains += event.gain;
          break;
        case TaxEventType.CAPITAL_GAIN_LONG:
          longTermGains += event.gain;
          break;
        case TaxEventType.MINING_INCOME:
          miningIncome += event.gain;
          break;
        case TaxEventType.STAKING_REWARD:
          stakingIncome += event.gain;
          break;
        case TaxEventType.AIRDROP_INCOME:
          airdropIncome += event.gain;
          break;
      }
    }

    const totalGains = shortTermGains + longTermGains;
    const totalIncome = miningIncome + stakingIncome + airdropIncome;
    const totalTaxableAmount = totalGains + totalIncome;

    return {
      userId,
      taxYear,
      shortTermGains,
      longTermGains,
      totalGains,
      totalIncome,
      miningIncome,
      stakingIncome,
      airdropIncome,
      totalTaxableAmount,
      events,
    };
  },
};
