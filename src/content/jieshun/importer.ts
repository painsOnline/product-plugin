/**
 * 文件名称：importer.ts
 * 作者：shop-tool
 * 时间：2026-06-16
 * 街顺商品一键导入编排器，协调 platform-switcher、image-uploader、
 * attribute-matcher、chat-ui 完成自动建品流程（SRP）。
 *
 * 流程：
 * 1. 调用后端 API 获取商品数据
 * 2. 立即填充标题 + 触发 AI 自动匹配（与图片上传并行）
 * 3. 上传主图、轮播图、详情图到街顺
 * 4. AI 返回后自动应用新标题、匹配属性
 * 5. 格式化展示匹配结果（标题表格 + 属性表格 + 建议）
 * 6. 显示 AI 对话入口链接
 */
import { apiGet, apiPost } from '@/content/utils/api';
import { API_PATHS } from '@/shared/constants';
import {
  get1688ProductId,
  has1688Input,
  hasDynamicInfoSections,
} from './detector';
import { getTaobaoSkuId, injectAiChatLink } from './platform-switcher';
import { uploadAllImages } from './image-uploader';
import { matchAttributes } from './attribute-matcher';
import type { AttrMapping, MatchResult } from './attribute-matcher';
import type { TargetAttr } from '@/shared/types';
import { openChatDialogWithData } from './chat-ui';
import { getUserId } from '@/shared/auth';
import { collectTargetAttrs } from './target-attrs-collector';

/** 上次查询的商品 ID，用于判断是否需要重新上传图片 */
let _lastProductId = '';
/** 缓存的原始属性（来自 /product/get），用于匹配结果对比，值统一为数组 */
let _cachedOriginalAttrs: Record<string, string[]> = {};
export function getCachedOriginalAttrs(): Record<string, string[]> {
  return _cachedOriginalAttrs;
}

/** 填充商品名称到街顺输入框 */
export function fillProductName(name: string): void {
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input.el-input__inner[maxlength="45"]'
  );
  for (const input of inputs) {
    const el = input as HTMLInputElement;
    if (!el.readOnly) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, 'value'
      )?.set;
      setter?.call(el, name);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }
}

