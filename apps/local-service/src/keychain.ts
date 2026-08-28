import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export const KEYCHAIN_SERVICE = 'com.vigour-ui-review.local';
export const LEGACY_KEYCHAIN_SERVICE = 'com.design-acceptance.local';

function quoteInteractive(value: string): string {
  if (/[^\x20-\x7e]/.test(value)) throw new Error('SECRET_HAS_UNSUPPORTED_CHARACTERS');
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

export interface KeychainRunner {
  save(account: string, secret: string): Promise<void>;
  read(account: string): Promise<string | undefined>;
  remove(account: string): Promise<void>;
}

export class MacKeychainRunner implements KeychainRunner {
  async save(account: string, secret: string): Promise<void> {
    if (!secret || secret.length > 10_000) throw new Error('INVALID_SECRET');
    const command = `add-generic-password -U -s ${quoteInteractive(KEYCHAIN_SERVICE)} -a ${quoteInteractive(account)} -w ${quoteInteractive(secret)}\n`;
    await new Promise<void>((resolve, reject) => {
      const child = spawn('/usr/bin/security', ['-i'], { stdio: ['pipe', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr = (stderr + String(chunk)).slice(-1000); });
      child.once('error', () => reject(new Error('KEYCHAIN_UNAVAILABLE')));
      child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(stderr.includes('User interaction is not allowed') ? 'KEYCHAIN_LOCKED' : 'KEYCHAIN_WRITE_FAILED')));
      child.stdin.end(command);
    });
  }

  private async readFromService(service: string, account: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync('/usr/bin/security', ['find-generic-password', '-s', service, '-a', account, '-w'], { timeout: 10_000, maxBuffer: 20_000 });
      return stdout.trim() || undefined;
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code === 44) return undefined;
      throw new Error('KEYCHAIN_READ_FAILED');
    }
  }

  async read(account: string): Promise<string | undefined> {
    const current = await this.readFromService(KEYCHAIN_SERVICE, account);
    if (current) return current;
    const legacy = await this.readFromService(LEGACY_KEYCHAIN_SERVICE, account);
    if (legacy) await this.save(account, legacy);
    return legacy;
  }

  private async removeFromService(service: string, account: string): Promise<void> {
    try { await execFileAsync('/usr/bin/security', ['delete-generic-password', '-s', service, '-a', account], { timeout: 10_000 }); }
    catch (error) { if ((error as { code?: number }).code !== 44) throw new Error('KEYCHAIN_DELETE_FAILED'); }
  }

  async remove(account: string): Promise<void> {
    await this.removeFromService(KEYCHAIN_SERVICE, account);
    await this.removeFromService(LEGACY_KEYCHAIN_SERVICE, account);
  }
}

export class SecretStore {
  constructor(private readonly runner: KeychainRunner = new MacKeychainRunner()) {}
  saveFigmaPat(value: string) { return this.runner.save('figma-pat', value); }
  readFigmaPat() { return this.runner.read('figma-pat'); }
  removeFigmaPat() { return this.runner.remove('figma-pat'); }
  async hasFigmaPat() { return Boolean(await this.readFigmaPat()); }
  saveProviderKey(provider: 'openai' | 'gemini' | 'kimi' | 'deepseek', value: string) { return this.runner.save(`ai-${provider}`, value); }
  readProviderKey(provider: 'openai' | 'gemini' | 'kimi' | 'deepseek') { return this.runner.read(`ai-${provider}`); }
  removeProviderKey(provider: 'openai' | 'gemini' | 'kimi' | 'deepseek') { return this.runner.remove(`ai-${provider}`); }
  async hasProviderKey(provider: 'openai' | 'gemini' | 'kimi' | 'deepseek') { return Boolean(await this.readProviderKey(provider)); }
}
