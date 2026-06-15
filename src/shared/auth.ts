/**
 * 文件名称：auth.ts
 * 作者：shop-tool
 * 时间：2026-06-15
 * 统一的认证头构建工具，使用租户隔离的存储键（tenant_code 前缀）。
 *
 * 兼容 chrome.storage 在动态 import() 模块中不可用的场景：
 * 自动降级为 chrome.runtime.sendMessage 代理到 Service Worker 获取数据。
 */
import { STORAGE_KEYS, scopedKey } from './constants';

/** 通过 chrome.storage.local 读取数据 */
async function _storageGet(keys: string[]): Promise<Record<string, unknown>> {
  if (chrome?.storage?.local) {
    return chrome.storage.local.get(keys);
  }
  // 降级：通过消息代理到 Service Worker（兼容动态 import() 上下文）
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'STORAGE_GET', keys },
      (response) => resolve((response as Record<string, unknown>) || {})
    );
  });
}

/** 从 chrome.storage.local 读取 token/tenant 并构建认证头 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const raw = await _storageGet([STORAGE_KEYS.TENANT_CODE]);
  const tenantCode = raw[STORAGE_KEYS.TENANT_CODE] as string | undefined;
  if (!tenantCode) return {};

  const tokenKey = scopedKey(tenantCode, STORAGE_KEYS.AUTH_TOKEN);
  const result = await _storageGet([tokenKey]);
  const token = result[tokenKey] as string | undefined;

  const headers: Record<string, string> = {};
  headers['Tenant'] = tenantCode;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/** 获取当前登录用户 ID，租户隔离 */
export async function getUserId(): Promise<string> {
  const raw = await _storageGet([STORAGE_KEYS.TENANT_CODE]);
  const tc = (raw[STORAGE_KEYS.TENANT_CODE] as string) || '';
  if (!tc) return 'anonymous';

  const tokenKey = scopedKey(tc, STORAGE_KEYS.AUTH_TOKEN);
  const tokenResult = await _storageGet([tokenKey]);
  const token = tokenResult[tokenKey] as string | undefined;
  if (!token) return 'anonymous';

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      return payload.sub || 'anonymous';
    }
  } catch { /* fall through */ }
  return 'anonymous';
}
