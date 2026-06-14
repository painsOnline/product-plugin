/**
 * 文件名称：auth.test.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 逻辑说明：shared/auth.ts 认证工具函数单元测试.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetChromeStorage } from '../setup';
import { getAuthHeaders, getUserId } from '@/shared/auth';

beforeEach(() => {
  resetChromeStorage();
});

describe('getAuthHeaders', () => {
  it('无 tenant_code 返回空对象', async () => {
    const headers = await getAuthHeaders();
    expect(headers).toEqual({});
  });

  it('有 tenant_code 无 token 只返回 Tenant', async () => {
    await chrome.storage.local.set({ tenant_code: 'test_tenant' });
    const headers = await getAuthHeaders();
    expect(headers).toEqual({ Tenant: 'test_tenant' });
  });

  it('有 tenant_code 和 token 返回完整认证头', async () => {
    await chrome.storage.local.set({ tenant_code: 'test_tenant' });
    await chrome.storage.local.set({ 'test_tenant:auth_token': 'my-jwt-token' });
    const headers = await getAuthHeaders();
    expect(headers).toEqual({
      Tenant: 'test_tenant',
      Authorization: 'Bearer my-jwt-token',
    });
  });

  it('租户隔离：不同租户的 token 不互通', async () => {
    await chrome.storage.local.set({ tenant_code: 'tenant1' });
    await chrome.storage.local.set({ 'tenant1:auth_token': 'token1' });
    await chrome.storage.local.set({ 'tenant2:auth_token': 'token2' });

    const headers = await getAuthHeaders();
    expect(headers.Authorization).toBe('Bearer token1');
    // tenant2 的 token 不应影响
  });
});

describe('getUserId', () => {
  it('无 tenant_code 返回 anonymous', async () => {
    const userId = await getUserId();
    expect(userId).toBe('anonymous');
  });

  it('有 tenant_code 但无 token 返回 anonymous', async () => {
    await chrome.storage.local.set({ tenant_code: 'test' });
    const userId = await getUserId();
    expect(userId).toBe('anonymous');
  });

  it('有效 token 返回 sub 字段', async () => {
    // 构造 JWT
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const payload = btoa(JSON.stringify({ sub: 'user-abc-123' }));
    const token = `${header}.${payload}.sig`;

    await chrome.storage.local.set({ tenant_code: 'test' });
    await chrome.storage.local.set({ 'test:auth_token': token });

    const userId = await getUserId();
    expect(userId).toBe('user-abc-123');
  });

  it('无效 token 返回 anonymous', async () => {
    await chrome.storage.local.set({ tenant_code: 'test' });
    await chrome.storage.local.set({ 'test:auth_token': 'not-a-valid-jwt' });

    const userId = await getUserId();
    expect(userId).toBe('anonymous');
  });
});
