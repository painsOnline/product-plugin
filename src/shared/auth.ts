/**
 * 文件名称：auth.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 统一的认证头构建工具，使用租户隔离的存储键（tenant_code 前缀）.
 */
import { STORAGE_KEYS, scopedKey } from './constants';

/** 从 chrome.storage.local 读取 token/tenant 并构建认证头 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const raw = await chrome.storage.local.get([STORAGE_KEYS.TENANT_CODE]);
  const tenantCode = raw[STORAGE_KEYS.TENANT_CODE] as string | undefined;
  if (!tenantCode) return {};

  const tokenKey = scopedKey(tenantCode, STORAGE_KEYS.AUTH_TOKEN);
  const result = await chrome.storage.local.get([tokenKey]);
  const token = result[tokenKey] as string | undefined;

  const headers: Record<string, string> = {};
  headers['Tenant'] = tenantCode;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/** 获取当前登录用户 ID，租户隔离 */
export async function getUserId(): Promise<string> {
  const raw = await chrome.storage.local.get([STORAGE_KEYS.TENANT_CODE]);
  const tc = (raw[STORAGE_KEYS.TENANT_CODE] as string) || '';
  if (!tc) return 'anonymous';

  const tokenKey = scopedKey(tc, STORAGE_KEYS.AUTH_TOKEN);
  const tokenResult = await chrome.storage.local.get([tokenKey]);
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
