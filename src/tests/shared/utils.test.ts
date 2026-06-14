/**
 * 文件名称：utils.test.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 逻辑说明：shared/utils.ts 纯函数单元测试.
 */
import { describe, it, expect } from 'vitest';
import {
  extract1688ProductId,
  extractTaobaoProductId,
  is1688Page,
  isTaobaoPage,
  isJieshunEditPage,
  parseJWT,
  isJWTExpiring,
  base64ToBytes,
} from '@/shared/utils';

describe('extract1688ProductId', () => {
  it('从 offerId 参数提取商品 ID', () => {
    const url = 'https://detail.1688.com/offer/740960285767.html?offerId=740960285767';
    expect(extract1688ProductId(url)).toBe('740960285767');
  });

  it('从路径 /offer/ 中提取商品 ID', () => {
    const url = 'https://detail.1688.com/offer/855371324217.html';
    expect(extract1688ProductId(url)).toBe('855371324217');
  });

  it('非1688 URL 返回 null', () => {
    expect(extract1688ProductId('https://www.taobao.com/item.htm?id=123')).toBeNull();
  });

  it('空字符串返回 null', () => {
    expect(extract1688ProductId('')).toBeNull();
  });
});

describe('extractTaobaoProductId', () => {
  it('从 skuId 参数提取商品 ID', () => {
    const url = 'https://item.taobao.com/item.htm?skuId=6135978566251';
    expect(extractTaobaoProductId(url)).toBe('6135978566251');
  });

  it('从 id 参数提取商品 ID（无 skuId 时）', () => {
    const url = 'https://item.taobao.com/item.htm?id=949644366265';
    expect(extractTaobaoProductId(url)).toBe('949644366265');
  });

  it('skuId 优先于 id', () => {
    const url = 'https://item.taobao.com/item.htm?id=111&skuId=222';
    expect(extractTaobaoProductId(url)).toBe('222');
  });

  it('非淘宝 URL 返回 null', () => {
    expect(extractTaobaoProductId('https://detail.1688.com/offer/123.html')).toBeNull();
  });

  it('空字符串返回 null', () => {
    expect(extractTaobaoProductId('')).toBeNull();
  });
});

describe('is1688Page', () => {
  it('标准1688商品详情页返回 true', () => {
    expect(is1688Page('https://detail.1688.com/offer/740960285767.html')).toBe(true);
  });

  it('带参数的1688页返回 true', () => {
    expect(is1688Page('https://detail.1688.com/offer/123.html?offerId=456')).toBe(true);
  });

  it('1688其他页面返回 false', () => {
    expect(is1688Page('https://www.1688.com/')).toBe(false);
  });

  it('淘宝页面返回 false', () => {
    expect(is1688Page('https://item.taobao.com/item.htm?id=123')).toBe(false);
  });
});

describe('isTaobaoPage', () => {
  it('标准淘宝商品详情页返回 true', () => {
    expect(isTaobaoPage('https://item.taobao.com/item.htm?id=123')).toBe(true);
  });

  it('带参数的淘宝页返回 true', () => {
    expect(isTaobaoPage('https://item.taobao.com/item.htm?abbucket=18&id=123')).toBe(true);
  });

  it('淘宝其他页面返回 false', () => {
    expect(isTaobaoPage('https://www.taobao.com/')).toBe(false);
  });

  it('1688页面返回 false', () => {
    expect(isTaobaoPage('https://detail.1688.com/offer/123.html')).toBe(false);
  });
});

describe('isJieshunEditPage', () => {
  it('街顺商品编辑页返回 true', () => {
    expect(isJieshunEditPage('https://s.waisongbang.com/#/product/product_update')).toBe(true);
  });

  it('街顺其他页面返回 false', () => {
    expect(isJieshunEditPage('https://s.waisongbang.com/#/product/product_list')).toBe(false);
  });

  it('非街顺页面返回 false', () => {
    expect(isJieshunEditPage('https://www.example.com/product_update')).toBe(false);
  });
});

describe('parseJWT', () => {
  // 构造一个简单 JWT: header.payload.signature
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'user-123', tenantCode: 'test', isAdmin: true }));

  it('正确解析 JWT payload', () => {
    const token = `${header}.${payload}.fake-signature`;
    const result = parseJWT(token);
    expect(result).not.toBeNull();
    expect(result!.sub).toBe('user-123');
    expect(result!.tenantCode).toBe('test');
    expect(result!.isAdmin).toBe(true);
  });

  it('错误格式的 token 返回 null', () => {
    expect(parseJWT('invalid')).toBeNull();
  });

  it('只有两部分的 token 返回 null', () => {
    expect(parseJWT('a.b')).toBeNull();
  });

  it('空字符串返回 null', () => {
    expect(parseJWT('')).toBeNull();
  });
});

describe('isJWTExpiring', () => {
  const header = btoa(JSON.stringify({ alg: 'HS256' }));

  it('token 即将过期返回 true', () => {
    const expiringPayload = btoa(JSON.stringify({
      sub: 'u1',
      exp: Math.floor(Date.now() / 1000) + 60, // 1 分钟后过期
    }));
    const token = `${header}.${expiringPayload}.sig`;
    expect(isJWTExpiring(token)).toBe(true);
  });

  it('token 远未过期返回 false', () => {
    const validPayload = btoa(JSON.stringify({
      sub: 'u1',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 小时后过期
    }));
    const token = `${header}.${validPayload}.sig`;
    expect(isJWTExpiring(token)).toBe(false);
  });

  it('无效 token 返回 true', () => {
    expect(isJWTExpiring('bad-token')).toBe(true);
  });

  it('无 exp 字段返回 true', () => {
    const noExp = btoa(JSON.stringify({ sub: 'u1' }));
    const token = `${header}.${noExp}.sig`;
    expect(isJWTExpiring(token)).toBe(true);
  });
});

describe('base64ToBytes', () => {
  it('正确解码 base64 字符串', () => {
    const input = btoa('hello');
    const result = base64ToBytes(input);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(5);
    expect(String.fromCharCode(...result)).toBe('hello');
  });

  it('空字符串解码为空数组', () => {
    const result = base64ToBytes('');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });

  it('包含特殊字符的 base64', () => {
    const input = btoa('test123');
    const result = base64ToBytes(input);
    expect(String.fromCharCode(...result)).toBe('test123');
  });
});
