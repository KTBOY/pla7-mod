> 仙剑奇侠传七 · MOD 阁（pal7-mod-manager）项目说明
> 版本：源码 v1.1.0（`app/main.js` 最后修改 2026-09-08）｜文档更新：2026-09-20
> 本文档同时是「启用一个 MOD 就在 MOD 库生成一个重复 MOD」这个问题的完整排查记录。

---

## 1. 这是什么

一个 Windows 桌面的《仙剑奇侠传七》MOD 管理器。用户把下载的 MOD（`.pak`）丢进「皮肤」文件夹，在界面里点「启用」，工具就把 pak 复制进 UE4 的 `~mods` 目录，游戏启动后加载。

- 技术形态：Electron 桌面应用，无构建步骤、无打包器，源码即产物（`main.js` + `renderer/` 直接 `loadFile`）
- 依赖：只有 Electron + 一个本地 Vue 3（`renderer/vendor/vue.global.prod.js`），`package.json` 里 **没有任何 dependencies**
- 安装位置：`仙剑奇侠传七\工具\pal7-mod-manager\`，安装包 `仙剑奇侠传七\仙剑七MOD阁-Setup-1.1.0.exe`
- 设计取向：工具与游戏同盘同目录，因此**游戏根目录可以零配置自动检测**（见 §5.1）

## 2. 目录结构

```
源码/app/
├── main.js              466 行，全部主进程逻辑：配置、扫描、装卸、IPC、内建自检
├── preload.js           contextBridge，白名单式暴露 16 个 api
├── config.json          运行时配置（游戏路径 + MOD 库路径），首次运行自动生成
├── package.json         name=pal7-mod-manager version=1.1.0
├── renderer/
│   ├── index.html       151 行，侧栏双 Tab（主游戏/DLC）+ 设置页 + 大图弹层
│   ├── app.js           192 行，Vue 3 组合式 API，ModCard 组件 + 全部交互
│   ├── style.css        322 行，水墨+鎏金主题（tokens 见 §6）
│   └── vendor/vue.global.prod.js
└── 皮肤/                默认 MOD 库（当前 15 个 pak / 13 个唯一 MOD）
```

## 3. 架构与进程边界

```
renderer (Vue)  ──window.api.*──▶  preload (contextBridge)  ──ipcRenderer.invoke──▶  main (Node/fs)
   纯展示/交互                        16 个白名单方法                        所有文件系统操作都在这里
