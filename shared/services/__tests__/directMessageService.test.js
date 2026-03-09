import { DirectMessageService } from '../DirectMessageService';

const mockDb = {};

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockWriteBatch = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  writeBatch: () => mockWriteBatch(),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: (...args) => mockLimit(...args),
  serverTimestamp: () => ({ _seconds: Date.now() / 1000 }),
  onSnapshot: jest.fn()
}));

describe('DirectMessageService', () => {
  let dmService;

  beforeEach(() => {
    dmService = new DirectMessageService(mockDb);
    jest.clearAllMocks();
  });

  describe('getConversationId', () => {
    it('should generate deterministic conversation ID', () => {
      const id1 = dmService.getConversationId('user-a', 'user-b');
      const id2 = dmService.getConversationId('user-b', 'user-a');

      expect(id1).toBe(id2);
      expect(id1).toBe('user-a_user-b');
    });

    it('should sort user IDs alphabetically', () => {
      const id = dmService.getConversationId('user-z', 'user-a');
      expect(id).toBe('user-a_user-z');
    });
  });

  describe('getOrCreateConversation', () => {
    it('should return existing conversation ID', async () => {
      mockDoc.mockReturnValue('conv-ref');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ participants: ['user-1', 'user-2'] })
      });

      const convId = await dmService.getOrCreateConversation('user-1', 'user-2');

      expect(convId).toBe('user-1_user-2');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('should create new conversation if not exists', async () => {
      mockDoc.mockReturnValue('conv-ref');
      mockGetDoc.mockResolvedValue({
        exists: () => false
      });
      mockSetDoc.mockResolvedValue(undefined);

      const convId = await dmService.getOrCreateConversation('user-1', 'user-2');

      expect(convId).toBe('user-1_user-2');
      expect(mockSetDoc).toHaveBeenCalled();
    });
  });

  describe('getUserConversations', () => {
    it('should get all user conversations', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'conv-1', data: () => ({ participants: ['user-1', 'user-2'] }) },
          { id: 'conv-2', data: () => ({ participants: ['user-1', 'user-3'] }) }
        ]
      });

      const conversations = await dmService.getUserConversations('user-1');

      expect(conversations).toHaveLength(2);
      expect(conversations[0].id).toBe('conv-1');
    });
  });

  describe('sendMessage', () => {
    it('should send message and update conversation', async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      mockCollection.mockReturnValue('messages-collection');
      mockDoc.mockReturnValue({ id: 'msg-123' });
      mockGetDoc.mockResolvedValue({
        data: () => ({
          participants: ['user-1', 'user-2'],
          unreadCount: { 'user-1': 0, 'user-2': 0 }
        })
      });

      const messageId = await dmService.sendMessage(
        'conv-1',
        'Hello',
        'user-1',
        'User One'
      );

      expect(messageId).toBe('msg-123');
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should increment unread count for receiver', async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      mockDoc.mockReturnValue({ id: 'msg-456' });
      mockGetDoc.mockResolvedValue({
        data: () => ({
          participants: ['user-1', 'user-2'],
          unreadCount: { 'user-1': 0, 'user-2': 5 }
        })
      });

      await dmService.sendMessage('conv-1', 'Hi', 'user-1', 'User One');

      const updateCall = mockBatch.update.mock.calls[0][1];
      expect(updateCall['unreadCount.user-2']).toBe(6);
    });
  });

  describe('getMessages', () => {
    it('should get messages in correct order', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'msg-2', data: () => ({ text: 'Second' }) },
          { id: 'msg-1', data: () => ({ text: 'First' }) }
        ]
      });

      const messages = await dmService.getMessages('conv-1', 50);

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[1].id).toBe('msg-2');
    });
  });

  describe('markAsRead', () => {
    it('should mark messages as read and reset counter', async () => {
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { ref: 'msg-ref-1' },
          { ref: 'msg-ref-2' }
        ]
      });

      await dmService.markAsRead('conv-1', 'user-1');

      expect(mockBatch.update).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('deleteMessage', () => {
    it('should delete message', async () => {
      mockDoc.mockReturnValue('msg-ref');
      mockDeleteDoc.mockResolvedValue(undefined);

      await dmService.deleteMessage('conv-1', 'msg-1');

      expect(mockDeleteDoc).toHaveBeenCalledWith('msg-ref');
    });
  });

  describe('addReaction', () => {
    it('should add reaction to message', async () => {
      mockDoc.mockReturnValue('msg-ref');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ text: 'Message', reactions: {} })
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await dmService.addReaction('conv-1', 'msg-1', '👍', 'user-1');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should not duplicate reaction from same user', async () => {
      mockDoc.mockReturnValue('msg-ref');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          text: 'Message',
          reactions: { '👍': ['user-1'] }
        })
      });

      await dmService.addReaction('conv-1', 'msg-1', '👍', 'user-1');

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('removeReaction', () => {
    it('should remove reaction from message', async () => {
      mockDoc.mockReturnValue('msg-ref');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          text: 'Message',
          reactions: { '👍': ['user-1', 'user-2'] }
        })
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await dmService.removeReaction('conv-1', 'msg-1', '👍', 'user-1');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should remove emoji key if no users left', async () => {
      mockDoc.mockReturnValue('msg-ref');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          text: 'Message',
          reactions: { '👍': ['user-1'] }
        })
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await dmService.removeReaction('conv-1', 'msg-1', '👍', 'user-1');

      const updateCall = mockUpdateDoc.mock.calls[0][1];
      expect(updateCall.reactions['👍']).toBeUndefined();
    });
  });

  describe('getTotalUnreadCount', () => {
    it('should calculate total unread messages', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'conv-1', data: () => ({ unreadCount: { 'user-1': 3 } }) },
          { id: 'conv-2', data: () => ({ unreadCount: { 'user-1': 5 } }) },
          { id: 'conv-3', data: () => ({ unreadCount: { 'user-1': 0 } }) }
        ]
      });

      const total = await dmService.getTotalUnreadCount('user-1');

      expect(total).toBe(8);
    });

    it('should handle conversations without unreadCount', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'conv-1', data: () => ({ unreadCount: { 'user-1': 2 } }) },
          { id: 'conv-2', data: () => ({}) }
        ]
      });

      const total = await dmService.getTotalUnreadCount('user-1');

      expect(total).toBe(2);
    });
  });
});