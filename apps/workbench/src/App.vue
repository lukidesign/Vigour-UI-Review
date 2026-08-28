<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { theme as antdTheme, message, notification } from 'ant-design-vue';
import {
  BgColorsOutlined, CheckOutlined, CloudUploadOutlined, CodeOutlined, CopyOutlined, DownloadOutlined,
  EyeOutlined, FolderOpenOutlined, HistoryOutlined, ImportOutlined, PlusOutlined, ReloadOutlined,
  SettingOutlined, BulbOutlined, ZoomInOutlined, ZoomOutOutlined,
} from '@ant-design/icons-vue';
import { ApiError, assetBlobUrl, download, sessionToken, setSessionToken } from './api';
import { useWorkbenchStore } from './stores/workbench';
import { applyTheme, loadCustomTheme, loadThemeId, saveCustomThemeValue, themes, type ThemePreset } from './themes';
import type { Issue, Severity } from './types';

const store = useWorkbenchStore();
const needsToken = ref(false);
const tokenDraft = ref('');
const projectModal = ref(false);
const projectName = ref('');
const projectDescription = ref('');
const figmaModal = ref(false);
const figmaConfigured = ref(false);
const figmaPat = ref('');
const figmaUrl = ref('');
const figmaBusy = ref(false);
const captureModal = ref(false);
const aiModal = ref(false);
const aiProvider = ref<'openai' | 'gemini' | 'kimi' | 'deepseek'>('openai');
const aiModel = ref('gpt-5');
const aiTask = ref<'explain' | 'business-logic'>('explain');
const aiApiKey = ref('');
const aiConfigured = ref<Record<'openai' | 'gemini' | 'kimi' | 'deepseek', boolean>>({ openai: false, gemini: false, kimi: false, deepseek: false });
const aiIncludeImage = ref(false);
const aiConsent = ref(false);
const aiBusy = ref(false);
const aiResult = ref<{ summary: string; businessLogic?: string; fixes: Array<{ issueId: string; explanation: string; cssPatch?: string }>; warnings: string[] }>();
const providerModels = { openai: 'gpt-5', gemini: 'gemini-3.5-flash', kimi: 'kimi-k2.5', deepseek: 'deepseek-v4-flash' } as const;
const mode = ref<'annotation' | 'side-by-side' | 'overlay'>('annotation');
const role = ref<'设计' | '开发' | 'QA'>('开发');
const zoom = ref(70);
const opacity = ref(50);
const severityFilter = ref<'all' | Severity>('all');
const typeFilter = ref('all');
const selectedIssueId = ref('');
const designUrl = ref('');
const implementationUrl = ref('');
const evidenceUrl = ref('');
const naturalSize = reactive({ width: 1, height: 1 });
const selectedTheme = ref(loadThemeId());
const themeEditorOpen = ref(false);
const defaultTheme = themes[0]!;
const customTheme = reactive<ThemePreset>(JSON.parse(loadCustomTheme() ?? 'null') ?? {
  ...defaultTheme, id: 'custom', name: '我的主题', accent: '#8d7dff', background: '#0d1018', surface: '#151a27', surfaceRaised: '#1c2435', radius: 10,
});

const activeTheme = computed<ThemePreset>(() => selectedTheme.value === 'custom' ? customTheme : (themes.find((item) => item.id === selectedTheme.value) ?? defaultTheme));
const antdConfig = computed(() => ({
  algorithm: activeTheme.value.mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: { colorPrimary: activeTheme.value.accent, colorBgBase: activeTheme.value.background, colorTextBase: activeTheme.value.text, borderRadius: activeTheme.value.radius, fontSize: 13 },
}));
const filteredIssues = computed(() => store.issues.filter((issue) =>
  (severityFilter.value === 'all' || issue.severity === severityFilter.value) &&
  (typeFilter.value === 'all' || issue.type === typeFilter.value) && issue.status !== 'ignored'));
