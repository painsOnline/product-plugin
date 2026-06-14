/**
 * 文件名称：api.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * API 客户端，支持自动重试和登录拦截
 */
import { API_BASE_URL, API_PATHS } from '@/shared/constants';
import { getAuthHeaders } from '@/shared/auth';
import { showLoginDialog, handleCaptchaFlow } from './interceptors';
import type { APIResponse } from '@/shared/types';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  needAuth?: boolean;
}

/**
 * 发送 API 请求，自动处理 401 重试和 429 验证码.
 *
 * 重试/验证码逻辑委托给 interceptors.ts（SRP）。
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<APIResponse<T>> {
  const { method = 'GET', headers = {}, body, needAuth = true } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (needAuth) {
    const authHeaders = await getAuthHeaders();
    Object.assign(requestHeaders, authHeaders);
  }

  const url = `${API_BASE_URL}${path}`;
  const fetchOptions: RequestInit = { method, headers: requestHeaders };
  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const data: APIResponse<T> = await response.json();

  if (data.code === '401') {
    const loginSuccess = await showLoginDialog();
    if (loginSuccess) {
      const retryHeaders = await getAuthHeaders();
      Object.assign(requestHeaders, retryHeaders);
      const retryResponse = await fetch(url, { ...fetchOptions, headers: requestHeaders });
      return retryResponse.json();
    }
  }

  if (data.code === '429') {
    const captchaResolved = await handleCaptchaFlow();
    if (captchaResolved) {
      return apiRequest<T>(path, options);
    }
  }

  return data;
}

/** GET 请求 */
export async function apiGet<T = unknown>(
  path: string,
  params?: Record<string, string>
): Promise<APIResponse<T>> {
  let url = path;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url = `${path}?${searchParams.toString()}`;
  }
  return apiRequest<T>(url, { method: 'GET' });
}

/** POST 请求 */
export async function apiPost<T = unknown>(
  path: string,
  body: unknown
): Promise<APIResponse<T>> {
  return apiRequest<T>(path, { method: 'POST', body });
}
