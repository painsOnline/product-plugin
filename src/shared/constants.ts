/**
 * 文件名称：constants.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 全局常量定义
 */

/** API 基础地址 */
export const API_BASE_URL = 'https://app.xinqianmao.com';

/** WebSocket 基础地址 */
export const WS_BASE_URL = 'wss://app.xinqianmao.com';

/** 平台 URL 匹配模式 */
export const PLATFORM_URLS = {
  '1688': 'detail.1688.com/offer/',
  taobao: 'item.taobao.com/item.htm',
  jieshun: 's.waisongbang.com',
} as const;

/** API 路径 */
export const API_PATHS = {
  LOGIN: '/admin/login',
  CAPTCHA: '/admin/captcha',
  PRODUCT_SAVE: '/agent/product/save',
  PRODUCT_GET: '/agent/product/get',
  CHAT_WS: '/agent/chat',
} as const;

/** Chrome Storage Keys */
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  TENANT_CODE: 'tenant_code',
  ACCOUNT: 'account',
  ACTIVE_THREAD_ID: 'active_thread_id',
} as const;

/** WebSocket 配置 */
export const WS_CONFIG = {
  HEARTBEAT_INTERVAL: 20000,
  HEARTBEAT_TIMEOUT: 35000,
  RECONNECT_DELAYS: [2000, 4000, 8000],
  MAX_RECONNECT_ATTEMPTS: 5,
} as const;
