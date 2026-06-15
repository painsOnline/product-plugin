/**
 * 文件名称：background.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * Service Worker 后台脚本.
 *
 * - 通过 tabs.onUpdated 动态注入 content scripts (type: module)
 * - 消息路由（popup ↔ content scripts）
 * - 登录/验证码流程管理
 */
import { API_BASE_URL, ADMIN_BASE_URL, API_PATHS } from '@/shared/constants';
import { getAuthHeaders } from '@/shared/auth';

console.log('[商品助手] Service Worker 已启动');

// ---- 动态注入 Content Scripts ----

const CONTENT_SCRIPTS: Array<{ matches: string[]; js: string }> = [
  { matches: ['https://detail.1688.com/offer/*'], js: 'content-1688.js' },
  { matches: ['https://item.taobao.com/item.htm*'], js: 'content-taobao.js' },
  { matches: ['https://s.waisongbang.com/*'], js: 'content-jieshun.js' },
];

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading' || !tab.url) return;

  for (const script of CONTENT_SCRIPTS) {
    for (const pattern of script.matches) {
      if (matchUrl(tab.url, pattern)) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          world: 'ISOLATED',
          func: (jsFile: string) => {
            import(chrome.runtime.getURL(jsFile));
          },
          args: [script.js],
        }).catch((err) => {
          console.warn('[商品助手] 注入脚本失败:', script.js, err.message);
        });
        break;
      }
    }
  }
});

/** 简单的 URL glob 匹配 */
function matchUrl(url: string, pattern: string): boolean {
  const regex = new RegExp(
    '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '\\?') + '$'
  );
  return regex.test(url);
}

// ---- 消息路由 ----

let loginResolve: ((v: boolean) => void) | null = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msgType = message.type as string;

  if (msgType === 'LOGIN_SUCCESS' && loginResolve) {
    loginResolve(true);
    loginResolve = null;
    return false;
  }

  if (msgType === 'SHOW_LOGIN_DIALOG') {
    handleLoginFlow().then((success) => sendResponse({ success }));
    return true;
  }

  if (msgType === 'SHOW_CAPTCHA_FLOW') {
    handleCaptchaFlow().then((success) => sendResponse({ success }));
    return true;
  }

  if (msgType === 'STORAGE_GET') {
    const keys = message.keys as string[];
    chrome.storage.local.get(keys).then((result) => sendResponse(result));
    return true;
  }

  if (msgType === 'FETCH_BLOB') {
    handleFetchBlob(message.url as string).then((result) => sendResponse(result));
    return true;
  }

  if (msgType === 'API_REQUEST') {
    handleApiRequest(message.payload).then((result) => sendResponse(result));
    return true;
  }

  return false;
});

// ---- 登录流程 ----

async function handleLoginFlow(): Promise<boolean> {
  chrome.action.openPopup().catch(() => {});
  return new Promise((resolve) => {
    loginResolve = resolve;
    setTimeout(() => {
      if (loginResolve === resolve) {
        loginResolve = null;
        resolve(false);
      }
    }, 120_000);
  });
}

// ---- 验证码流程 ----

async function handleCaptchaFlow(): Promise<boolean> {
  try {
    const response = await fetch(`${ADMIN_BASE_URL}${API_PATHS.CAPTCHA}`);
    const data = await response.json();
    return data.code === '200';
  } catch {
    return false;
  }
}

// ---- Blob 下载代理（绕过 CORS）----

async function handleFetchBlob(url: string): Promise<{
  ok: boolean;
  status: number;
  buffer?: number[];
  contentType?: string;
  error?: string;
}> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    }
    const arrayBuffer = await response.arrayBuffer();
    const bytes = Array.from(new Uint8Array(arrayBuffer));
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return { ok: true, status: 200, buffer: bytes, contentType };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

// ---- API 代理 ----

async function handleApiRequest(payload: {
  path: string;
  method?: string;
  body?: unknown;
}): Promise<unknown> {
  const { path, method = 'GET', body } = payload;
  try {
    const authHeaders = await getAuthHeaders();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeaders,
    };
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
