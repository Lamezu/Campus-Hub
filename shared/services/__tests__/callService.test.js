import { CallService } from '../callService';

const mockDb = {};

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockAddDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  serverTimestamp: () => ({ _seconds: Date.now() / 1000 }),
  onSnapshot: jest.fn()
}));

describe('CallService', () => {
  let callService;

  beforeEach(() => {
    callService = new CallService(mockDb);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initiateCall', () => {
    it('should create call document', async () => {
      mockCollection.mockReturnValue('calls-collection');
      mockDoc.mockReturnValue({ id: 'call-123' });
      mockSetDoc.mockResolvedValue(undefined);

      const callId = await callService.initiateCall(
        'user-1',
        'user-2',
        'audio',
        'User One'
      );

      expect(callId).toBe('call-123');
      expect(mockSetDoc).toHaveBeenCalledWith(
        { id: 'call-123' },
        expect.objectContaining({
          callerId: 'user-1',
          receiverId: 'user-2',
          type: 'audio',
          status: 'ringing'
        })
      );
    });

    it('should create video call', async () => {
      mockCollection.mockReturnValue('calls-collection');
      mockDoc.mockReturnValue({ id: 'call-456' });
      mockSetDoc.mockResolvedValue(undefined);

      await callService.initiateCall('user-1', 'user-2', 'video', 'User One');

      const setDocCall = mockSetDoc.mock.calls[0][1];
      expect(setDocCall.type).toBe('video');
    });
  });

  describe('setCallOffer', () => {
    it('should update call with offer', async () => {
      const offer = { type: 'offer', sdp: 'mock-sdp' };
      mockDoc.mockReturnValue('call-ref');
      mockUpdateDoc.mockResolvedValue(undefined);

      await callService.setCallOffer('call-1', offer);

      expect(mockUpdateDoc).toHaveBeenCalledWith('call-ref', {
        offer,
        status: 'ringing'
      });
    });
  });

  describe('answerCall', () => {
    it('should update call with answer and set active', async () => {
      const answer = { type: 'answer', sdp: 'mock-sdp' };
      mockDoc.mockReturnValue('call-ref');
      mockUpdateDoc.mockResolvedValue(undefined);

      await callService.answerCall('call-1', answer);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'call-ref',
        expect.objectContaining({
          answer,
          status: 'active'
        })
      );
    });
  });

  describe('rejectCall', () => {
    it('should set call status to rejected', async () => {
      mockDoc.mockReturnValue('call-ref');
      mockUpdateDoc.mockResolvedValue(undefined);

      await callService.rejectCall('call-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'call-ref',
        expect.objectContaining({
          status: 'rejected'
        })
      );
    });
  });

  describe('endCall', () => {
    it('should end call and schedule cleanup', async () => {
      mockDoc.mockReturnValue('call-ref');
      mockUpdateDoc.mockResolvedValue(undefined);
      mockDeleteDoc.mockResolvedValue(undefined);

      await callService.endCall('call-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'call-ref',
        expect.objectContaining({
          status: 'ended'
        })
      );

      jest.advanceTimersByTime(30000);

      await Promise.resolve();

      expect(mockDeleteDoc).toHaveBeenCalledWith('call-ref');
    });
  });

  describe('addCallerCandidate', () => {
    it('should add ICE candidate for caller', async () => {
      const candidate = { candidate: 'mock-candidate' };
      mockCollection.mockReturnValue('candidates-collection');
      mockAddDoc.mockResolvedValue({ id: 'candidate-1' });

      await callService.addCallerCandidate('call-1', candidate);

      expect(mockAddDoc).toHaveBeenCalledWith('candidates-collection', candidate);
    });
  });

  describe('addReceiverCandidate', () => {
    it('should add ICE candidate for receiver', async () => {
      const candidate = { candidate: 'mock-candidate' };
      mockCollection.mockReturnValue('candidates-collection');
      mockAddDoc.mockResolvedValue({ id: 'candidate-2' });

      await callService.addReceiverCandidate('call-1', candidate);

      expect(mockAddDoc).toHaveBeenCalledWith('candidates-collection', candidate);
    });
  });

  describe('getCall', () => {
    it('should get call data', async () => {
      mockDoc.mockReturnValue('call-ref');
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'call-1',
        data: () => ({
          callerId: 'user-1',
          receiverId: 'user-2',
          status: 'active'
        })
      });

      const call = await callService.getCall('call-1');

      expect(call).toEqual({
        id: 'call-1',
        callerId: 'user-1',
        receiverId: 'user-2',
        status: 'active'
      });
    });

    it('should return null if call not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false
      });

      const call = await callService.getCall('non-existent');

      expect(call).toBeNull();
    });
  });

  describe('upgradeToVideo', () => {
    it('should change call type to video', async () => {
      mockDoc.mockReturnValue('call-ref');
      mockUpdateDoc.mockResolvedValue(undefined);

      await callService.upgradeToVideo('call-1');

      expect(mockUpdateDoc).toHaveBeenCalledWith('call-ref', {
        type: 'video'
      });
    });
  });
});