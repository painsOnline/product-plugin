/**
 * 文件名称：platform-switcher.ts
 * 作者：shop-tool
 * 时间：2026-06-15
 * 街顺建品方式切换器，负责修改原生 DOM：移除 1688 图标、替换文字为下拉框、
 * 管理 1688/淘宝 两种建品方式的 DOM 可见性（SRP）。
 *
 * 核心原则：街顺原有 DOM 绑定的事件不受影响，只做 show/hide 切换。
 */

/** 建品方式 */
export type BuildType = '1688' | 'taobao';

/** 平台切换器的回调 */
export interface PlatformSwitcherCallbacks {
  on1688Query: () => void;
  onTaobaoQuery: () => void;
}

let _currentType: BuildType = '1688';
let _callbacks: PlatformSwitcherCallbacks | null = null;
let _originalContainer: HTMLElement | null = null;
let _taobaoGroup: HTMLElement | null = null;
let _orig1688Input: HTMLElement | null = null;
let _origSelect1688: HTMLElement | null = null;
let _origQueryBtn: HTMLElement | null = null;
let _origResetBtn: HTMLElement | null = null;

/** 获取当前选择的建品方式 */
export function getCurrentBuildType(): BuildType {
  return _currentType;
}

/** 移除 1688 图标并替换文字为下拉选择框 */
function modifyImportBar(): void {
  const bar = document.querySelector<HTMLElement>('.bgColorFCF1E3');
  if (!bar) return;

  _originalContainer = bar;

  // 移除 1688 icon 图片
  const icon = bar.querySelector<HTMLElement>('img[alt="1688icon"]');
  if (icon) icon.remove();

  // 找到并替换 "1688建品" 文字为下拉选择框
  const spans = bar.querySelectorAll<HTMLElement>('span.font14ColorFF40');
  for (const span of spans) {
    if (span.textContent?.trim() === '1688建品') {
      span.textContent = '';
      span.style.display = 'inline-block';

      const select = document.createElement('select');
      select.id = 'product-plugin-platform-select';
      select.style.cssText = `
        font-size: 14px; color: #FF4000; border: 1px solid #FF4000;
        border-radius: 4px; padding: 4px 8px; background: #fff;
        cursor: pointer; font-weight: bold; outline: none;
      `;

      const opt1688 = document.createElement('option');
      opt1688.value = '1688';
      opt1688.textContent = '1688建品';
      select.appendChild(opt1688);

      const optTaobao = document.createElement('option');
      optTaobao.value = 'taobao';
      optTaobao.textContent = '淘宝建品';
      select.appendChild(optTaobao);

      select.addEventListener('change', () => {
        switchPlatform(select.value as BuildType);
      });

      span.appendChild(select);
      break;
    }
  }
}

/** 创建淘宝建品模式的输入区域 */
function createTaobaoInput(): HTMLElement {
  const group = document.createElement('div');
  group.id = 'product-plugin-taobao-group';
  group.style.cssText = 'display: flex; align-items: center; gap: 6px;';

  // 淘宝 SKUID 输入框，样式仿照街顺原有 input
  const wrapper = document.createElement('div');
  wrapper.className = 'el-input el-input--default el-input--suffix';
  wrapper.style.cssText = 'width: 400px;';

  const innerWrapper = document.createElement('div');
  innerWrapper.className = 'el-input__wrapper';
  innerWrapper.style.cssText = `
    padding: 1px 11px; border: 1px solid #dcdfe6; border-radius: 4px;
    background: #fff; display: flex; align-items: center;
    height: 30px; box-sizing: border-box;
  `;

  const input = document.createElement('input');
  input.id = 'product-plugin-taobao-skuid';
  input.className = 'el-input__inner';
  input.type = 'text';
  input.placeholder = '请输入淘宝商品SKUID';
  input.style.cssText = `
    flex: 1; border: none; outline: none; font-size: 14px;
    color: #606266; background: transparent; padding: 0;
  `;

  innerWrapper.appendChild(input);
  wrapper.appendChild(innerWrapper);
  group.appendChild(wrapper);

  // 查询按钮，样式仿照街顺原有
  const queryBtn = document.createElement('div');
  queryBtn.id = 'product-plugin-taobao-query-btn';
  queryBtn.className = 'paddingV6H15 font14ColorWhiteFw4 bgColorFF40 pointer borderRadiusBottomRight4';
  queryBtn.textContent = '查询 ';
  queryBtn.style.cssText = `
    padding: 6px 15px; font-size: 14px; color: #fff; font-weight: 400;
    background: #FF4000; cursor: pointer; border-radius: 0 4px 4px 0;
    user-select: none; white-space: nowrap;
  `;
  queryBtn.addEventListener('click', () => {
    if (_callbacks) _callbacks.onTaobaoQuery();
  });
  group.appendChild(queryBtn);

  // 重置按钮
  const resetBtn = document.createElement('div');
  resetBtn.id = 'product-plugin-taobao-reset-btn';
  resetBtn.className = 'paddingV6H15 font14ColorWhiteFw4 bgColor666 pointer borderRadius4 marginL5';
  resetBtn.textContent = '重置 ';
  resetBtn.style.cssText = `
    padding: 6px 15px; font-size: 14px; color: #fff; font-weight: 400;
    background: #666; cursor: pointer; border-radius: 4px; margin-left: 5px;
    user-select: none; white-space: nowrap;
  `;
  resetBtn.addEventListener('click', () => {
    input.value = '';
  });
  group.appendChild(resetBtn);

  return group;
}