```

安全基线：`contextIsolation: true`、`nodeIntegration: false`、CSP `default-src 'self'`。渲染进程拿不到 `fs`/`path`，只能通过 IPC 传**纯对象**。

IPC 通道一览（全部 `handle`/`invoke`，另有 2 个 `send` 用于窗口按钮）：

| 通道 | 作用 | 关键副作用 |
|---|---|---|
| `get-config` / `save-config` | 读写 `config.json` | `get-config` 会触发 `ensureGamePaths()`，**可能自动改写 config.json** |
| `detect-root` / `pick-root` | 自动/手动定位游戏根目录 | 只读探测，命中后写 config |
| `scan` | 递归扫描 `~mods` 与 MOD 库 | 无写入；每次操作后前端都调它刷新 |
| `install` | **启用**：复制 pak+sig+预览图到 `~mods`，先自动停用同槽位 | 缺 sig 时**向 MOD 库写入一个生成的 .sig** |
| `uninstall` | **停用**：把 `~mods` 里的副本移回 MOD 库 | `rename`，会改变库目录结构 |
| `delete-mod` | 删除 pak/sig/预览图 + 清理空目录 | 不可逆 |
| `set-preview` | 设封面：复制所选图片为 `<pak同名>.<ext>` | 写在 pak 旁边 |
| `import-mods` | 文件选择框导入，多选 | `copyFile` 到库根目录，**无重名检查** |
| `resign` | 用游戏自带 `dat*.sig` 覆盖 mod 签名 | MOD 拒载时的修复手段 |
| `launch-game` | `spawn` 起游戏 exe（detached） | — |
| `open-path` / `read-image` | 打开资源管理器 / 读图为 base64 dataURL | `read-image` 整图进内存 |
| `win-min` / `win-close` | 无边框窗口的自绘按钮 | — |

## 4. 核心数据模型

### 4.1 Mod 对象（`buildMod()` 产出，跨 IPC 传递）

```js
{
  id:      base64url(pakPath),   // ⚠ 路径的哈希，不是内容哈希
  name:    文件名去掉 .pak,
  pakPath, sigPath, preview,     // 绝对路径；sigPath/preview 不存在时为 null
  sizeMB, dir,                   // dir = pak 所在目录（库里的原始位置）
  category: '服装' | '武器',
  role:     '月清疏' | '女1' | ...,   // 可能为空
  slot:     '服装:月清疏' | '武器:碧海剑_赤红'
}
```

### 4.2 槽位（slot）—— 多 MOD 共存的关键抽象

同 `slot` 的 MOD 互斥（同一角色换装），不同 `slot` 可共存（服装 + 武器）。`slot` 由 `classify()` 从**文件名**启发式推导：

```
含 "武器" 段  →  '武器:' + 武器段后一个 token
否则匹配 (月清疏|白茉晴|修吾|桑游|魁予|男1|男2|女1|女2|月修吾)  →  '服装:' + 角色
都不匹配      →  '服装:' + 整个文件名        // ⚠ 退化成"每个 MOD 一个槽位"
```

### 4.3 config.json

```json
{ "games": { "main": { "name","paksDir","exe" }, "dlc": { ... } }, "libraryDir": "…\\app\\皮肤" }
```

`main`/`dlc` 两个游戏位共用**同一个** `libraryDir`——MOD 库不属于某个游戏，两个 Tab 看到的是同一批文件。

## 5. 关键流程

### 5.1 游戏根目录自动检测（三级降级）

`looksLikeGameRoot()` 判定标准：目录下有 `Pal7/` 且有 `Pal7.exe` **或** `Pal7/Content/Paks/`。

1. 从 `__dirname` 向上找 8 层（工具装在 `…\仙剑奇侠传七\工具\…` 时直接命中）
2. 扫 `C:~H:` 根目录 + 一级子目录；识别 `SteamLibrary/steamapps/common/{Pal7,仙剑奇侠传七}`；对名字含 `仙剑|pal7|swanfa|game|游戏` 的目录再下探一层
3. 都不行 → 让用户在设置页选根目录

`deriveGamePaths()` 再推导出 `Pal7/Content/Paks` 与 `Pal7_DLC/Pal7/Content/Paks`，exe 优先根目录 `Pal7.exe`，退化到 `Pal7/Binaries/Win64/Pal7-Win64-Shipping.exe`。

### 5.2 启用（`install`）

```
disableSameSlot(同槽位已启用的 → 移回库)
  → 若 mod 无 .sig：从游戏目录找 dat*-WindowsNoEditor.sig，复制成 <mod名>.sig 写在【库里 pak 旁边】
  → transferMod(mod, ~mods, move=false)  // copyFile：pak + sig + 预览图
  → 前端 refresh() 重新 scan
```

### 5.3 停用（`uninstall`）/ 同槽位自动替换

```
transferMod(mod, libraryDir, move=true)
  → 【源码 9/8 新增】findSameNamePak(libraryDir, 同名 pak, 排除自己)
       命中 → 删除 ~mods 副本（缺签名则顺手补 sig），不 rename  ← 兜底去重
       未命中 → rename 到 libraryDir 根目录
```

## 6. UI 与设计语言

无边框窗口（`frame:false`）+ 自绘标题栏。色板是水墨底 + 鎏金主色 + 玉青辅色：

```css
--ink-bg:#14100d  --ink-bg2:#1c1712  --ink-panel:#221b14  --ink-line:#3d3227
--gold:#d4a95c    --gold-bright:#eecb8a   --jade:#7fb99b
--text:#e8ddc8    --text-dim:#9a8c73      --danger:#c96a5a
```

布局：侧栏（主游戏 / DLC / 设置）→ 顶栏（启动游戏 / 打开 MOD 库 / 打开游戏目录 / 刷新）→ 两个 section：**当前生效**（可多开·同槽位自动替换，带「全部停用」）与 **MOD 库**（全部/服装/武器 三档筛选）。卡片悬浮出半透明按钮组「启用|删除|设图|放大」，点图进大图弹层，弹层里可完成启用/停用/删除/设预览图/重签。

## 7. 【重点】重复 MOD 问题：根因、复现、为什么"修了还在"

### 7.1 现象

MOD 库里同一个 MOD 出现两张一模一样的卡片（截图：`月清疏_mod_赵灵儿套` × 2，均 7.5 MB）。用户描述：**只要启用一个 MOD，库里就多出一个同样的。**

### 7.2 根因：启用是「复制」，停用是「移回库根」——两者不对称

```
初始：  皮肤/月清疏mod赵灵儿套/月清疏_mod_赵灵儿套.pak          ← 下载解压的文件夹形态
启用：  copyFile → ~mods/月清疏_mod_赵灵儿套.pak
        库里原件【原地不动】（仍在子文件夹里）
