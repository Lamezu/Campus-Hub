import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc,
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  Timestamp
} from 'firebase/firestore';

export class EventsService {
  constructor(db) {
    this.db = db;
  }

  async createEvent(eventData, creatorId) {
    const eventRef = doc(collection(this.db, 'events'));

    await setDoc(eventRef, {
      ...eventData,
      creatorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      attendeesCount: 0,
      status: 'upcoming'
    });

    await this.rsvpEvent(eventRef.id, creatorId, 'going');

    return eventRef.id;
  }

  async getEvent(eventId) {
    const eventRef = doc(this.db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);

    if (eventSnap.exists()) {
      return {
        id: eventSnap.id,
        ...eventSnap.data()
      };
    }

    return null;
  }

  async getEvents(filters = {}) {
    const { status = 'upcoming', category = null, limitCount = 20 } = filters;

    let q;

    if (category) {
      q = query(
        collection(this.db, 'events'),
        where('status', '==', status),
        where('category', '==', category),
        orderBy('startDate', status === 'upcoming' ? 'asc' : 'desc'),
        limit(limitCount)
      );
    } else {
      q = query(
        collection(this.db, 'events'),
        where('status', '==', status),
        orderBy('startDate', status === 'upcoming' ? 'asc' : 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async getUserCreatedEvents(userId) {
    const q = query(
      collection(this.db, 'events'),
      where('creatorId', '==', userId),
      orderBy('startDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async getUserAttendingEvents(userId) {
    const q = query(
      collection(this.db, 'rsvps'),
      where('userId', '==', userId),
      where('status', '==', 'going')
    );

    const snapshot = await getDocs(q);
    const rsvps = snapshot.docs.map(doc => doc.data());

    const events = await Promise.all(
      rsvps.map(async (rsvp) => {
        return await this.getEvent(rsvp.eventId);
      })
    );

    return events.filter(event => event !== null);
  }

  async updateEvent(eventId, updates) {
    const eventRef = doc(this.db, 'events', eventId);
    await updateDoc(eventRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  async deleteEvent(eventId) {
    const batch = writeBatch(this.db);

    const eventRef = doc(this.db, 'events', eventId);
    batch.delete(eventRef);

    const rsvpsQuery = query(
      collection(this.db, 'rsvps'),
      where('eventId', '==', eventId)
    );

    const rsvpsSnapshot = await getDocs(rsvpsQuery);
    rsvpsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }

  async rsvpEvent(eventId, userId, status) {
    const existingRSVP = await this.getUserRSVP(eventId, userId);

    const batch = writeBatch(this.db);

    if (existingRSVP) {
      const rsvpRef = doc(this.db, 'rsvps', existingRSVP.id);
      const oldStatus = existingRSVP.status;

      batch.update(rsvpRef, {
        status,
        updatedAt: serverTimestamp()
      });

      if (oldStatus === 'going' && status !== 'going') {
        const eventRef = doc(this.db, 'events', eventId);
        const eventSnap = await getDoc(eventRef);
        const currentCount = eventSnap.data().attendeesCount || 0;

        batch.update(eventRef, {
          attendeesCount: Math.max(0, currentCount - 1)
        });
      } else if (oldStatus !== 'going' && status === 'going') {
        const eventRef = doc(this.db, 'events', eventId);
        const eventSnap = await getDoc(eventRef);
        const currentCount = eventSnap.data().attendeesCount || 0;

        batch.update(eventRef, {
          attendeesCount: currentCount + 1
        });
      }
    } else {
      const rsvpRef = doc(collection(this.db, 'rsvps'));
      batch.set(rsvpRef, {
        eventId,
        userId,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (status === 'going') {
        const eventRef = doc(this.db, 'events', eventId);
        const eventSnap = await getDoc(eventRef);
        const currentCount = eventSnap.data().attendeesCount || 0;

        batch.update(eventRef, {
          attendeesCount: currentCount + 1
        });
      }
    }

    await batch.commit();
  }

  async getUserRSVP(eventId, userId) {
    const q = query(
      collection(this.db, 'rsvps'),
      where('eventId', '==', eventId),
      where('userId', '==', userId)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };
    }

    return null;
  }

  async getEventAttendees(eventId, status = 'going') {
    const q = query(
      collection(this.db, 'rsvps'),
      where('eventId', '==', eventId),
      where('status', '==', status)
    );

    const snapshot = await getDocs(q);
    const rsvps = snapshot.docs.map(doc => doc.data());

    const attendees = await Promise.all(
      rsvps.map(async (rsvp) => {
        const userRef = doc(this.db, 'users', rsvp.userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          return {
            id: rsvp.userId,
            ...userSnap.data(),
            rsvpStatus: rsvp.status
          };
        }
        return null;
      })
    );

    return attendees.filter(attendee => attendee !== null);
  }

  subscribeToEvent(eventId, callback) {
    const eventRef = doc(this.db, 'events', eventId);

    return onSnapshot(eventRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    });
  }

  subscribeToUpcomingEvents(callback, limitCount = 10) {
    const q = query(
      collection(this.db, 'events'),
      where('status', '==', 'upcoming'),
      orderBy('startDate', 'asc'),
      limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      callback(events);
    });
  }

  async updatePastEvents() {
    const now = Timestamp.now();

    const q = query(
      collection(this.db, 'events'),
      where('status', '==', 'upcoming'),
      where('endDate', '<', now)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(this.db);

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'past' });
    });

    await batch.commit();
    return snapshot.size;
  }
}

export default EventsService;