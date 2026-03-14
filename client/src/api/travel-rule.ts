import apiClient from './client';
import {
  ApiResponse,
  TravelRuleRecord,
  TravelRuleStats,
  VASPInfo,
  TravelRuleStatus,
  OriginatorInfo,
  BeneficiaryInfo,
} from '../types';

export const travelRuleApi = {
  initiate: (data: {
    transactionId: string;
    originatorInfo: OriginatorInfo;
    beneficiaryInfo: BeneficiaryInfo;
    amount: number;
    amountUSD: number;
    asset: string;
    network: string;
  }) => apiClient.post<ApiResponse<TravelRuleRecord>>('/travel-rule', data),

  getRecords: (params?: {
    status?: TravelRuleStatus;
    transactionId?: string;
    startDate?: string;
    endDate?: string;
    isAboveThreshold?: boolean;
  }) => apiClient.get<ApiResponse<TravelRuleRecord[]> & { total: number }>('/travel-rule', { params }),

  getRecord: (id: string) => apiClient.get<ApiResponse<TravelRuleRecord>>(`/travel-rule/${id}`),

  getStats: () => apiClient.get<ApiResponse<TravelRuleStats>>('/travel-rule/stats'),

  updateStatus: (id: string, status: TravelRuleStatus, notes?: string) =>
    apiClient.patch<ApiResponse<TravelRuleRecord>>(`/travel-rule/${id}/status`, { status, notes }),

  submitBeneficiary: (id: string, beneficiaryInfo: BeneficiaryInfo) =>
    apiClient.patch<ApiResponse<TravelRuleRecord>>(`/travel-rule/${id}/beneficiary`, { beneficiaryInfo }),

  complianceCheck: (id: string) =>
    apiClient.get<ApiResponse<{ isCompliant: boolean; missingFields: string[]; warnings: string[] }>>(
      `/travel-rule/${id}/compliance-check`
    ),

  expireStale: () => apiClient.post<ApiResponse<{ expiredCount: number }>>('/travel-rule/expire-stale'),

  registerVASP: (data: Omit<VASPInfo, 'id' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<ApiResponse<VASPInfo>>('/travel-rule/vasps', data),

  getVASPs: (params?: { country?: string; isVerified?: boolean }) =>
    apiClient.get<ApiResponse<VASPInfo[]> & { total: number }>('/travel-rule/vasps', { params }),

  getVASP: (id: string) => apiClient.get<ApiResponse<VASPInfo>>(`/travel-rule/vasps/${id}`),
};
