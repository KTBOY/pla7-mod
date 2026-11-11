# 组件配方 Component Recipes

SKILL.md 未覆盖组件的现成实现，直接复制即可使用。所有配方都假设 SKILL.md 中的令牌块已就位。

> Copy-paste implementations for components not covered in SKILL.md. All assume the token block from SKILL.md is present.

## 标题栏（无边框窗口）Title bar (frameless window)

用于 Electron 或任何自定义窗口边框的场景。菱形标记、中英双语标题堆叠、关闭按钮。

> For Electron or any custom-chrome window. Diamond mark, bilingual title stack, close button.

```html
<div class="titlebar">
  <span class="diamond"></span>
  <span class="tt">
    <b>共鸣终端</b>
    <i>RESONANCE TERMINAL</i>
  </span>
  <button class="close" aria-label="关闭">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
  </button>
</div>
```

```css
.titlebar {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  padding: 11px 8px 9px 16px;
  -webkit-app-region: drag;              /* 仅 Electron / Electron only */
}
.titlebar .tt { flex: 1; line-height: 1.15; }
.titlebar .tt b { font-size: 12.5px; font-weight: 600; letter-spacing: 1px; }
.titlebar .tt i {
  display: block; font-style: normal;
  font: 400 8.5px/1 var(--latin);
  letter-spacing: 2.4px; color: var(--gold-dim);
  margin-top: 2px;
}
.titlebar .close {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--cream-dim);
  transition: all .15s var(--ease);
  -webkit-app-region: no-drag;           /* 仅 Electron / Electron only */
}
.titlebar .close:hover { color: #ff6b5e; background: rgba(255,107,94,.12); }
```

Electron 注意事项：窗口要设置 `frame: false`，并设置 `backgroundColor: '#14161a'` 以避免首次绘制前的白闪。只有当面板确实需要非矩形边缘时才加 `transparent: true` —— 透明会强制逐像素桌面合成，在低端 GPU 上会真实消耗帧时间。

> Electron notes: set `frame: false` on the window, and `backgroundColor: '#14161a'` to avoid a white flash before first paint. Only add `transparent: true` if the panel actually needs non-rectangular edges — transparency forces per-pixel desktop compositing and costs real frame time on low-end GPUs.

## 页头 Page header

大号中文名称、大字距拉丁副标题、带菱形指示器的状态行。

> Large CJK name, tracked Latin subtitle, status line with a diamond indicator.

```html
<div class="head">
  <h1>穗穗</h1>
  <div class="sub">RESONATOR / ACTIVE</div>
  <div class="state"><s></s>参数即时同步 · 自动写入配置</div>
</div>
```

```css
.head { padding: 2px 2px 14px; }
.head h1 { font-size: 24px; font-weight: 700; letter-spacing: 3px; line-height: 1.2; }
.head .sub { font: 400 9px/1 var(--latin); letter-spacing: 3.4px; color: var(--gold); margin-top: 5px; }
.head .state {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--cream-dim); margin-top: 9px;
}
.head .state s {
  width: 4px; height: 4px; background: #6ee7a0;
  transform: rotate(45deg); text-decoration: none;
  box-shadow: 0 0 6px #6ee7a0;
}
```

绿色 `#6ee7a0` 是单一强调色规则唯一允许的例外，专用于运行中/已同步状态。保持 4px 大小。

> Green `#6ee7a0` is the one permitted exception to the single-accent rule, reserved for live/synced status. Keep it at 4px.

## 项选择器（头像 / 角色 / 预设网格）Item picker (avatar / character / preset grid)

横向滚动列表。选中项获得四角角标和金色边框。每个项自带自己的 `--c`。

> Horizontal scroller. Selected item gets four brackets and a gold border. Each item carries its own `--c`.

```html
<div class="picker">
  <button class="item active" style="--c:#d9b45c">
    <span class="cn"></span><span class="cn"></span><span class="cn"></span><span class="cn"></span>
    <div class="thumb"><img src="a.png" alt="穗穗"></div>
    <div class="nm">穗穗</div>
  </button>
</div>
```

