import apiClient from './client';
import {
  ApiResponse,
  RegulatoryFiling,
  FilingCalendarEntry,
  FilingDashboardMetrics,
  FilingType,
  FilingStatus,
} from '../types';

export const regulatoryFilingApi = {
  create: (data: {
    filingType: FilingType;
    title: string;
    description: string;
    regulatoryAuthority: string;
    dueDate: string;
    assignedTo?: string;
    linkedReportIds?: string[];
  }) => apiClient.post<ApiResponse<RegulatoryFiling>>('/filings', data),

  getFilings: (params?: {
    filingType?: FilingType;
    status?: FilingStatus;
    assignedTo?: string;
    startDate?: string;
    endDate?: string;
  }) => apiClient.get<ApiResponse<RegulatoryFiling[]> & { total: number }>('/filings', { params }),

  getFiling: (id: string) => apiClient.get<ApiResponse<RegulatoryFiling>>(`/filings/${id}`),

  update: (id: string, data: Partial<RegulatoryFiling>) =>
    apiClient.patch<ApiResponse<RegulatoryFiling>>(`/filings/${id}`, data),

  markAsFiled: (id: string, filingReference?: string) =>
    apiClient.post<ApiResponse<RegulatoryFiling>>(`/filings/${id}/file`, { filingReference }),

  cancel: (id: string, reason: string) =>
    apiClient.post<ApiResponse<RegulatoryFiling>>(`/filings/${id}/cancel`, { reason }),

  getCalendar: (daysAhead?: number) =>
    apiClient.get<ApiResponse<FilingCalendarEntry[]> & { total: number }>('/filings/calendar', {
      params: daysAhead ? { daysAhead } : undefined,
    }),

  getDashboard: () => apiClient.get<ApiResponse<FilingDashboardMetrics>>('/filings/dashboard'),

  checkOverdue: () =>
    apiClient.post<ApiResponse<RegulatoryFiling[]> & { total: number }>('/filings/check-overdue'),
};
