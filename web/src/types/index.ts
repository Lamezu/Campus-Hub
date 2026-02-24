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
}

export interface Attachment {
  url: string;
  type: 'image' | 'file';
  name: string;
  size: number;
}