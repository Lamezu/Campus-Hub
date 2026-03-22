export class EventsService {
  constructor(db, firestore) {
    this.db = db;
    this.fs = firestore;
  }

  async createEvent(eventData, creatorId) {
    const eventRef = this.fs.doc(this.fs.collection(this.db, 'events'));
    const eventId = eventRef.id;

    await this.fs.setDoc(eventRef, {
      ...eventData,
      creatorId,
      createdAt: this.fs.serverTimestamp(),
      attendeesCount: 0
    });

    return eventId;
  }

  async getEvent(eventId) {
    const eventRef = this.fs.doc(this.db, 'events', eventId);
    const eventSnap = await this.fs.getDoc(eventRef);
    return eventSnap.exists() ? { id: eventSnap.id, ...eventSnap.data() } : null;
  }

  async getEvents(limitCount = 20) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'events'),
      this.fs.orderBy('startDate', 'asc'),
      this.fs.limit(limitCount)
    );

    const snapshot = await this.fs.getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async updateEvent(eventId, updates) {
    const eventRef = this.fs.doc(this.db, 'events', eventId);
    await this.fs.updateDoc(eventRef, {
      ...updates,
      updatedAt: this.fs.serverTimestamp()
    });
  }

  async deleteEvent(eventId) {
    const eventRef = this.fs.doc(this.db, 'events', eventId);
    await this.fs.deleteDoc(eventRef);
  }

  subscribeToEvents(callback) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'events'),
      this.fs.orderBy('startDate', 'asc')
    );

    return this.fs.onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }

  async rsvpToEvent(eventId, userId, status) {
    const rsvpRef = this.fs.doc(this.db, 'events', eventId, 'rsvps', userId);
    const rsvpSnap = await this.fs.getDoc(rsvpRef);

    const batch = this.fs.writeBatch(this.db);
    const eventRef = this.fs.doc(this.db, 'events', eventId);

    if (rsvpSnap.exists()) {
      const oldStatus = rsvpSnap.data().status;
      if (oldStatus === 'going' && status !== 'going') {
        batch.update(eventRef, { attendeesCount: this.fs.increment(-1) });
      } else if (oldStatus !== 'going' && status === 'going') {
        batch.update(eventRef, { attendeesCount: this.fs.increment(1) });
      }
      batch.update(rsvpRef, { status, updatedAt: this.fs.serverTimestamp() });
    } else {
      if (status === 'going') {
        batch.update(eventRef, { attendeesCount: this.fs.increment(1) });
      }
      batch.set(rsvpRef, { status, createdAt: this.fs.serverTimestamp() });
    }

    await batch.commit();
  }
}
export default EventsService;