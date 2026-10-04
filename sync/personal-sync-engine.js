const core = require('../functions/device-sync-core');
const STATE_KEY = '@gf_bible/personal_sync_v1';
const BACKUP_KEY = '@gf_bible/personal_sync_backups_v1';
class PersonalSyncEngine {
  constructor({ storage, deviceId, call, onApply, onStatus, now = Date.now }) {
    Object.assign(this, { storage, deviceId, call, onApply, onStatus, now });
    this.queue = Promise.resolve(); this.inFlight = null; this.timer = null; this.state = null; this.active = true; this.failures = 0;
  }
  serial(task) { const p = this.queue.then(task); this.queue = p.catch(() => {}); return p; }
  async readRows() { const keys = (await this.storage.getAllKeys()).filter(core.isTrackedKey); return Object.fromEntries(await this.storage.multiGet(keys)); }
  async persist() { await this.storage.setItem(STATE_KEY, JSON.stringify(this.state)); }
  status(status, error) { this.onStatus?.({ status, error, profileId: this.state?.profileId, deviceCount: this.deviceCount, pending: Object.keys(this.state?.dirty || {}).length, lastSyncedAt: this.state?.lastSyncedAt }); }
  async init() {
    return this.serial(async () => {
      const saved = core.parse(await this.storage.getItem(STATE_KEY), null);
      this.state = saved || { records: {}, dirty: {}, profileId: null, revision: -1, generation: 0, seq: 0, offset: 0, lastTime: 0 };
      if (this.state.pendingRows) { await this.storage.multiSet(Object.entries(this.state.pendingRows)); delete this.state.pendingRows; await this.persist(); }
      const rows = await this.readRows();
      if (!saved) {
        for (const [key, value] of Object.entries(core.flatten(rows))) {
          const entry = { value, deleted: false, at: core.stampFrom(value), seq: ++this.state.seq, device: this.deviceId };
          this.state.records[key] = entry; this.state.dirty[key] = entry;
        }
      } else if (saved.deviceId && saved.deviceId !== this.deviceId) {
        // Auth identity changed: retain personal data locally, never grant the old UID's profile.
        this.state.profileId = null; this.state.revision = -1; this.state.generation = 0;
        this.state.dirty = {};
        for (const [key, entry] of Object.entries(this.state.records)) {
          this.state.records[key] = { ...entry, device: this.deviceId, seq: ++this.state.seq };
          this.state.dirty[key] = this.state.records[key];
        }
      }
      this.state.deviceId = this.deviceId;
      await this.persist();
      if (saved) await this.onApply?.(core.materialize(this.state.records, rows));
      this.status(this.state.profileId ? 'pending' : 'unlinked');
    });
  }
  async write(rows) {
    return this.serial(async () => {
      const old = await this.readRows(); const desired = { ...old, ...Object.fromEntries(rows) };
      const before = core.flatten(old); const after = core.flatten(desired);
      const at = Math.max(this.state.lastTime + 1, this.now() + this.state.offset);
      let changed = false;
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (core.same(before[key], after[key])) continue;
        const entry = { value: core.own(after, key) ? after[key] : null, deleted: !core.own(after, key), at, seq: ++this.state.seq, device: this.deviceId };
        this.state.records[key] = entry; this.state.dirty[key] = entry; changed = true;
      }
      if (changed) {
        this.state.lastTime = at;
        this.state.pendingRows = Object.fromEntries(rows);
        // Durable outbox first. Crash recovery replays the local write before sync.
        await this.persist();
      }
      await this.storage.multiSet(rows);
      if (changed) { delete this.state.pendingRows; await this.persist(); this.status(this.state.profileId ? 'pending' : 'unlinked'); this.schedule(); }
    });
  }
  schedule() { if (!this.state?.profileId || !this.active) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.sync().catch(() => {}), this.failures ? Math.min(120000, 15000 * 2 ** Math.min(this.failures, 3)) : 2000); }
  setActive(active) { this.active = active; clearTimeout(this.timer); if (active && this.state?.profileId) this.sync().catch(() => {}); }
  async backup(reason) {
    const list = core.parse(await this.storage.getItem(BACKUP_KEY), []);
    await this.storage.setItem(BACKUP_KEY, JSON.stringify([{ at: this.now(), reason, records: this.state.records }, ...list].slice(0, 3)));
  }
  async switchProfile(profileId) {
    return this.serial(async () => {
      if (profileId === this.state.profileId) return;
      await this.backup('기기 연결 전 기록');
      this.state.profileId = profileId; this.state.revision = -1; this.state.generation = -1;
      await this.persist(); this.status('pending');
    });
  }
  async enable(name) {
    const result = await this.call('initializePersonalSync', { name });
    await this.serial(async () => {
      if (!this.state.profileId) { this.state.profileId = result.profileId; this.state.offset = result.serverTime - this.now(); await this.persist(); }
    });
    if (this.state.profileId !== result.profileId) await this.switchProfile(result.profileId);
    await this.sync(); return this.state.profileId;
  }
  sync() {
    if (this.inFlight) return this.inFlight;
    if (!this.state?.profileId) return Promise.resolve();
    this.inFlight = this.exchange().finally(() => {
      this.inFlight = null;
      const remotePending = this.remote?.profileId === this.state?.profileId && (this.remote.revision > this.state.revision || this.remote.generation !== this.state.generation);
      if (this.state && (Object.keys(this.state.dirty).length || this.failures || remotePending)) this.schedule();
    });
    return this.inFlight;
  }
  async exchange() {
    const sent = await this.serial(async () => ({ profileId: this.state.profileId, generation: this.state.generation, since: this.state.revision, changes: { ...this.state.dirty } }));
    this.status('syncing');
    let result;
    try { result = await this.call('exchangePersonalSync', sent); }
    catch (error) { this.failures += 1; this.status('pending', error); throw error; }
    this.failures = 0;
    await this.serial(async () => {
      if (this.state.profileId !== result.profileId) return;
      const previous = await this.readRows();
      const generationChanged = this.state.generation !== result.generation;
      if (generationChanged) {
        await this.backup('기록 선택 적용 전 기록');
        const newerDirty = Object.fromEntries(Object.entries(this.state.dirty).filter(([key, entry]) => this.state.generation >= 0 && entry.at > (result.replacedAt || result.serverTime) && !core.same(sent.changes[key], entry)));
        this.state.records = { ...newerDirty }; this.state.dirty = newerDirty;
      }
      for (const [key, authoritative] of Object.entries(result.records)) {
        const local = this.state.records[key];
        if (core.compare(authoritative, local) >= 0) this.state.records[key] = authoritative;
      }
      for (const [key, record] of Object.entries(sent.changes)) if (core.same(this.state.dirty[key], record)) delete this.state.dirty[key];
      this.state.generation = result.generation; this.state.revision = result.revision;
      this.state.offset = result.serverTime - this.now(); this.state.lastSyncedAt = this.now();
      this.state.pendingRows = core.materialize(this.state.records, previous);
      await this.persist(); await this.storage.multiSet(Object.entries(this.state.pendingRows));
      const applied = this.state.pendingRows; delete this.state.pendingRows; await this.persist();
      await this.onApply?.(applied);
      this.status(Object.keys(this.state.dirty).length ? 'pending' : 'synced');
    });
  }
  async createCode(name) { await this.enable(name); return this.call('createPersonalLinkCode', {}); }
  async prepare(code, name) { await this.enable(name); return this.call('preparePersonalLink', { code }); }
  async finish(link, mode) {
    await this.sync();
    await this.serial(() => this.backup('첫 연결 전 기록'));
    const result = await this.call('finishPersonalLink', { linkId: link.linkId, token: link.token, mode });
    await this.switchProfile(result.profileId); await this.sync(); return result;
  }
  async restoreBackup() {
    return this.serial(async () => {
      const list = core.parse(await this.storage.getItem(BACKUP_KEY), []);
      if (!list.length) throw new Error('복구용 사본이 없습니다.');
      const selected = list[0].records;
      await this.backup('복구 직전 기록');
      const at = Math.max(this.state.lastTime + 1, this.now() + this.state.offset);
      for (const key of new Set([...Object.keys(this.state.records), ...Object.keys(selected)])) {
        const old = selected[key];
        const entry = { value: old?.deleted === false ? old.value : null, deleted: !old || old.deleted, at, seq: ++this.state.seq, device: this.deviceId };
        this.state.records[key] = entry; this.state.dirty[key] = entry;
      }
      this.state.lastTime = at;
      this.state.pendingRows = core.materialize(this.state.records, await this.readRows());
      await this.persist(); await this.storage.multiSet(Object.entries(this.state.pendingRows));
      const applied = this.state.pendingRows; delete this.state.pendingRows; await this.persist();
      await this.onApply?.(applied); this.schedule(); this.status('pending');
    });
  }
  dispose() { clearTimeout(this.timer); this.timer = null; }
}
module.exports = { PersonalSyncEngine, STATE_KEY, BACKUP_KEY };
