import { describe, it, expect } from 'vitest';
import { macPlatform, macOSVersionAtMost } from '../apps/companion-installer/platform.mjs';
import { requiredFor } from '../apps/companion-installer/payload.mjs';
describe('macOS profiles', () => {
  it('keeps Intel core-only and ARM OCR dependencies distinct', () => {
    expect(macPlatform('x64', 'darwin')).toMatchObject({ platform: 'darwin-x64', binaryArch: 'x86_64', localOcr: false, minimumMacOS: '14.0' });
    expect(macPlatform('arm64', 'darwin')).toMatchObject({ platform: 'darwin-arm64', localOcr: true, minimumMacOS: '14.5' });
    expect(requiredFor('darwin-x64')).toEqual(requiredFor('darwin-arm64'));
  });
  it('compares deployment targets without allowing newer patch, minor or major requirements', () => {
    for (const version of ['11.0', '14.0', '14.5', '14.5.0']) expect(macOSVersionAtMost(version, '14.5')).toBe(true);
    for (const version of ['14.5.1', '14.6', '14.10', '15.0']) expect(macOSVersionAtMost(version, '14.5')).toBe(false);
    expect(macOSVersionAtMost('14.5', '14.0')).toBe(false);
    expect(() => macOSVersionAtMost('invalid', '14.5')).toThrow('INVALID_MACOS_VERSION');
  });
  it('rejects unsupported hosts and architectures', () => {
    expect(() => macPlatform('x64', 'win32')).toThrow('UNSUPPORTED_MAC_PLATFORM');
    expect(() => macPlatform('ia32', 'darwin')).toThrow('UNSUPPORTED_MAC_PLATFORM');
    expect(() => requiredFor('darwin-ia32')).toThrow('INVALID_PACKAGE_PLATFORM');
  });
});
