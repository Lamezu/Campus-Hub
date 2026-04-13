import { Linking } from 'react-native';

export async function downloadAndOpenFile(url: string, _filename?: string): Promise<void> {
  await Linking.openURL(url);
}
