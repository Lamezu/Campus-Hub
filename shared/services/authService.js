import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export class AuthService {
  constructor(auth, db) {
    this.auth = auth;
    this.db = db;
  }

  async signUp(email, password, displayName, role = 'student', department = null) {
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(this.db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      photoURL: null,
      role: role,
      department: department,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      fcmToken: null
    });

    return user;
  }

  async signIn(email, password) {
    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
    
    await this.updateLastActive(userCredential.user.uid);
    
    return userCredential.user;
  }

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(this.auth, provider);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(this.db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      await setDoc(doc(this.db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Usuario',
        photoURL: user.photoURL || null,
        role: 'student',
        department: null,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        fcmToken: null
      });
    } else {
      await this.updateLastActive(user.uid);
    }

    return user;
  }

  async signOut() {
    await signOut(this.auth);
  }

  async resetPassword(email) {
    await sendPasswordResetEmail(this.auth, email);
  }

  async updateLastActive(userId) {
    const userRef = doc(this.db, 'users', userId);
    await setDoc(userRef, {
      lastActive: serverTimestamp()
    }, { merge: true });
  }

  onAuthStateChanged(callback) {
    return onAuthStateChanged(this.auth, callback);
  }

  getCurrentUser() {
    return this.auth.currentUser;
  }

  async getUserData(userId) {
    const userDoc = await getDoc(doc(this.db, 'users', userId));
    return userDoc.exists() ? userDoc.data() : null;
  }
}