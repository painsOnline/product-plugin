/**
 * 文件名称：api.ts
 * 作者：shop-tool
 * 时间：2026-06-15
 * API 客户端，所有请求通过 Service Worker 代理以规避 CORS 限制.
 *
 * 从 https 页面访问 localhost 会被 Chrome Private Network Access 拦截，
 * 因此不在 content script 中直接 fetch，而是委托 Service Worker 执行.
 */
import { showLoginDialog, handleCaptchaFlow } from './interceptors';
import type { APIResponse } from '@/shared/types';

interface RequestPayload {
  path: string;
  method?: string;
  body?: unknown;
}

/** 通过 Service Worker 代理发送 API 请求 */
function swApiRequest(payload: RequestPayload): Promise<APIResponse<unknown>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'API_REQUEST', payload },
      (response) => {
        resolve((response as APIResponse<unknown>) || {
          code: '500', msg: 'Service Worker 无响应', result: null,
        });
      }
    );
  });
}

/**
 * 发送 API 请求（经 Service Worker），自动处理 401 重试和 429 验证码.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<APIResponse<T>> {
  const { method = 'GET', body } = options;

  const payload: RequestPayload = { path, method };
  if (body && method !== 'GET') {
    payload.body = body;
  }

  let data = await swApiRequest(payload);

  // 401 → 弹出登录 → 重试
  if (data.code === '401') {
    const loginSuccess = await showLoginDialog();
    if (loginSuccess) {
      data = await swApiRequest(payload);
    }
  }

  // 429 → 验证码流程 → 重试
  if (data.code === '429') {
    const captchaResolved = await handleCaptchaFlow();
    if (captchaResolved) {
      data = await swApiRequest(payload);
    }
  }

  return data as APIResponse<T>;
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
