import * as FileSystem from 'expo-file-system';
import { Linking, Platform, Alert } from 'react-native';

/**
 * Downloads a remote file to the app cache and opens it with the system viewer.
 * On Android, converts to a content:// URI so FileProvider rules are satisfied.
 * On iOS, a file:// URI opened via Linking shows the share/preview sheet.
 */
export async function downloadAndOpenFile(url: string, filename?: string): Promise<void> {
  const name = (filename || url.split('?')[0].split('/').pop() || `file_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const localUri = (FileSystem.cacheDirectory ?? '') + name;

  try {
    const { status, uri } = await FileSystem.downloadAsync(url, localUri);

    if (status !== 200) {
      throw new Error(`HTTP ${status}`);
    }

    if (Platform.OS === 'android') {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await Linking.openURL(contentUri);
    } else {
      await Linking.openURL(uri);
    }
  } catch {
    Alert.alert('Error', 'Could not open the file. Please try again.');
  }
}
