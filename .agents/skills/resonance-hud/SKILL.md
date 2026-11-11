---
name: resonance-hud
description: 为 Web 界面应用一套深色金调的游戏 HUD 设计语言——近黑基底、单一品牌金强调色、发丝级描边、纯直角、L 形四角角标、中英双语区块标题、菱形节点与点阵括号装饰。当用户需要游戏风格 / 科技暗调 UI、设置面板、悬浮层、启动器、HUD 仪表盘、桌宠伴侣应用，或提到「鸣潮 / Wuthering Waves 风格」「游戏 HUD 风格」「深色金调」「二次元科技感」界面时使用。纯 CSS 变量 + HTML，无框架与素材依赖。
---

# Resonance HUD

一套深色金调游戏 HUD 界面的设计语言。所有装饰均由 CSS 或内联 SVG 绘制——零图片素材、零 Web 字体，任意 DPI 下都锐利。

## 适用场景

适合：设置面板、悬浮层、启动器、HUD 仪表盘、角色/道具选择器、桌面伴侣应用，一切应该像"游戏内终端"的东西。

不适合：以阅读为主的内容型界面、输入项繁多的表单、浅色主题产品、需要亲切柔和调性的场景。这套配色对比强烈，装饰元素会与密集文本抢夺注意力。

## 设计令牌

原样复制。这些值取样自已上线的产品，不是拍脑袋定的——不要"优化"这些色相。

```css
:root {
  /* 品牌色 —— 固定不变，永远不随用户或内容换肤 */
  --gold:        #c9ac67;
  --gold-bright: #e6cf95;
  --gold-dim:    rgba(201, 172, 103, .3);

  /* 文字 */
  --cream:     #fafae9;
  --cream-dim: rgba(250, 250, 233, .45);

  /* 表面 */
  --bg-0: #14161a;                       /* 最深底 */
  --bg-1: #1b1e23;                       /* 面板上部 */
  --card: rgba(255, 255, 255, .035);      /* 卡片填充 —— 半透明，不用实色 */
  --hair: rgba(201, 172, 103, .2);        /* 发丝级描边 */

  /* 强调色槽位 —— 唯一允许随内容变化的令牌 */
  --theme: #d9b45c;

  --ease:  cubic-bezier(.32,.72,.24,1);
  --latin: "Bahnschrift", "DIN Alternate", "Segoe UI", sans-serif;
}
```

`--latin` 很关键：大字距拉丁标签需要一个窄体工业感字体。`Bahnschrift` 是 Windows 10+ 自带，`DIN Alternate` 是 macOS 自带。绝不要换成人文主义无衬线体。

## 面板基底

```css
.panel {
  position: relative;
  background:
    radial-gradient(130% 80% at 100% 0%, rgba(201,172,103,.11), transparent 62%),
    linear-gradient(168deg, var(--bg-1), var(--bg-0) 62%);
  box-shadow: 0 20px 60px rgba(0,0,0,.6);
  overflow: hidden;
}
/* 斜向扫描纹理 —— 2.2% 透明度，只做质感，绝不能读出条纹感 */
.panel::before {
  content: '';
  position: absolute; inset: 0;
  background: repeating-linear-gradient(115deg,
    rgba(255,255,255,.022) 0 1px, transparent 1px 5px);
  pointer-events: none;
}
/* 顶边金色发丝光线 */
.panel::after {
  content: '';
  position: absolute; left: 0; right: 0; top: 0; height: 1px;
  background: linear-gradient(90deg, var(--gold), rgba(201,172,103,.35));
  pointer-events: none; z-index: 3;
}
```

锚定在右上角的偏心径向辉光 + 顶部发丝光线，是这套语言区别于普通暗色模式的关键。两者都要保留。

## 六个签名元素

至少用四个。六个全上也不算多——密度本身就是这个风格的一部分。

### 1. 四角角标

承重元素。每张卡片对角放 L 形金色标记。

```css
.card { position: relative; background: var(--card); border: 1px solid var(--hair); padding: 13px 14px; }
.card::before, .card::after {
  content: ''; position: absolute;
  width: 9px; height: 9px;
  border-color: var(--gold); pointer-events: none;
}
.card::before { left: -1px;  top: -1px;    border-top: 1.5px solid; border-left: 1.5px solid; }
.card::after  { right: -1px; bottom: -1px; border-bottom: 1.5px solid; border-right: 1.5px solid; }
```

