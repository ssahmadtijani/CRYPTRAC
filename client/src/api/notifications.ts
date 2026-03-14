/**
 * Notifications & Alert Rules API client for CRYPTRAC
 */

import apiClient from './client';
import {
  ApiResponse,
  Notification,
  NotificationPreferences,
  NotificationStats,
  NotificationType,
  NotificationPriority,
  AlertRule,
  CreateAlertRuleRequest,
  UpdateNotificationPreferencesRequest,
} from '../types';

export interface NotificationListParams {
  type?: NotificationType;
  priority?: NotificationPriority;
  isRead?: boolean;
  page?: number;
  pageSize?: number;
}

export const notificationsApi = {
  list: (params?: NotificationListParams) =>
    apiClient.get<ApiResponse<Notification[]>>('/notifications', { params }),

  stats: () => apiClient.get<ApiResponse<NotificationStats>>('/notifications/stats'),

  markAsRead: (id: string) =>
    apiClient.patch<ApiResponse<Notification>>(`/notifications/${id}/read`),

  markAllAsRead: () =>
    apiClient.patch<ApiResponse<{ markedAsRead: number }>>('/notifications/read-all'),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/notifications/${id}`),

  getPreferences: () =>
    apiClient.get<ApiResponse<NotificationPreferences>>('/notifications/preferences'),

  updatePreferences: (data: UpdateNotificationPreferencesRequest) =>
    apiClient.put<ApiResponse<NotificationPreferences>>('/notifications/preferences', data),
};

export const alertsApi = {
  listRules: (params?: { isActive?: boolean }) =>
    apiClient.get<ApiResponse<AlertRule[]>>('/alerts/rules', { params }),

  createRule: (data: CreateAlertRuleRequest) =>
    apiClient.post<ApiResponse<AlertRule>>('/alerts/rules', data),

  getRule: (id: string) =>
    apiClient.get<ApiResponse<AlertRule>>(`/alerts/rules/${id}`),

  updateRule: (id: string, data: Partial<CreateAlertRuleRequest>) =>
    apiClient.put<ApiResponse<AlertRule>>(`/alerts/rules/${id}`, data),

  toggleRule: (id: string) =>
    apiClient.patch<ApiResponse<AlertRule>>(`/alerts/rules/${id}/toggle`),

  deleteRule: (id: string) =>
    apiClient.delete<ApiResponse<null>>(`/alerts/rules/${id}`),

  getDefaults: () =>
    apiClient.get<ApiResponse<Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>[]>>(
      '/alerts/rules/defaults'
    ),
};
