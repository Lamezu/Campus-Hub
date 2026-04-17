import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadChatFile(file: File, messageId: string): Promise<string> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const path = `campushub/chat/files/chat_doc_${messageId}_${timestamp}_${random}${ext ? `.${ext}` : ''}`;

  const fileRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(fileRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      null,
      (error) => reject(new Error(`Error al subir archivo: ${error.message}`)),
      async () => {
        try {
          resolve(await getDownloadURL(uploadTask.snapshot.ref));
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}
