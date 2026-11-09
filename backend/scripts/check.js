import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await check(filename);
    else if (filename.endsWith('.js') && spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' }).status !== 0) process.exit(1);
  }
}
await check('src');
await check('scripts');
console.log('Backend ES-module syntax build check passed (Node runs source directly).');
