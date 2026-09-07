import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const original = fs.readFileSync('scripts/gf-bible-stage2.mjs', 'utf8');
let repaired = original.replace(
  /replaceOnce\(\n  "  selectionCount:[\s\S]*?  'selection action size',\n\);\n\n/,
  '',
);
repaired = repaired.replace(
  /replaceOnce\(\n  "  selectionClear:[\s\S]*?  'highlight style',\n\);\n\n/,
  '',
);
const tempPath = path.resolve('.tmp-gf-bible-stage2.mjs');
fs.writeFileSync(tempPath, repaired);
try {
  await import(`${pathToFileURL(tempPath).href}?v=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
