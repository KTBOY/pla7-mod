const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const LIBRARY_DIR = path.join(__dirname, 'library');

const DEFAULT_CONFIG = {
  games: {
    main: { name: '仙剑奇侠传七（主游戏）', paksDir: '', exe: '' },
    dlc: { name: '仙剑奇侠传七 DLC', paksDir: '', exe: '' },
  },
  libraryDir: path.join(__dirname, '皮肤'),
};

/* ---------- 游戏根目录自动检测 ----------
   游戏根目录 = 同时包含 Pal7 与(可选) Pal7_DLC 内容目录的文件夹。
   检测顺序：1) 从工具安装位置向上找；2) 常见盘符/目录特征扫描；3) 用户手动选择。 */

function looksLikeGameRoot(dir) {
  return fs.existsSync(path.join(dir, 'Pal7')) &&
    (fs.existsSync(path.join(dir, 'Pal7.exe')) ||
     fs.existsSync(path.join(dir, 'Pal7', 'Content', 'Paks')));
}

function findRootUpward(startDir) {
  let d = startDir;
  for (let i = 0; i < 8; i++) {
    if (looksLikeGameRoot(d)) return d;
    const p = path.dirname(d);
    if (p === d) break;
    d = p;
  }
  return null;
}

function findRootOnDrives() {
  const drives = [];
  for (const L of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
    try { if (fs.existsSync(L + ':\\')) drives.push(L + ':\\'); } catch {}
  }
  for (const dr of drives) {
    let top = [];
    try { top = fs.readdirSync(dr, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { continue; }
    for (const e of top) {
      const cand = path.join(dr, e.name);
      if (looksLikeGameRoot(cand)) return cand;
      // Steam / WeGame 库结构
      if (/steamlibrary|steamapps/i.test(e.name)) {
        const common = path.join(cand, 'steamapps', 'common');
        for (const name of ['Pal7', '仙剑奇侠传七']) {
          if (looksLikeGameRoot(path.join(common, name))) return path.join(common, name);
        }
      }
      // 二级目录里再找一层（关键词目录）
      if (/仙剑|pal7|swanfa|game|游戏/i.test(e.name)) {
        let sub = [];
        try { sub = fs.readdirSync(cand, { withFileTypes: true }).filter((x) => x.isDirectory()); } catch { continue; }
        for (const s of sub) {
          if (looksLikeGameRoot(path.join(cand, s.name))) return path.join(cand, s.name);
        }
      }
    }
  }
  return null;
}

function detectGameRoot(pickedDir) {
  if (pickedDir) {
    // 允许用户直接选到 Paks、游戏根、或任意上层
    if (looksLikeGameRoot(pickedDir)) return pickedDir;
    if (/Content.Paks$/i.test(pickedDir)) {
      // ...\Pal7\Content\Paks → 上跳到游戏根
      let d = path.dirname(path.dirname(pickedDir)); // Pal7
      d = path.dirname(d); // 根
      if (looksLikeGameRoot(d)) return d;
    }
    const up = findRootUpward(pickedDir);
    if (up) return up;
  }
  return findRootUpward(__dirname) || findRootOnDrives() || null;
}

function deriveGamePaths(root) {
  if (!root) return null;
  const mainPaks = path.join(root, 'Pal7', 'Content', 'Paks');
  const dlcPaks = path.join(root, 'Pal7_DLC', 'Pal7', 'Content', 'Paks');
  let mainExe = path.join(root, 'Pal7.exe');
  if (!fs.existsSync(mainExe)) {
    const ship = path.join(root, 'Pal7', 'Binaries', 'Win64', 'Pal7-Win64-Shipping.exe');
    if (fs.existsSync(ship)) mainExe = ship;
  }
  let dlcExe = path.join(root, 'Pal7_DLC', 'Pal7.exe');
  if (!fs.existsSync(dlcExe)) {
    const ship = path.join(root, 'Pal7_DLC', 'Pal7', 'Binaries', 'Win64', 'Pal7-Win64-Shipping.exe');
    if (fs.existsSync(ship)) dlcExe = ship;
  }
  return {
    root,
    main: { paksDir: mainPaks, exe: fs.existsSync(mainPaks) ? mainExe : '' },
    dlc: { paksDir: dlcPaks, exe: fs.existsSync(dlcPaks) ? dlcExe : '' },
  };
}

// 旧版默认库路径迁移到新的「皮肤」库；游戏路径缺失时自动检测
function loadConfig() {
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (cfg.libraryDir === LIBRARY_DIR) cfg.libraryDir = DEFAULT_CONFIG.libraryDir;
  } catch {
    cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  cfg.games = { main: { ...DEFAULT_CONFIG.games.main, ...(cfg.games || {}).main },
                dlc: { ...DEFAULT_CONFIG.games.dlc, ...(cfg.games || {}).dlc } };
  cfg.libraryDir = cfg.libraryDir || DEFAULT_CONFIG.libraryDir;
  cfg.updateUrl = typeof cfg.updateUrl === 'string' ? cfg.updateUrl : '';
  return cfg;
}

// 配置里的游戏路径无效时自动检测并回填（get-config 时调用）
function ensureGamePaths(cfg) {
  const ok = (p) => p && fs.existsSync(p);
  if (ok(cfg.games.main.paksDir) || ok(cfg.games.dlc.paksDir)) return cfg;
  const root = detectGameRoot();
  const derived = deriveGamePaths(root);
  if (derived) {
    cfg.games.main.paksDir = derived.main.paksDir;
    cfg.games.main.exe = derived.main.exe;
    if (fs.existsSync(derived.dlc.paksDir)) {
      cfg.games.dlc.paksDir = derived.dlc.paksDir;
      cfg.games.dlc.exe = derived.dlc.exe;
    }
    if (!process.env.PM_EXTRAS) { try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8'); } catch {} }
  }
  return cfg;
}

async function saveConfig(cfg) {
  await fsp.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  return cfg;
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
const PREVIEW_NAMES = ['preview', 'cover', 'thumb'];

// 内容哈希去重：流式 MD5，按 路径+大小+mtime 缓存，避免每次扫描重复计算
const hashCache = new Map();
async function hashPak(pakPath, st) {
  if (!st) st = await fsp.stat(pakPath);
  const key = pakPath + '|' + st.size + '|' + st.mtimeMs;
  const hit = hashCache.get(key);
  if (hit) return hit;
  const hash = await new Promise((resolve, reject) => {
    const h = crypto.createHash('md5');
    fs.createReadStream(pakPath)
      .on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
  if (hashCache.size > 4096) hashCache.clear();
  hashCache.set(key, hash);
  return hash;
}

// 递归找出目录下所有 .pak，每个 pak 视为一个 mod
async function scanMods(root) {
  const mods = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.pak')) {
        mods.push(await buildMod(dir, full));
      }
    }
  }
  await walk(root);
  return groupByHash(mods);
}

// 内容哈希分组：同一份 pak 的多处副本（历史 bug 遗留在库根/子目录各一份）只出一张卡片，
// 其余副本记入 rep.copies，供删除/停用时连带清理
function groupByHash(mods) {
  const groups = new Map();
  for (const m of mods) {
    const arr = groups.get(m.hash);
    if (arr) arr.push(m);
    else groups.set(m.hash, [m]);
  }
  const depth = (m) => m.pakPath.split(path.sep).length;
  const out = [];
  for (const arr of groups.values()) {
    // 确定性选代表：有预览 > 有签名 > 目录更深（子文件夹原件优先于根目录散件）> 路径字典序
    arr.sort((a, b) => (!!b.preview - !!a.preview) || (!!b.sigPath - !!a.sigPath) ||
      (depth(b) - depth(a)) || a.pakPath.localeCompare(b.pakPath));
    const rep = arr[0];
    rep.copies = arr.slice(1).map((m) => ({ pakPath: m.pakPath, sigPath: m.sigPath, preview: m.preview, descPath: m.descPath }));
    out.push(rep);
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return out;
}

async function buildMod(dir, pakPath) {
  const base = pakPath.slice(0, -4); // 去掉 .pak
  const sigPath = base + '.sig';

  // 预览图：同名图片，或同目录 preview/cover/thumb.*
  let preview = null;
  for (const ext of IMAGE_EXTS) {
    const p = base + ext;
    if (fs.existsSync(p)) { preview = p; break; }
  }
  if (!preview) {
    outer: for (const name of PREVIEW_NAMES) {
      for (const ext of IMAGE_EXTS) {
        const p = path.join(dir, name + ext);
        if (fs.existsSync(p)) { preview = p; break outer; }
      }
    }
  }

  // 说明：同名 .txt 首行（如 RemoveSkirtMod.txt = 不要裙子），卡片上展示
  let desc = null;
  let descPath = null;
  const txtPath = base + '.txt';
  if (fs.existsSync(txtPath)) {
    try {
      const t = fs.readFileSync(txtPath, 'utf8').trim();
      if (t) { desc = t.split(/\r?\n/)[0].trim(); descPath = txtPath; }
    } catch {}
  }

  const stat = await fsp.stat(pakPath);
  return {
    id: Buffer.from(pakPath).toString('base64url'),
    name: path.basename(pakPath).replace(/\.pak$/i, ''),
    pakPath,
    sigPath: fs.existsSync(sigPath) ? sigPath : null,
    preview,
    desc,
    descPath,
    sizeMB: +(stat.size / 1024 / 1024).toFixed(1),
    dir,
    hash: await hashPak(pakPath, stat),
    copies: [],
    ...classify(path.basename(pakPath), path.basename(dir)),
  };
}

// 角色槽位归一：中文名、编号别名（女1=月清疏 等）、拼音都归到同一角色，
// 避免同一位置的 MOD 因名字写法不同被判成不同槽而同时启用
const CHAR_SLOTS = [
  { canon: '月清疏', zh: /月清疏|女1/, py: /^(yqs|yueqingshu)/ },
  { canon: '修吾', zh: /修吾|男1/, py: /^(xw$|xiuwu)/ },
  { canon: '白茉晴', zh: /白茉晴|女2/, py: /^(bmq|baimoqing)/ },
  { canon: '桑游', zh: /桑游|男2/, py: /^(sy$|sangyou)/ },
  { canon: '魁予', zh: /魁予/, py: /^(ky$|kuiyu)/ },
];
function matchRole(text) {
  if (!text) return '';
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const c of CHAR_SLOTS) {
    if (c.zh.test(text)) return c.canon;
    if (tokens.some((t) => c.py.test(t))) return c.canon;
  }
  return '';
}
// pak 自身名优先于目录名：整合包目录可能同时提到多个角色（如 "BMQ and YQS nude mod"），
// 只看目录会把 BaiMoQing_P 误判进目录里先匹配到的角色槽
function resolveRole(name, dirName) {
  return matchRole(name) || matchRole(dirName);
}

// 功能性 MOD 关键词：Remove*（去裙/去紧身衣等）、nude，及中文功能/裸体谐音（锅体=果体）
const FUNC_MOD_RE = /nude|remove|功能|去裙|裸体|果体|锅体/i;

// 从文件名启发式分类，并计算"槽位"：同槽位的 mod 互相覆盖（如同一角色的两套服装），
// 不同槽位可以同时启用（如 女1服装 + 碧海剑武器）
function classify(name, dirName = '') {
  const segs = name.replace(/\.pak$/i, '').split('_');
  // 武器：文件名含"武器"段时，取其后的武器名作为槽位
  const wIdx = segs.indexOf('武器');
  if (wIdx >= 0) {
    return { category: '武器', role: segs[wIdx + 1] || '', slot: '武器:' + (segs[wIdx + 1] || name) };
  }
  const role = resolveRole(name, dirName);
  if (FUNC_MOD_RE.test(name + '_' + dirName)) {
    // 功能性 MOD 归「其他」；改的仍是角色模型，能解析出角色就与该角色服装同槽互斥
    return { category: '其他', role, slot: role ? '服装:' + role : '其他:' + name };
  }
  return { category: '服装', role, slot: '服装:' + (role || name) };
}

// 游戏自带的默认签名（dat0/dat1-WindowsNoEditor.sig），缺签名时用它按 mod 名补一个
function findBaseSig(paksDir) {
  try {
    const hit = fs.readdirSync(paksDir).find((f) => /^dat\d?-WindowsNoEditor\.sig$/i.test(f));
    return hit ? path.join(paksDir, hit) : null;
  } catch {
    return null;
  }
}

// 递归查找目录下同名 pak（忽略大小写），用于停用前的兜底去重
async function findSameNamePak(root, pakName, excludePath) {
  let found = null;
  async function walk(dir) {
    if (found) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (found) return;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile() && ent.name.toLowerCase() === pakName.toLowerCase() &&
                 path.resolve(full) !== path.resolve(excludePath)) {
        found = full;
      }
    }
  }
  await walk(root);
  return found;
}

// 把 mod 复制/移动到目标目录（安装=复制到 ~mods，卸载=移动回 mod 库）
async function transferMod(mod, destDir, move) {
  await fsp.mkdir(destDir, { recursive: true });
  const pakDest = path.join(destDir, path.basename(mod.pakPath));
  const sigDest = mod.sigPath ? path.join(destDir, path.basename(mod.sigPath)) : null;
  const previewDest = mod.preview
    ? path.join(destDir, path.basename(mod.pakPath, '.pak') + path.extname(mod.preview))
    : null;
  const descDest = mod.descPath
    ? path.join(destDir, path.basename(mod.pakPath, '.pak') + '.txt')
    : null;

  if (move) {
    // 兜底去重：库里已存在同名 pak 时不再移回（否则同一 mod 会在库里出现两份、列表重复）
    const dup = await findSameNamePak(destDir, path.basename(mod.pakPath), mod.pakPath);
    if (dup) {
      const dupHash = await hashPak(dup).catch(() => null);
      const modHash = await hashPak(mod.pakPath).catch(() => null);
      if (dupHash && modHash && dupHash !== modHash) {
        // 同名但内容不同：不能静默删除，移进"_移回备份"留待用户处理
        const bak = path.join(destDir, '_移回备份');
        await fsp.mkdir(bak, { recursive: true });
        await fsp.rename(mod.pakPath, path.join(bak, path.basename(mod.pakPath)));
        if (mod.sigPath && fs.existsSync(mod.sigPath)) await fsp.rename(mod.sigPath, path.join(bak, path.basename(mod.sigPath))).catch(() => {});
        if (mod.preview && fs.existsSync(mod.preview)) await fsp.rename(mod.preview, path.join(bak, path.basename(mod.preview))).catch(() => {});
        if (mod.descPath && fs.existsSync(mod.descPath)) await fsp.rename(mod.descPath, path.join(bak, path.basename(mod.descPath))).catch(() => {});
        return path.basename(mod.pakPath);
      }
      // 同内容：直接删除 ~mods 里的副本；若库中那份缺签名而副本有，则顺手补上
      const dupSig = dup.replace(/\.pak$/i, '') + '.sig';
      if (!fs.existsSync(dupSig) && mod.sigPath && fs.existsSync(mod.sigPath)) {
        await fsp.copyFile(mod.sigPath, dupSig).catch(() => {});
      }
      const dupTxt = dup.replace(/\.pak$/i, '') + '.txt';
      if (!fs.existsSync(dupTxt) && mod.descPath && fs.existsSync(mod.descPath)) {
        await fsp.copyFile(mod.descPath, dupTxt).catch(() => {});
      }
      for (const p of [mod.pakPath, mod.sigPath, mod.preview, mod.descPath]) {
        if (p && fs.existsSync(p)) await fsp.rm(p).catch(() => {});
      }
      return path.basename(dup);
    }
    await fsp.rename(mod.pakPath, pakDest);
    if (mod.sigPath && fs.existsSync(mod.sigPath)) await fsp.rename(mod.sigPath, sigDest);
    if (mod.preview) await fsp.rename(mod.preview, previewDest).catch(() => {});
    if (mod.descPath) await fsp.rename(mod.descPath, descDest).catch(() => {});
  } else {
    await fsp.copyFile(mod.pakPath, pakDest);
    if (mod.sigPath && fs.existsSync(mod.sigPath)) await fsp.copyFile(mod.sigPath, sigDest);
    if (mod.preview) await fsp.copyFile(mod.preview, previewDest).catch(() => {});
    if (mod.descPath) await fsp.copyFile(mod.descPath, descDest).catch(() => {});
  }
  // 复制模式下预览图可能被 dest 里已有文件占用
  return path.basename(pakDest);
}

// 停用/删除后连带清掉卡片背后隐藏的重复副本（同内容按哈希分组的其余成员）
async function removeCopies(mod) {
  for (const c of mod.copies || []) {
    for (const p of [c.pakPath, c.sigPath, c.preview, c.descPath]) {
      if (p && fs.existsSync(p)) await fsp.rm(p).catch(() => {});
    }
  }
}

ipcMain.handle('get-config', () => ensureGamePaths(loadConfig()));
ipcMain.handle('save-config', (_e, cfg) => saveConfig(cfg));

// 自动检测游戏根目录（可选参数：用户手动选择的目录），返回推导结果供设置页确认
ipcMain.handle('detect-root', async (_e, pickedDir) => {
  const root = detectGameRoot(pickedDir);
  const derived = deriveGamePaths(root);
  if (!derived) return { ok: false, msg: '未检测到游戏，请手动选择包含 Pal7 文件夹的游戏根目录' };
  return { ok: true, ...derived };
});

// 弹出目录选择框
ipcMain.handle('pick-root', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择游戏根目录（包含 Pal7 文件夹的那一层）',
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths[0]) return { ok: false };
  return { ok: true, dir: filePaths[0] };
});

