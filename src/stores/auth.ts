/**
 * 文件名称：auth.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * Pinia 认证状态管理，管理登录状态、租户信息、token 存储
 */
import { defineStore } from 'pinia';
import type { AuthState } from '@/shared/types';
import { STORAGE_KEYS, scopedKey } from '@/shared/constants';
import { isJWTExpiring, parseJWT } from '@/shared/utils';

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: null,
    tenantCode: '',
    account: null,
    isLoggedIn: false,
  }),

  actions: {
    /** 从 chrome.storage.local 加载认证信息 */
    async loadAuth(): Promise<void> {
      const raw = await chrome.storage.local.get([STORAGE_KEYS.TENANT_CODE]);
      const tenantCode = (raw[STORAGE_KEYS.TENANT_CODE] as string) || '';
      if (!tenantCode) return;

      const tokenKey = scopedKey(tenantCode, STORAGE_KEYS.AUTH_TOKEN);
      const accountKey = scopedKey(tenantCode, STORAGE_KEYS.ACCOUNT);
      const result = await chrome.storage.local.get([tokenKey, accountKey]);
      const token = result[tokenKey] as string | undefined;
      if (token && !isJWTExpiring(token)) {
        this.token = token;
        this.tenantCode = tenantCode;
        this.account = (result[accountKey] as string) || null;
        this.isLoggedIn = true;
      }
    },

    /** 保存登录信息 */
    async saveLogin(token: string, tenantCode: string, account: string): Promise<void> {
      this.token = token;
      this.tenantCode = tenantCode;
      this.account = account;
      this.isLoggedIn = true;
      await chrome.storage.local.set({
        [STORAGE_KEYS.TENANT_CODE]: tenantCode,
        [scopedKey(tenantCode, STORAGE_KEYS.AUTH_TOKEN)]: token,
        [scopedKey(tenantCode, STORAGE_KEYS.ACCOUNT)]: account,
      });
    },

    /** 退出登录 */
    async logout(): Promise<void> {
      const tc = this.tenantCode;
      this.token = null;
      this.tenantCode = '';
      this.account = null;
      this.isLoggedIn = false;
      await chrome.storage.local.remove([
        scopedKey(tc, STORAGE_KEYS.AUTH_TOKEN),
        scopedKey(tc, STORAGE_KEYS.ACCOUNT),
        STORAGE_KEYS.TENANT_CODE,
      ]);
    },

    /**
     * 获取认证头（同步，用于 Pinia 组件内）.
     *
     * 对于 content script / service worker 等无 Pinia 环境的场景，
     * 请使用 shared/auth.ts 的异步 getAuthHeaders()。
     */
    getAuthHeaders(): Record<string, string> {
      const headers: Record<string, string> = {};
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
      if (this.tenantCode) headers['Tenant'] = this.tenantCode;
      return headers;
    },

    /** 检查 token 是否即将过期 */
    checkTokenExpiry(): boolean {
      if (!this.token) return false;
      return isJWTExpiring(this.token);
    },
  },
});
