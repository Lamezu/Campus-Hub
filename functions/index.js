const crypto = require('crypto');
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { getAuth: getAdminAuth } = require('firebase-admin/auth');

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

function chunks(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

async function writeInAppNotifications(userIds, notification) {
  if (userIds.length === 0) return;
  for (const chunk of chunks(userIds, 499)) {
    const batch = db.batch();
    chunk.forEach(uid => {
      const ref = db.collection('notifications').doc(uid).collection('items').doc();
      batch.set(ref, {
        ...notification,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
    await batch.commit();
  }
}

exports.onMessageCreated = onDocumentCreated(
  'channels/{channelId}/messages/{messageId}',
  async (event) => {
    const message = event.data.data();
    const channelId = event.params.channelId;

    try {
      let channelDoc = await db.collection('channels').doc(channelId).get();
      let isStudyGroup = false;
      if (!channelDoc.exists) {
        channelDoc = await db.collection('studyGroups').doc(channelId).get();
        if (!channelDoc.exists) return null;
        isStudyGroup = true;
      }

      const channelData = channelDoc.data();
      const channelName = channelData.name || 'Canal';
      const metaChannelId = isStudyGroup ? `sg_${channelId}` : channelId;
      const allMemberIds = (channelData.memberIds || []).filter(id => id !== message.senderId);

      if (allMemberIds.length === 0) return null;

      await writeInAppNotifications(allMemberIds, {
        category: 'channel',
        title: `${message.senderName} en ${channelName}`,
        body: message.text ? message.text.substring(0, 100) : '📎 Adjunto',
        meta: { channelId: metaChannelId, channelName },
      });

      const fcmMessages = [];
      for (const chunk of chunks(allMemberIds, 30)) {
        const usersSnap = await db.collection('users').where('__name__', 'in', chunk).get();
        usersSnap.docs.forEach(doc => {
          const userData = doc.data();
          if (userData.fcmToken && userData.notificationsEnabled !== false) {
            fcmMessages.push({
              notification: {
                title: `${message.senderName} en ${channelName}`,
                body: message.text ? message.text.substring(0, 100) : '📎 Adjunto',
              },
              data: {
                type: 'channel_message',
                channelId,
                messageId: event.params.messageId,
                senderId: message.senderId,
              },
              android: { priority: 'high', notification: { sound: 'default', priority: 'max', channelId: 'default' } },
              apns: { payload: { aps: { sound: 'default', badge: 1 } } },
              token: userData.fcmToken,
            });
          }
        });
      }

      if (fcmMessages.length > 0) {
        const response = await messaging.sendEach(fcmMessages);
        console.log(`FCM canal: ${response.successCount}/${fcmMessages.length}`);
      }
      return null;
    } catch (error) {
      console.error('Error en onMessageCreated:', error);
      return null;
    }
  }
);

exports.onCallInitiated = onDocumentCreated(
  'calls/{callId}',
  async (event) => {
    const call = event.data.data();
    const callId = event.params.callId;

    try {
      const receiverDoc = await db.collection('users').doc(call.receiverId).get();
      if (!receiverDoc.exists) return null;

      const receiverData = receiverDoc.data();
      if (!receiverData.fcmToken || receiverData.notificationsEnabled === false) return null;

      await messaging.send({
        notification: {
          title: `Llamada ${call.type === 'video' ? 'de video' : 'de voz'} entrante`,
          body: `${call.callerName} te está llamando`,
        },
        data: {
          type: 'incoming_call',
          callId,
          callerId: call.callerId,
          callerName: call.callerName,
          callerPhoto: call.callerPhoto || '',
          callType: call.type,
        },
        token: receiverData.fcmToken,
        android: { priority: 'high', notification: { channelId: 'calls', sound: 'call_ringtone', priority: 'max' } },
        apns: { payload: { aps: { sound: 'call_ringtone.caf', badge: 1, category: 'CALL' } } },
      });
      return null;
    } catch (error) {
      console.error('Error en onCallInitiated:', error);
      return null;
    }
  }
);

exports.onFriendRequestCreated = onDocumentCreated(
  'friendRequests/{requestId}',
  async (event) => {
    const request = event.data.data();

    try {
      await writeInAppNotifications([request.toUserId], {
        category: 'friend',
        title: 'Nueva solicitud de amistad',
        body: `${request.fromUserName} quiere ser tu amigo/a`,
        meta: {
          isRequest: 'true',
          fromUserId: request.fromUserId,
          fromUserName: request.fromUserName,
        },
      });

      const toUserDoc = await db.collection('users').doc(request.toUserId).get();
      if (!toUserDoc.exists) return null;
      const toUserData = toUserDoc.data();
      if (!toUserData.fcmToken || toUserData.notificationsEnabled === false) return null;

      await messaging.send({
        notification: {
          title: 'Nueva solicitud de amistad',
          body: `${request.fromUserName} quiere ser tu amigo`,
        },
        data: {
          type: 'friend_request',
          requestId: event.params.requestId,
          fromUserId: request.fromUserId,
          fromUserName: request.fromUserName,
        },
        token: toUserData.fcmToken,
      });
      return null;
    } catch (error) {
      console.error('Error en onFriendRequestCreated:', error);
      return null;
    }
  }
);

exports.onStudyGroupMessageCreated = onDocumentCreated(
  'studyGroups/{groupId}/messages/{messageId}',
  async (event) => {
    const message = event.data.data();
    const groupId = event.params.groupId;

    try {
      const groupDoc = await db.collection('studyGroups').doc(groupId).get();
      if (!groupDoc.exists) return null;

      const groupData = groupDoc.data();
      const groupName = groupData.name || 'Grupo';
      const allMemberIds = (groupData.memberIds || []).filter(id => id !== message.senderId);

      if (allMemberIds.length === 0) return null;

      await writeInAppNotifications(allMemberIds, {
        category: 'channel',
        title: `${message.senderName} en ${groupName}`,
        body: message.text ? message.text.substring(0, 100) : '📎 Adjunto',
        meta: { channelId: `sg_${groupId}`, channelName: groupName },
      });

      const fcmMessages = [];
      for (const chunk of chunks(allMemberIds, 30)) {
        const usersSnap = await db.collection('users').where('__name__', 'in', chunk).get();
        usersSnap.docs.forEach(doc => {
          const userData = doc.data();
          if (userData.fcmToken && userData.notificationsEnabled !== false) {
            fcmMessages.push({
              notification: {
                title: `${message.senderName} en ${groupName}`,
                body: message.text ? message.text.substring(0, 100) : '📎 Adjunto',
              },
              data: {
                type: 'channel_message',
                channelId: `sg_${groupId}`,
                messageId: event.params.messageId,
                senderId: message.senderId,
              },
              android: { priority: 'high', notification: { sound: 'default', priority: 'max', channelId: 'default' } },
              apns: { payload: { aps: { sound: 'default', badge: 1 } } },
              token: userData.fcmToken,
            });
          }
        });
      }

      if (fcmMessages.length > 0) {
        const response = await messaging.sendEach(fcmMessages);
        console.log(`FCM grupo: ${response.successCount}/${fcmMessages.length}`);
      }
      return null;
    } catch (error) {
      console.error('Error en onStudyGroupMessageCreated:', error);
      return null;
    }
  }
);

exports.onAnnouncementCreated = onDocumentCreated(
  'posts/{postId}',
  async (event) => {
    const post = event.data.data();
    const postId = event.params.postId;

    if (post.postType !== 'announcement') return null;

    try {
      const usersSnap = await db.collection('users').get();
      const userIds = usersSnap.docs
        .map(d => d.id)
        .filter(uid => uid !== post.authorId);

      if (userIds.length === 0) return null;

      const title = post.title ? post.title.substring(0, 60) : 'Nuevo anuncio';
      const body = post.content ? post.content.substring(0, 100) : '';

      await writeInAppNotifications(userIds, {
        category: 'campus',
        title: `📢 ${title}`,
        body,
        meta: { postId },
      });

      const fcmMessages = [];
      for (const chunk of chunks(userIds, 30)) {
        const usersChunk = await db.collection('users').where('__name__', 'in', chunk).get();
        usersChunk.docs.forEach(doc => {
          const userData = doc.data();
          if (userData.fcmToken && userData.notificationsEnabled !== false) {
            fcmMessages.push({
              notification: { title: `📢 ${title}`, body },
              data: { type: 'announcement', postId, authorId: post.authorId || '' },
              android: { priority: 'high', notification: { sound: 'default', priority: 'max', channelId: 'default' } },
              apns: { payload: { aps: { sound: 'default', badge: 1 } } },
              token: userData.fcmToken,
            });
          }
        });
      }

      if (fcmMessages.length > 0) {
        for (const chunk of chunks(fcmMessages, 500)) {
          const response = await messaging.sendEach(chunk);
          console.log(`FCM anuncio: ${response.successCount}/${chunk.length}`);
        }
      }
      return null;
    } catch (error) {
      console.error('Error en onAnnouncementCreated:', error);
      return null;
    }
  }
);

exports.onEventCreated = onDocumentCreated(
  'events/{eventId}',
  async (event) => {
    const ev = event.data.data();
    const eventId = event.params.eventId;

    if (ev.linkedAnnouncementId) return null;

    try {
      const usersSnap = await db.collection('users').get();
      const userIds = usersSnap.docs
        .map(d => d.id)
        .filter(uid => uid !== (ev.creatorId || ev.authorId));

      if (userIds.length === 0) return null;

      const title = ev.title ? ev.title.substring(0, 60) : 'Nuevo evento';
      const dateStr = ev.startDate
        ? (ev.startDate.toDate ? ev.startDate.toDate().toLocaleDateString('es-ES') : new Date(ev.startDate).toLocaleDateString('es-ES'))
        : '';
      const body = dateStr ? `${dateStr}` : '';

      await writeInAppNotifications(userIds, {
        category: 'campus',
        title: `📅 ${title}`,
        body,
        meta: { eventId },
      });

      const fcmMessages = [];
      for (const chunk of chunks(userIds, 30)) {
        const usersChunk = await db.collection('users').where('__name__', 'in', chunk).get();
        usersChunk.docs.forEach(doc => {
          const userData = doc.data();
          if (userData.fcmToken && userData.notificationsEnabled !== false) {
            fcmMessages.push({
              notification: { title: `📅 ${title}`, body },
              data: { type: 'event', eventId },
              android: { priority: 'high', notification: { sound: 'default', priority: 'max', channelId: 'default' } },
              apns: { payload: { aps: { sound: 'default', badge: 1 } } },
              token: userData.fcmToken,
            });
          }
        });
      }

      if (fcmMessages.length > 0) {
        for (const chunk of chunks(fcmMessages, 500)) {
          const response = await messaging.sendEach(chunk);
          console.log(`FCM evento: ${response.successCount}/${chunk.length}`);
        }
      }
      return null;
    } catch (error) {
      console.error('Error en onEventCreated:', error);
      return null;
    }
  }
);

exports.onDirectMessageCreated = onDocumentCreated(
  'conversations/{conversationId}/messages/{messageId}',
  async (event) => {
    const message = event.data.data();
    const conversationId = event.params.conversationId;

    try {
      const convDoc = await db.collection('conversations').doc(conversationId).get();
      if (!convDoc.exists) return null;

      const convData = convDoc.data();
      const receiverId = convData.participants.find(id => id !== message.senderId);
      if (!receiverId) return null;

      const receiverDoc = await db.collection('users').doc(receiverId).get();
      if (!receiverDoc.exists) return null;

      const receiverData = receiverDoc.data();
      if (!receiverData.fcmToken || receiverData.notificationsEnabled === false) return null;

      await messaging.send({
        notification: {
          title: message.senderName,
          body: message.text ? message.text.substring(0, 100) : '📎 Adjunto',
        },
        data: {
          type: 'direct_message',
          conversationId,
          messageId: event.params.messageId,
          senderId: message.senderId,
          participantId: message.senderId,
        },
        android: { priority: 'high', notification: { sound: 'default', priority: 'max', channelId: 'default' } },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        token: receiverData.fcmToken,
      });
      return null;
    } catch (error) {
      console.error('Error en onDirectMessageCreated:', error);
      return null;
    }
  }
);

const CLOUDINARY_API_KEY = defineSecret('CLOUDINARY_API_KEY');
const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET');
const WEB_API_KEY = defineString('WEB_API_KEY');
const CLOUD_NAME = 'dcwzlpg7m';
const CLOUDINARY_SECRETS = { secrets: [CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET] };

function extractPublicId(url) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  return match ? match[1] : null;
}

async function deleteCloudinaryAsset(url, resourceType, apiKey, apiSecret) {
  const publicId = extractPublicId(url);
  if (!publicId) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');
  const body = new URLSearchParams({
    public_id: publicId,
    api_key: apiKey,
    timestamp: String(timestamp),
    signature,
  }).toString();
  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
    );
    const data = await res.json();
    console.log(`Cloudinary [${resourceType}] ${publicId}: ${data.result}`);
  } catch (err) {
    console.error(`Cloudinary delete error [${publicId}]:`, err.message);
  }
}

function attachmentResourceType(type) {
  if (type === 'audio') return 'video';
  if (type === 'file') return 'raw';
  return 'image';
}

async function deleteMessageAssets(data, apiKey, apiSecret) {
  const attachments = data?.attachments ?? [];
  await Promise.all(
    attachments
      .filter(a => a?.url?.includes('cloudinary.com'))
      .map(a => deleteCloudinaryAsset(a.url, attachmentResourceType(a.type), apiKey, apiSecret))
  );
}

exports.onPostDeleted = onDocumentDeleted(
  { document: 'posts/{postId}', ...CLOUDINARY_SECRETS },
  async (event) => {
    const data = event.data.data();
    const apiKey = CLOUDINARY_API_KEY.value();
    const apiSecret = CLOUDINARY_API_SECRET.value();
    await Promise.all([
      data?.mediaUrl && deleteCloudinaryAsset(data.mediaUrl, data.mediaType === 'video' ? 'video' : 'image', apiKey, apiSecret),
      data?.imageUrl && deleteCloudinaryAsset(data.imageUrl, 'image', apiKey, apiSecret),
    ].filter(Boolean));
    return null;
  }
);

exports.onPostUpdated = onDocumentUpdated(
  { document: 'posts/{postId}', ...CLOUDINARY_SECRETS },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const apiKey = CLOUDINARY_API_KEY.value();
    const apiSecret = CLOUDINARY_API_SECRET.value();
    const ops = [];
    if (before?.mediaUrl && before.mediaUrl !== after?.mediaUrl)
      ops.push(deleteCloudinaryAsset(before.mediaUrl, before.mediaType === 'video' ? 'video' : 'image', apiKey, apiSecret));
    if (before?.imageUrl && before.imageUrl !== after?.imageUrl)
      ops.push(deleteCloudinaryAsset(before.imageUrl, 'image', apiKey, apiSecret));
    await Promise.all(ops);
    return null;
  }
);

exports.onChannelMessageDeleted = onDocumentDeleted(
  { document: 'channels/{channelId}/messages/{messageId}', ...CLOUDINARY_SECRETS },
  async (event) => {
    await deleteMessageAssets(event.data.data(), CLOUDINARY_API_KEY.value(), CLOUDINARY_API_SECRET.value());
    return null;
  }
);

exports.onDMMessageDeleted = onDocumentDeleted(
  { document: 'conversations/{conversationId}/messages/{messageId}', ...CLOUDINARY_SECRETS },
  async (event) => {
    await deleteMessageAssets(event.data.data(), CLOUDINARY_API_KEY.value(), CLOUDINARY_API_SECRET.value());
    return null;
  }
);

exports.onStudyGroupMessageDeleted = onDocumentDeleted(
  { document: 'studyGroups/{groupId}/messages/{messageId}', ...CLOUDINARY_SECRETS },
  async (event) => {
    await deleteMessageAssets(event.data.data(), CLOUDINARY_API_KEY.value(), CLOUDINARY_API_SECRET.value());
    return null;
  }
);

exports.onUserPhotoUpdated = onDocumentUpdated(
  { document: 'users/{userId}', ...CLOUDINARY_SECRETS },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (before?.photoURL && before.photoURL !== after?.photoURL)
      await deleteCloudinaryAsset(before.photoURL, 'image', CLOUDINARY_API_KEY.value(), CLOUDINARY_API_SECRET.value());
    return null;
  }
);

