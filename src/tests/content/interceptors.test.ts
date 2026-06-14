/**
 * 文件名称：interceptors.test.ts
 * 作者：shop-tool
 * 时间：2026-06-14
 * 逻辑说明：content/utils/interceptors.ts 拦截器单元测试.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetChromeStorage } from '../setup';

import { showLoginDialog, handleCaptchaFlow } from '@/content/utils/interceptors';

/**
 * chrome.runtime.sendMessage 有 2-arg 和 4-arg 两个重载.
 * 我们的代码使用 2-arg 版本: sendMessage(message, callback).
 * 4-arg mock 中: (extensionId=message, message=callback, options=undefined, callback=undefined)
 * 因此实际 callback 在第二个参数位置.
 */
type SendMessageMock = (
  extensionIdOrMessage: unknown,
  messageOrCallback: unknown,
  _options?: chrome.runtime.MessageOptions | undefined,
  _callback?: (response: unknown) => void,
) => void;

function mockSendMessage(response: Record<string, unknown>): void {
  vi.mocked(chrome.runtime.sendMessage as unknown as SendMessageMock).mockImplementation(
    (extIdOrMsg, msgOrCb) => {
      // 2-arg 调用: argument 0 = message, argument 1 = callback
      if (typeof msgOrCb === 'function') {
        (msgOrCb as (r: unknown) => void)(response);
      }
    }
  );
}

beforeEach(() => {
  resetChromeStorage();
});

describe('showLoginDialog', () => {
  it('发送 SHOW_LOGIN_DIALOG 消息并成功', async () => {
    mockSendMessage({ success: true });

    const result = await showLoginDialog();
    expect(result).toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'SHOW_LOGIN_DIALOG' },
      expect.any(Function)
    );
  });

  it('登录失败返回 false', async () => {
    mockSendMessage({ success: false });

    const result = await showLoginDialog();
    expect(result).toBe(false);
  });

  it('response 无 success 字段返回 false', async () => {
    mockSendMessage({});

    const result = await showLoginDialog();
    expect(result).toBe(false);
  });
});

describe('handleCaptchaFlow', () => {
  it('发送 SHOW_CAPTCHA_FLOW 消息并成功', async () => {
    mockSendMessage({ success: true });

    const result = await handleCaptchaFlow();
    expect(result).toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'SHOW_CAPTCHA_FLOW' },
      expect.any(Function)
    );
  });

  it('验证码流程失败返回 false', async () => {
    mockSendMessage({ success: false });

    const result = await handleCaptchaFlow();
    expect(result).toBe(false);
  });

  it('response 无 success 字段返回 false', async () => {
    mockSendMessage({});

    const result = await handleCaptchaFlow();
    expect(result).toBe(false);
  });
});