ipcMain.handle('scan', async () => {
  const cfg = ensureGamePaths(loadConfig());
  await fsp.mkdir(cfg.libraryDir, { recursive: true });
  const result = { libraryDir: cfg.libraryDir, games: {} };
  for (const key of Object.keys(cfg.games)) {
    const g = cfg.games[key];
    const modsDir = path.join(g.paksDir, '~mods');
    const [installed, library] = await Promise.all([scanMods(modsDir), scanMods(cfg.libraryDir)]);
    result.games[key] = {
      ...g,
      modsDir,
      dirExists: fs.existsSync(g.paksDir),
      installed,
      library,
    };
  }
  return result;
});

// 多 MOD 共存：只停用与目标 mod 同槽位的已启用 mod（同一角色换装互斥，武器与服装互不干扰）
async function disableSameSlot(paksDir, libraryDir, slot) {
  const modsDir = path.join(paksDir, '~mods');
  const installed = await scanMods(modsDir);
  const disabledNames = [];
  for (const m of installed) {
    const same = m.slot === slot;
    // 严格单MOD模式（设置里可开）：任何新启用都会清空其它
    if (same || process.env.PM_SINGLE) {
      await transferMod(m, libraryDir, true);
      await removeCopies(m);
      disabledNames.push(m.name);
    }
  }
  return { disabled: disabledNames.length, disabledNames };
}