`-1px` 偏移让角标压在 1px 边框之上而不是缩在内侧。选中/激活态改为四角全亮，颜色用 `--gold-bright`。

### 2. 中英双语区块标题

中文标题、连接横线、大字距大写拉丁文。尺寸比例不可调：中文 13px 半粗，拉丁 8.5px 配 2.2px 字距。

```html
<div class="card-head">
  <span class="mk"></span>
  <span class="zh">共鸣者</span>
  <span class="ln"></span>
  <span class="en">RESONATOR</span>
</div>
```

```css
.card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.card-head .mk { width: 3px; height: 12px; background: var(--gold); flex: none; }
.card-head .zh { font-size: 13px; font-weight: 600; letter-spacing: 1.5px; }
.card-head .ln { flex: 1; height: 1px; background: linear-gradient(90deg, var(--gold-dim), transparent); }
.card-head .en { font: 400 8.5px/1 var(--latin); letter-spacing: 2.2px; color: var(--gold-dim); }
```

拉丁标签是"有工作的装饰"：它要说清这个区块的领域概念。翻译含义，不要音译——「人物大小」对应 `SCALE`，不是 `RENWU DAXIAO`。

### 3. 菱形节点

旋转 45° 的方块，替代所有圆点、项目符号和滑块。

```css
.diamond {
  width: 9px; height: 9px;
  background: var(--gold); transform: rotate(45deg);
  box-shadow: 0 0 8px rgba(201,172,103,.7);
}
```

### 4. 大号数字读数

任何数值都提升为主角元素，用拉丁字体 + 金色辉光。

```css
.readout {
  font: 700 32px/1 var(--latin);
  color: var(--gold-bright); letter-spacing: 1px;
  text-shadow: 0 0 18px rgba(201,172,103,.45);
}
.readout small { font-size: 13px; margin-left: 2px; color: var(--gold-dim); }
```

### 5. 点阵括号装饰

2×3 点阵成对夹住居中文字。右侧那个用 `scaleX(-1)` 镜像。

```css
.dots {
  display: grid;
  grid-template-columns: 2px 2px; grid-template-rows: 2px 2px 2px;
  gap: 1.5px; opacity: .55;
}
.dots i { background: var(--gold); }
.dots.mirror { transform: scaleX(-1); }
```

### 6. 硬朗滑杆

细轨道、菱形滑块，金色填充进度由 JS 写入的 `--pct` 变量驱动。

```css
input[type=range] {
  width: 100%; height: 22px;
  -webkit-appearance: none; background: transparent; display: block; cursor: pointer;
}
input[type=range]::-webkit-slider-runnable-track {
  height: 4px;
  background:
    linear-gradient(90deg, var(--gold), var(--gold-bright)) 0/var(--pct, 50%) 100% no-repeat,
    rgba(255,255,255,.1);
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px; height: 12px; margin-top: -4px;
  background: var(--gold-bright); border: none;
  transform: rotate(45deg);
  box-shadow: 0 0 10px rgba(201,172,103,.85);
  transition: box-shadow .12s var(--ease);
}
input[type=range]:active::-webkit-slider-thumb { box-shadow: 0 0 16px rgba(230,207,149,1); }
```

## 硬性规则

**零圆角。** 全部纯直角。圆角摧毁这套语言的速度比任何配色错误都快。切角（45° 削角）是官方认可的替代方案——见下一条。

**切角必须有边缘表达。** 用 `clip-path` 削掉一个角，只有当有东西描出那条斜边时才读作"设计"。两种情况天然免费：

- 元素带 `border` —— 边框会跟着盒子一起被裁，自动沿切口描线。用于图标框、徽章、按钮。
- 元素是实心色块 —— 填色本身就是边缘。用于拨杆、指示器、标签。

而大面积**无边框**表面（面板、窗口）两者都没有，裸切一刀读作破损——用户会当成渲染 bug 上报。要么沿切口单独补一条金色发丝线，要么大表面干脆保持直角。「小组件切角 + 大面板直角」本来就是更强的构图。

```css
/* 安全：边框沿切口描线 */
.icoframe {
  border: 1px solid var(--gold-dim);
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
}
/* 安全：实心填色自成边缘 */
.switch::after {
  background: var(--gold-bright);
  clip-path: polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%);
}
```

