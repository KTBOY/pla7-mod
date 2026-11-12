const { createApp, ref, reactive, computed, onMounted, defineComponent, watch } = Vue;

/* ---------- 描边图标（内联 SVG，无 emoji） ---------- */
const ICONS = {
  main: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>',
  dlc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 9-9 9-9-9 9-9Z"/><path d="M12 8.5l3.5 3.5-3.5 3.5-3.5-3.5L12 8.5Z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>',
  update: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10Z"/></svg>',
};

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
    <div class="card" :class="{installed: installed}">
      <i class="cn"></i><i class="cn"></i><i class="cn"></i><i class="cn"></i>
      <div class="preview" @click="$emit('zoom')" title="点击查看大图">
        <img v-if="previewUrl" :src="previewUrl" />
        <span v-else class="ph">无图<i>NO PREVIEW</i></span>
      </div>
      <div class="body">
        <div class="name" :title="mod.name">{{ mod.name }}</div>
        <div class="desc" v-if="mod.desc" :title="mod.desc">{{ mod.desc }}</div>
        <div class="tags">
          <em class="tag" :class="mod.category === '武器' ? 'tag-weapon' : mod.category === '其他' ? 'tag-other' : 'tag-skin'">{{ mod.category || '服装' }}</em>
          <em class="tag" v-if="mod.role">{{ mod.role }}</em>
          <em class="tag tag-warn" v-if="!mod.sigPath" title="启用时会用游戏自带签名自动补一个">无签名</em>
        </div>
        <div class="actions">
          <button class="obtn" v-if="installed" @click="$emit('uninstall')">停用</button>
          <button class="obtn obtn-gold" v-else @click="$emit('install')">启用</button>
          <button class="obtn obtn-danger" @click="$emit('del')">删除</button>
          <button class="obtn" title="设为预览图" @click="$emit('preview')">设图</button>
          <button class="obtn" title="查看大图" @click="$emit('zoom')">放大</button>
        </div>
        <div class="meta"><i></i>{{ mod.sizeMB }} MB<span v-if="installed" class="badge-installed"><s></s>生效中</span></div>
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
    // 「其他」功能密码门：默认隐藏，设置里输密码开启后才显示页签与卡片
    const otherOn = computed(() => !!(scanData.value && scanData.value.otherEnabled));
    const filterTabs = computed(() => otherOn.value ? ['全部', '服装', '武器', '其他'] : ['全部', '服装', '武器']);
    const filterIndex = computed(() => filterTabs.value.indexOf(filter.value));
    const isOther = (m) => (m.category || '服装') === '其他';
    function libraryList(k) {
      if (!scanData.value) return [];
      const l = scanData.value.games[k].library;
      return otherOn.value ? l : l.filter((m) => !isOther(m));
    }
    function installedList(k) {
      if (!scanData.value) return [];
      const l = scanData.value.games[k].installed;
      return otherOn.value ? l : l.filter((m) => !isOther(m));
    }
    const totalLibrary = computed(() => scanData.value
      ? libraryList('main').length + libraryList('dlc').length : 0);
    const totalInstalled = computed(() => scanData.value
      ? installedList('main').length + installedList('dlc').length : 0);
    const extras = reactive({ version: '', updateUrl: '', donateQr: null });
    const updateOpen = ref(false);
    const donateOpen = ref(false);
    const pwdOpen = ref(false);
    const pwdInput = ref('');
    const pwdErr = ref('');
    function openUnlock() { pwdInput.value = ''; pwdErr.value = ''; pwdOpen.value = true; }
    async function confirmUnlock() {
      const r = await window.api.unlockOther(pwdInput.value);
      if (r && r.ok) { pwdOpen.value = false; showToast('其他功能已开启'); await refresh(); }
      else pwdErr.value = (r && r.msg) || '密码错误';
    }
    async function lockOther() {
      await window.api.lockOther();
      if (filter.value === '其他') filter.value = '全部';
      showToast('其他功能已隐藏');
      await refresh();
    }
    watch(otherOn, (on) => { if (!on && filter.value === '其他') filter.value = '全部'; });
    const zoomMod = ref(null);       // 大图预览的 mod
    const zoomUrl = ref(null);
    async function openZoom(mod) {
      zoomMod.value = mod;
      zoomUrl.value = mod.preview ? await window.api.readImage(mod.preview).catch(() => null) : null;
    }
    function closeZoom() { zoomMod.value = null; zoomUrl.value = null; }
    function filteredLibrary(k) {
      const list = libraryList(k);
      // 「全部」只看服装+武器，功能性 MOD 归「其他」单独看，避免混进默认列表
      if (filter.value === '全部') return list.filter((m) => !isOther(m));
      return list.filter((m) => (m.category || '服装') === filter.value);
    }
    function tabIcon(k) { return ICONS[k] || ICONS.main; }
    function countInstalled(k) {
      return installedList(k).length;
    }

    let refreshQueued = false;
    async function refresh() {
      if (loading.value) { refreshQueued = true; return; }
      loading.value = true;
      try {
        scanData.value = await window.api.scan();
      } catch (e) {
        showToast('扫描失败：' + e.message, 'error');
      } finally {
        loading.value = false;
        if (refreshQueued) { refreshQueued = false; refresh(); }
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
    function openAuthor() {
      window.api.openExternal('https://ktboy.github.io/sh-design/guide/about').then((r) => {
        if (r && !r.ok) showToast(r.msg || '打开链接失败', 'error');
      });
    }
    // 导入引导弹窗：格式说明 + 文件夹/.pak 双入口，结果在弹窗内展示
    const importOpen = ref(false);
    const importBusy = ref(false);
    const importResult = ref(null);
    function openImport() { importResult.value = null; importOpen.value = true; }
    async function runImport(kind) {
      if (importBusy.value) return;
      importBusy.value = true;
      try {
        const r = kind === 'folder' ? await window.api.importFolder() : await window.api.importMods();
        if (r && r.ok) {
          importResult.value = {
            added: r.added != null ? r.added : (r.count || 0),
            merged: r.merged != null ? r.merged : (r.skipped || 0),
            errors: r.errors || [],
          };
          refresh();
        } else if (r && r.msg) showToast(r.msg, 'error');
      } catch (e) { showToast('导入失败：' + e.message, 'error'); }
      importBusy.value = false;
    }

    async function install(mod, gameKey) {
      try {
        const r = await window.api.install({ mod: plain(mod), gameKey });
        if (r.ok) {
          const rep = r.disabled > 0 ? `（已替换同槽位：${(r.disabledNames || []).slice(0, r.disabled).join('、')}）` : '（与现有 MOD 共存）';
          showToast(`已启用：${r.name} ${rep} · 重启游戏后生效`);
        } else showToast(r.msg || '启用失败', 'error');
      } catch (e) { showToast('启用失败：' + e.message, 'error'); }
      refresh();
    }
    async function uninstallAll(gameKey) {
      const list = scanData.value.games[gameKey].installed;
      for (const m of list) await window.api.uninstall({ mod: plain(m) });
      showToast('已全部停用 · 重启游戏后生效');
      refresh();
    }
    async function uninstall(mod) {
      try {
        const r = await window.api.uninstall({ mod: plain(mod) });
        showToast(r.ok ? `已停用：${r.name} · 重启游戏后生效` : '停用失败', r.ok ? 'ok' : 'error');
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
    async function openPath(p) {
      const r = await window.api.openPath(p);
      if (r && r.ok === false) showToast(r.msg, 'error');
    }
    function winMin() { window.api.winMin(); }
    function winClose() { window.api.winClose(); }

    return {
      cfg, scanData, tab, loading, toast, gameKeys, filter, filterIndex, filteredLibrary,
      otherOn, filterTabs, libraryList, installedList,
      totalLibrary, totalInstalled,
      zoomMod, zoomUrl, openZoom, closeZoom,
      tabIcon, countInstalled, refresh,
      install, uninstall, uninstallAll, del, setPreview, resign, launch,
      importOpen, importBusy, importResult, openImport, runImport,
      saveSettings, autoDetect, pickRoot, openPath, winMin, winClose,
      extras, updateOpen, donateOpen, openUpdate, openDonate, openUpdateUrl, openAuthor,
      pwdOpen, pwdInput, pwdErr, openUnlock, confirmUnlock, lockOther,
    };
  },
});

app.mount('#app');