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

export async function uploadPostMedia(
  uri: string,
  mediaType: 'image' | 'video',
  postId: string,
): Promise<string> {
  return upload(uri, mediaType, 'campushub/posts', `post_${postId}_${Date.now()}`);
}
