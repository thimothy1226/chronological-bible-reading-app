const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const chunk = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

exports.notifyCommunityPostCreated = onDocumentCreated({
  document: 'communityPosts/{postId}',
  region: 'asia-northeast3',
}, async (event) => {
  const post = event.data?.data();
  if (!post?.groupId || !['news', 'prayer'].includes(post.category)) return;

  const db = getFirestore();
  const deliveryRef = db.collection('notificationDeliveries').doc(event.params.postId);
  try {
    await deliveryRef.create({ status: 'processing', eventId: event.id, createdAt: FieldValue.serverTimestamp() });
  } catch (error) {
    if (error.code === 6 || error.code === 'already-exists') return;
    throw error;
  }

  // 멤버의 pushDevices.groupIds 값이 오래된 경우에도 누락되지 않도록
  // 실제 활성 membership을 기준으로 수신자를 결정한다.
  const membershipSnapshot = await db.collection('memberships')
    .where('groupId', '==', post.groupId)
    .get();
  const activeMemberUids = [...new Set(membershipSnapshot.docs
    .map((item) => item.data())
    .filter((item) => item.active === true && item.memberUid)
    .map((item) => String(item.memberUid)))];

  const deviceSnapshots = activeMemberUids.length
    ? await db.getAll(...activeMemberUids.map((uid) => db.collection('pushDevices').doc(uid)))
    : [];

  const tokens = [...new Set(deviceSnapshots
    .filter((item) => item.exists)
    .map((item) => item.data())
    .filter((item) => item.notificationsEnabled !== false && item.token && (item.platform === 'android' || item.tokenType === 'fcm'))
    .map((item) => String(item.token)))];

  if (!tokens.length) {
    await deliveryRef.set({
      status: 'complete', sent: 0, failed: 0,
      activeMembers: activeMemberUids.length,
      completedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }

  const groupName = post.groupName || '그룹';
  const sectionName = post.category === 'news' ? '소식' : '중보기도';
  const title = `${groupName} ${sectionName}`;
  const body = `${post.title}\n${String(post.body || '').replace(/\s+/g, ' ').trim()}`.slice(0, 700);
  let sent = 0;
  let failed = 0;
  const invalidTokens = [];

  for (const tokenBatch of chunk(tokens, 500)) {
    const response = await getMessaging().sendEachForMulticast({
      tokens: tokenBatch,
      notification: { title, body },
      data: {
        groupId: String(post.groupId),
        postId: String(event.params.postId),
        category: String(post.category),
        categoryId: 'community-post',
        categoryIdentifier: 'community-post',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'group-posts',
          sound: 'default',
          tag: `community-${event.params.postId}`,
        },
      },
    });
    sent += response.successCount;
    failed += response.failureCount;
    response.responses.forEach((result, index) => {
      const code = result.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
        invalidTokens.push(tokenBatch[index]);
      }
    });
  }

  await deliveryRef.set({
    status: 'complete', sent, failed,
    activeMembers: activeMemberUids.length,
    tokenCount: tokens.length,
    invalidTokenCount: invalidTokens.length,
    completedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
});
