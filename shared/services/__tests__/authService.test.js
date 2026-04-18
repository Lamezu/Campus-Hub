import { AuthService } from '../authService';

const mockAuthInstance = {};
const mockDb = {};

const mockAuthModule = {
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(),
  sendPasswordResetEmail: jest.fn()
};

const mockFirestore = {
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: () => ({}),
  increment: jest.fn()
};

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    authService = new AuthService(mockAuthInstance, mockDb, mockAuthModule, mockFirestore);
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('debería registrar un nuevo usuario', async () => {
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com'
      };

      mockAuthModule.createUserWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });
      mockFirestore.setDoc.mockResolvedValue(undefined);

      const user = await authService.signUp(
        'test@example.com',
        'password123',
        'Test User',
        'student',
        'DAM'
      );

      expect(user).toEqual(mockUser);
      expect(mockFirestore.setDoc).toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('debería iniciar sesión correctamente', async () => {
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com'
      };

      mockAuthModule.signInWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });
      mockFirestore.setDoc.mockResolvedValue(undefined);

      const user = await authService.signIn('test@example.com', 'password123');

      expect(user).toEqual(mockUser);
    });
  });

  describe('signInWithGoogle', () => {
    it('debería crear usuario si no existe', async () => {
      const mockUser = {
        uid: 'google-user-123',
        email: 'google@example.com',
        displayName: 'Google User',
        photoURL: 'https://photo.url'
      };

      mockAuthModule.signInWithPopup.mockResolvedValue({
        user: mockUser
      });

      mockFirestore.getDoc.mockResolvedValue({
        exists: () => false
      });

      mockFirestore.setDoc.mockResolvedValue(undefined);

      const user = await authService.signInWithGoogle();

      expect(user).toEqual(mockUser);
      expect(mockFirestore.setDoc).toHaveBeenCalled();
    });
  });
});