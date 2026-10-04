const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../functions/device-sync-core');
const { PersonalSyncEngine, STATE_KEY, BACKUP_KEY } = require('../sync/personal-sync-engine');
const r = (value, at = 100, device = 'a', deleted = false) => ({ value, at, device, deleted, seq: 1, rev: 1 });
class Storage {
  constructor(values = {}) { this.values = { ...values }; }
  async getItem(k) { return this.values[k] ?? null; }
  async setItem(k, v) { this.values[k] = v; }
  async multiSet(rows) { rows.forEach(([k, v]) => { this.values[k] = v; }); }
  async multiGet(keys) { return keys.map(k => [k, this.values[k] ?? null]); }
  async getAllKeys() { return Object.keys(this.values); }
}
class Server {
  constructor() { this.records = {}; this.revision = 0; this.generation = 0; this.offline = false; this.calls = []; }
  async call(name, d) {
    this.calls.push(name); if (this.offline) throw new Error('offline');
    if (name === 'initializePersonalSync') return { profileId: 'p', serverTime: 1000 };
    assert.equal(name, 'exchangePersonalSync');
    const full = d.generation !== this.generation || d.since < 0;
    if (d.generation === this.generation) {
      let changed = false;
      for (const [k, entry] of Object.entries(d.changes)) if (core.compare(entry, this.records[k]) > 0) { this.records[k] = { ...entry, rev: this.revision + 1 }; changed = true; }
      if (changed) this.revision++;
    }
    const records = Object.fromEntries(Object.entries(this.records).filter(([k, v]) => full || v.rev > d.since || core.own(d.changes, k)));
    return { profileId: 'p', generation: this.generation, revision: this.revision, records, full, serverTime: 1000 };
  }
}
async function device(id, server, storage = new Storage()) {
  const engine = new PersonalSyncEngine({ storage, deviceId: id, now: () => 1000, call: server.call.bind(server) });
  await engine.init(); engine.setActive(false); return engine;
}
test('whitelist excludes scripture text, imported Bible metadata, groups and credentials', () => {
  const flat = core.flatten({ [core.KEYS.bookmarks]: JSON.stringify({ 'KRV:창세기:1:1': { text: 'copyrighted text', label: '창세기 1:1', savedAt: '2026. 10. 04. 17:00' } }), '@chronological_bible/custom_translations': 'private', '@chronological_bible/community_groups': '["secret"]' });
  assert.equal(JSON.stringify(flat).includes('copyrighted'), false);
  assert.deepEqual(Object.keys(flat), ['bookmarks|KRV:창세기:1:1']);
  assert.ok(core.stampFrom(flat[Object.keys(flat)[0]]) > 0);
});
test('initial merge unions distinct entries and completion history, deterministic conflict winner', () => {
  const a = { 'notes|same': r('older', 10), 'notes|only-a': r('A'), 'completion|plan|1': r({ active: true, dates: ['a'], canceledAt: null }) };
  const b = { 'notes|same': r('newer', 20, 'b'), 'notes|only-b': r('B'), 'completion|plan|1': r({ active: true, dates: ['b'], canceledAt: null }, 20, 'b') };
  const merged = core.chooseInitial(a, b, 'merge');
  assert.equal(merged['notes|same'].value, 'newer'); assert.equal(Object.keys(merged).length, 4);
  assert.deepEqual(merged['completion|plan|1'].value.dates, ['a', 'b']);
  assert.deepEqual(core.chooseInitial(a, b, 'source'), a); assert.deepEqual(core.chooseInitial(a, b, 'receiver'), b);
});
test('deleted record wins over stale offline data; invalid payload cannot upload Bible fields', () => {
  assert.ok(core.compare(r(null, 20, 'a', true), r('stale', 10)) > 0);
  assert.equal(core.validRecord('bookmarks|v', r({ label: 'v', savedAt: '', text: 'Bible' }), 1000), false);
  assert.equal(core.validRecord('notes|v', r('ok'), 1000), true);
  assert.equal(core.validRecord('notes|__proto__', r('x'), 1000), false);
  assert.equal(core.validRecord('notes|v', r('future', 999999), 1000), false);
});
test('ordinary launch is local-only and retains original records', async () => {
  const server = new Server(); const storage = new Storage({ [core.KEYS.notes]: '{"v":"existing"}' });
  const e = await device('a', server, storage); assert.equal(server.calls.length, 0);
  assert.equal(e.state.records['notes|v'].value, 'existing'); assert.equal(await storage.getItem(core.KEYS.notes), '{"v":"existing"}'); e.dispose();
});
test('offline edits survive process restart and sync on reconnection', async () => {
  const server = new Server(); const e = await device('a', server); await e.enable('a');
  server.offline = true; await e.write([[core.KEYS.notes, '{"v":"offline note"}']]);
  await assert.rejects(e.sync()); const storage = e.storage; e.dispose();
  const reloaded = await device('a', server, storage); assert.ok(reloaded.state.dirty['notes|v']);
  server.offline = false; await reloaded.sync(); assert.equal(server.records['notes|v'].value, 'offline note'); assert.deepEqual(reloaded.state.dirty, {}); reloaded.dispose();
});
test('late upload does not replace a later edit, and deletion survives late reconnection', async () => {
  const server = new Server(); const a = await device('a', server); const b = await device('b', server); await a.enable('a'); await b.enable('b');
  a.now = () => 2000; await a.write([[core.KEYS.notes, '{"v":"early offline"}']]);
  b.now = () => 3000; await b.write([[core.KEYS.notes, '{"v":"late online"}']]); await b.sync();
  await a.sync(); assert.equal(core.parse(await a.storage.getItem(core.KEYS.notes)).v, 'late online');
  b.now = () => 4000; await b.write([[core.KEYS.notes, '{}']]); await b.sync();
  a.now = () => 3500; await a.write([[core.KEYS.notes, '{"v":"stale edit"}']]); await a.sync();
  assert.deepEqual(core.parse(await a.storage.getItem(core.KEYS.notes)), {}); a.dispose(); b.dispose();
});
test('edit during an in-flight upload stays queued and is not acknowledged prematurely', async () => {
  const server = new Server(); const e = await device('a', server); await e.enable('a');
  await e.write([[core.KEYS.notes, '{"v":"first"}']]);
  let release; let entered; const started = new Promise(resolve => { entered = resolve; });
  e.call = async (name, data) => { entered(); await new Promise(resolve => { release = resolve; }); return server.call(name, data); };
  const pending = e.sync(); await started;
  await e.write([[core.KEYS.notes, '{"v":"second"}']]); release(); await pending;
  assert.equal(e.state.dirty['notes|v'].value, 'second'); assert.equal(core.parse(await e.storage.getItem(core.KEYS.notes)).v, 'second');
  e.call = server.call.bind(server); await e.sync(); assert.equal(server.records['notes|v'].value, 'second'); e.dispose();
});
test('generation barrier applies selected replacement and backs up stale offline edits', async () => {
  const server = new Server(); const e = await device('a', server); await e.enable('a');
  await e.write([[core.KEYS.notes, '{"old":"preserve in backup"}']]);
  server.generation = 1; server.records = { 'notes|chosen': r('selected record', 2000) }; server.revision = 1;
  await e.sync(); assert.deepEqual(core.parse(await e.storage.getItem(core.KEYS.notes)), { chosen: 'selected record' });
  const backup = core.parse(await e.storage.getItem(BACKUP_KEY), []); assert.equal(backup[0].records['notes|old'].value, 'preserve in backup'); e.dispose();
});
test('materialization clears absent plans while preserving local purchased verse snippets', () => {
  const previous = { [`${core.PREFIX}old`]: '{"currentDay":8,"completions":{"1":{"active":true}}}', [core.KEYS.bookmarks]: '{"v":{"text":"local only"}}' };
  const rows = core.materialize({ 'bookmarks|v': r({ label: 'v', savedAt: '' }) }, previous);
  assert.equal(core.parse(rows[core.KEYS.bookmarks]).v.text, 'local only');
  assert.deepEqual(core.parse(rows[`${core.PREFIX}old`]), { currentDay: 1, completions: {} });
});
test('crash between durable outbox and local write replays before synchronization', async () => {
  const server = new Server(); const entry = r('recovered'); const state = { deviceId: 'a', records: { 'notes|v': entry }, dirty: { 'notes|v': entry }, profileId: null, revision: -1, generation: 0, seq: 1, offset: 0, lastTime: 100, pendingRows: { [core.KEYS.notes]: '{"v":"recovered"}' } };
  const storage = new Storage({ [STATE_KEY]: JSON.stringify(state), [core.KEYS.notes]: '{}' });
  const e = await device('a', server, storage); assert.equal(core.parse(await storage.getItem(core.KEYS.notes)).v, 'recovered'); assert.equal(e.state.pendingRows, undefined); e.dispose();
});
