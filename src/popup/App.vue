<template>
  <div class="app-container">
    <div class="header">
      <h1>商品导入助手</h1>
    </div>

    <!-- 未登录状态 -->
    <div v-if="!authStore.isLoggedIn" class="login-section">
      <h3>登录</h3>
      <div class="form-group">
        <label>租户号</label>
        <input v-model="loginForm.tenantCode" type="text" placeholder="请输入租户号" />
      </div>
      <div class="form-group">
        <label>用户名</label>
        <input v-model="loginForm.account" type="text" placeholder="请输入用户名" />
      </div>
      <div class="form-group">
        <label>密码</label>
        <input v-model="loginForm.password" type="password" placeholder="请输入密码" />
      </div>
      <!-- 验证码区域，429 时显示 -->
      <div v-if="showCaptcha" class="form-group captcha-group">
        <label>验证码</label>
        <img v-if="captchaImage" :src="'data:image/png;base64,' + captchaImage" alt="验证码" class="captcha-img" />
        <input v-model="loginForm.captchaInput" type="text" placeholder="请输入验证码" />
      </div>
      <button class="btn-primary" @click="handleLogin" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>
      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
    </div>

    <!-- 已登录状态 -->
    <div v-else class="logged-in-section">
      <div class="user-info">
        <span>已登录: {{ authStore.account }}</span>
        <span class="tenant">租户: {{ authStore.tenantCode }}</span>
      </div>
      <button class="btn-logout" @click="handleLogout">退出登录</button>

      <div class="quick-guide">
        <h3>快速指引</h3>
        <ol>
          <li>打开 <a href="https://detail.1688.com/" target="_blank">1688</a> 或 <a href="https://www.taobao.com/" target="_blank">淘宝</a> 商品详情页</li>
          <li>点击页面顶部的 <strong>"一键抓取商品数据"</strong> 按钮</li>
          <li>打开 <a href="https://s.waisongbang.com/#/product/product_update" target="_blank">街顺商品编辑页</a></li>
          <li>点击右下角的 <strong>"一键导入"</strong> 按钮</li>
        </ol>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * 文件名称：App.vue
 * 作者：shop-tool
 * 时间：2026-06-14
 * Popup 主页面，登录和状态展示
 */
import { defineComponent } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { API_PATHS } from '@/shared/constants';

export default defineComponent({
  name: 'App',
  data() {
    return {
      loginForm: {
        tenantCode: '',
        account: '',
        password: '',
        captchaToken: '',
        captchaInput: '',
      },
      showCaptcha: false,
      captchaImage: '',
      loading: false,
      errorMsg: '',
    };
  },
  computed: {
    authStore() {
      return useAuthStore();
    },
  },
  async mounted() {
    await useAuthStore().loadAuth();
  },
  methods: {
    async handleLogin() {
      this.loading = true;
      this.errorMsg = '';
      try {
        const response = await fetch(
          `https://app.xinqianmao.com${API_PATHS.LOGIN}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Tenant': this.loginForm.tenantCode,
            },
            body: JSON.stringify({
              account: this.loginForm.account,
              password: this.loginForm.password,
              captchaToken: this.loginForm.captchaToken,
              captchaInput: this.loginForm.captchaInput,
            }),
          }
        );
        const data = await response.json();
        if (data.code === '200') {
          const authStore = useAuthStore();
          await authStore.saveLogin(
            data.result.token,
            this.loginForm.tenantCode,
            data.result.account
          );
          this.showCaptcha = false;
        } else if (data.code === '429') {
          this.showCaptcha = true;
          this.errorMsg = '请输入验证码';
          const captchaRes = await fetch('https://app.xinqianmao.com/admin/captcha');
          const captchaData = await captchaRes.json();
          if (captchaData.code === '200') {
            this.captchaImage = captchaData.result.image;
            this.loginForm.captchaToken = captchaData.result.token;
          }
        } else {
          this.errorMsg = data.msg || '登录失败';
        }
      } catch (e) {
        this.errorMsg = '网络错误，请检查网络连接';
      } finally {
        this.loading = false;
      }
    },
    async handleLogout() {
      await useAuthStore().logout();
    },
});
</script>

<style scoped>
.app-container {
  padding: 16px;
}
.header {
  text-align: center;
  margin-bottom: 16px;
}
.header h1 {
  font-size: 18px;
  margin: 0;
  color: #ff6b00;
}
.login-section h3, .quick-guide h3 {
  font-size: 14px;
  margin-bottom: 12px;
}
.form-group {
  margin-bottom: 10px;
}
.form-group label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}
.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}
.btn-primary {
  width: 100%;
  padding: 10px;
  background: #ff6b00;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 8px;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-logout {
  padding: 6px 16px;
  background: #999;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 8px;
}
.error-msg {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 8px;
}
.user-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 8px 0;
}
.tenant {
  color: #999;
}
.quick-guide {
  margin-top: 16px;
  border-top: 1px solid #eee;
  padding-top: 12px;
}
.quick-guide ol {
  font-size: 12px;
  color: #666;
  padding-left: 20px;
}
.quick-guide li {
  margin-bottom: 6px;
}
</style>
