// Deployment retry after verified Firebase project access.
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const chunk = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

const SUPER_ADMIN_UID = 'XKWflFjskvSK016d8amlnTjLwX83';
const GROUP_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REAPPROVAL: 'reapprovalRequested',
  DELETION: 'deletionScheduled',
};
const DAY_MS = 24 * 60 * 60 * 1000;

const normalizedName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const createInviteCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};
const assertSuperAdmin = (request) => {
  if (request.auth?.uid !== SUPER_ADMIN_UID) throw new HttpsError('permission-denied', '최고관리자 권한이 필요합니다.');
};

async function getActiveAdmin(db, uid) {
  if (!uid) return null;
  const snapshot = await db.collection('admins').doc(uid).get();
  if (!snapshot.exists || snapshot.data()?.active === false) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

async function assertRepresentative(db, uid, groupId) {
  const admin = await getActiveAdmin(db, uid);
  const role = admin?.groupRoles?.[groupId]
    || (admin?.groupIds?.includes(groupId) && admin.role !== 'subAdmin' ? 'manager' : null);
  if (!admin || role !== 'manager') throw new HttpsError('permission-denied', '이 그룹의 대표관리자 권한이 필요합니다.');
  return admin;
}

exports.createCommunityGroup = onCall({ region: 'asia-northeast3' }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', '앱 사용자 인증이 필요합니다.');
  const name = String(request.data?.name || '').trim().replace(/\s+/g, ' ');
  const address = String(request.data?.address || '').trim();
  const description = String(request.data?.description || '').trim();
  const representativeName = String(request.data?.representativeName || '').trim();
  const email = String(request.data?.representativeEmail || request.data?.email || request.auth.token?.email || '').trim().toLowerCase();
  const password = String(request.data?.representativePassword || request.data?.password || '');
  const acceptedPolicy = request.data?.acceptedPolicy === true;
  if (name.length < 2 || name.length > 50) throw new HttpsError('invalid-argument', '그룹 이름은 2~50자로 입력해 주세요.');
  if (address.length > 200 || description.length > 1000) throw new HttpsError('invalid-argument', '주소 또는 소개가 너무 깁니다.');
  if (representativeName.length < 2 || representativeName.length > 40) throw new HttpsError('invalid-argument', '대표관리자 이름은 2~40자로 입력해 주세요.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', '올바른 이메일 주소를 입력해 주세요.');
  if (!acceptedPolicy) throw new HttpsError('failed-precondition', '그룹 운영 원칙에 동의해 주세요.');

  const db = getFirestore();
  const auth = getAuth();
  const nameKey = normalizedName(name);
  const duplicate = await db.collection('groups').where('normalizedName', '==', nameKey).limit(1).get();
  if (!duplicate.empty) throw new HttpsError('already-exists', '같은 이름의 그룹이 이미 등록되어 있습니다.');

  let owner = null;
  let createdOwner = false;
  const callerProvider = request.auth.token?.firebase?.sign_in_provider;
  if (callerProvider === 'password' && request.auth.token?.email === email) {
    owner = await auth.getUser(request.auth.uid);
  } else {
    if (password.length < 8) throw new HttpsError('invalid-argument', '대표관리자 비밀번호는 8자리 이상으로 입력해 주세요.');
    try {
      owner = await auth.getUserByEmail(email);
      throw new HttpsError('already-exists', '이미 등록된 이메일입니다. 관리자 로그인 후 그룹을 만들어 주세요.');
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error.code !== 'auth/user-not-found') throw error;
      owner = await auth.createUser({ email, password, displayName: representativeName, disabled: false });
      createdOwner = true;
    }
  }

  const existingGroups = await db.collection('groups').where('ownerUid', '==', owner.uid).get();
  const activeCount = existingGroups.docs.filter((item) => !['deleted', GROUP_STATUS.DELETION].includes(item.data()?.status)).length;
  if (activeCount >= 3) throw new HttpsError('resource-exhausted', '대표관리자 한 명이 운영할 수 있는 그룹은 최대 3개입니다.');

  const adminRef = db.collection('admins').doc(owner.uid);
  const adminSnapshot = await adminRef.get();
  const previous = adminSnapshot.data() || {};
  const previousRoles = previous.groupRoles && typeof previous.groupRoles === 'object'
    ? { ...previous.groupRoles }
    : Object.fromEntries((previous.groupIds || []).map((id) => [String(id), previous.role === 'subAdmin' ? 'subAdmin' : 'manager']));
  const groupRef = db.collection('groups').doc();
  const groupId = groupRef.id;
  const groupRoles = { ...previousRoles, [groupId]: 'manager' };
  const groupIds = Object.keys(groupRoles);
  const inviteCode = createInviteCode();
  const batch = db.batch();
  batch.set(groupRef, {
    name, normalizedName: nameKey, address, description,
    representativeName, representativeEmail: email, ownerUid: owner.uid,
    normalizedInviteCode: inviteCode,
    managementCode: `ORG-${groupId.slice(0, 6).toUpperCase()}`,
    status: GROUP_STATUS.ACTIVE, statusReason: '', statusOrder: 30,
    createdBy: request.auth.uid, createdAt: FieldValue.serverTimestamp(),
    activatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(adminRef, {
    uid: owner.uid, email, displayName: representativeName,
    role: 'groupAdmin', groupIds, groupRoles, active: true,
    createdBy: previous.createdBy || request.auth.uid,
    createdAt: previous.createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(db.collection('groupAuditLogs').doc(), {
    groupId, action: 'created', actorUid: request.auth.uid, ownerUid: owner.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    if (createdOwner) await auth.deleteUser(owner.uid).catch(() => {});
    throw error;
  }
  return { groupId, managementCode: `ORG-${groupId.slice(0, 6).toUpperCase()}`, inviteCode, ownerUid: owner.uid };
});

exports.requestGroupReapproval = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = request.auth?.uid;
  const groupId = String(request.data?.groupId || '').trim();
  const reason = String(request.data?.reason || '').trim();
  const plan = String(request.data?.plan || '').trim();
  if (!uid || !groupId) throw new HttpsError('unauthenticated', '대표관리자 로그인이 필요합니다.');
  if (reason.length < 5 || plan.length < 5) throw new HttpsError('invalid-argument', '재승인 사유와 운영 계획을 각각 5자 이상 입력해 주세요.');
  const db = getFirestore();
  await assertRepresentative(db, uid, groupId);
  const ref = db.collection('groups').doc(groupId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError('not-found', '그룹을 찾을 수 없습니다.');
  if (![GROUP_STATUS.SUSPENDED, GROUP_STATUS.DELETION].includes(snapshot.data()?.status)) {
    throw new HttpsError('failed-precondition', '현재 상태에서는 재승인을 요청할 수 없습니다.');
  }
  await ref.set({
    status: GROUP_STATUS.REAPPROVAL, statusOrder: 0,
    reapprovalReason: reason, reapprovalPlan: plan,
    reapprovalRequestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.collection('groupAuditLogs').add({ groupId, action: 'reapprovalRequested', actorUid: uid, createdAt: FieldValue.serverTimestamp() });
  return { status: GROUP_STATUS.REAPPROVAL };
});

exports.setGroupOperationalStatus = onCall({ region: 'asia-northeast3' }, async (request) => {
  assertSuperAdmin(request);
  const groupId = String(request.data?.groupId || '').trim();
  const status = String(request.data?.status || '').trim();
  const reason = String(request.data?.reason || '').trim();
  if (!groupId || !Object.values(GROUP_STATUS).includes(status)) throw new HttpsError('invalid-argument', '그룹과 상태를 확인해 주세요.');
  if (groupId === 'gfc' && status !== GROUP_STATUS.ACTIVE) throw new HttpsError('failed-precondition', '기본 그룹은 운영 중지할 수 없습니다.');
  const db = getFirestore();
  const nowFields = { updatedAt: FieldValue.serverTimestamp() };
  if (status === GROUP_STATUS.ACTIVE) Object.assign(nowFields, { activatedAt: FieldValue.serverTimestamp(), suspendedAt: null, deletionScheduledAt: null, reapprovalResolvedAt: FieldValue.serverTimestamp() });
  if (status === GROUP_STATUS.SUSPENDED) Object.assign(nowFields, { suspendedAt: FieldValue.serverTimestamp() });
  if (status === GROUP_STATUS.DELETION) Object.assign(nowFields, { deletionScheduledAt: FieldValue.serverTimestamp() });
  await db.collection('groups').doc(groupId).set({
    status, statusOrder: status === GROUP_STATUS.REAPPROVAL ? 0 : status === GROUP_STATUS.DELETION ? 10 : status === GROUP_STATUS.SUSPENDED ? 20 : 30,
    statusReason: reason, ...nowFields,
  }, { merge: true });
  await db.collection('groupAuditLogs').add({ groupId, action: `status:${status}`, reason, actorUid: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
  return { status };
});

async function deleteDocumentsInQuery(db, query) {
  const snapshot = await query.get();
  for (const items of chunk(snapshot.docs, 400)) {
    const batch = db.batch();
    items.forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
  return snapshot.size;
}

exports.deleteCommunityGroupPermanently = onCall({ region: 'asia-northeast3', timeoutSeconds: 120 }, async (request) => {
  assertSuperAdmin(request);
  const groupId = String(request.data?.groupId || '').trim();
  if (!groupId || groupId === 'gfc') throw new HttpsError('failed-precondition', '삭제할 수 없는 그룹입니다.');
  const db = getFirestore();
  const groupRef = db.collection('groups').doc(groupId);
  const groupSnapshot = await groupRef.get();
  if (!groupSnapshot.exists) return { deleted: false };
  if (groupSnapshot.data()?.status !== GROUP_STATUS.DELETION) throw new HttpsError('failed-precondition', '삭제 대상으로 지정된 그룹만 삭제할 수 있습니다.');
  await deleteDocumentsInQuery(db, db.collection('communityPosts').where('groupId', '==', groupId));
  await deleteDocumentsInQuery(db, db.collection('memberships').where('groupId', '==', groupId));
  await deleteDocumentsInQuery(db, db.collection('notificationDeliveries').where('groupId', '==', groupId));
  const admins = await db.collection('admins').where('groupIds', 'array-contains', groupId).get();
  for (const items of chunk(admins.docs, 400)) {
    const batch = db.batch();
    items.forEach((item) => {
      const data = item.data() || {};
      const roles = { ...(data.groupRoles || {}) };
      delete roles[groupId];
      const ids = (data.groupIds || []).filter((id) => id !== groupId);
      const remainingRoles = Object.values(roles);
      batch.set(item.ref, {
        groupIds: ids, groupRoles: roles,
        active: remainingRoles.length > 0,
        role: remainingRoles.includes('manager') ? 'groupAdmin' : (remainingRoles.length ? 'subAdmin' : 'formerAdmin'),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
  }
  await db.collection('deletedGroups').doc(groupId).set({ ...groupSnapshot.data(), originalGroupId: groupId, deletedBy: request.auth.uid, deletedAt: FieldValue.serverTimestamp() });
  await groupRef.delete();
  await db.collection('groupAuditLogs').add({ groupId, action: 'deleted', actorUid: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
  return { deleted: true };
});

exports.manageGroupLifecycle = onSchedule({ schedule: 'every day 03:30', timeZone: 'Asia/Seoul', region: 'asia-northeast3' }, async () => {
  const db = getFirestore();
  const snapshot = await db.collection('groups').get();
  const now = Date.now();
  for (const groupDoc of snapshot.docs) {
    if (groupDoc.id === 'gfc') continue;
    const group = groupDoc.data() || {};
    const status = group.status || GROUP_STATUS.ACTIVE;
    const createdAt = group.createdAt?.toMillis?.() || now;
    if (status === GROUP_STATUS.ACTIVE && now - createdAt >= 30 * DAY_MS) {
      const memberships = await db.collection('memberships').where('groupId', '==', groupDoc.id).get();
      const activeMembers = memberships.docs.map((item) => item.data() || {}).filter((item) => item.active !== false);
      const externalMembers = activeMembers.filter((item) => item.memberUid !== group.ownerUid);
      const latestActivity = activeMembers.reduce((latest, item) => Math.max(latest, item.lastActiveAt?.toMillis?.() || item.updatedAt?.toMillis?.() || item.joinedAt?.toMillis?.() || 0), 0);
      const noNewMembers = externalMembers.length === 0;
      const inactiveForMonth = activeMembers.length > 0 && (!latestActivity || now - latestActivity >= 30 * DAY_MS);
      if (noNewMembers || inactiveForMonth) {
        await groupDoc.ref.set({
          status: GROUP_STATUS.SUSPENDED, statusOrder: 20,
          statusReason: noNewMembers ? '그룹 생성 후 30일 동안 신규 회원이 없습니다.' : '그룹 회원의 앱 활동이 30일 이상 없습니다.',
          suspendedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    } else if (status === GROUP_STATUS.SUSPENDED) {
      const suspendedAt = group.suspendedAt?.toMillis?.() || now;
      if (now - suspendedAt >= 30 * DAY_MS) {
        await groupDoc.ref.set({
          status: GROUP_STATUS.DELETION, statusOrder: 10,
          statusReason: group.statusReason || '운영 중지 후 30일 동안 재승인 요청이 없습니다.',
          deletionScheduledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  }
});

exports.registerAdminAccount = onCall({ region: 'asia-northeast3' }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', '관리자 로그인이 필요합니다.');

  const email = String(request.data?.email || '').trim().toLowerCase();
  const password = String(request.data?.password || '');
  const groupId = String(request.data?.groupId || '').trim();
  const assignedRole = request.data?.assignedRole === 'manager' ? 'manager' : 'subAdmin';
  if (!email || password.length < 6 || !groupId) {
    throw new HttpsError('invalid-argument', '이메일, 6자리 이상의 비밀번호, 관리 그룹이 필요합니다.');
  }

  const db = getFirestore();
  const isSuperAdmin = callerUid === SUPER_ADMIN_UID;
  if (!isSuperAdmin) {
    const callerSnapshot = await db.collection('admins').doc(callerUid).get();
    const caller = callerSnapshot.data() || {};
    const callerRole = caller.groupRoles?.[groupId]
      || (Array.isArray(caller.groupIds) && caller.groupIds.includes(groupId) && caller.role !== 'subAdmin' ? 'manager' : null);
    if (!callerSnapshot.exists || caller.active === false || callerRole !== 'manager' || assignedRole !== 'subAdmin') {
      throw new HttpsError('permission-denied', '이 그룹의 관리자를 등록할 권한이 없습니다.');
    }
  } else if (assignedRole !== 'manager') {
    throw new HttpsError('permission-denied', '최고관리자는 대표관리자를 등록해야 합니다.');
  }

  const auth = getAuth();
  let authUser = null;
  try {
    authUser = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
  if (authUser?.uid === SUPER_ADMIN_UID) throw new HttpsError('failed-precondition', '최고관리자 계정은 변경할 수 없습니다.');

  const emailSnapshot = await db.collection('admins').where('email', '==', email).limit(10).get();
  const canonicalSnapshot = authUser ? await db.collection('admins').doc(authUser.uid).get() : null;
  const legacyDocument = emailSnapshot.docs.find((item) => item.id !== authUser?.uid) || null;
  const existingData = canonicalSnapshot?.exists
    ? canonicalSnapshot.data()
    : (legacyDocument?.data() || {});
  const existingRoles = existingData.groupRoles && typeof existingData.groupRoles === 'object'
    ? { ...existingData.groupRoles }
    : Object.fromEntries((existingData.groupIds || []).map((id) => [String(id), existingData.role === 'subAdmin' ? 'subAdmin' : 'manager']));

  if (existingData.active !== false && existingRoles[groupId]) {
    throw new HttpsError('already-exists', '이미 이 기관의 관리자로 등록된 이메일입니다.');
  }

  const reactivated = !!authUser;
  // 이미 다른 그룹에서 사용 중인 관리자 계정은 비밀번호를 바꾸지 않는다.
  // 한 그룹 재등록 때문에 다른 그룹 로그인까지 끊기는 일을 방지한다.
  if (authUser) await auth.updateUser(authUser.uid, { email, disabled: false });
  else authUser = await auth.createUser({ email, password, disabled: false });

  const groupRoles = { ...existingRoles, [groupId]: assignedRole };
  const groupIds = Object.keys(groupRoles);
  const role = Object.values(groupRoles).includes('manager') ? 'groupAdmin' : 'subAdmin';
  await db.collection('admins').doc(authUser.uid).set({
    uid: authUser.uid,
    email,
    role,
    groupIds,
    groupRoles,
    active: true,
    createdBy: existingData.createdBy || callerUid,
    createdAt: existingData.createdAt || FieldValue.serverTimestamp(),
    reactivatedAt: reactivated ? FieldValue.serverTimestamp() : null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  if (legacyDocument && legacyDocument.id !== authUser.uid) {
    await legacyDocument.ref.set({
      active: false,
      migratedTo: authUser.uid,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return { uid: authUser.uid, reactivated, assignedRole };
});

exports.repairLegacyAdminAccess = onCall({ region: 'asia-northeast3' }, async (request) => {
  const uid = request.auth?.uid;
  const email = String(request.auth?.token?.email || '').trim().toLowerCase();
  if (!uid || !email) throw new HttpsError('unauthenticated', '관리자 로그인이 필요합니다.');

  const db = getFirestore();
  const uidRef = db.collection('admins').doc(uid);
  const uidSnapshot = await uidRef.get();
  if (uidSnapshot.exists) {
    const data = uidSnapshot.data() || {};
    if (data.active === false) throw new HttpsError('permission-denied', '비활성 관리자 계정입니다.');
    return { repaired: false, role: data.role || null, groupIds: data.groupIds || [] };
  }

  const emailSnapshot = await db.collection('admins').where('email', '==', email).limit(10).get();
  let legacy = emailSnapshot.docs.find((item) => item.data()?.active !== false && String(item.data()?.email || '').trim().toLowerCase() === email);

  if (!legacy) {
    const allSnapshot = await db.collection('admins').limit(200).get();
    legacy = allSnapshot.docs.find((item) => item.id !== uid && item.data()?.active !== false && String(item.data()?.email || '').trim().toLowerCase() === email);
  }

  if (!legacy) throw new HttpsError('permission-denied', '등록된 관리자 권한을 찾지 못했습니다.');

  const data = legacy.data() || {};
  const groupIds = Array.isArray(data.groupIds) ? data.groupIds.map(String) : [];
  const groupRoles = data.groupRoles && typeof data.groupRoles === 'object' ? data.groupRoles : Object.fromEntries(groupIds.map((groupId) => [groupId, data.role === 'subAdmin' ? 'subAdmin' : 'manager']));
  const role = Object.values(groupRoles).includes('manager') ? 'groupAdmin' : 'subAdmin';

  await uidRef.set({
    uid,
    email,
    role,
    groupIds: [...new Set([...groupIds, ...Object.keys(groupRoles)])],
    groupRoles,
    active: true,
    migratedFrom: legacy.id,
    migratedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { repaired: true, role, groupIds: [...new Set([...groupIds, ...Object.keys(groupRoles)])] };
});

exports.notifyCommunityPostCreated = onDocumentCreated({
  document: 'communityPosts/{postId}',
  region: 'asia-northeast3',
}, async (event) => {
  const post = event.data?.data();
  if (!post?.groupId || !['news', 'prayer'].includes(post.category)) return;

  const db = getFirestore();
  const postId = String(event.params.postId);
  const deliveryRef = db.collection('notificationDeliveries').doc(postId);

  try {
    await deliveryRef.create({
      status: 'processing',
      eventId: event.id,
      postId,
      groupId: String(post.groupId),
      category: String(post.category),
      authorUid: post.authorUid ? String(post.authorUid) : null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // 같은 Firestore 이벤트가 재시도되어도 중복 발송하지 않는다.
    if (error.code === 6 || error.code === 'already-exists') return;
    throw error;
  }

  try {
    // pushDevices.groupIds 값이 오래되어도 실제 활성 membership 기준으로 수신자를 정한다.
    // 예전 가입 문서에 active 필드가 빠져 있는 경우도 정상 회원으로 간주한다.
    const membershipSnapshot = await db.collection('memberships')
      .where('groupId', '==', post.groupId)
      .get();
    const activeMemberUids = [...new Set(membershipSnapshot.docs
      .map((item) => item.data())
      .filter((item) => item.active !== false && item.memberUid)
      .map((item) => String(item.memberUid)))];

    const deviceSnapshots = activeMemberUids.length
      ? await db.getAll(...activeMemberUids.map((uid) => db.collection('pushDevices').doc(uid)))
      : [];
    const tokenOwners = new Map();
    const tokens = [];
    deviceSnapshots.forEach((snapshot) => {
      if (!snapshot.exists) return;
      const data = snapshot.data() || {};
      const token = data.token ? String(data.token) : '';
      const canSend = data.notificationsEnabled !== false
        && token
        && (data.platform === 'android' || data.tokenType === 'fcm' || token.startsWith('f'));
      if (!canSend || tokenOwners.has(token)) return;
      tokenOwners.set(token, snapshot.id);
      tokens.push(token);
    });

    if (!tokens.length) {
      await deliveryRef.set({
        status: 'complete',
        memberCount: activeMemberUids.length,
        deviceDocCount: deviceSnapshots.filter((item) => item.exists).length,
        tokenCount: 0,
        sent: 0,
        failed: 0,
        invalidTokens: 0,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    }

    const groupName = post.groupName || '그룹';
    const sectionName = post.category === 'news' ? '소식' : '중보기도';
    const title = `${groupName} ${sectionName}`.slice(0, 80);
    const compactBody = String(post.body || '').replace(/\s+/g, ' ').trim();
    const body = String(post.title || compactBody || '새 글이 등록되었습니다.').slice(0, 140);
    let sent = 0;
    let failed = 0;
    let invalidTokens = 0;
    const failedCodes = {};
    const invalidOwnerIds = new Set();

    for (const tokenBatch of chunk(tokens, 500)) {
      const response = await getMessaging().sendEachForMulticast({
        tokens: tokenBatch,
        notification: { title, body },
        data: {
          groupId: String(post.groupId),
          postId,
          category: String(post.category),
          groupName: String(groupName).slice(0, 80),
          postTitle: String(post.title || '').slice(0, 120),
          route: 'communityPost',
          click_action: 'OPEN_COMMUNITY_POST',
        },
        android: {
          priority: 'high',
          ttl: 60 * 60 * 1000,
          collapseKey: `community-${postId}`,
          notification: {
            channelId: 'group-posts',
            sound: 'default',
            tag: `community-${postId}`,
            clickAction: 'OPEN_COMMUNITY_POST',
          },
        },
      });
      sent += response.successCount;
      failed += response.failureCount;
      response.responses.forEach((item, index) => {
        if (item.success) return;
        const code = item.error?.code || 'unknown';
        failedCodes[code] = (failedCodes[code] || 0) + 1;
        if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'].includes(code)) {
          invalidTokens += 1;
          const owner = tokenOwners.get(tokenBatch[index]);
          if (owner) invalidOwnerIds.add(owner);
        }
      });
    }

    await Promise.all([...invalidOwnerIds].map((uid) => db.collection('pushDevices').doc(uid).set({
      notificationsEnabled: false,
      tokenInvalidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })));

    await deliveryRef.set({
      status: 'complete',
      memberCount: activeMemberUids.length,
      deviceDocCount: deviceSnapshots.filter((item) => item.exists).length,
      tokenCount: tokens.length,
      sent,
      failed,
      invalidTokens,
      failedCodes,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    await deliveryRef.set({
      status: 'failed',
      errorCode: error.code || 'unknown',
      errorMessage: String(error.message || error).slice(0, 500),
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    throw error;
  }
});
