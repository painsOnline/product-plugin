/**
 * 文件名称：api.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * API 客户端，支持自动重试和登录拦截
 */
import { API_BASE_URL, API_PATHS } from '@/shared/constants';

interface APIResponse<T = unknown> {
  code: string;
  msg: string;
  result: T;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  needAuth?: boolean;
}

/**
 * 发送 API 请求
 * 自动处理 401 → 弹出登录窗口 → 重试原请求
 * 自动处理 429 → 加载验证码
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
  const fetchOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json();

  if (data.code === '401') {
    const loginSuccess = await showLoginDialog();
    if (loginSuccess) {
      const retryHeaders = await getAuthHeaders();
      Object.assign(requestHeaders, retryHeaders);
      const retryResponse = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
      });
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

/**
 * 获取认证头信息
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get(['auth_token', 'tenant_code']);
  const headers: Record<string, string> = {};
  const token = result.auth_token as string | undefined;
  const tenant = result.tenant_code as string | undefined;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (tenant) {
    headers['Tenant'] = tenant;
  }
  return headers;
}

/**
 * 显示登录对话框
 */
async function showLoginDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'SHOW_LOGIN_DIALOG' },
      (response) => {
        resolve(response?.success ?? false);
      }
    );
  });
}

/**
 * 处理验证码流程
 */
async function handleCaptchaFlow(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'SHOW_CAPTCHA_FLOW' },
      (response) => {
        resolve(response?.success ?? false);
      }
    );
  });
}

/**
 * 简单的 GET 请求
 */
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

/**
 * POST 请求
 */
export async function apiPost<T = unknown>(
  path: string,
  body: unknown
): Promise<APIResponse<T>> {
  return apiRequest<T>(path, { method: 'POST', body });
}
