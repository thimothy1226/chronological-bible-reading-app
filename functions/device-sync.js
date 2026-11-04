const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { randomInt, randomUUID, createHash } = require('node:crypto');
const core = require('./device-sync-core');
const options = { region: 'asia-northeast3', minInstances: 0, maxInstances: 5, timeoutSeconds: 30 };
const hash = value => createHash('sha256').update(value).digest('hex');
const uidFor = request => { if (!request.auth?.uid) throw new HttpsError('unauthenticated', '사용자 인증을 준비하지 못했습니다. 다시 시도해 주세요.'); return request.auth.uid; };
const safeName = name => String(name || '내 기기').trim().slice(0, 50);
const stateRef = (db, id) => db.doc(`personalSyncProfiles/${id}/private/state`);
const ensureSize = records => { if (Buffer.byteLength(JSON.stringify(records), 'utf8') > core.MAX_STATE_BYTES) throw new HttpsError('resource-exhausted', '동기화 기록의 용량 한도를 초과했습니다. 기존 기록은 기기에 보관됩니다.'); };

async function throttle(db, request, action, limit) {
  const uid = uidFor(request);
  // UID and IP budgets; rotating anonymous identities does not reset the IP budget.
  const ip = request.rawRequest?.ip || 'unknown';
  const refs = [db.doc(`personalSyncLimits/${hash(`${action}:uid:${uid}`)}`), db.doc(`personalSyncLimits/${hash(`${action}:ip:${ip}`)}`)];
  await db.runTransaction(async tx => {
    const snaps = await tx.getAll(...refs);
    const now = Date.now();
    const next = snaps.map(s => { const d = s.data() || {}; return now - (d.start || 0) >= 600000 ? { start: now, count: 1 } : { start: d.start, count: (d.count || 0) + 1 }; });
    if (next[0].count > limit || next[1].count > limit * 6) throw new HttpsError('resource-exhausted', '시도 횟수가 많습니다. 10분 후 다시 시도해 주세요.');
    next.forEach((d, i) => tx.set(refs[i], { ...d, expiresAt: new Date(now + 86400000) }));
  });
}

exports.initializePersonalSync = onCall(options, async request => {
  const uid = uidFor(request); const db = getFirestore();
  await throttle(db, request, 'initialize', 20);
  const device = db.doc(`personalSyncDevices/${uid}`);
  return db.runTransaction(async tx => {
    const previous = await tx.get(device);
    if (previous.exists) return { profileId: previous.data().profileId, serverTime: Date.now() };
    const id = randomUUID();
    tx.set(device, { profileId: id, name: safeName(request.data?.name), createdAt: Date.now() });
    tx.set(db.doc(`personalSyncProfiles/${id}`), { revision: 0, generation: 0, deviceCount: 1 });
    tx.set(db.doc(`personalSyncProfiles/${id}/devices/${uid}`), { name: safeName(request.data?.name), createdAt: Date.now() });
    tx.set(stateRef(db, id), { records: {}, revision: 0, generation: 0 });
    return { profileId: id, serverTime: Date.now() };
  });
});

exports.exchangePersonalSync = onCall(options, async request => {
  const uid = uidFor(request); const db = getFirestore(); const data = request.data || {};
  const changes = data.changes || {};
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).length > 2000) throw new HttpsError('invalid-argument', '변경 기록이 너무 많습니다.');
  const now = Date.now();
  for (const [key, record] of Object.entries(changes)) if (record.device !== uid || !core.validRecord(key, record, now)) throw new HttpsError('invalid-argument', '동기화 기록 형식이 올바르지 않습니다.');
  ensureSize(changes);
  return db.runTransaction(async tx => {
    const binding = await tx.get(db.doc(`personalSyncDevices/${uid}`));
    if (!binding.exists || binding.data().profileId !== data.profileId) throw new HttpsError('failed-precondition', '기기 연결 정보를 다시 확인해 주세요.');
    const id = binding.data().profileId;
    const snap = await tx.get(stateRef(db, id)); const state = snap.data();
    if (!state) throw new HttpsError('not-found', '동기화 기록을 찾지 못했습니다.');
    const generationMatches = Number(data.generation) === state.generation;
    let records = { ...state.records }; let changed = false;
    const revision = state.revision + 1;
    for (const [key, entry] of Object.entries(changes)) {
      if (!generationMatches && (Number(data.generation) < 0 || entry.at <= (state.replacedAt || now))) continue;
      if (core.compare(entry, records[key]) > 0) { records[key] = { at: entry.at, seq: entry.seq, device: uid, deleted: entry.deleted, value: entry.deleted ? null : entry.value, rev: revision }; changed = true; }
    }
    ensureSize(records);
    if (changed) {
      tx.set(stateRef(db, id), { records, revision, generation: state.generation, replacedAt: state.replacedAt || 0 });
      tx.update(db.doc(`personalSyncProfiles/${id}`), { revision });
    }
    const full = !generationMatches || Number(data.since) < 0;
    const delta = Object.fromEntries(Object.entries(records).filter(([, r]) => full || r.rev > Number(data.since || 0)));
    // Include authoritative outcomes even if an incoming offline change loses.
    for (const key of Object.keys(changes)) if (records[key]) delta[key] = records[key];
    return { profileId: id, records: delta, revision: changed ? revision : state.revision, generation: state.generation, replacedAt: state.replacedAt || 0, full, serverTime: now };
  });
});