const issueGroups = computed(() => {
  const groups = new Map<string, Issue[]>();
  for (const issue of filteredIssues.value) groups.set(issue.groupId, [...(groups.get(issue.groupId) ?? []), issue]);
  return [...groups.entries()].map(([id, issues]) => ({ id, issues, primary: issues[0]!, severity: issues.some((item) => item.severity === 'critical') ? 'critical' : issues.some((item) => item.severity === 'major') ? 'major' : 'minor' }));
});
const selectedIssue = computed(() => store.issues.find((issue) => issue.id === selectedIssueId.value));
const severityCount = computed(() => ({
  critical: store.issues.filter((issue) => issue.severity === 'critical' && issue.status === 'open').length,
  major: store.issues.filter((issue) => issue.severity === 'major' && issue.status === 'open').length,
  minor: store.issues.filter((issue) => issue.severity === 'minor' && issue.status === 'open').length,
}));
const issueTypes = computed(() => [...new Set(store.issues.map((issue) => issue.type))]);
const normalizationDescription = computed(() => {
  const item = store.normalization;
  if (!item?.applied) return '';
  const scaleX = `${(item.scaleX * 100).toFixed(2)}%`;
  const scaleY = `${(item.scaleY * 100).toFixed(2)}%`;
  const scale = scaleX === scaleY ? scaleX : `宽 ${scaleX} / 高 ${scaleY}`;
  return `开发图 ${item.candidate.width}×${item.candidate.height} → ${item.target.width}×${item.target.height}，缩放比例 ${scale}；原图未被修改。`;
});

function revoke(url: string) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); }
async function updateBlob(kind: 'design' | 'implementation' | 'evidence', id?: string) {
  const holder = kind === 'design' ? designUrl : kind === 'implementation' ? implementationUrl : evidenceUrl;
  revoke(holder.value); holder.value = id ? await assetBlobUrl(id) : '';
}
watch(() => store.designAsset?.id, (id) => void updateBlob('design', id));
watch(() => store.implementationAsset?.id, (id) => void updateBlob('implementation', id));
watch(() => store.evidenceAssetId, (id) => void updateBlob('evidence', id));
watch(activeTheme, (theme) => applyTheme(theme), { immediate: true, deep: true });

