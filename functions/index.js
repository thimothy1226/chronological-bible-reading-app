// Deployment retry after verified Firebase project access.
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
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
