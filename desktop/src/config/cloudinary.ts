import axios from 'axios';

console.log('[Cloudinary] Loaded from src/config/cloudinary.ts');

const CLOUD_NAME = 'dcwzlpg7m';
const PROFILE_PRESET = 'campushub-profiles';
const MEDIA_PRESET = 'campushub-profiles';

async function upload(
  file: File,
  resourceType: 'image' | 'video' | 'raw',
  folder: string,
  filename: string,
  preset: string = MEDIA_PRESET,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);
  formData.append('folder', folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  console.log('>>> [Cloudinary] Requesting:', endpoint);
  console.log('>>> [Cloudinary] Folder:', folder, 'Preset:', preset);
  
  try {
    // IMPORTANT: Do NOT set Content-Type header manually when using FormData with Axios.
    // Axios will set it automatically with the correct multipart boundary.
    // Manual setting causes 'Unexpected token H' errors because the boundary is missing.
    const response = await axios.post(endpoint, formData);

    if (!response.data?.secure_url) throw new Error('Upload failed: missing secure_url');
    console.log(`[Cloudinary] Upload success: ${response.data.secure_url}`);
    return response.data.secure_url as string;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const serverMsg = error.response?.data?.error?.message || JSON.stringify(error.response?.data) || error.message;
      console.error('[Cloudinary] Upload error:', serverMsg, '| Status:', error.response?.status);
      throw new Error(`Upload failed: ${serverMsg}`);
    }
    throw error;
  }
}

export async function uploadProfilePhoto(file: File, userId: string): Promise<string> {
  return upload(file, 'image', 'campushub/profiles', `profile_${userId}_${Date.now()}`, PROFILE_PRESET);
}

export async function uploadPostMedia(
  file: File,
  mediaType: 'image' | 'video',
  postId: string,
): Promise<string> {
  return upload(file, mediaType, 'campushub/posts', `post_${postId}_${Date.now()}`);
}

export async function uploadChannelPhoto(file: File, channelId: string): Promise<string> {
  return upload(file, 'image', 'campushub/channels', `channel_${channelId}_${Date.now()}`, PROFILE_PRESET);
}

export async function uploadAnnouncementMedia(
  file: File,
  announcementId: string,
): Promise<string> {
  return upload(file, 'image', 'campushub/announcements', `announcement_${announcementId}_${Date.now()}`);
}

export async function uploadAudio(file: File): Promise<string> {
  // Audio is treated as video resource type in Cloudinary
  return upload(file, 'video', 'campushub/audio', `audio_${Date.now()}`);
}

export async function uploadMessageMedia(file: File): Promise<string> {
  const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
  // Use 'campushub/posts' folder for now as user confirms it works there
  return upload(file, resourceType, 'campushub/posts', `msg_${Date.now()}`);
}

export async function uploadChatFile(file: File, filename: string): Promise<string> {
  // Use 'raw' resource type for PDF, Word, etc.
  return upload(file, 'raw', 'campushub/files', `${Date.now()}_${filename}`);
}
