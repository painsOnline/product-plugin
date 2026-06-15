/**
 * 文件名称：jieshun.ts
 * 作者：shop-tool
 * 时间：2026-06-15
 * 街顺商品编辑页 Content Script 入口，委托给 6 个 SRP 模块.
 *
 * 模块职责拆分：
 * - platform-switcher.ts : DOM 改造（下拉切换 1688/淘宝建品）
 * - detector.ts         : DOM 检测（页面识别、输入框判断）
 * - tab-guard.ts        : Tab 冲突检测与清理
 * - importer.ts         : 查询编排（API 调用、图片上传、标题/属性填充）
 * - image-uploader.ts   : 图片上传（Blob 获取 + 注入 el-upload）
 * - attribute-matcher.ts: 属性自动填充（select/input 操作）
 * - ws-client.ts        : WebSocket 连接 + 消息收发
 * - chat-ui.ts          : 对话窗口 UI 构建
 */
import { isEditPage } from './jieshun/detector';
import { initPlatformSwitcher } from './jieshun/platform-switcher';
import { handle1688Query, handleTaobaoQuery } from './jieshun/importer';
import { checkTabConflict, installUnloadGuard } from './jieshun/tab-guard';

async function initJieshun(): Promise<void> {
  if (!isEditPage(window.location.href)) return;

  const hasConflict = await checkTabConflict();
  if (hasConflict) return;

  installUnloadGuard();

  // 初始化平台切换器（替换 1688 icon → 下拉框，挂载查询回调）
  initPlatformSwitcher({
    on1688Query: handle1688Query,
    onTaobaoQuery: handleTaobaoQuery,
  });
}

initJieshun();
