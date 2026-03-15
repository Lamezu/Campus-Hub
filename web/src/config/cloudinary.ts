import axios from 'axios';

const CLOUD_NAME = 'dcwzlpg7m';
const UPLOAD_PRESET = 'campushub-profiles';

async function upload(
  file: File | Blob,
  resourceType: 'image' | 'video' | 'audio',
  folder: string,
  filename: string,
): Promise<string> {
  console.log(`📤 Subiendo ${resourceType} a Cloudinary...`, { filename, folder });
  
  const formData = new FormData();
  
  let fileToUpload: File;
  if (file instanceof Blob && !(file instanceof File)) {
    fileToUpload = new File([file], filename, { type: file.type || 'audio/webm' });
    console.log('📦 Blob convertido a File:', { 
      size: fileToUpload.size, 
      type: fileToUpload.type 
    });
  } else {
    fileToUpload = file as File;
  }
  
  formData.append('file', fileToUpload);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);
  formData.append('public_id', filename);

  const actualResourceType = resourceType === 'audio' ? 'video' : resourceType;
  
  try {
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${actualResourceType}/upload`;
    console.log('🌐 Endpoint:', endpoint);
    
    const response = await axios.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });

    console.log('✅ Cloudinary response:', response.data);

    if (!response.data?.secure_url) {
      throw new Error('No se recibió URL segura de Cloudinary');
    }
    return response.data.secure_url as string;
  } catch (error) {
    console.error('❌ Error en upload a Cloudinary:', error);
    if (axios.isAxiosError(error)) {
      console.error('Detalles del error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
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