停用：  rename → 皮肤/月清疏_mod_赵灵儿套.pak
        ⚠ destDir 恒为 cfg.libraryDir 根，不记得 mod.dir 原文件夹
结果：  库根 1 份 + 原子文件夹 1 份 = 2 个同名 pak
        scanMods() 递归遍历整棵树，每个 .pak 生成一张卡片 → 两张重复卡片
```

更关键的是：**用户根本不需要点「停用」**。`install` 内部会先跑 `disableSameSlot()`，把同槽位的已启用 MOD 移回库根。所以「启用 A → 再启用同槽位的 B」这一串纯「启用」操作，就会让 A 在库里变成两份。

### 7.3 沙箱复现（把 main.js 的 scanMods/transferMod/disableSameSlot 原样抽出，在临时目录跑）

只点「启用」，全程不点「停用」：

```
--- 已安装 9/5（无兜底）---  ← 你现在实际运行的版本
  初始（下载解压，库里 1 份）:        库=A@月清疏modA套            ~mods=0
  点「启用」A:                        库=A@月清疏modA套            ~mods=1
  点「启用」B（同槽位，A 被自动停用）:  库=A@ | B@ | A@月清疏modA套   ~mods=1   ← 重复出现

--- 源码 9/8（有兜底）---
  点「启用」B（同槽位，A 被自动停用）:  库=B@ | A@月清疏modA套       ~mods=1   ← 不再重复
