import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

type UploadProgressCallback = (progress: number) => void;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function generateUniquePath(folder: string, identifier: string, originalName?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName ? getFileExtension(originalName) : '';
  const fileName = `${identifier}_${timestamp}_${random}${ext ? `.${ext}` : ''}`;
  return `${folder}/${fileName}`;
}

async function uploadToFirebase(
  file: File | Blob,
  path: string,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const fileRef = ref(storage, path);
  
  let fileToUpload: File;
  if (file instanceof Blob && !(file instanceof File)) {
    fileToUpload = new File([file], path.split('/').pop() || 'file', { type: file.type || 'application/octet-stream' });
  } else {
    fileToUpload = file as File;
  }

  const uploadTask = uploadBytesResumable(fileRef, fileToUpload);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => {
        console.error('Firebase upload error:', error);
        reject(new Error(`Error al subir archivo: ${error.message}`));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

export async function uploadProfilePhoto(file: File, userId: string): Promise<string> {
  const path = generateUniquePath('campushub/profiles', `profile_${userId}`, file.name);
  return uploadToFirebase(file, path);
}

export async function uploadPostMedia(
  file: File,
  mediaType: 'image' | 'video',
  postId: string
): Promise<string> {
  const folder = mediaType === 'image' ? 'campushub/posts/images' : 'campushub/posts/videos';
  const path = generateUniquePath(folder, `post_${postId}`, file.name);
  return uploadToFirebase(file, path);
}

export async function uploadAudio(blob: Blob, messageId: string): Promise<string> {
  const path = generateUniquePath('campushub/audio', `audio_${messageId}`, 'audio.webm');
  return uploadToFirebase(blob, path);
}

export async function uploadAnnouncementImage(file: File): Promise<string> {
  const path = generateUniquePath('campushub/announcements', `announcement`, file.name);
  return uploadToFirebase(file, path);
}

export async function uploadCallTone(file: File, userId: string): Promise<string> {
  const path = generateUniquePath('campushub/calltones', `calltone_${userId}`, file.name);
  return uploadToFirebase(file, path);
}

export async function uploadChatImage(file: File, messageId: string): Promise<string> {
  const path = generateUniquePath('campushub/chat/images', `chat_img_${messageId}`, file.name);
  return uploadToFirebase(file, path);
}

export async function uploadChatFile(file: File, messageId: string): Promise<string> {
  const path = generateUniquePath('campushub/chat/files', `chat_doc_${messageId}`, file.name);
  return uploadToFirebase(file, path);
}