/** 显示 Toast 提示 */
function showToast(msg: string, type: 'info' | 'error' | 'success' = 'info'): void {
  const existing = document.getElementById('product-plugin-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'product-plugin-toast';
  const bgColor = type === 'error' ? '#f56c6c' :
    type === 'success' ? '#67c23a' : '#409eff';
  toast.style.cssText = `
    position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
    z-index: 100001; background: ${bgColor}; color: #fff; padding: 12px 24px;
    border-radius: 6px; font-size: 14px; white-space: pre-line;
    box-shadow: 0 2px 12px rgba(0,0,0,0.2); max-width: 500px; text-align: center;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/** 调用后端 API 获取商品数据 */
async function fetchProductData(
  extFrom: string,
  extProductId: string,
): Promise<Record<string, unknown> | null> {
  const result = await apiGet<Record<string, unknown>>(API_PATHS.PRODUCT_GET, {
    ext_from: extFrom,
    ext_product_id: extProductId,
  });

  if (result.code !== '200' || !result.result) {
    showToast(`商品未找到: ${result.msg || '未知错误'}`, 'error');
    return null;
  }

  return result.result;
}

/** 调用后端 API 进行 Agent 自动匹配 */
async function fetchAutoMatch(
  extFrom: string,
  extProductId: string,
  targetAttrs: TargetAttr[],
): Promise<Record<string, unknown> | null> {
  const result = await apiPost<Record<string, unknown>>(
    API_PATHS.PRODUCT_AUTO_MATCH,
    { ext_from: extFrom, ext_product_id: extProductId, target_attrs: targetAttrs }
  );

  if (result.code !== '200' || !result.result) {
    showToast(`自动匹配失败: ${result.msg || '未知错误'}`, 'error');
    return null;
  }

  return result.result;
}

/** 在重置按钮后方显示/更新 AI 匹配状态文字 */
function showAiMatchingStatus(): HTMLElement {
  hideAiMatchingStatus();
  const el = document.createElement('span');
  el.id = 'product-plugin-ai-status';
  el.textContent = 'AI 正在匹配商品数据，请稍候...';
  el.style.cssText = 'font-size: 13px; color: #E6A23C; margin-left: 12px; user-select: none;';
  const bar = document.querySelector<HTMLElement>('.bgColorFCF1E3');
  if (bar) bar.appendChild(el);
  return el;
}

function updateAiMatchingStatus(text: string, color: string = '#E6A23C'): void {
  const el = document.getElementById('product-plugin-ai-status');
  if (el) {
    el.textContent = text;
    el.style.color = color;
  }
}

function hideAiMatchingStatus(): void {
  document.getElementById('product-plugin-ai-status')?.remove();
}

// ==================== 匹配结果格式化面板 ====================

function buildTable(headers: string[], rows: string[][]): string {
  const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

export function showAutoMatchResultPanel(params: {
  originalTitle: string;
  newTitle: string;
  titleNote: string;
  originalAttrs?: Record<string, string[]>;
  attrResults?: MatchResult[];
  attrMapping?: AttrMapping[];
  suggestion?: { summary: string; items: string[] };
  warning?: { has_warn: boolean; warn_content: string };
  onOpenChat?: () => void;
}): void {
  // 移除旧面板
  const existing = document.getElementById('product-plugin-result-overlay');
  if (existing) existing.remove();

  const {
    originalTitle, newTitle, titleNote, originalAttrs,
    attrResults, attrMapping, suggestion, warning,
  } = params;

  // --- 标题部分 ---
  let titleSection = '';
  if (newTitle && newTitle !== originalTitle) {
    titleSection = `
      <div class="result-section">
        <div class="result-section-title">标题优化</div>
        ${buildTable(
          ['原标题', '修改后标题', '修改逻辑'],
          [[originalTitle, newTitle, titleNote || '—']]
        )}
      </div>`;
  }

  // --- 属性部分：两方匹配才算成功 ---
  let attrSection = '';
  if (attrMapping) {
    // 1. 语义匹配成功的 source 属性
    const matchedSourceNames = new Set(attrMapping.map((m) => m.source_name));

    // 2. DOM 应用失败的映射
    const domFailedNames = new Set(
      (attrResults ?? []).filter((r) => !r.success).map((r) => r.attrName)
    );

    // 成功：语义匹配成功 + DOM 应用成功
    const successMappings = attrMapping.filter((m) => !domFailedNames.has(m.target_name));
    // 失败：源头属性未匹配 + DOM 应用失败
    const failMappings = attrMapping.filter((m) => domFailedNames.has(m.target_name));

    // 找到原始属性中未被匹配的
    const unmatchedSources: Array<{ name: string; val: string }> = [];
    if (originalAttrs) {
      for (const key of Object.keys(originalAttrs)) {
        if (!matchedSourceNames.has(key)) {
          unmatchedSources.push({
            name: key,
            val: (originalAttrs[key] ?? []).join('、'),
          });
        }
      }
    }

    const failCount = failMappings.length + unmatchedSources.length;
    const okCount = successMappings.length;

    const failText = `<b style="color:#f56c6c;">失败 ${failCount} 个</b>`;
    const okText = `<b style="color:#67c23a;">成功 ${okCount} 个</b>`;
    const summary = `<div class="result-summary">${failText}，${okText}</div>`;

    let tables = '';

    // 失败表：源属性名 / 目标属性名 / 失败原因
    const failRows: string[][] = [];
    for (const m of failMappings) {
      const r = (attrResults ?? []).find((x) => x.attrName === m.target_name);
      failRows.push([m.source_name, m.target_name, r?.reason || '页面应用失败']);
    }
    for (const s of unmatchedSources) {
      failRows.push([s.name, s.val || '—', '未找到匹配的目标属性']);
    }
    if (failRows.length > 0) {
      tables += `
        <div class="result-sub-title" style="color:#f56c6c;">失败项</div>
        ${buildTable(['源属性名称', '源属性值/目标属性', '失败原因'], failRows)}`;
    }

    // 成功表：源属性名 / 源属性值 / 目标属性名 / 目标属性值 / 匹配逻辑
    if (successMappings.length > 0) {
      tables += `
        <div class="result-sub-title" style="color:#67c23a;">成功项</div>
        ${buildTable(
          ['源属性', '源值', '目标属性', '目标值', '匹配逻辑'],
          successMappings.map((m) => [
            m.source_name,
            (m.source_value ?? []).join('、'),
            m.target_name,
            (m.target_value ?? []).join('、'),
            m.map_note || '常规映射',
          ])
        )}`;
    }

    attrSection = `
      <div class="result-section">
        <div class="result-section-title">属性匹配</div>
        ${summary}
        ${tables}
      </div>`;
  }

  // --- 警告 ---
  let warningSection = '';
  if (warning?.has_warn && warning.warn_content) {
    warningSection = `
      <div class="result-section" style="color:#f56c6c;">
        <div class="result-section-title">⚠ 警告</div>
        <div>${warning.warn_content}</div>
      </div>`;
  }

  // --- 建议 ---
  let suggestionSection = '';
  if (suggestion?.summary || (suggestion?.items && suggestion.items.length > 0)) {
    const items = (suggestion.items ?? [])
      .map((item, i) => `<div class="result-suggestion-item">${i + 1}. ${item}</div>`)
      .join('');
    suggestionSection = `
      <div class="result-section">
        <div class="result-section-title">建议</div>
        ${suggestion.summary ? `<div class="result-suggestion-summary">${suggestion.summary}</div>` : ''}
        ${items}
      </div>`;
  }

  // --- 组装面板 ---
  const overlay = document.createElement('div');
  overlay.id = 'product-plugin-result-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    z-index: 100000; display: flex; align-items: center; justify-content: center;
  `;

  const panel = document.createElement('div');
  panel.id = 'product-plugin-result-panel';
  panel.innerHTML = `
    <style>
      #product-plugin-result-panel {
        width: 1020px; max-height: 75vh; overflow-y: auto;
        background: #fff; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,0.18);
        font-size: 13px; color: #333; line-height: 1.6;
      }
      #product-plugin-result-panel .panel-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px 20px; border-bottom: 1px solid #ebeef5;
        font-size: 16px; font-weight: 600; color: #303133;
      }
      #product-plugin-result-panel .panel-close {
        cursor: pointer; font-size: 18px; color: #909399; line-height: 1;
        background: none; border: none; padding: 0 4px;
      }
      #product-plugin-result-panel .panel-close:hover { color: #303133; }
      #product-plugin-result-panel .panel-body { padding: 16px 20px; }
      #product-plugin-result-panel .result-section { margin-bottom: 18px; }
      #product-plugin-result-panel .result-section-title {
        font-size: 14px; font-weight: 600; margin-bottom: 8px;
        color: #303133; padding-left: 8px; border-left: 3px solid #409eff;
      }
      #product-plugin-result-panel .result-summary {
        margin-bottom: 10px; font-size: 14px;
      }
      #product-plugin-result-panel .result-sub-title {
        font-size: 13px; font-weight: 600; margin: 8px 0 4px;
      }
      #product-plugin-result-panel table {
        width: 100%; border-collapse: collapse; margin-bottom: 8px;
      }
      #product-plugin-result-panel th, #product-plugin-result-panel td {
        border: 1px solid #ebeef5; padding: 7px 10px; text-align: left;
        word-break: break-all;
      }
      #product-plugin-result-panel th {
        background: #f5f7fa; font-weight: 600; white-space: nowrap;
      }
      #product-plugin-result-panel .result-suggestion-summary {
        margin-bottom: 6px;
      }
      #product-plugin-result-panel .result-suggestion-item {
        padding: 2px 0; color: #606266;
      }
    </style>
    <div class="panel-header">
      <span>AI 自动匹配结果</span>
      <button class="panel-close">&times;</button>
    </div>
    <div class="panel-body">
      ${titleSection}
      ${attrSection}
      ${warningSection}
      ${suggestionSection}
    </div>
    <div style="display:flex;gap:12px;justify-content:center;padding:0 20px 16px;">
      <button class="result-btn-confirm" style="
        padding:8px 32px;background:#409eff;color:#fff;border:none;
        border-radius:4px;cursor:pointer;font-size:14px;
      ">确认</button>
      <button class="result-btn-chat" style="
        padding:8px 32px;background:#fff;color:#409eff;border:1px solid #409eff;
        border-radius:4px;cursor:pointer;font-size:14px;
        ${params.onOpenChat ? '' : 'display:none;'}
      ">打开微调</button>
    </div>
  `;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // 关闭面板
  const closePanel = () => overlay.remove();

  // X 按钮
  panel.querySelector('.panel-close')?.addEventListener('click', closePanel);

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePanel();
  });

  // 按钮事件
  panel.querySelector('.result-btn-confirm')?.addEventListener('click', closePanel);
  panel.querySelector('.result-btn-chat')?.addEventListener('click', () => {
    closePanel();
    params.onOpenChat?.();
  });
}

