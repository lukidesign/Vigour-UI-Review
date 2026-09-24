import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { createInstaller } from './installer-core.mjs';

const messages = {
  INVALID_EXTENSION_ID: '请填写 Chrome 扩展管理页中的完整 32 位扩展 ID。',
  INVALID_ACTION: '不支持此操作。', NOT_INSTALLED: '尚未安装配套程序。', NO_ROLLBACK: '没有上一安装版本可回退。',
  INSTALL_BUSY: '安装或本地启动正在进行。请稍后重试；若持续出现，请查看修复说明。',
  FOREIGN_NATIVE_REGISTRATION: '已有其他目录的 Native Host 注册。为防止覆盖，请先卸载或解除旧配对。',
  INSTALL_NOT_OWNED: '目标目录存在但不属于此安装助手，已停止操作。',
  SERVICE_NOT_OWNED: '4179 端口由其他程序或旧手动服务占用，已停止操作，不会强制结束它。',
  SERVICE_BUSY: '仍有分析或采集任务，请等待完成后重试。', SERVICE_STOP_FAILED: '未能确认服务停止，未继续切换程序。',
  UNSAFE_INSTALL_PATH: '安装路径包含不安全链接，已停止操作。', UNSAFE_PACKAGE_LINK: '安装包含外部链接，请重新下载完整安装包。',
  PACKAGE_INTEGRITY_FAILED: '安装包校验失败，请重新下载。', INCOMPLETE_PACKAGE: '安装包不完整。',
  INVALID_PACKAGE: '安装包格式不匹配。', PERSONAL_CONFIG_IN_PACKAGE: '安装包混入个人配对配置，请使用原始安装包。',
};
try {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('仅支持 Apple Silicon 内测。');
  const action = process.argv[2];
  const installer = await createInstaller(homedir());
  const result = action === 'status' ? await installer.status()
    : await installer.perform(action, { source: resolve(import.meta.dirname, '../companion'), extensionId: process.argv[3] });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ ok: false, message: messages[error?.message] ?? '操作未完成。请检查磁盘空间、访问权限和安装包完整性；没有自动删除用户数据。' })}\n`);
  process.exitCode = 1;
}
