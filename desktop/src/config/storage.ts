import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads a document to Firebase Storage for the chat.
 * Used in Desktop and Web environments.
 */
export async function uploadChatFile(file: File, filename: string): Promise<string> {
  const path = `campushub/files/${Date.now()}_${filename}`;
  const storageRef = ref(storage, path);
  
  // Set metadata with the actual MIME type
  const metadata = {
    contentType: file.type || 'application/octet-stream',
  };

  await uploadBytes(storageRef, file, metadata);
  return getDownloadURL(storageRef);
}
