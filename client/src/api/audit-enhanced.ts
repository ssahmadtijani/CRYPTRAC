import apiClient from './client';
import { ApiResponse, AuditLogEntry, AuditDashboardMetrics, AuditComplianceReport, AuditSeverity } from '../types';

export const auditEnhancedApi = {
  getAuditLogs: (params?: {
    userId?: string;
    action?: string;
    entityType?: string;
    severity?: AuditSeverity;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    pageSize?: number;
    sortBy?: 'timestamp' | 'action' | 'severity';
    sortOrder?: 'asc' | 'desc';
  }) =>
    apiClient.get<ApiResponse<AuditLogEntry[]>>('/admin/audit', { params }),

  getDashboardMetrics: () =>
    apiClient.get<ApiResponse<AuditDashboardMetrics>>('/admin/audit/dashboard'),

  getTimeline: (params?: { startDate?: string; endDate?: string; limit?: number }) =>
    apiClient.get<ApiResponse<AuditLogEntry[]>>('/admin/audit/timeline', { params }),

  getSecurityEvents: (limit?: number) =>
    apiClient.get<ApiResponse<AuditLogEntry[]>>('/admin/audit/security-events', { params: { limit } }),

  getComplianceReport: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<AuditComplianceReport>>('/admin/audit/compliance-report', { params }),

  getUserAuditTrail: (userId: string, params?: { page?: number; pageSize?: number }) =>
    apiClient.get<ApiResponse<AuditLogEntry[]>>(`/admin/audit/users/${userId}`, { params }),

  getLogById: (id: string) =>
    apiClient.get<ApiResponse<AuditLogEntry>>(`/admin/audit/${id}`),
};
