import axios from 'axios';

const CLOUD_NAME = 'dcwzlpg7m';
const UPLOAD_PRESET = 'campushub-profiles';

async function upload(
  file: File | Blob,
  resourceType: 'image' | 'video' | 'audio',
  folder: string,
  filename: string,
): Promise<string> {
  const formData = new FormData();

  let fileToUpload: File;
  if (file instanceof Blob && !(file instanceof File)) {
    fileToUpload = new File([file], filename, { type: file.type || 'audio/webm' });
  } else {
    fileToUpload = file as File;
  }

  formData.append('file', fileToUpload);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);
  formData.append('public_id', filename);

  const actualResourceType = resourceType === 'audio' ? 'video' : resourceType;
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${actualResourceType}/upload`;

  try {
    const response = await axios.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });

    if (!response.data?.secure_url) {
      throw new Error('No se recibió URL segura de Cloudinary');
    }
    return response.data.secure_url as string;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Error de Cloudinary: ${error.response?.data?.error?.message || error.message}`);
    }
    throw error;
  }
}

export async function uploadProfilePhoto(file: File, userId: string): Promise<string> {
  const filename = `profile_${userId}_${Date.now()}`;
  return upload(file, 'image', 'campushub/profiles', filename);
}

export async function uploadPostMedia(
  file: File,
  mediaType: 'image' | 'video',
  postId: string,
): Promise<string> {
  const filename = `post_${postId}_${Date.now()}`;
  return upload(file, mediaType, 'campushub/posts', filename);
}

export async function uploadAudio(blob: Blob, messageId: string): Promise<string> {
  const filename = `audio_${messageId}_${Date.now()}`;
  const url = await upload(blob, 'video', 'campushub/audio', filename);
  return url.replace('/video/upload/', '/video/upload/f_mp3/');
}

export async function uploadAnnouncementImage(file: File): Promise<string> {
  const filename = `announcement_${Date.now()}`;
  return upload(file, 'image', 'campushub/announcements', filename);
}

export async function uploadCallTone(file: File, userId: string): Promise<string> {
  const filename = `calltone_${userId}_${Date.now()}`;
  const url = await upload(file, 'audio', 'campushub/calltones', filename);
  return url.replace('/video/upload/', '/video/upload/f_mp3/');
}
