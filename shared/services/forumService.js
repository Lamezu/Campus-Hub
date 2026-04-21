export class ForumService {
  constructor(db, firestore) {
    this.db = db;
    this.fs = firestore;
  }

  async createPost(postData, authorId) {
    const postRef = this.fs.doc(this.fs.collection(this.db, 'posts'));
    const postId = postRef.id;

    await this.fs.setDoc(postRef, {
      ...postData,
      authorId,
      createdAt: this.fs.serverTimestamp(),
      updatedAt: this.fs.serverTimestamp(),
      likes: [],
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0
    });

    return postId;
  }

  async getPost(postId) {
    const postRef = this.fs.doc(this.db, 'posts', postId);
    const postSnap = await this.fs.getDoc(postRef);

    if (postSnap.exists()) {
      return {
        id: postSnap.id,
        ...postSnap.data()
      };
    }

    return null;
  }

  async incrementViews(postId, userId) {
    const postRef = this.fs.doc(this.db, 'posts', postId);
    await this.fs.updateDoc(postRef, {
      views: this.fs.arrayUnion(userId),
      viewsCount: this.fs.increment(1)
    });
  }

  async getPosts(category = null, limitCount = 20, startAfterDoc = null, postType = null) {
    let constraints = [];

    if (category) {
      constraints.push(this.fs.where('category', '==', category));
    }

    if (postType) {
      constraints.push(this.fs.where('postType', '==', postType));
    }

    constraints.push(this.fs.orderBy('createdAt', 'desc'));

    if (startAfterDoc) {
      constraints.push(this.fs.startAfter(startAfterDoc));
    }

    constraints.push(this.fs.limit(limitCount));

    const q = this.fs.query(
      this.fs.collection(this.db, 'posts'),
      ...constraints
    );

    const snapshot = await this.fs.getDocs(q);
    return {
      docs: snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })),
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
    };
  }

  async updatePost(postId, updates) {
    const postRef = this.fs.doc(this.db, 'posts', postId);
    await this.fs.updateDoc(postRef, {
      ...updates,
      updatedAt: this.fs.serverTimestamp()
    });
  }

  async deletePost(postId) {
    const postRef = this.fs.doc(this.db, 'posts', postId);
    const postSnap = await this.fs.getDoc(postRef);
    if (postSnap.exists()) {
      const data = postSnap.data();
      if (data.originalAnnouncementId) {
        const annRef = this.fs.doc(this.db, 'posts', data.originalAnnouncementId);
        await this.fs.updateDoc(annRef, { socialId: null });
      }
    }
    await this.fs.deleteDoc(postRef);
  }

  async addComment(postId, commentData, authorId) {
    const commentRef = this.fs.doc(this.fs.collection(this.db, 'posts', postId, 'comments'));
    const batch = this.fs.writeBatch(this.db);

    batch.set(commentRef, {
      ...commentData,
      authorId,
      createdAt: this.fs.serverTimestamp(),
      likes: [],
      likesCount: 0
    });

    const postRef = this.fs.doc(this.db, 'posts', postId);
    batch.update(postRef, {
      commentsCount: this.fs.increment(1)
    });

    await batch.commit();
    return commentRef.id;
  }

  async getComments(postId, limitCount = 50) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'posts', postId, 'comments'),
      this.fs.orderBy('createdAt', 'asc'),
      this.fs.limit(limitCount)
    );

    const snapshot = await this.fs.getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async deleteComment(postId, commentId) {
    const commentRef = this.fs.doc(this.db, 'posts', postId, 'comments', commentId);
    const postRef = this.fs.doc(this.db, 'posts', postId);

    const batch = this.fs.writeBatch(this.db);
    batch.delete(commentRef);
    batch.update(postRef, {
      commentsCount: this.fs.increment(-1)
    });

    await batch.commit();
  }

  async toggleLike(postId, userId) {
    const postRef = this.fs.doc(this.db, 'posts', postId);
    await this.fs.runTransaction(this.db, async (transaction) => {
      const postSnap = await transaction.get(postRef);
      if (!postSnap.exists()) return;
      const data = postSnap.data();
      const likes = data.likes || [];
      const isLiked = likes.includes(userId);
      const newLikes = isLiked ? likes.filter(id => id !== userId) : [...likes, userId];
      const newCount = Math.max(0, (data.likesCount || 0) + (isLiked ? -1 : 1));
      transaction.update(postRef, { likes: newLikes, likesCount: newCount });
    });
  }

  async trackShare(postId, userId) {
    const postRef = this.fs.doc(this.db, 'posts', postId);
    await this.fs.runTransaction(this.db, async (transaction) => {
      const snap = await transaction.get(postRef);
      if (!snap.exists()) return;
      const sharedBy = snap.data().sharedBy || [];
      if (sharedBy.includes(userId)) return;
      transaction.update(postRef, {
        sharedBy: [...sharedBy, userId],
        sharesCount: (snap.data().sharesCount || 0) + 1
      });
    });
  }

  async toggleCommentLike(postId, commentId, userId) {
    const commentRef = this.fs.doc(this.db, 'posts', postId, 'comments', commentId);
    await this.fs.runTransaction(this.db, async (transaction) => {
      const commentSnap = await transaction.get(commentRef);
      if (!commentSnap.exists()) return;
      const data = commentSnap.data();
      const likes = data.likes || [];
      const isLiked = likes.includes(userId);
      const newLikes = isLiked ? likes.filter(id => id !== userId) : [...likes, userId];
      const newCount = Math.max(0, (data.likesCount || 0) + (isLiked ? -1 : 1));
      transaction.update(commentRef, { likes: newLikes, likesCount: newCount });
    });
  }

  subscribeToPost(postId, callback) {
    const postRef = this.fs.doc(this.db, 'posts', postId);

    return this.fs.onSnapshot(postRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    });
  }

  subscribeToPosts(category, callback) {
    let q;
    if (category) {
      q = this.fs.query(
        this.fs.collection(this.db, 'posts'),
        this.fs.where('category', '==', category),
        this.fs.orderBy('createdAt', 'desc')
      );
    } else {
      q = this.fs.query(
        this.fs.collection(this.db, 'posts'),
        this.fs.orderBy('createdAt', 'desc')
      );
    }

    return this.fs.onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(posts);
    });
  }

  subscribeToComments(postId, callback) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'posts', postId, 'comments'),
      this.fs.orderBy('createdAt', 'asc')
    );

    return this.fs.onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(comments);
    });
  }

  subscribeToAnnouncements(callback) {
    try {
      const q = this.fs.query(
        this.fs.collection(this.db, 'posts'),
        this.fs.where('postType', '==', 'announcement'),
        this.fs.orderBy('createdAt', 'desc'),
        this.fs.limit(50)
      );
      return this.fs.onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error('Error in subscribeToAnnouncements:', error);
      });
    } catch (error) {
      console.error('Error in subscribeToAnnouncements:', error);
      return () => { };
    }
  }

  subscribeToPinnedAnnouncements(callback) {
    try {
      if (!this.fs || !this.fs.query) {
        console.error('Firestore functions not initialized properly in ForumService');
        return () => { };
      }
      const q = this.fs.query(
        this.fs.collection(this.db, 'posts'),
        this.fs.where('postType', '==', 'announcement'),
        this.fs.orderBy('createdAt', 'desc'),
        this.fs.limit(50)
      );

      return this.fs.onSnapshot(q, (snapshot) => {
        const pinned = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(post => post.pinned === true); // Filtrado en cliente
        callback(pinned);
      });
    } catch (error) {
      console.error('Error in subscribeToPinnedAnnouncements:', error);
      return () => { };
    }
  }
}
export default ForumService;