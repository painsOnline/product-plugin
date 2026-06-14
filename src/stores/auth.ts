/**
 * 文件名称：auth.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * Pinia 认证状态管理，管理登录状态、租户信息、token 存储
 */
import { defineStore } from 'pinia';
import type { AuthState } from '@/shared/types';
import { STORAGE_KEYS } from '@/shared/constants';
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
      const result = await chrome.storage.local.get([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.TENANT_CODE,
        STORAGE_KEYS.ACCOUNT,
      ]);
      const token = result[STORAGE_KEYS.AUTH_TOKEN] as string | undefined;
      if (token && !isJWTExpiring(token)) {
        this.token = token;
        this.tenantCode = (result[STORAGE_KEYS.TENANT_CODE] as string) || '';
        this.account = (result[STORAGE_KEYS.ACCOUNT] as string) || null;
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
        [STORAGE_KEYS.AUTH_TOKEN]: token,
        [STORAGE_KEYS.TENANT_CODE]: tenantCode,
        [STORAGE_KEYS.ACCOUNT]: account,
      });
    },

    /** 退出登录 */
    async logout(): Promise<void> {
      this.token = null;
      this.tenantCode = '';
      this.account = null;
      this.isLoggedIn = false;
      await chrome.storage.local.remove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.TENANT_CODE,
        STORAGE_KEYS.ACCOUNT,
      ]);
    },

    /** 获取认证头 */
    getAuthHeaders(): Record<string, string> {
      const headers: Record<string, string> = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      if (this.tenantCode) {
        headers['Tenant'] = this.tenantCode;
      }
      return headers;
    },

    /** 检查 token 是否即将过期 */
    checkTokenExpiry(): boolean {
      if (!this.token) return false;
      return isJWTExpiring(this.token);
    },
  },
});