ipcMain.handle('install', async (_e, { mod, gameKey }) => {
  const cfg = loadConfig();
  const game = cfg.games[gameKey];
  if (!fs.existsSync(game.paksDir)) return { ok: false, msg: '游戏目录不存在，请在设置中修正' };
  // 功能性 MOD（其他）按作者约定装进 ~mods\Mods，其余装 ~mods（游戏递归扫描两处都会加载）
  const dest = mod.category === '其他'
    ? path.join(game.paksDir, '~mods', 'Mods')
    : path.join(game.paksDir, '~mods');
  const slot = mod.slot || ('服装:' + mod.name);
  const { disabled, disabledNames } = await disableSameSlot(game.paksDir, cfg.libraryDir, slot);
  // 缺签名时，用游戏自带 dat*.sig 复制一份改名为 <mod名>.sig
  let sigGenerated = false;
  if (!mod.sigPath) {
    const baseSig = findBaseSig(game.paksDir);
    if (baseSig) {
      const sigDest = path.join(path.dirname(mod.pakPath), path.basename(mod.pakPath, '.pak') + '.sig');
      await fsp.copyFile(baseSig, sigDest).catch(() => {});
      mod.sigPath = fs.existsSync(sigDest) ? sigDest : null;
      sigGenerated = !!mod.sigPath;
    }
  }
  const name = await transferMod(mod, dest, false);
  return { ok: true, name, disabled, disabledNames, sigGenerated };
});

ipcMain.handle('uninstall', async (_e, { mod }) => {
  const cfg = loadConfig();
  const name = await transferMod(mod, cfg.libraryDir, true);
  await removeCopies(mod);
  return { ok: true, name };
});

// 删除 MOD：代表 + 全部重复副本，随后清理空目录（以库根/~mods 根为停止边界，绝不删根本身）
async function deleteModFiles(mod, stops) {
  const dirs = new Set();
  for (const m of [mod, ...(mod.copies || [])]) {
    for (const p of [m.pakPath, m.sigPath, m.preview, m.descPath]) {
      if (p && fs.existsSync(p)) await fsp.rm(p).catch(() => {});
    }
    if (m.pakPath) dirs.add(path.resolve(path.dirname(m.pakPath)));
  }
  for (const start of dirs) {
    let dir = start;
    for (let i = 0; i < 3; i++) {
      if (stops.includes(dir)) break;
      if (!stops.some((s) => dir.startsWith(s + path.sep))) break;
      try {
        const rest = await fsp.readdir(dir);
        if (rest.length === 0) { await fsp.rmdir(dir); dir = path.resolve(dir, '..'); } else break;
      } catch { break; }
    }
  }
}

ipcMain.handle('delete-mod', async (_e, { mod }) => {
  const cfg = loadConfig();
  const stops = [cfg.libraryDir, ...Object.values(cfg.games).map((g) => path.join(g.paksDir || '', '~mods'))]
    .map((p) => path.resolve(p));
  await deleteModFiles(mod, stops);
  return { ok: true };
});

ipcMain.handle('set-preview', async (_e, { mod }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择预览图',
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths[0]) return { ok: false };
  const dest = mod.pakPath.replace(/\.pak$/i, '') + path.extname(filePaths[0]);
  await fsp.copyFile(filePaths[0], dest);
  return { ok: true, preview: dest };
});

// 导入：选择 pak（可多选，sig/预览图同目录自动带上）；内容重复则跳过、只补预览图
ipcMain.handle('import-mods', async () => {
  const cfg = loadConfig();
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择 MOD 文件（.pak，可多选）',
    filters: [{ name: 'MOD', extensions: ['pak'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled || !filePaths.length) return { ok: false, count: 0, skipped: 0 };
  await fsp.mkdir(cfg.libraryDir, { recursive: true });
  const byHash = new Map();
  for (const m of await scanMods(cfg.libraryDir)) byHash.set(m.hash, m);
  let count = 0;
  let skipped = 0;
  for (const p of filePaths) {
    const base = p.slice(0, -4);
    const h = await hashPak(p).catch(() => null);
    const existing = h ? byHash.get(h) : null;
    if (existing) {
      skipped++;
      if (!existing.preview) {
        for (const ext of IMAGE_EXTS) {
          if (fs.existsSync(base + ext)) {
            await fsp.copyFile(base + ext, existing.pakPath.replace(/\.pak$/i, '') + ext).catch(() => {});
            existing.preview = base + ext;
            break;
          }
        }
      }
      continue;
    }
    await fsp.copyFile(p, path.join(cfg.libraryDir, path.basename(p)));
    for (const ext of ['.sig', ...IMAGE_EXTS]) {
      const src = base + ext;
      if (fs.existsSync(src)) {
        await fsp.copyFile(src, path.join(cfg.libraryDir, path.basename(base) + ext)).catch(() => {});
      }
    }
    if (h) byHash.set(h, { pakPath: path.join(cfg.libraryDir, path.basename(p)), sigPath: null, preview: null });
    count++;
  }
  return { ok: true, count, skipped };
});

// 文件夹导入：递归找 .pak，每个 pak 一个单元；预览图 = 同基名图片，否则同目录第一张图片。
// 内容哈希已在库中 → 只合并预览/签名（绝不复制 pak）；否则整包入"库/<源文件夹名>/"，
// 预览图统一重命名为 <pak基名>.<ext>（顺带兼容任意命名/乱码文件名的封面图）
async function importFromDir(srcDir, libraryDir) {
  const srcRoot = path.resolve(srcDir);
  const libRoot = path.resolve(libraryDir);
  if (srcRoot === libRoot) return { ok: false, msg: '不能导入 MOD 库自身' };
  const result = { ok: true, added: 0, merged: 0, errors: [] };
  await fsp.mkdir(libraryDir, { recursive: true });

  const byHash = new Map();
  for (const m of await scanMods(libraryDir)) byHash.set(m.hash, m);

  const units = [];
  async function walk(dir, depth) {
    if (depth > 8) return;
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === '~mods' || path.resolve(full) === libRoot) continue;
        await walk(full, depth + 1);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.pak')) {
        units.push({ pakPath: full, dir });
      }
    }
  }
  await walk(srcRoot, 0);

  for (const u of units) {
    try {
      const base = u.pakPath.slice(0, -4);
      const sigSrc = fs.existsSync(base + '.sig') ? base + '.sig' : null;
      let previewSrc = null;
      for (const ext of IMAGE_EXTS) {
        if (fs.existsSync(base + ext)) { previewSrc = base + ext; break; }
      }
      if (!previewSrc) {
        for (const n of (await fsp.readdir(u.dir)).sort()) {
          if (IMAGE_EXTS.includes(path.extname(n).toLowerCase())) { previewSrc = path.join(u.dir, n); break; }
        }
      }
      const h = await hashPak(u.pakPath);
      const existing = byHash.get(h);
      if (existing) {
        result.merged++;
        const eBase = existing.pakPath.replace(/\.pak$/i, '');
        if (!existing.sigPath && sigSrc) {
          await fsp.copyFile(sigSrc, eBase + '.sig').catch(() => {});
          existing.sigPath = eBase + '.sig';
        }
        if (!existing.preview && previewSrc) {
          const dest = eBase + path.extname(previewSrc).toLowerCase();
          await fsp.copyFile(previewSrc, dest).catch(() => {});
          existing.preview = dest;
        }
        continue;
      }
      const folderName = path.resolve(u.dir) === srcRoot ? path.basename(srcRoot) : path.basename(u.dir);
      let dest = path.join(libraryDir, folderName);
      for (let i = 2; fs.existsSync(path.join(dest, path.basename(u.pakPath))); i++) {
        dest = path.join(libraryDir, folderName + '_' + i);
      }
      await fsp.mkdir(dest, { recursive: true });
      const destPak = path.join(dest, path.basename(u.pakPath));
      const destBase = destPak.slice(0, -4);
      await fsp.copyFile(u.pakPath, destPak);
      if (sigSrc) await fsp.copyFile(sigSrc, destBase + '.sig').catch(() => {});
      if (previewSrc) await fsp.copyFile(previewSrc, destBase + path.extname(previewSrc).toLowerCase()).catch(() => {});
      byHash.set(h, {
        pakPath: destPak,
        sigPath: sigSrc ? destBase + '.sig' : null,
        preview: previewSrc ? destBase + path.extname(previewSrc).toLowerCase() : null,
      });
      result.added++;
    } catch (e) {
      result.errors.push(path.basename(u.pakPath) + ': ' + e.message);
    }
  }
  return result;
}

