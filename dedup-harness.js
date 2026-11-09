// 开发用自检 harness（不随 app 部署）：纯 node + electron stub 跑 main.js 的 PM_DEDUP / PM_IMPORT_DL 模式
// 用法:  node dedup-harness.js                             → 沙箱去重自检（期望输出 [DEDUP] ALL-OK）
//        PM_IMPORT_DL=<MOD文件夹> node dedup-harness.js    → 把文件夹导入配置的 MOD 库（数据操作）
const Module = require('module');
const path = require('path');

let watchdog = null;
const electronStub = {
  app: {
    whenReady: () => Promise.resolve(),
    on: () => {},
    quit: () => {
      if (watchdog) clearTimeout(watchdog);
      setTimeout(() => process.exit(0), 300); // 留出 stdout 管道刷新时间
    },
  },
  BrowserWindow: class {},
  ipcMain: { handle: () => {}, on: () => {} },
  dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
  shell: { openExternal: () => {}, openPath: () => {} },
};

const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return electronStub;
  return origLoad.apply(this, arguments);
};

if (!process.env.PM_DEDUP && !process.env.PM_IMPORT_DL) process.env.PM_DEDUP = '1';
watchdog = setTimeout(() => { console.log('[HARNESS] TIMEOUT'); process.exit(1); }, 120000);
require(path.join(__dirname, 'app', 'main.js'));
