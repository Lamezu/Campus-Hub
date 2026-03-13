import axios from 'axios';

const CLOUD_NAME = 'dcwzlpg7m';
const UPLOAD_PRESET = 'campushub-profiles';

async function upload(
  file: File,
  resourceType: 'image' | 'video',
  folder: string,
  filename: string,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const response = await axios.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.data?.secure_url) throw new Error('Upload failed: missing secure_url');
  return response.data.secure_url as string;
}

export async function uploadProfilePhoto(file: File, userId: string): Promise<string> {
  return upload(file, 'image', 'campushub/profiles', `profile_${userId}_${Date.now()}`);
}

export async function uploadPostMedia(
  file: File,
  mediaType: 'image' | 'video',
  postId: string,
): Promise<string> {
  return upload(file, mediaType, 'campushub/posts', `post_${postId}_${Date.now()}`);
}

export async function uploadAudio(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'campushub/audio');

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;
  const response = await axios.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.data?.secure_url) throw new Error('Upload failed: missing secure_url');
  return response.data.secure_url as string;
}