// ==================== 导入执行 ====================

/** 执行 AI 自动匹配并应用结果 */
async function runAutoMatch(
  extFrom: string,
  extProductId: string,
  targetAttrs: TargetAttr[],
  productName: string,
  importProductId: string,
  threadId: string,
): Promise<void> {
  try {
    const matchResult = await fetchAutoMatch(extFrom, extProductId, targetAttrs);

    if (matchResult) {
      const newTitle = (matchResult.new_title as string) || '';
      const titleNote = (matchResult.title_note as string) || '';
      const originalTitle = (matchResult.original_title as string) || productName;
      const attrMapping = (matchResult.attr_mapping as AttrMapping[]) || [];
      const warning = matchResult.warning as { has_warn: boolean; warn_content: string } | undefined;
      const suggestion = matchResult.suggestion as { summary: string; items: string[] } | undefined;

      // 应用标题
      if (newTitle) {
        fillProductName(newTitle);
      }

      // 应用属性
      let attrResults: MatchResult[] | undefined;
      if (attrMapping.length > 0) {
        if (hasDynamicInfoSections()) {
          attrResults = await matchAttributes(attrMapping);
        } else {
          showToast('请先在页面中选择渠道类目，属性区域展示后方可自动匹配', 'error');
        }
      }

      // 格式化展示结果
      showAutoMatchResultPanel({
        originalTitle,
        newTitle,
        titleNote,
        originalAttrs: _cachedOriginalAttrs,
        attrResults,
        attrMapping,
        suggestion,
        warning,
        onOpenChat: () => {
          openChatDialogWithData(
            productName, targetAttrs, extFrom, extProductId, threadId, importProductId
          );
        },
      });

      updateAiMatchingStatus('AI 匹配完成', '#67c23a');
    }
  } catch {
    updateAiMatchingStatus('AI 匹配失败，请稍后重试', '#f56c6c');
    showToast('AI 匹配失败，请稍后重试', 'error');
  } finally {
    setTimeout(() => hideAiMatchingStatus(), 3000);
    injectAiChatLink(() => {
      openChatDialogWithData(
        productName, targetAttrs, extFrom, extProductId, threadId, importProductId
      );
    });
  }
}

