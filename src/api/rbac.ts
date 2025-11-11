// src/api/rbac.ts
import { BASE_URL } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Role {
  id: number;
  name: string;
  description?: string;
  permissions?: Permission[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Permission {
  id: number;
  name: string;
  resource: string;
  action: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleCheckRequest {
  role: string;
}

export interface PermissionCheckRequest {
  permission: string;
}

export interface RoleCheckResponse {
  hasRole: boolean;
  role?: string;
  message?: string;
}

export interface PermissionCheckResponse {
  hasPermission: boolean;
  permission?: string;
  message?: string;
}

// Check if user has specific role
export async function checkRole(role: string): Promise<RoleCheckResponse> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/rbac/check-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    throw new Error('Failed to check role');
  }
  const data = await res.json();
  return data;
}

// Check if user has specific permission
export async function checkPermission(
  permission: string,
): Promise<PermissionCheckResponse> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/rbac/check-permission`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ permission }),
  });
  if (!res.ok) {
    throw new Error('Failed to check permission');
  }
  const data = await res.json();
  return data;
}

// Get user roles
export async function fetchUserRoles(): Promise<Role[]> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/rbac/me/roles`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch user roles');
  }
  const data = await res.json();
  return data;
}

// Get user permissions
export async function fetchUserPermissions(): Promise<Permission[]> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/rbac/me/permissions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch user permissions');
  }
  const data = await res.json();
  return data;
}

// Get all available roles
export async function fetchAllRoles(): Promise<Role[]> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/rbac/roles`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch all roles');
  }
  const data = await res.json();
  return data;
}

// Get all available permissions
export async function fetchAllPermissions(): Promise<Permission[]> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}/rbac/permissions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch all permissions');
  }
  const data = await res.json();
  return data;
}
