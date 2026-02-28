const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

exports.onMessageCreated = onDocumentCreated(
  'channels/{channelId}/messages/{messageId}',
  async (event) => {
    try {
      const message = event.data.data();
      const channelId = event.params.channelId;
      const messageId = event.params.messageId;

      const db = getFirestore();
      
      const channelDoc = await db
        .collection('channels')
        .doc(channelId)
        .get();

      if (!channelDoc.exists) {
        console.log('Channel not found');
        return null;
      }

      const channelName = channelDoc.data().name;

      const membersSnapshot = await db
        .collection('channels')
        .doc(channelId)
        .collection('members')
        .get();

      const tokens = [];
      const senderName = message.senderName || 'Someone';

      for (const memberDoc of membersSnapshot.docs) {
        const userId = memberDoc.data().userId;

        if (userId !== message.senderId) {
          const userDoc = await db
            .collection('users')
            .doc(userId)
            .get();

          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.fcmToken && userData.notificationsEnabled !== false) {
              tokens.push(userData.fcmToken);
            }
          }
        }
      }

      if (tokens.length === 0) {
        console.log('No tokens to send notifications to');
        return null;
      }

      const messaging = getMessaging();
      const payload = {
        notification: {
          title: `${senderName} in ${channelName}`,
          body: message.text.substring(0, 100)
        },
        data: {
          channelId: channelId,
          messageId: messageId,
          type: 'new_message',
          senderId: message.senderId
        }
      };

      const messages = tokens.map(token => ({
        ...payload,
        token: token
      }));

      const response = await messaging.sendEach(messages);

      console.log('Notifications sent:', response.successCount);
      console.log('Notifications failed:', response.failureCount);

      return response;

    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  }
);