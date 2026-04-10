import { 
  collection, 
  doc, 
  addDoc, 
  writeBatch, 
  serverTimestamp, 
  increment,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { getConversationId } from './dmService';
import type { Post, Attachment } from '@/types';

export interface ShareDestination {
  id: string;
  type: 'dm' | 'channel' | 'studyGroup';
  name: string;
}

export async function sharePostToMultiple(post: Post, destinations: ShareDestination[]): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || destinations.length === 0) return;

  const meId = currentUser.uid;
  const senderName = currentUser.displayName || 'Usuario';
  const senderPhoto = currentUser.photoURL;

  const postAttachment: Attachment = {
    type: 'post',
    url: post.mediaUrl || '',
    name: post.title,
    size: 0,
    postId: post.id,
    postTitle: post.title,
    postContent: post.content,
    postAuthorName: post.authorName,
    postAuthorPhoto: post.authorPhoto,
  };

  const batchSize = 20; // Safe batch size
  for (let i = 0; i < destinations.length; i += batchSize) {
    const chunk = destinations.slice(i, i + batchSize);
    const batch = writeBatch(db);

    for (const dest of chunk) {
      if (dest.type === 'dm') {
        const conversationId = getConversationId(meId, dest.id);
        const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));
        batch.set(messageRef, {
          text: '',
          senderId: meId,
          senderName,
          senderPhoto,
          createdAt: serverTimestamp(),
          edited: false,
          editedAt: null,
          attachments: [postAttachment],
          reactions: {},
          replyTo: null,
          deletedForUsers: [],
          forwarded: true,
          status: 'sent',
        });

        // Update conversation last message
        const convRef = doc(db, 'conversations', conversationId);
        batch.update(convRef, {
          lastMessageAt: serverTimestamp(),
          lastMessage: 'Post compartido: ' + post.title,
          [`unreadCount.${dest.id}`]: increment(1),
          deletedBy: [],
        });
      } else if (dest.type === 'channel') {
        const messageRef = doc(collection(db, 'channels', dest.id, 'messages'));
        batch.set(messageRef, {
          text: '',
          senderId: meId,
          senderName,
          senderPhoto,
          createdAt: serverTimestamp(),
          edited: false,
          editedAt: null,
          attachments: [postAttachment],
          reactions: {},
          replyTo: null,
          deletedForUsers: [],
          forwarded: true,
        });
      } else if (dest.type === 'studyGroup') {
        const messageRef = doc(collection(db, 'studyGroups', dest.id, 'messages'));
        batch.set(messageRef, {
          text: '',
          senderId: meId,
          senderName,
          senderPhoto,
          createdAt: serverTimestamp(),
          edited: false,
          editedAt: null,
          attachments: [postAttachment],
          reactions: {},
          replyTo: null,
          deletedForUsers: [],
          forwarded: true,
        });
      }
    }

    await batch.commit();
  }

  // Increment sharesCount on the post
  try {
    const postRef = doc(db, 'posts', post.id);
    await updateDoc(postRef, {
      sharesCount: increment(destinations.length),
    });
  } catch (err) {
    console.warn('[ShareService] Failed to increment share count:', err);
  }
}

// End of file
