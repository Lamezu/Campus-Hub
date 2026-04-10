export type UserRole = 'student' | 'teacher' | 'admin';

export type UserSubrole = 'delegate' | 'coordinator' | null;

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  subrole?: UserSubrole;
  department: string | null;
  bio?: string | null;
  createdAt: string;
  lastActive: string;
  fcmToken: string | null;
  settings?: {
    globalMute?: MuteDuration;
    globalTone?: string;
  };
}

export type MuteDuration = '8h' | '1w' | 'always' | 'off';

export type SaveToPhotosPreference = 'default' | 'always' | 'never';

export interface ContactSettings {
  mute: MuteDuration;
  mutedUntil: number | null;
  saveToPhotos: SaveToPhotosPreference;
  alertTone?: string;
}

export interface SharedMedia {
  id: string;
  url: string;
  type: 'image' | 'video' | 'file' | 'audio' | 'link';
  name: string;
  size: number;
  createdAt: string;
  thumbnail?: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  type: 'public' | 'private' | 'announcement';
  createdBy: string;
  createdAt: string;
  memberCount: number;
  lastMessageAt: string | null;
  departmentRestricted: boolean;
  allowedDepartments: string[];
  icon?: string;
  photoURL?: string | null;
  unreadCount?: number;
  lastMessage?: string;
  lastMessageTime?: string;
  memberIds?: string[];
}

export interface ReplyPreview {
  id: string;
  text: string;
  senderName: string;
  isAudio?: boolean;
  audioDuration?: number;
  type?: 'image' | 'video' | 'file' | 'poll' | 'text' | 'audio';
  attachmentName?: string;
}

export interface ContactCard {
  userId: string;
  name: string;
  photo: string | null;
  role: 'student' | 'teacher' | 'admin';
  bio?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface Poll {
  question: string;
  options: PollOption[];
  multipleAnswers: boolean;
  closed: boolean;
  totalVotes: number;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  createdAt: string;
  edited: boolean;
  editedAt: string | null;
  attachments: Attachment[] | null;
  poll?: Poll | null;
  reactions: Record<string, string[]>;
  replyTo?: ReplyPreview | null;
  deletedForUsers?: string[];
  contactCard?: ContactCard;
  forwarded?: boolean;
  status?: 'sent' | 'delivered' | 'read';
  starred?: boolean;
}

export interface StarredMessage extends Message {
  starredAt: string;
  chatType: 'dm' | 'channel' | 'group';
  conversationId?: string;
  channelId?: string;
  groupId?: string;
}

export interface Attachment {
  url: string;
  type: 'image' | 'video' | 'file' | 'audio' | 'location' | 'contact' | 'post';
  name: string;
  size: number;
  duration?: number;
  imageWidth?: number;
  imageHeight?: number;
  postId?: string;
  postTitle?: string;
  postContent?: string;
  postAuthorName?: string;
  postAuthorPhoto?: string | null;
}

export interface JamendoTrack {
  id: string;
  name: string;
  artistName: string;
  audioUrl: string;
  coverUrl: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  createdAt: string;
  updatedAt: string | null;
  likes: string[];
  likesCount: number;
  commentsCount: number;
  tags?: string[];
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  muteOriginalAudio?: boolean;
  song?: JamendoTrack | null;
  viewsCount?: number;
  views?: string[];
  savedBy?: string[];
  postType?: 'post' | 'announcement';
  pinned?: boolean;
  pinnedUntil?: string | null;
  socialId?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  imageOffsetY?: number | null;
  linkedEventId?: string | null;
  docsContent?: string | null;
  linkedAnnouncementId?: string | null;
  linkedAnnouncementTitle?: string | null;
  sharesCount?: number;
  isPublished?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  createdAt: string;
  likes: string[];
  likesCount: number;
  parentCommentId?: string | null;
  repliesCount?: number;
}

export type CalendarEventType = 'exam' | 'holiday' | 'event' | 'deadline' | 'class';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate?: string | null;
  allDay: boolean;
  time?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  type: CalendarEventType;
  authorId: string;
  authorName: string;
  createdAt: string;
  linkedAnnouncementId?: string | null;
  departmentId?: string | null;
  attendeesCount?: number;
  isPublished?: boolean;
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  subject: string; // Todavía mantenemos esto por compatibilidad o como categoría principal
  subjects?: string[];
  departments?: string[];
  cycles?: string[];
  categoryType?: string; // Para saber qué pestaña estaba activa
  createdBy: string;
  createdByName: string;
  memberIds: string[];
  memberCount: number;
  createdAt: string;
  color: string;
  isPrivate?: boolean;
  photoURL?: string | null;
  allowedRoles?: string[];
  invitedUserIds?: string[];
}

export interface PinnedMessage {
  messageId: string;
  channelId: string;
  text: string;
  senderName: string;
  pinnedAt: string;
  pinnedBy: string;
}

// ─── DM / Contact types ───────────────────────────────────────────────────────

export type NotificationCategory = 'social' | 'dm' | 'campus' | 'friend' | 'general' | 'channel';

export interface DMConversation {
  id: string;
  participantId: string;
  participantName: string;
  participantPhoto: string | null;
  participantRole: 'student' | 'teacher' | 'admin';
  participantBio?: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageSenderId: string;
  unreadCount: number;
  isOnline: boolean;
  isFriend: boolean;
  isBestFriend: boolean;
  friendRequestStatus: 'none' | 'sent' | 'received';
  contactSettings: ContactSettings;
}

export interface GroupConversation {
  id: string;
  name: string;
  photoURL: string | null;
  createdBy: string;
  createdAt: string;
  members: string[];
  memberNames: Record<string, string>;
  memberPhotos: Record<string, string | null>;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
  lastMessageSenderName: string | null;
  unreadCount: number;
  isGroup: true;
}

export interface DirectMessage extends Message {}

export type CallType = 'audio' | 'video';

export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'rejected';

export interface ActiveCall {
  id: string;
  conversationId: string;
  callerId: string;
  callerName: string;
  callerPhoto: string | null;
  receiverId: string;
  type: 'audio' | 'video';
  status: CallStatus;
  startedAt: any | null;
  endedAt: any | null;
  duration: number;
  offer?: any | null;
  answer?: any | null;
}

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  meta?: Record<string, string>;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhoto: string | null;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface MutualGroup {
  id: string;
  name: string;
  photo: string | null;
  memberCount: number;
  memberPreview: string;
  type: 'studyGroup' | 'channel';
}
