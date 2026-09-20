const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const required = [
  'App.js', 'app.json', 'package.json', 'package-lock.json',
  'firebase.json', 'firestore.rules', 'functions/index.js',
  'google-services.json', 'assets/bibles/nkrv-ot-corrections.json',
  'assets/bibles/nkrv-nt-corrections/index.js',
  'assets/bibles/psalm-headings-ko.json',
  'android/app/build.gradle',
];
const missing = required.filter((item) => !fs.existsSync(path.join(root, item)));
if (missing.length) throw new Error(`Missing required source files: ${missing.join(', ')}`);

const app = require(path.join(root, 'app.json')).expo;
const pkg = require(path.join(root, 'package.json'));
if (app.version !== pkg.version) throw new Error(`Version mismatch: app ${app.version}, package ${pkg.version}`);

const otCorrections = require(path.join(root, 'assets/bibles/nkrv-ot-corrections.json'));
const ntCorrections = require(path.join(root, 'assets/bibles/nkrv-nt-corrections'));
const psalmHeadings = require(path.join(root, 'assets/bibles/psalm-headings-ko.json'));
const countedOldTestamentVerses = otCorrections.books.reduce((total, book) => total + book.chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0), 0);
const countedNewTestamentCorrections = ntCorrections.books.reduce((total, book) => total + book.verses.length, 0);
if (otCorrections.books.length !== 39 || countedOldTestamentVerses !== 23144 || otCorrections.verseCount !== countedOldTestamentVerses) {
  throw new Error(`Invalid NKRV OT correction bundle: ${otCorrections.books.length} books, ${countedOldTestamentVerses} verses`);
}
if (ntCorrections.books.length !== 27 || countedNewTestamentCorrections !== 1111 || ntCorrections.correctionCount !== countedNewTestamentCorrections) {
  throw new Error(`Invalid NKRV NT correction bundle: ${ntCorrections.books.length} books, ${countedNewTestamentCorrections} corrections`);
}
if (psalmHeadings.count !== 116 || Object.keys(psalmHeadings.headings || {}).length !== 116) {
  throw new Error(`Invalid Psalm heading bundle: ${Object.keys(psalmHeadings.headings || {}).length} headings`);
}

const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
if (!gradle.includes(`versionName "${app.version}"`) || !gradle.includes(`versionCode ${app.android.versionCode}`)) {
  throw new Error('Android version does not match app.json');
}

console.log(`Final source audit passed (${app.version}, code ${app.android.versionCode}, NKRV OT ${countedOldTestamentVerses} verses + NT ${countedNewTestamentCorrections} corrections + Psalm ${psalmHeadings.count} headings).`);
