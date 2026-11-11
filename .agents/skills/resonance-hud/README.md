# Resonance HUD

一套深色金调的游戏 HUD 设计语言，打包为 Agent Skill。

> A dark-gold game HUD design language for web interfaces, packaged as an Agent Skill.

近黑基底、单一品牌金强调色、发丝级描边、纯直角、L 形四角角标、中英双语区块标题、菱形节点。所有装饰均由 CSS 或内联 SVG 绘制——零图片素材、零 Web 字体，任意 DPI 下都锐利。

> Near-black base, a single brand-gold accent, hairline borders, pure right angles, L-shaped corner brackets, bilingual CJK/Latin section labels, diamond nodes. Every ornament is drawn with CSS or inline SVG — no image assets, no web fonts, crisp at any DPI.

在浏览器中打开 [demo.html](demo.html) 查看全部组件。

> Open [demo.html](demo.html) in a browser to see every component.

效果预览 / Preview:

![效果预览录屏 / Preview recording](pubilc/录屏_20260804_235337.gif)
![界面截图 / Screenshot](pubilc/ScreenShot_〉〇〉」-〇』-〇》_〉《〇『》〈_「〈【.png)

## 安装 Install

```bash
npx skills add https://github.com/KTBOY/resonance-hud --skill resonance-hud
```

或者把目录复制到项目的 `.qoder/skills/`（Qoder）/ `.claude/skills/`（Claude Code）。

> Or copy the directory into your project's `.qoder/skills/` (Qoder) / `.claude/skills/` (Claude Code).

## 使用 Use

安装后，直接向 agent 提出游戏风格 / HUD 风格的需求：

> Once installed, ask your agent for a game-style or HUD interface:

- 「用鸣潮那种风格做一个设置面板」
- 「把这个 dashboard 改成游戏 HUD 风格」
- 「深色金调的科技感界面」

Skill 会在这些请求时激活，并套用令牌体系与组件配方。

> The skill activates on those requests and applies the token system and component recipes.

## 内容清单 What's inside

| 文件 File | 用途 Purpose |
|---|---|
| `SKILL.md` | 设计令牌、六个签名元素、硬性规则、反模式、验收清单 / Design tokens, six signature elements, hard rules, anti-patterns, checklist |
| `reference.md` | 可复制粘贴的配方：标题栏、项选择器、开关、分段控件、共鸣接入按钮、页脚、切角 / Copy-paste recipes: title bar, item picker, switch, segmented control, resonance link button, footer, chamfers |
| `demo.html` | 可运行的组件画廊——用浏览器打开 / Runnable component gallery — open it in a browser |

## 为什么做这个 Why this exists

向 AI 要一个「漂亮的界面」，得到的一定是同一种东西：浅灰背景、白色圆角卡片、一个蓝色强调色、处处 16px 圆角。不是错，只是毫无辨识度。

> Asking an AI for "a beautiful interface" reliably produces the same thing: light grey background, white rounded cards, one blue accent, 16px radius everywhere. Not wrong, just anonymous.

给它一个具体的参照系，比要求它有品味更有效。这个 skill 就是这样一个参照系——从已上线的游戏 UI 逆向推导而来：精确的十六进制色值、尺寸比例、装饰几何，以及那些在代码评审里看着没问题、上了屏幕才露馅的错误。

> Giving it a concrete reference system works better than asking for taste. This skill is one such system, reverse-engineered from a shipped game UI: the exact hex values, the size ratios, the ornament geometry, and the mistakes that look fine in code review but wrong on screen.

## 设计令牌 Design tokens

```css
--gold:        #c9ac67;   /* 品牌强调色——永不换肤 / brand accent — never themed */
--gold-bright: #e6cf95;
--cream:       #fafae9;
--bg-0:        #14161a;
--bg-1:        #1b1e23;
--hair:        rgba(201, 172, 103, .2);
```

完整令牌集与使用规则见 [SKILL.md](SKILL.md)。

> Full set and usage rules in [SKILL.md](SKILL.md).

## 适用范围 Scope

原生 CSS 自定义属性 + HTML。无框架、无构建步骤、无依赖。任何能加载样式表的项目都能用——React、Vue、Electron、纯 HTML。

> Vanilla CSS custom properties and HTML. No framework, no build step, no dependencies. Works in any project that can load a stylesheet — React, Vue, Electron, plain HTML.

适合：设置面板、悬浮层、启动器、HUD 仪表盘、角色/道具选择器、桌面伴侣应用。

> Fits: settings panels, overlays, launchers, HUD dashboards, character/inventory pickers, desktop companion apps.

不适合：以阅读为主的内容型界面、浅色主题、需要亲切柔和调性的产品。

> Does not fit: content-heavy reading interfaces, light themes, products needing a soft or friendly tone.

## 署名与法务 Credits and legal

配色与几何是对一种视觉风格的独立逆向分析，样本取自公开可访问的网页，仅用于研究。本项目不包含任何游戏素材、字体、Logo 或美术作品。

> The palette and geometry are an independent reverse-engineering of a visual style, sampled from publicly accessible web pages for study purposes. This project ships no game assets, no fonts, no logos, and no artwork.

与任何游戏开发商或发行商无关联、未获其背书或赞助。文中出现的游戏名称仅用于描述性地指明美学参照。

> Not affiliated with, endorsed by, or sponsored by any game developer or publisher. Game names appearing in the documentation are used descriptively to identify the aesthetic reference.

## 许可证 License

MIT
