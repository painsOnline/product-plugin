<template>
  <div class="login-form">
    <h3>登录</h3>
    <div class="form-group">
      <label>租户号</label>
      <input v-model="tenantCode" type="text" placeholder="请输入租户号" />
    </div>
    <div class="form-group">
      <label>用户名</label>
      <input v-model="account" type="text" placeholder="请输入用户名" />
    </div>
    <div class="form-group">
      <label>密码</label>
      <input v-model="password" type="password" placeholder="请输入密码" />
    </div>
    <div v-if="needCaptcha" class="form-group">
      <label>验证码</label>
      <img :src="captchaImage" alt="验证码" v-if="captchaImage" />
      <input v-model="captchaInput" type="text" placeholder="请输入验证码" />
    </div>
    <button class="btn-primary" @click="handleLogin">登录</button>
    <div v-if="error" class="error-msg">{{ error }}</div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'LoginForm',
  emits: ['login-success'],
  data() {
    return {
      tenantCode: '',
      account: '',
      password: '',
      needCaptcha: false,
      captchaToken: '',
      captchaImage: '',
      captchaInput: '',
      error: '',
    };
  },
  methods: {
    async handleLogin() {
      this.error = '';
      try {
        const response = await fetch('https://app.xinqianmao.com/admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Tenant': this.tenantCode,
          },
          body: JSON.stringify({
            account: this.account,
            password: this.password,
            captchaToken: this.captchaToken,
            captchaInput: this.captchaInput,
          }),
        });
        const data = await response.json();
        if (data.code === '200') {
          this.$emit('login-success', {
            token: data.result.token,
            tenantCode: this.tenantCode,
            account: data.result.account,
          });
        } else if (data.code === '429') {
          await this.loadCaptcha();
          this.error = '请输入验证码';
        } else {
          this.error = data.msg || '登录失败';
        }
      } catch {
        this.error = '网络错误';
      }
    },
    async loadCaptcha() {
      const response = await fetch('https://app.xinqianmao.com/admin/captcha');
      const data = await response.json();
      if (data.code === '200') {
        this.captchaToken = data.result.token;
        this.captchaImage = data.result.image;
        this.needCaptcha = true;
      }
    },
  },
});
</script>
