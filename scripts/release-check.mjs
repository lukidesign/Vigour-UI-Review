import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const commands = [
  ['pnpm', ['repository:check']],
  ['pnpm', ['typecheck']], ['pnpm', ['test']], ['pnpm', ['build']],
  ['uv', ['run', '--project', 'apps/vision-engine', 'pytest', '-c', 'apps/vision-engine/pyproject.toml', 'apps/vision-engine/tests']],
  ['pnpm', ['benchmark']],
];
for (const [command, args] of commands) {
  const code = await new Promise((resolveExit, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.once('error', reject); child.once('exit', resolveExit);
  });
  if (code !== 0) process.exit(Number(code) || 1);
}
console.log('Release check passed.');