/** 执行完整的导入流程 */
async function executeImport(
  extFrom: string,
  extProductId: string,
): Promise<void> {
  const productIdChanged = _lastProductId !== `${extFrom}:${extProductId}`;

  showToast(`正在获取商品数据...`, 'info');

  // 1. 获取商品数据
  const productData = await fetchProductData(extFrom, extProductId);
  if (!productData) {
    const extUrl = extFrom === '1688'
      ? 'https://detail.1688.com/'
      : 'https://www.taobao.com/';
    showToast(
      `商品未找到: ${extFrom}/${extProductId}\n请先到 ${extFrom} 上抓取此商品。`,
      'error'
    );
    return;
  }

  const productName = (productData.ext_product_name as string) || '';
  _cachedOriginalAttrs = (productData.attrs as Record<string, string[]>) || {};
  const mainPicture = (productData.main_picture as string) || '';
  const pictures = (productData.pictures as string[]) || [];
  const detailPictures = (productData.detail_pictures as string[]) || [];
  const importProductId = (productData.id as string) || '';
  const threadId = `${await getUserId()}_${extProductId}`;

  // 2. 先填原始标题（不用等 AI）
  if (productName) {
    fillProductName(productName);
  }

  // 3. 采集目标属性
  const targetAttrs = hasDynamicInfoSections() ? collectTargetAttrs() : [];

  _lastProductId = `${extFrom}:${extProductId}`;

  // 4. 立即触发 AI 自动匹配（不等图片上传）
  showAiMatchingStatus();
  const autoMatchPromise = runAutoMatch(
    extFrom, extProductId, targetAttrs, productName, importProductId, threadId
  );

  // 5. 上传图片（与 AI 匹配并行）
  if (productIdChanged && (mainPicture || pictures.length > 0)) {
    showToast('正在上传商品图片...', 'info');
    const uploadResult = await uploadAllImages(
      mainPicture, pictures, detailPictures
    );
    showToast(
      `图片上传完成\n轮播图: ${uploadResult.slideOk} 成功 / ${uploadResult.slideFail} 失败\n详情图: ${uploadResult.detailOk} 成功 / ${uploadResult.detailFail} 失败`,
      uploadResult.slideFail > 0 || uploadResult.detailFail > 0 ? 'error' : 'success'
    );
  }

  // 6. 等待 AI 匹配完成
  await autoMatchPromise;
}

/** 处理 1688 查询（由平台切换器在原有逻辑完成后触发） */
export async function handle1688Query(): Promise<void> {
  if (!has1688Input()) {
    showToast('请先在 1688 建品输入框中填写链接或 offer ID', 'info');
    return;
  }

  const productId = get1688ProductId();
  if (!productId) {
    showToast('未能从输入框中识别到 1688 商品 ID', 'error');
    return;
  }

  await executeImport('1688', productId);
}

/** 处理淘宝查询 */
export async function handleTaobaoQuery(): Promise<void> {
  const skuId = getTaobaoSkuId();
  if (!skuId) {
    showToast('请输入淘宝商品 SKUID', 'info');
    return;
  }

  if (!hasDynamicInfoSections()) {
    showToast(
      '请先在页面中选择渠道类目（美团/淘宝闪购），属性区域展示后方可自动匹配',
      'error'
    );
  }

  await executeImport('taobao', skuId);
}
