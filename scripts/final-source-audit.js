const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const required = [
  'App.js', 'app.json', 'package.json', 'package-lock.json',
  'firebase.json', 'firestore.rules', 'functions/index.js',
  'google-services.json', 'assets/bibles/nkrv-ot-corrections.json',
  'android/app/build.gradle',
];
const missing = required.filter((item) => !fs.existsSync(path.join(root, item)));
if (missing.length) throw new Error(`Missing required source files: ${missing.join(', ')}`);

const app = require(path.join(root, 'app.json')).expo;
const pkg = require(path.join(root, 'package.json'));
if (app.version !== pkg.version) throw new Error(`Version mismatch: app ${app.version}, package ${pkg.version}`);

const corrections = require(path.join(root, 'assets/bibles/nkrv-ot-corrections.json'));
const countedVerses = corrections.books.reduce((total, book) => total + book.chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0), 0);
if (corrections.books.length !== 39 || countedVerses !== 23144 || corrections.verseCount !== countedVerses) {
  throw new Error(`Invalid NKRV OT correction bundle: ${corrections.books.length} books, ${countedVerses} verses`);
}

const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
if (!gradle.includes(`versionName "${app.version}"`) || !gradle.includes(`versionCode ${app.android.versionCode}`)) {
  throw new Error('Android version does not match app.json');
}

console.log(`Final source audit passed (${app.version}, code ${app.android.versionCode}, NKRV OT ${countedVerses} verses).`);
