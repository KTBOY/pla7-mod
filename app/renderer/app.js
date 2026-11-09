const { createApp, ref, reactive, onMounted, defineComponent } = Vue;

/* ---------- MOD 卡片组件 ---------- */
const ModCard = defineComponent({
  name: 'ModCard',
  props: { mod: Object, installed: Boolean },
  emits: ['install', 'uninstall', 'del', 'preview', 'zoom'],
  data() {
    return { previewUrl: null };
  },
  async created() {
    if (this.mod.preview) {
      try { this.previewUrl = await window.api.readImage(this.mod.preview); } catch {}
    }
  },
  template: `
    <div class="card">
      <div class="preview" @click="$emit('zoom')" title="点击查看大图">
        <img v-if="previewUrl" :src="previewUrl" />
        <span v-else class="ph">无图</span>
        <span v-if="installed" class="badge-installed">生效中</span>
        <!-- 悬浮按钮：半透明，悬停卡片时变清晰 -->
        <div class="overlay" @click.stop>
          <button class="obtn" v-if="installed" @click="$emit('uninstall')">停用</button>
          <button class="obtn obtn-gold" v-else @click="$emit('install')">启用</button>
          <button class="obtn obtn-danger" @click="$emit('del')">删除</button>
          <button class="obtn" title="设为预览图" @click="$emit('preview')">设图</button>
          <button class="obtn" title="查看大图" @click="$emit('zoom')">放大</button>
        </div>
        <div class="zoom-hint" v-if="previewUrl">点击放大</div>
      </div>
      <div class="body">
        <div class="name" :title="mod.name">{{ mod.name }}</div>
        <div class="tags">
          <em class="tag" :class="mod.category === '武器' ? 'tag-weapon' : 'tag-skin'">{{ mod.category || '服装' }}</em>
          <em class="tag" v-if="mod.role">{{ mod.role }}</em>
          <em class="tag tag-warn" v-if="!mod.sigPath" title="启用时会用游戏自带签名自动补一个">无签名</em>
        </div>
        <div class="meta">{{ mod.sizeMB }} MB</div>
      </div>
    </div>
  `,
});

