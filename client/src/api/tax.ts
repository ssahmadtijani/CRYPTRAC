import apiClient from './client';
import {
  ApiResponse,
  ExchangeConnection,
  ExchangeTransaction,
  TaxableEvent,
  TaxAssessment,
  AssessmentPeriod,
} from '../types';

// ---------------------------------------------------------------------------
// Exchange API
// ---------------------------------------------------------------------------

export const exchangeApi = {
  connect: (exchangeName: string) =>
    apiClient.post<ApiResponse<ExchangeConnection>>('/exchanges/connect', {
      exchangeName,
    }),

  list: () =>
    apiClient.get<ApiResponse<ExchangeConnection[]>>('/exchanges'),

  sync: (name: string) =>
    apiClient.post<ApiResponse<{ synced: number; connection: ExchangeConnection }>>(
      `/exchanges/${name}/sync`
    ),

  getAllTransactions: () =>
    apiClient.get<ApiResponse<ExchangeTransaction[]>>('/exchanges/transactions'),

  getTransactions: (name: string) =>
    apiClient.get<ApiResponse<ExchangeTransaction[]>>(
      `/exchanges/${name}/transactions`
    ),
};

// ---------------------------------------------------------------------------
// Tax API
// ---------------------------------------------------------------------------

export const taxApi = {
  process: () =>
    apiClient.post<ApiResponse<{ processed: number; taxableEvents: number }>>(
      '/tax/process'
    ),

  getEvents: (params?: Record<string, string>) =>
    apiClient.get<ApiResponse<TaxableEvent[]>>('/tax/events', { params }),

  generateAssessment: (taxYear: number, period: AssessmentPeriod) =>
    apiClient.post<ApiResponse<TaxAssessment>>('/tax/assessment', {
      taxYear,
      period,
    }),

  getAssessments: () =>
    apiClient.get<ApiResponse<TaxAssessment[]>>('/tax/assessments'),

  getAssessment: (id: string) =>
    apiClient.get<ApiResponse<TaxAssessment>>(`/tax/assessments/${id}`),

  getSummary: () =>
    apiClient.get<
      ApiResponse<{
        userId: string;
        totalAssessments: number;
        totalTaxableEvents: number;
        totalTaxLiabilityUSD: number;
        totalTaxLiabilityNGN: number;
        recentAssessments: TaxAssessment[];
      }>
    >('/tax/summary'),
};
