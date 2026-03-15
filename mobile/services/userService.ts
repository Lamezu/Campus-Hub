import { db } from '@/config/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

export async function incrementUserMessageCount(userId: string) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            messageCount: increment(1)
        });
    } catch (error) {
        console.error('Error incrementing user message count:', error);
    }
}
