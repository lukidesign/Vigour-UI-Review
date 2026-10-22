<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { theme as antdTheme, message, notification } from 'ant-design-vue';
import {
  BgColorsOutlined, CheckOutlined, CloudUploadOutlined, CodeOutlined, CopyOutlined, DownloadOutlined,
  EyeOutlined, FolderOpenOutlined, HistoryOutlined, ImportOutlined, PlusOutlined, ReloadOutlined,
  HighlightOutlined, MenuFoldOutlined, MenuUnfoldOutlined, RobotOutlined, SettingOutlined,
  PlayCircleOutlined, ZoomInOutlined, ZoomOutOutlined,
} from '@ant-design/icons-vue';
import workbenchPackage from '../package.json';
import { ApiError, assetBlobUrl, clearSessionToken, download, sessionToken, setSessionToken, initializeSessionFromLocation, startWorkbenchLease } from './api';
import { useWorkbenchStore } from './stores/workbench';
import { useOneTimeConsent } from './ai-consent';
import { applyTheme, loadCustomTheme, loadThemeId, saveCustomThemeValue, themes, type ThemePreset } from './themes';
import type { Issue, Severity } from './types';
import { captureProcessingErrors, safeCaptureProcessingError } from '@vigour-ui-review/contracts';

const store = useWorkbenchStore();
const needsToken = ref(false);
const tokenDraft = ref('');
const handoffError = ref('');
const manualConnectionError = ref('');
const connecting = ref(false);
let stopLease: (() => void) | undefined;
function keepWorkbenchOpen() { stopLease?.(); stopLease = startWorkbenchLease(); }
const projectModal = ref(false);
const projectName = ref('');
const projectDescription = ref('');
const figmaModal = ref(false);
const figmaConfigured = ref(false);
const figmaPat = ref('');
const figmaUrl = ref('');
const figmaBusy = ref(false);
const captureModal = ref(false);
const captureListBusy = ref(false);
const aiModal = ref(false);
const aiProvider = ref<'openai' | 'gemini' | 'kimi' | 'deepseek'>('openai');
const aiModel = ref('gpt-5');
const aiTask = ref<'explain' | 'business-logic'>('explain');
const aiApiKey = ref('');
const aiConfigured = ref<Record<'openai' | 'gemini' | 'kimi' | 'deepseek', boolean>>({ openai: false, gemini: false, kimi: false, deepseek: false });
const aiIncludeImage = ref(false);
const aiBusy = ref(false);
const aiSettingsOpen = ref<string[]>([]);
const aiResult = ref<{ summary: string; businessLogic?: string; fixes: Array<{ issueId: string; explanation: string; cssPatch?: string }>; warnings: string[] }>();
const providerModels = { openai: 'gpt-5', gemini: 'gemini-3.5-flash', kimi: 'kimi-k2.5', deepseek: 'deepseek-v4-flash' } as const;
const mode = ref<'annotation' | 'side-by-side' | 'overlay'>('annotation');
const role = ref<'设计' | '开发' | 'QA'>('开发');
const zoom = ref(70);
const opacity = ref(50);
const severityFilter = ref<'all' | Severity>('all');
const typeFilter = ref('all');
const selectedIssueId = ref('');
const annotationsVisible = ref(true);
const sidebarCollapsed = ref(true);
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
const appVersion = `v${workbenchPackage.version}`;

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
const selectedIssueGroupAll = computed(() => selectedIssue.value
  ? store.issues.filter((issue) => issue.groupId === selectedIssue.value?.groupId && issue.status !== 'ignored')
  : []);
const selectedIssueGroup = computed(() => selectedIssueGroupAll.value.slice(0, 20));
const aiIssueIds = computed(() => aiTask.value === 'business-logic'
  ? selectedIssueGroup.value.map((issue) => issue.id)
  : selectedIssue.value ? [selectedIssue.value.id] : []);
