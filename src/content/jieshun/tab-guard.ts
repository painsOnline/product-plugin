/**
 * 文件名称：tab-guard.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * Tab 冲突检测，防止同一商品多标签页操作，使用租户隔离存储键（SRP）.
 */
import { STORAGE_KEYS, scopedKey } from '@/shared/constants';

/** 兼容 chrome.storage 在动态 import() 中不可用的降级读取 */
function storageGet(keys: string[]): Promise<Record<string, unknown>> {
  if (chrome?.storage?.local) {
    return chrome.storage.local.get(keys);
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'STORAGE_GET', keys },
      (response) => resolve((response as Record<string, unknown>) || {})
    );
  });
}

async function getActiveThreadKey(): Promise<string> {
  const raw = await storageGet([STORAGE_KEYS.TENANT_CODE]);
  const tc = (raw[STORAGE_KEYS.TENANT_CODE] as string) || '';
  return scopedKey(tc, STORAGE_KEYS.ACTIVE_THREAD_ID);
}

/** 检测当前标签页是否与其他标签页冲突 */
export async function checkTabConflict(threadId?: string): Promise<boolean> {
  const currentUrl = window.location.href;
  if (!currentUrl.includes('product_update')) return false;

  const key = await getActiveThreadKey();
  const result = await storageGet([key]);
  const activeId = result[key] as string | undefined;
  if (activeId && threadId && activeId === threadId) {
    alert('您已在其他页面编辑同一商品，不能多处同时上传商品。');
    return true;
  }
  return false;
}

/** 注册当前标签页的 thread_id */
export async function registerActiveThread(threadId: string): Promise<void> {
  const key = await getActiveThreadKey();
  await chrome.storage.local.set({ [key]: threadId });
}

/** 清理当前标签页的 thread_id */
export async function unregisterActiveThread(): Promise<void> {
  const key = await getActiveThreadKey();
  await chrome.storage.local.remove([key]);
}

/** 安装页面关闭/刷新时的自动清理 */
export function installUnloadGuard(): void {
  window.addEventListener('beforeunload', async () => {
    const key = await getActiveThreadKey();
    chrome.storage.local.remove([key]);
  });
}