async function connect() {
  if (!tokenDraft.value.trim()) return;
  setSessionToken(tokenDraft.value.trim());
  try { await store.loadProjects(); needsToken.value = false; }
  catch { message.error('无法连接本地服务，请检查令牌和服务状态'); }
}
async function createProject() {
  if (!projectName.value.trim()) return;
  await store.createProject(projectName.value.trim(), projectDescription.value.trim());
  projectModal.value = false; projectName.value = ''; projectDescription.value = '';
}
async function chooseFile(kind: 'design' | 'implementation', event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0];
  if (!file) return;
  try { await store.uploadImage(kind, file); message.success(kind === 'design' ? '设计图已上传' : '开发图已上传'); }
  catch (error) { message.error(error instanceof Error ? error.message : '上传失败'); }
  input.value = '';
}
async function runAnalysis(useOcr = false) {
  try {
    await store.analyze(useOcr); selectedIssueId.value = store.issues[0]?.id ?? '';
    if (store.normalization?.applied) notification.success({ message: '验收分析完成，开发图已自动对齐', description: normalizationDescription.value, duration: 6 });
    else message.success('验收分析完成');
  } catch (error) {
    if (error instanceof ApiError && error.code === 'IMAGE_ASPECT_RATIO_MISMATCH') {
      notification.error({ message: '图片比例不一致，无法开始验收', description: error.message, duration: 10 });
    } else message.error(error instanceof Error ? error.message : '分析失败');
  }
}
async function openCaptures() { await store.refreshCaptures(); captureModal.value = true; }
function chooseCapture(capture: typeof store.captures[number]) {
  try { store.useCapture(capture); captureModal.value = false; message.success('已选用浏览器采集图'); }
  catch (error) { message.error(error instanceof Error ? error.message : '采集不可用'); }
}
async function openFigma() {
  figmaModal.value = true;
  try { figmaConfigured.value = (await store.figmaStatus()).configured; } catch { figmaConfigured.value = false; }
}
async function saveFigmaToken() {
  if (!figmaPat.value.trim()) return;
  try { await store.saveFigmaPat(figmaPat.value.trim()); figmaConfigured.value = true; figmaPat.value = ''; message.success('Figma Token 已保存到 macOS 钥匙串'); }
  catch { message.error('Token 保存失败，请检查钥匙串是否解锁'); }
}
async function importFigmaFrame() {
  if (!figmaUrl.value.trim()) return;
  figmaBusy.value = true;
  try { const result = await store.importFigma(figmaUrl.value.trim()); figmaModal.value = false; message.success(`已导入 ${result.import.nodeName}，共 ${result.import.nodeCount} 个节点`); }
  catch (error) { message.error(error instanceof Error ? error.message : 'Figma 导入失败'); }
  finally { figmaBusy.value = false; }
}
async function openAI(task: 'explain' | 'business-logic') {
  if (!selectedIssue.value || !store.activeRun) return;
  aiTask.value = task; aiResult.value = undefined; aiConsent.value = false; aiModal.value = true;
  try { aiConfigured.value = await store.aiKeyStatus(); } catch { message.error('无法读取 AI Key 配置状态'); }
}
watch(aiProvider, (provider) => { aiModel.value = providerModels[provider]; aiIncludeImage.value = false; });
async function runAI() {
  if (!selectedIssue.value || !aiConsent.value) return;
  aiBusy.value = true;
  try {
    if (!aiConfigured.value[aiProvider.value]) {
      if (!aiApiKey.value.trim()) throw new Error('请先填写 API Key');
      await store.saveAIKey(aiProvider.value, aiApiKey.value.trim()); aiConfigured.value[aiProvider.value] = true; aiApiKey.value = '';
    }
    const response = await store.analyzeWithAI({ provider: aiProvider.value, model: aiModel.value, task: aiTask.value, issueIds: [selectedIssue.value.id], includeImage: aiIncludeImage.value });
    aiResult.value = response.result;
  } catch (error) { message.error(error instanceof Error ? error.message : 'AI 分析失败'); }
  finally { aiBusy.value = false; }
}
function chooseTheme(id: string) { selectedTheme.value = id; if (id === 'custom') themeEditorOpen.value = true; }
function saveCustomTheme() {
  saveCustomThemeValue(customTheme); selectedTheme.value = 'custom'; message.success('自定义主题已保存');
}
async function copyTheme() { await navigator.clipboard.writeText(JSON.stringify(activeTheme.value, null, 2)); message.success('主题 JSON 已复制'); }
function exportTheme() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(activeTheme.value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `${activeTheme.value.id}-theme.json`; a.click(); URL.revokeObjectURL(url);
}
async function importTheme(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
  try {
    const value = JSON.parse(await file.text()) as Partial<ThemePreset>;
    Object.assign(customTheme, { ...customTheme, ...value, id: 'custom', name: value.name ?? '导入主题' }); saveCustomTheme();
  } catch { message.error('主题文件格式不正确'); }
}
function exportRun(format: 'png' | 'markdown' | 'json') {
  if (!store.activeRun) return;
  if (format === 'png' && store.evidenceAssetId) void download(`/api/v1/assets/images/${store.evidenceAssetId}/content`, `${store.activeRun.id}-annotated.png`);
  else if (format !== 'png') void download(`/api/v1/runs/${store.activeRun.id}/export/${format}`, `${store.activeRun.id}.${format === 'markdown' ? 'md' : 'json'}`);
}
async function copyPatch(issue: Issue) { if (issue.suggestedCssPatch) { await navigator.clipboard.writeText(issue.suggestedCssPatch); message.success('修改建议已复制'); } }

onMounted(async () => {
  const url = new URL(location.href); const fragment = new URLSearchParams(url.hash.slice(1));
  const token = fragment.get('token') ?? url.searchParams.get('token');
  if (token) { setSessionToken(token); url.searchParams.delete('token'); url.hash = ''; history.replaceState({}, '', url); }
  needsToken.value = !sessionToken(); tokenDraft.value = sessionToken();
  if (!needsToken.value) { try { await store.loadProjects(); } catch { needsToken.value = true; } }
  await nextTick();
});
onBeforeUnmount(() => { revoke(designUrl.value); revoke(implementationUrl.value); revoke(evidenceUrl.value); });
</script>

