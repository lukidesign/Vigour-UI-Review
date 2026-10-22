import { rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createWindowsInstaller } from './windows-core.mjs';

const resultPath = resolve(import.meta.dirname, 'result.txt');
const diagnosticPath = resolve(import.meta.dirname, 'diagnostic.json');
const started = Date.now();
let phase = 'start';
const action = process.argv[2];
// Never log tokens, IDs, user paths, page data or raw exceptions.
async function progress(next, code) {
  phase = next;
  await writeFile(diagnosticPath, JSON.stringify({ action: ['install', 'repair', 'rollback', 'uninstall', 'status'].includes(action) ? action : 'unknown',
    phase, elapsedMs: Date.now() - started, ...(code ? { code } : {}) })).catch(() => undefined);
}
const messages = {
  INVALID_EXTENSION_ID: 'Chrome 扩展 ID 应为 32 个 a–p 小写字母。请到 chrome://extensions 核对。',
  INVALID_ACTION: '不支持此安装操作。', NOT_INSTALLED: '尚未安装配套程序。', NO_ROLLBACK: '没有上一安装版本可回退。',
  INSTALL_BUSY: '工作台正在启动或安装正在进行。关闭 Chrome 扩展弹窗后重试。',
  FOREIGN_NATIVE_REGISTRATION: '已有其他 Native Host 注册。安装器不会覆盖它；请先检查旧配套程序。',
  INSTALL_NOT_OWNED: '安装目录不属于此安装器，已停止操作。',
  SERVICE_NOT_OWNED: '本机 4179 端口正被其他程序占用，安装器没有结束该进程。',
  SERVICE_BUSY: '工作台仍有采集或分析任务，请完成后再试。',
  SERVICE_STOP_FAILED: '无法确认旧工作台已退出，原安装保持不变。',
  UNSAFE_INSTALL_PATH: '安装位置包含不安全链接，已停止操作。',
  UNSAFE_PACKAGE_LINK: '安装包包含不安全链接，请重新下载。',
  PACKAGE_INTEGRITY_FAILED: '安装包完整性校验失败，请重新下载。',
  INCOMPLETE_PACKAGE: '安装包缺少运行文件。', INVALID_PACKAGE: '安装包平台或格式不匹配。',
  REGISTRATION_FAILED: '无法写入当前用户的 Chrome Native Messaging 注册。',
  REGISTRY_TIMEOUT: 'Windows 注册表操作超时，安装或卸载未完成。请关闭安装器后重试。',
  UNINSTALL_FILES_LOCKED: 'Chrome 配对已移除，但部分程序文件未能清理。请关闭 Chrome 后重试；项目数据已保留。',
};
try {
  await rm(resultPath, { force: true });
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('仅支持 Windows 11 x64。');
  if (!process.env.LOCALAPPDATA) throw new Error('无法找到当前用户的 LocalAppData。');
  await progress('start');
  const installer = await createWindowsInstaller(process.env.LOCALAPPDATA, { progress });
  const result = action === 'status' ? await installer.status()
    : await installer.perform(action, { source: resolve(import.meta.dirname, '../companion'), extensionId: process.argv[3] });
  await writeFile(resultPath, action === 'status' ? JSON.stringify(result) : '操作成功。项目数据已保留。');
} catch (error) {
  await progress(phase, Object.hasOwn(messages, error?.message) ? error.message : 'INSTALLER_FAILED');
  await writeFile(resultPath, messages[error?.message] ?? '操作未完成。请检查磁盘空间、权限和安装包完整性；项目数据未被安装器删除。');
  process.exitCode = 1;
}
// Dedicated one-shot helper: all writes and cleanup above are awaited. Do not
// let networking keep-alives hold Inno's ewWaitUntilTerminated open afterwards.
process.exit(process.exitCode ?? 0);
