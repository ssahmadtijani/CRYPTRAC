import apiClient from './client';
import { ApiResponse, Permission, UserRole, UserPermissionOverride } from '../types';

export const rolePermissionApi = {
  getAllRolePermissions: () =>
    apiClient.get<ApiResponse<Record<UserRole, Permission[]>>>('/admin/roles'),

  getPermissionsList: () =>
    apiClient.get<ApiResponse<{ permission: Permission; description: string }[]>>('/admin/roles/permissions'),

  getRolePermissions: (role: UserRole) =>
    apiClient.get<ApiResponse<{ role: UserRole; permissions: Permission[] }>>(`/admin/roles/${role}`),

  updateRolePermissions: (role: UserRole, permissions: Permission[]) =>
    apiClient.put<ApiResponse<{ role: UserRole; permissions: Permission[] }>>(`/admin/roles/${role}`, { permissions }),

  getUserEffectivePermissions: (userId: string, role: UserRole) =>
    apiClient.get<ApiResponse<{ userId: string; permissions: Permission[]; overrides: UserPermissionOverride | null }>>(`/admin/roles/users/${userId}/permissions`, { params: { role } }),

  grantPermission: (userId: string, permission: Permission) =>
    apiClient.post<ApiResponse<UserPermissionOverride>>(`/admin/roles/users/${userId}/permissions/grant`, { permission }),

  revokePermission: (userId: string, permission: Permission) =>
    apiClient.post<ApiResponse<UserPermissionOverride>>(`/admin/roles/users/${userId}/permissions/revoke`, { permission }),

  clearPermissionOverrides: (userId: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(`/admin/roles/users/${userId}/permissions`),

  checkPermission: (userId: string, permission: Permission, role: UserRole) =>
    apiClient.get<ApiResponse<{ userId: string; permission: Permission; hasPermission: boolean }>>(`/admin/roles/check/${userId}/${permission}`, { params: { role } }),
};