/* ---------- 根应用 ---------- */
const app = createApp({
  components: { ModCard },
  setup() {
    const cfg = ref(null);
    const scanData = ref(null);
    const tab = ref('main');
    const loading = ref(false);
    const toast = reactive({ show: false, text: '', type: 'ok' });
    let toastTimer = null;

    function showToast(text, type = 'ok') {
      toast.show = true; toast.text = text; toast.type = type;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toast.show = false), 2600);
    }

    const gameKeys = ['main', 'dlc'];
    const filter = ref('全部');
    const extras = reactive({ version: '', updateUrl: '', donateQr: null });
    const updateOpen = ref(false);
    const donateOpen = ref(false);
    const zoomMod = ref(null);       // 大图预览的 mod
    const zoomUrl = ref(null);
    async function openZoom(mod) {
      zoomMod.value = mod;
      zoomUrl.value = mod.preview ? await window.api.readImage(mod.preview).catch(() => null) : null;
    }
    function closeZoom() { zoomMod.value = null; zoomUrl.value = null; }
    function filteredLibrary(k) {
      if (!scanData.value) return [];
      const list = scanData.value.games[k].library;
      if (filter.value === '全部') return list;
      return list.filter((m) => (m.category || '服装') === filter.value);
    }
    function tabGlyph(k) { return k === 'main' ? '⚔' : '◈'; }
    function countInstalled(k) {
      return scanData.value ? scanData.value.games[k].installed.length : 0;
    }

    async function refresh() {
      loading.value = true;
      try {
        scanData.value = await window.api.scan();
      } catch (e) {
        showToast('扫描失败：' + e.message, 'error');
      } finally {
        loading.value = false;
      }
    }

    onMounted(async () => {
      cfg.value = await window.api.getConfig();
      loadExtras();
      await refresh();
    });

    // Vue 的响应式 Proxy 无法走 IPC 结构化克隆，必须转纯对象
    const plain = (o) => JSON.parse(JSON.stringify(o));

    // 更新/打赏弹窗的数据每次打开前重拉：二维码、链接后放进来也能即时生效
    async function loadExtras() {
      try { Object.assign(extras, await window.api.getExtras()); } catch {}
    }
    async function openUpdate() { await loadExtras(); updateOpen.value = true; }
    async function openDonate() { await loadExtras(); donateOpen.value = true; }
    function openUpdateUrl() {
      window.api.openExternal(extras.updateUrl).then((r) => {
        if (r && !r.ok) showToast(r.msg || '打开链接失败', 'error');
      });
    }
    // 文件夹导入：递归找 .pak 入库，按内容自动去重，已有 MOD 只合并预览/签名
    async function importFolder() {
      try {
        const r = await window.api.importFolder();
        if (!r || !r.ok) { if (r && r.msg) showToast(r.msg, 'error'); return; }
        const err = r.errors && r.errors.length ? `，失败 ${r.errors.length} 个` : '';
        showToast(`导入完成：新增 ${r.added} · 合并 ${r.merged}${err}`);
        refresh();
      } catch (e) { showToast('导入失败：' + e.message, 'error'); }
    }

    async function install(mod, gameKey) {
      try {
        const r = await window.api.install({ mod: plain(mod), gameKey });
        if (r.ok) {
          const rep = r.disabled > 0 ? `（已替换同槽位：${(r.disabledNames || []).slice(0, r.disabled).join('、')}）` : '（与现有 MOD 共存）';
          showToast(`已启用：${r.name} ${rep}`);
        } else showToast(r.msg || '启用失败', 'error');
      } catch (e) { showToast('启用失败：' + e.message, 'error'); }
      refresh();
    }
    async function uninstallAll(gameKey) {
      const list = scanData.value.games[gameKey].installed;
      for (const m of list) await window.api.uninstall({ mod: plain(m) });
      showToast('已全部停用');
      refresh();
    }
    async function uninstall(mod) {
      try {
        const r = await window.api.uninstall({ mod: plain(mod) });
        showToast(r.ok ? `已停用：${r.name}` : '停用失败', r.ok ? 'ok' : 'error');
      } catch (e) { showToast('停用失败：' + e.message, 'error'); }
      refresh();
    }
    async function del(mod) {
      const copies = mod.copies && mod.copies.length ? `（将一并删除 ${mod.copies.length} 个重复副本）` : '';
      if (!confirm(`确定删除「${mod.name}」？${copies}文件将被移除。`)) return;
      await window.api.deleteMod({ mod: plain(mod) });
      showToast('已删除');
      refresh();
    }
    async function setPreview(mod) {
      try {
        const r = await window.api.setPreview({ mod: plain(mod) });
        if (r.ok) { showToast('预览图已设置'); }
      } catch (e) { showToast('设置失败：' + e.message, 'error'); return; }
      refresh();
    }
    async function importMods() {
      const r = await window.api.importMods();
      if (r.ok) { showToast(`已导入 ${r.count} 个 MOD`); refresh(); }
    }
    async function launch(gameKey) {
      const r = await window.api.launchGame({ gameKey });
      showToast(r.ok ? '游戏已启动（MOD 生效需在启动前启用）' : r.msg, r.ok ? 'ok' : 'error');
    }
    async function resign(mod) {
      try {
        const r = await window.api.resign({ mod: plain(mod), gameKey: tab.value });
        showToast(r.ok ? '已用游戏自带签名重签，重启游戏后生效' : (r.msg || '重签失败'), r.ok ? 'ok' : 'error');
      } catch (e) { showToast('重签失败：' + e.message, 'error'); }
    }
    async function saveSettings() {
      await window.api.saveConfig(JSON.parse(JSON.stringify(cfg.value)));
      showToast('设置已保存');
      refresh();
    }
    // 把检测结果填进设置表单并保存（DLC 未安装则留空）
    function applyDerived(d) {
      cfg.value.games.main.paksDir = d.main.paksDir;
      cfg.value.games.main.exe = d.main.exe || '';
      cfg.value.games.dlc.paksDir = d.dlc.paksDir || '';
      cfg.value.games.dlc.exe = d.dlc.exe || '';
    }
    async function autoDetect(pickedDir) {
      const r = await window.api.detectRoot(pickedDir || null);
      if (!r.ok) { showToast(r.msg || '未检测到游戏', 'error'); return false; }
      applyDerived(r);
      await window.api.saveConfig(JSON.parse(JSON.stringify(cfg.value)));
      showToast('已检测到游戏：' + r.root);
      refresh();
      return true;
    }
    async function pickRoot() {
      const r = await window.api.pickRoot();
      if (!r.ok) return;
      await autoDetect(r.dir);
    }
    function openPath(p) { window.api.openPath(p); }
    function winMin() { window.api.winMin(); }
    function winClose() { window.api.winClose(); }

    return {
      cfg, scanData, tab, loading, toast, gameKeys, filter, filteredLibrary,
      zoomMod, zoomUrl, openZoom, closeZoom,
      tabGlyph, countInstalled, refresh,
      install, uninstall, uninstallAll, del, setPreview, resign, importMods, importFolder, launch,
      saveSettings, autoDetect, pickRoot, openPath, winMin, winClose,
      extras, updateOpen, donateOpen, openUpdate, openDonate, openUpdateUrl,
    };
  },
});

app.mount('#app');
