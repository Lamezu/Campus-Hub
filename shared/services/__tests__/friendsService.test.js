import { FriendsService } from '../friendsService';

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
  serverTimestamp: () => ({ _seconds: Date.now() / 1000 }),
  onSnapshot: jest.fn()
}));

describe('FriendsService', () => {
  let friendsService;

  beforeEach(() => {
    friendsService = new FriendsService(mockDb);
    jest.clearAllMocks();
  });

  describe('sendFriendRequest', () => {
    it('should send friend request', async () => {
      mockCollection.mockReturnValue('requests-collection');
      mockDoc.mockReturnValue({ id: 'request-123' });
      mockSetDoc.mockResolvedValue(undefined);

      jest.spyOn(friendsService, 'getFriendRequest').mockResolvedValue(null);
      jest.spyOn(friendsService, 'areFriends').mockResolvedValue(false);

      const requestId = await friendsService.sendFriendRequest(
        'user-1',
        'user-2',
        'User One'
      );

      expect(requestId).toBe('request-123');
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should throw error if request already exists', async () => {
      jest.spyOn(friendsService, 'getFriendRequest').mockResolvedValue({ id: 'existing' });

      await expect(
        friendsService.sendFriendRequest('user-1', 'user-2', 'User One')
      ).rejects.toThrow('Friend request already exists');
    });

    it('should throw error if already friends', async () => {
      jest.spyOn(friendsService, 'getFriendRequest').mockResolvedValue(null);
      jest.spyOn(friendsService, 'areFriends').mockResolvedValue(true);

      await expect(
        friendsService.sendFriendRequest('user-1', 'user-2', 'User One')
      ).rejects.toThrow('Users are already friends');
    });
  });

  describe('getFriendRequest', () => {
    it('should find existing request from user1 to user2', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'request-1', data: () => ({ fromUserId: 'user-1' }) }]
        })
        .mockResolvedValueOnce({
          empty: true,
          docs: []
        });

      const request = await friendsService.getFriendRequest('user-1', 'user-2');

      expect(request).toEqual({ id: 'request-1', fromUserId: 'user-1' });
    });

    it('should find existing request from user2 to user1', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs
        .mockResolvedValueOnce({
          empty: true,
          docs: []
        })
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'request-2', data: () => ({ fromUserId: 'user-2' }) }]
        });

      const request = await friendsService.getFriendRequest('user-1', 'user-2');

      expect(request).toEqual({ id: 'request-2', fromUserId: 'user-2' });
    });

    it('should return null if no request exists', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: []
      });

      const request = await friendsService.getFriendRequest('user-1', 'user-2');

      expect(request).toBeNull();
    });
  });

  describe('getReceivedRequests', () => {
    it('should get all received requests', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'req-1', data: () => ({ fromUserId: 'user-1' }) },
          { id: 'req-2', data: () => ({ fromUserId: 'user-2' }) }
        ]
      });

      const requests = await friendsService.getReceivedRequests('user-3');

      expect(requests).toHaveLength(2);
    });
  });

  describe('getSentRequests', () => {
    it('should get all sent requests', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'req-1', data: () => ({ toUserId: 'user-2' }) },
          { id: 'req-2', data: () => ({ toUserId: 'user-3' }) }
        ]
      });

      const requests = await friendsService.getSentRequests('user-1');

      expect(requests).toHaveLength(2);
    });
  });

  describe('acceptFriendRequest', () => {
    it('should accept request and create bidirectional friendship', async () => {
      const mockBatch = {
        update: jest.fn(),
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      mockDoc.mockReturnValue('request-ref');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          fromUserId: 'user-1',
          toUserId: 'user-2'
        })
      });

      await friendsService.acceptFriendRequest('request-1');

      expect(mockBatch.update).toHaveBeenCalledTimes(1);
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should throw error if request not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false
      });

      await expect(
        friendsService.acceptFriendRequest('non-existent')
      ).rejects.toThrow('Friend request not found');
    });
  });

  describe('rejectFriendRequest', () => {
    it('should update request status to rejected', async () => {
      mockDoc.mockReturnValue('request-ref');
      mockUpdateDoc.mockResolvedValue(undefined);

      await friendsService.rejectFriendRequest('request-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'request-ref',
        expect.objectContaining({
          status: 'rejected'
        })
      );
    });
  });

  describe('cancelFriendRequest', () => {
    it('should delete request', async () => {
      mockDoc.mockReturnValue('request-ref');
      mockDeleteDoc.mockResolvedValue(undefined);

      await friendsService.cancelFriendRequest('request-1');

      expect(mockDeleteDoc).toHaveBeenCalledWith('request-ref');
    });
  });

  describe('areFriends', () => {
    it('should return true if users are friends', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        empty: false
      });

      const result = await friendsService.areFriends('user-1', 'user-2');

      expect(result).toBe(true);
    });

    it('should return false if users are not friends', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        empty: true
      });

      const result = await friendsService.areFriends('user-1', 'user-2');

      expect(result).toBe(false);
    });
  });

  describe('getFriends', () => {
    it('should get friends with user data', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ friendId: 'user-2', createdAt: {} }) },
          { data: () => ({ friendId: 'user-3', createdAt: {} }) }
        ]
      });

      mockDoc.mockReturnValue('user-ref');
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ displayName: 'User Two' })
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ displayName: 'User Three' })
        });

      const friends = await friendsService.getFriends('user-1');

      expect(friends).toHaveLength(2);
      expect(friends[0].displayName).toBe('User Two');
    });

    it('should filter out null friends', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ friendId: 'user-2', createdAt: {} }) },
          { data: () => ({ friendId: 'user-deleted', createdAt: {} }) }
        ]
      });

      mockDoc.mockReturnValue('user-ref');
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ displayName: 'User Two' })
        })
        .mockResolvedValueOnce({
          exists: () => false
        });

      const friends = await friendsService.getFriends('user-1');

      expect(friends).toHaveLength(1);
    });
  });

  describe('removeFriend', () => {
    it('should remove bidirectional friendship', async () => {
      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      mockQuery.mockReturnValue('query-result');
      mockGetDocs
        .mockResolvedValueOnce({
          docs: [{ ref: 'friendship-1' }]
        })
        .mockResolvedValueOnce({
          docs: [{ ref: 'friendship-2' }]
        });

      await friendsService.removeFriend('user-1', 'user-2');

      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });
});