exports.onStudyGroupPhotoUpdated = onDocumentUpdated(
  { document: 'studyGroups/{groupId}', ...CLOUDINARY_SECRETS },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (before?.photoURL && before.photoURL !== after?.photoURL)
      await deleteCloudinaryAsset(before.photoURL, 'image', CLOUDINARY_API_KEY.value(), CLOUDINARY_API_SECRET.value());
    return null;
  }
);

exports.onChannelPhotoUpdated = onDocumentUpdated(
  { document: 'channels/{channelId}', ...CLOUDINARY_SECRETS },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (before?.photoURL && before.photoURL !== after?.photoURL)
      await deleteCloudinaryAsset(before.photoURL, 'image', CLOUDINARY_API_KEY.value(), CLOUDINARY_API_SECRET.value());
    return null;
  }
);

exports.getCustomToken = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { refreshToken } = req.body ?? {};
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'Missing refreshToken' });
  }

  let tokenData;
  try {
    const tokenRes = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${WEB_API_KEY.value()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      }
    );
    tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.user_id) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
  } catch (err) {
    console.error('getCustomToken token exchange error:', err);
    return res.status(500).json({ error: 'Token exchange failed' });
  }

  try {
    const customToken = await getAdminAuth().createCustomToken(tokenData.user_id);
    res.json({ customToken });
  } catch (err) {
    console.error('getCustomToken createCustomToken error:', err);
    res.status(500).json({ error: 'Custom token creation failed' });
  }
});
