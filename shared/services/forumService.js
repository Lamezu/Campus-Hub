import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc,
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  increment,
  writeBatch
} from 'firebase/firestore';

export class ForumService {
  constructor(db) {
    this.db = db;
  }

  async createPost(postData, authorId) {
    const postRef = doc(collection(this.db, 'posts'));
    const postId = postRef.id;
    
    await setDoc(postRef, {
      ...postData,
      authorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0
    });
    
    return postId;
  }

  async getPost(postId) {
    const postRef = doc(this.db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    
    if (postSnap.exists()) {
      await updateDoc(postRef, {
        viewsCount: increment(1)
      });
      
      return {
        id: postSnap.id,
        ...postSnap.data()
      };
    }
    
    return null;
  }

  async getPosts(category = null, limitCount = 20) {
    let q;
    
    if (category) {
      q = query(
        collection(this.db, 'posts'),
        where('category', '==', category),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    } else {
      q = query(
        collection(this.db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async updatePost(postId, updates) {
    const postRef = doc(this.db, 'posts', postId);
    await updateDoc(postRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  async deletePost(postId) {
    const batch = writeBatch(this.db);
    
    const postRef = doc(this.db, 'posts', postId);
    batch.delete(postRef);
    
    const commentsSnapshot = await getDocs(
      collection(this.db, 'posts', postId, 'comments')
    );
    
    commentsSnapshot.docs.forEach(commentDoc => {
      batch.delete(commentDoc.ref);
    });
    
    await batch.commit();
  }

  async addComment(postId, commentData, authorId) {
    const batch = writeBatch(this.db);
    
    const commentRef = doc(collection(this.db, 'posts', postId, 'comments'));
    batch.set(commentRef, {
      ...commentData,
      authorId,
      createdAt: serverTimestamp(),
      likesCount: 0
    });
    
    const postRef = doc(this.db, 'posts', postId);
    batch.update(postRef, {
      commentsCount: increment(1)
    });
    
    await batch.commit();
    return commentRef.id;
  }

  async getComments(postId, limitCount = 50) {
    const q = query(
      collection(this.db, 'posts', postId, 'comments'),
      orderBy('createdAt', 'asc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async deleteComment(postId, commentId) {
    const batch = writeBatch(this.db);
    
    const commentRef = doc(this.db, 'posts', postId, 'comments', commentId);
    batch.delete(commentRef);
    
    const postRef = doc(this.db, 'posts', postId);
    batch.update(postRef, {
      commentsCount: increment(-1)
    });
    
    await batch.commit();
  }

  async toggleLike(postId, userId) {
    const likeRef = doc(this.db, 'posts', postId, 'likes', userId);
    const likeSnap = await getDoc(likeRef);
    
    const batch = writeBatch(this.db);
    const postRef = doc(this.db, 'posts', postId);
    
    if (likeSnap.exists()) {
      batch.delete(likeRef);
      batch.update(postRef, {
        likesCount: increment(-1)
      });
    } else {
      batch.set(likeRef, {
        userId,
        createdAt: serverTimestamp()
      });
      batch.update(postRef, {
        likesCount: increment(1)
      });
    }
    
    await batch.commit();
    return !likeSnap.exists();
  }

  async toggleCommentLike(postId, commentId, userId) {
    const likeRef = doc(this.db, 'posts', postId, 'comments', commentId, 'likes', userId);
    const likeSnap = await getDoc(likeRef);
    
    const batch = writeBatch(this.db);
    const commentRef = doc(this.db, 'posts', postId, 'comments', commentId);
    
    if (likeSnap.exists()) {
      batch.delete(likeRef);
      batch.update(commentRef, {
        likesCount: increment(-1)
      });
    } else {
      batch.set(likeRef, {
        userId,
        createdAt: serverTimestamp()
      });
      batch.update(commentRef, {
        likesCount: increment(1)
      });
    }
    
    await batch.commit();
    return !likeSnap.exists();
  }

  subscribeToPost(postId, callback) {
    const postRef = doc(this.db, 'posts', postId);
    
    return onSnapshot(postRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    });
  }

  subscribeToComments(postId, callback) {
    const q = query(
      collection(this.db, 'posts', postId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(comments);
    });
  }
}