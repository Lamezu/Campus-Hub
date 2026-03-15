import axios from 'axios';

const CLOUD_NAME = 'dcwzlpg7m';
const UPLOAD_PRESET = 'campushub-profiles';

async function upload(
  uri: string,
  resourceType: 'image' | 'video',
  folder: string,
  filename: string,
): Promise<string> {
  const mimeType = resourceType === 'video' ? 'video/mp4' : 'image/jpeg';
  const ext = resourceType === 'video' ? 'mp4' : 'jpg';

  const formData = new FormData();
  formData.append('file', { uri, type: mimeType, name: `${filename}.${ext}` } as any);
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
  formData.append('file', { uri, type: 'audio/mp4', name: `audio_${Date.now()}.m4a` } as any);
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
  const formData = new FormData();
  formData.append('file', { uri, type: mimeType || 'application/octet-stream', name: filename } as any);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'campushub/files');

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;
  const response = await axios.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.data?.secure_url) throw new Error('Upload failed: missing secure_url');
  return response.data.secure_url as string;
}