```

另外三个场景的结论：

| 场景 | 旧版 9/5 | 源码 9/8 |
|---|---|---|
| 启用→停用 一个文件夹形态的 MOD | 1 → **2** 张 | 1 → 1 ✅ |
| 已重复后再启用 | **2** 张 | 1 ✅ |
| 同槽位换装自动停用 | **2** 张 | 1 ✅ |
| 「导入」一个库里已存在的 MOD | **2** 张 | **2** 张 ❌ 未修 |

### 7.4 磁盘实证

`工具\pal7-mod-manager\resources\app\皮肤`（= 运行时真正读的库）里存在两组重复，`pak`/`sig`/`png` 三个文件的 mtime **纳秒级完全一致**，证明其中一份是另一份的 copy/rename 产物，而非两份不同的 MOD：

```
皮肤\月清疏_mod_赵灵儿套.pak            7,855,694  2021-10-28 14:14:48.303900600   ← 被移回库根的那份
皮肤\月清疏mod赵灵儿套\月清疏_mod_赵灵儿套.pak   同上  同上                          ← 下载解压的原件
皮肤\月清疏_菱纱瓊華派_校服配色.pak      32,139,562  2021-11-06 03:34:59.092928600
皮肤\月清疏-菱纱瓊華派 校服配色\月清疏_菱纱瓊華派_校服配色.pak   同上  同上
```

全库统计：15 个 `.pak` / 13 个唯一名 / 2 个重复名。

### 7.5 为什么"9/8 就修了，9/20 还在犯" —— 部署断层

| | 时间 | 大小 | 有 `findSameNamePak` 兜底？ |
|---|---|---|---|
| 运行副本 `工具\pal7-mod-manager\resources\app\main.js` | 2026-09-05 21:06 | 27,435 B | ❌ 无 |
| 源码 `源码\app\main.js` | 2026-09-08 21:24 | 28,904 B | ✅ 有 |

`diff` 确认两者唯一差异就是 §5.3 那段兜底去重（+26 行）。**修复从未进入实际运行的 build**，加上库里那两组重复文件本身也没被清理，所以症状原样复现。

> 这是本项目当前最大的工程风险：**没有部署流水线，源码和已安装 app 靠手工复制同步，且没有任何机制能发现两者不一致。**

## 8. 其它已知缺陷（按严重度）

| # | 严重度 | 位置 | 问题 |
|---|---|---|---|
| 1 | 🔴 高 | `classify()` | pak 文件名是拼音/英文时（`yqssm`、`yqs_lk_P`、`hunfumod_P`、`YueQingShuJinQiu_P`），角色匹配失败 → 退化成 `'服装:'+整个文件名`，各自独占槽位。结果这 4 个月清疏服装 MOD 与 `月清疏_mod_赵灵儿套`、`月清疏_菱纱瓊華派` **判定为可共存**，同时进 `~mods`，游戏里实际随机互相覆盖。只读 `path.basename(pakPath)`，完全不看上层文件夹名（`月清疏金秋mod/` 这种文件夹名里明明有角色名）。 |
| 2 | 🔴 高 | `import-mods` | 纯 `copyFile` 到库根，无重名检查 → 导入已存在的 MOD 直接产生重复卡片（§7.3 场景 4）。 |
| 3 | 🟠 中 | 兜底去重本身 | 只处理「停用/自动停用」路径，且策略是**删掉 `~mods` 副本**，不回写原文件夹；**对库里已存在的重复不做任何清理**。等于阻止新增、不管存量。 |
| 4 | 🟠 中 | `delete-mod` | 只删被点那张卡片对应的一个物理文件。有重复时删完另一份还在 → 用户体感「删了又冒出来」。 |
| 5 | 🟠 中 | `disableSameSlot()` 返回值 | `disabledNames: installed.map(m=>m.name)` 返回**全部**已启用 MOD，而 `disabled` 只数同槽位的。前端 `slice(0, r.disabled)` 按下标截断，顺序不巧时就报出「已替换同槽位：一个根本没被替换的 MOD」。 |
| 6 | 🟡 低 | `index.html` lightbox | 停用/启用按钮判定用 `installed.some(m => m.id === zoomMod.id)`，而 `id = base64(pakPath)`。库里那份和 `~mods` 那份路径不同 → id 不同 → **从库卡片打开大图永远显示「启用」**，即使该 MOD 已生效。 |
| 7 | 🟡 低 | `install()` | 缺签名时把生成的 `.sig` 写进 **MOD 库**（`path.dirname(mod.pakPath)`），污染用户库且不可撤销。 |
| 8 | 🟡 低 | `main.js` | 无 `requestSingleInstanceLock()`。开两个实例会并发 `rename` 同一批文件。 |
| 9 | 🟡 低 | 注释 vs 实现 | `disableSameSlot` 注释写「严格单MOD模式（设置里可开）」，但 `PM_SINGLE` 只能靠环境变量，设置页无对应开关。 |
| 10 | 🟡 低 | 卡片列表 | 库卡片不显示"该 MOD 是否已生效"（`installed` prop 恒 false），「生效中」徽标只出现在上方 section，两个 section 之间无视觉关联。 |
| 11 | ⚪ 提示 | `scan` | 每次刷新全库递归 + 逐个 `stat` + 预览图整张 base64 进内存（`read-image`）。库大了会明显卡，且 `ModCard.created()` 每张卡各发一次 IPC。 |

## 9. 修复方案

### 9.0 立刻止血（不改代码）

1. 把 `源码\app\main.js` 覆盖到 `工具\pal7-mod-manager\resources\app\main.js`（当前 27,435 B 那份）；
2. 删掉库里 4 个"散在根目录"的重复文件（保留子文件夹里的原件）：
   `皮肤\月清疏_mod_赵灵儿套.{pak,sig,png}` 与 `皮肤\月清疏_菱纱瓊華派_校服配色.{pak,sig,png}`
   （约 40 MB；删前建议先备份 `皮肤` 目录）

### 9.1 治本：让「停用」回到 MOD 来的地方

`transferMod` 已经能拿到 `mod.dir`（`buildMod()` 里 = pak 所在目录）。move 分支改成：

```
目标 = mod.dir 仍存在 → 移回 mod.dir/<同名文件>
     否则            → 移回 libraryDir 根
