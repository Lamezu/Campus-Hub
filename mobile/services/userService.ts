import { getAuthService as sharedGetAuthService } from './shared';

export async function incrementUserMessageCount(userId: string) {
    try {
        await sharedGetAuthService().incrementMessageCount(userId);
    } catch (error) {
        console.error('Error incrementing user message count:', error);
    }
}

export async function getUser(userId: string) {
    if (!userId) return null;
    try {
        return await sharedGetAuthService().getUserData(userId);
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}
