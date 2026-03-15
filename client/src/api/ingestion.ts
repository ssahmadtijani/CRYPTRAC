import apiClient from './client';
import { ApiResponse } from '../types';

export interface BlockSyncState {
  network: string;
  lastBlock: number;
  targetBlock: number | null;
  isRunning: boolean;
  lastError: string | null;
  updatedAt: string;
  watchedAddressCount: number;
}

export interface WatchedAddress {
  address: string;
  label?: string;
  network: string;
}

export const ingestionApi = {
  getStatus: () =>
    apiClient.get<ApiResponse<BlockSyncState>>('/ingestion/status'),

  start: () =>
    apiClient.post<ApiResponse<BlockSyncState>>('/ingestion/start'),

  stop: () =>
    apiClient.post<ApiResponse<BlockSyncState>>('/ingestion/stop'),

  getWatchedAddresses: () =>
    apiClient.get<ApiResponse<WatchedAddress[]>>('/ingestion/watched-addresses'),

  addWatchedAddress: (data: { address: string; label?: string; network?: string }) =>
    apiClient.post<ApiResponse<WatchedAddress[]>>('/ingestion/watched-addresses', data),

  removeWatchedAddress: (address: string) =>
    apiClient.delete<ApiResponse<{ success: boolean }>>(`/ingestion/watched-addresses/${encodeURIComponent(address)}`),
};
