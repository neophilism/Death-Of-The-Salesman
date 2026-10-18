import {existsSync} from 'node:fs';
for (const path of ['apps/api/package.json', 'apps/worker/package.json', 'package-lock.json']) {
  if (!existsSync(path)) throw new Error('Missing workspace input: ' + path);
}
process.stdout.write('Offline workspace layout verified; TypeScript and Next.js pending\n');
