/**
 * Opens a file URL in the system's default browser or application.
 * In Web/Desktop (Renderer), window.open is the standard way to handle download URLs.
 */
export async function downloadAndOpenFile(url: string, filename?: string): Promise<void> {
  const electronAPI = (window as any).electronAPI;

  if (electronAPI?.downloadFile) {
    try {
      const result = await electronAPI.downloadFile(url, filename || 'archivo');
      if (!result.success && result.error !== 'Download cancelled') {
        throw new Error(result.error);
      }
      return;
    } catch (error) {
      console.error('[Download] Native download failed, falling back to window.open:', error);
    }
  }

  // Fallback for web or if electron API fails
  window.open(url, '_blank');
}