exports.createPersonalLinkCode = onCall(options, async request => {
  const uid = uidFor(request); const db = getFirestore();
  await throttle(db, request, 'create', 5);
  for (let tries = 0; tries < 8; tries++) {
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const result = await db.runTransaction(async tx => {
      const binding = await tx.get(db.doc(`personalSyncDevices/${uid}`));
      if (!binding.exists) throw new HttpsError('failed-precondition', '기기 연결을 먼저 준비해 주세요.');
      const old = binding.data();
      const ref = db.doc(`personalLinkCodes/${hash(code)}`);
      const occupied = await tx.get(ref);
      if (occupied.exists && occupied.data().expiresAt > Date.now() && !occupied.data().used) return null;
      const profile = await tx.get(db.doc(`personalSyncProfiles/${old.profileId}`));
      const expiresAt = Date.now() + 300000;
      if (old.codeId && old.codeId !== ref.id) tx.delete(db.doc(`personalLinkCodes/${old.codeId}`));
      tx.set(ref, { sourceUid: uid, profileId: old.profileId, expiresAt, used: false, claimedBy: null });
      tx.update(binding.ref, { codeId: ref.id });
      return { code, expiresAt, deviceCount: profile.data().deviceCount, serverTime: Date.now() };
    });
    if (result) return result;
  }
  throw new HttpsError('unavailable', '연결 코드를 만들지 못했습니다. 다시 시도해 주세요.');
});

exports.preparePersonalLink = onCall(options, async request => {
  const uid = uidFor(request); const db = getFirestore();
  await throttle(db, request, 'claim', 5);
  const code = String(request.data?.code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) throw new HttpsError('invalid-argument', '숫자 6자리를 입력해 주세요.');
  return db.runTransaction(async tx => {
    const snap = await tx.get(db.doc(`personalLinkCodes/${hash(code)}`)); const link = snap.data();
    if (!link || link.used || link.expiresAt <= Date.now() || (link.claimedBy && link.claimedBy !== uid)) throw new HttpsError('not-found', '코드가 만료되었거나 올바르지 않습니다. 새 코드를 받아 주세요.');
    if (link.sourceUid === uid) throw new HttpsError('failed-precondition', '다른 기기에 표시된 코드를 입력해 주세요.');
    const receiver = await tx.get(db.doc(`personalSyncDevices/${uid}`));
    if (!receiver.exists) throw new HttpsError('failed-precondition', '기기 연결을 먼저 준비해 주세요.');
    if (receiver.data().profileId === link.profileId) throw new HttpsError('already-exists', '이미 연결된 기기입니다.');
    const receiverProfile = await tx.get(db.doc(`personalSyncProfiles/${receiver.data().profileId}`));
    if (receiverProfile.data()?.deviceCount !== 1) throw new HttpsError('failed-precondition', '이미 여러 기기와 연결되어 있습니다. 연결된 기기에서 코드를 만들고 새 기기에 입력해 주세요.');
    const source = await tx.get(db.doc(`personalSyncDevices/${link.sourceUid}`));
    const token = link.token || randomUUID();
    tx.update(snap.ref, { claimedBy: uid, token });
    return { linkId: snap.id, token, expiresAt: link.expiresAt, sourceName: source.data()?.name || '코드를 만든 기기', receiverName: receiver.data().name, serverTime: Date.now() };
  });
});

