/**
 * 文件名称：api.test.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 逻辑说明：content/utils/api.ts API 客户端单元测试.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetChromeStorage } from '../setup';
import { API_BASE_URL } from '@/shared/constants';

const mockFetch = vi.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

vi.mock('@/content/utils/interceptors', () => ({
  showLoginDialog: vi.fn(),
  handleCaptchaFlow: vi.fn(),
}));

import { apiRequest, apiGet, apiPost } from '@/content/utils/api';
import { showLoginDialog, handleCaptchaFlow } from '@/content/utils/interceptors';

beforeEach(() => {
  resetChromeStorage();
  mockFetch.mockReset();
  vi.mocked(showLoginDialog).mockReset();
  vi.mocked(handleCaptchaFlow).mockReset();
});

describe('apiRequest', () => {
  it('发送 GET 请求并返回数据', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: '200', msg: 'ok', result: { id: 1 } }),
    });

    const result = await apiRequest('/test', { method: 'GET', needAuth: false });
    expect(result.code).toBe('200');
    expect(result.result).toEqual({ id: 1 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('URL 拼接 API_BASE_URL', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: '200', msg: 'ok', result: null }),
    });

    await apiRequest('/agent/product/get', { method: 'GET', needAuth: false });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe(`${API_BASE_URL}/agent/product/get`);
  });

  it('发送 POST 请求并附带 JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: '200', msg: 'ok', result: null }),
    });

    await apiRequest('/test', { method: 'POST', body: { name: 'test' }, needAuth: false });

    const callArgs = mockFetch.mock.calls[0];
    const fetchOptions = callArgs[1] as RequestInit;
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.body).toBe(JSON.stringify({ name: 'test' }));
  });

  it('GET 请求不附带 body', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: '200', msg: 'ok', result: null }),
    });

    await apiRequest('/test', { method: 'GET', body: { x: 1 }, needAuth: false });

    const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(fetchOptions.body).toBeUndefined();
  });

  it('401 时触发登录弹窗并重试', async () => {
    vi.mocked(showLoginDialog).mockResolvedValueOnce(true);

    await chrome.storage.local.set({ tenant_code: 'test' });
    await chrome.storage.local.set({ 'test:auth_token': 'fake-token' });

    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ code: '401', msg: 'token过期', result: null }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ code: '200', msg: 'ok', result: {} }),
      });

    const result = await apiRequest('/test', { method: 'GET' });
    expect(showLoginDialog).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.code).toBe('200');
  });

  it('401 登录取消则不重试', async () => {
    vi.mocked(showLoginDialog).mockResolvedValueOnce(false);

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: '401', msg: 'token过期', result: null }),
    });

    const result = await apiRequest('/test', { method: 'GET' });
    expect(result.code).toBe('401');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('429 时触发验证码流程并重试', async () => {
    vi.mocked(handleCaptchaFlow).mockResolvedValueOnce(true);

    mockFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ code: '429', msg: '需要验证码', result: null }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ code: '200', msg: 'ok', result: {} }),
      });

    const result = await apiRequest('/test', { method: 'GET', needAuth: false });
    expect(handleCaptchaFlow).toHaveBeenCalledOnce();
    expect(result.code).toBe('200');
  });

  it('429 验证码失败不重试', async () => {
    vi.mocked(handleCaptchaFlow).mockResolvedValueOnce(false);

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: '429', msg: '需要验证码', result: null }),
    });

    const result = await apiRequest('/test', { method: 'GET', needAuth: false });
    expect(result.code).toBe('429');
  });

  it('needAuth=false 不添加认证头', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: '200', msg: 'ok', result: null }),
    });

    await apiRequest('/test', { method: 'GET', needAuth: false });

    const callArgs = mockFetch.mock.calls[0];
    const fetchOptions = callArgs[1] as RequestInit;
    const headers = fetchOptions.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['Tenant']).toBeUndefined();
  });

  it('默认添加 Content-Type 头', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: '200', msg: 'ok', result: null }),
    });

    await apiRequest('/test', { method: 'GET', needAuth: false });

    const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = fetchOptions.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('apiGet', () => {
  it('不使用查询参数', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: '200', msg: 'ok', result: null }),
    });

    await apiGet('/test', undefined);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe(`${API_BASE_URL}/test`);
  });

  it('带查询参数', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: '200', msg: 'ok', result: null }),
    });

    await apiGet('/test', { ext_from: '1688', ext_product_id: '123' });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('ext_from=1688');
    expect(url).toContain('ext_product_id=123');
  });
});

describe('apiPost', () => {
  it('发送 POST 请求', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ code: '200', msg: 'ok', result: { id: '1' } }),
    });

    await apiPost('/test', { name: 'product' });

    const callArgs = mockFetch.mock.calls[0];
    const fetchOptions = callArgs[1] as RequestInit;
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.body).toBe(JSON.stringify({ name: 'product' }));
  });
});
