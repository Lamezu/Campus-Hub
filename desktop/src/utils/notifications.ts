// Desktop stub: push notifications not available on Electron
// This prevents any imports from breaking
export async function registerForPushNotifications(_userId: string): Promise<void> {
  // No-op on desktop
}
