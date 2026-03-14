/**
 * Network / Link Analysis Service for CRYPTRAC
 * Builds and analyzes a graph of wallet-to-wallet transaction flows.
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import {
  Transaction,
  RiskLevel,
  ComplianceStatus,
  TransactionType,
  GraphNode,
  GraphEdge,
  TransactionGraph,
  WalletCluster,
  RiskPath,
} from '../types';

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

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return RiskLevel.CRITICAL;
  if (score >= 50) return RiskLevel.HIGH;
  if (score >= 25) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

function maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  const order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

// ---------------------------------------------------------------------------
// Build Transaction Graph
// ---------------------------------------------------------------------------

export async function buildTransactionGraph(filters?: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<TransactionGraph> {
  const where: {
    userId?: string;
    timestamp?: { gte?: Date; lte?: Date };
  } = {};
  if (filters?.userId) where.userId = filters.userId;
  if (filters?.startDate || filters?.endDate) {
    where.timestamp = {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    };
  }

  const rawTxs = await prisma.transaction.findMany({ where });
  const transactions = rawTxs.map(mapPrismaToTransaction);

  // Lookup wallet risk scores from DB
  const allAddresses = new Set<string>();
  for (const tx of transactions) {
    allAddresses.add(tx.senderAddress);
    allAddresses.add(tx.receiverAddress);
  }

  const walletRecords = await prisma.wallet.findMany({
    where: { address: { in: Array.from(allAddresses) } },
    select: { address: true, riskScore: true, riskLevel: true, isSanctioned: true },
  });

  const walletRiskMap = new Map<
    string,
    { riskScore: number; riskLevel: RiskLevel; isSanctioned: boolean }
  >();
  for (const w of walletRecords) {
    walletRiskMap.set(w.address, {
      riskScore: w.riskScore,
      riskLevel: w.riskLevel as RiskLevel,
      isSanctioned: w.isSanctioned,
    });
  }

  // Build node map
  const nodeMap = new Map<
    string,
    {
      transactionCount: number;
      totalVolumeUSD: number;
      isSender: boolean;
      isReceiver: boolean;
    }
  >();

  // Build edge map
  const edgeMap = new Map<
    string,
    {
      source: string;
      target: string;
      weight: number;
      transactionCount: number;
      assets: Set<string>;
      latestTimestamp: Date;
    }
  >();

  for (const tx of transactions) {
    // Update sender node
    const senderNode = nodeMap.get(tx.senderAddress) ?? {
      transactionCount: 0,
      totalVolumeUSD: 0,
      isSender: false,
      isReceiver: false,
    };
    senderNode.transactionCount += 1;
    senderNode.totalVolumeUSD += tx.amountUSD;
    senderNode.isSender = true;
    nodeMap.set(tx.senderAddress, senderNode);

    // Update receiver node
    const receiverNode = nodeMap.get(tx.receiverAddress) ?? {
      transactionCount: 0,
      totalVolumeUSD: 0,
      isSender: false,
      isReceiver: false,
    };
    receiverNode.transactionCount += 1;
    receiverNode.totalVolumeUSD += tx.amountUSD;
    receiverNode.isReceiver = true;
    nodeMap.set(tx.receiverAddress, receiverNode);

    // Update edge
    const edgeKey = `${tx.senderAddress}:${tx.receiverAddress}`;
    const edge = edgeMap.get(edgeKey) ?? {
      source: tx.senderAddress,
      target: tx.receiverAddress,
      weight: 0,
      transactionCount: 0,
      assets: new Set<string>(),
      latestTimestamp: tx.timestamp,
    };
    edge.weight += tx.amountUSD;
    edge.transactionCount += 1;
    edge.assets.add(tx.asset);
    if (tx.timestamp > edge.latestTimestamp) {
      edge.latestTimestamp = tx.timestamp;
    }
    edgeMap.set(edgeKey, edge);
  }

  // Build final nodes
  const nodes: GraphNode[] = Array.from(nodeMap.entries()).map(([address, data]) => {
    const walletInfo = walletRiskMap.get(address);
    const riskScore = walletInfo?.riskScore ?? 0;
    return {
      id: address,
      riskScore,
      riskLevel: walletInfo?.riskLevel ?? riskLevelFromScore(riskScore),
      isSanctioned: walletInfo?.isSanctioned ?? false,
      transactionCount: data.transactionCount,
      totalVolumeUSD: data.totalVolumeUSD,
      type:
        data.isSender && data.isReceiver
          ? 'both'
          : data.isSender
          ? 'sender'
          : 'receiver',
    };
  });

  // Build final edges
  const edges: GraphEdge[] = Array.from(edgeMap.values()).map((e) => ({
    source: e.source,
    target: e.target,
    weight: e.weight,
    transactionCount: e.transactionCount,
    assets: Array.from(e.assets),
    latestTimestamp: e.latestTimestamp,
  }));

  const highRiskNodes = nodes.filter(
    (n) => n.riskLevel === RiskLevel.HIGH || n.riskLevel === RiskLevel.CRITICAL || n.isSanctioned
  ).length;

  // Calculate clusters (connected components)
  const clusters = countConnectedComponents(nodes, edges);

  const n = nodes.length;
  const maxEdges = n > 1 ? n * (n - 1) : 1;
  const densityScore = Math.round((edges.length / maxEdges) * 100) / 100;

  return {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      densityScore,
      highRiskNodes,
      clusters,
    },
  };
}

// ---------------------------------------------------------------------------
// Wallet Connections (sub-graph)
// ---------------------------------------------------------------------------

export async function getWalletConnections(
  address: string,
  depth = 2
): Promise<TransactionGraph> {
  const fullGraph = await buildTransactionGraph();

  const visited = new Set<string>();
  const queue: Array<{ address: string; currentDepth: number }> = [
    { address, currentDepth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.address)) continue;
    visited.add(current.address);

    if (current.currentDepth >= depth) continue;

    for (const edge of fullGraph.edges) {
      if (edge.source === current.address && !visited.has(edge.target)) {
        queue.push({ address: edge.target, currentDepth: current.currentDepth + 1 });
      }
      if (edge.target === current.address && !visited.has(edge.source)) {
        queue.push({ address: edge.source, currentDepth: current.currentDepth + 1 });
      }
    }
  }

  const subNodes = fullGraph.nodes.filter((n) => visited.has(n.id));
  const subEdges = fullGraph.edges.filter(
    (e) => visited.has(e.source) && visited.has(e.target)
  );

  const highRiskNodes = subNodes.filter(
    (n) => n.riskLevel === RiskLevel.HIGH || n.riskLevel === RiskLevel.CRITICAL || n.isSanctioned
  ).length;

  const clusters = countConnectedComponents(subNodes, subEdges);
  const n = subNodes.length;
  const maxEdges = n > 1 ? n * (n - 1) : 1;

  return {
    nodes: subNodes,
    edges: subEdges,
    stats: {
      totalNodes: subNodes.length,
      totalEdges: subEdges.length,
      densityScore: Math.round((subEdges.length / maxEdges) * 100) / 100,
      highRiskNodes,
      clusters,
    },
  };
}

// ---------------------------------------------------------------------------
// Cluster Identification (connected components)
// ---------------------------------------------------------------------------

function countConnectedComponents(nodes: GraphNode[], edges: GraphEdge[]): number {
  if (nodes.length === 0) return 0;

  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  let components = 0;

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      components++;
      const stack = [node.id];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) stack.push(neighbor);
        }
      }
    }
  }

  return components;
}

export async function identifyClusters(): Promise<WalletCluster[]> {
  const graph = await buildTransactionGraph();

  if (graph.nodes.length === 0) return [];

  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const clusters: WalletCluster[] = [];

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      const clusterAddresses: string[] = [];
      const stack = [node.id];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        clusterAddresses.push(current);
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) stack.push(neighbor);
        }
      }

      const clusterNodes = graph.nodes.filter((n) => clusterAddresses.includes(n.id));
      const totalVolume = clusterNodes.reduce((sum, n) => sum + n.totalVolumeUSD, 0);
      const transactionCount = clusterNodes.reduce((sum, n) => sum + n.transactionCount, 0);
      const riskLevel = clusterNodes.reduce(
        (max, n) => maxRiskLevel(max, n.riskLevel),
        RiskLevel.LOW
      );

      clusters.push({
        clusterId: uuidv4(),
        addresses: clusterAddresses,
        totalVolume,
        riskLevel,
        transactionCount,
      });
    }
  }

  return clusters.sort((a, b) => b.totalVolume - a.totalVolume);
}

// ---------------------------------------------------------------------------
// High-Risk Paths
// ---------------------------------------------------------------------------

export async function getHighRiskPaths(): Promise<RiskPath[]> {
  const graph = await buildTransactionGraph();
  const paths: RiskPath[] = [];

  // Find sanctioned or high-risk source nodes
  const dangerousNodes = graph.nodes.filter(
    (n) => n.isSanctioned || n.riskLevel === RiskLevel.CRITICAL
  );

  // Find user-associated nodes (low risk, non-sanctioned)
  const userNodes = graph.nodes.filter(
    (n) => !n.isSanctioned && n.riskLevel === RiskLevel.LOW
  );

  // Build adjacency map for BFS
  const adjacency = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    const srcEdges = adjacency.get(edge.source) ?? [];
    srcEdges.push(edge);
    adjacency.set(edge.source, srcEdges);
  }

  for (const dangerousNode of dangerousNodes) {
    for (const userNode of userNodes) {
      if (dangerousNode.id === userNode.id) continue;

      // BFS to find path from dangerous to user node
      const queue: Array<{ address: string; path: string[]; edges: GraphEdge[] }> = [
        { address: dangerousNode.id, path: [dangerousNode.id], edges: [] },
      ];
      const visited = new Set<string>([dangerousNode.id]);

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.path.length > 5) continue;

        if (current.address === userNode.id) {
          const totalVolumeUSD = current.edges.reduce((sum, e) => sum + e.weight, 0);
          const maxRisk: RiskLevel = current.path.reduce((max: RiskLevel, addr: string) => {
            const node = graph.nodes.find((n) => n.id === addr);
            return node ? maxRiskLevel(max, node.riskLevel) : max;
          }, RiskLevel.LOW as RiskLevel);
          const containsSanctioned = current.path.some(
            (addr) => graph.nodes.find((n) => n.id === addr)?.isSanctioned
          );

          paths.push({
            path: current.path,
            edges: current.edges,
            totalVolumeUSD,
            maxRiskLevel: maxRisk,
            containsSanctioned,
          });
          break;
        }

        const outboundEdges = adjacency.get(current.address) ?? [];
        for (const edge of outboundEdges) {
          if (!visited.has(edge.target)) {
            visited.add(edge.target);
            queue.push({
              address: edge.target,
              path: [...current.path, edge.target],
              edges: [...current.edges, edge],
            });
          }
        }
      }
    }
  }

  return paths.sort((a, b) => b.totalVolumeUSD - a.totalVolumeUSD);
}
