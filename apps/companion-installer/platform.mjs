export function macPlatform(arch = process.arch, platform = process.platform) {
  if (platform !== 'darwin' || !['arm64', 'x64'].includes(arch)) throw new Error('UNSUPPORTED_MAC_PLATFORM');
  return { platform: `darwin-${arch}`, arch, binaryArch: arch === 'x64' ? 'x86_64' : 'arm64',
    minimumMacOS: '14.0', localOcr: arch === 'arm64' };
}
