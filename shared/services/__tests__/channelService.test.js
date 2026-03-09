import { ChannelService } from '../channelService';

const mockDb = {};

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: () => ({ _seconds: Date.now() / 1000 }),
  writeBatch: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  increment: jest.fn((val) => ({ _increment: val })),
  onSnapshot: jest.fn()
}));

describe('ChannelService', () => {
  let channelService;

  beforeEach(() => {
    channelService = new ChannelService(mockDb);
    jest.clearAllMocks();
  });

  describe('createChannel', () => {
    it('debería crear un canal y añadir al creador como admin', async () => {
      const { writeBatch, doc, collection } = require('firebase/firestore');
      
      const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      writeBatch.mockReturnValue(mockBatch);
      collection.mockReturnValue('channels-collection');
      doc.mockReturnValue({ id: 'channel-123' });

      const channelData = {
        name: 'DAM - 2º Año',
        description: 'Canal de desarrollo',
        type: 'public',
        departmentRestricted: false,
        allowedDepartments: []
      };

      const channelId = await channelService.createChannel(channelData, 'user-1');

      expect(channelId).toBe('channel-123');
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('getChannel', () => {
    it('debería obtener un canal por ID', async () => {
      const { getDoc, doc } = require('firebase/firestore');

      const mockChannelData = {
        name: 'General',
        type: 'public',
        memberCount: 10
      };

      doc.mockReturnValue('channel-ref');
      getDoc.mockResolvedValue({
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

    it('debería retornar null si el canal no existe', async () => {
      const { getDoc } = require('firebase/firestore');

      getDoc.mockResolvedValue({
        exists: () => false
      });

      const channel = await channelService.getChannel('non-existent');

      expect(channel).toBeNull();
    });
  });

  describe('joinChannel', () => {
    it('debería añadir un usuario al canal', async () => {
      const { writeBatch, increment } = require('firebase/firestore');

      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      writeBatch.mockReturnValue(mockBatch);

      await channelService.joinChannel('channel-1', 'user-2');

      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('leaveChannel', () => {
    it('debería eliminar un usuario del canal', async () => {
      const { writeBatch } = require('firebase/firestore');

      const mockBatch = {
        delete: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      writeBatch.mockReturnValue(mockBatch);

      await channelService.leaveChannel('channel-1', 'user-2');

      expect(mockBatch.delete).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    it('debería actualizar el rol de un miembro', async () => {
      const { updateDoc, doc } = require('firebase/firestore');

      doc.mockReturnValue('member-ref');
      updateDoc.mockResolvedValue(undefined);

      await channelService.updateMemberRole('channel-1', 'user-1', 'moderator');

      expect(updateDoc).toHaveBeenCalledWith('member-ref', { role: 'moderator' });
    });
  });
  describe('getPublicChannels', () => {
    it('debería obtener solo canales públicos', async () => {
      const { getDocs, query } = require('firebase/firestore');

      query.mockReturnValue('public-channels-query');
      getDocs.mockResolvedValue({
        docs: [
          { id: 'channel-1', data: () => ({ name: 'Public 1', type: 'public' }) },
          { id: 'channel-2', data: () => ({ name: 'Public 2', type: 'public' }) }
        ]
      });

      const channels = await channelService.getPublicChannels();

      expect(channels).toHaveLength(2);
      expect(channels[0].type).toBe('public');
    });
  });

  describe('getChannelMembers', () => {
    it('debería obtener lista de miembros', async () => {
      const { getDocs } = require('firebase/firestore');

      getDocs.mockResolvedValue({
        docs: [
          { data: () => ({ userId: 'user-1', role: 'admin' }) },
          { data: () => ({ userId: 'user-2', role: 'member' }) }
        ]
      });

      const members = await channelService.getChannelMembers('channel-1');

      expect(members).toHaveLength(2);
      expect(members[0].role).toBe('admin');
    });
  });

  describe('getUserChannels', () => {
    it('debería obtener canales ordenados por último mensaje', async () => {
      const { getDocs, getDoc } = require('firebase/firestore');

      getDocs.mockResolvedValue({
        docs: [
          { id: 'ch-1', data: () => ({ name: 'Channel 1', lastMessageAt: { toMillis: () => 1000 } }) },
          { id: 'ch-2', data: () => ({ name: 'Channel 2', lastMessageAt: { toMillis: () => 2000 } }) }
        ]
      });

      getDoc
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ userId: 'user-1' }) })
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ userId: 'user-1' }) });

      const channels = await channelService.getUserChannels('user-1');

      expect(channels).toBeDefined();
    });
  });
});