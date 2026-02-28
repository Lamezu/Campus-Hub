import { AuthService } from '../authService';

const mockAuth = {};
const mockDb = {};

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(),
  sendPasswordResetEmail: jest.fn()
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  serverTimestamp: () => ({ _seconds: Date.now() / 1000 })
}));

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService(mockAuth, mockDb);
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('debería registrar un nuevo usuario', async () => {
      const { createUserWithEmailAndPassword } = require('firebase/auth');
      const { setDoc } = require('firebase/firestore');

      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com'
      };

      createUserWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });
      setDoc.mockResolvedValue(undefined);

      const user = await authService.signUp(
        'test@example.com',
        'password123',
        'Test User',
        'student',
        'DAM'
      );

      expect(user).toEqual(mockUser);
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('debería iniciar sesión correctamente', async () => {
      const { signInWithEmailAndPassword } = require('firebase/auth');
      const { setDoc } = require('firebase/firestore');

      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com'
      };

      signInWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });
      setDoc.mockResolvedValue(undefined);

      const user = await authService.signIn('test@example.com', 'password123');

      expect(user).toEqual(mockUser);
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password123'
      );
    });
  });

  describe('signInWithGoogle', () => {
    it('debería crear usuario si no existe', async () => {
      const { signInWithPopup } = require('firebase/auth');
      const { getDoc, setDoc } = require('firebase/firestore');

      const mockUser = {
        uid: 'google-user-123',
        email: 'google@example.com',
        displayName: 'Google User',
        photoURL: 'https://photo.url'
      };

      signInWithPopup.mockResolvedValue({
        user: mockUser
      });

      getDoc.mockResolvedValue({
        exists: () => false
      });

      setDoc.mockResolvedValue(undefined);

      const user = await authService.signInWithGoogle();

      expect(user).toEqual(mockUser);
      expect(setDoc).toHaveBeenCalled();
    });

    it.skip('debería actualizar lastActive si el usuario ya existe', async () => {
      const { signInWithPopup } = require('firebase/auth');
      const { getDoc, setDoc } = require('firebase/firestore');

      const mockUser = {
        uid: 'existing-user',
        email: 'existing@example.com',
        displayName: 'Existing User'
      };

      signInWithPopup.mockResolvedValue({
        user: mockUser
      });

      getDoc.mockResolvedValue({
        exists: () => true
      });

      setDoc.mockResolvedValue(undefined);

      await authService.signInWithGoogle();

      expect(setDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          lastActive: expect.any(Object)
        }),
        { merge: true }
      );
    });
  });

  describe('signOut', () => {
    it('debería cerrar sesión correctamente', async () => {
      const { signOut } = require('firebase/auth');

      signOut.mockResolvedValue(undefined);

      await authService.signOut();

      expect(signOut).toHaveBeenCalledWith(mockAuth);
    });
  });

  describe('resetPassword', () => {
    it('debería enviar email de recuperación', async () => {
      const { sendPasswordResetEmail } = require('firebase/auth');

      sendPasswordResetEmail.mockResolvedValue(undefined);

      await authService.resetPassword('test@example.com');

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com'
      );
    });
  });

  describe('getCurrentUser', () => {
    it('debería retornar el usuario actual', () => {
      const mockCurrentUser = { uid: 'current-user' };
      authService.auth = { currentUser: mockCurrentUser };

      const user = authService.getCurrentUser();

      expect(user).toEqual(mockCurrentUser);
    });
  });
});