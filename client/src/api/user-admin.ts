import apiClient from './client';
import {
  ApiResponse,
  UserProfile,
  UserSession,
  UserActivity,
  UserAdminStats,
  UserRole,
  UserStatus,
} from '../types';

export const userAdminApi = {
  getUsers: (params?: { page?: number; pageSize?: number; role?: UserRole; status?: UserStatus; department?: string; search?: string }) =>
    apiClient.get<ApiResponse<UserProfile[]>>('/admin/users', { params }),

  getStats: () =>
    apiClient.get<ApiResponse<UserAdminStats>>('/admin/users/stats'),

  createUser: (data: { email: string; password: string; firstName: string; lastName: string; role: UserRole; department?: string; phone?: string }) =>
    apiClient.post<ApiResponse<UserProfile>>('/admin/users', data),

  getUserById: (id: string) =>
    apiClient.get<ApiResponse<UserProfile>>(`/admin/users/${id}`),

  updateUserProfile: (id: string, data: { firstName?: string; lastName?: string; department?: string; phone?: string }) =>
    apiClient.patch<ApiResponse<UserProfile>>(`/admin/users/${id}`, data),

  changeUserRole: (id: string, role: UserRole) =>
    apiClient.patch<ApiResponse<UserProfile>>(`/admin/users/${id}/role`, { role }),

  suspendUser: (id: string, reason: string) =>
    apiClient.post<ApiResponse<UserProfile>>(`/admin/users/${id}/suspend`, { reason }),

  reactivateUser: (id: string) =>
    apiClient.post<ApiResponse<UserProfile>>(`/admin/users/${id}/reactivate`),

  lockUser: (id: string, durationMs?: number) =>
    apiClient.post<ApiResponse<UserProfile>>(`/admin/users/${id}/lock`, { durationMs }),

  unlockUser: (id: string) =>
    apiClient.post<ApiResponse<UserProfile>>(`/admin/users/${id}/unlock`),

  deactivateUser: (id: string) =>
    apiClient.post<ApiResponse<UserProfile>>(`/admin/users/${id}/deactivate`),

  resetPassword: (id: string, newPassword: string) =>
    apiClient.post<ApiResponse<{ message: string }>>(`/admin/users/${id}/reset-password`, { newPassword }),

  getSessions: (id: string) =>
    apiClient.get<ApiResponse<UserSession[]>>(`/admin/users/${id}/sessions`),

  terminateAllSessions: (id: string) =>
    apiClient.delete<ApiResponse<{ terminated: number }>>(`/admin/users/${id}/sessions`),

  terminateSession: (id: string, sessionId: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(`/admin/users/${id}/sessions/${sessionId}`),

  getActivity: (id: string, params?: { page?: number; pageSize?: number }) =>
    apiClient.get<ApiResponse<UserActivity[]>>(`/admin/users/${id}/activity`, { params }),
};
