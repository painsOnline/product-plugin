/**
 * 文件名称：setup.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * Vitest 全局初始化，Mock chrome.* API。
 */
import { vi } from 'vitest';

const storage = new Map<string, unknown>();

const chromeStorageLocal = {
  get: vi.fn((keys: string | string[] | Record<string, unknown>) => {
    const result: Record<string, unknown> = {};
    if (Array.isArray(keys)) {
      keys.forEach((k) => {
        if (storage.has(k)) result[k] = storage.get(k);
      });
    } else if (typeof keys === 'object') {
      Object.keys(keys).forEach((k) => {
        if (storage.has(k)) result[k] = storage.get(k);
        else result[k] = keys[k];
      });
    } else if (typeof keys === 'string') {
      if (storage.has(keys)) result[keys] = storage.get(keys);
    }
    return Promise.resolve(result);
  }),
  set: vi.fn((items: Record<string, unknown>) => {
    Object.entries(items).forEach(([k, v]) => storage.set(k, v));
    return Promise.resolve();
  }),
  remove: vi.fn((keys: string | string[]) => {
    const arr = Array.isArray(keys) ? keys : [keys];
    arr.forEach((k) => storage.delete(k));
    return Promise.resolve();
  }),
  clear: vi.fn(() => {
    storage.clear();
    return Promise.resolve();
  }),
};

const chromeRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

(globalThis as Record<string, unknown>).chrome = {
  storage: {
    local: chromeStorageLocal,
  },
  runtime: chromeRuntime,
};

// Helper to reset storage between tests
export function resetChromeStorage(): void {
  storage.clear();
  vi.clearAllMocks();
}