**只有一个强调色。** 所有高亮、聚焦、激活态都由金色承担。加第二个强调色就变成廉价科幻风了。

**品牌金永不换肤。** 内容自带颜色时（角色、队伍、分类），把它注入 `--theme`，只允许染*内容表面*——缩略图、头像底色。金色骨架永远是金色。逐项的颜色写在项上，不写在根节点：

```css
/* 每个 item 自带 --c；全局主题变化不会重刷兄弟节点 */
.item .thumb { background: linear-gradient(165deg, color-mix(in srgb, var(--c, var(--theme)) 32%, #12141a), #12141a); }
```

```js
el.style.setProperty('--c', item.color);
```

**发丝线就是发丝线。** 边框 1px、角标 1.5px。再粗就是廉价 bootstrap 皮肤。

**克制辉光。** `box-shadow` 泛光只属于菱形滑块、大数字读数和激活态开关。不上卡片，不上正文。

## 反模式

这些错误在代码评审里看着没问题，上了屏幕才露馅。

**无边框表面上的裸切角。** 硬性规则里已讲，值得重复一遍，因为这是这套风格翻车率最高的一处：面板没有边框也没有填色边缘，`clip-path` 切完就是一个豁口，看着像坏了，不像设计。

**range 轨道上用 `clip-path`。** 加在 `::-webkit-slider-runnable-track` 上会连滑块一起裁——菱形直接消失。轨道造型只用背景分层实现。

**滚动容器吃掉 hover 上浮。** `overflow-x: auto` 会同时裁剪纵向，hover 的 `translateY(-2px)` 和激活态阴影都被切掉。给容器加内边距，再用负 margin 抵消占位：

```css
.gallery {
  display: flex; gap: 9px; overflow-x: auto;
  padding: 6px 4px 12px; margin: -6px -4px -12px;
  scrollbar-width: none;
}
.gallery::-webkit-scrollbar { display: none; }
```

**菱形滑块被 input 高度裁剪。** 12px 方块旋转 45° 后对角线约 17px，range 至少要 `height: 22px`。

**拉丁标签是乱码。** 大字距拉丁文只有在有含义时才是氛围。没翻译的拼音或生造词，会让任何看得懂英文的人瞬间出戏。

**Emoji。** 绝不。用内联 SVG 描边图标，stroke 宽度 1.8–2.2，金色或米白。

## 命名词汇表

把平铺直叙的设置项改成"世界观内"的说法，是效果的重要来源。翻译功能、保持可猜：

| 平铺直叙 | 世界观内 | 拉丁 |
|---|---|---|
| 设置 | 共鸣终端 | `RESONANCE TERMINAL` |
| 角色 | 共鸣者 | `RESONATOR` |
| 大小 / 缩放 | 显形尺度 | `SCALE` |
| 音量 | 声压 | `AMPLITUDE` |
| 已保存 | 参数已同步 | `SYNCED` |

破坏性或安全相关的操作不许改名。「删除」就是「删除」。

## 施工顺序

1. 把令牌块放进 `:root`。
2. 搭面板基底（渐变 + 扫描纹理 + 顶部发丝线）。
3. 所有容器换成带四角角标的 `.card`，圆角归零。
4. 所有区块标题换成中英双语标题。
5. 把最重要的数字提升为 `.readout`。
6. 圆点/项目符号/滑块全部换成菱形。
7. 加点阵括号页脚。
8. 对照下方清单验收。

## 验收清单

- [ ] 全局无 `border-radius`；所有切角都有边框或实心填色描出切口
- [ ] 有且只有一个强调色相（金）；内容色被约束在 `--theme` / 逐项 `--c` 里
- [ ] 每张卡片有角标；激活态四角全亮
- [ ] 每个区块标题都是 中文 + 横线 + 大字距拉丁
- [ ] 拉丁标签是有意义的翻译
- [ ] 扫描纹理透明度低于 3%
- [ ] 滑杆两个极值处菱形滑块可见且未被裁
- [ ] hover 上浮未被滚动容器裁剪
- [ ] 无 emoji、无图片素材、无 Web 字体
- [ ] 对比度：正文用 `--cream` 配 `--bg-0`；`--cream-dim` 只用于次要信息

## 延伸资料

- 完整组件配方（标题栏、选择器、开关、页脚、分段控件）—— [reference.md](reference.md)
- 可运行的组件画廊 —— [demo.html](demo.html)
