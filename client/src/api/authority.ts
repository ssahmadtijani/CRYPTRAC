import apiClient from './client';
import {
  ApiResponse,
  TaxAuthorityDashboard,
  TaxpayerSummary,
  TaxAssessment,
  TaxableEvent,
  ExchangeTaxBreakdown,
} from '../types';

export const authorityApi = {
  getDashboard: () =>
    apiClient.get<ApiResponse<TaxAuthorityDashboard>>('/authority/dashboard'),

  getTaxpayers: () =>
    apiClient.get<ApiResponse<TaxpayerSummary[]>>('/authority/taxpayers'),

  getTaxpayer: (userId: string) =>
    apiClient.get<
      ApiResponse<{
        user: { id: string; email: string; firstName: string; lastName: string; role: string };
        summary: TaxpayerSummary;
        assessments: TaxAssessment[];
        recentEvents: TaxableEvent[];
      }>
    >(`/authority/taxpayers/${userId}`),

  getTaxpayerAssessments: (userId: string) =>
    apiClient.get<ApiResponse<TaxAssessment[]>>(
      `/authority/taxpayers/${userId}/assessments`
    ),

  getTaxpayerEvents: (userId: string) =>
    apiClient.get<ApiResponse<TaxableEvent[]>>(
      `/authority/taxpayers/${userId}/events`
    ),

  getExchanges: () =>
    apiClient.get<ApiResponse<ExchangeTaxBreakdown[]>>('/authority/exchanges'),

  generateReport: () =>
    apiClient.get<ApiResponse<unknown>>('/authority/reports/generate'),

  getFlagged: () =>
    apiClient.get<ApiResponse<TaxAssessment[]>>('/authority/flagged'),
};
