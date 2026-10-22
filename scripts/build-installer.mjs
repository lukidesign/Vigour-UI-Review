import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { seal } from '../apps/companion-installer/payload.mjs';
import { macPlatform } from '../apps/companion-installer/platform.mjs';

const root = resolve(import.meta.dirname, '..');
const platform = macPlatform();
const source = process.env.VIGOUR_UI_REVIEW_PACKAGE_DIR;
const output = process.env.VIGOUR_INSTALLER_OUTPUT;
if (!source || !output || !output.endsWith('.app')) throw new Error('Set VIGOUR_UI_REVIEW_PACKAGE_DIR and a new VIGOUR_INSTALLER_OUTPUT ending in .app');
const target = resolve(output);
const minimumMacOS = platform.minimumMacOS;
const extensionId = process.env.VIGOUR_STORE_EXTENSION_ID ?? '';
if (extensionId && !/^[a-p]{32}$/.test(extensionId)) throw new Error('Invalid fixed store extension ID');
try { await stat(target); throw new Error('Refusing to overwrite an existing installer'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const resources = join(target, 'Contents/Resources'); const executable = join(target, 'Contents/MacOS');
await mkdir(executable, { recursive: true }); await mkdir(resources, { recursive: true });
await cp(resolve(source), join(resources, 'companion'), { recursive: true, dereference: false, verbatimSymlinks: true });
const packagePlatform = JSON.parse(await readFile(join(resources, 'companion/PLATFORM.json'), 'utf8'));
if (packagePlatform.platform !== platform.platform || packagePlatform.localOcr !== platform.localOcr) throw new Error('Mismatched package architecture/profile');
const payload = await seal(join(resources, 'companion'), { platform: platform.platform });
await cp(join(root, 'apps/companion-installer'), join(resources, 'installer'), { recursive: true });
await writeFile(join(target, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.vigour-ui-review.installer</string><key>CFBundleName</key><string>Vigour UI Review Setup</string><key>CFBundleExecutable</key><string>VigourSetup</string><key>CFBundleVersion</key><string>${payload.version}</string><key>CFBundleShortVersionString</key><string>${payload.version}</string><key>VigourExtensionId</key><string>${extensionId}</string><key>LSMinimumSystemVersion</key><string>${minimumMacOS}</string><key>NSHighResolutionCapable</key><true/></dict></plist>\n`);
await new Promise((done, reject) => {
  const child = spawn('/usr/bin/xcrun', ['swiftc', '-O', '-target', `${platform.binaryArch}-apple-macos${minimumMacOS}`, '-framework', 'AppKit', join(root, 'apps/companion-installer/Installer.swift'), '-o', join(executable, 'VigourSetup')], { stdio: 'inherit' });
  child.once('error', reject); child.once('exit', (code) => code === 0 ? done() : reject(new Error(`Installer build failed (${code})`)));
});
console.log(`Unsigned developer installer built: ${target}`);
