const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

// Chunk array into pieces of at most `size` elements (for Firestore `in` limit of 30)
function chunks(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// Write in-app notification documents for a list of userIds
// Batches in groups of 499 to stay within Firestore's 500-op batch limit
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

// ── Channel messages ──────────────────────────────────────────────────────────
exports.onMessageCreated = onDocumentCreated(
  'channels/{channelId}/messages/{messageId}',
  async (event) => {
    const message = event.data.data();
    const channelId = event.params.channelId;

    try {
      // Messages from study groups also land in channels/{sgId}/messages,
      // so fall back to studyGroups collection if the channel doc doesn't exist.
      let channelDoc = await db.collection('channels').doc(channelId).get();
      if (!channelDoc.exists) {
        channelDoc = await db.collection('studyGroups').doc(channelId).get();
        if (!channelDoc.exists) return null;
      }

      const channelData = channelDoc.data();
      const channelName = channelData.name || 'Canal';
      // memberIds is stored as an array field on the channel/studyGroup document
      const allMemberIds = (channelData.memberIds || []).filter(id => id !== message.senderId);

      if (allMemberIds.length === 0) return null;

      // Write in-app notifications for all members (no FCM token required)
      await writeInAppNotifications(allMemberIds, {
        category: 'channel',
        title: `${message.senderName} en ${channelName}`,
        body: message.text ? message.text.substring(0, 100) : '📎 Adjunto',
        meta: { channelId },
      });

      // Send FCM push to members who have a token — query in chunks of 30
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

// ── Calls ─────────────────────────────────────────────────────────────────────
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

// ── Friend requests ───────────────────────────────────────────────────────────
exports.onFriendRequestCreated = onDocumentCreated(
  'friendRequests/{requestId}',
  async (event) => {
    const request = event.data.data();

    try {
      // Write in-app notification
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

      // FCM push
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

// ── Study group messages ──────────────────────────────────────────────────────
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

      // Write in-app notifications for all members
      await writeInAppNotifications(allMemberIds, {
        category: 'channel',
        title: `${message.senderName} en ${groupName}`,
        body: message.text ? message.text.substring(0, 100) : '📎 Adjunto',
        meta: { channelId: `sg_${groupId}` },
      });

      // FCM push in chunks of 30
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

// ── Announcements ─────────────────────────────────────────────────────────────
exports.onAnnouncementCreated = onDocumentCreated(
  'posts/{postId}',
  async (event) => {
    const post = event.data.data();
    const postId = event.params.postId;

    // Only handle posts that are explicitly announcements
    if (post.postType !== 'announcement') return null;

    try {
      // Get all user IDs except the author
      const usersSnap = await db.collection('users').get();
      const userIds = usersSnap.docs
        .map(d => d.id)
        .filter(uid => uid !== post.authorId);

      if (userIds.length === 0) return null;

      const title = post.title ? post.title.substring(0, 60) : 'Nuevo anuncio';
      const body = post.content ? post.content.substring(0, 100) : '';

      // Write in-app notifications for all users (chunked by 499 for batch limit)
      await writeInAppNotifications(userIds, {
        category: 'campus',
        title: `📢 ${title}`,
        body,
        meta: { postId },
      });

      // FCM push to users with tokens — query in chunks of 30
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

// ── Events ────────────────────────────────────────────────────────────────────
exports.onEventCreated = onDocumentCreated(
  'events/{eventId}',
  async (event) => {
    const ev = event.data.data();
    const eventId = event.params.eventId;

    // Skip events linked to an announcement (already covered by onAnnouncementCreated)
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

      // FCM push
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

// ── Direct messages ───────────────────────────────────────────────────────────
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

      // FCM push (in-app notification is written client-side in dmService.ts)
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
