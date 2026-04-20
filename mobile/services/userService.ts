import { getAuthService as sharedGetAuthService } from './shared';
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import {
  collection, query, where, getDocs,
  doc, arrayRemove, writeBatch,
} from 'firebase/firestore';

export async function deleteUserAccount(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('no_user');

  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  const uid = user.uid;
  const batch = writeBatch(db);

  const postsSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', uid)));
  postsSnap.forEach(d => batch.delete(d.ref));

  const sgSnap = await getDocs(query(collection(db, 'studyGroups'), where('memberIds', 'array-contains', uid)));
  sgSnap.forEach(d => batch.update(d.ref, { memberIds: arrayRemove(uid) }));

  const friendsSnap = await getDocs(collection(db, 'users', uid, 'friends'));
  friendsSnap.forEach(d => batch.delete(d.ref));

  const notifSnap = await getDocs(collection(db, 'notifications', uid, 'items'));
  notifSnap.forEach(d => batch.delete(d.ref));

  batch.update(doc(db, 'users', uid), { deleted: true, fcmToken: null });

  await batch.commit();

  await deleteUser(user);
}

export async function incrementUserMessageCount(userId: string) {
    try {
        await sharedGetAuthService().incrementMessageCount(userId);
    } catch (error) {
        console.error('Error incrementing user message count:', error);
    }
}

export async function getUser(userId: string) {
    if (!userId) return null;
    try {
        return await sharedGetAuthService().getUserData(userId);
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}
