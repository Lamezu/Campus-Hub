const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

exports.onMessageCreated = onDocumentCreated(
  'channels/{channelId}/messages/{messageId}',
  async (event) => {
    const message = event.data.data();
    const channelId = event.params.channelId;

    try {
      const channelDoc = await db.collection('channels').doc(channelId).get();
      const channelName = channelDoc.data()?.name || 'Canal';

      const membersSnapshot = await db
        .collection('channels')
        .doc(channelId)
        .collection('members')
        .get();

      const memberIds = membersSnapshot.docs.map(doc => doc.data().userId);

      const usersSnapshot = await db
        .collection('users')
        .where('__name__', 'in', memberIds)
        .get();

      const tokens = [];
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (
          userData.fcmToken &&
          userData.notificationsEnabled !== false &&
          doc.id !== message.senderId
        ) {
          tokens.push({
            token: userData.fcmToken,
            userId: doc.id
          });
        }
      });

      if (tokens.length === 0) {
        console.log('No hay tokens FCM para enviar');
        return null;
      }

      const messages = tokens.map(({ token }) => ({
        notification: {
          title: `${message.senderName} en ${channelName}`,
          body: message.text.substring(0, 100)
        },
        data: {
          type: 'channel_message',
          channelId: channelId,
          messageId: event.params.messageId,
          senderId: message.senderId
        },
        token
      }));

      const response = await messaging.sendEach(messages);

      console.log(`Enviadas ${response.successCount} notificaciones`);

      return null;
    } catch (error) {
      console.error('Error enviando notificaciones:', error);
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

      if (!receiverDoc.exists) {
        console.log('Receiver no encontrado');
        return null;
      }

      const receiverData = receiverDoc.data();

      if (!receiverData.fcmToken || receiverData.notificationsEnabled === false) {
        console.log('Receiver sin token FCM o notificaciones deshabilitadas');
        return null;
      }

      const message = {
        notification: {
          title: `Llamada ${call.type === 'video' ? 'de video' : 'de voz'} entrante`,
          body: `${call.callerName} te está llamando`
        },
        data: {
          type: 'incoming_call',
          callId: callId,
          callerId: call.callerId,
          callerName: call.callerName,
          callerPhoto: call.callerPhoto || '',
          callType: call.type
        },
        token: receiverData.fcmToken,
        android: {
          priority: 'high',
          notification: {
            channelId: 'calls',
            sound: 'call_ringtone',
            priority: 'max'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'call_ringtone.caf',
              badge: 1,
              category: 'CALL'
            }
          }
        }
      };

      await messaging.send(message);

      console.log(`Notificación de llamada enviada a ${call.receiverId}`);

      return null;
    } catch (error) {
      console.error('Error enviando notificación de llamada:', error);
      return null;
    }
  }
);

exports.onFriendRequestCreated = onDocumentCreated(
  'friendRequests/{requestId}',
  async (event) => {
    const request = event.data.data();

    try {
      const toUserDoc = await db.collection('users').doc(request.toUserId).get();

      if (!toUserDoc.exists) {
        console.log('Usuario destinatario no encontrado');
        return null;
      }

      const toUserData = toUserDoc.data();

      if (!toUserData.fcmToken || toUserData.notificationsEnabled === false) {
        console.log('Usuario sin token FCM o notificaciones deshabilitadas');
        return null;
      }

      const message = {
        notification: {
          title: 'Nueva solicitud de amistad',
          body: `${request.fromUserName} quiere ser tu amigo`
        },
        data: {
          type: 'friend_request',
          requestId: event.params.requestId,
          fromUserId: request.fromUserId,
          fromUserName: request.fromUserName
        },
        token: toUserData.fcmToken
      };

      await messaging.send(message);

      console.log(`Notificación de solicitud enviada a ${request.toUserId}`);

      return null;
    } catch (error) {
      console.error('Error enviando notificación de solicitud:', error);
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

      if (!convDoc.exists) {
        console.log('Conversación no encontrada');
        return null;
      }

      const convData = convDoc.data();
      const receiverId = convData.participants.find(id => id !== message.senderId);

      const receiverDoc = await db.collection('users').doc(receiverId).get();

      if (!receiverDoc.exists) {
        console.log('Receiver no encontrado');
        return null;
      }

      const receiverData = receiverDoc.data();

      if (!receiverData.fcmToken || receiverData.notificationsEnabled === false) {
        console.log('Receiver sin token FCM o notificaciones deshabilitadas');
        return null;
      }

      const notificationMessage = {
        notification: {
          title: message.senderName,
          body: message.text.substring(0, 100)
        },
        data: {
          type: 'direct_message',
          conversationId: conversationId,
          messageId: event.params.messageId,
          senderId: message.senderId
        },
        token: receiverData.fcmToken
      };

      await messaging.send(notificationMessage);

      console.log(`Notificación de DM enviada a ${receiverId}`);

      return null;
    } catch (error) {
      console.error('Error enviando notificación de DM:', error);
      return null;
    }
  }
);