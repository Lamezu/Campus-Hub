import { NotificationService } from '../notificationService';

const mockDb = {};

const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockCollection = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  collection: (...args) => mockCollection(...args),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  serverTimestamp: () => ({ _seconds: Date.now() / 1000 })
}));

describe('NotificationService', () => {
  let notificationService;

  beforeEach(() => {
    notificationService = new NotificationService(mockDb);
    jest.clearAllMocks();
  });

  describe('registerForPushNotifications', () => {
    it('debería registrar token FCM correctamente', async () => {
      mockDoc.mockReturnValue('user-ref');
      mockUpdateDoc.mockResolvedValue(undefined);

      await notificationService.registerForPushNotifications('user-1', 'token-abc123');

      expect(mockUpdateDoc).toHaveBeenCalledWith('user-ref', {
        fcmToken: 'token-abc123',
        notificationsEnabled: true,
        lastTokenUpdate: expect.any(Object)
      });
    });
  });

  describe('sendPushNotification', () => {
    it('debería enviar notificación a usuario con token', async () => {
      mockDoc.mockReturnValueOnce('user-ref').mockReturnValueOnce({ id: 'notif-123' });
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          fcmToken: 'token-xyz789',
          displayName: 'Samuel'
        })
      });

      mockCollection.mockReturnValue('notifications-collection');
      mockSetDoc.mockResolvedValue(undefined);

      const notifId = await notificationService.sendPushNotification(
        'user-1',
        'Nuevo mensaje',
        'Tienes un mensaje nuevo'
      );

      expect(notifId).toBe('notif-123');
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('debería lanzar error si usuario no existe', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false
      });

      await expect(
        notificationService.sendPushNotification('user-999', 'Test', 'Body')
      ).rejects.toThrow('User not found');
    });

    it('debería lanzar error si usuario no tiene token FCM', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          fcmToken: null
        })
      });

      await expect(
        notificationService.sendPushNotification('user-1', 'Test', 'Body')
      ).rejects.toThrow('User does not have FCM token registered');
    });
  });

  describe('getChannelMembers', () => {
    it('debería obtener miembros con tokens FCM', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ userId: 'user-1' }) },
          { data: () => ({ userId: 'user-2' }) }
        ]
      });

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            fcmToken: 'token-1',
            displayName: 'Samuel',
            notificationsEnabled: true
          })
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            fcmToken: 'token-2',
            displayName: 'Alejandro',
            notificationsEnabled: true
          })
        });

      const members = await notificationService.getChannelMembers('channel-1');

      expect(members).toHaveLength(2);
      expect(members[0]).toEqual({
        userId: 'user-1',
        token: 'token-1',
        displayName: 'Samuel'
      });
    });

    it('debería filtrar usuarios sin token FCM', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ userId: 'user-1' }) },
          { data: () => ({ userId: 'user-2' }) }
        ]
      });

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            fcmToken: 'token-1',
            displayName: 'Samuel'
          })
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            fcmToken: null,
            displayName: 'Sin token'
          })
        });

      const members = await notificationService.getChannelMembers('channel-1');

      expect(members).toHaveLength(1);
      expect(members[0].userId).toBe('user-1');
    });
  });

  describe('sendChannelNotification', () => {
    it('debería enviar notificaciones a todos los miembros excepto el remitente', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ userId: 'user-1' }) },
          { data: () => ({ userId: 'user-2' }) },
          { data: () => ({ userId: 'user-3' }) }
        ]
      });

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ fcmToken: 'token-1', displayName: 'User 1' })
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ fcmToken: 'token-2', displayName: 'User 2' })
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ fcmToken: 'token-3', displayName: 'User 3' })
        });

      jest.spyOn(notificationService, 'sendPushNotification').mockResolvedValue('notif-id');

      await notificationService.sendChannelNotification(
        'channel-1',
        'user-2',
        'Nuevo mensaje',
        'Tienes un mensaje'
      );

      expect(notificationService.sendPushNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('disableNotifications', () => {
    it('debería desactivar notificaciones de usuario', async () => {
      mockDoc.mockReturnValue('user-ref');
      mockUpdateDoc.mockResolvedValue(undefined);

      await notificationService.disableNotifications('user-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith('user-ref', {
        notificationsEnabled: false
      });
    });
  });

  describe('enableNotifications', () => {
    it('debería activar notificaciones de usuario', async () => {
      mockDoc.mockReturnValue('user-ref');
      mockUpdateDoc.mockResolvedValue(undefined);

      await notificationService.enableNotifications('user-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith('user-ref', {
        notificationsEnabled: true
      });
    });
  });
});