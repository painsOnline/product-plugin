/**
 * 文件名称：background.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * Service Worker 后台脚本
 *
 * 功能：
 * - 消息路由（popup 与 content scripts 之间）
 * - 登录对话框管理
 * - 验证码流程管理
 * - API 代理
 */
import { API_BASE_URL, API_PATHS, STORAGE_KEYS } from '@/shared/constants';

/** 监听来自 popup 和 content script 的消息 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msgType = message.type as string;

  if (msgType === 'SHOW_LOGIN_DIALOG') {
    handleLoginFlow().then((success) => sendResponse({ success }));
    return true; // async response
  }

  if (msgType === 'SHOW_CAPTCHA_FLOW') {
    handleCaptchaFlow().then((success) => sendResponse({ success }));
    return true;
  }

  if (msgType === 'API_REQUEST') {
    handleApiRequest(message.payload).then((result) => sendResponse(result));
    return true;
  }

  return false;
});

/** 处理登录流程 */
async function handleLoginFlow(): Promise<boolean> {
  chrome.action.openPopup();
  return true;
}

/** 处理验证码流程 */
async function handleCaptchaFlow(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}${API_PATHS.CAPTCHA}`);
    const data = await response.json();
    if (data.code === '200') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** 代理 API 请求 */
async function handleApiRequest(payload: {
  path: string;
  method?: string;
  body?: unknown;
}): Promise<unknown> {
  const { path, method = 'GET', body } = payload;
  try {
    const storage = await chrome.storage.local.get([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.TENANT_CODE,
    ]);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const authToken = storage[STORAGE_KEYS.AUTH_TOKEN] as string | undefined;
    const tenantCode = storage[STORAGE_KEYS.TENANT_CODE] as string | undefined;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (tenantCode) {
      headers['Tenant'] = tenantCode;
    }

    const fetchOptions: RequestInit = { method, headers };
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, fetchOptions);
    return response.json();
  } catch (e) {
    return { code: '500', msg: String(e), result: null };
  }
}
