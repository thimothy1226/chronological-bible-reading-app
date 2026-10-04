const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const root = path.resolve(__dirname, '..');
for (const file of ['App.js', 'sync/DeviceLinkModal.js', 'sync/personal-sync-service.js']) {
  parser.parse(fs.readFileSync(path.join(root, file), 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  console.log(`JSX syntax passed: ${file}`);
}