const aiRequestScope = computed(() => JSON.stringify({
  provider: aiProvider.value, model: aiModel.value, task: aiTask.value,
  runId: store.activeRun?.id, issueIds: aiIssueIds.value,
  includeImage: aiIncludeImage.value, open: aiModal.value,
}));
const { confirmed: aiConsent, consume: consumeAIConsent, isCurrent: isAIConsentCurrent } = useOneTimeConsent(aiRequestScope);
watch(aiRequestScope, () => { aiResult.value = undefined; }, { flush: 'sync' });
const aiTaskCopy = computed(() => aiTask.value === 'explain' ? {
  title: 'AI 解释当前问题',
  eyebrow: '问题解释',
  description: '结合当前差异证据，说明可能原因、影响范围和优先修改建议。',
  scope: '当前问题',
  action: '解释问题',
} : {
  title: 'AI 推断组件业务逻辑',
  eyebrow: '组件推断',
  description: '结合当前组件及其合并问题，推断组件用途、状态规则、交互流程和异常场景。',
  scope: `当前组件 · ${selectedIssueGroupAll.value.length} 条关联差异`,
  action: '推断业务逻辑',
});
const aiProviderName = computed(() => ({ openai: 'OpenAI', gemini: 'Gemini', kimi: 'Kimi', deepseek: 'DeepSeek' })[aiProvider.value]);
const aiKeyReady = computed(() => aiConfigured.value[aiProvider.value] || aiApiKey.value.trim().length >= 10);
const severityCount = computed(() => ({
  critical: store.issues.filter((issue) => issue.severity === 'critical' && issue.status === 'open').length,
  major: store.issues.filter((issue) => issue.severity === 'major' && issue.status === 'open').length,
  minor: store.issues.filter((issue) => issue.severity === 'minor' && issue.status === 'open').length,
}));
const issueTypes = computed(() => [...new Set(store.issues.map((issue) => issue.type))]);
const isCurrentPairAnalyzed = computed(() => Boolean(
  store.activeRun?.state === 'ready' &&
  store.activeRun.designAssetId === store.designAsset?.id &&
  store.activeRun.implementationAssetId === store.implementationAsset?.id,
));
const analysisActionLabel = computed(() => store.busy ? '分析中' : isCurrentPairAnalyzed.value ? '重查' : '走查');
const analysisDisabled = computed(() => !store.activeProject || !store.designAsset || !store.implementationAsset);
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
watch(() => store.issues.map((issue) => issue.id), (issueIds) => {
  if (!issueIds.includes(selectedIssueId.value)) selectedIssueId.value = issueIds[0] ?? '';
}, { immediate: true });
watch(activeTheme, (theme) => applyTheme(theme), { immediate: true, deep: true });