/** 切换建品方式 */
function switchPlatform(type: BuildType): void {
  _currentType = type;

  if (type === '1688') {
    // 显示原有 1688 元素
    if (_orig1688Input) _orig1688Input.style.display = '';
    if (_origSelect1688) _origSelect1688.style.display = '';
    if (_origQueryBtn) _origQueryBtn.style.display = '';
    if (_origResetBtn) _origResetBtn.style.display = '';
    // 隐藏淘宝输入区域
    if (_taobaoGroup) _taobaoGroup.style.display = 'none';
  } else {
    // 隐藏原有 1688 元素
    if (_orig1688Input) _orig1688Input.style.display = 'none';
    if (_origSelect1688) _origSelect1688.style.display = 'none';
    if (_origQueryBtn) _origQueryBtn.style.display = 'none';
    if (_origResetBtn) _origResetBtn.style.display = 'none';
    // 显示淘宝输入区域
    if (_taobaoGroup) _taobaoGroup.style.display = 'flex';
  }
}

let _aiLinkInjected = false;

export function injectAiChatLink(onClick: () => void): void {
  if (_aiLinkInjected) return;
  _aiLinkInjected = true;

  // 查找 1688 或淘宝建品所在的行容器
  const link = document.createElement('span');
  link.id = 'product-plugin-ai-chat-link';
  link.textContent = '标题和属性匹配不准需要和AI对话进行微调？';
  link.style.cssText = `
    font-size: 13px; color: #409eff; cursor: pointer;
    margin-left: 16px; text-decoration: underline;
    user-select: none;
  `;
  link.addEventListener('click', onClick);

  // 将链接追加到 bar 内部
  if (_originalContainer) {
    _originalContainer.appendChild(link);
  } else {
    // fallback: 插入到页面中
    const bar = document.querySelector<HTMLElement>('.bgColorFCF1E3');
    if (bar) bar.appendChild(link);
  }
}

/**
 * 监听街顺 1688 抽屉弹窗关闭。
 * 用户点击查询后，街顺弹出右侧抽屉展示商品明细，用户选规格点确定后抽屉关闭，
 * 此时街顺完成导入，插件再进行后续自动匹配。
 */
function waitFor1688DrawerClose(): void {
  let drawerSeen = false;

  const observer = new MutationObserver(() => {
    const drawer = document.querySelector<HTMLElement>('.el-drawer.open');

    if (!drawerSeen && drawer) {
      // 抽屉首次出现，记录并继续观测
      drawerSeen = true;
      return;
    }

    if (drawerSeen && !drawer) {
      // 抽屉已关闭，延迟等待街顺数据填充后触发插件回调
      observer.disconnect();
      setTimeout(() => {
        if (_callbacks) _callbacks.on1688Query();
      }, 1000);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  // 超时保护：60s 后强制断开
  setTimeout(() => observer.disconnect(), 60000);
}

/** 初始化平台切换器，在页面加载后调用 */
export function initPlatformSwitcher(callbacks: PlatformSwitcherCallbacks): void {
  _callbacks = callbacks;

  // 等待 1688 建品行出现
  const check = (): boolean => {
    const bar = document.querySelector<HTMLElement>('.bgColorFCF1E3');
    if (!bar) return false;

    modifyImportBar();

    // 缓存原有 DOM 元素引用
    _orig1688Input = bar.querySelector<HTMLElement>('.input1688');
    _origSelect1688 = bar.querySelector<HTMLElement>('.select1688');

    const btns = bar.querySelectorAll<HTMLElement>('.paddingV6H15.pointer');
    for (const btn of btns) {
      const text = btn.textContent?.trim();
      if (text === '查询') _origQueryBtn = btn;
      if (text === '重置') _origResetBtn = btn;
    }

    // 在原有 "重置" 按钮之后插入淘宝输入区域
    if (_origResetBtn) {
      _taobaoGroup = createTaobaoInput();
      _taobaoGroup.style.display = 'none';
      _origResetBtn.insertAdjacentElement('afterend', _taobaoGroup);
    }

    // 监听原有 1688 查询按钮，等待街顺抽屉关闭后再触发插件回调
    if (_origQueryBtn) {
      _origQueryBtn.addEventListener('click', () => {
        waitFor1688DrawerClose();
      });
    }

    return true;
  };

  if (check()) return;

  // DOM 尚未渲染，等待
  const observer = new MutationObserver(() => {
    if (check()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 15000);
}

/** 获取淘宝 SKUID 输入值 */
export function getTaobaoSkuId(): string {
  const input = document.getElementById(
    'product-plugin-taobao-skuid'
  ) as HTMLInputElement;
  return input?.value?.trim() || '';
}
