/**
 * 文件名称：detector.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 街顺页面 DOM 检测工具，纯 DOM 检查，无副作用（SRP）。
 */
import { extract1688ProductId } from '@/shared/utils';

/** 检测是否在街顺商品编辑页 */
export function isEditPage(url: string): boolean {
  return url.includes('s.waisongbang.com') && url.includes('product_update');
}

/** 检测1688输入框是否已填写 */
export function has1688Input(): boolean {
  const input1688 = document.querySelector('.input1688 input');
  if (!input1688) return false;
  if ((input1688 as HTMLInputElement).value.trim().length === 0) return false;

  const spanElements = document.querySelectorAll('span');
  let hasProductName = false;
  spanElements.forEach((span) => {
    if (span.textContent?.trim() === '商品名称') hasProductName = true;
  });
  if (!hasProductName) return false;

  const hintSpans = document.querySelectorAll('span');
  hintSpans.forEach((span) => {
    const text = span.textContent || '';
    if (text.includes('建议命名形式为')) {
      const parentDiv = span.closest('.flexColumn, div');
      if (parentDiv) {
        const nameInput = parentDiv.querySelector('input.el-input__inner');
        if (nameInput && (nameInput as HTMLInputElement).value.trim().length > 0) {
          hasProductName = true;
        }
      }
    }
  });

  return hasProductName;
}

/** 获取1688商品ID */
export function get1688ProductId(): string | null {
  const input = document.querySelector('.input1688 input') as HTMLInputElement;
  if (!input) return null;
  const value = input.value;
  return extract1688ProductId(value) || value;
}