```css
.picker {
  display: flex; gap: 9px; overflow-x: auto;
  padding: 6px 4px 12px; margin: -6px -4px -12px;   /* 见 SKILL.md 反模式 / see SKILL.md anti-patterns */
  scrollbar-width: none;
}
.picker::-webkit-scrollbar { display: none; }

.item {
  position: relative; flex: none;
  width: 84px; padding: 6px 6px 7px;
  background: rgba(0,0,0,.28);
  border: 1px solid rgba(255,255,255,.07);
  text-align: center; cursor: pointer;
  transition: all .2s var(--ease);
}
.item:hover { transform: translateY(-2px); border-color: rgba(201,172,103,.4); }
.item.active {
  border-color: var(--gold);
  background: rgba(201,172,103,.1);
  box-shadow: 0 0 0 1px rgba(201,172,103,.25), 0 6px 18px rgba(0,0,0,.5);
}

/* 四角角标，只在激活项上显示 / Four corner brackets, only on the active item */
.item .cn { position: absolute; width: 7px; height: 7px; border-color: var(--gold-bright); opacity: 0; transition: opacity .2s; }
.item.active .cn { opacity: 1; }
.item .cn:nth-of-type(1) { left: -1px;  top: -1px;    border-top: 1.5px solid;    border-left: 1.5px solid; }
.item .cn:nth-of-type(2) { right: -1px; top: -1px;    border-top: 1.5px solid;    border-right: 1.5px solid; }
.item .cn:nth-of-type(3) { left: -1px;  bottom: -1px; border-bottom: 1.5px solid; border-left: 1.5px solid; }
.item .cn:nth-of-type(4) { right: -1px; bottom: -1px; border-bottom: 1.5px solid; border-right: 1.5px solid; }

/* 内容底色来自 --c，底部加暗角保证标签可读 / Content tint comes from --c, with a bottom vignette so labels stay readable */
.item .thumb {
  height: 86px; overflow: hidden;
  display: flex; align-items: flex-end; justify-content: center;
  background:
    linear-gradient(180deg, transparent 60%, rgba(0,0,0,.5)),
    linear-gradient(165deg, color-mix(in srgb, var(--c, var(--theme)) 32%, #12141a), #12141a);
}
.item img { max-width: 100%; max-height: 100%; object-fit: contain; pointer-events: none; }
.item .nm {
  font-size: 11.5px; letter-spacing: .5px; margin-top: 6px;
  color: var(--cream-dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.item.active .nm { color: var(--cream); font-weight: 600; }
```

## 开关 Toggle switch

矩形，不是药丸形。关闭态是暗米色块；开启态是金色带辉光。

> Rectangular, not a pill. Off state is a dim cream block; on state is gold with bloom.

```html
<button class="switch" role="switch" aria-checked="true" aria-label="星光特效"></button>
```

```css
.switch {
  position: relative; flex: none;
  width: 44px; height: 20px;
  background: rgba(0,0,0,.45);
  border: 1px solid rgba(255,255,255,.14);
  cursor: pointer;
  transition: all .2s var(--ease);
}
.switch::after {
  content: '';
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 14px;
  background: rgba(250,250,233,.5);
  transition: transform .2s var(--ease), background .2s;
  /* 斜切拨杆。没有描边也安全：实心填色自带边缘。/ Slanted knob. Safe without an outline: a solid fill defines its own edge. */
  clip-path: polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%);
}
.switch[aria-checked="true"] {
  border-color: var(--gold);
  background: rgba(201,172,103,.2);
  box-shadow: 0 0 12px rgba(201,172,103,.3);
}
.switch[aria-checked="true"]::after {
  transform: translateX(22px);
  background: var(--gold-bright);
}
```

```js
btn.onclick = () => btn.setAttribute('aria-checked', btn.getAttribute('aria-checked') !== 'true');
```

