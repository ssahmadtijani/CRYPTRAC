import apiClient from './client';
import {
  ApiResponse,
  Case,
  CaseNote,
  CaseTimelineEntry,
  CaseDashboardMetrics,
  CreateCaseRequest,
  UpdateCaseRequest,
  CaseFilterParams,
  CaseStatus,
} from '../types';

export const casesApi = {
  getCases: (filters?: CaseFilterParams) =>
    apiClient.get<ApiResponse<Case[]>>('/cases', { params: filters }),

  getCaseById: (id: string) =>
    apiClient.get<ApiResponse<Case>>(`/cases/${id}`),

  createCase: (data: CreateCaseRequest) =>
    apiClient.post<ApiResponse<Case>>('/cases', data),

  updateCase: (id: string, data: UpdateCaseRequest) =>
    apiClient.patch<ApiResponse<Case>>(`/cases/${id}`, data),

  updateCaseStatus: (id: string, status: CaseStatus, resolution?: string) =>
    apiClient.patch<ApiResponse<Case>>(`/cases/${id}/status`, { status, resolution }),

  assignCase: (id: string, assignedTo: string) =>
    apiClient.patch<ApiResponse<Case>>(`/cases/${id}/assign`, { assignedTo }),

  getCaseNotes: (id: string) =>
    apiClient.get<ApiResponse<CaseNote[]>>(`/cases/${id}/notes`),

  addCaseNote: (id: string, content: string, isInternal: boolean) =>
    apiClient.post<ApiResponse<CaseNote>>(`/cases/${id}/notes`, { content, isInternal }),

  getCaseTimeline: (id: string) =>
    apiClient.get<ApiResponse<CaseTimelineEntry[]>>(`/cases/${id}/timeline`),

  getRelatedCases: (id: string) =>
    apiClient.get<ApiResponse<Case[]>>(`/cases/${id}/related`),

  getCaseDashboard: () =>
    apiClient.get<ApiResponse<CaseDashboardMetrics>>('/cases/dashboard'),

  autoCreateCase: (transactionId: string) =>
    apiClient.post<ApiResponse<Case>>('/cases/auto-create', { transactionId }),
};
