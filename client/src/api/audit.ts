import apiClient from './client';
import { ApiResponse, AuditEntry, AuditStats, AuditFilterParams } from '../types';

export const auditApi = {
  getAuditLog: (filters?: AuditFilterParams) =>
    apiClient.get<ApiResponse<AuditEntry[]>>('/audit', { params: filters }),

  getAuditEntryById: (id: string) =>
    apiClient.get<ApiResponse<AuditEntry>>(`/audit/${id}`),

  getAuditStats: (userId?: string) =>
    apiClient.get<ApiResponse<AuditStats>>('/audit/stats', { params: userId ? { userId } : undefined }),
};

export type ExportFormat = 'csv' | 'json' | 'pdf';

export const exportApi = {
  exportTransactions: (format: ExportFormat = 'csv', params?: { startDate?: string; endDate?: string; userId?: string }) =>
    apiClient.get('/export/transactions', {
      params: { format, ...params },
      responseType: format === 'pdf' ? 'arraybuffer' : 'blob',
    }),

  exportComplianceReports: (format: ExportFormat = 'csv') =>
    apiClient.get('/export/compliance-reports', {
      params: { format },
      responseType: format === 'pdf' ? 'arraybuffer' : 'blob',
    }),

  exportTaxAssessments: (format: ExportFormat = 'csv', params?: { userId?: string }) =>
    apiClient.get('/export/tax-assessments', {
      params: { format, ...params },
      responseType: format === 'pdf' ? 'arraybuffer' : 'blob',
    }),

  exportCases: (format: ExportFormat = 'csv', params?: { startDate?: string; endDate?: string }) =>
    apiClient.get('/export/cases', {
      params: { format, ...params },
      responseType: format === 'pdf' ? 'arraybuffer' : 'blob',
    }),

  exportAuditLogs: (format: ExportFormat = 'csv', params?: { startDate?: string; endDate?: string; userId?: string }) =>
    apiClient.get('/export/audit-logs', {
      params: { format, ...params },
      responseType: format === 'pdf' ? 'arraybuffer' : 'blob',
    }),
};

/**
 * Triggers a file download from an API response blob/arraybuffer.
 */
export function downloadFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  filename: string,
  mimeType: string
): void {
  const blob = data instanceof ArrayBuffer ? new Blob([data], { type: mimeType }) : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