ipcMain.handle('import-folder', async () => {
  const cfg = loadConfig();
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择 MOD 文件夹（递归查找 .pak，自动去重）',
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths[0]) return { ok: false };
  return importFromDir(filePaths[0], cfg.libraryDir);
});

ipcMain.handle('resign', async (_e, { mod, gameKey }) => {
  // 用游戏自带 dat*.sig 给 mod 重签（mod 自带签名与游戏版本不匹配导致拒载时的修复手段）
  const cfg = loadConfig();
  const paksDir = cfg.games[gameKey].paksDir;
  const baseSig = findBaseSig(paksDir);
  if (!baseSig) return { ok: false, msg: '游戏目录下找不到 dat*-WindowsNoEditor.sig' };
  const target = mod.sigPath || (mod.pakPath.replace(/\.pak$/i, '') + '.sig');
  await fsp.copyFile(baseSig, target);
  return { ok: true, sigPath: target };
});

ipcMain.handle('launch-game', async (_e, { gameKey }) => {
  const cfg = loadConfig();
  const exe = cfg.games[gameKey].exe;
  if (!exe || !fs.existsSync(exe)) return { ok: false, msg: '游戏 exe 路径无效，请在设置中修改' };
  const { spawn } = require('child_process');
  spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore' }).unref();
  return { ok: true };
});

ipcMain.handle('open-path', (_e, p) => {
  if (!p || !fs.existsSync(p)) return { ok: false, msg: '未找到游戏目录：请先安装游戏，或到「设置」自动检测 / 选择游戏根目录' };
  shell.openPath(p);
  return { ok: true };
});
ipcMain.handle('read-image', (_e, p) => {
  const data = fs.readFileSync(p);
  return 'data:image/' + path.extname(p).slice(1).replace('jpeg', 'jpg') + ';base64,' + data.toString('base64');
});

// 打开外部链接（更新入口用）：仅允许 http/https，渲染进程不直接导航（CSP 也拦）
ipcMain.handle('open-external', (_e, url) => {
  try {
    const u = new URL(String(url || '').trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, msg: '只允许打开 http/https 链接' };
    shell.openExternal(u.href);
    return { ok: true };
  } catch {
    return { ok: false, msg: '链接无效' };
  }
});

// 版本号 / 更新链接 / 打赏二维码（renderer/assets/donate-qr.png，用户放入即生效）
ipcMain.handle('get-extras', () => {
  const cfg = loadConfig();
  const qrPath = path.join(__dirname, 'renderer', 'assets', 'donate-qr.png');
  let donateQr = null;
  try {
    if (fs.existsSync(qrPath)) donateQr = 'data:image/png;base64,' + fs.readFileSync(qrPath).toString('base64');
  } catch {}
  return { version: require('./package.json').version, updateUrl: (cfg.updateUrl || '').trim(), donateQr };
});

