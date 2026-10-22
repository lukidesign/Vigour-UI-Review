export function macPlatform(arch = process.arch, platform = process.platform) {
  if (platform !== 'darwin' || !['arm64', 'x64'].includes(arch)) throw new Error('UNSUPPORTED_MAC_PLATFORM');
  return { platform: `darwin-${arch}`, arch, binaryArch: arch === 'x64' ? 'x86_64' : 'arm64',
    minimumMacOS: arch === 'arm64' ? '14.5' : '14.0', localOcr: arch === 'arm64' };
}

export function macOSVersionAtMost(required, supported) {
  const parse = (value) => {
    if (!/^\d+\.\d+(?:\.\d+)?$/.test(value)) throw new Error('INVALID_MACOS_VERSION');
    return value.split('.').map(Number);
  };
  const a = parse(required), b = parse(supported);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return true;
}
