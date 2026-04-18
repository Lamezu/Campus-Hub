/**
 * Opens a file URL in the system's default browser or application.
 * In Web/Desktop (Renderer), window.open is the standard way to handle download URLs.
 */
export async function downloadAndOpenFile(url: string, _filename?: string): Promise<void> {
  // Opening the Firebase Storage download URL in a new tab will trigger the browser's 
  // default behavior (opening PDF/images or downloading documents).
  window.open(url, '_blank');
}
