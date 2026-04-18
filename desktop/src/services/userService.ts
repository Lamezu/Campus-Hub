import { 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  deleteUser 
} from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { 
  collection, query, where, getDocs, 
  doc, arrayRemove, writeBatch 
} from 'firebase/firestore';

export async function deleteUserAccount(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('no_user');

  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  const uid = user.uid;
  const batch = writeBatch(db);

  // Clean up user data
  // Posts
  const postsSnap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', uid)));
  postsSnap.forEach(d => batch.delete(d.ref));

  // Study Groups
  const sgSnap = await getDocs(query(collection(db, 'studyGroups'), where('memberIds', 'array-contains', uid)));
  sgSnap.forEach(d => batch.update(d.ref, { 
    memberIds: arrayRemove(uid),
    memberCount: Math.max(0, (d.data().memberCount || 1) - 1)
  }));

  // Friends (sub-collection)
  const friendsSnap = await getDocs(collection(db, 'users', uid, 'friends'));
  friendsSnap.forEach(d => batch.delete(d.ref));

  // Notifications (sub-collection)
  const notifSnap = await getDocs(collection(db, 'notifications', uid, 'items'));
  notifSnap.forEach(d => batch.delete(d.ref));

  // Remove from active group calls/conferences
  const confSnap = await getDocs(query(collection(db, 'studyGroupConferences'), where('activeParticipants', 'array-contains', uid)));
  confSnap.forEach(d => {
    const data = d.data();
    const next = (data.activeParticipants || []).filter((u: string) => u !== uid);
    if (next.length === 0) {
      batch.update(d.ref, { activeParticipants: [], status: 'ended' });
    } else {
      batch.update(d.ref, { activeParticipants: next });
    }
  });

  // User document
  batch.delete(doc(db, 'users', uid));

  await batch.commit();

  // Finally delete from Firebase Auth
  await deleteUser(user);
}

export async function getUserData(userId: string) {
    if (!userId) return null;
    try {
        const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', userId)));
        if (!snap.empty) return snap.docs[0].data();
        return null;
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}