移回前若目标已存在同名 pak → 删除 ~mods 副本（现有兜底逻辑）
```

这样库的目录结构在「启用↔停用」循环里保持不变，从源头消除重复。

### 9.2 补齐三个缺口

- **`import-mods`**：复制前用 `findSameNamePak(cfg.libraryDir, basename, null)` 查重；命中则跳过并计入 `skipped`，前端 toast 提示「已存在，跳过 N 个」。
- **`scan`**：返回前按 `name.toLowerCase()` 做一层展示级去重（保留 `dir === libraryDir` 的根目录那份，或保留 `.sig` 齐全的那份），把被合并掉的路径放进 `dupPaths` 字段。**这条能立刻让截图里的重复卡片消失，即使磁盘文件还没清理。**
- **一次性清理**：加 `dedupe-library` IPC，扫描全库、按内容（大小 + 首尾块 hash）分组，保留每组"最完整"的一份（pak+sig+png 齐全、优先子文件夹原件），其余移到 `皮肤/_重复备份/` 而非直接删，返回清理清单给前端展示。

### 9.3 顺手修

- `classify()`：把**上层文件夹名**并入分类输入（`月清疏金秋mod/YueQingShuJinQiu_P.pak` → role=月清疏）；`slot` 兜底不要退化成整文件名。
- `disableSameSlot`：`disabledNames` 改成 `installed.filter(m => m.slot === slot).map(m => m.name)`。
- `install`：生成的 `.sig` 只写到 `~mods`，不写库。
- lightbox 判定：改成按 `mod.name` 比较，或给 Mod 加一个内容级 `key`。
- 加 `requestSingleInstanceLock()`。
- 设置页补「严格单 MOD 模式」开关，替掉 `PM_SINGLE` 环境变量，或把注释改成实话。

### 9.4 流程上防复发

`源码/app/` 与 `resources/app/` 是手工复制关系，本次事故的本质就是它。建议至少做一条：
- 在 `main.js` 启动时把 `package.json` 的 version + `main.js` 的 mtime 显示到标题栏/设置页，让"跑的是旧版"肉眼可见；
- 或加一个 `deploy.bat`：`copy 源码\app\* 工具\pal7-mod-manager\resources\app\` 后自动 diff 校验。

## 10. 内建自检（开发用，全部靠环境变量触发，跑完 `app.quit()`）

`createWindow()` 里挂了 4 个模式，是这个项目唯一的"测试"：

| 变量 | 作用 |
|---|---|
| `PM_TEST=1` | 隐藏窗口，直连 IPC 验证多 MOD 槽位共存规则（皮肤+武器+另一角色应共存；同角色重启用应替换；断言 `installed===4`） |
| `PM_UI=1` | 离屏窗口真实点击 DOM 走完 7 步交互（清场→卡片启用→跨槽共存→大图→大图内启用/停用→全部停用→恢复），每步断言并存截图 `shot-ui-*.png` |
| `PM_SHOT=1` | 离屏渲染 DLC 页存 `shot-dlc.png`，供开发自检界面 |
| `PM_RESIGN=1` | 验证重签后 `.sig` 字节数与游戏自带 base sig 一致 |

⚠ 这些模式**直接操作用户真实的 MOD 库和游戏 `~mods` 目录**，会在库裡留下 rename 痕迹。§7 的复现之所以要用临时目录沙箱，就是这个原因。

## 11. 当前 MOD 库盘点（`源码/app/皮肤`）

15 个 pak / 13 个唯一 MOD / 2 组重复。槽位分布：

```
服装:月清疏          月清疏_mod_赵灵儿套 ×2, 月清疏_菱纱瓊華派_校服配色 ×2   ← 4 张卡实为 2 个 MOD
服装:女1 / 女2 / 男1 / 男2   刀战学院系列 5 个（男2 有烟熏妆、绿化两套互斥）
武器:碧海剑_赤红 / 青天剑_赤红  各 1
服装:yqssm / yqs_lk_P / hunfumod_P / YueQingShuJinQiu_P   ← ⚠ 缺陷 #1：本该并入 服装:月清疏
```

游戏侧 `~mods` 现状：主游戏 4 个（刀战学院 女2/男1/男2烟熏妆 + 月清疏_mod_赵灵儿套），DLC 3 个（金秋 + 碧海剑 + 青天剑）。
