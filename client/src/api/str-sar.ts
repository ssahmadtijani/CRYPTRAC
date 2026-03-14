import apiClient from './client';
import {
  ApiResponse,
  STRSARReport,
  STRSARStats,
  STRSARType,
  STRSARStatus,
  SuspicionCategory,
} from '../types';

export const strSarApi = {
  create: (data: {
    type: STRSARType;
    subjectName: string;
    subjectWalletAddresses: string[];
    suspicionCategories: SuspicionCategory[];
    narrativeSummary: string;
    indicatorsOfSuspicion: string[];
    linkedTransactionIds?: string[];
    linkedCaseIds?: string[];
    linkedWalletAddresses?: string[];
    totalAmountUSD: number;
    dateRangeStart: string;
    dateRangeEnd: string;
    regulatoryAuthority?: string;
    subjectIdentification?: string;
    subjectCountry?: string;
  }) => apiClient.post<ApiResponse<STRSARReport>>('/str-sar', data),

  getReports: (params?: {
    type?: STRSARType;
    status?: STRSARStatus;
    suspicionCategory?: SuspicionCategory;
    filingOfficerUserId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) => apiClient.get<{ success: boolean; data: STRSARReport[]; total: number; page: number; pageSize: number }>('/str-sar', { params }),

  getReport: (id: string) => apiClient.get<ApiResponse<STRSARReport>>(`/str-sar/${id}`),

  getStats: () => apiClient.get<ApiResponse<STRSARStats>>('/str-sar/stats'),

  update: (id: string, data: Partial<STRSARReport>) =>
    apiClient.patch<ApiResponse<STRSARReport>>(`/str-sar/${id}`, data),

  submit: (id: string) => apiClient.post<ApiResponse<STRSARReport>>(`/str-sar/${id}/submit`),

  approve: (id: string, reviewNotes?: string) =>
    apiClient.post<ApiResponse<STRSARReport>>(`/str-sar/${id}/approve`, { reviewNotes }),

  reject: (id: string, reviewNotes: string) =>
    apiClient.post<ApiResponse<STRSARReport>>(`/str-sar/${id}/reject`, { reviewNotes }),

  file: (id: string) => apiClient.post<ApiResponse<STRSARReport>>(`/str-sar/${id}/file`),

  acknowledge: (id: string) => apiClient.post<ApiResponse<STRSARReport>>(`/str-sar/${id}/acknowledge`),

  amend: (id: string, reason: string) =>
    apiClient.post<ApiResponse<STRSARReport>>(`/str-sar/${id}/amend`, { reason }),

  autoGenerate: (transactionIds: string[], caseId?: string) =>
    apiClient.post<ApiResponse<STRSARReport>>('/str-sar/auto-generate', { transactionIds, caseId }),
};
