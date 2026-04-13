import axios from 'axios';
import { Platform } from 'react-native';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';

const CLOUD_NAME = 'dcwzlpg7m';
const UPLOAD_PRESET = 'campushub-profiles';

async function appendFileToForm(formData: FormData, fieldName: string, uri: string, mimeType: string, filename: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append(fieldName, blob, filename);
  } else {
    formData.append(fieldName, { uri, type: mimeType, name: filename } as any);
  }
}

async function upload(
  uri: string,
  resourceType: 'image' | 'video',
  folder: string,
  filename: string,
): Promise<string> {
  const mimeType = resourceType === 'video' ? 'video/mp4' : 'image/jpeg';
  const ext = resourceType === 'video' ? 'mp4' : 'jpg';

  const formData = new FormData();
  await appendFileToForm(formData, 'file', uri, mimeType, `${filename}.${ext}`);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const response = await axios.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.data?.secure_url) throw new Error('Upload failed: missing secure_url');
  return response.data.secure_url as string;
}

export async function uploadProfilePhoto(uri: string, userId: string): Promise<string> {
  return upload(uri, 'image', 'campushub/profiles', `profile_${userId}_${Date.now()}`);
}

export async function uploadGroupPhoto(uri: string, groupId: string): Promise<string> {
  return upload(uri, 'image', 'campushub/groups', `group_${groupId}_${Date.now()}`);
}

export async function uploadChannelPhoto(uri: string, channelId: string): Promise<string> {
  return upload(uri, 'image', 'campushub/channels', `channel_${channelId}_${Date.now()}`);
}

export async function uploadPostMedia(
  uri: string,
  mediaType: 'image' | 'video',
  postId: string,
): Promise<string> {
  return upload(uri, mediaType, 'campushub/posts', `post_${postId}_${Date.now()}`);
}

export async function uploadAnnouncementImage(uri: string): Promise<string> {
  return upload(uri, 'image', 'campushub/announcements', `announcement_${Date.now()}`);
}

export async function uploadChatImage(uri: string): Promise<string> {
  return upload(uri, 'image', 'campushub/chat', `chat_${Date.now()}`);
}

export async function uploadAudio(uri: string): Promise<string> {
  const formData = new FormData();
  await appendFileToForm(formData, 'file', uri, 'audio/mp4', `audio_${Date.now()}.m4a`);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'campushub/audio');

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;
  const response = await axios.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.data?.secure_url) throw new Error('Upload failed: missing secure_url');
  return response.data.secure_url as string;
}

export async function uploadChatVideo(uri: string): Promise<string> {
  return upload(uri, 'video', 'campushub/chat', `chat_video_${Date.now()}`);
}

export async function uploadChatFile(uri: string, filename: string, mimeType?: string): Promise<string> {
  const MIME = mimeType || 'application/octet-stream';
  const path = `campushub/files/${Date.now()}_${filename}`;
  const storageRef = ref(storage, path);
  const blob = await fetch(uri).then(r => r.blob());
  await uploadBytes(storageRef, blob, { contentType: MIME });
  return getDownloadURL(storageRef);
}

