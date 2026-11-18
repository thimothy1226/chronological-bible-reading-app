// Group membership remains server-authoritative; no client-supplied group list is trusted.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const options = { region: 'asia-northeast3', maxInstances: 5, timeoutSeconds: 60 };
const fields = ['nickname', 'previousNickname', 'active', 'removedByAdmin', 'inviteCode', 'joinedAt', 'leftAt', 'rejoinedAt', 'nicknameChangedAt'];
const millis = value => value?.toMillis?.() || 0;
const signature = data => JSON.stringify(fields.map(key => data?.[key]?.toMillis?.() ?? data?.[key] ?? null));
function chooseMembership(records, canonical) {
  const candidates = records.filter(r => r && (!canonical || signature(r) !== signature(canonical)));
  if (!candidates.length) return canonical;
  // An administrator removal cannot be undone by a linked device's older active membership.
  const banned = records.filter(r => r?.removedByAdmin === true);
  if (banned.length) return banned.sort((a,b) => millis(b.updatedAt) - millis(a.updatedAt))[0];
  if (canonical) {
    const edits = candidates.filter(r => millis(r.updatedAt) > millis(canonical.updatedAt));
    return edits.sort((a,b) => millis(b.updatedAt) - millis(a.updatedAt))[0] || canonical;
  }
  return candidates.sort((a,b) => millis(b.updatedAt) - millis(a.updatedAt) || String(a.memberUid).localeCompare(String(b.memberUid)))[0];
}
async function reconcile(uid, onlyGroup) {
  const db = getFirestore();
  const bindingRef = db.doc(`personalSyncDevices/${uid}`);
  const binding = await bindingRef.get();
  if (!binding.exists) return { linked: false };
  const profileId = binding.data().profileId;
  const devices = await db.collection(`personalSyncProfiles/${profileId}/devices`).get();
  const uids = devices.docs.map(d => d.id);
  if (!uids.includes(uid) || uids.length > 10) throw new HttpsError('failed-precondition', '기기 연결 정보를 확인해 주세요.');
  const groupIds = new Set(onlyGroup ? [onlyGroup] : []);
  if (!onlyGroup) {
    for (const deviceUid of uids) {
      const rows = await db.collection('memberships').where('memberUid', '==', deviceUid).get();
      rows.docs.forEach(d => { if (d.id === `${d.data().groupId}_${deviceUid}`) groupIds.add(d.data().groupId); });
    }
  }
  for (const groupId of groupIds) {
    if (typeof groupId !== 'string' || !groupId || groupId.includes('/')) continue;
    await db.runTransaction(async tx => {
      const bindings = await tx.getAll(...uids.map(id => db.doc(`personalSyncDevices/${id}`)));
      if (bindings.some(d => !d.exists || d.data().profileId !== profileId)) return;
      const group = await tx.get(db.doc(`groups/${groupId}`));
      if (!group.exists) return;
      const canonicalRef = db.doc(`personalSyncProfiles/${profileId}/community/${groupId}`);
      const canonical = await tx.get(canonicalRef);
      const refs = uids.map(id => db.doc(`memberships/${groupId}_${id}`));
      const snapshots = await tx.getAll(...refs);
      const records = snapshots.filter(s => s.exists).map(s => s.data());
      const winner = chooseMembership(records, canonical.data());
      if (!winner) return;
      const data = Object.fromEntries(fields.map(key => [key, winner[key] ?? null]));
      data.groupId = groupId; data.updatedAt = winner.updatedAt || FieldValue.serverTimestamp();
      if (!canonical.exists || signature(canonical.data()) !== signature(winner)) tx.set(canonicalRef, data);
      snapshots.forEach((s,i) => {
        if (!s.exists || signature(s.data()) !== signature(winner)) tx.set(refs[i], { ...data, memberUid: uids[i] }, { merge: true });
      });
    });
  }
  return { linked: true };
}
exports.syncLinkedCommunity = onCall(options, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', '로그인 정보를 확인해 주세요.');
  return reconcile(request.auth.uid);
});
exports.onLinkedMembershipWritten = onDocumentWritten({ ...options, document: 'memberships/{membershipId}' }, async event => {
  const before = event.data?.before.data(); const after = event.data?.after.data();
  if (!after || signature(before) === signature(after)) return;
  if (event.params.membershipId !== `${after.groupId}_${after.memberUid}`) return;
  return reconcile(after.memberUid, after.groupId);
});
exports.chooseMembership = chooseMembership;
