/**
 * 文件名称：interceptors.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * API 拦截器，处理 401 登录重试和 429 验证码流程（SRP）。
 *
 * 从 api.ts 中提取，使 apiRequest 专注于 HTTP 请求。
 */
import { API_BASE_URL, API_PATHS } from '@/shared/constants';

/** 显示登录对话框 */
export async function showLoginDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'SHOW_LOGIN_DIALOG' },
      (response) => {
        resolve(response?.success ?? false);
      }
    );
  });
}

/** 处理验证码流程 */
export async function handleCaptchaFlow(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'SHOW_CAPTCHA_FLOW' },
      (response) => {
        resolve(response?.success ?? false);
      }
    );
  });
}
