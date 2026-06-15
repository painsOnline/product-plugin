/**
 * 文件名称：constants.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 全局常量定义
 */

const IS_DEV = import.meta.env.MODE !== 'production';

/** API 基础地址 */
export const API_BASE_URL = IS_DEV
  ? 'http://localhost:8083'
  : 'https://app.xinqianmao.com';

/** Admin 系统基础地址（登录、验证码等） */
export const ADMIN_BASE_URL = IS_DEV
  ? 'http://localhost:8081'
  : 'https://app.xinqianmao.com';

/** WebSocket 基础地址 */
export const WS_BASE_URL = IS_DEV
  ? 'ws://localhost:8083'
  : 'wss://app.xinqianmao.com';

/** 源平台 URL 匹配模式 */
export const SOURCE_PLATFORM_URLS = {
  '1688': 'detail.1688.com/offer/',
  taobao: 'item.taobao.com/item.htm',
} as const;

/** 目标站点 URL 匹配模式 */
export const TARGET_SITE_URLS = {
  jieshun: 's.waisongbang.com',
} as const;

/** @deprecated Use SOURCE_PLATFORM_URLS + TARGET_SITE_URLS */
export const PLATFORM_URLS = {
  ...SOURCE_PLATFORM_URLS,
  ...TARGET_SITE_URLS,
} as const;

/** API 路径 */
export const API_PATHS = {
  LOGIN: '/admin/login',
  CAPTCHA: '/admin/captcha',
  PRODUCT_SAVE: '/agent/product/save',
  PRODUCT_GET: '/agent/product/get',
  PRODUCT_AUTO_MATCH: '/agent/product/auto-match',
  CHAT_WS: '/agent/chat',
  CHAT_HISTORY: '/agent/chat/history',
} as const;

/** Chrome Storage Keys */
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  TENANT_CODE: 'tenant_code',
  ACCOUNT: 'account',
  ACTIVE_THREAD_ID: 'active_thread_id',
} as const;

/** 租户隔离的 storage key */
export function scopedKey(tenantCode: string, key: string): string {
  return `${tenantCode}:${key}`;
}

/** WebSocket 配置 */
export const WS_CONFIG = {
  HEARTBEAT_INTERVAL: 20000,
  HEARTBEAT_TIMEOUT: 35000,
  RECONNECT_DELAYS: [2000, 4000, 8000],
  MAX_RECONNECT_ATTEMPTS: 5,
} as const;
