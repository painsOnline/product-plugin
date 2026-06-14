<template>
  <div class="chat-dialog">
    <div class="chat-messages" ref="messageArea">
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['chat-message', `chat-${msg.role}`]"
      >
        {{ msg.content }}
      </div>
    </div>
    <div class="chat-input-area">
      <input
        v-model="inputText"
        type="text"
        placeholder="请输入您的要求..."
        @keydown.enter="sendMessage"
      />
      <button @click="sendMessage" :disabled="!inputText.trim()">发送</button>
    </div>
    <!-- HITL 确认按钮 -->
    <div v-if="showConfirm" class="confirm-area">
      <button class="btn-confirm" @click="replyConfirm(true)">确认修改</button>
      <button class="btn-cancel" @click="replyConfirm(false)">放弃修改</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { WS_BASE_URL, WS_CONFIG } from '@/shared/constants';
import { parseJWT } from '@/shared/utils';

interface ChatMsg {
  role: string;
  content: string;
}

export default defineComponent({
  name: 'ChatDialog',
  props: {
    threadId: { type: String, default: '' },
    productTitle: { type: String, default: '' },
    productAttrs: { type: Object as () => Record<string, string>, default: () => ({}) },
  },
  data() {
    return {
      messages: [] as ChatMsg[],
      inputText: '',
      ws: null as WebSocket | null,
      reconnectAttempts: 0,
      heartbeatTimer: null as ReturnType<typeof setTimeout> | null,
      showConfirm: false,
      pendingConfirmData: null as Record<string, unknown> | null,
    };
  },
  async mounted() {
    if (this.productTitle) {
      this.messages.push({
        role: 'assistant',
        content: '您好！我已准备好帮助您优化商品标题和匹配属性。请告诉我您的要求。',
      });
    }
  },
  beforeUnmount() {
    this.clearHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  },
  methods: {
    /** 从 JWT 获取 user_id */
    async getUserId(): Promise<string> {
      const result = await chrome.storage.local.get(['auth_token']);
      if (!result.auth_token) return '';
      const payload = parseJWT(result.auth_token as string);
      return (payload?.sub as string) || '';
    },

    /** 重置心跳计时器 */
    resetHeartbeat() {
      this.clearHeartbeat();
      this.heartbeatTimer = setTimeout(() => {
        this.messages.push({ role: 'system', content: '心跳超时，连接已断开' });
        this.ws?.close();
      }, WS_CONFIG.HEARTBEAT_TIMEOUT);
    },

    clearHeartbeat() {
      if (this.heartbeatTimer) {
        clearTimeout(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }
    },

    sendMessage() {
      const content = this.inputText.trim();
      if (!content) return;

      this.messages.push({ role: 'user', content });
      this.inputText = '';

      if (!this.threadId) {
        this.messages.push({
          role: 'assistant',
          content: '请先导入商品数据后再使用对话功能。',
        });
        return;
      }

      this.connectWS(content);
    },

    connectWS(userContent: string) {
      this.reconnectAttempts = 0;
      this._doConnect(userContent);
    },

    async _doConnect(userContent: string) {
      if (this.ws) {
        this.ws.close();
      }

      const userId = await this.getUserId();
      const wsUrl = `${WS_BASE_URL}/agent/chat`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.resetHeartbeat();
        const msg = {
          type: 'chat',
          msg_id: crypto.randomUUID(),
          thread_id: this.threadId,
          import_product_id: '',
          user_id: userId,
          user_content: userContent,
          operate_type: 'both',
          origin_title: this.productTitle,
          origin_attrs: Object.entries(this.productAttrs).map(([k, v]) => ({
            source_name: k,
            source_value: v,
          })),
        };
        this.ws?.send(JSON.stringify(msg));
      };

      this.ws.onmessage = (event) => {
        this.resetHeartbeat();
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'heartbeat') {
            return;
          }
          if (data.type === 'stream') {
            this.messages.push({ role: 'assistant', content: data.content });
          } else if (data.type === 'final') {
            this.messages.push({
              role: 'assistant',
              content: `推荐标题: ${data.data.new_title}\n属性映射: ${data.data.attr_mapping?.length || 0} 条`,
            });
          } else if (data.type === 'confirm') {
            this.showConfirm = true;
            this.pendingConfirmData = data;
            this.messages.push({
              role: 'system',
              content: data.content || '是否应用本次修改？',
            });
          } else if (data.type === 'error') {
            this.messages.push({ role: 'system', content: `错误: ${data.msg}` });
          }
        } catch {
          /* ignore parse errors */
        }
      };

      this.ws.onclose = () => {
        this.clearHeartbeat();
        if (this.reconnectAttempts < WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
          const delay = WS_CONFIG.RECONNECT_DELAYS[this.reconnectAttempts] || 8000;
          setTimeout(() => {
            this.reconnectAttempts++;
            this._doConnect(userContent);
          }, delay);
        } else {
          this.messages.push({
            role: 'system',
            content: '连接失败，请刷新重试',
          });
          alert('连接失败，请刷新重试');
        }
      };

      this.ws.onerror = () => {
        /* onclose will handle reconnect */
      };
    },

    /** 发送 confirm_reply */
    replyConfirm(confirmed: boolean) {
      this.showConfirm = false;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const msg = {
        type: 'confirm_reply',
        msg_id: crypto.randomUUID(),
        thread_id: this.threadId,
        import_product_id: this.pendingConfirmData?.import_product_id || '',
        user_id: '',
        operate_result: confirmed ? 'confirm' : 'cancel',
        payload: this.pendingConfirmData?.data || {},
      };
      this.ws.send(JSON.stringify(msg));
      this.pendingConfirmData = null;

      if (confirmed) {
        this.messages.push({ role: 'system', content: '已确认修改' });
      } else {
        this.messages.push({ role: 'system', content: '已取消修改' });
      }
    },
  },
});
</script>

<style scoped>
.chat-messages {
  height: 300px; overflow-y: auto; border: 1px solid #eee;
  border-radius: 4px; padding: 12px; margin-bottom: 12px;
  background: #fafafa; font-size: 13px;
}
.chat-message { margin-bottom: 8px; padding: 6px 10px; border-radius: 6px; max-width: 80%; }
.chat-user { background: #e3f2fd; margin-left: auto; }
.chat-assistant { background: #e8f5e9; }
.chat-system { background: #fff3e0; text-align: center; width: 100%; max-width: 100%; }
.chat-input-area { display: flex; gap: 8px; margin-bottom: 8px; }
.chat-input-area input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; }
.chat-input-area button { padding: 8px 16px; background: #409eff; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
.chat-input-area button:disabled { opacity: 0.6; cursor: not-allowed; }
.confirm-area { display: flex; gap: 8px; justify-content: center; padding: 8px; }
.btn-confirm { padding: 8px 20px; background: #67c23a; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
.btn-cancel { padding: 8px 20px; background: #f56c6c; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
</style>
