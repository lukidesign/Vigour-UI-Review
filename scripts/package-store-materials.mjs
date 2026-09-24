import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, join, basename } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = process.env.VIGOUR_STORE_MATERIALS_DIR;
if (!output) throw new Error('Set VIGOUR_STORE_MATERIALS_DIR to a new output directory');
const target = resolve(output); const archive = `${target}.zip`;
for (const path of [target, archive, `${archive}.sha256`]) {
  try { await stat(path); throw new Error('Refusing to overwrite store materials'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function command(name, args) {
  await new Promise((done, reject) => { const child = spawn(name, args, { cwd: root, stdio: 'inherit' }); child.once('error', reject); child.once('exit', (code) => code === 0 ? done() : reject(new Error(`Packaging step failed (${code})`))); });
}
await command(process.execPath, ['scripts/check-store-assets.mjs']);
await mkdir(join(target, 'docs'), { recursive: true });
await cp(join(root, 'docs/store'), join(target, 'docs/store'), { recursive: true });
await cp(join(root, 'docs/PRIVACY.md'), join(target, 'docs/PRIVACY.md'));
await cp(join(root, 'apps/chrome-extension/public/icons'), join(target, 'apps/chrome-extension/public/icons'), { recursive: true });
await cp(join(root, 'LICENSE'), join(target, 'LICENSE'));
await writeFile(join(target, 'README.md'), '# Vigour UI Review · 商店材料草稿\n\n发布商名称与工程版权署名：LukiDesign。插件名称仍为 Vigour UI Review。\n\n从 [材料索引](docs/store/README.md) 开始。含文案、隐私说明、权限理由、审核指引、内测表、图标、宣传图和真实示例截图。\n\n这是未提交的材料包，不是扩展安装包或正式发布包；不要把此 ZIP 上传到商店作为扩展程序。真实商店 ID、配套下载地址、新版本号及账号信息仍需补齐。\n');
if (process.platform !== 'darwin') throw new Error('Archive helper currently uses macOS ditto');
await command('/usr/bin/ditto', ['-c', '-k', '--norsrc', '--keepParent', target, archive]);
const digest = createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(`${archive}.sha256`, `${digest}  ${basename(archive)}\n`, { flag: 'wx' });
console.log(`Store materials draft: ${archive}`);
