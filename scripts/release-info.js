const fs = require('fs');
const crypto = require('crypto');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo || {};
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const importantFiles = [
  'App.js',
  'app.json',
  'package.json',
  'functions/index.js',
  'firestore.rules',
  '.github/workflows/build-apk.yml',
  '.github/workflows/deploy-firebase.yml'
];
console.log('GF Bible release information');
console.log('App name:', app.name);
console.log('App version:', app.version);
console.log('Android package:', app.android && app.android.package);
console.log('Android versionCode:', app.android && app.android.versionCode);
console.log('Package version:', pkg.version);
console.log('\nImportant file fingerprints:');
for (const file of importantFiles) {
  if (!fs.existsSync(file)) {
    console.log(`- ${file}: missing`);
    continue;
  }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
  console.log(`- ${file}: ${hash}`);
}
