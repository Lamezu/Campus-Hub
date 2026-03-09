import { EventsService } from '../eventsService';

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
  Timestamp: {
    now: () => ({ _seconds: Date.now() / 1000 })
  },
  onSnapshot: jest.fn()
}));

describe('EventsService', () => {
  let eventsService;

  beforeEach(() => {
    eventsService = new EventsService(mockDb);
    jest.clearAllMocks();
  });

  describe('createEvent', () => {
    it('should create event and auto-RSVP creator', async () => {
      mockCollection.mockReturnValue('events-collection');
      mockDoc.mockReturnValue({ id: 'event-123' });
      mockSetDoc.mockResolvedValue(undefined);

      jest.spyOn(eventsService, 'rsvpEvent').mockResolvedValue(undefined);

      const eventId = await eventsService.createEvent(
        { title: 'Test Event', startDate: new Date() },
        'user-1'
      );

      expect(eventId).toBe('event-123');
      expect(mockSetDoc).toHaveBeenCalled();
      expect(eventsService.rsvpEvent).toHaveBeenCalledWith('event-123', 'user-1', 'going');
    });
  });

  describe('getEvent', () => {
    it('should get event by ID', async () => {
      mockDoc.mockReturnValue('event-ref');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'event-1',
        data: () => ({ title: 'Test Event' })
      });

      const event = await eventsService.getEvent('event-1');

      expect(event).toEqual({
        id: 'event-1',
        title: 'Test Event'
      });
    });

    it('should return null if event not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false
      });

      const event = await eventsService.getEvent('non-existent');

      expect(event).toBeNull();
    });
  });

  describe('getEvents', () => {
    it('should get upcoming events', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'event-1', data: () => ({ title: 'Event 1', status: 'upcoming' }) },
          { id: 'event-2', data: () => ({ title: 'Event 2', status: 'upcoming' }) }
        ]
      });

      const events = await eventsService.getEvents({ status: 'upcoming' });

      expect(events).toHaveLength(2);
    });

    it('should filter by category', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'event-1', data: () => ({ title: 'Tech Event', category: 'tech' }) }
        ]
      });

      const events = await eventsService.getEvents({ category: 'tech' });

      expect(events).toHaveLength(1);
      expect(events[0].category).toBe('tech');
    });
  });

  describe('getUserCreatedEvents', () => {
    it('should get events created by user', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'event-1', data: () => ({ creatorId: 'user-1' }) }
        ]
      });

      const events = await eventsService.getUserCreatedEvents('user-1');

      expect(events).toHaveLength(1);
    });
  });

  describe('getUserAttendingEvents', () => {
    it('should get events user is attending', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ eventId: 'event-1', status: 'going' }) }
        ]
      });

      jest.spyOn(eventsService, 'getEvent').mockResolvedValue({
        id: 'event-1',
        title: 'Test Event'
      });

      const events = await eventsService.getUserAttendingEvents('user-1');

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Test Event');
    });

    it('should filter out null events', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ eventId: 'event-1' }) },
          { data: () => ({ eventId: 'event-deleted' }) }
        ]
      });

      jest.spyOn(eventsService, 'getEvent')
        .mockResolvedValueOnce({ id: 'event-1', title: 'Event' })
        .mockResolvedValueOnce(null);

      const events = await eventsService.getUserAttendingEvents('user-1');

      expect(events).toHaveLength(1);
    });
  });

  describe('updateEvent', () => {
    it('should update event', async () => {
      mockDoc.mockReturnValue('event-ref');
      mockUpdateDoc.mockResolvedValue(undefined);

      await eventsService.updateEvent('event-1', { title: 'Updated Title' });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'event-ref',
        expect.objectContaining({
          title: 'Updated Title'
        })
      );
    });
  });

  describe('deleteEvent', () => {
    it('should delete event and all RSVPs', async () => {
      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { ref: 'rsvp-1' },
          { ref: 'rsvp-2' }
        ]
      });

      await eventsService.deleteEvent('event-1');

      expect(mockBatch.delete).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });

  describe('rsvpEvent', () => {
    it('should create new RSVP with going status', async () => {
      const mockBatch = {
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      jest.spyOn(eventsService, 'getUserRSVP').mockResolvedValue(null);

      mockDoc.mockReturnValue({ id: 'rsvp-123' });
      mockGetDoc.mockResolvedValue({
        data: () => ({ attendeesCount: 5 })
      });

      await eventsService.rsvpEvent('event-1', 'user-1', 'going');

      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should update existing RSVP', async () => {
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      jest.spyOn(eventsService, 'getUserRSVP').mockResolvedValue({
        id: 'rsvp-1',
        status: 'maybe'
      });

      mockDoc.mockReturnValue('rsvp-ref');
      mockGetDoc.mockResolvedValue({
        data: () => ({ attendeesCount: 5 })
      });

      await eventsService.rsvpEvent('event-1', 'user-1', 'going');

      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should decrement counter when changing from going to not_going', async () => {
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      jest.spyOn(eventsService, 'getUserRSVP').mockResolvedValue({
        id: 'rsvp-1',
        status: 'going'
      });

      mockDoc.mockReturnValue('rsvp-ref');
      mockGetDoc.mockResolvedValue({
        data: () => ({ attendeesCount: 10 })
      });

      await eventsService.rsvpEvent('event-1', 'user-1', 'not_going');

      const eventUpdateCall = mockBatch.update.mock.calls.find(
        call => call[1].attendeesCount !== undefined
      );

      expect(eventUpdateCall[1].attendeesCount).toBe(9);
    });
  });

  describe('getUserRSVP', () => {
    it('should get user RSVP for event', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          { id: 'rsvp-1', data: () => ({ status: 'going' }) }
        ]
      });

      const rsvp = await eventsService.getUserRSVP('event-1', 'user-1');

      expect(rsvp).toEqual({
        id: 'rsvp-1',
        status: 'going'
      });
    });

    it('should return null if no RSVP found', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        empty: true
      });

      const rsvp = await eventsService.getUserRSVP('event-1', 'user-1');

      expect(rsvp).toBeNull();
    });
  });

  describe('getEventAttendees', () => {
    it('should get attendees with user data', async () => {
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ userId: 'user-1', status: 'going' }) },
          { data: () => ({ userId: 'user-2', status: 'going' }) }
        ]
      });

      mockDoc.mockReturnValue('user-ref');
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ displayName: 'User One' })
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ displayName: 'User Two' })
        });

      const attendees = await eventsService.getEventAttendees('event-1', 'going');

      expect(attendees).toHaveLength(2);
      expect(attendees[0].displayName).toBe('User One');
    });
  });

  describe('updatePastEvents', () => {
    it('should update events to past status', async () => {
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined)
      };

      mockWriteBatch.mockReturnValue(mockBatch);
      mockQuery.mockReturnValue('query-result');
      mockGetDocs.mockResolvedValue({
        size: 3,
        docs: [
          { ref: 'event-1' },
          { ref: 'event-2' },
          { ref: 'event-3' }
        ]
      });

      const count = await eventsService.updatePastEvents();

      expect(count).toBe(3);
      expect(mockBatch.update).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalled();
    });
  });
});