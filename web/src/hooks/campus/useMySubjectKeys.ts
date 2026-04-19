import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';


export function useMySubjectKeys(uid: string | null): Set<string> {
  const [keys, setKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'studyGroups'), where('memberIds', 'array-contains', uid));
    return onSnapshot(q, snap => {
      const set = new Set<string>();
      snap.docs.forEach(d => {
        const data = d.data();
        if (Array.isArray(data.subjects)) {
          data.subjects.forEach((s: string) => set.add(s));
        } else if (typeof data.subject === 'string' && data.subject) {
          set.add(data.subject);
        }
      });
      setKeys(set);
    });
  }, [uid]);

  return keys;
}
