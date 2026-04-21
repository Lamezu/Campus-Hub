import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from './firebase';

/**
 * Uploads a document to Firebase Storage for the chat.
 * Used in Desktop and Web environments.
 */
export async function uploadChatFile(file: File, filename: string): Promise<string> {
  const meId = auth.currentUser?.uid;
  // IMPORTANT: Using 'campushub/chat' folder because 'campushub/files' is restricted to 'create' only
  // and frequently returns 403. 'chat' has 'allow write' which is more stable.
  const cleanFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const path = `campushub/chat/${cleanFilename}`;
  const storageRef = ref(storage, path);
  
  const metadata = {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      uploadedBy: meId || 'anonymous',
      originalName: filename
    }
  };

  await uploadBytes(storageRef, file, metadata);
  return getDownloadURL(storageRef);
}
