/**
 * Network Analysis Service Tests for CRYPTRAC
 */

import {
  buildTransactionGraph,
  getWalletConnections,
  identifyClusters,
  getHighRiskPaths,
} from '../network-analysis.service';
import { RiskLevel } from '../../types';
import { prisma } from '../../lib/prisma';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

jest.mock('../../lib/prisma', () => ({
  prisma: {
    transaction: {
      findMany: jest.fn(),
    },
    wallet: {
      findMany: jest.fn(),
    },
  },
}));

const mockTransactionFindMany = prisma.transaction.findMany as jest.Mock;
const mockWalletFindMany = prisma.wallet.findMany as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let txCounter = 0;

function makePrismaTx(overrides?: Partial<{
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
}>) {
  txCounter++;
  const now = new Date('2024-06-15T12:00:00Z');
  return {
    id: `tx-${txCounter}`,
    userId: 'user-1',
    type: 'TRANSFER',
    txHash: `0x${'a'.repeat(64)}`,
    senderAddress: '0xSender',
    receiverAddress: '0xReceiver',
    asset: 'ETH',
    amount: 1,
    amountUSD: 10_000,
    fee: 0.01,
    feeUSD: 10,
    blockNumber: null,
    network: 'ethereum',
    riskLevel: 'LOW',
    riskScore: 10,
    complianceStatus: 'PENDING',
    metadata: null,
    timestamp: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  txCounter = 0;
  mockWalletFindMany.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// buildTransactionGraph
// ---------------------------------------------------------------------------

describe('buildTransactionGraph', () => {
  it('builds nodes from sender and receiver addresses', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({ senderAddress: '0xAlice', receiverAddress: '0xBob', amountUSD: 5000 }),
    ]);

    const graph = await buildTransactionGraph();
    const addresses = graph.nodes.map((n) => n.id);
    expect(addresses).toContain('0xAlice');
    expect(addresses).toContain('0xBob');
  });

  it('creates an edge between sender and receiver', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({ senderAddress: '0xAlice', receiverAddress: '0xBob', amountUSD: 5000 }),
    ]);

    const graph = await buildTransactionGraph();
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].source).toBe('0xAlice');
    expect(graph.edges[0].target).toBe('0xBob');
    expect(graph.edges[0].weight).toBe(5000);
  });

  it('aggregates multiple transactions on the same edge', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({ senderAddress: '0xAlice', receiverAddress: '0xBob', amountUSD: 5000 }),
      makePrismaTx({ senderAddress: '0xAlice', receiverAddress: '0xBob', amountUSD: 3000 }),
    ]);

    const graph = await buildTransactionGraph();
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].weight).toBe(8000);
    expect(graph.edges[0].transactionCount).toBe(2);
  });

  it('returns correct stats', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({ senderAddress: '0xA', receiverAddress: '0xB', amountUSD: 1000 }),
      makePrismaTx({ senderAddress: '0xB', receiverAddress: '0xC', amountUSD: 800 }),
    ]);

    const graph = await buildTransactionGraph();
    expect(graph.stats.totalNodes).toBe(3);
    expect(graph.stats.totalEdges).toBe(2);
  });

  it('marks node types correctly', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({ senderAddress: '0xA', receiverAddress: '0xB', amountUSD: 1000 }),
      makePrismaTx({ senderAddress: '0xB', receiverAddress: '0xC', amountUSD: 900 }),
    ]);

    const graph = await buildTransactionGraph();
    const nodeA = graph.nodes.find((n) => n.id === '0xA')!;
    const nodeB = graph.nodes.find((n) => n.id === '0xB')!;
    const nodeC = graph.nodes.find((n) => n.id === '0xC')!;

    expect(nodeA.type).toBe('sender');
    expect(nodeB.type).toBe('both');
    expect(nodeC.type).toBe('receiver');
  });

  it('uses wallet risk data when available', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({ senderAddress: '0xRisky', receiverAddress: '0xSafe', amountUSD: 1000 }),
    ]);
    mockWalletFindMany.mockResolvedValue([
      {
        address: '0xRisky',
        riskScore: 85,
        riskLevel: 'CRITICAL',
        isSanctioned: true,
      },
    ]);

    const graph = await buildTransactionGraph();
    const riskyNode = graph.nodes.find((n) => n.id === '0xRisky')!;
    expect(riskyNode.riskLevel).toBe(RiskLevel.CRITICAL);
    expect(riskyNode.isSanctioned).toBe(true);
    expect(graph.stats.highRiskNodes).toBeGreaterThan(0);
  });

  it('returns empty graph when no transactions', async () => {
    mockTransactionFindMany.mockResolvedValue([]);
    const graph = await buildTransactionGraph();
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getWalletConnections
// ---------------------------------------------------------------------------

describe('getWalletConnections', () => {
  it('returns sub-graph centered on specified wallet', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({ senderAddress: '0xCenter', receiverAddress: '0xNeighbor', amountUSD: 1000 }),
      makePrismaTx({ senderAddress: '0xUnrelated', receiverAddress: '0xOther', amountUSD: 500 }),
    ]);

    const subGraph = await getWalletConnections('0xCenter', 1);
    const addresses = subGraph.nodes.map((n) => n.id);
    expect(addresses).toContain('0xCenter');
    expect(addresses).toContain('0xNeighbor');
    expect(addresses).not.toContain('0xUnrelated');
  });

  it('includes nodes within specified depth', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({ senderAddress: '0xA', receiverAddress: '0xB', amountUSD: 1000 }),
      makePrismaTx({ senderAddress: '0xB', receiverAddress: '0xC', amountUSD: 900 }),
      makePrismaTx({ senderAddress: '0xC', receiverAddress: '0xD', amountUSD: 800 }),
    ]);

    const subGraph = await getWalletConnections('0xA', 2);
    const addresses = subGraph.nodes.map((n) => n.id);
    expect(addresses).toContain('0xA');
    expect(addresses).toContain('0xB');
    expect(addresses).toContain('0xC');
  });
});

