const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'App.js',
  'app.json',
  'package.json',
  'assets/icon.png',
  'assets/adaptive-icon.png',
  'assets/splash.png',
  'functions/index.js',
  'firestore.rules',
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('GF Bible validation failed. Missing files:');
  missing.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}

const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (appJson?.expo?.name !== 'GF Bible') {
  console.error(`GF Bible validation failed: expo.name is '${appJson?.expo?.name ?? 'undefined'}'.`);
  process.exit(1);
}

if (pkg.name !== 'gf-bible') {
  console.error(`GF Bible validation failed: package name is '${pkg.name}'.`);
  process.exit(1);
}

console.log(`GF Bible source validation passed (version ${appJson?.expo?.version || pkg.version || 'unknown'}).`);
