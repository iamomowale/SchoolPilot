const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export const userRole = process.env.NEXT_PUBLIC_USER_ROLE || '';

export const apiHeaders: Record<string, string> = Object.fromEntries([
  ['x-tenant-id', process.env.NEXT_PUBLIC_TENANT_ID],
  ['x-user-id', process.env.NEXT_PUBLIC_USER_ID],
  ['x-role', userRole],
].filter((entry): entry is [string, string] => Boolean(entry[1])));

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!apiHeaders['x-tenant-id'] || !apiHeaders['x-user-id']) throw new Error('The application is missing tenant or user context. Configure NEXT_PUBLIC_TENANT_ID and NEXT_PUBLIC_USER_ID.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...apiHeaders,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || 'The request could not be completed.');
  }
  return response.json();
}

export type ApiResponse<T> = { success: boolean; data: T };

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  status?: string;
  email?: string;
  phone?: string;
};

export type Guardian = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  relationship?: string;
};
