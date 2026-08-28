import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api, fileDataUrl } from '../api';
import type { AnalysisResponse, ImageAsset, ImageNormalization, Issue, Project, Run } from '../types';

export const useWorkbenchStore = defineStore('workbench', () => {
  const projects = ref<Project[]>([]);
  const activeProjectId = ref('');
  const runs = ref<Run[]>([]);
  const activeRun = ref<Run>();
  const issues = ref<Issue[]>([]);
  const evidenceAssetId = ref('');
  const normalization = ref<ImageNormalization>();
  const designAsset = ref<ImageAsset>();
  const implementationAsset = ref<ImageAsset>();
  const busy = ref(false);
  const error = ref('');
  const captures = ref<Array<{ id: string; title: string; pageUrl: string; mode: string; imageAssetId?: string; createdAt: string }>>([]);
  const activeProject = computed(() => projects.value.find((project) => project.id === activeProjectId.value));

  async function loadProjects() {
    [projects.value, captures.value] = await Promise.all([api<Project[]>('/api/v1/projects'), api<typeof captures.value>('/api/v1/captures')]);
    if (!activeProjectId.value && projects.value[0]) await selectProject(projects.value[0].id);
  }
  async function refreshCaptures() { captures.value = await api<typeof captures.value>('/api/v1/captures'); }
  function useCapture(capture: { imageAssetId?: string; title: string }) {
    if (!capture.imageAssetId) throw new Error('该采集尚未生成可分析图片');
    implementationAsset.value = { id: capture.imageAssetId, filename: capture.title, kind: 'implementation', mimeType: 'image/png', width: 0, height: 0, createdAt: '' };
    normalization.value = undefined;
  }
  async function createProject(name: string, description = '') {
    const project = await api<Project>('/api/v1/projects', { method: 'POST', body: JSON.stringify({ name, description }) });
    projects.value.unshift(project); await selectProject(project.id); return project;
  }
  async function selectProject(id: string) {
    activeProjectId.value = id;
    runs.value = await api<Run[]>(`/api/v1/projects/${id}/runs`);
    if (runs.value[0]?.state === 'ready') await selectRun(runs.value[0].id);
    else { activeRun.value = undefined; issues.value = []; evidenceAssetId.value = ''; normalization.value = undefined; }
  }
  async function selectRun(id: string) {
    const data = await api<{ run: Run; issues: Issue[]; evidenceAssetId?: string }>(`/api/v1/runs/${id}`);
    activeRun.value = data.run; issues.value = data.issues; evidenceAssetId.value = data.evidenceAssetId ?? '';
    normalization.value = undefined;
    if (data.run.designAssetId) designAsset.value = { id: data.run.designAssetId, filename: '设计图 · 历史记录' } as ImageAsset;
    if (data.run.implementationAssetId) implementationAsset.value = { id: data.run.implementationAssetId, filename: '实现图 · 历史记录' } as ImageAsset;
  }
  async function uploadImage(kind: 'design' | 'implementation', file: File) {
    if (file.size > 25 * 1024 * 1024) throw new Error('图片不能超过 25MB');
    const asset = await api<ImageAsset>('/api/v1/assets/images', {
      method: 'POST', body: JSON.stringify({ kind, filename: file.name, dataUrl: await fileDataUrl(file) }),
    });
    if (kind === 'design') designAsset.value = asset; else implementationAsset.value = asset;
    normalization.value = undefined;
  }
  async function analyze(useOcr = false) {
    if (!activeProjectId.value || !designAsset.value || !implementationAsset.value) throw new Error('请先选择项目并上传两张图片');
    busy.value = true; error.value = ''; normalization.value = undefined;
    try {
      const data = await api<AnalysisResponse>('/api/v1/runs/analyze', {
        method: 'POST', body: JSON.stringify({ projectId: activeProjectId.value, referenceAssetId: designAsset.value.id, candidateAssetId: implementationAsset.value.id, useOcr }),
      });
      activeRun.value = data.run; issues.value = data.issues; evidenceAssetId.value = data.evidenceAssetId; normalization.value = data.normalization;
      runs.value.unshift(data.run);
    } catch (reason) { error.value = reason instanceof Error ? reason.message : '分析失败'; throw reason; }
    finally { busy.value = false; }
  }
  async function updateIssue(issue: Issue, status: Issue['status']) {
    await api(`/api/v1/issues/${issue.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    issue.status = status;
  }

  async function figmaStatus() { return await api<{ configured: boolean }>('/api/v1/settings/secrets/figma'); }
  async function saveFigmaPat(token: string) { return await api<{ configured: boolean }>('/api/v1/settings/secrets/figma', { method: 'POST', body: JSON.stringify({ token }) }); }
  async function importFigma(url: string) {
    const result = await api<{ asset: ImageAsset; import: { id: string; nodeName: string; nodeCount: number } }>('/api/v1/figma/import', { method: 'POST', body: JSON.stringify({ url }) });
    designAsset.value = result.asset; normalization.value = undefined; return result;
  }
  async function aiKeyStatus() { return await api<Record<'openai' | 'gemini' | 'kimi' | 'deepseek', boolean>>('/api/v1/settings/secrets/ai'); }
  async function saveAIKey(provider: string, apiKey: string) { return await api(`/api/v1/settings/secrets/ai/${provider}`, { method: 'POST', body: JSON.stringify({ apiKey }) }); }
  async function analyzeWithAI(input: { provider: string; model: string; task: 'explain' | 'business-logic'; issueIds: string[]; includeImage: boolean }) {
    if (!activeRun.value) throw new Error('请先完成一次本地分析');
    const payload = { ...input, runId: activeRun.value.id };
    const receipt = await api<{ id: string }>('/api/v1/ai/consents', { method: 'POST', body: JSON.stringify({ ...payload, confirmed: true }) });
    return await api<{ provider: string; model: string; result: { summary: string; businessLogic?: string; fixes: Array<{ issueId: string; explanation: string; cssPatch?: string }>; warnings: string[] } }>('/api/v1/ai/analyze', {
      method: 'POST', body: JSON.stringify({ ...payload, receiptId: receipt.id }),
    });
  }

  return { projects, activeProjectId, activeProject, runs, activeRun, issues, evidenceAssetId, normalization, designAsset, implementationAsset, captures, busy, error, loadProjects, refreshCaptures, useCapture, createProject, selectProject, selectRun, uploadImage, analyze, updateIssue, figmaStatus, saveFigmaPat, importFigma, aiKeyStatus, saveAIKey, analyzeWithAI };
});