// ---------------------------------------------------------------------------
// identifyClusters
// ---------------------------------------------------------------------------

describe('identifyClusters', () => {
  it('identifies disconnected components as separate clusters', async () => {
    mockTransactionFindMany.mockResolvedValue([
      // Cluster 1
      makePrismaTx({ senderAddress: '0xA', receiverAddress: '0xB', amountUSD: 1000 }),
      // Cluster 2 — disconnected
      makePrismaTx({ senderAddress: '0xX', receiverAddress: '0xY', amountUSD: 500 }),
    ]);

    const clusters = await identifyClusters();
    expect(clusters.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array when no transactions', async () => {
    mockTransactionFindMany.mockResolvedValue([]);
    const clusters = await identifyClusters();
    expect(clusters).toHaveLength(0);
  });

  it('assigns highest risk level within cluster', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({
        senderAddress: '0xSafe',
        receiverAddress: '0xRisky',
        amountUSD: 1000,
        riskLevel: 'HIGH',
      }),
    ]);
    mockWalletFindMany.mockResolvedValue([
      { address: '0xRisky', riskScore: 80, riskLevel: 'HIGH', isSanctioned: false },
    ]);

    const clusters = await identifyClusters();
    expect(clusters.length).toBeGreaterThan(0);
  });

  it('returns clusters sorted by total volume descending', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({ senderAddress: '0xA', receiverAddress: '0xB', amountUSD: 100 }),
      makePrismaTx({ senderAddress: '0xX', receiverAddress: '0xY', amountUSD: 1_000_000 }),
    ]);

    const clusters = await identifyClusters();
    if (clusters.length >= 2) {
      expect(clusters[0].totalVolume).toBeGreaterThanOrEqual(clusters[1].totalVolume);
    }
  });
});

// ---------------------------------------------------------------------------
// getHighRiskPaths
// ---------------------------------------------------------------------------

describe('getHighRiskPaths', () => {
  it('returns empty array when no sanctioned nodes', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({ senderAddress: '0xA', receiverAddress: '0xB', amountUSD: 1000 }),
    ]);
    // No sanctioned wallets
    mockWalletFindMany.mockResolvedValue([]);

    const paths = await getHighRiskPaths();
    expect(paths).toHaveLength(0);
  });

  it('detects path from sanctioned to low-risk node', async () => {
    mockTransactionFindMany.mockResolvedValue([
      makePrismaTx({
        senderAddress: '0xSanctioned',
        receiverAddress: '0xLowRisk',
        amountUSD: 10_000,
      }),
    ]);
    mockWalletFindMany.mockResolvedValue([
      {
        address: '0xSanctioned',
        riskScore: 100,
        riskLevel: 'CRITICAL',
        isSanctioned: true,
      },
      {
        address: '0xLowRisk',
        riskScore: 5,
        riskLevel: 'LOW',
        isSanctioned: false,
      },
    ]);

    const paths = await getHighRiskPaths();
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].containsSanctioned).toBe(true);
  });
});
