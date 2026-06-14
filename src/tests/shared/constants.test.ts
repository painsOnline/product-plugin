/**
 * 文件名称：constants.test.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 逻辑说明：shared/constants.ts 常量与工具函数单元测试.
 */
import { describe, it, expect } from 'vitest';
import {
  API_BASE_URL,
  WS_BASE_URL,
  API_PATHS,
  STORAGE_KEYS,
  WS_CONFIG,
  scopedKey,
} from '@/shared/constants';

describe('scopedKey', () => {
  it('返回租户隔离的 key', () => {
    expect(scopedKey('tenant1', 'auth_token')).toBe('tenant1:auth_token');
  });

  it('不同租户返回不同 key', () => {
    const k1 = scopedKey('t1', 'auth_token');
    const k2 = scopedKey('t2', 'auth_token');
    expect(k1).not.toBe(k2);
    expect(k1).toBe('t1:auth_token');
    expect(k2).toBe('t2:auth_token');
  });

  it('空租户码也能正常工作', () => {
    expect(scopedKey('', 'key')).toBe(':key');
  });
});

describe('API_BASE_URL', () => {
  it('是有效的 HTTP URL', () => {
    expect(API_BASE_URL.startsWith('http')).toBe(true);
    expect(API_BASE_URL.includes('://')).toBe(true);
  });
});

describe('WS_BASE_URL', () => {
  it('是有效的 WebSocket URL', () => {
    expect(WS_BASE_URL.startsWith('ws')).toBe(true);
    expect(WS_BASE_URL.includes('://')).toBe(true);
  });

  it('与 API_BASE_URL 指向相同主机', () => {
    const apiHost = API_BASE_URL.split('://')[1];
    const wsHost = WS_BASE_URL.split('://')[1];
    expect(wsHost).toBe(apiHost);
  });
});

describe('API_PATHS', () => {
  it('所有路径以 / 开头', () => {
    Object.values(API_PATHS).forEach((path) => {
      expect(path.startsWith('/')).toBe(true);
    });
  });

  it('包含必要的 API 端点', () => {
    expect(API_PATHS.LOGIN).toBe('/admin/login');
    expect(API_PATHS.CAPTCHA).toBe('/admin/captcha');
    expect(API_PATHS.PRODUCT_SAVE).toBe('/agent/product/save');
    expect(API_PATHS.PRODUCT_GET).toBe('/agent/product/get');
    expect(API_PATHS.CHAT_WS).toBe('/agent/chat');
  });
});

describe('STORAGE_KEYS', () => {
  it('所有 key 值唯一', () => {
    const values = Object.values(STORAGE_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('WS_CONFIG', () => {
  it('心跳间隔小于心跳超时', () => {
    expect(WS_CONFIG.HEARTBEAT_INTERVAL).toBeLessThan(WS_CONFIG.HEARTBEAT_TIMEOUT);
  });

  it('重连延迟是递增的', () => {
    const delays = WS_CONFIG.RECONNECT_DELAYS;
    expect(delays[0]).toBeLessThan(delays[1]);
    expect(delays[1]).toBeLessThan(delays[2]);
  });

  it('最大重连次数为正', () => {
    expect(WS_CONFIG.MAX_RECONNECT_ATTEMPTS).toBeGreaterThan(0);
  });
});
