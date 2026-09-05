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

  const devices = await db.collection('pushDevices')
    .where('groupIds', 'array-contains', post.groupId)
    .get();
  const candidates = devices.docs
    .map((item) => item.data())
    .filter((item) => item.notificationsEnabled !== false && item.platform === 'android' && item.token && item.memberUid);
  const memberships = candidates.length
    ? await db.getAll(...candidates.map((item) => db.collection('memberships').doc(`${post.groupId}_${item.memberUid}`)))
    : [];
  const tokens = [...new Set(candidates
    .filter((item, index) => memberships[index]?.exists && memberships[index].data()?.active === true)
    .map((item) => item.token))];

  if (!tokens.length) {
    await deliveryRef.set({ status: 'complete', sent: 0, failed: 0, completedAt: FieldValue.serverTimestamp() }, { merge: true });
    return;
  }

  const groupName = post.groupName || '그룹';
  const sectionName = post.category === 'news' ? '소식' : '중보기도';
  const title = `${groupName} ${sectionName}`;
  const body = `${post.title}\n${String(post.body || '').replace(/\s+/g, ' ').trim()}`.slice(0, 700);
  let sent = 0;
  let failed = 0;

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
  }

  await deliveryRef.set({ status: 'complete', sent, failed, completedAt: FieldValue.serverTimestamp() }, { merge: true });
});
