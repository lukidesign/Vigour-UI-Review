import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '';
if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`Release tag must use vMAJOR.MINOR.PATCH: ${tag || '(missing)'}`);
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (tag.slice(1) !== manifest.version) throw new Error(`Tag ${tag} does not match package version ${manifest.version}`);
console.log(`Release tag ${tag} matches package version ${manifest.version}.`);
