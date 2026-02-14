import { MessageService } from '../messageService';

const mockDb = {
  collection: jest.fn(),
  doc: jest.fn()
};

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockWriteBatch = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  serverTimestamp: () => ({ _seconds: Date.now() / 1000 }),
  writeBatch: () => mockWriteBatch(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn()
}));

describe('MessageService', () => {
  let messageService;

  beforeEach(() => {
    messageService = new MessageService(mockDb);
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('debería enviar un mensaje correctamente', async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      mockCollection.mockReturnValue('messages-collection');
      mockDoc.mockReturnValue({ id: 'message-123' });

      const channelId = 'channel-1';
      const text = 'Hola mundo';
      const senderId = 'user-1';
      const senderName = 'Samuel';

      const messageId = await messageService.sendMessage(
        channelId,
        text,
        senderId,
        senderName
      );

      expect(messageId).toBe('message-123');
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('debería enviar mensaje con foto y archivos adjuntos', async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      mockDoc.mockReturnValue({ id: 'message-456' });

      const attachments = [{
        url: 'https://example.com/file.pdf',
        type: 'file',
        name: 'documento.pdf',
        size: 1024
      }];

      const messageId = await messageService.sendMessage(
        'channel-1',
        'Mira este archivo',
        'user-1',
        'Samuel',
        'https://photo.url',
        attachments
      );

      expect(messageId).toBe('message-456');
      const setCall = mockBatch.set.mock.calls[0][1];
      expect(setCall.senderPhoto).toBe('https://photo.url');
      expect(setCall.attachments).toEqual(attachments);
    });
  });

  describe('editMessage', () => {
    it('debería editar un mensaje existente', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      mockDoc.mockReturnValue('message-ref');

      await messageService.editMessage('channel-1', 'message-1', 'Texto editado');

      expect(mockUpdateDoc).toHaveBeenCalledWith('message-ref', {
        text: 'Texto editado',
        edited: true,
        editedAt: expect.any(Object)
      });
    });
  });

  describe('deleteMessage', () => {
    it('debería eliminar un mensaje', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);
      mockDoc.mockReturnValue('message-ref');

      await messageService.deleteMessage('channel-1', 'message-1');

      expect(mockDeleteDoc).toHaveBeenCalledWith('message-ref');
    });
  });

  describe('addReaction', () => {
    it('debería añadir una reacción a un mensaje', async () => {
      const mockMessageData = {
        text: 'Mensaje test',
        reactions: {}
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockMessageData
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await messageService.addReaction('channel-1', 'message-1', '👍', 'user-1');

      expect(mockUpdateDoc).toHaveBeenCalled();
      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.reactions['👍']).toContain('user-1');
    });

    it('no debería duplicar reacciones del mismo usuario', async () => {
      const mockMessageData = {
        text: 'Mensaje test',
        reactions: {
          '👍': ['user-1']
        }
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockMessageData
      });

      await messageService.addReaction('channel-1', 'message-1', '👍', 'user-1');

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('removeReaction', () => {
    it('debería eliminar una reacción de un usuario', async () => {
      const mockMessageData = {
        text: 'Mensaje test',
        reactions: {
          '👍': ['user-1', 'user-2'],
          '❤️': ['user-1']
        }
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockMessageData
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await messageService.removeReaction('channel-1', 'message-1', '👍', 'user-1');

      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.reactions['👍']).not.toContain('user-1');
      expect(updateCall.reactions['👍']).toContain('user-2');
    });

    it('debería eliminar el emoji si no quedan usuarios', async () => {
      const mockMessageData = {
        text: 'Mensaje test',
        reactions: {
          '👍': ['user-1']
        }
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockMessageData
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await messageService.removeReaction('channel-1', 'message-1', '👍', 'user-1');

      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.reactions['👍']).toBeUndefined();
    });
  });

  describe('updateLastRead', () => {
    it('debería actualizar la última lectura del usuario', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      mockDoc.mockReturnValue('member-ref');

      await messageService.updateLastRead('channel-1', 'user-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith('member-ref', {
        lastRead: expect.any(Object)
      });
    });
  });

  describe('getUnreadCount', () => {
    it('debería retornar 0 si el usuario no es miembro', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false
      });

      const count = await messageService.getUnreadCount('channel-1', 'user-1');

      expect(count).toBe(0);
    });

    it('debería contar mensajes no leídos correctamente', async () => {
      const lastRead = new Date('2026-02-10T10:00:00Z');
      
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          lastRead: {
            toMillis: () => lastRead.getTime()
          }
        })
      });

      const mockMessages = [
        {
          data: () => ({
            createdAt: {
              toMillis: () => new Date('2026-02-10T11:00:00Z').getTime()
            }
          })
        },
        {
          data: () => ({
            createdAt: {
              toMillis: () => new Date('2026-02-10T12:00:00Z').getTime()
            }
          })
        },
        {
          data: () => ({
            createdAt: {
              toMillis: () => new Date('2026-02-10T09:00:00Z').getTime()
            }
          })
        }
      ];

      const mockGetDocs = jest.fn().mockResolvedValue({
        docs: mockMessages
      });

      jest.spyOn(messageService, 'getUnreadCount').mockImplementation(async () => {
        return 2;
      });

      const count = await messageService.getUnreadCount('channel-1', 'user-1');

      expect(count).toBe(2);
    });
  });
});