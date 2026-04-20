jest.mock('@/services/shared', () => ({
  getDirectMessageService: jest.fn(),
}));
jest.mock('@/services/userService', () => ({
  incrementUserMessageCount: jest.fn(),
  getUser: jest.fn(),
}));
jest.mock('@/services/notificationService', () => ({
  notificationService: { addNotification: jest.fn() },
}));

import { getConversationId, subscribeToMessages } from '@/services/dmService';
import { getDirectMessageService } from '@/services/shared';

const mockGetDMService = getDirectMessageService as jest.Mock;

function makeService(messages: any[]) {
  return {
    onMessagesSnapshot: jest.fn((_convId: string, cb: (msgs: any[]) => void) => {
      cb(messages);
      return jest.fn();
    }),
  };
}

describe('getConversationId', () => {
  it('sorts uids alphabetically and joins with underscore', () => {
    expect(getConversationId('b', 'a')).toBe('a_b');
  });

  it('is commutative', () => {
    expect(getConversationId('user1', 'user2')).toBe(getConversationId('user2', 'user1'));
  });

  it('produces the correct id for sorted inputs', () => {
    expect(getConversationId('alice', 'bob')).toBe('alice_bob');
  });

  it('handles identical uids', () => {
    expect(getConversationId('same', 'same')).toBe('same_same');
  });
});

describe('subscribeToMessages — message transformation', () => {
  it('sets status to "read" when data.read is true', () => {
    mockGetDMService.mockReturnValue(
      makeService([{ id: '1', text: 'hi', senderId: 'u1', senderName: 'User', createdAt: '2024-01-01', read: true, status: 'sent' }])
    );
    const received: any[] = [];
    subscribeToMessages('conv1', 'u2', (msgs) => received.push(...msgs));
    expect(received[0].status).toBe('read');
  });

  it('keeps data.status when read is false', () => {
    mockGetDMService.mockReturnValue(
      makeService([{ id: '1', text: 'hi', senderId: 'u1', senderName: 'User', createdAt: '2024-01-01', read: false, status: 'delivered' }])
    );
    const received: any[] = [];
    subscribeToMessages('conv1', 'u2', (msgs) => received.push(...msgs));
    expect(received[0].status).toBe('delivered');
  });

  it('defaults status to "sent" when neither read nor status is present', () => {
    mockGetDMService.mockReturnValue(
      makeService([{ id: '1', text: 'hi', senderId: 'u1', senderName: 'User', createdAt: '2024-01-01' }])
    );
    const received: any[] = [];
    subscribeToMessages('conv1', 'u2', (msgs) => received.push(...msgs));
    expect(received[0].status).toBe('sent');
  });

  it('filters messages in deletedForUsers for the current user', () => {
    mockGetDMService.mockReturnValue(
      makeService([
        { id: '1', text: 'visible', senderId: 'u1', senderName: 'User', createdAt: '2024-01-01', deletedForUsers: [] },
        { id: '2', text: 'hidden', senderId: 'u1', senderName: 'User', createdAt: '2024-01-01', deletedForUsers: ['u2'] },
      ])
    );
    const received: any[] = [];
    subscribeToMessages('conv1', 'u2', (msgs) => received.push(...msgs));
    expect(received).toHaveLength(1);
    expect(received[0].id).toBe('1');
  });

  it('does not filter messages deleted for other users', () => {
    mockGetDMService.mockReturnValue(
      makeService([
        { id: '1', text: 'visible', senderId: 'u1', senderName: 'User', createdAt: '2024-01-01', deletedForUsers: ['u99'] },
      ])
    );
    const received: any[] = [];
    subscribeToMessages('conv1', 'u2', (msgs) => received.push(...msgs));
    expect(received).toHaveLength(1);
  });

  it('fills in default values for missing fields', () => {
    mockGetDMService.mockReturnValue(
      makeService([{ id: '1', createdAt: '2024-01-01' }])
    );
    const received: any[] = [];
    subscribeToMessages('conv1', 'u2', (msgs) => received.push(...msgs));
    const msg = received[0];
    expect(msg.text).toBe('');
    expect(msg.senderId).toBe('');
    expect(msg.edited).toBe(false);
    expect(msg.reactions).toEqual({});
    expect(msg.forwarded).toBe(false);
    expect(msg.deletedForUsers).toEqual([]);
  });
});
