import { describe, it, expect } from 'vitest';
import { macPlatform } from '../apps/companion-installer/platform.mjs';
import { requiredFor } from '../apps/companion-installer/payload.mjs';
describe('macOS profiles', () => {
  it('keeps Intel core-only and ARM OCR dependencies distinct', () => {
    expect(macPlatform('x64', 'darwin')).toMatchObject({ platform: 'darwin-x64', binaryArch: 'x86_64', localOcr: false, minimumMacOS: '14.0' });
    expect(macPlatform('arm64', 'darwin')).toMatchObject({ platform: 'darwin-arm64', localOcr: true });
    expect(requiredFor('darwin-x64')).toEqual(requiredFor('darwin-arm64'));
  });
  it('rejects unsupported hosts and architectures', () => {
    expect(() => macPlatform('x64', 'win32')).toThrow('UNSUPPORTED_MAC_PLATFORM');
    expect(() => macPlatform('ia32', 'darwin')).toThrow('UNSUPPORTED_MAC_PLATFORM');
    expect(() => requiredFor('darwin-ia32')).toThrow('INVALID_PACKAGE_PLATFORM');
  });
});
