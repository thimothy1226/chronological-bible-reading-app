// Run with FIRESTORE_EMULATOR_HOST and NODE_PATH pointing to test dependencies.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, getDocs, collection } = require('firebase/firestore');
const projectId = 'demo-gf-sync';
let app, db, rules;
const api = require('../functions/device-sync');
const request = (uid, data = {}, ip = '127.0.0.1') => ({ auth: { uid }, data, rawRequest: { ip } });
const run = (name, uid, data) => api[name].run(request(uid, data));
const entry = (uid, value, at = Date.now()) => ({ device: uid, value, at, seq: 1, deleted: false });
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Tests require an isolated Firestore emulator. Never run against production.');
  app = initializeApp({ projectId }); db = getFirestore();
  rules = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8089, rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8') } });
  await rules.clearFirestore();
});
after(async () => { await rules?.cleanup(); await deleteApp(app); });
test('pairing is atomic, one-use and direction-independent; retry is idempotent', async () => {
  const a = await run('initializePersonalSync', 'tablet', { name: '내 태블릿' });
  const b = await run('initializePersonalSync', 'phone', { name: '내 핸드폰' });
  await run('exchangePersonalSync', 'tablet', { profileId: a.profileId, generation: 0, since: -1, changes: { 'notes|tablet': entry('tablet', 'tablet note') } });
  await run('exchangePersonalSync', 'phone', { profileId: b.profileId, generation: 0, since: -1, changes: { 'notes|phone': entry('phone', 'phone note') } });
  const code = await run('createPersonalLinkCode', 'tablet');
  assert.match(code.code, /^\d{6}$/); assert.ok(code.expiresAt - code.serverTime <= 300000);
  await assert.rejects(run('preparePersonalLink', 'tablet', { code: code.code }), /다른 기기/);
  const link = await run('preparePersonalLink', 'phone', { code: code.code });
  await assert.rejects(run('finishPersonalLink', 'attacker', { ...link, mode: 'merge' }), /확인하지/);
  const result = await run('finishPersonalLink', 'phone', { ...link, mode: 'merge' });
  assert.equal(result.profileId, a.profileId);
  const repeat = await run('finishPersonalLink', 'phone', { ...link, mode: 'merge' }); assert.equal(repeat.profileId, result.profileId);
  const state = (await db.doc(`personalSyncProfiles/${a.profileId}/private/state`).get()).data();
  assert.equal(state.records['notes|tablet'].value, 'tablet note'); assert.equal(state.records['notes|phone'].value, 'phone note');
  assert.equal((await run('listPersonalSyncDevices', 'phone')).devices.length, 2);
  const c = await run('initializePersonalSync', 'stranger', { name: 'stranger' }); assert.ok(c.profileId);
  await assert.rejects(run('preparePersonalLink', 'stranger', { code: code.code }), /만료/);
  assert.equal((await db.collection(`personalSyncProfiles/${a.profileId}/backups`).get()).size, 2);
});
test('expiry and regeneration reject the earlier code', async () => {
  await run('initializePersonalSync', 'exp-source'); await run('initializePersonalSync', 'exp-receiver');
  const old = await run('createPersonalLinkCode', 'exp-source'); const fresh = await run('createPersonalLinkCode', 'exp-source');
  if (fresh.code !== old.code) await assert.rejects(run('preparePersonalLink', 'exp-receiver', { code: old.code }), /만료/);
  const hash = require('node:crypto').createHash('sha256').update(fresh.code).digest('hex');
  await db.doc(`personalLinkCodes/${hash}`).update({ expiresAt: Date.now() - 1 });
  await assert.rejects(run('preparePersonalLink', 'exp-receiver', { code: fresh.code }), /만료/);
});
test('chosen receiver replaces source with a generation barrier and preserves backups', async () => {
  const a = await run('initializePersonalSync', 'replace-source'); const b = await run('initializePersonalSync', 'replace-receiver');
  await run('exchangePersonalSync', 'replace-source', { profileId: a.profileId, generation: 0, since: -1, changes: { 'notes|discarded': entry('replace-source', 'original') } });
  await run('exchangePersonalSync', 'replace-receiver', { profileId: b.profileId, generation: 0, since: -1, changes: { 'notes|chosen': entry('replace-receiver', 'chosen') } });
  const code = await run('createPersonalLinkCode', 'replace-source'); const link = await run('preparePersonalLink', 'replace-receiver', { code: code.code });
  const oldEditAt = Date.now() - 100;
  await run('finishPersonalLink', 'replace-receiver', { ...link, mode: 'receiver' });
  const response = await run('exchangePersonalSync', 'replace-source', { profileId: a.profileId, generation: 0, since: 1, changes: { 'notes|discarded': entry('replace-source', 'offline old', oldEditAt) } });
  assert.equal(response.full, true); assert.equal(response.generation, 1); assert.equal(response.records['notes|discarded'], undefined); assert.equal(response.records['notes|chosen'].value, 'chosen');
  const after = await run('exchangePersonalSync', 'replace-source', { profileId: a.profileId, generation: 0, since: 1, changes: { 'notes|after-choice': entry('replace-source', 'later offline edit', Date.now() + 1) } });
  assert.equal(after.records['notes|after-choice'].value, 'later offline edit');
});
test('cross-profile reads, writes, code listing, scripture fields and forged device IDs are denied', async () => {
  const a = (await db.doc('personalSyncDevices/tablet').get()).data().profileId;
  const authA = rules.authenticatedContext('tablet').firestore(); const attacker = rules.authenticatedContext('attacker').firestore();
  await assertSucceeds(getDoc(doc(authA, 'personalSyncDevices', 'tablet')));
  await assertSucceeds(getDoc(doc(authA, 'personalSyncProfiles', a)));
  await assertFails(getDoc(doc(attacker, 'personalSyncProfiles', a)));
  await assertFails(getDoc(doc(authA, 'personalSyncProfiles', a, 'private', 'state')));
  await assertFails(getDocs(collection(authA, 'personalLinkCodes')));
  await assertFails(setDoc(doc(authA, 'personalSyncDevices', 'tablet'), { profileId: 'forged' }));
  await assert.rejects(run('exchangePersonalSync', 'stranger', { profileId: a, generation: 0, since: 0, changes: {} }), /다시 확인/);
  await assert.rejects(run('exchangePersonalSync', 'tablet', { profileId: a, generation: 0, since: 0, changes: { 'notes|v': entry('forged', 'x') } }), /형식/);
  await assert.rejects(run('exchangePersonalSync', 'tablet', { profileId: a, generation: 0, since: 0, changes: { 'bookmarks|v': entry('tablet', { label: 'v', savedAt: '', text: 'Bible text' }) } }), /형식/);
});
test('guessed numeric codes are rate-limited', async () => {
  await run('initializePersonalSync', 'guesser');
  for (let i = 0; i < 5; i++) await assert.rejects(run('preparePersonalLink', 'guesser', { code: '123456' }));
  await assert.rejects(run('preparePersonalLink', 'guesser', { code: '123456' }), /10분/);
});

