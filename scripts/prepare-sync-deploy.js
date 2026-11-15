// Read production configuration before deploying; never discard existing indexes.
const fs = require('node:fs');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const rules = require('firebase-tools/lib/gcp/rules');
const { FirestoreApi } = require('firebase-tools/lib/firestore/api');

async function main() {
  const project = 'gfc-bible-reading';
  await requireAuth({ project, nonInteractive: true });
  const releases = await rules.listAllReleases(project);
  const release = releases.find(row => row.name === `projects/${project}/releases/cloud.firestore`);
  if (!release) throw new Error('Published default Firestore rules were not found.');
  const files = await rules.getRulesetContent(release.rulesetName);
  if (files.length !== 1) throw new Error('Unexpected rules layout; deployment stopped.');
  const liveRules = files[0].content;
  const candidate = fs.readFileSync('firestore.rules', 'utf8');
  const start = candidate.indexOf('    // Personal sync data is private');
  const end = candidate.indexOf('    match /communityPosts/', start);
  if (start < 0 || end < 0) throw new Error('Sync rule boundaries were not found.');
  const previous = candidate.slice(0, start) + candidate.slice(end);
  const normalize = value => value.replace(/\s+/g, '');
  if (![previous, candidate].some(value => normalize(value) === normalize(liveRules))) {
    throw new Error('Production rules differ from the reviewed source; refusing to overwrite them.');
  }
  const api = new FirestoreApi();
  const indexes = await api.listIndexes(project, '(default)');
  const fields = await api.listFieldOverrides(project, '(default)');
  const liveIndexes = api.makeIndexSpec(indexes, fields);
  const additions = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));
  const merged = { ...liveIndexes, fieldOverrides: [...(liveIndexes.fieldOverrides || [])] };
  for (const addition of additions.fieldOverrides) {
    const index = merged.fieldOverrides.findIndex(row => row.collectionGroup === addition.collectionGroup && row.fieldPath === addition.fieldPath);
    if (index >= 0) merged.fieldOverrides[index] = addition;
    else merged.fieldOverrides.push(addition);
  }
  fs.mkdirSync('.sync-deploy-backup', { recursive: true });
  fs.writeFileSync('.sync-deploy-backup/firestore.rules', liveRules);
  fs.writeFileSync('.sync-deploy-backup/firestore.indexes.json', JSON.stringify(liveIndexes, null, 2));
  fs.writeFileSync('firestore.indexes.json', JSON.stringify(merged, null, 2));
  console.log(`Production rules verified; preserving ${merged.indexes.length} existing composite indexes.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
