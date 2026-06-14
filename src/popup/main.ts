/**
 * 文件名称：main.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * Popup Vue3 应用入口
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');
