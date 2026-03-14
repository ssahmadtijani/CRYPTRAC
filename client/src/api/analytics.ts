/**
 * Analytics API Client for CRYPTRAC
 */

import api from './client';
import type {
  ApiResponse,
  AnalyticsKPIs,
  TimeSeriesPoint,
  RiskDistributionItem,
  AssetBreakdownItem,
  NetworkBreakdownItem,
  TopWalletItem,
  ComplianceOverviewItem,
  GeographicBreakdownItem,
  PatternDetectionResult,
  StructuringPattern,
  RapidMovementPattern,
  LayeringPattern,
  RoundTripPattern,
  PatternHistoryEntry,
  TransactionGraph,
  WalletCluster,
  RiskPath,
} from '../types/index';

export const analyticsApi = {
  getKPIs: () =>
    api.get<ApiResponse<AnalyticsKPIs>>('/analytics/kpis'),

  getTimeSeries: (period: 'day' | 'week' | 'month' = 'day', range = 30) =>
    api.get<ApiResponse<TimeSeriesPoint[]>>(`/analytics/time-series?period=${period}&range=${range}`),

  getRiskDistribution: () =>
    api.get<ApiResponse<RiskDistributionItem[]>>('/analytics/risk-distribution'),

  getAssetBreakdown: () =>
    api.get<ApiResponse<AssetBreakdownItem[]>>('/analytics/asset-breakdown'),

  getNetworkBreakdown: () =>
    api.get<ApiResponse<NetworkBreakdownItem[]>>('/analytics/network-breakdown'),

  getTopWallets: (limit = 10, sortBy: 'volume' | 'risk' = 'volume') =>
    api.get<ApiResponse<TopWalletItem[]>>(`/analytics/top-wallets?limit=${limit}&sortBy=${sortBy}`),

  getComplianceOverview: () =>
    api.get<ApiResponse<ComplianceOverviewItem[]>>('/analytics/compliance-overview'),

  getGeographic: () =>
    api.get<ApiResponse<GeographicBreakdownItem[]>>('/analytics/geographic'),

  // Pattern Detection
  getAllPatterns: (userId?: string) =>
    api.get<ApiResponse<PatternDetectionResult>>(
      `/analytics/patterns${userId ? `?userId=${userId}` : ''}`
    ),

  getStructuringPatterns: () =>
    api.get<ApiResponse<StructuringPattern[]>>('/analytics/patterns/structuring'),

  getRapidMovementPatterns: () =>
    api.get<ApiResponse<RapidMovementPattern[]>>('/analytics/patterns/rapid-movement'),

  getLayeringPatterns: () =>
    api.get<ApiResponse<LayeringPattern[]>>('/analytics/patterns/layering'),

  getRoundTrippingPatterns: () =>
    api.get<ApiResponse<RoundTripPattern[]>>('/analytics/patterns/round-tripping'),

  getPatternHistory: () =>
    api.get<ApiResponse<PatternHistoryEntry[]>>('/analytics/patterns/history'),

  // Network Analysis
  getTransactionGraph: (params?: { userId?: string; startDate?: string; endDate?: string }) => {
    const qs = new URLSearchParams();
    if (params?.userId) qs.set('userId', params.userId);
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    const query = qs.toString();
    return api.get<ApiResponse<TransactionGraph>>(`/analytics/network/graph${query ? `?${query}` : ''}`);
  },

  getWalletConnections: (address: string, depth = 2) =>
    api.get<ApiResponse<TransactionGraph>>(`/analytics/network/wallet/${address}?depth=${depth}`),

  getClusters: () =>
    api.get<ApiResponse<WalletCluster[]>>('/analytics/network/clusters'),

  getHighRiskPaths: () =>
    api.get<ApiResponse<RiskPath[]>>('/analytics/network/high-risk-paths'),
};