用 `aria-checked` 而不是 class 来驱动状态——可访问性与样式共用一个来源。

> Drive state through `aria-checked` rather than a class — accessibility and styling from one source.

## 图标框 Icon frame

用于列表行的金色调方形边框，容纳内联 SVG 图标。对角两角切角。

> Square gold-tinted frame for an inline SVG icon, used in list rows. Opposite corners chamfered.

```css
.icoframe {
  width: 34px; height: 34px; flex: none;
  display: flex; align-items: center; justify-content: center;
  color: var(--gold);
  background: rgba(201,172,103,.1);
  border: 1px solid var(--gold-dim);
  /* 左上 + 右下切角。边框随盒子一起被裁剪，
     自动沿对角线描线——无需单独补描边。/ Top-left + bottom-right chamfer. The border is clipped along with the box,
     so it traces the diagonal automatically — no separate outline needed. */
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
}
```

## 带滑动指示器的分段控件 Segmented control with sliding indicator

指示器是一个独立的绝对定位元素，由 `--i` 驱动，用金色下划线而非填色药丸。

> The indicator is a separate absolutely-positioned element driven by `--i`, with a gold underline rather than a filled pill.

```html
<div class="seg">
  <span class="pill"></span>
  <button data-v="50">小</button>
  <button data-v="75">中</button>
  <button data-v="100" class="active">默认</button>
  <button data-v="130">大</button>
</div>
```

```css
.seg {
  position: relative;
  display: grid; grid-template-columns: repeat(4, 1fr);
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(0,0,0,.25);
}
.seg .pill {
  position: absolute; top: 0; bottom: 0; left: 0; width: 25%;
  background: rgba(201,172,103,.18);
  border-bottom: 1.5px solid var(--gold);
  transform: translateX(calc(var(--i, 0) * 100%));
  transition: transform .28s var(--ease), opacity .18s;
  pointer-events: none;
}
.seg button {
  position: relative;                    /* 叠在 pill 之上 / stack above the pill */
  padding: 6px 0; border: none; background: none;
  font: inherit; font-size: 12.5px; letter-spacing: 1px;
  color: var(--cream-dim); cursor: pointer;
  transition: color .18s var(--ease);
}
.seg button:hover { color: var(--cream); }
.seg button.active { color: var(--gold-bright); font-weight: 600; }
```

```js
// 当前值不匹配任何分段时，淡出指示器
// Fade the indicator out when the current value matches no segment
const i = buttons.findIndex(b => Number(b.dataset.v) === value);
pill.style.opacity = i < 0 ? '0' : '1';
if (i >= 0) pill.style.setProperty('--i', i);
```

宽度必须是 `100% / n`，且 grid 不能有 `gap`，否则 `translateX(i * 100%)` 会漂移。

> Width must be `100% / n` and the grid must have no `gap`, otherwise `translateX(i * 100%)` drifts.

## 页脚装饰 Footer ornament

```html
<div class="foot">
  <span class="dots"><i></i><i></i><i></i><i></i><i></i><i></i></span>
  ESC TO CLOSE · DRAG TO MOVE
  <span class="dots mirror"><i></i><i></i><i></i><i></i><i></i><i></i></span>
</div>
```

```css
.foot {
  display: flex; align-items: center; justify-content: center; gap: 9px;
  padding-top: 10px;
  font: 400 8.5px/1 var(--latin);
  letter-spacing: 2px; color: var(--cream-dim);
}
```

## 带节点的发丝分割线 Hairline divider with node

用于卡片内部的行间分隔。

> For separating rows inside a card.

```css
.divider {
  position: relative;
  height: 1px; margin: 12px 0;
  background: linear-gradient(90deg, transparent, var(--hair) 20%, var(--hair) 80%, transparent);
}
.divider::after {
  content: '';
  position: absolute; left: 50%; top: -2.5px;
  width: 5px; height: 5px; margin-left: -2.5px;
  background: var(--gold-dim); transform: rotate(45deg);
}
```

