/**
 * 文件名称：tab-guard.test.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 逻辑说明：content/jieshun/tab-guard.ts Tab 冲突检测单元测试.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetChromeStorage } from '../setup';

beforeEach(() => {
  resetChromeStorage();
  vi.restoreAllMocks();
});

const { checkTabConflict, registerActiveThread, unregisterActiveThread } =
  await import('@/content/jieshun/tab-guard');

function setWindowUrl(url: string): void {
  Object.defineProperty(window, 'location', {
    value: { href: url },
    writable: true,
    configurable: true,
  });
}

describe('checkTabConflict', () => {
  it('非编辑页始终返回 false', async () => {
    setWindowUrl('https://www.example.com/');

    const result = await checkTabConflict('thread-1');
    expect(result).toBe(false);
  });

  it('同一 thread_id 已存在则冲突', async () => {
    setWindowUrl('https://s.waisongbang.com/#/product/product_update');

    await chrome.storage.local.set({ tenant_code: 'test' });
    await chrome.storage.local.set({ 'test:active_thread_id': 'thread-1' });

    const alertMock = vi.fn();
    window.alert = alertMock;

    const result = await checkTabConflict('thread-1');
    expect(result).toBe(true);
    expect(alertMock).toHaveBeenCalled();
  });

  it('不同 thread_id 不冲突', async () => {
    setWindowUrl('https://s.waisongbang.com/#/product/product_update');

    await chrome.storage.local.set({ tenant_code: 'test' });
    await chrome.storage.local.set({ 'test:active_thread_id': 'thread-2' });

    const result = await checkTabConflict('thread-1');
    expect(result).toBe(false);
  });

  it('无已注册 thread 时不冲突', async () => {
    setWindowUrl('https://s.waisongbang.com/#/product/product_update');

    await chrome.storage.local.set({ tenant_code: 'test' });

    const result = await checkTabConflict('thread-1');
    expect(result).toBe(false);
  });

  it('未提供 threadId 且无冲突', async () => {
    setWindowUrl('https://s.waisongbang.com/#/product/product_update');

    const result = await checkTabConflict(undefined);
    expect(result).toBe(false);
  });

  it('activeId 存在但 threadId 未提供不冲突', async () => {
    setWindowUrl('https://s.waisongbang.com/#/product/product_update');

    await chrome.storage.local.set({ tenant_code: 'test' });
    await chrome.storage.local.set({ 'test:active_thread_id': 'existing-thread' });

    const result = await checkTabConflict(undefined);
    expect(result).toBe(false);
  });
});

describe('registerActiveThread', () => {
  it('注册 thread_id 到租户隔离存储', async () => {
    await chrome.storage.local.set({ tenant_code: 'test' });
    await registerActiveThread('thread-xyz');

    const result = await chrome.storage.local.get(['test:active_thread_id']);
    expect(result['test:active_thread_id']).toBe('thread-xyz');
  });

  it('不同租户隔离注册', async () => {
    await chrome.storage.local.set({ tenant_code: 'tenant-a' });
    await registerActiveThread('thread-a');

    await chrome.storage.local.set({ tenant_code: 'tenant-b' });
    await registerActiveThread('thread-b');

    const resultA = await chrome.storage.local.get(['tenant-a:active_thread_id']);
    const resultB = await chrome.storage.local.get(['tenant-b:active_thread_id']);
    expect(resultA['tenant-a:active_thread_id']).toBe('thread-a');
    expect(resultB['tenant-b:active_thread_id']).toBe('thread-b');
  });
});

describe('unregisterActiveThread', () => {
  it('清理已注册的 thread_id', async () => {
    await chrome.storage.local.set({ tenant_code: 'test' });
    await chrome.storage.local.set({ 'test:active_thread_id': 'thread-xyz' });

    await unregisterActiveThread();

    const result = await chrome.storage.local.get(['test:active_thread_id']);
    expect(result['test:active_thread_id']).toBeUndefined();
  });

  it('无已注册 thread 时清理不报错', async () => {
    await chrome.storage.local.set({ tenant_code: 'test' });

    await expect(unregisterActiveThread()).resolves.toBeUndefined();
  });
});
