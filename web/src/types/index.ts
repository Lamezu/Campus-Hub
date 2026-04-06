export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: 'student' | 'teacher' | 'admin';
  department: string | null;
  createdAt: string;
  lastActive: string;
  fcmToken: string | null;
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
}

export interface ReplyPreview {
  id: string;
  text: string;
  senderName: string;
  isAudio?: boolean;
  audioDuration?: number;
}

export interface ReplyTo {
  id: string;
  senderName: string;
  text: string;
  isAudio?: boolean;
  audioDuration?: number;
}

export interface ForwardedFrom {
  channelId: string;
  messageId: string;
  senderName: string;
}

export interface PollData {
  question: string;
  options: string[];
  multipleAnswers: boolean;
  votes: Record<string, string[]>;
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
  reactions: Record<string, string[]>;
  replyTo?: ReplyTo | null;
  deletedForUsers?: string[];
  isForwarded?: boolean;
  originalSender?: string | null;
  forwardedFrom?: ForwardedFrom | null;
  poll?: PollData | null;
}

export interface Attachment {
  url: string;
  type: 'image' | 'file' | 'audio';
  name: string;
  size: number;
  duration?: number;
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
  postType?: 'post' | 'announcement';
  pinned?: boolean;
  pinnedUntil?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  imageOffsetY?: number | null;
  linkedEventId?: string | null;
  socialId?: string | null;
  savedBy?: string[];
  docsContent?: string | null;
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
}

export type UserRole = 'student' | 'teacher' | 'admin';
export type UserSubrole = 'delegate' | 'coordinator' | null;

export type NotificationCategory = 'social' | 'dm' | 'campus' | 'friend' | 'general' | 'channel';

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  meta?: Record<string, string>;
}

export type CalendarEventType = 'exam' | 'deadline' | 'holiday' | 'event' | 'class';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate?: string | null;
  allDay: boolean;
  time?: string | null;
  type: CalendarEventType;
  authorId: string;
  authorName: string;
  createdAt: string;
  linkedAnnouncementId?: string | null;
  departmentId?: string | null;
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  subject: string;
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