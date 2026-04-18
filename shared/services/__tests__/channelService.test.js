import { ChannelService } from '../channelService';

const mockDb = {
  collection: jest.fn(),
  doc: jest.fn()
};

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockWriteBatch = jest.fn();

const mockFirestore = {
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  serverTimestamp: () => ({}),
  writeBatch: mockWriteBatch,
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  increment: jest.fn()
};

describe('ChannelService', () => {
  let channelService;

  beforeEach(() => {
    channelService = new ChannelService(mockDb, mockFirestore);
    jest.clearAllMocks();
  });

  describe('createChannel', () => {
    it('debería crear un canal y añadir al creador como admin', async () => {
      const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockCollection.mockReturnValue('channels-collection');
      mockDoc.mockReturnValue({ id: 'channel-123' });

      const channelData = {
        name: 'DAM - 2º Año',
        description: 'Canal de desarrollo',
        type: 'public',
        departmentRestricted: false,
        allowedDepartments: []
      };

      const channelId = await channelService.createChannel(channelData, 'user-1');

      expect(channelId).toBe('channel-123');
      expect(mockSetDoc).toHaveBeenCalledTimes(2);
    });
  });

  describe('getChannel', () => {
    it('debería obtener un canal por ID', async () => {
      const mockChannelData = {
        name: 'General',
        type: 'public',
        memberCount: 10
      };

      mockDoc.mockReturnValue('channel-ref');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'channel-1',
        data: () => mockChannelData
      });

      const channel = await channelService.getChannel('channel-1');

      expect(channel).toEqual({
        id: 'channel-1',
        ...mockChannelData
      });
    });
  });
});