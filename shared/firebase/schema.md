# Database Schema - CampusHub
**Sprint 2-4: Messaging System, Notifications, Forum, DMs and Calls**
**Date:** February-March 2026

---

## 📊 Main Collections

### 1. `users`
**Path:** `/users/{userId}`

**Description:** Registered users from CIFP Villa de Agüimes

**Fields:**
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: 'student' | 'teacher' | 'admin';
  department: string | null;
  createdAt: Timestamp;
  lastActive: Timestamp;
  fcmToken: string | null;
  notificationsEnabled: boolean;
  lastTokenUpdate: Timestamp;
}
```

**Indexes:**
- `role` (ASC)
- `department` (ASC)

**Example:**
```json
{
  "uid": "abc123",
  "email": "samuel.moran@cifpvillaaguimes.es",
  "displayName": "Samuel",
  "photoURL": null,
  "role": "student",
  "department": "DAM",
  "createdAt": "2026-02-02T10:00:00Z",
  "lastActive": "2026-02-02T19:37:00Z",
  "fcmToken": "token_fcm_here",
  "notificationsEnabled": true,
  "lastTokenUpdate": "2026-03-10T10:00:00Z"
}
```

---

### 2. `channels`
**Path:** `/channels/{channelId}`

**Description:** Communication channels (groups, announcements, classes)

**Fields:**
```typescript
{
  name: string;
  description: string;
  type: 'public' | 'private' | 'announcement';
  createdBy: string;
  createdAt: Timestamp;
  memberCount: number;
  lastMessageAt: Timestamp | null;
  departmentRestricted: boolean;
  allowedDepartments: string[];
}
```

**Indexes:**
- `type` (ASC), `lastMessageAt` (DESC)
- `createdAt` (DESC)

**Example:**
```json
{
  "name": "DAM - 2nd Year",
  "description": "Channel for 2nd year DAM students",
  "type": "public",
  "createdBy": "teacher_xyz",
  "createdAt": "2026-02-01T08:00:00Z",
  "memberCount": 25,
  "lastMessageAt": "2026-02-02T19:30:00Z",
  "departmentRestricted": true,
  "allowedDepartments": ["DAM"]
}
```

---

### 3. `channels/{channelId}/members`
**Path:** `/channels/{channelId}/members/{userId}`

**Description:** Subcollection of channel members

**Fields:**
```typescript
{
  userId: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt: Timestamp;
  lastRead: Timestamp;
  notifications: boolean;
}
```

**Example:**
```json
{
  "userId": "abc123",
  "role": "member",
  "joinedAt": "2026-02-01T09:00:00Z",
  "lastRead": "2026-02-02T19:35:00Z",
  "notifications": true
}
```

---

### 4. `channels/{channelId}/messages`
**Path:** `/channels/{channelId}/messages/{messageId}`

**Description:** Real-time messages within each channel

**Fields:**
```typescript
{
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  createdAt: Timestamp;
  edited: boolean;
  editedAt: Timestamp | null;
  attachments: {
    url: string;
    type: 'image' | 'file';
    name: string;
    size: number;
  }[] | null;
  reactions: {
    [emoji: string]: string[];
  };
}
```

**Indexes:**
- `createdAt` (DESC)

**Example:**
```json
{
  "text": "Hi team, any questions about Firebase?",
  "senderId": "abc123",
  "senderName": "Samuel",
  "senderPhoto": null,
  "createdAt": "2026-02-02T19:30:00Z",
  "edited": false,
  "editedAt": null,
  "attachments": null,
  "reactions": {
    "👍": ["user1", "user2"],
    "❤️": ["user3"]
  }
}
```

---

### 5. `conversations`
**Path:** `/conversations/{conversationId}`

**Description:** Private 1-on-1 conversations between users

**ID Format:** `[userId1, userId2].sort().join('_')`

**Fields:**
```typescript
{
  participants: string[];
  createdAt: Timestamp;
  lastMessageAt: Timestamp;
  lastMessage: string | null;
  unreadCount: {
    [userId: string]: number;
  };
}
```

**Indexes:**
- `participants` (array-contains), `lastMessageAt` (DESC)

**Example:**
```json
{
  "participants": ["user1", "user2"],
  "createdAt": "2026-03-10T10:00:00Z",
  "lastMessageAt": "2026-03-10T15:30:00Z",
  "lastMessage": "See you tomorrow in class",
  "unreadCount": {
    "user1": 0,
    "user2": 2
  }
}
```

---

### 6. `conversations/{conversationId}/messages`
**Path:** `/conversations/{conversationId}/messages/{messageId}`

**Description:** Direct messages between two users

**Fields:**
```typescript
{
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  createdAt: Timestamp;
  read: boolean;
  readAt: Timestamp | null;
  attachments: any | null;
  reactions: {
    [emoji: string]: string[];
  };
}
```

**Indexes:**
- `createdAt` (DESC)
- `read` (ASC), `senderId` (ASC), `createdAt` (DESC)

**Example:**
```json
{
  "text": "Do you have the Firebase notes?",
  "senderId": "user1",
  "senderName": "Samuel",
  "senderPhoto": null,
  "createdAt": "2026-03-10T15:30:00Z",
  "read": false,
  "readAt": null,
  "attachments": null,
  "reactions": {}
}
```

---

### 7. `calls`
**Path:** `/calls/{callId}`

**Description:** Voice/video WebRTC calls between users

**Fields:**
```typescript
{
  callerId: string;
  receiverId: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'rejected';
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  callerName: string;
  callerPhoto: string | null;
  createdAt: Timestamp;
  answeredAt: Timestamp | null;
  endedAt: Timestamp | null;
}
```

**Example:**
```json
{
  "callerId": "user1",
  "receiverId": "user2",
  "type": "video",
  "status": "active",
  "offer": { "type": "offer", "sdp": "..." },
  "answer": { "type": "answer", "sdp": "..." },
  "callerName": "Samuel",
  "callerPhoto": null,
  "createdAt": "2026-03-10T16:00:00Z",
  "answeredAt": "2026-03-10T16:00:05Z",
  "endedAt": null
}
```

---

### 8. `calls/{callId}/callerCandidates`
**Path:** `/calls/{callId}/callerCandidates/{candidateId}`

**Description:** ICE candidates from caller for WebRTC

**Fields:**
```typescript
{
  candidate: string;
  sdpMLineIndex: number;
  sdpMid: string;
}
```

---

### 9. `calls/{callId}/receiverCandidates`
**Path:** `/calls/{callId}/receiverCandidates/{candidateId}`

**Description:** ICE candidates from receiver for WebRTC

**Fields:**
```typescript
{
  candidate: string;
  sdpMLineIndex: number;
  sdpMid: string;
}
```

---

### 10. `friendRequests`
**Path:** `/friendRequests/{requestId}`

**Description:** Friend requests between users

**Fields:**
```typescript
{
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  fromUserPhoto: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
  acceptedAt: Timestamp | null;
  rejectedAt: Timestamp | null;
}
```

**Indexes:**
- `toUserId` (ASC), `status` (ASC), `createdAt` (DESC)
- `fromUserId` (ASC), `status` (ASC), `createdAt` (DESC)

**Example:**
```json
{
  "fromUserId": "user1",
  "toUserId": "user2",
  "fromUserName": "Samuel",
  "fromUserPhoto": null,
  "status": "pending",
  "createdAt": "2026-03-10T10:00:00Z",
  "acceptedAt": null,
  "rejectedAt": null
}
```

---

### 11. `friendships`
**Path:** `/friendships/{friendshipId}`

**Description:** Bidirectional friendship relationships

**Fields:**
```typescript
{
  userId: string;
  friendId: string;
  createdAt: Timestamp;
}
```

**Indexes:**
- `userId` (ASC), `createdAt` (DESC)
- `userId` (ASC), `friendId` (ASC)

**Example:**
```json
{
  "userId": "user1",
  "friendId": "user2",
  "createdAt": "2026-03-10T10:05:00Z"
}
```

---

### 12. `events`
**Path:** `/events/{eventId}`

**Description:** School events and activities

**Fields:**
```typescript
{
  title: string;
  description: string;
  category: string;
  location: string;
  startDate: Timestamp;
  endDate: Timestamp;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  attendeesCount: number;
  status: 'upcoming' | 'past';
}
```

**Indexes:**
- `status` (ASC), `startDate` (ASC)
- `status` (ASC), `category` (ASC), `startDate` (ASC)
- `status` (ASC), `endDate` (ASC)

**Example:**
```json
{
  "title": "DAM Hackathon 2026",
  "description": "Programming competition",
  "category": "tech",
  "location": "Room 301",
  "startDate": "2026-03-20T09:00:00Z",
  "endDate": "2026-03-20T18:00:00Z",
  "creatorId": "teacher_xyz",
  "createdAt": "2026-03-10T12:00:00Z",
  "updatedAt": "2026-03-10T12:00:00Z",
  "attendeesCount": 15,
  "status": "upcoming"
}
```

---

### 13. `rsvps`
**Path:** `/rsvps/{rsvpId}`

**Description:** Event attendance confirmations

**Fields:**
```typescript
{
  eventId: string;
  userId: string;
  status: 'going' | 'maybe' | 'not_going';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes:**
- `userId` (ASC), `status` (ASC)
- `eventId` (ASC), `status` (ASC)

**Example:**
```json
{
  "eventId": "event123",
  "userId": "user1",
  "status": "going",
  "createdAt": "2026-03-10T12:30:00Z",
  "updatedAt": "2026-03-10T12:30:00Z"
}
```

---

### 14. `posts`
**Path:** `/posts/{postId}`

**Description:** Student forum posts

**Fields:**
```typescript
{
  title: string;
  content: string;
  category: string;
  authorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
}
```

**Indexes:**
- `createdAt` (DESC)
- `category` (ASC), `createdAt` (DESC)

**Example:**
```json
{
  "title": "Firebase resource recommendations?",
  "content": "Looking for good tutorials...",
  "category": "tech",
  "authorId": "user1",
  "createdAt": "2026-03-10T14:00:00Z",
  "updatedAt": "2026-03-10T14:00:00Z",
  "likesCount": 5,
  "commentsCount": 3,
  "viewsCount": 42
}
```

---

### 15. `posts/{postId}/comments`
**Path:** `/posts/{postId}/comments/{commentId}`

**Description:** Comments on forum posts

**Fields:**
```typescript
{
  text: string;
  authorId: string;
  createdAt: Timestamp;
  likesCount: number;
}
```

**Indexes:**
- `createdAt` (ASC)

---

### 16. `posts/{postId}/likes`
**Path:** `/posts/{postId}/likes/{userId}`

**Description:** Likes on posts

**Fields:**
```typescript
{
  userId: string;
  createdAt: Timestamp;
}
```

---

### 17. `roles`
**Path:** `/roles/{roleId}`

**Description:** System roles and permissions definition

**Fields:**
```typescript
{
  name: 'student' | 'teacher' | 'admin';
  permissions: {
    canCreateChannels: boolean;
    canDeleteMessages: boolean;
    canManageUsers: boolean;
    canSendAnnouncements: boolean;
  };
  createdAt: Timestamp;
}
```

**Example:**
```json
{
  "name": "teacher",
  "permissions": {
    "canCreateChannels": true,
    "canDeleteMessages": true,
    "canManageUsers": false,
    "canSendAnnouncements": true
  },
  "createdAt": "2026-02-01T00:00:00Z"
}
```

---

### 18. `notifications`
**Path:** `/notifications/{notificationId}`

**Description:** Push notifications log

**Fields:**
```typescript
{
  userId: string;
  title: string;
  body: string;
  data: any;
  token: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Timestamp;
}
```

**Example:**
```json
{
  "userId": "user2",
  "title": "New friend request",
  "body": "Samuel wants to be your friend",
  "data": { "type": "friend_request", "fromUserId": "user1" },
  "token": "fcm_token_xyz",
  "status": "sent",
  "createdAt": "2026-03-10T10:00:00Z"
}
```

---

## 🔐 Security Rules

- **Users:** Can only read/edit their own profile
- **Public channels:** All authenticated users can read
- **Private channels:** Only members can read/write
- **Messages:** Only channel members can read/write
- **Conversations:** Only participants can read/write
- **Calls:** Only caller and receiver can read/write
- **Friend requests:** Only involved users can read/modify
- **Events:** All can read, only creator can modify
- **Posts:** All can read, only author can modify
- **Roles:** Only admins can modify

---

## 📈 Growth Estimates

- **Users:** ~500 (students + teachers)
- **Channels:** ~50 (departments, classes, groups)
- **DM Conversations:** ~1,000
- **Calls/day:** ~50
- **Events/month:** ~20
- **Posts/month:** ~100
- **Messages/day:** ~2,000 (channels + DMs)
- **Estimated storage:** ~10 GB/year

---

## 🔄 Active Cloud Functions

1. **onMessageCreated** - Channel message notifications
2. **onCallInitiated** - Incoming call notifications
3. **onFriendRequestCreated** - Friend request notifications
4. **onDirectMessageCreated** - Direct message notifications

---

## 📱 Implemented Services (Sprint 2-4)

**Shared (shared/services/):**
- AuthService
- ChannelService
- MessageService
- NotificationService
- ForumService
- DirectMessageService
- CallService
- FriendsService
- EventsService

**Cloud Functions (functions/):**
- index.js (4 active functions)