// 沙箱自检（set PM_DEDUP=1 触发）：在系统临时目录验证 去重/删除/导入/守卫 逻辑，
// 零接触真实 MOD 库、config 与游戏目录
async function runDedupSelfTest() {
  const log = (m) => console.log('[DEDUP]', m);
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); log('OK ' + msg); };
  const w = (p, content) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm7-dedup-'));
  try {
    const libDir = path.join(tmp, 'lib');
    const modsDir = path.join(tmp, 'paks', '~mods');
    fs.mkdirSync(libDir, { recursive: true });
    fs.mkdirSync(modsDir, { recursive: true });
    const stops = [libDir, modsDir].map((p) => path.resolve(p));

    // 1) 同内容两份（根 + 子目录）→ 只出一张卡，代表取有预览的更深目录
    w(path.join(libDir, 'skinA.pak'), 'PAK-A');
    w(path.join(libDir, 'skinA.sig'), 'SIG');
    w(path.join(libDir, 'sub', 'skinA.pak'), 'PAK-A');
    w(path.join(libDir, 'sub', 'skinA.png'), 'IMG');
    let lib = await scanMods(libDir);
    assert(lib.length === 1, '重复 pak 归并为 1 卡（实际 ' + lib.length + '）');
    assert(lib[0].copies.length === 1, '代表携带 1 条副本记录');
    assert(path.dirname(lib[0].pakPath) === path.join(libDir, 'sub'), '代表取有预览的更深目录');

    // 2) 删除代表 + 副本，清空目录但不删库根
    await deleteModFiles(lib[0], stops);
    lib = await scanMods(libDir);
    assert(lib.length === 0, '删除后无卡片残留');
    assert(fs.existsSync(libDir) && !fs.existsSync(path.join(libDir, 'sub')), '空子目录已清理、库根保留');

    // 3) importFromDir：拒绝导入库自身；首次新增并归一化预览名；跳过 ~mods 目录
    assert((await importFromDir(libDir, libDir)).ok === false, '拒绝导入 MOD 库自身');
    const srcRoot = path.join(tmp, 'src');
    w(path.join(srcRoot, '红裙MOD', 'hq.pak'), 'PAK-HQ');
    w(path.join(srcRoot, '红裙MOD', 'hq.sig'), 'SIG-HQ');
    w(path.join(srcRoot, '红裙MOD', 'cover任意名.jpg'), 'IMG-HQ');
    w(path.join(srcRoot, '~mods', 'bad.pak'), 'SHOULD-NOT-IMPORT');
    let r = await importFromDir(srcRoot, libDir);
    assert(r.added === 1 && r.merged === 0 && r.errors.length === 0, '首次导入 added=1 merged=0 无错误');
    assert(fs.existsSync(path.join(libDir, '红裙MOD', 'hq.jpg')), '任意命名预览图已归一为 pak 基名');
    assert(!fs.existsSync(path.join(libDir, '~mods')), '~mods 目录被跳过');

    // 4) 重复导入同一目录 → 只合并预览，不新增 pak
    fs.rmSync(path.join(libDir, '红裙MOD', 'hq.jpg'));
    r = await importFromDir(srcRoot, libDir);
    assert(r.added === 0 && r.merged === 1, '重复导入 added=0 merged=1');
    assert(fs.existsSync(path.join(libDir, '红裙MOD', 'hq.jpg')), '预览图已合并到既有条目');
    lib = await scanMods(libDir);
    assert(lib.length === 1, '库仍只有 1 张卡');

    // 5) 停用守卫：同名同内容删副本无散件；同名不同内容进 _移回备份
    w(path.join(modsDir, 'hq.pak'), 'PAK-HQ');
    await transferMod((await scanMods(modsDir))[0], libDir, true);
    assert(!fs.existsSync(path.join(libDir, 'hq.pak')) && !fs.existsSync(path.join(modsDir, 'hq.pak')),
      '同名同内容：~mods 副本被删、库根无散件');
    w(path.join(modsDir, 'hq.pak'), 'PAK-HQ-V2');
    await transferMod((await scanMods(modsDir))[0], libDir, true);
    assert(fs.existsSync(path.join(libDir, '_移回备份', 'hq.pak')) && !fs.existsSync(path.join(modsDir, 'hq.pak')),
      '同名不同内容：移入 _移回备份');

    // 6) 哈希缓存随内容变化失效
    const hp = path.join(tmp, 'cache.pak');
    w(hp, 'V1');
    const h1 = await hashPak(hp);
    fs.writeFileSync(hp, 'V2-longer');
    assert((await hashPak(hp)) !== h1, '哈希缓存随内容变化失效');

    // 7) 槽位归一：女1≡月清疏≡拼音 同槽互斥；不同角色、武器与服装共存
    const slotOf = (n, d) => classify(n, d || '').slot;
    assert(slotOf('刀战学院_女1_服装1白色_人体美白.pak') === slotOf('月清疏_纱婉琅派_校服配色.pak'), '女1 与 月清疏 判同槽');
    assert(slotOf('yqs_lk_P.pak') === slotOf('月清疏_mod_赵灵儿套.pak'), '拼音 yqs 归入月清疏槽');
    assert(slotOf('YueQingShuJinQiu_P.pak') === slotOf('刀战学院_女1_服装1白色.pak'), '全拼归入月清疏槽');
    assert(slotOf('刀战学院_女2_服装1白色.pak') === slotOf('白茉晴_云纹套.pak'), '女2 与 白茉晴 判同槽');
    assert(slotOf('刀战学院_男2_服装1牛马_烟熏妆.pak') === slotOf('桑游_苗服.pak'), '男2 与 桑游 判同槽');
    assert(slotOf('刀战学院_男1_服装1白色.pak') !== slotOf('刀战学院_女1_服装1白色.pak'), '男1 与 女1 不同槽');
    assert(slotOf('刀战学院_武器_碧海剑_赤红.pak') !== slotOf('刀战学院_女1_服装1白色.pak'), '武器与服装不同槽');
    w(path.join(modsDir, '刀战学院_女1_服装1白色.pak'), 'PAK-NV1');
    let ds = await disableSameSlot(path.join(tmp, 'paks'), libDir, slotOf('月清疏_纱婉琅派.pak'));
    assert(ds.disabled === 1, '启用月清疏自动停用女1（disabled=' + ds.disabled + '）');
    w(path.join(modsDir, '刀战学院_男1_服装1白色.pak'), 'PAK-NAN1');
    ds = await disableSameSlot(path.join(tmp, 'paks'), libDir, slotOf('月清疏_纱婉琅派.pak'));
    assert(ds.disabled === 0, '月清疏与男1共存（disabled=' + ds.disabled + '）');

    // 8) 功能性 MOD 归「其他」：Remove*/nude 关键词；角色解析 pak 名优先于目录名
    const cls = (n, d) => classify(n, d || '');
    const nudeDir = '3dmmods_BMQ and YQS nude mod_id191096_fid215275';
    assert(cls('RemoveSkirtMod.pak', 'YueQingshu_Mod2b_RemoveSkirt').category === '其他', 'RemoveSkirt 归其他');
    assert(cls('RemoveSkirtMod.pak', 'YueQingshu_Mod2b_RemoveSkirt').role === '月清疏', 'RemoveSkirt 借目录名解析出月清疏');
    assert(cls('BaiMoQing_P.pak', nudeDir).category === '其他', 'nude 目录关键词归其他');
    assert(cls('BaiMoQing_P.pak', nudeDir).role === '白茉晴', 'BaiMoQing 自身名优先于目录里的 YQS');
    assert(cls('YueQingShu_P.pak', nudeDir).role === '月清疏', 'YueQingShu 解析为月清疏');
    assert(cls('BaiMoQing_P.pak', nudeDir).slot === slotOf('刀战学院_女2_服装1白色.pak'), '果体MOD与同角色服装同槽互斥');
    assert(cls('YueQingShu_P.pak', nudeDir).slot === slotOf('RemoveSkirtMod.pak', 'YueQingshu_Mod2b_RemoveSkirt'), '同角色两个功能性MOD互斥');
    assert(cls('SomeFunc.pak', '锅体').category === '其他', '锅体(果体谐音)目录归其他');
    assert(cls('月清疏mod赵灵儿套.pak').category === '服装', '普通服装不受影响');
    assert(cls('刀战学院_武器_碧海剑_赤红.pak').category === '武器', '武器分类不受影响');

    // 9) 说明侧车：同名 .txt 首行上卡片，其余行忽略
    w(path.join(libDir, 'descmod', 'RemoveSkirtMod.pak'), 'PAK-DESC');
    w(path.join(libDir, 'descmod', 'RemoveSkirtMod.txt'), '不要裙子\n第二行忽略');
    const dm = (await scanMods(libDir)).find((m) => m.name === 'RemoveSkirtMod');
    assert(dm && dm.desc === '不要裙子', '同名 txt 首行作为说明');

    log('ALL-OK');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

let mainWin = null;
ipcMain.on('win-min', () => mainWin && mainWin.minimize());
ipcMain.on('win-close', () => mainWin && mainWin.close());

function createWindow() {
  const win = mainWin = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    backgroundColor: '#14161a',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 离屏截图模式：set PM_SHOT=1，渲染 DLC 页并存 shot-dlc.png（不发界面给用户，供开发自检）
  if (process.env.PM_SHOT) {
    win.hide();
    const shotWin = new BrowserWindow({
      width: 1280, height: 820, show: false, frame: false,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), offscreen: true },
    });
    shotWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    shotWin.webContents.once('did-finish-load', async () => {
      try {
        await new Promise((r) => setTimeout(r, 3000));
        await shotWin.webContents.executeJavaScript("document.querySelectorAll('.nav-item')[1].click()");
        await new Promise((r) => setTimeout(r, 600));
        await shotWin.webContents.executeJavaScript("document.querySelector('.scroll').scrollTop = 700");
        await new Promise((r) => setTimeout(r, 1200));
        const img = await shotWin.webContents.capturePage();
        fs.writeFileSync(path.join(__dirname, 'shot-dlc.png'), img.toPNG());
        console.log('[SHOT] ok');
      } catch (e) { console.log('[SHOT] fail: ' + e.message); }
      app.quit();
    });
  }

  // 隐藏自测模式：set PM_TEST=1，验证多 MOD 槽位共存规则
  if (process.env.PM_TEST) {
    win.hide();
    win.webContents.once('did-finish-load', async () => {
      const log = (m) => console.log('[TEST]', m);
      const js = (code) => win.webContents.executeJavaScript(code);
      const P = (o) => JSON.stringify(JSON.parse(JSON.stringify(o)));
      const install = (m) => js('window.api.install({mod: ' + P(m) + ", gameKey: 'dlc'})");
      try {
        let s = await js('window.api.scan()');
        // 先全部停用，从干净状态开始
        for (const m of s.games.dlc.installed) await js('window.api.uninstall({mod: ' + P(m) + '})');
        s = await js('window.api.scan()');
        const lib = s.games.dlc.library;
        const pick = (kw) => lib.find((m) => m.name.includes(kw));
        const skin1 = pick('女1_服装1白色');
        const weapon1 = pick('武器_碧海剑');
        const weapon2 = pick('武器_青天剑');
        const skinOther = pick('男1_服装1白色');
        if (!skin1 || !weapon1 || !weapon2 || !skinOther) throw new Error('pick failed: ' + lib.map(m=>m.name).join(','));
        let r;
        r = await install(skin1);  log('1) enable 女1皮肤 -> disabled=' + r.disabled + ' ok=' + r.ok);
        r = await install(weapon1); log('2) enable 碧海剑(不同槽) -> disabled=' + r.disabled + ' (期望0, 共存)');
        let n = (await js('window.api.scan()')).games.dlc.installed.length;
        log('   installed=' + n + ' (期望2)');
        r = await install(weapon2); log('3) enable 青天剑(另一武器,不同槽) -> disabled=' + r.disabled + ' (期望0)');
        n = (await js('window.api.scan()')).games.dlc.installed.length;
        log('   installed=' + n + ' (期望3)');
        r = await install(skinOther); log('4) enable 男1皮肤(另一角色,不同槽) -> disabled=' + r.disabled + ' (期望0)');
        n = (await js('window.api.scan()')).games.dlc.installed.length;
        log('   installed=' + n + ' (期望4)');
        r = await install(skin1);
        log('5) re-enable same 女1 skin -> disabled=' + r.disabled + ' (期望1)');
        n = (await js('window.api.scan()')).games.dlc.installed.length;
        log('   installed=' + n + ' (期望4, 总数不变)');
        if (n !== 4) throw new Error('coexistence rule broken');
        log('ALL-OK');
      } catch (e) { log('FAIL: ' + e.message); }
      finally { app.quit(); }
    });
  }
  // 重签接口快速验证：set PM_RESIGN=1
  if (process.env.PM_RESIGN) {
    win.hide();
    win.webContents.once('did-finish-load', async () => {
      try {
        const s = await win.webContents.executeJavaScript('window.api.scan()');
        const target = s.games.dlc.installed.find((m) => m.name.includes('JinQiu')) ||
                       s.games.dlc.library.find((m) => m.name.includes('JinQiu'));
        if (!target) throw new Error('JinQiu mod not found');
        const before = fs.existsSync(target.sigPath) ? fs.readFileSync(target.sigPath).length : -1;
        const r = await win.webContents.executeJavaScript(
          `window.api.resign({mod: ${JSON.stringify(JSON.parse(JSON.stringify(target)))}, gameKey: 'dlc'})`);
        const after = fs.readFileSync(target.sigPath || r.sigPath).length;
        const base = fs.readFileSync(findBaseSig(loadConfig().games.dlc.paksDir)).length;
        console.log('[RESIGN]', 'ok=' + r.ok, 'sig before=' + before, 'after=' + after, 'base=' + base, 'match=' + (after === base));
        console.log(after === base && r.ok ? 'RESIGN-OK' : 'RESIGN-FAIL');
      } catch (e) { console.log('[RESIGN] FAIL: ' + e.message); }
      finally { app.quit(); }
    });
  }

  // 完整 UI 自动化验证：set PM_UI=1，真实点击 DOM 按钮走完整个交互流程，逐步断言+截图
  if (process.env.PM_UI) {
    win.hide();
    const uw = new BrowserWindow({
      width: 1280, height: 820, show: false, frame: false,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), offscreen: true },
    });
    uw.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    uw.webContents.once('did-finish-load', async () => {
      const log = (m) => console.log('[UI]', m);
      let failed = false;
      const shot = async (name) => {
        const img = await uw.webContents.capturePage();
        fs.writeFileSync(path.join(__dirname, name), img.toPNG());
      };
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const js = (code) => uw.webContents.executeJavaScript(code);
      try {
        await sleep(2500);
        await js("document.querySelectorAll('.nav-item')[1].click()"); // DLC 页
        await sleep(600);

        // 0) 清场：全部停用
        await js("(()=>{const b=[...document.querySelectorAll('.section-title .btn')].find(x=>x.textContent.includes('全部停用')); if(b) b.click();})()");
        await sleep(800);
        let n = (await js("document.querySelectorAll('.section')[0].querySelectorAll('.card').length"));
        log('0) 清场后 当前生效=' + n + ' (期望0)');
        if (n !== 0) throw new Error('清场失败');

        // 1) 库里点卡片悬浮「启用」：女1皮肤
        await js("(()=>{const c=[...document.querySelectorAll('.section')[1].querySelectorAll('.card')].find(x=>x.textContent.includes('女1_服装1白色')); [...c.querySelectorAll('.obtn')].find(b=>b.textContent.trim()==='启用').click();})()");
        await sleep(800);
        n = (await js("document.querySelectorAll('.section')[0].querySelectorAll('.card').length"));
        const badged = (await js("!!document.querySelector('.badge-installed')"));
        log('1) 卡片「启用」女1皮肤 -> 当前生效=' + n + ' (期望1) 生效徽标=' + badged);
        if (n !== 1 || !badged) throw new Error('启用失败');

        // 2) 再启用碧海剑（不同槽位应共存）
        await js("(()=>{const c=[...document.querySelectorAll('.section')[1].querySelectorAll('.card')].find(x=>x.textContent.includes('武器_碧海剑')); [...c.querySelectorAll('.obtn')].find(b=>b.textContent.trim()==='启用').click();})()");
        await sleep(800);
        n = (await js("document.querySelectorAll('.section')[0].querySelectorAll('.card').length"));
        log('2) 卡片「启用」碧海剑 -> 当前生效=' + n + ' (期望2, 共存)');
        if (n !== 2) throw new Error('共存失败');

        // 3) 点卡片图片 → 大图预览
        await js("(()=>{const c=[...document.querySelectorAll('.section')[1].querySelectorAll('.card')].find(x=>x.textContent.includes('武器_青天剑')); c.querySelector('.preview').click();})()");
        await sleep(600);
        const lb = (await js("!!document.querySelector('.lightbox')"));
        const lbBtns = (await js("[...(document.querySelector('.lightbox')?.querySelectorAll('.obtn')||[])].map(b=>b.textContent.trim()).join(',')"));
        log('3) 点击图片 -> 大图打开=' + lb + ' 弹层按钮=[' + lbBtns + ']');
        if (!lb) throw new Error('大图未打开');
        await shot('shot-ui-1-lightbox.png');

        // 4) 在大图弹层里直接点「启用」
        await js("[...document.querySelectorAll('.lightbox .obtn')].find(b=>b.textContent.trim()==='启用').click()");
        await sleep(800);
        n = (await js("document.querySelectorAll('.section')[0].querySelectorAll('.card').length"));
        const lbClosed = (await js("!document.querySelector('.lightbox')"));
        log('4) 大图内「启用」青天剑 -> 当前生效=' + n + ' (期望3) 弹层已关=' + lbClosed);
        if (n !== 3 || !lbClosed) throw new Error('大图内启用失败');
        await shot('shot-ui-2-installed3.png');

        // 5) 大图内「停用」：打开男1皮肤大图 → 停用 → 失败预期它未启用？先启用它
        await js("(()=>{const c=[...document.querySelectorAll('.section')[1].querySelectorAll('.card')].find(x=>x.textContent.includes('男1_服装1白色')); c.querySelector('.preview').click();})()");
        await sleep(500);
        await js("[...document.querySelectorAll('.lightbox .obtn')].find(b=>b.textContent.trim()==='启用').click()");
        await sleep(800);
        // 打开已启用的男1 大图并停用
        await js("(()=>{const c=[...document.querySelectorAll('.section')[0].querySelectorAll('.card')].find(x=>x.textContent.includes('男1_服装1白色')); c.querySelector('.preview').click();})()");
        await sleep(500);
        const stopInLb = (await js("[...document.querySelectorAll('.lightbox .obtn')].map(b=>b.textContent.trim()).join(',')"));
        await js("[...document.querySelectorAll('.lightbox .obtn')].find(b=>b.textContent.trim()==='停用').click()");
        await sleep(800);
        n = (await js("document.querySelectorAll('.section')[0].querySelectorAll('.card').length"));
        log('5) 已启用卡片大图按钮=[' + stopInLb + '] 停用后生效=' + n + ' (期望3)');
        if (n !== 3) throw new Error('大图内停用失败');

        // 6) 「全部停用」
        await js("(()=>{const b=[...document.querySelectorAll('.section-title .btn')].find(x=>x.textContent.includes('全部停用')); b.click();})()");
        await sleep(900);
        n = (await js("document.querySelectorAll('.section')[0].querySelectorAll('.card').length"));
        log('6) 全部停用 -> 当前生效=' + n + ' (期望0)');
        if (n !== 0) throw new Error('全部停用失败');
        await shot('shot-ui-3-clean.png');

        // 7) 恢复原状态：重新启用 RemoveTights
        await js("(()=>{const c=[...document.querySelectorAll('.section')[1].querySelectorAll('.card')].find(x=>x.textContent.includes('RemoveTights')); if(c) [...c.querySelectorAll('.obtn')].find(b=>b.textContent.trim()==='启用').click();})()");
        await sleep(800);
        n = (await js("document.querySelectorAll('.section')[0].querySelectorAll('.card').length"));
        log('7) 恢复 RemoveTights -> 当前生效=' + n + ' (期望1)');
        if (n !== 1) throw new Error('恢复失败');
        log('UI-ALL-OK');
      } catch (e) { failed = true; log('FAIL: ' + e.message); }
      finally { app.quit(); }
    });
  }

  // 只读 UI 验证模式：set PM_EXTRAS=1，校验 更新/打赏 弹窗、导入按钮、设置页字段并截图
  //（截图写入系统临时目录，全程不触碰 MOD 库与 config）
  if (process.env.PM_EXTRAS) {
    win.hide();
    const ew = new BrowserWindow({
      width: 1280, height: 820, show: false, frame: false,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), offscreen: true },
    });
    let pageErr = 0;
    ew.webContents.on('console-message', (_e, level, message) => {
      if (level >= 2) { pageErr++; console.log('[EXTRAS] PAGE-ERR ' + message); }
    });
    ew.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    ew.webContents.once('did-finish-load', async () => {
      const log = (m) => console.log('[EXTRAS]', m);
      try {
        await new Promise((r) => setTimeout(r, 2500));
        const js = (code) => ew.webContents.executeJavaScript(code);
        const shot = async (name) => fs.writeFileSync(path.join(os.tmpdir(), name), (await ew.webContents.capturePage()).toPNG());
        const extras = await js('window.api.getExtras()');
        log('version=' + extras.version + ' updateUrl="' + extras.updateUrl + '" donateQr=' + (extras.donateQr ? 'yes' : 'no'));
        await shot('pm7-extras-main.png');

        const bad = await js("window.api.openExternal('javascript:alert(1)')");
        log('javascript: 链接被拒=' + (bad.ok === false));

        // 配置了更新链接时真开一次，验证按钮通路（会在浏览器打开该链接）
        let linkOpen = null;
        if (extras.updateUrl) {
          linkOpen = await js('window.api.openExternal(' + JSON.stringify(extras.updateUrl) + ')');
          log('更新链接打开结果=' + JSON.stringify(linkOpen));
        }

        // 更新弹窗：链接未配置时显提示，配置后显金色按钮
        await js("(()=>{[...document.querySelectorAll('.nav-item')].find(x=>x.textContent.includes('更新')).click();})()");
        await new Promise((r) => setTimeout(r, 120));
        await shot('pm7-extras-modal-enter.png');
        await new Promise((r) => setTimeout(r, 500));
        const updOpen = await js("[...document.querySelectorAll('.modal-title')].some(x=>x.textContent.includes('检查更新'))");
        const updState = await js('!!document.querySelector(".modal-mask .btn-gold") === ' + (!!extras.updateUrl));
        log('更新弹窗打开=' + updOpen + ' 链接状态匹配=' + updState);
        await shot('pm7-extras-update.png');
        await js("(()=>{[...document.querySelectorAll('.modal-actions .btn')].find(x=>x.textContent.includes('关闭')).click();})()");
        await new Promise((r) => setTimeout(r, 400));

        // 打赏弹窗：提示文字必须在二维码框之外，且仅在无图时出现
        await js("document.querySelector('.donate-entry').click()");
        await new Promise((r) => setTimeout(r, 600));
        const hasQr = !!extras.donateQr;
        const donateOk = await js('!!document.querySelector(".donate-qr-frame") && ' +
          '(!!document.querySelector(".donate-qr-frame img") === ' + hasQr + ') && ' +
          '([...document.querySelectorAll(".modal-hint")].some(x=>x.textContent.includes("二维码")) === ' + (!hasQr) + ') && ' +
          '!document.querySelector(".donate-qr-frame .modal-hint")');
        log('打赏弹窗状态正确=' + donateOk);
        await shot('pm7-extras-donate.png');
        await js("(()=>{[...document.querySelectorAll('.modal-actions .btn')].find(x=>x.textContent.includes('关闭')).click();})()");
        await new Promise((r) => setTimeout(r, 400));

        // 作者主页入口：必须紧跟打赏按钮，且真开一次验证通路
        const authorPos = await js('(()=>{const d=document.querySelector(".donate-entry"); const a=document.querySelector(".author-entry");' +
          'return !!a && !!d && d.nextElementSibling===a && a.title==="https://ktboy.github.io/sh-design/guide/about";})()');
        const authorOpen = await js('window.api.openExternal("https://ktboy.github.io/sh-design/guide/about")');
        log('作者入口位置=' + authorPos + ' 打开结果=' + JSON.stringify(authorOpen));

        const importBtn = await js("[...document.querySelectorAll('.toolbar-actions .btn')].some(x=>x.textContent.includes('导入 MOD'))");
        const openGuard = await js('window.api.openPath("C:/pm7-no-such-dir-xyz")');
        const openEmpty = await js('window.api.openPath("")');
        log('打开目录守卫 不存在=' + JSON.stringify(openGuard) + ' 空路径=' + JSON.stringify(openEmpty));

        // 微交互实测：真实鼠标事件触发 :hover/:active（按压选「放大」——只读，不碰库）
        const htmlSrc = fs.readFileSync(path.join(__dirname, 'renderer', 'index.html'), 'utf8');
        const cssSrc = fs.readFileSync(path.join(__dirname, 'renderer', 'style.css'), 'utf8');
        const appSrc = fs.readFileSync(path.join(__dirname, 'renderer', 'app.js'), 'utf8');
        const wiringOk = htmlSrc.includes(':class="{spin: loading}"') && htmlSrc.includes("'is-loading': loading") &&
          htmlSrc.includes('<transition name="modal">') && htmlSrc.includes('<transition name="lb">') &&
          cssSrc.includes('@keyframes hud-rot') && cssSrc.includes('.btn.is-loading') && cssSrc.includes('.modal-enter-from .modal-panel') &&
          appSrc.includes('if (loading.value) { refreshQueued = true; return; }');
        const goldRect = await js('(()=>{const g=document.querySelectorAll(".grid")[1]; const b=g&&g.querySelector(".obtn-gold"); if(!b) return null; b.scrollIntoView({block:"center"}); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2};})()');
        let hoverShot = false;
        if (goldRect) {
          ew.webContents.sendInputEvent({ type: 'mouseMove', x: goldRect.x, y: goldRect.y });
          await new Promise((r) => setTimeout(r, 260));
          await shot('pm7-extras-hover.png'); hoverShot = true;
        }
        const zoomRect = await js('(()=>{const g=document.querySelectorAll(".grid")[1]; const b=g&&g.querySelector(".card .actions .obtn:last-child"); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2};})()');
        let pressShot = false, lbEnter = false;
        if (zoomRect) {
          ew.webContents.sendInputEvent({ type: 'mouseMove', x: zoomRect.x, y: zoomRect.y });
          await new Promise((r) => setTimeout(r, 200));
          ew.webContents.sendInputEvent({ type: 'mouseDown', x: zoomRect.x, y: zoomRect.y, button: 'left', clickCount: 1 });
          await new Promise((r) => setTimeout(r, 90));
          await shot('pm7-extras-press.png'); pressShot = true;
          ew.webContents.sendInputEvent({ type: 'mouseUp', x: zoomRect.x, y: zoomRect.y, button: 'left', clickCount: 1 });
          await new Promise((r) => setTimeout(r, 120));
          await shot('pm7-extras-lb-enter.png'); lbEnter = true;
          await new Promise((r) => setTimeout(r, 400));
          await shot('pm7-extras-lightbox.png');
          await js("(()=>{[...document.querySelectorAll('.lb-toolbar .obtn')].find(x=>x.textContent.includes('关闭')).click();})()");
          await new Promise((r) => setTimeout(r, 300));
          ew.webContents.sendInputEvent({ type: 'mouseMove', x: 5, y: 5 });
        }
        // 刷新按钮零抖动实测：恒宽文案、不切 disabled，按压全周期几何漂移=0（扫描只读，不碰库）
        const rSel = '[...document.querySelectorAll(".toolbar-actions .btn")].find(x=>x.textContent.includes("刷新"))';
        const rGet = '(()=>{const b=' + rSel + '; const r=b.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,label:b.textContent.trim(),disabled:b.disabled,loading:b.classList.contains("is-loading"),spin:!!b.querySelector("svg.spin")};})()';
        const r0 = await js(rGet);
        const rc = { x: r0.x + r0.w / 2, y: r0.y + r0.h / 2 };
        ew.webContents.sendInputEvent({ type: 'mouseMove', x: rc.x, y: rc.y });
        await new Promise((r) => setTimeout(r, 200));
        ew.webContents.sendInputEvent({ type: 'mouseDown', x: rc.x, y: rc.y, button: 'left', clickCount: 1 });
        await new Promise((r) => setTimeout(r, 90));
        const rPress = await js(rGet);
        await shot('pm7-extras-refresh-press.png');
        ew.webContents.sendInputEvent({ type: 'mouseUp', x: rc.x, y: rc.y, button: 'left', clickCount: 1 });
        let spinSeen = false;
        for (let i = 0; i < 50 && !spinSeen; i++) {
          const s = await js(rGet);
          if (s.spin && s.loading) { spinSeen = true; await shot('pm7-extras-refresh.png'); }
          else await new Promise((r) => setTimeout(r, 4));
        }
        // 快速连点：重入守卫应吞掉重复扫描，状态干净收敛
        ew.webContents.sendInputEvent({ type: 'mouseDown', x: rc.x, y: rc.y, button: 'left', clickCount: 1 });
        ew.webContents.sendInputEvent({ type: 'mouseUp', x: rc.x, y: rc.y, button: 'left', clickCount: 1 });
        ew.webContents.sendInputEvent({ type: 'mouseDown', x: rc.x, y: rc.y, button: 'left', clickCount: 2 });
        ew.webContents.sendInputEvent({ type: 'mouseUp', x: rc.x, y: rc.y, button: 'left', clickCount: 2 });
        await new Promise((r) => setTimeout(r, 450));
        ew.webContents.sendInputEvent({ type: 'mouseMove', x: 5, y: 5 });
        await new Promise((r) => setTimeout(r, 220));
        const rEnd = await js(rGet);
        const sameRect = (a, b) => Math.abs(a.x - b.x) < .5 && Math.abs(a.y - b.y) < .5 && Math.abs(a.w - b.w) < .5 && Math.abs(a.h - b.h) < .5;
        const refreshStable = sameRect(r0, rEnd) &&
          Math.abs(rPress.w - r0.w * .97) < 1.5 && Math.abs(rPress.h - r0.h * .97) < 1.5 &&
          r0.label === '刷新' && rPress.label === '刷新' && rEnd.label === '刷新' &&
          !rPress.disabled && !rEnd.disabled && !rEnd.loading;
        const hasLib = await js('!!document.querySelectorAll(".grid")[1]');
        log('微交互接线=' + wiringOk + ' 有库=' + hasLib + ' hover截图=' + hoverShot + ' 按压截图=' + pressShot + ' 大图入场截图=' + lbEnter);
        log('刷新零抖动=' + refreshStable + ' 旋转捕捉=' + spinSeen + ' 几何=' + JSON.stringify({ idle: r0, press: rPress, end: rEnd }));
        await js("(()=>{[...document.querySelectorAll('.nav-item')].find(x=>x.textContent.includes('设置')).click();})()");
        await new Promise((r) => setTimeout(r, 500));
        const urlHidden = await js('![...document.querySelectorAll(".field input")].some(x=>(x.placeholder||"").includes("pan.quark.cn")) && ' +
          '!document.querySelector(".settings").textContent.includes("pan.quark.cn")');
        log('导入按钮=' + importBtn + ' 设置夸克链接已隐藏=' + urlHidden);
        await shot('pm7-extras-settings.png');

        // 回 MOD 页统计卡片：去重后应无同名重复、预览图齐全
        await js("(()=>{document.querySelectorAll('.nav-item')[0].click();})()");
        await new Promise((r) => setTimeout(r, 1500));
        // 「其他」分类筛选：筛选栏四项齐全，点「其他」后卡片必须全部带其他标签
        const segTabs = await js("[...document.querySelectorAll('.seg button')].map(b=>b.textContent.trim()).join(',')");
        await js("(()=>{[...document.querySelectorAll('.seg button')].find(b=>b.textContent.trim()==='其他').click();})()");
        await new Promise((r) => setTimeout(r, 400));
        const otherStats = await js('(()=>{const cards=[...document.querySelectorAll(".section")[1].querySelectorAll(".card")];' +
          'return {n:cards.length, allOther:cards.every(c=>[...c.querySelectorAll(".tag")].some(t=>t.textContent.trim()==="其他")),' +
          'names:cards.map(c=>c.querySelector(".name").textContent.trim())};})()');
        log('筛选栏=[' + segTabs + '] 其他页卡片=' + otherStats.n + ' 全部标其他=' + otherStats.allOther + ' ' + JSON.stringify(otherStats.names));
        const rsDesc = await js('(()=>{const c=[...document.querySelectorAll(".card")].find(x=>x.querySelector(".name").textContent.trim()==="RemoveSkirtMod"); return c?((c.querySelector(".desc")||{}).textContent||"(无)"):"(无卡片)";})()');
        log('RemoveSkirtMod 说明=' + rsDesc);
        await shot('pm7-extras-other-filter.png');
        await js("(()=>{[...document.querySelectorAll('.seg button')].find(b=>b.textContent.trim()==='全部').click();})()");
        await new Promise((r) => setTimeout(r, 400));
        const stats = await js('(()=>{const cards=[...document.querySelectorAll(".section")[1].querySelectorAll(".card")];' +
          'const names=cards.map(c=>c.querySelector(".name").textContent.trim());' +
          'return {total:cards.length, uniq:new Set(names).size, imgs:cards.filter(c=>c.querySelector(".preview img")).length, ph:cards.filter(c=>c.querySelector(".preview .ph")).length,' +
          'otherInAll:cards.filter(c=>[...c.querySelectorAll(".tag")].some(t=>t.textContent.trim()==="其他")).length};})()');
        log('MOD库(全部) 卡片=' + stats.total + ' 去重后=' + stats.uniq + ' 有预览图=' + stats.imgs + ' 无图占位=' + stats.ph + ' 混入其他=' + stats.otherInAll);
        const restartHint = await js('(()=>{const s=document.querySelector(".section-title small"); return !!s && s.textContent.includes("重启游戏");})()');
        log('重启提示常驻=' + restartHint);
        await js("(()=>{const s=document.querySelector('.scroll'); s.scrollTop=s.scrollHeight;})()");
        await new Promise((r) => setTimeout(r, 600));
        await shot('pm7-extras-grid.png');

        console.log(updOpen && updState && donateOk && importBtn && urlHidden && bad.ok === false &&
          authorPos && authorOpen.ok === true &&
          openGuard.ok === false && openEmpty.ok === false &&
          wiringOk && pageErr === 0 && refreshStable && (!hasLib || (hoverShot && pressShot && lbEnter)) && restartHint &&
          (linkOpen === null || linkOpen.ok === true) &&
          segTabs === '全部,服装,武器,其他' && otherStats.allOther && stats.otherInAll === 0 &&
          stats.total === stats.uniq && stats.imgs + stats.ph === stats.total ? 'EXTRAS-OK' : 'EXTRAS-FAIL');
      } catch (e) { log('FAIL: ' + e.message); }
      app.quit();
    });
  }

}

if (process.env.PM_DEDUP) {
  app.whenReady().then(runDedupSelfTest)
    .catch((e) => console.log('[DEDUP] FAIL: ' + e.message))
    .finally(() => app.quit());
} else if (process.env.PM_IMPORT_DL) {
  // 数据操作模式：把指定文件夹导入配置的 MOD 库（自动去重、合并预览图）
  app.whenReady().then(async () => {
    try {
      const r = await importFromDir(process.env.PM_IMPORT_DL, loadConfig().libraryDir);
      console.log('[IMPORT_DL]', JSON.stringify(r));
    } catch (e) { console.log('[IMPORT_DL] FAIL: ' + e.message); }
    app.quit();
  });
} else {
  app.whenReady().then(createWindow);
}
app.on('window-all-closed', () => app.quit());