async function connect() {
  if (!tokenDraft.value.trim()) { manualConnectionError.value = '请输入本机 session-token 文件中的令牌。'; return; }
  connecting.value = true; manualConnectionError.value = '';
  setSessionToken(tokenDraft.value.trim());
  try { await store.loadProjects(); needsToken.value = false; keepWorkbenchOpen(); }
  catch (error) {
    clearSessionToken();
    manualConnectionError.value = error instanceof ApiError && error.status === 401
      ? '令牌无效或已经更新。请重新复制当前 session-token 后再试。'
      : '无法连接本地服务，请确认本地程序正在运行后再试。';
  } finally { connecting.value = false; }
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
async function openCaptures() { captureModal.value = true; await refreshCaptureList(); }
async function refreshCaptureList() {
  if (captureListBusy.value) return;
  captureListBusy.value = true;
  try { await store.refreshCaptures(); }
  catch { message.error('无法刷新采集列表，请检查本地程序连接后重试。'); }
  finally { captureListBusy.value = false; }
}
function captureFailureDescription(capture: typeof store.captures[number]) {
  const code = safeCaptureProcessingError(capture.processingError);
  return `${captureProcessingErrors[code]} 采集编号：${capture.id}；错误码：${code}`;
}
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
  aiTask.value = task; aiResult.value = undefined; aiConsent.value = false; aiApiKey.value = ''; aiSettingsOpen.value = []; aiModal.value = true;
  try {
    aiConfigured.value = await store.aiKeyStatus();
    if (!aiConfigured.value[aiProvider.value]) aiSettingsOpen.value = ['settings'];
  } catch {
    aiSettingsOpen.value = ['settings'];
    message.error('无法读取 AI Key 配置状态');
  }
}
watch(aiProvider, (provider) => {
  aiModel.value = providerModels[provider]; aiIncludeImage.value = false; aiApiKey.value = '';
  if (!aiConfigured.value[provider]) aiSettingsOpen.value = ['settings'];
});
async function runAI() {
  if (aiBusy.value || !selectedIssue.value || !store.activeRun || !aiModel.value.trim() || !aiKeyReady.value || !aiIssueIds.value.length) return;
  const scope = consumeAIConsent();
  if (scope === undefined) return;
  const input = { provider: aiProvider.value, model: aiModel.value, task: aiTask.value, issueIds: [...aiIssueIds.value], includeImage: aiIncludeImage.value };
  const apiKey = aiApiKey.value.trim();
  aiBusy.value = true;
  try {
    if (!aiConfigured.value[input.provider]) {
      if (!apiKey) throw new Error('请先填写 API Key');
      await store.saveAIKey(input.provider, apiKey); aiConfigured.value[input.provider] = true;
      if (aiApiKey.value.trim() === apiKey) aiApiKey.value = '';
    }
    if (!isAIConsentCurrent(scope)) throw new Error('发送内容已改变，请重新确认后提交');
    const response = await store.analyzeWithAI(input);
    if (isAIConsentCurrent(scope)) aiResult.value = response.result;
  } catch (error) { message.error(error instanceof Error ? error.message : 'AI 分析失败'); }
  finally { aiBusy.value = false; aiConsent.value = false; }
}
async function copyAIResult() {
  if (!aiResult.value) return;
  const result = aiResult.value;
  const lines = aiTask.value === 'explain'
    ? [`# 原因与影响`, result.summary, '', '# 修改建议', ...result.fixes.map((fix, index) => `${index + 1}. ${fix.explanation}${fix.cssPatch ? `\n\n${fix.cssPatch}` : ''}`)]
    : [`# 组件用途`, result.summary, '', '# 状态规则、交互流程与异常场景', result.businessLogic || '暂无补充推断', '', '# 证据与实现提示', ...result.fixes.map((fix, index) => `${index + 1}. ${fix.explanation}${fix.cssPatch ? `\n\n${fix.cssPatch}` : ''}`)];
  await navigator.clipboard.writeText(lines.join('\n'));
  message.success('AI 分析结果已复制');
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
async function selectIssue(issueId: string, revealInList = false) {
  selectedIssueId.value = issueId;
  if (!revealInList) return;
  await nextTick();
  const group = issueGroups.value.find((item) => item.issues.some((issue) => issue.id === issueId));
  if (group) document.getElementById(`issue-group-${group.id}`)?.scrollIntoView({ block: 'nearest' });
}
async function copyPatch(issue: Issue) { if (issue.suggestedCssPatch) { await navigator.clipboard.writeText(issue.suggestedCssPatch); message.success('修改建议已复制'); } }

onMounted(async () => {
  try { await initializeSessionFromLocation(); }
  catch (error) { handoffError.value = error instanceof Error ? error.message : '连接失败，请从扩展重新打开工作台。'; }
  needsToken.value = !sessionToken(); tokenDraft.value = sessionToken();
  if (!needsToken.value) {
    try { await store.loadProjects(); keepWorkbenchOpen(); }
    catch (error) {
      clearSessionToken(); needsToken.value = true;
      handoffError.value = error instanceof ApiError && error.status === 401
        ? '本地会话已经失效，请从 Chrome 扩展重新打开工作台。'
        : '暂时无法连接本地程序，请确认程序仍在运行。';
    }
  }
  await nextTick();
});
onBeforeUnmount(() => { stopLease?.(); revoke(designUrl.value); revoke(implementationUrl.value); revoke(evidenceUrl.value); });
</script>

<template>
  <a-config-provider :theme="antdConfig">
    <div class="app-shell">
      <header class="topbar">
        <div class="brand"><img class="brand-mark" src="/vigour-ui-review-logo.png" alt="Vigour UI Review"><div><strong>Vigour UI Review</strong><small>{{ appVersion }}</small></div></div>
        <div class="top-actions">
          <span class="local-status"><i /> 本地分析</span>
          <a-popover placement="bottomRight" trigger="click" overlay-class-name="theme-popover">
            <a-button :aria-label="`切换主题，当前为${activeTheme.mode === 'dark' ? '深色' : '浅色'}主题`"><BgColorsOutlined v-if="activeTheme.mode === 'dark'" /><HighlightOutlined v-else /></a-button>
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

      <main class="workspace" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
        <aside class="project-sidebar" :class="{ collapsed: sidebarCollapsed }">
          <div v-if="sidebarCollapsed" class="sidebar-rail">
            <a-tooltip placement="right" title="展开项目栏"><a-button type="text" aria-label="展开项目栏" @click="sidebarCollapsed = false"><MenuUnfoldOutlined /></a-button></a-tooltip>
            <a-tooltip placement="right" title="项目"><a-button type="text" aria-label="查看项目" @click="sidebarCollapsed = false"><FolderOpenOutlined /></a-button></a-tooltip>
            <a-tooltip placement="right" title="验收历史"><a-button type="text" aria-label="查看验收历史" @click="sidebarCollapsed = false"><HistoryOutlined /></a-button></a-tooltip>
            <span class="rail-spacer" />
            <a-tooltip placement="right" title="容差：平衡验收"><span class="rail-status" role="img" aria-label="容差：平衡验收"><SettingOutlined /></span></a-tooltip>
          </div>
          <template v-else>
            <div class="side-head"><span>项目</span><div class="side-head-actions"><a-button type="text" size="small" aria-label="新建项目" @click="projectModal = true"><PlusOutlined /></a-button><a-button type="text" size="small" aria-label="收起项目栏" @click="sidebarCollapsed = true"><MenuFoldOutlined /></a-button></div></div>
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
          </template>
        </aside>

        <section class="canvas-column">
          <div class="source-bar">
            <div class="source-card"><label class="source-upload"><span class="step">1</span><span><small>设计原图</small><strong>{{ store.designAsset?.filename || '选择 PNG / JPG' }}</strong></span><CloudUploadOutlined /><input type="file" accept="image/png,image/jpeg" @change="chooseFile('design', $event)"></label><button class="figma-action" @click="openFigma">Figma</button></div>
            <div class="source-card"><label class="source-upload"><span class="step">2</span><span><small>开发实现图</small><strong>{{ store.implementationAsset?.filename || '选择 PNG / JPG' }}</strong></span><CloudUploadOutlined /><input type="file" accept="image/png,image/jpeg" @change="chooseFile('implementation', $event)"></label><button class="figma-action" @click="openCaptures">最近采集</button></div>
            <a-dropdown :disabled="analysisDisabled || store.busy">
              <a-button class="analysis-button" type="primary" size="large" :loading="store.busy" :disabled="analysisDisabled"><ReloadOutlined v-if="!store.busy && isCurrentPairAnalyzed" /><PlayCircleOutlined v-else-if="!store.busy" />{{ analysisActionLabel }}</a-button>
              <template #overlay><a-menu><a-menu-item @click="runAnalysis(false)">像素 + 结构分析</a-menu-item><a-menu-item :disabled="!store.localOcr" @click="runAnalysis(true)">{{ store.localOcr ? '同时启用本地 OCR' : '本地 OCR 不可用（当前安装包）' }}</a-menu-item></a-menu></template>
            </a-dropdown>
          </div>
          <div class="canvas-toolbar">
            <div><strong>{{ store.activeProject?.name || '未选择项目' }}</strong><small v-if="store.activeRun">{{ store.activeRun.score }} 分 · {{ store.issues.length }} 个问题</small></div>
            <div class="view-tools">
              <a-segmented v-model:value="mode" :options="[{ label: '开发图标注', value: 'annotation' }, { label: '平铺对比', value: 'side-by-side' }, { label: '透明度叠加', value: 'overlay' }]" />
              <span class="annotation-toggle"><EyeOutlined /><span>标注</span><a-switch v-model:checked="annotationsVisible" size="small" :aria-label="annotationsVisible ? '隐藏标注' : '显示标注'" /></span>
            </div>
            <div class="zoom-tools"><a-button aria-label="缩小画布" size="small" @click="zoom = Math.max(25, zoom - 10)"><ZoomOutOutlined /></a-button><span>{{ zoom }}%</span><a-button aria-label="放大画布" size="small" @click="zoom = Math.min(200, zoom + 10)"><ZoomInOutlined /></a-button></div>
          </div>
          <div v-if="mode === 'overlay'" class="opacity-bar"><span>开发图透明度</span><a-slider v-model:value="opacity" :min="0" :max="100" /><b>{{ opacity }}%</b></div>
          <a-alert v-if="store.normalization?.applied" class="normalization-alert" type="info" show-icon message="开发图已自动对齐" :description="normalizationDescription" />
          <div class="canvas-stage">
            <a-empty v-if="!designUrl || !implementationUrl" class="workbench-empty" :image="aEmptyImage" description="上传设计原图和开发实现图后开始验收" />
            <div v-else-if="mode === 'side-by-side'" class="side-by-side" :style="{ width: `${zoom}%` }">
              <figure><figcaption>设计原图</figcaption><img :src="designUrl" alt="设计原图"></figure>
              <figure><figcaption>开发实现图</figcaption><div class="comparison-image"><img :src="implementationUrl" alt="开发实现图" @load="naturalSize.width = ($event.target as HTMLImageElement).naturalWidth; naturalSize.height = ($event.target as HTMLImageElement).naturalHeight"><template v-if="annotationsVisible"><button v-for="(issue, index) in filteredIssues" :key="issue.id" class="issue-marker" :class="[issue.severity, { selected: selectedIssueId === issue.id }]" :aria-label="`问题 ${index + 1}：${issue.title}`" :style="{ left: `${issue.rect.x / naturalSize.width * 100}%`, top: `${issue.rect.y / naturalSize.height * 100}%`, width: `${issue.rect.width / naturalSize.width * 100}%`, height: `${issue.rect.height / naturalSize.height * 100}%` }" @click="selectIssue(issue.id, true)"><span>{{ index + 1 }}</span></button></template></div></figure>
            </div>
            <div v-else class="image-stack" :style="{ width: `${zoom}%` }">
              <img v-if="mode === 'overlay'" :src="designUrl" alt="设计原图">
              <img :src="implementationUrl" alt="开发实现图" :style="mode === 'overlay' ? { opacity: opacity / 100 } : {}" @load="naturalSize.width = ($event.target as HTMLImageElement).naturalWidth; naturalSize.height = ($event.target as HTMLImageElement).naturalHeight">
              <template v-if="annotationsVisible">
                <button v-for="(issue, index) in filteredIssues" :key="issue.id" class="issue-marker" :class="[issue.severity, { selected: selectedIssueId === issue.id }]"
                  :aria-label="`问题 ${index + 1}：${issue.title}`" :style="{ left: `${issue.rect.x / naturalSize.width * 100}%`, top: `${issue.rect.y / naturalSize.height * 100}%`, width: `${issue.rect.width / naturalSize.width * 100}%`, height: `${issue.rect.height / naturalSize.height * 100}%` }" @click="selectIssue(issue.id, true)"><span>{{ index + 1 }}</span></button>
              </template>
            </div>
          </div>
        </section>

        <aside class="problem-panel">
          <div class="problem-head">
            <div class="problem-title">
              <div><strong>问题清单</strong><small>按元素自动合并</small></div>
              <a-dropdown>
                <a-button class="export-head-button" size="small"><DownloadOutlined /> 导出</a-button>
                <template #overlay><a-menu @click="({ key }: { key: string }) => exportRun(key as 'png' | 'markdown' | 'json')"><a-menu-item key="png">标注版 PNG</a-menu-item><a-menu-item key="markdown">Markdown 报告</a-menu-item><a-menu-item key="json">结构化 JSON</a-menu-item></a-menu></template>
              </a-dropdown>
            </div>
            <div class="problem-head-actions">
              <a-dropdown :disabled="!selectedIssue" :trigger="['click']">
                <a-tooltip :title="selectedIssue ? '分析当前选中问题' : '请先选择一个问题'">
                  <span><a-button class="ai-head-button" size="small" :disabled="!selectedIssue" aria-label="AI 分析当前问题"><RobotOutlined /> AI</a-button></span>
                </a-tooltip>
                <template #overlay><a-menu><a-menu-item @click="openAI('explain')">解释当前问题</a-menu-item><a-menu-item @click="openAI('business-logic')">推断业务逻辑</a-menu-item></a-menu></template>
              </a-dropdown>
              <span class="score" :class="{ pass: store.activeRun?.passed, pending: !store.activeRun }" title="验收评分（0–100）">{{ store.activeRun?.score ?? '待评' }}</span>
            </div>
          </div>
          <div class="severity-summary"><button :class="{ active: severityFilter === 'all' }" @click="severityFilter = 'all'"><b>{{ store.issues.length }}</b><span>全部</span></button><button :class="{ active: severityFilter === 'critical' }" @click="severityFilter = 'critical'"><b>{{ severityCount.critical }}</b><span>严重</span></button><button :class="{ active: severityFilter === 'major' }" @click="severityFilter = 'major'"><b>{{ severityCount.major }}</b><span>中等</span></button><button :class="{ active: severityFilter === 'minor' }" @click="severityFilter = 'minor'"><b>{{ severityCount.minor }}</b><span>轻微</span></button></div>
          <div class="filter-row"><a-select v-model:value="typeFilter" size="small"><a-select-option value="all">全部类型</a-select-option><a-select-option v-for="item in issueTypes" :key="item" :value="item">{{ item }}</a-select-option></a-select><a-segmented v-model:value="role" size="small" :options="['设计', '开发', 'QA']" /></div>
          <div class="problem-list">
            <a-empty v-if="!issueGroups.length" class="workbench-empty" :image="aEmptyImage" :description="store.activeRun ? '当前筛选下没有问题' : '完成分析后显示问题'" />
            <article v-for="(group, groupIndex) in issueGroups" :id="`issue-group-${group.id}`" :key="group.id" class="issue-group" :class="{ selected: group.issues.some(item => item.id === selectedIssueId) }" @click="selectIssue(group.primary.id)">
              <span class="issue-index" :class="group.severity">{{ groupIndex + 1 }}</span>
              <div class="issue-body"><div class="issue-title"><strong>{{ group.primary.title }}</strong><a-tag :color="group.severity === 'critical' ? 'error' : group.severity === 'major' ? 'warning' : 'default'">{{ group.severity === 'critical' ? '严重' : group.severity === 'major' ? '中等' : '轻微' }}</a-tag></div><div class="type-tags"><span v-for="item in group.issues" :key="item.id">{{ item.type }}</span></div><p>{{ group.issues.map(item => item.plainDescription).join('；') }}</p></div>
            </article>
          </div>
          <div v-if="selectedIssue" class="issue-detail">
            <div class="detail-head"><strong>问题详情</strong><span>{{ role }}视图</span></div>
            <template v-if="role === '设计'"><p>{{ selectedIssue.plainDescription }}</p><dl><dt>设计值</dt><dd>{{ selectedIssue.expected || '见设计稿标注' }}</dd><dt>实现值</dt><dd>{{ selectedIssue.actual || '见开发图标注' }}</dd></dl></template>
            <template v-else-if="role === '开发'"><p>{{ selectedIssue.plainDescription }}</p><pre v-if="selectedIssue.suggestedCssPatch">{{ selectedIssue.suggestedCssPatch }}</pre><a-button v-if="selectedIssue.suggestedCssPatch" block @click="copyPatch(selectedIssue)"><CodeOutlined />复制修改建议</a-button></template>
            <template v-else><p>置信度：{{ selectedIssue.confidence }} · 检测器：{{ selectedIssue.detectorTier }}</p><div class="qa-actions"><a-button @click="store.updateIssue(selectedIssue, 'ignored')">忽略</a-button><a-button type="primary" @click="store.updateIssue(selectedIssue, 'resolved')">标记已修复</a-button></div></template>
          </div>
        </aside>
      </main>
    </div>

    <a-modal v-model:open="needsToken" title="连接本地工作台" :closable="false" :mask-closable="false" :footer="null" width="520px" wrap-class-name="connection-modal">
      <a-alert type="info" show-icon message="当前标签页尚未连接" description="请从 Chrome 工具栏中的 Vigour UI Review 扩展重新打开工作台。系统会新建一个已经安全连接的标签页。" />
      <a-alert v-if="handoffError" class="connection-alert" type="warning" show-icon :message="handoffError" />
      <ol class="connection-steps" aria-label="连接步骤">
        <li><span>1</span><div><strong>打开 Chrome 扩展</strong><p>点击工具栏中的 Vigour UI Review 图标。</p></div></li>
        <li><span>2</span><div><strong>选择“打开工作台”</strong><p>本地配套程序会自动启动并完成连接，无需复制令牌。</p></div></li>
      </ol>
      <p class="connection-help">如果扩展提示未安装或版本不匹配，请安装与扩展相同版本的本地配套程序。</p>
      <details class="developer-connect">
        <summary>开发调试：使用本机令牌连接</summary>
        <p class="modal-note">仅供源码开发和旧版手动启动使用。令牌只保存在当前标签页会话中。</p>
        <a-input-password v-model:value="tokenDraft" aria-label="本地调试令牌" placeholder="粘贴 session-token 文件中的令牌" :status="manualConnectionError ? 'error' : undefined" @press-enter="connect" />
        <p v-if="manualConnectionError" class="connection-error" role="alert">{{ manualConnectionError }}</p>
        <a-button type="primary" block class="connect-button" :loading="connecting" :disabled="!tokenDraft.trim()" @click="connect">手动连接</a-button>
      </details>
    </a-modal>
    <a-modal v-model:open="projectModal" title="新建 UI 验收项目" ok-text="创建" cancel-text="取消" @ok="createProject"><a-form layout="vertical"><a-form-item label="项目名称" required><a-input v-model:value="projectName" placeholder="例如：结算页 Web 重构"></a-input></a-form-item><a-form-item label="说明"><a-textarea v-model:value="projectDescription" :rows="3" placeholder="页面、版本或验收范围"></a-textarea></a-form-item></a-form></a-modal>
    <a-modal v-model:open="figmaModal" title="从 Figma 导入 Frame" :footer="null">
      <a-alert v-if="figmaConfigured" type="success" show-icon message="Figma Token 已安全保存在 macOS 钥匙串" />
      <div v-else class="figma-token-block"><p class="modal-note">请使用仅含 file_content:read 权限的 Personal Access Token。Token 不会写入数据库、浏览器存储或日志。</p><a-input-password v-model:value="figmaPat" placeholder="粘贴 Figma Personal Access Token" /><a-button class="connect-button" block @click="saveFigmaToken">保存到钥匙串</a-button></div>
      <a-divider />
      <a-form layout="vertical"><a-form-item label="Figma Frame 链接"><a-input v-model:value="figmaUrl" placeholder="https://www.figma.com/design/...?...node-id=1-2" /></a-form-item></a-form>
      <a-button type="primary" block :loading="figmaBusy" :disabled="!figmaConfigured || !figmaUrl" @click="importFigmaFrame">导入渲染图与节点语义</a-button>
    </a-modal>
    <a-modal v-model:open="captureModal" title="选择浏览器采集" :footer="null">
      <p>重新采集：返回目标网页，点击 Chrome 工具栏中的 Vigour UI Review。提交结果未确认时，请先刷新列表，避免重复采集。</p>
      <a-button size="small" :loading="captureListBusy" @click="refreshCaptureList"><ReloadOutlined /> 刷新状态</a-button>
      <a-list class="capture-list" :data-source="store.captures" :loading="captureListBusy" bordered>
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta :title="item.title">
              <template #description>
                <div>{{ item.mode === 'full-page' ? '整页' : '视口' }} · {{ new Date(item.createdAt).toLocaleString('zh-CN') }}</div>
                <div v-if="!item.imageAssetId" class="capture-processing-detail" role="status" aria-live="polite">
                  {{ item.processingState === 'processing' ? '正在处理，请稍后刷新状态。' : captureFailureDescription(item) }}
                </div>
              </template>
            </a-list-item-meta>
            <a-button :disabled="!item.imageAssetId" @click="chooseCapture(item)">{{ item.imageAssetId ? '使用' : item.processingState === 'processing' ? '处理中' : '处理失败' }}</a-button>
          </a-list-item>
        </template>
      </a-list>
      <a-empty v-if="!captureListBusy && !store.captures.length" description="还没有浏览器采集，请先使用 Chrome 插件" />
    </a-modal>
    <a-modal v-model:open="aiModal" :title="aiTaskCopy.title" :footer="null" width="640px" wrap-class-name="ai-modal">
      <section class="ai-task-summary" aria-labelledby="ai-task-heading">
        <RobotOutlined />
        <div><small>{{ aiTaskCopy.eyebrow }}</small><strong id="ai-task-heading">{{ selectedIssue?.title }}</strong><p>{{ aiTaskCopy.description }}</p></div>
        <a-tag color="blue">{{ aiTaskCopy.scope }}</a-tag>
      </section>
      <a-alert class="ai-safety-note" type="warning" show-icon message="AI 仅提供辅助判断，不会改变本地检测结果、评分或问题状态。" />

      <a-collapse v-model:active-key="aiSettingsOpen" class="ai-settings" ghost>
        <a-collapse-panel key="settings">
          <template #header><div class="ai-settings-head"><strong>AI 设置</strong><small>{{ aiProviderName }} / {{ aiModel }} · {{ aiConfigured[aiProvider] ? 'Key 已安全配置' : '需要配置 API Key' }}</small></div></template>
          <div class="ai-config-grid">
            <a-form layout="vertical"><a-form-item label="服务商"><a-select v-model:value="aiProvider"><a-select-option value="openai">OpenAI</a-select-option><a-select-option value="gemini">Gemini</a-select-option><a-select-option value="kimi">Kimi</a-select-option><a-select-option value="deepseek">DeepSeek</a-select-option></a-select></a-form-item></a-form>
            <a-form layout="vertical"><a-form-item label="模型"><a-input v-model:value="aiModel" /></a-form-item></a-form>
          </div>
          <div v-if="!aiConfigured[aiProvider]" class="ai-key-field"><a-input-password v-model:value="aiApiKey" placeholder="输入 API Key" /><small>提交分析时保存到系统凭据库（macOS 钥匙串 / Windows 凭据管理器），不写入项目或浏览器存储。</small></div>
        </a-collapse-panel>
      </a-collapse>

      <div class="ai-privacy-options">
        <a-checkbox v-model:checked="aiIncludeImage" :disabled="aiProvider === 'kimi' || aiProvider === 'deepseek'" class="ai-check"><strong>附带完整标注证据图</strong><small>{{ aiProvider === 'kimi' || aiProvider === 'deepseek' ? '当前服务商不支持图片输入' : '发送本次分析的完整标注图，可能包含其他页面内容；默认不发送' }}</small></a-checkbox>
        <a-checkbox v-model:checked="aiConsent" class="ai-check"><strong>确认本次发送</strong><small>向 {{ aiProviderName }} / {{ aiModel }} 发送{{ aiTask === 'explain' ? '当前问题' : `当前组件的 ${aiIssueIds.length} 条关联差异${selectedIssueGroupAll.length > 20 ? '（受接口上限限制，仅发送前 20 条）' : ''}` }}{{ aiIncludeImage ? '和完整标注证据图（不限于当前组件）' : '' }}；确认仅本次有效。</small></a-checkbox>
      </div>
      <a-button class="ai-submit" type="primary" block :loading="aiBusy" :disabled="!aiConsent || !aiModel || !aiKeyReady || !aiIssueIds.length" @click="runAI">{{ aiTaskCopy.action }}</a-button>

      <section v-if="aiResult" class="ai-result" aria-live="polite">
        <div class="ai-result-head"><div><small>AI 分析结果</small><strong>{{ aiTask === 'explain' ? '问题处理建议' : '组件业务逻辑推断' }}</strong></div><a-button size="small" @click="copyAIResult"><CopyOutlined />复制结果</a-button></div>
        <template v-if="aiTask === 'explain'">
          <article><h4>原因与影响</h4><p>{{ aiResult.summary }}</p></article>
          <article v-if="aiResult.fixes.length"><h4>修改建议</h4><ol><li v-for="fix in aiResult.fixes" :key="fix.issueId"><p>{{ fix.explanation }}</p><pre v-if="fix.cssPatch">{{ fix.cssPatch }}</pre></li></ol></article>
        </template>
        <template v-else>
          <article><h4>组件用途</h4><p>{{ aiResult.summary }}</p></article>
          <article><h4>状态规则、交互流程与异常场景</h4><p>{{ aiResult.businessLogic || '当前证据不足，暂时无法形成可靠推断。' }}</p></article>
          <article v-if="aiResult.fixes.length"><h4>证据与实现提示</h4><ol><li v-for="fix in aiResult.fixes" :key="fix.issueId"><p>{{ fix.explanation }}</p><pre v-if="fix.cssPatch">{{ fix.cssPatch }}</pre></li></ol></article>
        </template>
        <a-alert v-for="warning in aiResult.warnings" :key="warning" class="ai-result-warning" type="info" show-icon :message="warning" />
      </section>
    </a-modal>
  </a-config-provider>
</template>

<style>
.capture-list .ant-list-item-meta { flex: 1; min-width: 0; margin-inline-end: 16px; }
.capture-list .ant-list-item-meta-content { min-width: 0; }
.capture-list .ant-list-item > .ant-btn { flex: none; }
.capture-processing-detail { overflow-wrap: anywhere; color: var(--text); }
</style>

<script lang="ts">
import { Empty } from 'ant-design-vue';
export default { data: () => ({ aEmptyImage: Empty.PRESENTED_IMAGE_SIMPLE }) };
</script>