## 面板边缘切角（可选，谨慎使用）Panel-edge chamfer (optional, use with care)

组件级切角（图标框、开关拨杆）是安全且推荐的——见上文。本节讲的是给大面积**无边框**表面切角，这需要额外的工作。

> Component-level chamfers (icon frames, toggle knobs) are safe and encouraged — see above. This section is about cutting the corner of a large **borderless** surface, which needs extra work.

```css
.panel--chamfer {
  clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
}
/* 沿对角线的描边：长度 18√2 ≈ 25.5px，2px 粗，让 clip-path
   裁掉外侧一半，留下一条干净的 1px 边缘
   Outline along the diagonal: length 18√2 ≈ 25.5px, 2px thick so clip-path
   trims the outer half and leaves a clean 1px edge */
.chamfer-line {
  position: absolute; top: 9px; right: -3.75px;
  width: 25.5px; height: 2px;
  background: var(--gold);
  transform: rotate(45deg);
  pointer-events: none; z-index: 3;
}
```

同时把面板顶部的发丝线缩短到 `right: 18px`，让它止于切口起点。在 Electron 中，窗口需要 `transparent: true` 切口才会透出。

> Also shorten the panel's top hairline to `right: 18px` so it stops where the cut begins. In Electron the window needs `transparent: true` for the cut to show through.

## 共鸣接入按钮 Resonance link button

带阶梯投影、旋转扫光、字符替换动画和按压飞溅的 CTA 按钮。切角矩形，四态交互：默认 → hover → active → focus。

> CTA button with stepped shadow, rotating sweep, character-swap animation, and click splash. Chamfered rectangle, four states: default → hover → active → focus.

```html
<button class="rlink">
  <div class="rlink-bg"></div>
  <!-- 按压飞溅 SVG -->
  <svg class="rlink-splash" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 342 208" height="208" width="342">
    <path stroke-linecap="round" stroke-width="3" d="M54.1054 99.7837C54.1054 99.7837 40.0984 90.7874 26.6893 97.6362C13.2802 104.485 1.5 97.6362 1.5 97.6362"></path>
    <path stroke-linecap="round" stroke-width="3" d="M285.273 99.7841C285.273 99.7841 299.28 90.7879 312.689 97.6367C326.098 104.486 340.105 95.4893 340.105 95.4893"></path>
    <path stroke-linecap="round" stroke-width="3" stroke-opacity="0.3" d="M281.133 64.9917C281.133 64.9917 287.96 49.8089 302.934 48.2295C317.908 46.6501 319.712 36.5272 319.712 36.5272"></path>
    <path stroke-linecap="round" stroke-width="3" stroke-opacity="0.3" d="M281.133 138.984C281.133 138.984 287.96 154.167 302.934 155.746C317.908 157.326 319.712 167.449 319.712 167.449"></path>
    <path stroke-linecap="round" stroke-width="3" d="M230.578 57.4476C230.578 57.4476 225.785 41.5051 236.061 30.4998C246.337 19.4945 244.686 12.9998 244.686 12.9998"></path>
    <path stroke-linecap="round" stroke-width="3" d="M230.578 150.528C230.578 150.528 225.785 166.471 236.061 177.476C246.337 188.481 244.686 194.976 244.686 194.976"></path>
    <path stroke-linecap="round" stroke-width="3" stroke-opacity="0.3" d="M170.392 57.0278C170.392 57.0278 173.89 42.1322 169.571 29.54C165.252 16.9478 168.751 2.05227 168.751 2.05227"></path>
    <path stroke-linecap="round" stroke-width="3" stroke-opacity="0.3" d="M170.392 150.948C170.392 150.948 173.89 165.844 169.571 178.436C165.252 191.028 168.751 205.924 168.751 205.924"></path>
    <path stroke-linecap="round" stroke-width="3" d="M112.609 57.4476C112.609 57.4476 117.401 41.5051 107.125 30.4998C96.8492 19.4945 98.5 12.9998 98.5 12.9998"></path>
    <path stroke-linecap="round" stroke-width="3" d="M112.609 150.528C112.609 150.528 117.401 166.471 107.125 177.476C96.8492 188.481 98.5 194.976 98.5 194.976"></path>
    <path stroke-linecap="round" stroke-width="3" stroke-opacity="0.3" d="M62.2941 64.9917C62.2941 64.9917 55.4671 49.8089 40.4932 48.2295C25.5194 46.6501 23.7159 36.5272 23.7159 36.5272"></path>
    <path stroke-linecap="round" stroke-width="3" stroke-opacity="0.3" d="M62.2941 145.984C62.2941 145.984 55.4671 161.167 40.4932 162.746C25.5194 164.326 23.7159 174.449 23.7159 174.449"></path>
  </svg>
  <div class="rlink-wrap">
    <!-- focus 描边路径 -->
    <svg class="rlink-path" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 221 42" height="42" width="221">
      <path stroke-linecap="round" stroke-width="3"
        d="M182.7 2 H211 L219 10 V32 L211 40 H10 L2 32 V10 L10 2 H47.9"></path>
    </svg>
    <div class="rlink-outline"></div>
    <div class="rlink-content">
      <span class="rlink-c1">
        <span data-label="接" style="--i:1">接</span>
        <span data-label="入" style="--i:2">入</span>
        <span data-label="共" style="--i:3">共</span>
        <span data-label="鸣" style="--i:4">鸣</span>
      </span>
      <div class="rlink-arrow"><div></div></div>
      <span class="rlink-c2">
        <span data-label="已" style="--i:1">已</span>
        <span data-label="同" style="--i:2">同</span>
        <span data-label="步" style="--i:3">步</span>
      </span>
    </div>
  </div>
</button>
```

