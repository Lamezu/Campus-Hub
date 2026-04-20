export class AuthService {
  constructor(authInstance, db, authModule, firestore) {
    this.auth = authInstance;
    this.db = db;
    this.am = authModule;
    this.fs = firestore;
  }

  async signUp(email, password, displayName, role = 'student', department = null) {
    const userCredential = await this.am.createUserWithEmailAndPassword(this.auth, email, password);
    const user = userCredential.user;

    await this.fs.setDoc(this.fs.doc(this.db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      photoURL: null,
      role: role,
      department: department,
      createdAt: this.fs.serverTimestamp(),
      lastActive: this.fs.serverTimestamp(),
      fcmToken: null
    });

    return user;
  }

  async signIn(email, password) {
    const userCredential = await this.am.signInWithEmailAndPassword(this.auth, email, password);
    await this.updateLastActive(userCredential.user.uid);
    return userCredential.user;
  }

  async signInWithGoogle() {
    const provider = new this.am.GoogleAuthProvider();
    const userCredential = await this.am.signInWithPopup(this.auth, provider);
    const user = userCredential.user;

    const userDoc = await this.fs.getDoc(this.fs.doc(this.db, 'users', user.uid));

    if (!userDoc.exists()) {
      await this.fs.setDoc(this.fs.doc(this.db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Usuario',
        photoURL: user.photoURL || null,
        role: 'student',
        department: null,
        createdAt: this.fs.serverTimestamp(),
        lastActive: this.fs.serverTimestamp(),
        fcmToken: null
      });
    } else {
      await this.updateLastActive(user.uid);
    }

    return user;
  }

  async signOut() {
    await this.am.signOut(this.auth);
  }

  async resetPassword(email) {
    await this.am.sendPasswordResetEmail(this.auth, email);
  }

  async updateLastActive(userId) {
    const userRef = this.fs.doc(this.db, 'users', userId);
    await this.fs.setDoc(userRef, {
      lastActive: this.fs.serverTimestamp()
    }, { merge: true });
  }

  async deleteAccount(uid) {
    await this.fs.updateDoc(this.fs.doc(this.db, 'users', uid), {
      deleted: true,
      deletedAt: this.fs.serverTimestamp(),
      fcmToken: null,
    });
    const user = this.auth.currentUser;
    if (user) await this.am.deleteUser(user);
  }

  onAuthStateChanged(callback) {
    return this.am.onAuthStateChanged(this.auth, callback);
  }

  getCurrentUser() {
    return this.auth.currentUser;
  }

  async getUserData(userId) {
    if (!userId) return null;
    const userDoc = await this.fs.getDoc(this.fs.doc(this.db, 'users', userId));
    return userDoc.exists() ? userDoc.data() : null;
  }

  async incrementMessageCount(userId) {
    const userRef = this.fs.doc(this.db, 'users', userId);
    await this.fs.updateDoc(userRef, {
      messageCount: this.fs.increment(1)
    });
  }
}
export default AuthService;