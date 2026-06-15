/**
 * 文件名称：attribute-matcher.ts
 * 作者：shop-tool
 * 时间：2026-06-15
 * 街顺商品属性自动填充工具，根据 Agent 返回的 attr_mapping 结果，
 * 操作 dynamic-info-section 中的 Element UI 组件（select/input）进行属性匹配（SRP）。
 *
 * 支持三类控件：普通 select、可搜索 select（如品牌）、文本 input。
 */

/** 属性映射条目（值改为数组，新增 channel） */
export interface AttrMapping {
  channel: string;
  target_name: string;
  target_value: string[];
  source_name: string;
  source_value: string[];
  map_note?: string;
}

/** 匹配结果（单个属性） */
export interface MatchResult {
  attrName: string;
  success: boolean;
  reason?: string;
}

/** 设置原生 input 值并触发 Vue 感知的事件 */
function setNativeInputValue(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype, 'value'
  )?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** 在 dynamic-info-section 中找到指定属性名的表单项 */
function findFormItem(attrName: string): HTMLElement | null {
  const sections = document.querySelectorAll<HTMLElement>('.dynamic-info-section');
  for (const section of sections) {
    const items = section.querySelectorAll<HTMLElement>('.el-form-item');
    for (const item of items) {
      const labelText = item.querySelector<HTMLElement>('.dynamic-info-label-text');
      if (labelText && labelText.textContent?.trim() === attrName) {
        return item;
      }
    }
  }
  return null;
}

/** 等待下拉选项出现 */
function waitForDropdownOptions(
  timeout: number = 5000
): Promise<HTMLElement[]> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = (): void => {
      const options = document.querySelectorAll<HTMLElement>(
        '.el-select-dropdown__item:not(.is-disabled)'
      );
      if (options.length > 0) {
        resolve(Array.from(options));
        return;
      }
      if (Date.now() - start > timeout) {
        resolve([]);
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

/** 关闭下拉框 */
function closeDropdown(): void {
  // 点击页面空白区域或按 Escape 关闭下拉
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

/** 通过点击 select trigger 打开下拉框 */
function openSelectDropdown(formItem: HTMLElement): boolean {
  const trigger = formItem.querySelector<HTMLElement>('.select-trigger');
  if (trigger) {
    trigger.click();
    return true;
  }
  // 尝试点击 el-select 的 input
  const selectInput = formItem.querySelector<HTMLInputElement>(
    '.el-select .el-input__inner'
  );
  if (selectInput) {
    selectInput.click();
    return true;
  }
  return false;
}

/** 匹配普通 select（单选） */
async function matchSelect(
  formItem: HTMLElement,
  targetValue: string,
): Promise<boolean> {
  if (!openSelectDropdown(formItem)) return false;

  const options = await waitForDropdownOptions();
  // 精确匹配
  for (const opt of options) {
    if (opt.textContent?.trim() === targetValue) {
      opt.click();
      return true;
    }
  }
  // 模糊匹配（包含关系）
  for (const opt of options) {
    const text = opt.textContent?.trim() || '';
    if (text.includes(targetValue) || targetValue.includes(text)) {
      opt.click();
      return true;
    }
  }
  closeDropdown();
  return false;
}

/** 匹配可搜索 select（如品牌） */
async function matchSearchableSelect(
  formItem: HTMLElement,
  targetValue: string,
): Promise<boolean> {
  // 可搜索 select 有一个额外的 input 用于输入搜索词
  const searchInput = formItem.querySelector<HTMLInputElement>(
    '.el-select__input'
  );
  if (!searchInput) return matchSelect(formItem, targetValue);

  // 先点击触发 select
  const selectWrapper = formItem.querySelector<HTMLElement>('.el-select');
  if (selectWrapper) selectWrapper.click();

  // 输入搜索关键词
  setNativeInputValue(searchInput, targetValue);
  await new Promise((r) => setTimeout(r, 800));

  // 查找匹配选项
  const options = document.querySelectorAll<HTMLElement>(
    '.el-select-dropdown__item:not(.is-disabled)'
  );
  for (const opt of options) {
    const text = opt.textContent?.trim() || '';
    if (
      text === targetValue ||
      text.includes(targetValue) ||
      targetValue.includes(text)
    ) {
      opt.click();
      return true;
    }
  }

  closeDropdown();
  return false;
}

/** 匹配文本 input */
function matchTextInput(
  formItem: HTMLElement,
  targetValue: string,
): boolean {
  const input = formItem.querySelector<HTMLInputElement>(
    '.el-input__inner[type="text"]'
  );
  if (!input) return false;

  setNativeInputValue(input, targetValue);
  return true;
}

/** 匹配多选 select */
async function matchMultiSelect(
  formItem: HTMLElement,
  targetValues: string[],
): Promise<boolean> {
  if (!openSelectDropdown(formItem)) return false;

  const options = await waitForDropdownOptions();
  let allMatched = true;

  for (const val of targetValues) {
    let found = false;
    for (const opt of options) {
      const text = opt.textContent?.trim() || '';
      if (text === val || text.includes(val) || val.includes(text)) {
        opt.click();
        found = true;
        break;
      }
    }
    if (!found) allMatched = false;
  }

  closeDropdown();
  return allMatched;
}

/** 自动检测表单项类型并填充值 */
async function fillFormItem(
  formItem: HTMLElement,
  targetValues: string[],
): Promise<boolean> {
  const targetValue = targetValues[0] || '';

  // 检测是否可搜索 select（有 .el-select__input 子 input）
  const hasSearchInput = formItem.querySelector('.el-select__input');
  if (hasSearchInput) {
    return matchSearchableSelect(formItem, targetValue);
  }

  // 检测是否多选 select（有 .el-select__tags）
  const hasMultiSelect = formItem.querySelector('.el-select__tags');
  if (hasMultiSelect) {
    return matchMultiSelect(formItem, targetValues);
  }

  // 检测是否是普通 select（有 .el-select 组件）
  const hasSelect = formItem.querySelector('.el-select');
  if (hasSelect) {
    return matchSelect(formItem, targetValue);
  }

  // 检测是否是文本输入
  const hasTextInput = formItem.querySelector('.el-input__inner[type="text"]');
  if (hasTextInput) {
    return matchTextInput(formItem, targetValue);
  }

  return false;
}

/** 批量匹配属性 */
export async function matchAttributes(
  attrMappings: AttrMapping[],
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  for (const mapping of attrMappings) {
    const formItem = findFormItem(mapping.target_name);
    if (!formItem) {
      results.push({
        attrName: mapping.target_name,
        success: false,
        reason: `属性"${mapping.target_name}"在页面中未找到`,
      });
      continue;
    }

    try {
      const ok = await fillFormItem(formItem, mapping.target_value);
      results.push({
        attrName: mapping.target_name,
        success: ok,
        reason: ok ? undefined : `无法设置"${mapping.target_name}"为"${mapping.target_value.join(', ')}"`,
      });
    } catch (e) {
      results.push({
        attrName: mapping.target_name,
        success: false,
        reason: `设置异常: ${e}`,
      });
    }

    // 属性之间的短暂间隔
    await new Promise((r) => setTimeout(r, 300));
  }

  return results;
}

/** 检查 dynamic-info-section 是否已渲染 */
export function hasDynamicInfoSections(): boolean {
  return document.querySelectorAll('.dynamic-info-section').length > 0;
}
