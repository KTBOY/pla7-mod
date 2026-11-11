# 仙剑七MOD阁 · Pal7 MOD Archive

《仙剑奇侠传七》单机 MOD 管理器（Electron + Vue3，无构建步骤，Windows 便携免安装）。
深色金调 HUD 界面（resonance-hud 设计语言），主游戏 / DLC 双库管理。

## 下载

- 最新便携版 v1.3.0：[Pal7-Mod-Manager-1.3.0-portable.zip](https://github.com/KTBOY/pla7-mod/releases/download/v1.3.0/Pal7-Mod-Manager-1.3.0-portable.zip)
  解压后运行 `仙剑七MOD阁.exe` 即可，无需安装。
- 历史版本：[Releases](https://github.com/KTBOY/pla7-mod/releases)

> 便携包约 152MB，超过 git 单文件 100MB 限制，故以 Release 附件分发；仓库内为完整源码。

## 功能

- MOD 库卡片管理：预览图、点击放大、设为预览图、启用 / 停用 / 删除
- 内容哈希去重 + 文件夹批量导入（自动补预览图、跳过重复）
- 同槽位互斥自动替换：女1=月清疏、女2=白茉晴、男1=修吾、男2=桑游，拼音名（yqs 等）同样归一；不同槽位（角色服装 + 武器外观）可共存
- 缺签名自动用游戏自带签名补齐、支持重签；游戏路径自动检测
- 侧栏入口：更新（夸克网盘整合包）/ 打赏 / 作者主页

## 使用

1. 解压运行 exe；首次启动自动查找游戏路径，检测不到时在「设置」里选择游戏根目录（包含 Pal7 文件夹的那一层）。
2. 把 MOD（.pak + 同名 .sig / 预览图）放进 `resources/app/皮肤` 文件夹后点「刷新」；或点「导入 MOD」选择文件夹批量入库。
3. 「启用」会把 .pak 与 .sig 复制到游戏 `~mods` 目录，「停用」移回 MOD 库；换 MOD 后需重启游戏生效。

## 源码结构

- `app/`：主进程 `main.js`、`preload.js`、渲染层 `renderer/`（Vue3 本地 vendor，无打包步骤）
- `dedup-harness.js`：沙箱自检入口（`node dedup-harness.js`，纯 node + electron stub）
- 自检模式：`PM_DEDUP` 沙箱数据自检、`PM_EXTRAS` 只读 UI 验证（截图写入系统临时目录）

## 说明

- 仓库只包含工具源码，不含任何 MOD 文件（MOD 版权归原作者）。
- 二次开发：将 `app/` 放入 Electron 运行时的 `resources/app` 即可启动（便携包内即此结构）。