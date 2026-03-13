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
  replyTo?: ReplyPreview | null;
  deletedForUsers?: string[];
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