test('linked community migrates existing devices, propagates edits and protects admin removal', async () => {
  const { Timestamp } = require('firebase-admin/firestore');
  const community = require('../functions/community-sync');
  const invoke = uid => community.syncLinkedCommunity.run(request(uid));
  const pid = 'community-existing-profile';
  for (const uid of ['community-a','community-b']) {
    await db.doc(`personalSyncDevices/${uid}`).set({ profileId: pid });
    await db.doc(`personalSyncProfiles/${pid}/devices/${uid}`).set({ name: uid });
  }
  await db.doc('groups/community-group').set({ name: 'test', normalizedInviteCode: 'secret' });
  const a = db.doc('memberships/community-group_community-a');
  const b = db.doc('memberships/community-group_community-b');
  await a.set({ memberUid: 'community-a', groupId: 'community-group', nickname: '기존닉네임', active: true, removedByAdmin: false, joinedAt: Timestamp.fromMillis(1000), updatedAt: Timestamp.fromMillis(1000) });
  await invoke('community-b');
  assert.equal((await b.get()).data().nickname, '기존닉네임');
  assert.equal((await b.get()).data().memberUid, 'community-b');
  await b.update({ nickname: '변경닉네임', nicknameChangedAt: Timestamp.fromMillis(2000), updatedAt: Timestamp.fromMillis(2000) });
  await invoke('community-a');
  assert.equal((await a.get()).data().nickname, '변경닉네임');
  await a.update({ active: false, leftAt: Timestamp.fromMillis(3000), updatedAt: Timestamp.fromMillis(3000) });
  await invoke('community-b');
  assert.equal((await b.get()).data().active, false);
  await b.update({ active: true, rejoinedAt: Timestamp.fromMillis(4000), updatedAt: Timestamp.fromMillis(4000) });
  await invoke('community-a');
  assert.equal((await a.get()).data().active, true);
  await a.update({ active: false, removedByAdmin: true, updatedAt: Timestamp.fromMillis(5000) });
  await b.update({ active: true, updatedAt: Timestamp.fromMillis(6000) });
  await invoke('community-b');
  assert.equal((await b.get()).data().removedByAdmin, true);
  assert.equal((await b.get()).data().active, false);
  await invoke('community-b');
  assert.equal((await b.get()).data().active, false);
  assert.deepEqual(await invoke('community-outsider'), { linked: false });
  await assert.rejects(community.syncLinkedCommunity.run({ data: { uid: 'community-a' } }), /로그인/);
  assert.equal((await db.doc('memberships/community-group_community-outsider').get()).exists, false);
});