<template>
  <a-config-provider :theme="antdConfig">
    <div class="app-shell">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">VR</span><div><strong>Vigour UI Review</strong><small>本地自动化校验工作台</small></div></div>
        <div class="top-actions">
          <span class="local-status"><i /> 本地分析</span>
          <a-dropdown>
            <a-button><DownloadOutlined /> 导出结果</a-button>
            <template #overlay><a-menu @click="({ key }: { key: string }) => exportRun(key as 'png' | 'markdown' | 'json')"><a-menu-item key="png">标注版 PNG</a-menu-item><a-menu-item key="markdown">Markdown 报告</a-menu-item><a-menu-item key="json">结构化 JSON</a-menu-item></a-menu></template>
          </a-dropdown>
          <a-popover placement="bottomRight" trigger="click" overlay-class-name="theme-popover">
            <a-button aria-label="切换主题"><BulbOutlined /></a-button>
            <template #content>
              <div class="theme-panel">
                <div class="theme-title"><span>主题</span><small>{{ activeTheme.name }}</small></div>
                <button v-for="item in themes" :key="item.id" class="theme-row" :class="{ active: selectedTheme === item.id }" @click="chooseTheme(item.id)">
                  <span class="theme-swatch" :style="{ background: `linear-gradient(135deg, ${item.background} 50%, ${item.accent} 50%)` }" /><span>{{ item.name }}</span><CheckOutlined v-if="selectedTheme === item.id" />
                </button>
                <button class="theme-row" :class="{ active: selectedTheme === 'custom' }" @click="chooseTheme('custom')"><span class="theme-swatch custom"><BgColorsOutlined /></span><span>我的主题</span><SettingOutlined /></button>
                <div class="theme-actions"><label><ImportOutlined /> 导入<input type="file" accept="application/json" @change="importTheme"></label><button @click="copyTheme"><CopyOutlined /> 复制主题</button><button @click="exportTheme"><DownloadOutlined /></button></div>
                <div v-if="themeEditorOpen" class="theme-editor">
                  <div class="editor-head"><strong>编辑我的主题</strong><button @click="themeEditorOpen = false">完成</button></div>
                  <label>名称<input v-model="customTheme.name" type="text"></label>
                  <div class="color-grid"><label>强调色<input v-model="customTheme.accent" type="color"></label><label>页面背景<input v-model="customTheme.background" type="color"></label><label>面板<input v-model="customTheme.surface" type="color"></label><label>边框<input v-model="customTheme.border" type="color"></label></div>
                  <label>圆角 {{ customTheme.radius }}px<input v-model.number="customTheme.radius" type="range" min="0" max="20"></label>
                  <a-button type="primary" block @click="saveCustomTheme">应用并保存</a-button>
                </div>
              </div>
            </template>
          </a-popover>
        </div>
      </header>

      <main class="workspace">
        <aside class="project-sidebar">
          <div class="side-head"><span>项目</span><a-button type="text" size="small" @click="projectModal = true"><PlusOutlined /></a-button></div>
          <nav class="project-list">
            <button v-for="project in store.projects" :key="project.id" :class="{ active: store.activeProjectId === project.id }" @click="store.selectProject(project.id)"><FolderOpenOutlined /><span><strong>{{ project.name }}</strong><small>{{ project.description || '暂无说明' }}</small></span></button>
            <a-empty v-if="!store.projects.length" :image="aEmptyImage" description="还没有项目" />
          </nav>
          <div class="history-head"><HistoryOutlined /> 验收历史</div>
          <div class="run-list">
            <button v-for="run in store.runs" :key="run.id" :class="{ active: store.activeRun?.id === run.id }" @click="store.selectRun(run.id)">
              <span class="run-score" :class="{ pass: run.passed }">{{ run.score ?? '…' }}</span><span><strong>{{ new Date(run.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }}</strong><small>{{ run.state === 'ready' ? (run.passed ? '已通过' : '待修正') : run.state }}</small></span>
            </button>
          </div>
          <div class="side-footer"><SettingOutlined /> 容差：平衡验收</div>
        </aside>

        <section class="canvas-column">
          <div class="source-bar">
            <div class="source-card"><label class="source-upload"><span class="step">1</span><span><small>设计原图</small><strong>{{ store.designAsset?.filename || '选择 PNG / JPG' }}</strong></span><CloudUploadOutlined /><input type="file" accept="image/png,image/jpeg" @change="chooseFile('design', $event)"></label><button class="figma-action" @click="openFigma">Figma</button></div>
            <div class="source-card"><label class="source-upload"><span class="step">2</span><span><small>开发实现图</small><strong>{{ store.implementationAsset?.filename || '选择 PNG / JPG' }}</strong></span><CloudUploadOutlined /><input type="file" accept="image/png,image/jpeg" @change="chooseFile('implementation', $event)"></label><button class="figma-action" @click="openCaptures">最近采集</button></div>
            <a-dropdown>
              <a-button type="primary" size="large" :loading="store.busy" :disabled="!store.designAsset || !store.implementationAsset"><ReloadOutlined />重新走查</a-button>
              <template #overlay><a-menu><a-menu-item @click="runAnalysis(false)">像素 + 结构分析</a-menu-item><a-menu-item @click="runAnalysis(true)">同时启用本地 OCR</a-menu-item></a-menu></template>
            </a-dropdown>
          </div>
          <div class="canvas-toolbar">
            <div><strong>{{ store.activeProject?.name || '未选择项目' }}</strong><small v-if="store.activeRun">{{ store.activeRun.score }} 分 · {{ store.issues.length }} 个问题</small></div>
            <a-segmented v-model:value="mode" :options="[{ label: '开发图标注', value: 'annotation' }, { label: '平铺对比', value: 'side-by-side' }, { label: '透明度叠加', value: 'overlay' }]" />
            <div class="zoom-tools"><a-button size="small" @click="zoom = Math.max(25, zoom - 10)"><ZoomOutOutlined /></a-button><span>{{ zoom }}%</span><a-button size="small" @click="zoom = Math.min(200, zoom + 10)"><ZoomInOutlined /></a-button></div>
          </div>
          <div v-if="mode === 'overlay'" class="opacity-bar"><span>开发图透明度</span><a-slider v-model:value="opacity" :min="0" :max="100" /><b>{{ opacity }}%</b></div>
          <a-alert v-if="store.normalization?.applied" class="normalization-alert" type="info" show-icon message="开发图已自动对齐" :description="normalizationDescription" />
          <div class="canvas-stage">
            <a-empty v-if="!designUrl || !implementationUrl" description="上传设计原图和开发实现图后开始验收" />
            <div v-else-if="mode === 'side-by-side'" class="side-by-side" :style="{ width: `${zoom * 2}%` }">
              <figure><figcaption>设计原图</figcaption><img :src="designUrl" alt="设计原图"></figure>
              <figure><figcaption>开发实现图</figcaption><img :src="implementationUrl" alt="开发实现图"></figure>
            </div>
            <div v-else class="image-stack" :style="{ width: `${zoom}%` }">
              <img v-if="mode === 'overlay'" :src="designUrl" alt="设计原图">
              <img :src="implementationUrl" alt="开发实现图" :style="mode === 'overlay' ? { opacity: opacity / 100 } : {}" @load="naturalSize.width = ($event.target as HTMLImageElement).naturalWidth; naturalSize.height = ($event.target as HTMLImageElement).naturalHeight">
              <template v-if="mode === 'annotation'">
                <button v-for="(issue, index) in filteredIssues" :key="issue.id" class="issue-marker" :class="[issue.severity, { selected: selectedIssueId === issue.id }]"
                  :style="{ left: `${issue.rect.x / naturalSize.width * 100}%`, top: `${issue.rect.y / naturalSize.height * 100}%`, width: `${issue.rect.width / naturalSize.width * 100}%`, height: `${issue.rect.height / naturalSize.height * 100}%` }" @click="selectedIssueId = issue.id"><span>{{ index + 1 }}</span></button>
              </template>
            </div>
          </div>
        </section>

        <aside class="problem-panel">
          <div class="problem-head"><div><strong>问题清单</strong><small>按元素自动合并</small></div><span class="score" :class="{ pass: store.activeRun?.passed }">{{ store.activeRun?.score ?? '--' }}</span></div>
          <div class="severity-summary"><button :class="{ active: severityFilter === 'all' }" @click="severityFilter = 'all'"><b>{{ store.issues.length }}</b><span>全部</span></button><button :class="{ active: severityFilter === 'critical' }" @click="severityFilter = 'critical'"><b>{{ severityCount.critical }}</b><span>严重</span></button><button :class="{ active: severityFilter === 'major' }" @click="severityFilter = 'major'"><b>{{ severityCount.major }}</b><span>中等</span></button><button :class="{ active: severityFilter === 'minor' }" @click="severityFilter = 'minor'"><b>{{ severityCount.minor }}</b><span>轻微</span></button></div>
          <div class="filter-row"><a-select v-model:value="typeFilter" size="small"><a-select-option value="all">全部类型</a-select-option><a-select-option v-for="item in issueTypes" :key="item" :value="item">{{ item }}</a-select-option></a-select><a-segmented v-model:value="role" size="small" :options="['设计', '开发', 'QA']" /></div>
          <div class="problem-list">
            <a-empty v-if="!issueGroups.length" :description="store.activeRun ? '当前筛选下没有问题' : '完成分析后显示问题'" />
            <article v-for="(group, groupIndex) in issueGroups" :key="group.id" class="issue-group" :class="{ selected: group.issues.some(item => item.id === selectedIssueId) }" @click="selectedIssueId = group.primary.id">
              <span class="issue-index" :class="group.severity">{{ groupIndex + 1 }}</span>
              <div class="issue-body"><div class="issue-title"><strong>{{ group.primary.title }}</strong><a-tag :color="group.severity === 'critical' ? 'error' : group.severity === 'major' ? 'warning' : 'default'">{{ group.severity === 'critical' ? '严重' : group.severity === 'major' ? '中等' : '轻微' }}</a-tag></div><div class="type-tags"><span v-for="item in group.issues" :key="item.id">{{ item.type }}</span></div><p>{{ group.issues.map(item => item.plainDescription).join('；') }}</p></div>
            </article>
          </div>
          <div v-if="selectedIssue" class="issue-detail">
            <div class="detail-head"><strong>问题详情</strong><span>{{ role }}视图</span></div>
            <template v-if="role === '设计'"><p>{{ selectedIssue.plainDescription }}</p><dl><dt>设计值</dt><dd>{{ selectedIssue.expected || '见设计稿标注' }}</dd><dt>实现值</dt><dd>{{ selectedIssue.actual || '见开发图标注' }}</dd></dl></template>
            <template v-else-if="role === '开发'"><p>{{ selectedIssue.plainDescription }}</p><pre v-if="selectedIssue.suggestedCssPatch">{{ selectedIssue.suggestedCssPatch }}</pre><a-button v-if="selectedIssue.suggestedCssPatch" block @click="copyPatch(selectedIssue)"><CodeOutlined />复制修改建议</a-button><div class="ai-actions"><a-button @click="openAI('explain')">AI 解释</a-button><a-button @click="openAI('business-logic')">推断业务逻辑</a-button></div></template>
            <template v-else><p>置信度：{{ selectedIssue.confidence }} · 检测器：{{ selectedIssue.detectorTier }}</p><div class="qa-actions"><a-button @click="store.updateIssue(selectedIssue, 'ignored')">忽略</a-button><a-button type="primary" @click="store.updateIssue(selectedIssue, 'resolved')">标记已修复</a-button></div></template>
          </div>
        </aside>
      </main>
    </div>

    <a-modal v-model:open="needsToken" title="连接本地服务" :closable="false" :mask-closable="false" :footer="null"><p class="modal-note">会话令牌只保存在当前浏览器会话中，用于阻止其他网页访问本地验收数据。</p><a-input-password v-model:value="tokenDraft" placeholder="粘贴 .data/session-token 中的令牌" @press-enter="connect" /><a-button type="primary" block class="connect-button" @click="connect">连接工作台</a-button></a-modal>
    <a-modal v-model:open="projectModal" title="新建 UI 验收项目" ok-text="创建" cancel-text="取消" @ok="createProject"><a-form layout="vertical"><a-form-item label="项目名称" required><a-input v-model:value="projectName" placeholder="例如：结算页 Web 重构"></a-input></a-form-item><a-form-item label="说明"><a-textarea v-model:value="projectDescription" :rows="3" placeholder="页面、版本或验收范围"></a-textarea></a-form-item></a-form></a-modal>
    <a-modal v-model:open="figmaModal" title="从 Figma 导入 Frame" :footer="null">
      <a-alert v-if="figmaConfigured" type="success" show-icon message="Figma Token 已安全保存在 macOS 钥匙串" />
      <div v-else class="figma-token-block"><p class="modal-note">请使用仅含 file_content:read 权限的 Personal Access Token。Token 不会写入数据库、浏览器存储或日志。</p><a-input-password v-model:value="figmaPat" placeholder="粘贴 Figma Personal Access Token" /><a-button class="connect-button" block @click="saveFigmaToken">保存到钥匙串</a-button></div>
      <a-divider />
      <a-form layout="vertical"><a-form-item label="Figma Frame 链接"><a-input v-model:value="figmaUrl" placeholder="https://www.figma.com/design/...?...node-id=1-2" /></a-form-item></a-form>
      <a-button type="primary" block :loading="figmaBusy" :disabled="!figmaConfigured || !figmaUrl" @click="importFigmaFrame">导入渲染图与节点语义</a-button>
    </a-modal>
    <a-modal v-model:open="captureModal" title="选择浏览器采集" :footer="null"><a-list :data-source="store.captures" bordered><template #renderItem="{ item }"><a-list-item><a-list-item-meta :title="item.title" :description="`${item.mode === 'full-page' ? '整页' : '视口'} · ${new Date(item.createdAt).toLocaleString('zh-CN')}`" /><a-button :disabled="!item.imageAssetId" @click="chooseCapture(item)">{{ item.imageAssetId ? '使用' : '处理失败' }}</a-button></a-list-item></template></a-list><a-empty v-if="!store.captures.length" description="还没有浏览器采集，请先使用 Chrome 插件" /></a-modal>
    <a-modal v-model:open="aiModal" :title="aiTask === 'explain' ? 'AI 解释当前问题' : 'AI 推断组件业务逻辑'" :footer="null" width="620px">
      <a-alert type="warning" show-icon message="AI 是可选解释层，不会改变本地检测结果、评分或问题状态。" />
      <div class="ai-config-grid"><a-form layout="vertical"><a-form-item label="服务商"><a-select v-model:value="aiProvider"><a-select-option value="openai">OpenAI</a-select-option><a-select-option value="gemini">Gemini</a-select-option><a-select-option value="kimi">Kimi</a-select-option><a-select-option value="deepseek">DeepSeek</a-select-option></a-select></a-form-item></a-form><a-form layout="vertical"><a-form-item label="模型"><a-input v-model:value="aiModel" /></a-form-item></a-form></div>
      <a-input-password v-if="!aiConfigured[aiProvider]" v-model:value="aiApiKey" placeholder="API Key 将直接保存到 macOS 钥匙串" />
      <a-checkbox v-model:checked="aiIncludeImage" :disabled="aiProvider === 'kimi' || aiProvider === 'deepseek'" class="ai-check">同时发送标注证据图（仅 OpenAI / Gemini）</a-checkbox>
      <a-checkbox v-model:checked="aiConsent" class="ai-check">我确认本次将向 {{ aiProvider }} / {{ aiModel }} 发送当前选中问题的结构化差异{{ aiIncludeImage ? '和标注图' : '' }}。本回执仅本次有效。</a-checkbox>
      <a-button type="primary" block :loading="aiBusy" :disabled="!aiConsent || !aiModel" @click="runAI">生成一次性同意回执并分析</a-button>
      <div v-if="aiResult" class="ai-result"><h4>结论</h4><p>{{ aiResult.summary }}</p><template v-if="aiResult.businessLogic"><h4>业务逻辑推断</h4><p>{{ aiResult.businessLogic }}</p></template><h4 v-if="aiResult.fixes.length">修改建议</h4><article v-for="fix in aiResult.fixes" :key="fix.issueId"><p>{{ fix.explanation }}</p><pre v-if="fix.cssPatch">{{ fix.cssPatch }}</pre></article><a-alert v-for="warning in aiResult.warnings" :key="warning" type="info" :message="warning" /></div>
    </a-modal>
  </a-config-provider>
</template>

<script lang="ts">
import { Empty } from 'ant-design-vue';
export default { data: () => ({ aEmptyImage: Empty.PRESENTED_IMAGE_SIMPLE }) };
</script>
