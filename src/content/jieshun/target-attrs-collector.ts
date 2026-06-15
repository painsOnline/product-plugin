/**
 * 文件名称：target-attrs-collector.ts
 * 作者：shop-tool
 * 时间：2026-06-15
 * 街顺商品编辑页目标属性结构采集器，扫描 dynamic-info-section 提取渠道、
 * 属性名、交互类型、可选值等元数据，供自动匹配和聊天上下文使用（SRP）。
 */
import type { TargetAttr } from '@/shared/types';

/** 从渠道图标 URL 推断渠道名称（图标在 section 的兄弟节点 .recommend-summary-row 中） */
function inferChannel(section: HTMLElement): string {
  const parent = section.parentElement;
  if (parent) {
    const imgs = parent.querySelectorAll<HTMLImageElement>('img');
    for (const img of imgs) {
      const src = img.src || '';
      if (src.includes('meituan')) return '美团';
      if (src.includes('taobaoshangou')) return '淘宝闪购';
    }
  }
  return '';
}

/** 短暂打开下拉读取选项 */
function readSelectOptions(formItem: HTMLElement): string[] {
  const options: string[] = [];
  const trigger = formItem.querySelector<HTMLElement>('.select-trigger');
  const selectInput = formItem.querySelector<HTMLInputElement>(
    '.el-select .el-input__inner'
  );
  const el = trigger || selectInput;
  if (!el) return options;

  el.click();
  // 同步读取已渲染的选项（下拉刚打开时选项可能已渲染）
  const items = document.querySelectorAll<HTMLElement>(
    '.el-select-dropdown__item:not(.is-disabled)'
  );
  for (const item of items) {
    const text = item.textContent?.trim();
    if (text) options.push(text);
  }
  // 关闭下拉
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
  );
  return options;
}

/** 判断表单项交互类型 */
function detectInteractionType(formItem: HTMLElement): string {
  // 有 el-select__tags 表示多选
  if (formItem.querySelector('.el-select__tags')) return '多选';
  // 有 el-select 但无 el-select__tags 是普通单选
  if (formItem.querySelector('.el-select')) return '单选';
  // 普通文本输入
  const input = formItem.querySelector<HTMLInputElement>('.el-input__inner');
  if (input) {
    if (input.type === 'number') return '限制性输入框';
    return '无限制输入框';
  }
  return '无限制输入框';
}

/** 提取属性名 */
function getAttrName(formItem: HTMLElement): string {
  const label = formItem.querySelector<HTMLElement>('.dynamic-info-label-text');
  return label?.textContent?.trim() || '';
}

/**
 * 扫描所有 dynamic-info-section 中的属性项，
 * 返回目标属性结构数组供自动匹配和聊天使用。
 */
export function collectTargetAttrs(): TargetAttr[] {
  const result: TargetAttr[] = [];
  const sections = document.querySelectorAll<HTMLElement>('.dynamic-info-section');

  for (const section of sections) {
    // 通过同级上方的渠道图标推断 channel
    const channel = inferChannel(section);

    const formItems = section.querySelectorAll<HTMLElement>('.el-form-item');
    for (const item of formItems) {
      const targetName = getAttrName(item);
      if (!targetName) continue;

      const interactionType = detectInteractionType(item);
      const optionalValues =
        interactionType === '单选' || interactionType === '多选'
          ? readSelectOptions(item)
          : [];

      result.push({
        channel,
        target_name: targetName,
        target_interaction_type: interactionType,
        target_optional_values: optionalValues,
        target_value_type: '字符串',
      });
    }
  }

  return result;
}