exports.finishPersonalLink = onCall(options, async request => {
  const uid = uidFor(request); const db = getFirestore(); const d = request.data || {};
  if (!/^[a-f0-9]{64}$/.test(String(d.linkId)) || !['merge', 'source', 'receiver'].includes(d.mode)) throw new HttpsError('invalid-argument', '연결 선택을 확인해 주세요.');
  const backupId = randomUUID();
  return db.runTransaction(async tx => {
    const linkSnap = await tx.get(db.doc(`personalLinkCodes/${d.linkId}`)); const link = linkSnap.data();
    if (!link || link.claimedBy !== uid || link.token !== d.token) throw new HttpsError('permission-denied', '연결 요청을 확인하지 못했습니다.');
    const receiverSnap = await tx.get(db.doc(`personalSyncDevices/${uid}`));
    if (link.used && link.completedBy === uid && receiverSnap.data()?.profileId === link.profileId) return { profileId: link.profileId, serverTime: Date.now() }; // Lost-response retry.
    if (link.used || link.expiresAt <= Date.now()) throw new HttpsError('not-found', '코드가 만료되었습니다. 새 코드를 받아 주세요.');
    const oldId = receiverSnap.data()?.profileId;
    if (!oldId || oldId === link.profileId) throw new HttpsError('failed-precondition', '연결 상태가 변경되었습니다. 다시 시작해 주세요.');
    const sourceBinding = await tx.get(db.doc(`personalSyncDevices/${link.sourceUid}`));
    if (sourceBinding.data()?.profileId !== link.profileId) throw new HttpsError('failed-precondition', '코드를 만든 기기의 연결 상태가 변경되었습니다.');
    const [sourceProfile, receiverProfile, sourceState, receiverState] = await tx.getAll(db.doc(`personalSyncProfiles/${link.profileId}`), db.doc(`personalSyncProfiles/${oldId}`), stateRef(db, link.profileId), stateRef(db, oldId));
    if (receiverProfile.data()?.deviceCount !== 1 || sourceProfile.data()?.deviceCount >= 10) throw new HttpsError('failed-precondition', '기기 연결 한도를 확인해 주세요.');
    const a = sourceState.data(); const b = receiverState.data();
    const revision = a.revision + 1;
    // Generation barrier: pre-replacement offline edits cannot resurrect discarded records.
    const generation = a.generation + (d.mode === 'merge' ? 0 : 1);
    const chosen = core.chooseInitial(a.records, b.records, d.mode);
    const records = Object.fromEntries(Object.entries(chosen).map(([k, r]) => [k, { ...r, rev: revision }]));
    ensureSize(records);
    tx.set(db.doc(`personalSyncProfiles/${link.profileId}/backups/${backupId}-source`), { ...a, savedAt: Date.now(), mode: d.mode });
    tx.set(db.doc(`personalSyncProfiles/${link.profileId}/backups/${backupId}-receiver`), { ...b, savedAt: Date.now(), mode: d.mode });
    tx.set(stateRef(db, link.profileId), { records, revision, generation, replacedAt: d.mode === 'merge' ? (a.replacedAt || 0) : Date.now() });
    tx.update(sourceProfile.ref, { revision, generation, deviceCount: sourceProfile.data().deviceCount + 1 });
    tx.update(receiverSnap.ref, { profileId: link.profileId });
    tx.set(db.doc(`personalSyncProfiles/${link.profileId}/devices/${uid}`), { name: receiverSnap.data().name, createdAt: Date.now() });
    tx.update(linkSnap.ref, { used: true, completedBy: uid, completedAt: Date.now() });
    tx.update(receiverProfile.ref, { deviceCount: 0, archived: true });
    return { profileId: link.profileId, serverTime: Date.now() };
  });
});

exports.listPersonalSyncDevices = onCall(options, async request => {
  const uid = uidFor(request); const db = getFirestore();
  const binding = await db.doc(`personalSyncDevices/${uid}`).get();
  if (!binding.exists) return { devices: [] };
  const snap = await db.collection(`personalSyncProfiles/${binding.data().profileId}/devices`).get();
  return { devices: snap.docs.map(s => ({ id: s.id, name: s.data().name, current: s.id === uid })) };
});
