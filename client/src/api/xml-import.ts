import apiClient from './client';
import { ApiResponse } from '../types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ImportResult {
  submissionId: string;
  exchangeName: string;
  reportingPeriod: string;
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  validationErrors: ValidationError[];
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  processedAt: string;
}

export interface ImportRecord {
  id: string;
  exchangeName: string;
  reportingPeriod: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  validationErrors: ValidationError[] | null;
  submittedBy?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportHistoryMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const xmlImportApi = {
  validate: (xml: string) =>
    apiClient.post<ApiResponse<ValidationResult>>('/exchange-reports/validate', { xml }),

  import: (xml: string) =>
    apiClient.post<ApiResponse<ImportResult>>('/exchange-reports/import', { xml }),

  getHistory: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get<ApiResponse<ImportRecord[]> & { meta?: ImportHistoryMeta }>('/exchange-reports', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<ImportRecord>>(`/exchange-reports/${id}`),
};
