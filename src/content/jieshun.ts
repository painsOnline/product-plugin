/**
 * 文件名称：jieshun.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 街顺商品编辑页 Content Script 入口，委托给 5 个 SRP 模块.
 *
 * 模块职责拆分：
 * - detector.ts  : DOM 检测（页面识别、1688输入框判断、ID提取）
 * - tab-guard.ts : Tab 冲突检测与清理
 * - importer.ts  : 按钮注入 + 数据导入 + DOM 填充
 * - ws-client.ts : WebSocket 连接 + 消息收发
 * - chat-ui.ts   : 对话窗口 UI 构建
 */
import { isEditPage } from './jieshun/detector';
import { injectImportButton } from './jieshun/importer';
import { checkTabConflict, installUnloadGuard } from './jieshun/tab-guard';

async function initJieshun(): Promise<void> {
  if (!isEditPage(window.location.href)) return;

  const hasConflict = await checkTabConflict();
  if (hasConflict) return;

  installUnloadGuard();

  setTimeout(() => {
    injectImportButton();
  }, 2000);
}

initJieshun();
