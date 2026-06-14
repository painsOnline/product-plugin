/**
 * 文件名称：enums.test.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 逻辑说明：shared/enums.ts 枚举类型单元测试.
 */
import { describe, it, expect } from 'vitest';
import { Platform, OperateType, WSMessageType, StatusCode } from '@/shared/enums';

describe('Platform enum', () => {
  it('1688 值为 "1688"', () => {
    expect(Platform.ALIBABA_1688).toBe('1688');
  });

  it('TAOBAO 值为 "taobao"', () => {
    expect(Platform.TAOBAO).toBe('taobao');
  });
});

describe('OperateType enum', () => {
  it('包含三种操作类型', () => {
    expect(OperateType.REWRITE_TITLE).toBe('rewrite_title');
    expect(OperateType.MATCH_ATTR).toBe('match_attr');
    expect(OperateType.BOTH).toBe('both');
  });
});

describe('WSMessageType enum', () => {
  it('包含消息类型', () => {
    expect(WSMessageType.CHAT).toBe('chat');
    expect(WSMessageType.CONFIRM_REPLY).toBe('confirm_reply');
    expect(WSMessageType.STREAM).toBe('stream');
    expect(WSMessageType.FINAL).toBe('final');
    expect(WSMessageType.CONFIRM).toBe('confirm');
    expect(WSMessageType.ERROR).toBe('error');
    expect(WSMessageType.HEARTBEAT).toBe('heartbeat');
  });
});

describe('StatusCode enum', () => {
  it('包含关键状态码', () => {
    expect(StatusCode.SUCCESS).toBe('200');
    expect(StatusCode.UNAUTHORIZED).toBe('401');
    expect(StatusCode.NOT_FOUND).toBe('404');
    expect(StatusCode.SESSION_BUSY).toBe('406');
    expect(StatusCode.SESSION_CONFLICT).toBe('409');
    expect(StatusCode.RATE_LIMIT).toBe('429');
    expect(StatusCode.SERVER_ERROR).toBe('500');
  });
});
