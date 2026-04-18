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
    // Note: The service now expects (db, firestoreInstance)
    messageService = new MessageService(mockDb, {
      collection: mockCollection,
      doc: mockDoc,
      getDoc: mockGetDoc,
      updateDoc: mockUpdateDoc,
      deleteDoc: mockDeleteDoc,
      serverTimestamp: () => ({}),
      writeBatch: mockWriteBatch,
      query: jest.fn(),
      orderBy: jest.fn(),
      limit: jest.fn(),
      onSnapshot: jest.fn(),
      setDoc: jest.fn()
    });
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
    });
  });
});