import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const original = fs.readFileSync('scripts/gf-bible-stage1.mjs', 'utf8');
const repaired = original.replace(
  /replaceOnce\(\n  "        message:[\s\S]*?  'invite GF Bible name',\n\);\n\n/,
  '',
);
const tempPath = path.resolve('.tmp-gf-bible-stage1.mjs');
fs.writeFileSync(tempPath, repaired);
try {
  await import(`${pathToFileURL(tempPath).href}?v=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
