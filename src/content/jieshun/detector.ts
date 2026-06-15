/**
 * 文件名称：detector.ts
 * 作者：shop-tool
 * 时间：2026-06-15
 * 街顺页面 DOM 检测工具，纯检测无副作用（SRP）。
 */
import { extract1688ProductId } from '@/shared/utils';

/** 检测是否在街顺商品编辑页 */
export function isEditPage(url: string): boolean {
  return url.includes('s.waisongbang.com') && url.includes('product_update');
}

/** 检测 1688 建品行是否存在且输入框有值 */
export function has1688Input(): boolean {
  const bar = document.querySelector('.bgColorFCF1E3');
  if (!bar) return false;

  const input = bar.querySelector<HTMLInputElement>('.input1688 input');
  if (!input) return false;

  return input.value.trim().length > 0;
}

/** 获取 1688 商品 ID（从 1688 建品输入框） */
export function get1688ProductId(): string | null {
  const input = document.querySelector<HTMLInputElement>('.input1688 input');
  if (!input) return null;
  const value = input.value.trim();
  if (!value) return null;
  return extract1688ProductId(value) || value;
}

/** 检查 dynamic-info-section 是否已渲染（属性匹配的前提） */
export function hasDynamicInfoSections(): boolean {
  return document.querySelectorAll('.dynamic-info-section').length > 0;
}
