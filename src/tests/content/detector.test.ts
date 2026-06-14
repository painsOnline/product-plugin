/**
 * 文件名称：detector.test.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 逻辑说明：content/jieshun/detector.ts 纯函数单元测试.
 */
import { describe, it, expect } from 'vitest';
import { isEditPage } from '@/content/jieshun/detector';

describe('isEditPage', () => {
  it('街顺商品编辑页返回 true', () => {
    expect(isEditPage('https://s.waisongbang.com/#/product/product_update')).toBe(true);
  });

  it('带查询参数的编辑页返回 true', () => {
    expect(isEditPage('https://s.waisongbang.com/#/product/product_update?id=1')).toBe(true);
  });

  it('街顺其他页面返回 false', () => {
    expect(isEditPage('https://s.waisongbang.com/#/product/product_list')).toBe(false);
  });

  it('非街顺页面返回 false', () => {
    expect(isEditPage('https://detail.1688.com/offer/123.html')).toBe(false);
  });

  it('仅含 waisongbang 但不含 product_update 返回 false', () => {
    expect(isEditPage('https://s.waisongbang.com/#/dashboard')).toBe(false);
  });

  it('空字符串返回 false', () => {
    expect(isEditPage('')).toBe(false);
  });
});