```css
.rlink {
  outline: none; cursor: pointer;
  font-size: 21px; font-family: inherit;
  background: transparent; border: 0;
  position: relative; width: 230px; height: 74px;
}
/* 四角角标 —— hover 时外扩 */
.rlink::before, .rlink::after {
  content: ''; position: absolute; z-index: 20;
  width: 9px; height: 9px;
  border-color: var(--gold); pointer-events: none;
  transition: all .3s var(--ease);
}
.rlink::before { right: -7px; top: -7px;   border-top: 1.5px solid;    border-right: 1.5px solid; }
.rlink::after  { left: 5px;   bottom: 5px; border-bottom: 1.5px solid; border-left: 1.5px solid; }
.rlink:hover::before { right: -9px; top: -9px;   border-color: var(--gold-bright); }
.rlink:hover::after  { left: 7px;   bottom: 7px; border-color: var(--gold-bright); }

/* 基座 —— 阶梯投影 */
.rlink-bg {
  position: absolute; inset: 0;
  background: #262117;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}
.rlink-bg::before {
  content: ''; position: absolute; inset: 0;
  background: transparent;
  transition: all .3s var(--ease);
  box-shadow:
    -6px 6px 0 0 rgba(201,172,103,.14),
    -12px 12px 0 0 rgba(201,172,103,.09),
    -18px 18px 0 0 rgba(201,172,103,.05),
    0 18px 40px rgba(0,0,0,.55);
}

/* 悬浮壳 —— 金色渐变描边 + 切角 */
.rlink-wrap {
  overflow: hidden; height: 100%;
  transform: translate(6px, -6px);
  padding: 1px;
  background: linear-gradient(to bottom, var(--gold), var(--gold-dim));
  position: relative;
  transition: all .3s var(--ease);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

/* 旋转扫光 */
.rlink-outline {
  position: absolute; overflow: hidden; inset: 0;
  opacity: 0; outline: none;
  transition: all .4s var(--ease);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}
.rlink-outline::before {
  content: '';
  position: absolute; inset: 2px;
  width: 110px; height: 300px; margin: auto;
  background: linear-gradient(to right, transparent 0%, var(--gold-bright) 50%, transparent 100%);
  animation: rlink-spin 3s linear infinite;
  animation-play-state: paused;
}

/* 面层 */
.rlink-content {
  pointer-events: none;
  display: flex; align-items: center; justify-content: center;
  z-index: 1; position: relative; height: 100%; gap: 14px;
  font-weight: 600; letter-spacing: 2px;
  transition: all .3s var(--ease);
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(201,172,103,.16), transparent 60%),
    linear-gradient(168deg, #23242a, #15171b 70%);
  box-shadow: inset 0 1px 0 rgba(230,207,149,.28), inset 0 -10px 18px rgba(0,0,0,.5);
  clip-path: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px);
}
.rlink-content::before {
  content: ''; inset: 0; position: absolute; z-index: 10;
  background: repeating-linear-gradient(115deg,
    rgba(255,255,255,.022) 0 1px, transparent 1px 5px);
}
.rlink-content::after {
  content: 'RESONANCE LINK';
  position: absolute; left: 0; right: 0; bottom: 5px;
  text-align: center;
  font: 400 7px/1 var(--latin); letter-spacing: 3px;
  color: var(--gold-dim);
}

/* 字符动画 */
.rlink-c1, .rlink-c2 {
  transition: all .3s var(--ease);
  display: flex; align-items: center; justify-content: center;
}
.rlink-c1 span, .rlink-c2 span { display: block; color: transparent; position: relative; }
.rlink-c1 span { animation: rlink-charIn 1.2s ease backwards calc(var(--i) * .03s); }
.rlink-c1 span::before,
.rlink-c1 span::after,
.rlink-c2 span::after {
  content: attr(data-label); position: absolute;
  color: var(--cream); text-shadow: 0 0 10px rgba(201,172,103,.35); left: 0;
}
.rlink-c1 span::before,
.rlink-c2 span::before { opacity: 0; transform: translateY(-100%); }
.rlink-c2 { position: absolute; left: 92px; }
.rlink-c2 span::after {
  opacity: 1; color: var(--gold-bright);
  text-shadow: 0 0 18px rgba(201,172,103,.45);
}

/* 箭头 */
.rlink-arrow { z-index: 10; animation: rlink-resetArrow .8s cubic-bezier(.7,-.5,.3,1.2) forwards; }
.rlink-arrow div, .rlink-arrow div::before, .rlink-arrow div::after {
  height: 2px; background-color: var(--gold-bright);
}
.rlink-arrow div::before, .rlink-arrow div::after {
  content: ''; position: absolute; right: 0;
  transform-origin: center right; width: 13px;
  transition: all .3s var(--ease);
}
.rlink-arrow div {
  position: relative; width: 24px;
  box-shadow: 0 0 8px rgba(201,172,103,.5);
  transform: scale(.9);
  background: linear-gradient(to right, var(--gold), var(--gold-bright));
  animation: rlink-swing 1s ease-in-out infinite;
  animation-play-state: paused;
}
.rlink-arrow div::before { transform: rotate(44deg); top: 1px; animation: rlink-rot1 1s linear infinite; animation-play-state: paused; }
.rlink-arrow div::after  { bottom: 1px; transform: rotate(316deg); animation: rlink-rot2 1s linear infinite; animation-play-state: paused; }

/* 描边路径 */
.rlink-path {
  position: absolute; z-index: 12; bottom: 0; left: 0; right: 0;
  stroke: var(--gold-bright); stroke-dasharray: 150 480; stroke-dashoffset: 150;
  pointer-events: none;
}
/* 飞溅 */
.rlink-splash {
  position: absolute; top: 0; left: 0; pointer-events: none;
  stroke-dasharray: 60 60; stroke-dashoffset: 60;
  transform: translate(-17%, -31%); stroke: var(--gold);
}

/* —— 状态 —— */
.rlink:hover .rlink-c1 span::before { animation: rlink-charIn .7s ease calc(var(--i) * .03s); }
.rlink:hover .rlink-c1 span::after  { opacity: 1; animation: rlink-charOut .7s ease calc(var(--i) * .03s); }
.rlink:hover .rlink-wrap { transform: translate(8px, -8px); background: linear-gradient(to bottom, var(--gold-bright), var(--gold-dim)); }
.rlink:hover .rlink-outline { opacity: 1; }
.rlink:hover .rlink-outline::before,
.rlink:hover .rlink-arrow div::before,
.rlink:hover .rlink-arrow div::after,
.rlink:hover .rlink-arrow div { animation-play-state: running; }

.rlink:active .rlink-bg::before {
  opacity: .6;
  box-shadow: -4px 4px 0 0 rgba(201,172,103,.12), -8px 8px 0 0 rgba(201,172,103,.07), 0 10px 24px rgba(0,0,0,.5);
}
.rlink:active .rlink-content { box-shadow: inset 0 10px 16px rgba(0,0,0,.55), inset 0 -1px 0 rgba(230,207,149,.2); }
.rlink:active .rlink-outline { opacity: 0; }
.rlink:active .rlink-wrap { transform: translate(3px, -3px); }
.rlink:active .rlink-splash { animation: rlink-splash .8s cubic-bezier(.3,0,0,1) forwards .05s; }

.rlink:focus .rlink-path { animation: rlink-path 1.6s ease forwards .2s; }
.rlink:focus .rlink-arrow { animation: rlink-arrow 1s cubic-bezier(.7,-.5,.3,1.5) forwards; }
.rlink-c2 span::after, .rlink:focus .rlink-c1 span { animation: rlink-charOut .5s ease forwards calc(var(--i) * .03s); }
.rlink:focus .rlink-c2 span::after { animation: rlink-charIn 1s ease backwards calc(var(--i) * .03s); }

/* 关键帧 */
@keyframes rlink-spin     { to { transform: rotate(360deg); } }
@keyframes rlink-charIn    { 0% { transform: translateY(50%); opacity: 0; filter: blur(20px); } 20% { transform: translateY(70%); opacity: 1; } 50% { transform: translateY(-15%); opacity: 1; filter: blur(0); } 100% { transform: translateY(0); opacity: 1; } }
@keyframes rlink-charOut   { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-70%); opacity: 0; filter: blur(3px); } }
@keyframes rlink-arrow     { 0% { opacity: 1; } 50% { transform: translateX(60px); opacity: 0; } 51% { transform: translateX(-190px); opacity: 0; } 100% { transform: translateX(-118px); opacity: 1; } }
@keyframes rlink-swing     { 50% { transform: translateX(5px) scale(.9); } }
@keyframes rlink-rot1      { 50% { transform: rotate(30deg); } 80% { transform: rotate(55deg); } }
@keyframes rlink-rot2      { 50% { transform: rotate(330deg); } 80% { transform: rotate(300deg); } }
@keyframes rlink-resetArrow { 0% { transform: translateX(-118px); } 100% { transform: translateX(0); } }
@keyframes rlink-path      { from { stroke: var(--cream); } to { stroke-dashoffset: -480; stroke: var(--gold-bright); } }
@keyframes rlink-splash    { to { stroke-dasharray: 2 60; stroke-dashoffset: -60; } }
```

按钮是这套语言里装饰密度最高的单品——阶梯投影、旋转扫光、字符替换、飞溅线条、描边路径五种效果叠加在一个元素上。如果场景偏安静，只保留 hover 字符替换 + focus 描边路径即可，其余效果按需裁剪。

> This button is the most ornament-dense piece in the language — five effects stacked on one element. For calmer contexts, keep only the hover character swap and focus path stroke; trim the rest as needed.

## 减少动态效果 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: .01ms !important; animation-duration: .01ms !important; }
}
```
