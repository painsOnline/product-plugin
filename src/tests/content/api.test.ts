/**
 * 文件名称：api.test.ts
 * 作者：shop-tool
 * 时间：2026-06-15
 * 逻辑说明：content/utils/api.ts API 客户端单元测试（经 Service Worker 代理）.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetChromeStorage } from '../setup';

vi.mock('@/content/utils/interceptors', () => ({
  showLoginDialog: vi.fn(),
  handleCaptchaFlow: vi.fn(),
}));

import { apiRequest, apiGet, apiPost } from '@/content/utils/api';
import { showLoginDialog, handleCaptchaFlow } from '@/content/utils/interceptors';

/** mock sendMessage 快捷方法 */
function mockSendMessage(response: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(((...args: any[]) => {
    // sendMessage(extensionId?, message, options?, callback)
    // Find the callback - it's the last function argument
    for (let i = args.length - 1; i >= 0; i--) {
      if (typeof args[i] === 'function') {
        args[i](response);
        break;
      }
    }
    return true;
  }) as unknown as typeof chrome.runtime.sendMessage);
}

/** 获取 sendMessage 调用参数 */
function getSendMessagePayload(callIndex: number): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls = (chrome.runtime.sendMessage as any).mock.calls;
  const args = calls[callIndex] as unknown[];
  // sendMessage(extensionId?, message, options?, callback)
  // message is always the first non-string, non-function, non-undefined object
  for (const arg of args) {
    if (arg && typeof arg === 'object' && 'type' in (arg as object)) {
      return arg as Record<string, unknown>;
    }
  }
  return {};
}

beforeEach(() => {
  resetChromeStorage();
  vi.mocked(showLoginDialog).mockReset();
  vi.mocked(handleCaptchaFlow).mockReset();
});

describe('apiRequest', () => {
  it('发送 GET 请求并返回数据（经 SW 代理）', async () => {
    mockSendMessage({ code: '200', msg: 'ok', result: { id: 1 } });

    const result = await apiRequest('/test', { method: 'GET' });
    expect(result.code).toBe('200');
    expect(result.result).toEqual({ id: 1 });
  });

  it('发送 POST 请求并附带 JSON body（经 SW 代理）', async () => {
    mockSendMessage({ code: '200', msg: 'ok', result: null });

    await apiRequest('/test', { method: 'POST', body: { name: 'test' } });

    const msg = getSendMessagePayload(0);
    expect(msg.type).toBe('API_REQUEST');
    expect(msg.payload).toEqual({
      path: '/test', method: 'POST', body: { name: 'test' },
    });
  });

  it('GET 请求不附带 body', async () => {
    mockSendMessage({ code: '200', msg: 'ok', result: null });

    await apiRequest('/test', { method: 'GET', body: { x: 1 } });

    const msg = getSendMessagePayload(0);
    expect((msg.payload as Record<string, unknown>).body).toBeUndefined();
  });

  it('401 时触发登录弹窗并重试', async () => {
    vi.mocked(showLoginDialog).mockResolvedValueOnce(true);

    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(((...args: any[]) => {
      const cb = args.find((a: unknown) => typeof a === 'function') as (r: unknown) => void;
      callCount++;
      if (callCount === 1) {
        cb?.({ code: '401', msg: 'token过期', result: null });
      } else {
        cb?.({ code: '200', msg: 'ok', result: {} });
      }
      return true;
    }) as unknown as typeof chrome.runtime.sendMessage);

    const result = await apiRequest('/test', { method: 'GET' });
    expect(showLoginDialog).toHaveBeenCalledOnce();
    expect(result.code).toBe('200');
  });

  it('401 登录取消则不重试', async () => {
    vi.mocked(showLoginDialog).mockResolvedValueOnce(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(((...args: any[]) => {
      const cb = args.find((a: unknown) => typeof a === 'function') as (r: unknown) => void;
      cb?.({ code: '401', msg: 'token过期', result: null });
      return true;
    }) as unknown as typeof chrome.runtime.sendMessage);

    const result = await apiRequest('/test', { method: 'GET' });
    expect(result.code).toBe('401');
  });

  it('429 时触发验证码流程并重试', async () => {
    vi.mocked(handleCaptchaFlow).mockResolvedValueOnce(true);

    let callCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(((...args: any[]) => {
      const cb = args.find((a: unknown) => typeof a === 'function') as (r: unknown) => void;
      callCount++;
      if (callCount === 1) {
        cb?.({ code: '429', msg: '需要验证码', result: null });
      } else {
        cb?.({ code: '200', msg: 'ok', result: {} });
      }
      return true;
    }) as unknown as typeof chrome.runtime.sendMessage);

    const result = await apiRequest('/test', { method: 'GET' });
    expect(handleCaptchaFlow).toHaveBeenCalledOnce();
    expect(result.code).toBe('200');
  });

  it('429 验证码失败不重试', async () => {
    vi.mocked(handleCaptchaFlow).mockResolvedValueOnce(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(((...args: any[]) => {
      const cb = args.find((a: unknown) => typeof a === 'function') as (r: unknown) => void;
      cb?.({ code: '429', msg: '需要验证码', result: null });
      return true;
    }) as unknown as typeof chrome.runtime.sendMessage);

    const result = await apiRequest('/test', { method: 'GET' });
    expect(result.code).toBe('429');
  });
});

describe('apiGet', () => {
  it('不带查询参数', async () => {
    mockSendMessage({ code: '200', msg: 'ok', result: null });

    await apiGet('/test', undefined);
    const msg = getSendMessagePayload(0);
    expect((msg.payload as Record<string, unknown>).path).toBe('/test');
  });

  it('带查询参数', async () => {
    mockSendMessage({ code: '200', msg: 'ok', result: null });

    await apiGet('/test', { ext_from: '1688', ext_product_id: '123' });
    const msg = getSendMessagePayload(0);
    const path = (msg.payload as Record<string, unknown>).path as string;
    expect(path).toContain('ext_from=1688');
    expect(path).toContain('ext_product_id=123');
  });
});

describe('apiPost', () => {
  it('发送 POST 请求', async () => {
    mockSendMessage({ code: '200', msg: 'ok', result: { id: '1' } });

    await apiPost('/test', { name: 'product' });

    const msg = getSendMessagePayload(0);
    expect((msg.payload as Record<string, unknown>).method).toBe('POST');
    expect((msg.payload as Record<string, unknown>).body).toEqual({ name: 'product' });
  });
});
